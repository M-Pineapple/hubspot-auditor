import assert from "node:assert/strict";
import { test } from "node:test";
import { checks, runCheck } from "../src/checks.ts";
import { loadDemoPortal } from "../src/demo.ts";
import { audit, reportToJson, reportToMarkdown } from "../src/report.ts";
import { loadRules } from "../src/rules.ts";
import { rule, snapshot } from "./helpers.ts";

test("every YAML check has an implementation and a demo finding", () => {
  const rules = loadRules();
  const auditors = new Set(rules.map((item) => item.auditor));
  assert.deepEqual([...auditors].sort(), ["crm", "email", "forms", "integrations", "pipelines", "reporting", "tracking"]);
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
});
