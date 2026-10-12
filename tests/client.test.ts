import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReadOnly, HubSpotReadClient, ReadOnlyError } from "../src/hubspot/client.ts";
import { classifyMailAuth, isResolutionError } from "../src/hubspot/net.ts";

test("the HubSpot client refuses every method except GET", () => {
  assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/objects/contacts"));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReadOnly(method, "/crm/v3/objects/contacts"), ReadOnlyError);
  }
  assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/objects/contacts?note=POST"));
});

test("a 429 is retried and a 403 is not", async () => {
  let limited = 0;
  let forbidden = 0;
  const client = new HubSpotReadClient("token", async (url) => {
    const path = String(url);
    if (path.endsWith("/limited")) {
      limited += 1;
      if (limited === 1) return new Response("{}", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    forbidden += 1;
    return new Response("{}", { status: 403 });
  });
  const body = await client.get<{ ok: boolean }>("/limited");
  assert.equal(body.ok, true);
  assert.equal(limited, 2);
  await assert.rejects(client.get("/forbidden"), /HTTP 403/);
  assert.equal(forbidden, 1);
});

test("name lookup failures are recognised on the error cause", () => {
  const error = new TypeError("fetch failed");
  (error as TypeError & { cause: { code: string } }).cause = { code: "ENOTFOUND" };
  assert.equal(isResolutionError(error), true);
  assert.equal(isResolutionError(new Error("HTTP 403")), false);
});

test("mail authentication reads SPF, DKIM, and DMARC records", () => {
  const auth = classifyMailAuth(
    [
      { name: "harbourglass.example", value: "v=spf1 include:example.net -all" },
      { name: "hs1._domainkey.harbourglass.example", value: "v=DKIM1; p=abc" },
    ],
    "harbourglass.example",
  );
  assert.equal(auth.spf, "pass");
  assert.equal(auth.dkim, "pass");
  assert.equal(auth.dmarc, "missing");
});
