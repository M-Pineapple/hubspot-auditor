import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("program checks lists, lead score, subscription types, and campaigns", () => {
  const ready = snapshot({
    lists: [{ id: "l1", name: "Leads", dynamic: true }],
    properties: [
      { objectType: "contacts", name: "hs_predictivecontactscore", label: "Score", custom: false, required: false, filledCount: 3, totalCount: 4 },
    ],
    subscriptionTypes: [{ id: "s1", name: "Marketing" }],
    emails: [{ id: "e1", name: "Welcome", subject: "Welcome", published: true, hasCampaign: true }],
    landingPages: [
      { id: "p1", name: "Offer", published: true, metaTitle: "Offer", metaDescription: "Offer", html: "<p></p>", hasCampaign: true },
    ],
  });
  assert.equal(runCheck(rule("program.dynamic-lists", "program"), ready).status, "working");
  assert.equal(runCheck(rule("program.lead-score", "program", { names: ["hs_predictivecontactscore"] }), ready).status, "working");
  assert.equal(runCheck(rule("program.subscription-types", "program"), ready).status, "working");
  assert.equal(runCheck(rule("program.campaigns", "program"), ready).status, "working");
});

test("program reports a score property that never fills", () => {
  const portal = snapshot({
    properties: [
      { objectType: "contacts", name: "hubspotscore", label: "Score", custom: false, required: false, filledCount: 0, totalCount: 4 },
    ],
  });
  assert.equal(runCheck(rule("program.lead-score", "program", { names: ["hubspotscore"] }), portal).status, "broken");
});
