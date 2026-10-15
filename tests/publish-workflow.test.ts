import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wf = readFileSync(
  new URL("../.github/workflows/publish.yml", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("publish workflow uses OIDC Trusted Publishing permissions", () => {
  assert.match(wf, /^permissions:\s*\n\s+id-token:\s*write\n\s+contents:\s*read/m);
});

test("publish workflow actions are pinned to full commit SHAs", () => {
  const uses = [...wf.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]);
  assert.ok(uses.length > 0);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/);
});

test("publish workflow does not use npm tokens or secrets", () => {
  assert.doesNotMatch(wf, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.|--provenance/);
});

test("publish workflow runs on v* tags with Node 24 and npm latest", () => {
  assert.match(wf, /tags:\s*\n\s+-\s+'v\*'/);
  assert.match(wf, /runs-on:\s*ubuntu-latest/);
  assert.match(wf, /node-version:\s*'24'/);
  assert.match(wf, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  assert.match(wf, /package-manager-cache:\s*false/);
  assert.match(wf, /npm install -g npm@latest/);
  assert.match(wf, /npm publish/);
  assert.match(wf, /mcp-publisher login github-oidc && mcp-publisher publish/);
});

test("package.json repository.url matches the GitHub repo npm accepts", () => {
  assert.equal(
    pkg.repository.url,
    "git+https://github.com/M-Pineapple/hubspot-auditor.git",
  );
});
