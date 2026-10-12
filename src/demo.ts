import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PortalSnapshot } from "./types.ts";

export function loadDemoPortal(): PortalSnapshot {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "demo", "portal.json");
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as PortalSnapshot;
  if (!snapshot.fictional) {
    throw new Error("The demo portal must be marked fictional.");
  }
  return snapshot;
}
