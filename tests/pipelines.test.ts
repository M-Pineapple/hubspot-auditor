import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
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
