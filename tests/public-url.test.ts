import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPublicDestination, isNonPublicAddress } from "../src/hubspot/public-url.ts";

test("private and loopback addresses are rejected", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.1.1", "100.64.0.1", "::1", "fe80::1"]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  assert.equal(isNonPublicAddress("93.184.216.34"), false);
  for (const address of [
    "::ffff:127.0.0.1",
    "[::ffff:127.0.0.1]",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:169.254.169.254",
  ]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  assert.equal(isNonPublicAddress("::ffff:8.8.8.8"), false);
});

test("site checks require a public https host", async () => {
  await assert.rejects(assertPublicDestination("http://example.com"), /https/);
  await assert.rejects(assertPublicDestination("https://127.0.0.1"), /public/);
  await assert.rejects(assertPublicDestination("https://[::ffff:127.0.0.1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[::1]/"), /public/);
  await assert.rejects(
    assertPublicDestination("https://example.com", async () => ["10.0.0.8"]),
    /public/,
  );
  const allowed = await assertPublicDestination("https://example.com/page", async () => ["93.184.216.34"]);
  assert.equal(allowed.address, "93.184.216.34");
});
