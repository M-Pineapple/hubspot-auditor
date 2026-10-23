import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { loadPortal } from "../src/hubspot/load.ts";
import { rule, snapshot } from "./helpers.ts";

const portal = snapshot({
  pipelines: [
    {
      objectType: "deals",
      id: "sales",
      label: "Sales",
      stages: [
        { id: "new", label: "New", probability: 10, requiredProperties: ["dealname"] },
        { id: "quote", label: "Quote", probability: 20, requiredProperties: ["dealname"] },
      ],
      automatedStageIds: [],
    },
    {
      objectType: "tickets",
      id: "support",
      label: "Support",
      stages: [{ id: "open", label: "Open", probability: null, requiredProperties: [] }],
      automatedStageIds: ["open"],
    },
  ],
  deals: [{ id: "d1", pipelineId: "sales", stageId: "new", daysSinceUpdate: 45 }],
});

test("pipelines flag weak probabilities, stale deals, and missing stage fields", () => {
  assert.equal(runCheck(rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40 }), portal).status, "broken");
  assert.equal(runCheck(rule("pipelines.stale-deals", "pipelines", { staleDays: 30 }), portal).status, "broken");
  const fields = runCheck(rule("pipelines.required-fields", "pipelines", { properties: ["dealname", "amount"] }), portal);
  assert.equal(fields.status, "missing");
  assert.equal(fields.process, "billing");
  assert.equal(fields.severity, "critical");
  assert.match(fields.evidence, /amount/);
});

test("the default HubSpot pipeline does not fail on Closed Lost at zero probability", async () => {
  const probabilities = ["0.2", "0.4", "0.6", "0.8", "0.9", "1.0", "0.0"];
  const labels = ["Appointment scheduled", "Qualified to buy", "Presentation scheduled",
    "Decision maker bought-in", "Contract sent", "Closed won", "Closed lost"];
  const loaded = await loadPortal("fixture-token", undefined, async (input, init) => {
    const url = new URL(String(input));
    const tokenInfo = url.pathname === "/oauth/v2/private-apps/get/access-token-info";
    assert.ok(init?.method === "GET" || (init?.method === "POST" && tokenInfo));
    if (tokenInfo) return Response.json({ scopes: ["crm.objects.deals.read"] });
    if (url.pathname === "/crm/v3/pipelines/deals") {
      return Response.json({ results: [{
        id: "default", label: "Sales Pipeline",
        stages: probabilities.map((probability, index) => ({
          id: String(index), label: labels[index], metadata: { probability },
        })),
      }] });
    }
    return Response.json({ results: [] });
  });
  assert.deepEqual(loaded.pipelines[0].stages.map((stage) => stage.probability), [20, 40, 60, 80, 90, 100, 0]);
  const check = rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40 });
  assert.equal(runCheck(check, loaded).status, "needs_operator_confirmation");
  const confirmed = { ...check, params: { ...check.params, operatorConfirmed: true } };
  assert.equal(runCheck(confirmed, loaded).status, "working");
  loaded.pipelines[0].stages.forEach((stage, index) => { stage.label = `Custom stage ${index}`; });
  assert.equal(runCheck(confirmed, loaded).status, "working");
});

test("low or unknown open-stage probabilities still fail alongside closed stages", () => {
  for (const probability of [20, null]) {
    const mixed = snapshot({ pipelines: [{
      ...portal.pipelines[0],
      stages: [
        { id: "new", label: "New", probability: 10, requiredProperties: [] },
        { id: "quote", label: "Quote", probability, requiredProperties: [] },
        { id: "won", label: "Custom success", probability: 100, requiredProperties: [] },
        { id: "lost", label: "Custom loss", probability: 0, requiredProperties: [] },
      ],
    }] });
    const result = runCheck(rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40 }), mixed);
    assert.equal(result.status, "broken");
    assert.match(result.evidence, /^1 later deal stage/);
  }
});

test("explicitly open stages at zero probability fail when loaded from HubSpot", async () => {
  for (const isClosed of ["false", false]) {
    const loaded = await loadPortal("fixture-token", undefined, async (input) => {
      if (new URL(String(input)).pathname === "/crm/v3/pipelines/deals") {
        return Response.json({ results: [{
          id: "sales", label: "Sales",
          stages: [
            { id: "new", label: "New", metadata: { probability: "0.0", isClosed } },
            { id: "quote", label: "Quote", metadata: { probability: "0.0", isClosed } },
          ],
        }] });
      }
      return Response.json({ results: [] });
    });
    for (const operatorConfirmed of [false, true]) {
      const result = runCheck(rule("pipelines.stage-probabilities", "pipelines", {
        lateStageMinProbability: 40, operatorConfirmed,
      }), loaded);
      assert.equal(result.status, "broken");
      assert.match(result.evidence, /^1 later deal stage/);
    }
    assert.deepEqual(loaded.pipelines[0].stages.map((stage) => stage.isClosed), [false, false]);
  }
});

test("explicitly closed stages take precedence over low or unknown probabilities", async () => {
  for (const isClosed of ["true", true]) {
    const loaded = await loadPortal("fixture-token", undefined, async (input) => {
      if (new URL(String(input)).pathname === "/crm/v3/pipelines/deals") {
        return Response.json({ results: [{
          id: "sales", label: "Sales",
          stages: [
            { id: "new", label: "New", metadata: { probability: "0.2" } },
            { id: "closed-low", label: "Custom outcome", metadata: { probability: "0.2", isClosed } },
            { id: "closed-unknown", label: "Another outcome", metadata: { isClosed } },
          ],
        }] });
      }
      return Response.json({ results: [] });
    });
    const check = rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40 });
    assert.equal(runCheck(check, loaded).status, "needs_operator_confirmation");
    assert.equal(runCheck({ ...check, params: { ...check.params, operatorConfirmed: true } }, loaded).status, "working");
    assert.deepEqual(loaded.pipelines[0].stages.map((stage) => stage.isClosed), [undefined, true, true]);
  }
});

test("a ticket pipeline failure does not hide deal stage probabilities", () => {
  const portal = snapshot({
    fetchGaps: [{ area: "pipelines-tickets", path: "/crm/v3/pipelines/tickets", status: 403 }],
    pipelines: [
      {
        objectType: "deals",
        id: "sales",
        label: "Sales",
        stages: [
          { id: "new", label: "New", probability: 10, requiredProperties: ["dealname", "amount"] },
          { id: "quote", label: "Quote", probability: 60, requiredProperties: ["dealname", "amount"] },
        ],
        automatedStageIds: ["quote"],
        automationKnown: true,
      },
    ],
  });
  const probabilities = runCheck(rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40 }), portal);
  assert.equal(probabilities.status, "needs_operator_confirmation");
  const accepted = runCheck(
    rule("pipelines.stage-probabilities", "pipelines", { lateStageMinProbability: 40, operatorConfirmed: true }),
    portal,
  );
  assert.equal(accepted.status, "working");
  assert.equal(runCheck(rule("pipelines.ticket-pipeline", "pipelines"), portal).status, "missing");
});

test("pipelines do not call an empty deal sample healthy", () => {
  assert.equal(runCheck(rule("pipelines.stale-deals", "pipelines"), snapshot()).status, "missing");
});

test("pipelines treat a quiet deal pipeline as missing automation and keep the ticket pipeline", () => {
  assert.equal(runCheck(rule("pipelines.stage-automation", "pipelines"), portal).status, "missing");
  assert.equal(runCheck(rule("pipelines.ticket-pipeline", "pipelines"), portal).status, "working");
});
