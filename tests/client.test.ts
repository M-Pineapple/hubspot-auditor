import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReadOnly, ReadOnlyError } from "../src/hubspot/client.ts";
import { isResolutionError } from "../src/hubspot/net.ts";

test("the HubSpot client refuses every method except GET", () => {
  assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/objects/contacts"));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReadOnly(method, "/crm/v3/objects/contacts"), ReadOnlyError);
  }
  assert.throws(() => assertReadOnly("GET", "/crm/v3/objects/contacts/search POST"), ReadOnlyError);
});

test("name lookup failures are recognised on the error cause", () => {
  const error = new TypeError("fetch failed");
  (error as TypeError & { cause: { code: string } }).cause = { code: "ENOTFOUND" };
  assert.equal(isResolutionError(error), true);
  assert.equal(isResolutionError(new Error("HTTP 403")), false);
});
