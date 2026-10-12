import type { Finding, PortalSnapshot, Severity, Status } from "./types.ts";
import { loadRules } from "./rules.ts";
import { runCheck } from "./checks.ts";

export interface AuditReport {
  portalName: string;
  fictional: boolean;
  generatedAt: string;
  score: number;
  counts: Record<Status, number>;
  findings: Finding[];
  plan: { days: 30 | 60 | 90; items: string[] }[];
}

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function audit(snapshot: PortalSnapshot, generatedAt = new Date().toISOString()): AuditReport {
  const findings = loadRules()
    .filter((rule) => rule.enabled)
    .map((rule) => runCheck(rule, snapshot))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
  const counts: Record<Status, number> = { working: 0, broken: 0, missing: 0 };
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

function buildPlan(findings: Finding[]): AuditReport["plan"] {
  const broken = findings.filter((item) => item.status === "broken");
  const missing = findings.filter((item) => item.status === "missing");
  const line = (item: Finding) => `${item.severity}: ${item.title}. ${item.recommendedFix}`;
  return [
    {
      days: 30,
      items: broken.filter((item) => item.severity === "critical" || item.severity === "high").map(line),
    },
    {
      days: 60,
      items: [
        ...broken.filter((item) => item.severity === "medium").map(line),
        ...missing.filter((item) => item.severity === "critical" || item.severity === "high").map(line),
      ],
    },
    {
      days: 90,
      items: [
        ...broken.filter((item) => item.severity === "low").map(line),
        ...missing.filter((item) => item.severity === "medium" || item.severity === "low").map(line),
      ],
    },
  ];
}

export function reportToMarkdown(report: AuditReport): string {
  const lines = [
    `# HubSpot audit: ${report.portalName}`,
    "",
    report.fictional ? "This report uses a fictional sample portal. It is not a customer account." : "Read-only audit. No portal data was changed.",
    "",
    `Score: **${report.score}** (share of checks that are working).`,
    "",
    `| Status | Count |`,
    `| --- | ---: |`,
    `| Working | ${report.counts.working} |`,
    `| Broken | ${report.counts.broken} |`,
    `| Missing | ${report.counts.missing} |`,
    "",
  ];
  for (const status of ["broken", "missing", "working"] as const) {
    lines.push(`## ${status[0].toUpperCase()}${status.slice(1)}`, "");
    const group = report.findings.filter((item) => item.status === status);
    if (group.length === 0) {
      lines.push("None.", "");
      continue;
    }
    for (const item of group) {
      lines.push(`### ${item.title}`, "", `- Severity: ${item.severity}`, `- Check: \`${item.id}\``, `- Evidence: ${item.evidence}`, `- Fix: ${item.recommendedFix}`, "");
    }
  }
  lines.push("## 30/60/90-day plan", "");
  for (const bucket of report.plan) {
    lines.push(`### ${bucket.days} days`, "");
    if (bucket.items.length === 0) lines.push("Nothing queued.", "");
    else for (const item of bucket.items) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function reportToJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
