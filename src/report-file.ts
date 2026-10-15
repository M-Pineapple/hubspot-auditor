import { lstatSync, mkdirSync, realpathSync } from "node:fs";
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
  let entry: ReturnType<typeof lstatSync> | undefined;
  try {
    entry = lstatSync(target);
  } catch {
    entry = undefined;
  }
  // lstat, not exists: a dangling symlink must not redirect the write outside the folder.
  if (entry?.isSymbolicLink()) throw new Error("pdfPath must not be a symlink.");
  if (entry && process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE !== "1") {
    throw new Error(`Refusing to overwrite ${name}. Set HUBSPOT_AUDITOR_PDF_OVERWRITE=1 to replace it.`);
  }
  return target;
}
