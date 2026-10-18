import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { countRecentSubmissions, formProtection } from "../src/hubspot/form-protection.ts";
import { audit, reportToMarkdown } from "../src/report.ts";
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
  const spam = runCheck(rule("forms.spam-protection", "forms"), unknown);
  assert.equal(spam.status, "needs_operator_confirmation");
  assert.notEqual(spam.status, "working");
  const unembedded = snapshot({
    forms: [{ id: "f1", name: "Demo", archived: false, embedded: false, unmappedFields: 0, gdprConsent: true, followUpEmail: null, spamProtection: true }],
  });
  assert.equal(runCheck(rule("forms.follow-up-email", "forms"), unembedded).status, "missing");
});

test("a public form with one submission outranks a private form with many", () => {
  const portal = snapshot({
    forms: [
      { id: "quiet", name: "Internal", archived: false, embedded: false, unmappedFields: 0, gdprConsent: true, followUpEmail: false, spamProtection: false, recentSubmissions: 500 },
      { id: "live", name: "Public", archived: false, embedded: true, unmappedFields: 0, gdprConsent: true, followUpEmail: true, spamProtection: false, recentSubmissions: 1 },
    ],
  });
  const finding = runCheck(rule("forms.spam-protection", "forms"), portal);
  assert.equal(finding.status, "broken");
  assert.equal(finding.severity, "critical");
  assert.ok(finding.evidence.indexOf("Public") < finding.evidence.indexOf("Internal"));
  assert.match(finding.evidence, /1 submissions in 30 days/);
  assert.equal(finding.recommendedFix.includes("Owner:"), false);
  assert.equal(finding.ownerRole, "Marketing ops");
  assert.match(finding.retest, /Submit the form once as a person/);
  const onlyPrivate = runCheck(rule("forms.spam-protection", "forms"), snapshot({
    forms: [{ id: "quiet", name: "Internal", archived: false, embedded: false, unmappedFields: 0, gdprConsent: true, followUpEmail: false, spamProtection: false, recentSubmissions: 500 }],
  }));
  assert.equal(onlyPrivate.severity, "low");
  const queued = audit(portal, "2026-10-12T00:00:00.000Z").plan.find((bucket) => bucket.days === 30);
  const spam = queued?.items.find((item) => item.id === "forms.spam-protection");
  assert.ok(spam);
  assert.equal(spam.ownerRole, "Marketing ops");
  assert.match(spam.retest, /Submit the form once as a person/);
  assert.equal(spam.action.includes("Owner:"), false);
  assert.equal(spam.action.includes("Retest:"), false);
});

test("unknown spam protection is confirmation and a missing count is not zero", () => {
  const portal = snapshot({
    forms: [{ id: "f1", name: "Demo", archived: false, embedded: true, unmappedFields: 0, gdprConsent: true, followUpEmail: true, spamProtection: null, recentSubmissions: null }],
  });
  const finding = runCheck(rule("forms.spam-protection", "forms"), portal);
  assert.equal(finding.status, "needs_operator_confirmation");
  assert.match(finding.evidence, /submission count was not returned/);
  assert.equal(finding.evidence.includes("0 submissions"), false);
  const markdown = reportToMarkdown(audit(portal, "2026-10-12T00:00:00.000Z"));
  assert.match(markdown, /## Needs operator confirmation/);
  assert.match(markdown, /Spam protection/);
});

test("captcha or a honeypot field counts as protection, and a partial read does not", () => {
  assert.equal(formProtection({
    configuration: { recaptchaEnabled: false },
    fieldGroups: [{ fields: [{ name: "website", label: "Honeypot", hidden: true }] }],
  }), true);
  assert.equal(formProtection({
    configuration: { recaptchaEnabled: false },
    fieldGroups: [{ fields: [{ name: "email", hidden: false }] }],
  }), false);
  assert.equal(formProtection({ configuration: { recaptchaEnabled: false } }), null);
  assert.equal(formProtection({ configuration: { recaptchaEnabled: true } }), true);
  const now = Date.parse("2026-10-12T00:00:00.000Z");
  const counted = countRecentSubmissions([
    { submittedAt: now - 1_000 },
    { submittedAt: now - 40 * 86_400_000 },
  ], now);
  assert.deepEqual(counted, { count: 1, capped: false });
  const full = countRecentSubmissions(Array.from({ length: 50 }, () => ({ submittedAt: now - 1_000 })), now);
  assert.equal(full.capped, true);
  assert.equal(full.count, 50);
});
