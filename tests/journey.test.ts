import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

const stages = {
  stages: [
    { stage: "subscriber", patterns: ["welcome"] },
    { stage: "customer", patterns: ["onboarding"] },
  ],
};

test("journey flags a buyer stage with no published email", () => {
  const portal = snapshot({
    emails: [{ id: "e1", name: "Welcome note", subject: "Welcome", published: true, hasCampaign: false }],
  });
  const finding = runCheck(rule("journey.stage-hooks", "journey", stages), portal);
  assert.equal(finding.status, "broken");
  assert.match(finding.evidence, /customer/);
  assert.equal(finding.evidence.includes("@"), false);
});

test("journey accepts stages covered by a published email or an active workflow", () => {
  const portal = snapshot({
    emails: [{ id: "e1", name: "Welcome note", subject: "Welcome", published: true, hasCampaign: true }],
    workflows: [{ id: "w1", name: "Customer onboarding", enabled: true, errored: false, enrolmentCount: 2, kind: "workflow" }],
  });
  assert.equal(runCheck(rule("journey.stage-hooks", "journey", stages), portal).status, "working");
});
