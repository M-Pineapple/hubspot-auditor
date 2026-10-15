import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, join, resolve, sep } from "node:path";

type Identity = { path: string; dev: number; ino: number };

/** Every component from "/" to the report directory, pinned at first use. */
const pinnedChains = new Map<string, Identity[]>();

function chainOf(realDir: string): Identity[] {
  const parts = realDir.split(sep).filter(Boolean);
  const chain: Identity[] = [];
  let current: string = sep;
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) current = join(current, parts[i]);
    const st = lstatSync(current);
    if (st.isSymbolicLink()) throw new Error(`Report folder path contains a symlink: ${current}`);
    if (!st.isDirectory()) throw new Error(`Report folder path is not a directory: ${current}`);
    chain.push({ path: current, dev: st.dev, ino: st.ino });
  }
  return chain;
}

function verifyChain(chain: Identity[]): void {
  for (const pinned of chain) {
    let st;
    try {
      st = lstatSync(pinned.path);
    } catch {
      throw new Error("The report folder changed since it was first used.");
    }
    if (st.isSymbolicLink() || !st.isDirectory() || st.dev !== pinned.dev || st.ino !== pinned.ino) {
      throw new Error("The report folder changed since it was first used.");
    }
  }
}

function configuredDirectory(): string {
  const configured = process.env.HUBSPOT_AUDITOR_REPORT_DIR;
  return configured ? resolve(configured) : resolve(process.cwd(), "reports");
}

/** Real path of the report directory; its whole path is pinned (dev/ino) at first use. */
export function reportDirectory(): string {
  const key = configuredDirectory();
  const pinned = pinnedChains.get(key);
  if (pinned) {
    verifyChain(pinned);
    return pinned[pinned.length - 1].path;
  }
  mkdirSync(key, { recursive: true });
  const real = realpathSync(key);
  pinnedChains.set(key, chainOf(real));
  return real;
}

export function resolveReportFile(name: string): string {
  if (name !== basename(name) || !/^[\w.-]+\.pdf$/.test(name)) {
    throw new Error("pdfPath must be a file name ending in .pdf, not a path.");
  }
  const dir = reportDirectory();
  const target = join(dir, name);
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
 * Open a resolved report path for writing. The folder's whole path is checked
 * against the identities pinned at first use (no symlinks, same dev/ino), the
 * file is created with O_CREAT|O_EXCL|O_NOFOLLOW, and after opening the folder
 * and the opened file are re-checked so a swapped parent folder or a planted
 * link cannot redirect the write. When overwriting, an existing regular file
 * with a single link is removed first and recreated exclusively.
 */
export function openReportFileForWrite(target: string): number {
  const key = configuredDirectory();
  if (!pinnedChains.has(key)) reportDirectory();
  const chain = pinnedChains.get(key)!;
  const dir = chain[chain.length - 1];
  if (join(dir.path, basename(target)) !== target) {
    throw new Error("pdfPath is not inside the report folder.");
  }
  verifyChain(chain);

  if (process.env.HUBSPOT_AUDITOR_PDF_OVERWRITE === "1") {
    let existing;
    try {
      existing = lstatSync(target);
    } catch {
      existing = undefined;
    }
    if (existing) {
      if (existing.isSymbolicLink()) throw new Error("pdfPath must not be a symlink.");
      if (!existing.isFile()) throw new Error("pdfPath must be a regular file.");
      if (existing.nlink > 1) throw new Error("pdfPath must not be a hard link.");
      verifyChain(chain);
      unlinkSync(target);
    }
  }

  let fd: number;
  try {
    fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ELOOP" || code === "EMLINK") throw new Error("pdfPath must not be a symlink.");
    if (code === "EEXIST") {
      throw new Error("Refusing to overwrite the report. Set HUBSPOT_AUDITOR_PDF_OVERWRITE=1 to replace it.");
    }
    throw error;
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error("pdfPath must be a regular file.");
    if (st.nlink > 1) throw new Error("pdfPath must not be a hard link.");
    verifyChain(chain);
    if (st.dev !== dir.dev) throw new Error("pdfPath is not inside the report folder.");
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

/** Resolve, open safely and write the report in one step. */
export function writeReportFile(name: string, data: Uint8Array | string): string {
  const target = resolveReportFile(name);
  const fd = openReportFileForWrite(target);
  try {
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    let off = 0;
    while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off);
  } finally {
    closeSync(fd);
  }
  return target;
}
