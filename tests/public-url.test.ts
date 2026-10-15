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

test("reserved and documentation IPv4 ranges are rejected", () => {
  for (const address of [
    "198.18.0.1",
    "198.19.255.254",
    "192.0.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "::ffff:198.18.0.1",
    "::ffff:192.0.2.1",
    "::ffff:203.0.113.50",
  ]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  assert.equal(isNonPublicAddress("198.20.0.1"), false);
  assert.equal(isNonPublicAddress("192.0.1.1"), false);
});

test("IPv6 embeddings of non-public IPv4 are rejected", () => {
  for (const address of [
    "64:ff9b::10.0.0.1",
    "64:ff9b::127.0.0.1",
    "64:ff9b::192.168.1.1",
    "64:ff9b::169.254.169.254",
    "64:ff9b::198.18.0.1",
    "64:ff9b::7f00:1",
    "64:ff9b::c0a8:1",
    "[64:ff9b::10.0.0.1]",
    "64:ff9b:1::",
    "64:ff9b:1::10.0.0.1",
    "64:ff9b:1::8.8.8.8",
    "64:ff9b:1:c0a8:1:100::",
    "2002:7f00:1::",
    "2002:a00:1::1",
    "2002:c0a8:1::1",
    "2002:ac10:1::",
    "2002:a9fe:a9fe::",
    "2002:c000:201::",
    "[2002:c0a8:1::1]",
    "::10.0.0.1",
    "::192.168.0.1",
    "::127.0.0.1",
    "::7f00:1",
    "::c0a8:1",
    "[::10.1.2.3]",
  ]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  assert.equal(isNonPublicAddress("64:ff9b::8.8.8.8"), false);
  assert.equal(isNonPublicAddress("64:ff9b::808:808"), false);
  assert.equal(isNonPublicAddress("2002:808:808::"), false);
  assert.equal(isNonPublicAddress("::8.8.8.8"), false);
});

test("site checks require a public https host", async () => {
  await assert.rejects(assertPublicDestination("http://example.com"), /https/);
  await assert.rejects(assertPublicDestination("https://127.0.0.1"), /public/);
  await assert.rejects(assertPublicDestination("https://[::ffff:127.0.0.1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[::1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[64:ff9b::10.0.0.1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[2002:c0a8:1::1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[::10.0.0.1]/"), /public/);
  await assert.rejects(assertPublicDestination("https://[64:ff9b:1::8.8.8.8]/"), /public/);
  await assert.rejects(
    assertPublicDestination("https://example.com", async () => ["10.0.0.8"]),
    /public/,
  );
  const allowed = await assertPublicDestination("https://example.com/page", async () => ["93.184.216.34"]);
  assert.equal(allowed.address, "93.184.216.34");
});

test("15 Oct sweep: extra non-public IPv6/IPv4 forms are rejected", () => {
  for (const address of [
    "::ffff:0:7f00:1",
    "::ffff:0:127.0.0.1",
    "2001:0:4136:e378:8000:63bf:80ff:fffe",
    "fec0::1",
    "192.88.99.1",
    "100::1",
  ]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  assert.equal(isNonPublicAddress("2606:4700:4700::1111"), false);
  assert.equal(isNonPublicAddress("2001:4860:4860::8888"), false);
});
