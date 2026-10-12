import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import type { CheckRule, Severity } from "./types.ts";

const severities = new Set<Severity>(["critical", "high", "medium", "low"]);

export function rulesDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "rules");
}

export function loadRules(dir = rulesDirectory()): CheckRule[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const rules: CheckRule[] = [];
  for (const file of files) {
    const raw = load(readFileSync(join(dir, file), "utf8")) as {
      auditor?: string;
      checks?: Record<string, unknown>[];
    };
    const auditor = String(raw.auditor ?? "");
    for (const check of raw.checks ?? []) {
      const severity = String(check.severity ?? "medium") as Severity;
      if (!severities.has(severity)) {
        throw new Error(`Unknown severity in ${file}: ${severity}`);
      }
      rules.push({
        id: String(check.id),
        auditor,
        title: String(check.title),
        severity,
        enabled: check.enabled !== false,
        params: (check.params as Record<string, unknown>) ?? {},
      });
    }
  }
  return rules;
}
