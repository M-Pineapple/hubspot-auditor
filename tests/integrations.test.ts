import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("integrations flag an inactive webhook and a sync error", () => {
  const portal = snapshot({
    integrations: [{ id: "i1", name: "Ledger", connected: true, syncError: true }],
    webhooks: [{ id: "h1", eventType: "contact.creation", active: false, errorCount: 3 }],
  });
  assert.equal(runCheck(rule("integrations.connected-apps", "integrations"), portal).status, "working");
  assert.equal(runCheck(rule("integrations.webhook-subscriptions", "integrations"), portal).status, "broken");
  assert.equal(runCheck(rule("integrations.sync-errors", "integrations"), portal).status, "broken");
});

test("integrations stay missing when the read failed", () => {
  const portal = snapshot({ fetchGaps: [{ area: "webhooks", path: "/webhooks/v3/subscriptions", status: 403 }] });
  assert.equal(runCheck(rule("integrations.webhook-subscriptions", "integrations"), portal).status, "missing");
});
