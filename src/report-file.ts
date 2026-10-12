import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export function reportDirectory(): string {
  const configured = process.env.HUBSPOT_AUDITOR_REPORT_DIR;
  const dir = configured ? resolve(configured) : resolve(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  return realpathSync(dir);
}

export function resolveReportFile(name: string): string {
  if (name !== basename(name) || !/^[\w.-]+\.pdf$/.test(name)) {
    throw new Error("pdfPath must be a file name ending in .pdf, not a path.");
  }
  const dir = reportDirectory();
  const target = join(dir, name);
  if (realpathSync(dirname(target)) !== dir) {
    throw new Error("pdfPath escapes the report directory.");
  }
  if (existsSync(target) && process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE !== "1") {
    throw new Error(`Refusing to overwrite ${name}. Set HUBSPOT_AUDITOR_PDF_OVERWRITE=1 to replace it.`);
  }
  return target;
}
