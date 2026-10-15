import assert from "node:assert/strict";
import { existsSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveReportFile } from "../src/report-file.ts";

test("pdfPath accepts only a file name inside the report directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsa-reports-"));
  process.env.HUBSPOT_AUDITOR_REPORT_DIR = dir;
  delete process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE;
  const target = resolveReportFile("audit.pdf");
  assert.equal(target, join(realpathSync(dir), "audit.pdf"));
  for (const bad of ["/tmp/audit.pdf", "../audit.pdf", "audit.txt", "a/audit.pdf"]) {
    assert.throws(() => resolveReportFile(bad), /file name/);
  }
  writeFileSync(target, "already");
  assert.throws(() => resolveReportFile("audit.pdf"), /overwrite/);
  process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE = "1";
  assert.equal(resolveReportFile("audit.pdf"), target);
  delete process.env.HUBSPOT_AUDITOR_REPORT_DIR;
  delete process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE;
});

test("a dangling symlink in the report folder is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsr-"));
  const outside = join(mkdtempSync(join(tmpdir(), "hso-")), "x.pdf");
  symlinkSync(outside, join(dir, "evil.pdf"));
  const previous = process.env.HUBSPOT_AUDITOR_REPORT_DIR;
  process.env.HUBSPOT_AUDITOR_REPORT_DIR = dir;
  try {
    assert.throws(() => resolveReportFile("evil.pdf"));
    assert.equal(existsSync(outside), false);
  } finally {
    if (previous === undefined) delete process.env.HUBSPOT_AUDITOR_REPORT_DIR;
    else process.env.HUBSPOT_AUDITOR_REPORT_DIR = previous;
  }
});
