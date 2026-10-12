import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

const portal = snapshot({
  forms: [
    { id: "f1", name: "Demo", archived: false, embedded: true, unmappedFields: 1, gdprConsent: false, followUpEmail: false, spamProtection: false },
    { id: "f2", name: "Old", archived: false, embedded: false, unmappedFields: 0, gdprConsent: true, followUpEmail: false, spamProtection: true },
  ],
});

test("forms cover live, unused, mapping, consent, follow-up, and spam", () => {
  assert.equal(runCheck(rule("forms.live-forms", "forms"), portal).status, "working");
  assert.equal(runCheck(rule("forms.unused-forms", "forms"), portal).status, "missing");
  assert.equal(runCheck(rule("forms.field-mapping", "forms"), portal).status, "broken");
  assert.equal(runCheck(rule("forms.gdpr-consent", "forms"), portal).status, "broken");
  assert.equal(runCheck(rule("forms.follow-up-email", "forms"), portal).status, "missing");
  assert.equal(runCheck(rule("forms.spam-protection", "forms"), portal).status, "broken");
});

test("forms stay missing when the API did not return consent or embed status", () => {
  const unknown = snapshot({
    forms: [{ id: "f1", name: "Demo", archived: false, embedded: null, unmappedFields: null, gdprConsent: null, followUpEmail: null, spamProtection: null }],
  });
  assert.equal(runCheck(rule("forms.gdpr-consent", "forms"), unknown).status, "missing");
  assert.equal(runCheck(rule("forms.follow-up-email", "forms"), unknown).status, "missing");
  const unembedded = snapshot({
    forms: [{ id: "f1", name: "Demo", archived: false, embedded: false, unmappedFields: 0, gdprConsent: true, followUpEmail: null, spamProtection: true }],
  });
  assert.equal(runCheck(rule("forms.follow-up-email", "forms"), unembedded).status, "missing");
});
