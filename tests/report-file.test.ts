import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, renameSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
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

function withReportDir<T>(dir: string, overwrite: boolean, fn: () => T): T {
  const prevDir = process.env.HUBSPOT_AUDITOR_REPORT_DIR;
  const prevOw = process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE;
  process.env.HUBSPOT_AUDITOR_REPORT_DIR = dir;
  if (overwrite) process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE = "1";
  else delete process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE;
  try {
    return fn();
  } finally {
    if (prevDir === undefined) delete process.env.HUBSPOT_AUDITOR_REPORT_DIR;
    else process.env.HUBSPOT_AUDITOR_REPORT_DIR = prevDir;
    if (prevOw === undefined) delete process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE;
    else process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE = prevOw;
  }
}

test("a symlink planted after the check is not followed at write time", async () => {
  const mod = await import("../src/report-file.ts");
  assert.equal(typeof mod.openReportFileForWrite, "function");
  const dir = mkdtempSync(join(tmpdir(), "hsr-race-"));
  const outside = join(mkdtempSync(join(tmpdir(), "hso-race-")), "x.pdf");
  for (const overwrite of [false, true]) {
    withReportDir(dir, overwrite, () => {
      const target = mod.resolveReportFile("race.pdf");
      symlinkSync(outside, target); // attacker wins the race
      try {
        assert.throws(() => mod.openReportFileForWrite(target), /symlink|overwrite|changed/);
        assert.equal(existsSync(outside), false);
      } finally {
        unlinkSync(target);
      }
    });
  }
});

test("a hard link to a file outside the folder is refused on overwrite", async () => {
  const mod = await import("../src/report-file.ts");
  const dir = mkdtempSync(join(tmpdir(), "hsr-hl-"));
  const outside = join(mkdtempSync(join(tmpdir(), "hso-hl-")), "victim.pdf");
  writeFileSync(outside, "ORIGINAL");
  linkSync(outside, join(dir, "audit.pdf"));
  withReportDir(dir, true, () => {
    assert.throws(() => mod.writeReportFile("audit.pdf", "PWNED"), /hard link/);
  });
  assert.equal(readFileSync(outside, "utf8"), "ORIGINAL");
});

test("writeReportFile creates new files exclusively and overwrites only when allowed", async () => {
  const mod = await import("../src/report-file.ts");
  const dir = mkdtempSync(join(tmpdir(), "hsr-ok-"));
  withReportDir(dir, false, () => {
    const t = mod.writeReportFile("a.pdf", "one");
    assert.equal(readFileSync(t, "utf8"), "one");
    assert.throws(() => mod.writeReportFile("a.pdf", "two"), /overwrite/);
  });
  withReportDir(dir, true, () => {
    const t = mod.writeReportFile("a.pdf", "2");
    assert.equal(readFileSync(t, "utf8"), "2");
  });
});

test("a parent-folder swap (rename real, symlink outside in its place) is refused", async () => {
  const mod = await import("../src/report-file.ts");
  const base = mkdtempSync(join(tmpdir(), "hsr-swap-"));
  const real = join(base, "real");
  const outside = mkdtempSync(join(tmpdir(), "hso-swap-"));
  mkdirSync(real);
  withReportDir(real, false, () => {
    mod.writeReportFile("first.pdf", "ok"); // first use pins the folder
    renameSync(real, `${real}.bak`);
    symlinkSync(outside, real);
    assert.throws(() => mod.writeReportFile("second.pdf", "PWNED"), /changed|symlink/);
    assert.equal(existsSync(join(outside, "second.pdf")), false);
  });
});

test("the pinned folder must not be swapped between resolve and open", async () => {
  const mod = await import("../src/report-file.ts");
  const base = mkdtempSync(join(tmpdir(), "hsr-swap2-"));
  const real = join(base, "real");
  const outside = mkdtempSync(join(tmpdir(), "hso-swap2-"));
  mkdirSync(real);
  withReportDir(real, false, () => {
    const target = mod.resolveReportFile("late.pdf");
    renameSync(real, `${real}.bak`);
    symlinkSync(outside, real);
    assert.throws(() => mod.openReportFileForWrite(target), /changed|symlink|inside/);
    assert.equal(existsSync(join(outside, "late.pdf")), false);
  });
});
