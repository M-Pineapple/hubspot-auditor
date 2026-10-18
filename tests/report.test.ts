import assert from "node:assert/strict";
import { test } from "node:test";
import { checks, runCheck } from "../src/checks.ts";
import { loadDemoPortal } from "../src/demo.ts";
import { checkMeta, compareFindings } from "../src/impact.ts";
import { audit, reportToJson, reportToMarkdown } from "../src/report.ts";
import { loadRules } from "../src/rules.ts";
import type { Finding } from "../src/types.ts";
import { rule, snapshot } from "./helpers.ts";

test("every YAML check has an implementation and a demo finding", () => {
  const rules = loadRules();
  const auditors = new Set(rules.map((item) => item.auditor));
  assert.deepEqual(
    [...auditors].sort(),
    ["brand", "crm", "email", "forms", "integrations", "journey", "pipelines", "program", "reporting", "tracking"],
  );
  for (const item of rules) assert.equal(typeof checks[item.id], "function", item.id);
  const report = audit(loadDemoPortal(), "2026-10-12T00:00:00.000Z");
  assert.equal(report.findings.length, rules.length);
  assert.equal(report.fictional, true);
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.deepEqual(report.plan.map((bucket) => bucket.days), [30, 60, 90]);
  const markdown = reportToMarkdown(report);
  const json = reportToJson(report);
  assert.match(markdown, /30\/60\/90-day plan/);
  assert.equal(json.includes("@"), false);
  for (const finding of report.findings) assert.equal(finding.evidence.includes("@"), false);
});

test("an unknown check id is reported as missing", () => {
  const finding = runCheck(rule("crm.not-a-check", "crm"), snapshot());
  assert.equal(finding.status, "missing");
  assert.equal(finding.process, "data hygiene");
  assert.equal(finding.ownerRole.length > 0, true);
  assert.equal(finding.retest.length > 0, true);
});

test("every shipped check names a process, an owner, and a retest", () => {
  const ids = loadRules().map((item) => item.id).sort();
  assert.deepEqual(Object.keys(checkMeta).sort(), ids);
  for (const id of ids) {
    const meta = checkMeta[id];
    assert.equal(meta.ownerRole.length > 0, true, id);
    assert.equal(meta.retest.endsWith("."), true, id);
  }
});

test("ranking uses process impact and ignores the count written in the evidence", () => {
  const territory = fake("crm.unused-custom-properties", "territory assignment", "critical", "1 property affects territory assignment.");
  const hygiene = fake("brand.markers", "data hygiene", "low", "10 unused properties with low fill rates.");
  assert.ok(compareFindings(territory, hygiene) < 0);
  assert.equal(compareFindings(hygiene, territory) > 0, true);
  const portal = snapshot({
    properties: [
      { objectType: "contacts", name: "billing_country", label: "Billing country", custom: true, required: false, filledCount: 0, totalCount: 4 },
      ...Array.from({ length: 10 }, (_, index) => ({
        objectType: "contacts" as const,
        name: `colour_${index}`,
        label: `Colour ${index}`,
        custom: true,
        required: false,
        filledCount: 0,
        totalCount: 4,
      })),
    ],
  });
  const report = audit(portal, "2026-10-12T00:00:00.000Z");
  const country = report.findings.find((item) => item.id === "crm.unused-custom-properties");
  const duplicates = report.findings.find((item) => item.id === "crm.duplicate-contacts");
  assert.ok(country);
  assert.ok(duplicates);
  assert.equal(country.process, "territory assignment");
  assert.equal(country.severity, "critical");
  assert.match(country.evidence, /11 custom/);
  assert.ok(report.findings.indexOf(country) < report.findings.indexOf(duplicates));
  const harmlessOnly = audit(snapshot({
    properties: Array.from({ length: 10 }, (_, index) => ({
      objectType: "contacts" as const,
      name: `colour_${index}`,
      label: `Colour ${index}`,
      custom: true,
      required: false,
      filledCount: 0,
      totalCount: 4,
    })),
  }), "2026-10-12T00:00:00.000Z");
  const unused = harmlessOnly.findings.find((item) => item.id === "crm.unused-custom-properties");
  assert.ok(unused);
  assert.equal(unused.severity, "low");
  assert.match(unused.evidence, /10 custom/);
  const queued = report.plan.flatMap((bucket) => bucket.items).find((item) => item.id === "crm.unused-custom-properties");
  assert.ok(queued);
  assert.equal(queued.ownerRole, "RevOps");
  assert.match(queued.retest, /Archive/);
});

test("a billing fault outranks a lower-impact item inside the same plan bucket", () => {
  const report = audit(loadDemoPortal(), "2026-10-12T00:00:00.000Z");
  const bucket = report.plan.find((item) => item.days === 60);
  assert.ok(bucket);
  const billing = bucket.items.findIndex((item) => item.id === "pipelines.required-fields");
  const favicon = bucket.items.findIndex((item) => item.id === "brand.favicon");
  assert.equal(billing >= 0 && favicon > billing, true);
  assert.equal(bucket.items[billing].process, "billing");
  assert.equal(bucket.items[billing].severity, "critical");
});

test("a clean lifecycle sample is confirmation, with an owner and a retest in the plan", () => {
  const report = audit(snapshot({
    contacts: [{ id: "1", email: "a@example.com", lifecycleStage: "lead", leadStatus: "NEW" }],
  }), "2026-10-12T00:00:00.000Z");
  const lifecycle = report.findings.find((item) => item.id === "crm.lifecycle-lead-status");
  assert.ok(lifecycle);
  assert.equal(lifecycle.status, "needs_operator_confirmation");
  assert.equal(lifecycle.process, "lead routing");
  const markdown = reportToMarkdown(report);
  assert.match(markdown, /## Needs operator confirmation/);
  const confirmation = markdown.split("## Needs operator confirmation")[1]?.split("## Working")[0] ?? "";
  assert.match(confirmation, /### Lifecycle and lead status/);
  const working = markdown.split("## Working")[1]?.split("## 30/60/90-day plan")[0] ?? "";
  assert.equal(working.includes("### Lifecycle and lead status"), false);
  const queued = report.plan.flatMap((bucket) => bucket.items).find((item) => item.id === "crm.lifecycle-lead-status");
  assert.ok(queued);
  assert.equal(queued.ownerRole, "Sales ops");
  assert.match(queued.retest, /operatorConfirmed/);
  assert.equal(report.counts.needs_operator_confirmation, report.findings.filter((item) => item.status === "needs_operator_confirmation").length);
});

function fake(id: string, process: Finding["process"], severity: Finding["severity"], evidence: string): Finding {
  return {
    id,
    auditor: "crm",
    status: "broken",
    severity,
    process,
    title: id,
    evidence,
    recommendedFix: "Fix it.",
    ownerRole: "RevOps",
    retest: "Rerun the audit.",
  };
}
