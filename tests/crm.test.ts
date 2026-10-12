import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("crm flags a shared email and a clean list", () => {
  const broken = runCheck(
    rule("crm.duplicate-contacts", "crm", { minGroupSize: 2 }),
    snapshot({
      contacts: [
        { id: "1", email: "ada@example.com", lifecycleStage: "lead", leadStatus: "NEW" },
        { id: "2", email: "ada@example.com", lifecycleStage: "lead", leadStatus: "NEW" },
      ],
    }),
  );
  assert.equal(broken.status, "broken");
  assert.equal(broken.evidence.includes("@"), false);

  const working = runCheck(
    rule("crm.duplicate-contacts", "crm"),
    snapshot({ contacts: [{ id: "1", email: "ada@example.com", lifecycleStage: "lead", leadStatus: "NEW" }] }),
  );
  assert.equal(working.status, "working");
});

test("crm flags duplicate company domains", () => {
  const finding = runCheck(
    rule("crm.duplicate-companies", "crm"),
    snapshot({
      companies: [
        { id: "1", domain: "northpier.example" },
        { id: "2", domain: "northpier.example" },
      ],
    }),
  );
  assert.equal(finding.status, "broken");
});

test("crm flags thin required properties and unused custom properties", () => {
  const portal = snapshot({
    properties: [
      { objectType: "contacts", name: "email", label: "Email", custom: false, required: true, filledCount: 1, totalCount: 5 },
      { objectType: "contacts", name: "favourite_glass", label: "Favourite glass", custom: true, required: false, filledCount: 0, totalCount: 5 },
    ],
  });
  assert.equal(runCheck(rule("crm.missing-required-properties", "crm", { names: ["email"], minFillRatio: 0.9 }), portal).status, "broken");
  assert.equal(runCheck(rule("crm.unused-custom-properties", "crm"), portal).status, "missing");
});

test("crm does not treat an unsampled property as empty", () => {
  const portal = snapshot({
    properties: [
      { objectType: "contacts", name: "email", label: "Email", custom: false, required: true, filledCount: 4, totalCount: 4 },
      { objectType: "contacts", name: "firstname", label: "First name", custom: false, required: true, filledCount: null, totalCount: 4 },
    ],
  });
  assert.equal(runCheck(rule("crm.missing-required-properties", "crm", { names: ["email", "firstname"], minFillRatio: 0.9 }), portal).status, "working");
});

test("crm flags a conflicting lifecycle pair", () => {
  const finding = runCheck(
    rule("crm.lifecycle-lead-status", "crm", { conflicts: ["customer|NEW"] }),
    snapshot({ contacts: [{ id: "1", email: "a@example.com", lifecycleStage: "customer", leadStatus: "NEW" }] }),
  );
  assert.equal(finding.status, "broken");
});
