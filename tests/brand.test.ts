import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { rule, snapshot } from "./helpers.ts";

const page = {
  id: "p1",
  name: "Offer",
  published: true,
  metaTitle: "Offer",
  metaDescription: "A short offer",
  html: "<script src='https://js.hs-scripts.com/1.js'></script><div class='hs-form'></div><span>brand-mark</span>",
  hasCampaign: true,
};

test("brand accepts a published page that carries meta, tracking, a call to action, and markers", () => {
  const portal = snapshot({ landingPages: [page] });
  assert.equal(runCheck(rule("brand.published-pages", "brand"), portal).status, "working");
  assert.equal(runCheck(rule("brand.page-meta", "brand"), portal).status, "working");
  assert.equal(runCheck(rule("brand.page-tracking", "brand"), portal).status, "working");
  assert.equal(runCheck(rule("brand.page-cta", "brand"), portal).status, "working");
  assert.equal(runCheck(rule("brand.markers", "brand", { markers: ["brand-mark"] }), portal).status, "working");
});

test("brand stays quiet until markers are configured and flags a thin page", () => {
  const thin = snapshot({
    landingPages: [{ ...page, metaDescription: null, html: "<p>Hello</p>", hasCampaign: false }],
  });
  assert.equal(runCheck(rule("brand.markers", "brand", { markers: [] }), thin).status, "missing");
  assert.equal(runCheck(rule("brand.page-meta", "brand"), thin).status, "broken");
  assert.equal(runCheck(rule("brand.page-tracking", "brand"), thin).status, "broken");
  assert.equal(runCheck(rule("brand.markers", "brand", { markers: ["brand-mark"] }), thin).status, "broken");
});
