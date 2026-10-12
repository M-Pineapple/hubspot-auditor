import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

test("tracking requires the script, a banner, UTM values, and original source", () => {
  const bare = snapshot({
    tracking: {
      publicSiteUrl: "https://example.com",
      html: "<html><body>Welcome</body></html>",
      fetchError: null,
      cookieBanner: false,
      utmFilled: 1,
      utmTotal: 5,
      originalSourceFilled: 1,
      contactCount: 5,
    },
  });
  assert.equal(runCheck(rule("tracking.install-code", "tracking"), bare).status, "broken");
  assert.equal(runCheck(rule("tracking.cookie-banner", "tracking"), bare).status, "broken");
  assert.equal(runCheck(rule("tracking.utm-capture", "tracking", { minFillRatio: 0.5 }), bare).status, "missing");
  assert.equal(runCheck(rule("tracking.original-source", "tracking", { minFillRatio: 0.8 }), bare).status, "broken");
});

test("tracking accepts a page that includes the HubSpot script", () => {
  const ready = snapshot({
    tracking: {
      publicSiteUrl: "https://example.com",
      html: "<script src='https://js.hs-scripts.com/1.js'></script>",
      fetchError: null,
      cookieBanner: true,
      utmFilled: 4,
      utmTotal: 5,
      originalSourceFilled: 5,
      contactCount: 5,
    },
  });
  assert.equal(runCheck(rule("tracking.install-code", "tracking"), ready).status, "working");
  assert.equal(runCheck(rule("tracking.cookie-banner", "tracking"), ready).status, "working");
});
