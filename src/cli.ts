#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDemoPortal } from "./demo.ts";
import { usage } from "./help.ts";
import { loadPortal } from "./hubspot/load.ts";
import { reportToPdf } from "./pdf.ts";
import { audit, reportToJson, reportToMarkdown } from "./report.ts";
import { version } from "./version.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(usage);
    return;
  }
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    process.stdout.write(`${version}\n`);
    return;
  }
  const demo = process.argv.includes("--demo");
  const summary = process.argv.includes("--summary");
  const out = arg("--out");
  const site = arg("--site");
  const at = arg("--at");
  if (!demo && !process.env.HUBSPOT_ACCESS_TOKEN) {
    throw new Error("Set HUBSPOT_ACCESS_TOKEN or pass --demo.");
  }
  const snapshot = demo ? loadDemoPortal() : await loadPortal(process.env.HUBSPOT_ACCESS_TOKEN ?? "", site);
  if (out && !snapshot.fictional && out.split("/").includes("examples")) {
    throw new Error("Refusing to write a live report into examples/.");
  }
  const report = audit(snapshot, at);
  const markdown = reportToMarkdown(report);
  const json = reportToJson(report);
  if (out) {
    mkdirSync(out, { recursive: true });
    const stem = snapshot.fictional ? "example-report" : "report";
    writeFileSync(join(out, `${stem}.md`), markdown);
    writeFileSync(join(out, `${stem}.json`), json);
    writeFileSync(join(out, `${stem}.pdf`), await reportToPdf(report));
  }
  if (summary) {
    process.stdout.write(`${JSON.stringify({
      fictional: report.fictional,
      score: report.score,
      counts: report.counts,
      checks: report.findings.map((item) => ({ id: item.id, status: item.status, severity: item.severity })),
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(markdown);
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
