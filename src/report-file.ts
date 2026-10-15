import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeSync,
} from "node:fs";
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

/**
 * Open a resolved report path for writing without following links, and
 * re-check the opened file itself so a link planted after resolveReportFile
 * cannot redirect the write. New files use O_EXCL; overwrites refuse anything
 * that is not a regular file with a single link.
 */
export function openReportFileForWrite(target: string): number {
  const overwrite = process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE === "1";
  const base = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW;
  const flags = overwrite ? base : base | constants.O_EXCL;
  let fd: number;
  try {
    fd = openSync(target, flags, 0o644);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ELOOP" || code === "EMLINK") throw new Error("pdfPath must not be a symlink.");
    if (code === "EEXIST") throw new Error("Refusing to overwrite the report. Set HUBSPOT_AUDITOR_PDF_OVERWRITE=1 to replace it.");
    throw error;
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error("pdfPath must be a regular file.");
    if (st.nlink > 1) throw new Error("pdfPath must not be a hard link.");
    const named = lstatSync(target);
    if (named.isSymbolicLink() || named.ino !== st.ino || named.dev !== st.dev) {
      throw new Error("pdfPath changed while it was being opened.");
    }
    return fd;
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

/** Resolve, open safely, truncate and write the report in one step. */
export function writeReportFile(name: string, data: Uint8Array | string): string {
  const target = resolveReportFile(name);
  const fd = openReportFileForWrite(target);
  try {
    ftruncateSync(fd, 0);
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    let off = 0;
    while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off);
  } finally {
    closeSync(fd);
  }
  return target;
}
