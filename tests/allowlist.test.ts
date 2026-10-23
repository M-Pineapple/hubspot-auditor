import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { assertReadOnly, HubSpotReadClient, ReadOnlyError } from "../src/hubspot/client.ts";
import { loadPortal } from "../src/hubspot/load.ts";
import { loadRules } from "../src/rules.ts";
import { rule, snapshot } from "./helpers.ts";

const TOKEN_INFO = "/oauth/v2/private-apps/get/access-token-info";
const NA_TOKEN = "pat-na1-fixture";
const EU_TOKEN = "pat-eu1-fixture";

const REQUIRED_PATHS = [
  TOKEN_INFO,
  "/account-info/v3/details",
  "/crm/v3/objects/contacts",
  "/crm/v3/objects/companies",
  "/crm/v3/properties/contacts",
  "/crm/v3/pipelines/deals",
  "/crm/v3/pipelines/tickets",
  "/crm/v3/objects/deals",
  "/marketing/v3/forms",
  "/automation/v4/flows",
  "/cms/v3/pages/landing-pages",
  "/cms/v3/pages/site-pages",
  "/marketing/v3/emails",
  "/contacts/v1/lists",
  "/communication-preferences/v3/definitions",
  "/cms/v3/domains",
  "/crm/v3/owners",
  "/integrations/v1/me",
  "/webhooks/v3/subscriptions",
  "/analytics/v2/reports",
];

interface Captured {
  method: string;
  url: string;
  authorization: string;
  body: string;
}

function headerValue(headers: HeadersInit | undefined, name: string): string {
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get(name) ?? "";
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return hit ? String(hit[1]) : "";
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? String(record[key]) : "";
}

function capture(seen: Captured[], scopes: string[] | null, status = 200): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    seen.push({
      method: String(init?.method ?? ""),
      url,
      authorization: headerValue(init?.headers, "authorization"),
      body: typeof init?.body === "string" ? init.body : "",
    });
    if (new URL(url).pathname === TOKEN_INFO) {
      if (status !== 200) return new Response("{}", { status });
      return Response.json({ scopes: scopes ?? [] });
    }
    return Response.json({ results: [] });
  };
}

function scopeRule() {
  const item = loadRules().find((entry) => entry.id === "integrations.token-scopes");
  assert.ok(item, "integrations.token-scopes");
  return item;
}

test("unknown HubSpot paths are refused before fetch", async () => {
  let calls = 0;
  const client = new HubSpotReadClient(NA_TOKEN, async () => {
    calls += 1;
    return Response.json({});
  });
  for (const path of [
    "/crm/v3/objects/contacts/batch/archive",
    "/crm/v3/objects/deals/search",
    "/settings/v3/users",
    "/../crm/v3/objects/contacts",
    "/crm/v3/objects/%2Fcontacts",
  ]) {
    await assert.rejects(client.get(path), ReadOnlyError, path);
  }
  assert.equal(calls, 0);
});

test("requests to other HubSpot hosts are refused", async () => {
  let calls = 0;
  const client = new HubSpotReadClient(NA_TOKEN, async () => {
    calls += 1;
    return Response.json({});
  });
  for (const url of [
    "https://api.hubspot.com/crm/v3/objects/contacts",
    "https://api-eu1.hubapi.com/crm/v3/objects/contacts",
    `https://${NA_TOKEN}@api.hubapi.com/crm/v3/objects/contacts`,
  ]) {
    await assert.rejects(client.get(url), (error: unknown) => {
      assert.ok(error instanceof ReadOnlyError);
      assert.equal(String(error.message).includes(NA_TOKEN), false);
      return true;
    });
  }
  assert.equal(calls, 0);
});

test("POST is allowed only on the token-info path", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReadOnly(method, "/crm/v3/objects/contacts"), ReadOnlyError);
  }
  assert.doesNotThrow(() => assertReadOnly("POST", TOKEN_INFO));
  assert.throws(() => assertReadOnly("GET", TOKEN_INFO), ReadOnlyError);
  assert.throws(() => assertReadOnly("PUT", TOKEN_INFO), ReadOnlyError);
});

