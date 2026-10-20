import assert from "node:assert/strict";
import { test } from "node:test";
import { portalNameList, runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("a failed name lookup is not reported as a missing scope", () => {
  const portal = snapshot({ fetchGaps: [{ area: "contacts", path: "/crm/v3/objects/contacts", status: 0 }] });
  const finding = runCheck(rule("crm.duplicate-contacts", "crm"), portal);
  assert.equal(finding.status, "missing");
  assert.match(finding.evidence, /No HTTP response/);
  assert.equal(finding.recommendedFix.includes("scope"), false);
});

test("throttling is not described as a missing scope", () => {
  const portal = snapshot({ fetchGaps: [{ area: "contacts", path: "/crm/v3/objects/contacts", status: 429 }] });
  const finding = runCheck(rule("crm.duplicate-contacts", "crm"), portal);
  assert.match(finding.evidence, /HTTP 429/);
  assert.match(finding.recommendedFix, /throttling or a HubSpot outage/);
});

test("portal names in evidence are shortened and stripped", () => {
  const listed = portalNameList(["safe", "a".repeat(80), "<script>alert(1)</script>", "two", "three", "four", "five", "six"]);
  assert.equal(listed.includes("<"), false);
  assert.match(listed, /and \d+ more/);
  assert.ok(listed.length < 250);
});

test("a forbidden read still asks for the scope", () => {
  const portal = snapshot({ fetchGaps: [{ area: "contacts", path: "/crm/v3/objects/contacts", status: 403 }] });
  const finding = runCheck(rule("crm.duplicate-contacts", "crm"), portal);
  assert.match(finding.evidence, /HTTP 403/);
  assert.match(finding.recommendedFix, /scope/);
});

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

test("crm does not pass unused custom properties without sampled values", () => {
  for (const values of [
    { filledCount: null, totalCount: 5 },
    { filledCount: 0, totalCount: 0 },
  ]) {
    const portal = snapshot({
      properties: [
        { objectType: "contacts", name: "email", label: "Email", custom: false, required: true, filledCount: 5, totalCount: 5 },
        { objectType: "contacts", name: "custom_field", label: "Custom field", custom: true, required: false, ...values },
      ],
    });
    const finding = runCheck(rule("crm.unused-custom-properties", "crm"), portal);
    assert.equal(finding.status, "missing");
    assert.match(finding.evidence, /No custom properties had sampled contact values/);
    assert.match(finding.recommendedFix, /Request custom properties/);
    assert.doesNotMatch(finding.recommendedFix, /archive/i);
  }
});

test("crm judges unused custom properties only from sampled contacts", () => {
  const measured = {
    objectType: "contacts" as const, name: "measured", label: "Measured", custom: true,
    required: false, filledCount: 1, totalCount: 5,
  };
  const portal = snapshot({ properties: [
    measured,
    { ...measured, name: "unsampled", filledCount: null },
    { ...measured, name: "no_contacts", filledCount: 0, totalCount: 0 },
  ] });
  assert.equal(runCheck(rule("crm.unused-custom-properties", "crm"), portal).status, "working");
  const unused = runCheck(rule("crm.unused-custom-properties", "crm", { maxFilled: 1 }), portal);
  assert.equal(unused.status, "missing");
  assert.match(unused.evidence, /1 custom property name\(s\) have no values: measured/);
});

test("crm does not treat an unsampled property as empty", () => {
  const portal = snapshot({
    properties: [
      { objectType: "contacts", name: "email", label: "Email", custom: false, required: true, filledCount: 4, totalCount: 4 },
      { objectType: "contacts", name: "firstname", label: "First name", custom: false, required: true, filledCount: null, totalCount: 4 },
    ],
  });
  const filled = runCheck(rule("crm.missing-required-properties", "crm", { names: ["email", "firstname"], minFillRatio: 0.9 }), portal);
  assert.equal(filled.status, "needs_operator_confirmation");
  assert.match(filled.evidence, /read-only token cannot confirm/);
  const accepted = runCheck(
    rule("crm.missing-required-properties", "crm", { names: ["email", "firstname"], minFillRatio: 0.9, operatorConfirmed: true }),
    portal,
  );
  assert.equal(accepted.status, "working");
});

test("crm flags a conflicting lifecycle pair and does not pass a clean sample", () => {
  const finding = runCheck(
    rule("crm.lifecycle-lead-status", "crm", { conflicts: ["customer|NEW"] }),
    snapshot({ contacts: [{ id: "1", email: "a@example.com", lifecycleStage: "customer", leadStatus: "NEW" }] }),
  );
  assert.equal(finding.status, "broken");
  const clean = snapshot({ contacts: [{ id: "1", email: "a@example.com", lifecycleStage: "lead", leadStatus: "NEW" }] });
  const unconfirmed = runCheck(rule("crm.lifecycle-lead-status", "crm", { conflicts: ["customer|NEW"] }), clean);
  assert.equal(unconfirmed.status, "needs_operator_confirmation");
  const confirmed = runCheck(
    rule("crm.lifecycle-lead-status", "crm", { conflicts: ["customer|NEW"], operatorConfirmed: true }),
    clean,
  );
  assert.equal(confirmed.status, "working");
});

test("property severity follows the process and ignores how many names are listed", () => {
  const harmless = Array.from({ length: 10 }, (_, index) => ({
    objectType: "contacts" as const,
    name: `colour_${index}`,
    label: `Colour ${index}`,
    custom: true,
    required: false,
    filledCount: 0,
    totalCount: 5,
  }));
  const many = runCheck(rule("crm.unused-custom-properties", "crm"), snapshot({ properties: harmless }));
  assert.equal(many.severity, "high");
  assert.equal(many.process, "data hygiene");
  assert.match(many.evidence, /10 custom/);

  const country = {
    objectType: "contacts" as const,
    name: "billing_country",
    label: "Billing country",
    custom: true,
    required: false,
    filledCount: 0,
    totalCount: 5,
  };
  const one = runCheck(rule("crm.unused-custom-properties", "crm"), snapshot({ properties: [country] }));
  assert.equal(one.severity, "critical");
  assert.equal(one.process, "territory assignment");
  assert.match(one.evidence, /billing_country/);

  const mixed = runCheck(rule("crm.unused-custom-properties", "crm"), snapshot({ properties: [country, ...harmless] }));
  assert.equal(mixed.severity, "critical");
  assert.equal(mixed.process, "territory assignment");
  assert.match(mixed.evidence, /^11 custom property name\(s\) have no values: billing_country/);
});
