import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { loadPortal } from "../src/hubspot/load.ts";
import { audit, reportToMarkdown } from "../src/report.ts";
import { rule } from "./helpers.ts";

async function portalWithPages(area: string, failure?: number) {
  const calls: string[] = [];
  const portal = await loadPortal("fixture-token", undefined, async (input, init) => {
    const url = new URL(String(input));
    const tokenInfo = url.pathname === "/oauth/v2/private-apps/get/access-token-info";
    assert.ok(init?.method === "GET" || (init?.method === "POST" && tokenInfo));
    if (tokenInfo) return Response.json({ scopes: ["crm.objects.contacts.read"] });
    calls.push(url.pathname + url.search);
    if (url.pathname.startsWith("/crm/v3/objects/")) {
      const object = url.pathname.split("/").at(-1);
      if (url.searchParams.has("after") && object === area && failure !== undefined) {
        if (failure === 0) throw new TypeError("fixture connection failure");
        return new Response("{}", { status: failure, headers: { "retry-after": "0" } });
      }
      const second = url.searchParams.has("after");
      const properties = object === "contacts"
        ? {
          email: second ? "second@example.com" : "first@example.com", firstname: "Fixture",
          lifecyclestage: second ? "customer" : "lead", hs_lead_status: "NEW",
          hs_analytics_source: "DIRECT_TRAFFIC", utm_source: "fixture",
          hs_predictivecontactscore: "10",
        }
        : object === "companies"
          ? { domain: second ? "second.example" : "first.example" }
          : { pipeline: "sales", dealstage: "new", hs_lastmodifieddate: new Date().toISOString() };
      return Response.json({
        results: [{ id: second ? "2" : "1", properties }],
        ...(!second && object === area ? { paging: { next: { after: "next page" } } } : {}),
      });
    }
    if (url.pathname === "/crm/v3/properties/contacts") {
      return Response.json({ results: ["email", "firstname", "utm_source", "hs_predictivecontactscore"].map((name) => ({
        name, label: name, hubspotDefined: name !== "utm_source",
      })) });
    }
    return Response.json({ results: [] });
  });
  return { portal, calls };
}

const contactChecks = [
  "crm.duplicate-contacts", "crm.missing-required-properties", "crm.unused-custom-properties",
  "crm.lifecycle-lead-status", "tracking.utm-capture", "tracking.original-source",
  "program.lead-score", "reporting.lifecycle-funnel",
];

test("failed later contact pages cannot pass dependent checks or hide the read failure", async () => {
  for (const status of [429, 503, 0]) {
    const { portal, calls } = await portalWithPages("contacts", status);
    assert.equal(portal.contacts.length, 1);
    assert.ok(portal.fetchGaps.some((gap) => gap.area === "contacts-partial" && gap.status === status));
    assert.equal(calls.filter((url) => url.includes("/contacts?") && url.includes("after=")).length, status === 0 ? 1 : 4);
    for (const id of contactChecks) {
      const result = runCheck(rule(id, id.split(".")[0], { operatorConfirmed: true, names: id === "program.lead-score" ? ["hs_predictivecontactscore"] : ["email", "firstname"] }), portal);
      assert.equal(result.status, "missing", id);
      assert.match(result.evidence, /incomplete sample/i, id);
      assert.match(result.evidence, /after=next%20page/, id);
      assert.match(result.evidence, status === 0 ? /No HTTP response/ : new RegExp(`HTTP ${status}`), id);
      assert.doesNotMatch(result.recommendedFix, /Grant/, id);
    }
    assert.equal(runCheck(rule("crm.duplicate-companies", "crm"), portal).status, "working");
    const report = audit(portal);
    assert.equal(report.findings.find((item) => item.id === "crm.duplicate-contacts")?.status, "missing");
    assert.match(reportToMarkdown(report), /incomplete sample/i);
  }
});

test("company and deal pagination failures affect their own checks", async () => {
  for (const [area, id] of [["companies", "crm.duplicate-companies"], ["deals", "pipelines.stale-deals"]]) {
    const { portal } = await portalWithPages(area, 403);
    const result = runCheck(rule(id, id.split(".")[0], { operatorConfirmed: true }), portal);
    assert.equal(result.status, "missing");
    assert.match(result.evidence, /incomplete sample/i);
    assert.match(result.evidence, /HTTP 403/);
    assert.match(result.recommendedFix, /scope/);
    assert.equal(runCheck(rule("crm.duplicate-contacts", "crm"), portal).status, "working");
  }
});

test("successful pagination still passes and independent funnel reports remain usable", async () => {
  const { portal } = await portalWithPages("contacts");
  assert.equal(portal.contacts.length, 2);
  assert.equal(portal.fetchGaps.some((gap) => gap.area.endsWith("-partial")), false);
  assert.equal(runCheck(rule("crm.duplicate-contacts", "crm"), portal).status, "working");

  const { portal: partial } = await portalWithPages("contacts", 403);
  partial.reports.push({ id: "funnel", name: "Funnel", kind: "lifecycle-funnel" });
  assert.equal(runCheck(rule("reporting.lifecycle-funnel", "reporting"), partial).status, "working");
});