test("loadPortal sends one token-info POST and otherwise only allowlisted GETs", async () => {
  const seen: Captured[] = [];
  const stderr: string[] = [];
  await loadPortal(NA_TOKEN, undefined, capture(seen, ["crm.objects.contacts.read"]), (chunk) => stderr.push(chunk));
  assert.equal(seen[0]?.method, "POST");
  assert.equal(new URL(seen[0].url).pathname, TOKEN_INFO);
  assert.equal(seen[0].body, JSON.stringify({ tokenKey: NA_TOKEN }));
  assert.equal(seen[0].authorization, `Bearer ${NA_TOKEN}`);
  assert.equal(seen.filter((item) => item.method === "POST").length, 1);
  assert.ok(seen.slice(1).every((item) => item.method === "GET"));
  const { ALLOWED_REQUESTS } = await import("../src/hubspot/allowlist.ts");
  for (const request of seen) {
    const { pathname } = new URL(request.url);
    const allowed = ALLOWED_REQUESTS.some((entry) => entry.method === request.method && entry.pattern.test(pathname));
    assert.equal(allowed, true, `${request.method} ${pathname}`);
  }
  for (const path of REQUIRED_PATHS) {
    assert.equal(seen.some((item) => new URL(item.url).pathname === path), true, path);
  }
  assert.equal(stderr.join("").includes(NA_TOKEN), false);
  assert.equal(stderr.join(""), "");
});

test("an EU token-info 404 still completes and reports the scope check as missing", async () => {
  const seen: Captured[] = [];
  const stderr: string[] = [];
  const portal = await loadPortal(EU_TOKEN, undefined, capture(seen, null, 404), (chunk) => stderr.push(chunk));
  assert.equal(seen.filter((item) => item.method === "POST").length, 1);
  assert.equal(portal.tokenScopes?.status, 404);
  assert.equal(portal.tokenScopes?.scopes, null);
  const finding = runCheck(scopeRule(), portal);
  assert.equal(finding.status, "missing");
  assert.match(finding.evidence, /Could not read token scopes \(HTTP 404\)/);
  assert.match(finding.evidence, /EU tokens and some accounts return this/);
  assert.match(finding.recommendedFix, /Scopes tab/);
  const blob = `${JSON.stringify(finding)}\n${JSON.stringify(portal.fetchGaps)}\n${stderr.join("")}`;
  assert.equal(blob.includes(EU_TOKEN), false);
});

test("write scopes are broken, broad scopes need confirmation, and a read-only list passes", async () => {
  const item = scopeRule();
  const absent = runCheck(item, snapshot());
  assert.equal(absent.status, "missing");
  assert.match(absent.evidence, /Token scopes were not read/);

  const cases: { scopes: string[]; status: string; stderr: RegExp | null; evidence?: RegExp }[] = [
    {
      scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
      status: "broken",
      stderr: /Warning: the HubSpot token has write scopes \(crm\.objects\.contacts\.write\)\. The auditor will not use them\. Remove them from the private app\./,
      evidence: /crm\.objects\.contacts\.write/,
    },
    {
      scopes: ["files"],
      status: "broken",
      stderr: /write scopes \(files\)/,
      evidence: /files/,
    },
    {
      scopes: ["crm.objects.deals.delete"],
      status: "broken",
      stderr: /write scopes \(crm\.objects\.deals\.delete\)/,
      evidence: /crm\.objects\.deals\.delete/,
    },
    {
      scopes: ["forms", "crm.import"],
      status: "broken",
      stderr: /write scopes \(crm\.import\)/,
      evidence: /crm\.import/,
    },
    {
      scopes: ["forms", "content", "automation"],
      status: "needs_operator_confirmation",
      stderr: null,
    },
    {
      scopes: ["crm.objects.contacts.read", "crm.schemas.contacts.read"],
      status: "working",
      stderr: null,
    },
  ];

  for (const entry of cases) {
    const stderr: string[] = [];
    const portal = await loadPortal(NA_TOKEN, undefined, capture([], entry.scopes), (chunk) => stderr.push(chunk));
    const finding = runCheck(item, portal);
    assert.equal(finding.status, entry.status, entry.scopes.join(","));
    if (entry.evidence) assert.match(finding.evidence, entry.evidence, entry.scopes.join(","));
    const text = stderr.join("");
    assert.equal(text.includes(NA_TOKEN), false, entry.scopes.join(","));
    if (entry.stderr) assert.match(text, entry.stderr, entry.scopes.join(","));
    else assert.equal(text, "", entry.scopes.join(","));
  }

  const direct = runCheck(rule("integrations.token-scopes", "integrations", item.params), snapshot({
    tokenScopes: { scopes: ["content"], status: 200 },
  }));
  assert.equal(direct.status, "needs_operator_confirmation");
});
