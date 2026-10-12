import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("email flags an errored workflow, a missing nurture, and a weak sender domain", () => {
  const portal = snapshot({
    workflows: [
      { id: "w1", name: "Notify", enabled: true, errored: true, enrolmentCount: 4, kind: "workflow" },
    ],
    senderDomains: [{ domain: "example.com", spf: "pass", dkim: "fail", dmarc: "missing" }],
  });
  assert.equal(runCheck(rule("email.workflows-health", "email"), portal).status, "broken");
  assert.equal(runCheck(rule("email.nurture-sequence", "email"), portal).status, "missing");
  assert.equal(runCheck(rule("email.unengaged-handling", "email"), portal).status, "missing");
  assert.equal(runCheck(rule("email.sender-authentication", "email"), portal).status, "broken");
});

test("email stays missing when enrolment counts were not returned", () => {
  const portal = snapshot({
    workflows: [{ id: "w1", name: "Notify", enabled: true, errored: null, enrolmentCount: null, kind: "workflow" }],
  });
  assert.equal(runCheck(rule("email.workflows-health", "email"), portal).status, "missing");
});
