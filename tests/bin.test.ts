import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the installed command runs the demo audit", () => {
  const result = spawnSync(process.execPath, ["bin/hubspot-auditor.js", "--demo", "--summary"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"fictional": true/);
  assert.match(result.stdout, /"score":/);
});
