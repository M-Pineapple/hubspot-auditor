import { createRequire } from "node:module";
import type PDFKit from "pdfkit";
import type { AuditReport } from "./report.ts";
import type { Finding, Status } from "./types.ts";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof PDFKit;

const ink = "#0f172a";
const muted = "#475569";
const line = "#e2e8f0";
const colours: Record<Status, string> = {
  working: "#15803d",
  broken: "#b91c1c",
  missing: "#b45309",
};

export function reportToPdf(report: AuditReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      compress: false,
      info: {
        Title: `HubSpot audit: ${report.portalName}`,
        Author: "HubSpot Auditor",
        Creator: "HubSpot Auditor",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    draw(doc, report);
    doc.end();
  });
}

function draw(doc: PDFKit.PDFDocument, report: AuditReport): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  doc.rect(0, 0, doc.page.width, 92).fill(ink);
  doc.fillColor("#f8fafc").font("Helvetica-Bold").fontSize(22).text("HubSpot Auditor", left, 28, { width });
  doc.font("Helvetica").fontSize(11).fillColor("#99f6e4").text(report.portalName, left, 56, { width });
  doc.fillColor(ink);
  doc.y = 112;
  doc.font("Helvetica").fontSize(10).fillColor(muted);
  doc.text(
    report.fictional
      ? "This report uses a fictional sample portal. It is not a customer account."
      : "Read-only audit. No portal data was changed.",
    left,
    doc.y,
    { width },
  );
  doc.moveDown(0.4);
  doc.fillColor(muted).text(`Generated ${report.generatedAt}`, { width });
  doc.moveDown(1);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(28).text(String(report.score), { continued: false });
  doc.font("Helvetica").fontSize(11).fillColor(muted).text("Score. Share of checks that are working.", { width });
  doc.moveDown(0.8);
  drawBars(doc, report, left, width);
  doc.moveDown(1.2);
  for (const status of ["broken", "missing", "working"] as const) {
    const group = report.findings.filter((item) => item.status === status);
    sectionTitle(doc, status, group.length, left, width);
    if (group.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(muted).text("None.", left, doc.y, { width });
      doc.moveDown(0.8);
      continue;
    }
    for (const item of group) drawFinding(doc, item, left, width);
  }
  sectionTitle(doc, "plan", report.plan.reduce((sum, bucket) => sum + bucket.items.length, 0), left, width);
  for (const bucket of report.plan) {
    ensure(doc, 48);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(ink).text(`${bucket.days} days`, left, doc.y, { width });
    doc.moveDown(0.3);
    if (bucket.items.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(muted).text("Nothing queued.", { width });
    } else {
      for (const item of bucket.items) {
        ensure(doc, 28);
        doc.font("Helvetica").fontSize(10).fillColor(ink).text(`- ${item}`, left, doc.y, { width });
        doc.moveDown(0.25);
      }
    }
    doc.moveDown(0.5);
  }
}

function drawBars(doc: PDFKit.PDFDocument, report: AuditReport, left: number, width: number): void {
  const total = Math.max(1, report.counts.working + report.counts.broken + report.counts.missing);
  const y = doc.y;
  let x = left;
  for (const status of ["working", "broken", "missing"] as const) {
    const share = report.counts[status] / total;
    const bar = Math.max(share > 0 ? 4 : 0, width * share);
    doc.rect(x, y, bar, 14).fill(colours[status]);
    x += bar;
  }
  doc.y = y + 22;
  doc.font("Helvetica").fontSize(10);
  const labels = (["working", "broken", "missing"] as const)
    .map((status) => `${capital(status)} ${report.counts[status]}`)
    .join("    ");
  doc.fillColor(ink).text(labels, left, doc.y, { width });
}

function sectionTitle(doc: PDFKit.PDFDocument, name: string, count: number, left: number, width: number): void {
  ensure(doc, 36);
  const title = name === "plan" ? "30/60/90-day plan" : capital(name);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(ink).text(`${title}  ${count}`, left, doc.y, { width });
  const y = doc.y + 2;
  doc.moveTo(left, y).lineTo(left + width, y).strokeColor(line).stroke();
  doc.y = y + 10;
}

function drawFinding(doc: PDFKit.PDFDocument, item: Finding, left: number, width: number): void {
  ensure(doc, 78);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(ink).text(item.title, left, doc.y, { width });
  doc.font("Helvetica").fontSize(9).fillColor(colours[item.status]).text(`${item.severity}  ${item.id}`, left, doc.y, { width });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor(ink).text(item.evidence, left, doc.y, { width });
  doc.moveDown(0.15);
  doc.fillColor(muted).text(`Fix: ${item.recommendedFix}`, left, doc.y, { width });
  doc.moveDown(0.7);
}

function ensure(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function capital(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
