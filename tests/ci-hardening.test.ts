import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wf = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI workflow sets a read-only token permission", () => {
  assert.match(wf, /^permissions:\s*\n\s+contents:\s*read/m);
});

test("CI actions are pinned to full commit SHAs", () => {
  const uses = [...wf.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]);
  assert.ok(uses.length > 0);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/);
});
