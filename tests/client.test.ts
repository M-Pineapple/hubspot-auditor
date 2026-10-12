import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReadOnly, ReadOnlyError } from "../src/hubspot/client.ts";

test("the HubSpot client refuses every method except GET", () => {
  assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/objects/contacts"));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReadOnly(method, "/crm/v3/objects/contacts"), ReadOnlyError);
  }
  assert.throws(() => assertReadOnly("GET", "/crm/v3/objects/contacts/search POST"), ReadOnlyError);
});
