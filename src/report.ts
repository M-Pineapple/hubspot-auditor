import type { BusinessProcess, Finding, PortalSnapshot, Severity, Status } from "./types.ts";
import { checkMeta, compareFindings } from "./impact.ts";
import { loadRules } from "./rules.ts";
import { runCheck } from "./checks.ts";

export interface PlanItem {
  id: string;
  title: string;
  severity: Severity;
  process: BusinessProcess;
  ownerRole: string;
  retest: string;
  action: string;
}

export interface AuditReport {
  portalName: string;
  fictional: boolean;
  generatedAt: string;
  score: number;
  counts: Record<Status, number>;
  findings: Finding[];
  plan: { days: 30 | 60 | 90; items: PlanItem[] }[];
}

export const statusLabel: Record<Status, string> = {
  working: "Working",
  broken: "Broken",
  missing: "Missing",
  needs_operator_confirmation: "Needs operator confirmation",
};

const reportOrder: Status[] = ["broken", "missing", "needs_operator_confirmation", "working"];

export function audit(snapshot: PortalSnapshot, generatedAt = new Date().toISOString()): AuditReport {
  const findings = loadRules()
    .filter((rule) => rule.enabled)
    .map((rule) => runCheck(rule, snapshot))
    .sort(compareFindings);
  const counts: Record<Status, number> = { working: 0, broken: 0, missing: 0, needs_operator_confirmation: 0 };
  for (const item of findings) counts[item.status] += 1;
  const score = findings.length === 0 ? 0 : Math.round((counts.working / findings.length) * 100);
  return {
    portalName: snapshot.portalName,
    fictional: snapshot.fictional,
    generatedAt,
    score,
    counts,
    findings,
    plan: buildPlan(findings),
  };
}

function planItem(item: Finding): PlanItem {
  const acceptsRule = item.status === "needs_operator_confirmation" && checkMeta[item.id]?.confirmPass === true;
  const retest = acceptsRule
    ? `${item.retest} Set params.operatorConfirmed to true only after you accept the rule.`
    : item.retest;
  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    process: item.process,
    ownerRole: item.ownerRole,
    retest,
    action: item.recommendedFix,
  };
}

function buildPlan(findings: Finding[]): AuditReport["plan"] {
  const broken = findings.filter((item) => item.status === "broken");
  const missing = findings.filter((item) => item.status === "missing");
  const unconfirmed = findings.filter((item) => item.status === "needs_operator_confirmation");
  const high = (item: Finding) => item.severity === "critical" || item.severity === "high";
  const low = (item: Finding) => item.severity === "medium" || item.severity === "low";
  const queue = (items: Finding[]) => [...items].sort(compareFindings).map(planItem);
  return [
    { days: 30, items: queue(broken.filter(high)) },
    {
      days: 60,
      items: queue([
        ...broken.filter((item) => item.severity === "medium"),
        ...missing.filter(high),
        ...unconfirmed.filter(high),
      ]),
    },
    {
      days: 90,
      items: queue([
        ...broken.filter((item) => item.severity === "low"),
        ...missing.filter(low),
        ...unconfirmed.filter(low),
      ]),
    },
  ];
}

export function reportToMarkdown(report: AuditReport): string {
  const lines = [
    `# HubSpot audit: ${report.portalName}`,
    "",
    report.fictional ? "This report uses a fictional sample portal. It is not a customer account." : "Read-only audit. No portal data was changed.",
    "",
    `Score: **${report.score}** (share of checks that are working). A check that needs operator confirmation is not a pass.`,
    "",
    `| Status | Count |`,
    `| --- | ---: |`,
    `| Working | ${report.counts.working} |`,
    `| Broken | ${report.counts.broken} |`,
    `| Missing | ${report.counts.missing} |`,
    `| Needs operator confirmation | ${report.counts.needs_operator_confirmation} |`,
    "",
  ];
  for (const status of reportOrder) {
    lines.push(`## ${statusLabel[status]}`, "");
    const group = report.findings.filter((item) => item.status === status);
    if (group.length === 0) {
      lines.push("None.", "");
      continue;
    }
    for (const item of group) {
      lines.push(
        `### ${item.title}`,
        "",
        `- Severity: ${item.severity}`,
        `- Process: ${item.process}`,
        `- Check: \`${item.id}\``,
        `- Evidence: ${item.evidence}`,
        `- Fix: ${item.recommendedFix}`,
      );
      if (item.status !== "working") {
        lines.push(`- Owner: ${item.ownerRole}`, `- Retest: ${item.retest}`);
      }
      lines.push("");
    }
  }
  lines.push("## 30/60/90-day plan", "");
  for (const bucket of report.plan) {
    lines.push(`### ${bucket.days} days`, "");
    if (bucket.items.length === 0) lines.push("Nothing queued.", "");
    else {
      for (const item of bucket.items) {
        lines.push(`- ${item.severity} · ${item.process} · ${item.title} (\`${item.id}\`). ${item.action}`);
        lines.push(`  - Owner: ${item.ownerRole}.`);
        lines.push(`  - Retest: ${item.retest}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function reportToJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
