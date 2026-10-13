import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function run(args: string[]) {
  return spawnSync(process.execPath, ["dist/main.js", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("the compiled command runs the demo audit without --experimental-strip-types", () => {
  const result = run(["--demo", "--summary"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"fictional": true/);
  assert.match(result.stdout, /"score":/);
});

test("the compiled command prints help and version", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Read-only HubSpot portal audit/);
  const printed = run(["--version"]);
  assert.equal(printed.status, 0, printed.stderr);
  assert.match(printed.stdout, /^1\.\d+\.\d+\n$/);
});

test("compiled output does not use --experimental-strip-types", () => {
  const main = readFileSync(new URL("../dist/main.js", import.meta.url), "utf8");
  assert.equal(main.includes("--experimental-strip-types"), false);
});
