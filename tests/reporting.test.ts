import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("reporting keeps a dashboard and flags missing attribution and funnel reports", () => {
  const portal = snapshot({
    reports: [{ id: "r1", name: "Weekly", kind: "dashboard" }],
  });
  assert.equal(runCheck(rule("reporting.dashboards", "reporting"), portal).status, "working");
  assert.equal(runCheck(rule("reporting.attribution", "reporting"), portal).status, "missing");
  assert.equal(runCheck(rule("reporting.lifecycle-funnel", "reporting"), portal).status, "missing");
});
