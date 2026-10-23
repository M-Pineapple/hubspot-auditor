import assert from "node:assert/strict";
import { test } from "node:test";
import { runCheck } from "../src/checks.ts";
import { loadDemoPortal } from "../src/demo.ts";
import { loadPortal } from "../src/hubspot/load.ts";
import { loadRules } from "../src/rules.ts";
import type { PortalSnapshot } from "../src/types.ts";
import { rule, snapshot } from "./helpers.ts";

test("reporting keeps a dashboard and flags missing attribution and funnel reports", () => {
  const portal = snapshot({
    reports: [{ id: "r1", name: "Weekly", kind: "dashboard" }],
  });
  assert.equal(runCheck(rule("reporting.dashboards", "reporting"), portal).status, "working");
  assert.equal(runCheck(rule("reporting.attribution", "reporting"), portal).status, "missing");
  assert.equal(runCheck(rule("reporting.lifecycle-funnel", "reporting"), portal).status, "missing");
});

function attributionRule() {
  return rule("reporting.deal-attribution", "reporting", {
    minClosedWon: 5,
    minSourceShare: 0.8,
    minCampaignShare: 0.5,
  });
}

function attributionPortal(deals: PortalSnapshot["deals"], partial: Partial<PortalSnapshot> = {}) {
  const stages = [
    { id: "open", label: "Open", probability: 40, isClosed: false, requiredProperties: [] },
    { id: "won", label: "Won", probability: 100, isClosed: true, requiredProperties: [] },
    { id: "lost", label: "Lost", probability: 0, isClosed: true, requiredProperties: [] },
    { id: "p100", label: "High", probability: 100, requiredProperties: [] },
    { id: "flagged", label: "Flagged open", probability: 100, isClosed: false, requiredProperties: [] },
  ];
  return snapshot({
    pipelines: [
      { objectType: "deals", id: "sales", label: "Sales", stages, automatedStageIds: [] },
      { objectType: "deals", id: "partners", label: "Partners", stages, automatedStageIds: [] },
    ],
    campaigns: [{ id: "camp-spring", name: "Spring studio", adAssetCount: 2 }],
    deals,
    ...partial,
  });
}

function closedWonDeal(index: number, extra: Partial<PortalSnapshot["deals"][number]> = {}) {
  return {
    id: `deal-secret-${index}`,
    pipelineId: "sales",
    stageId: "won",
    daysSinceUpdate: 1,
    isClosedWon: true,
    originalSource: "ORGANIC_SEARCH",
    campaignId: "campaign-secret-id",
    amount: 987654,
    contactCount: 9,
    ...extra,
  };
}

function assertNoPrivateDealData(evidence: string) {
  assert.equal(evidence.includes("deal-secret"), false);
  assert.equal(evidence.includes("987654"), false);
  assert.equal(evidence.includes("campaign-secret-id"), false);
  assert.equal(evidence.includes("@"), false);
  assert.equal(evidence.includes(" 9"), false);
}

test("hs_is_closed_won true counts a deal when the stage is still open", () => {
  const deals = Array.from({ length: 5 }, (_, index) => closedWonDeal(index, { stageId: "open" }));
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "working");
  assert.match(result.evidence, /of 5 sampled closed-won deals/);
  assert.match(result.evidence, /Ad spend needs_operator_confirmation/);
  assertNoPrivateDealData(result.evidence);
});

test("a false hs_is_closed_won value is not overridden by a won stage", () => {
  const deals = Array.from({ length: 5 }, (_, index) => closedWonDeal(index, { isClosedWon: false }));
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "missing");
  assert.match(result.evidence, /of 0 sampled closed-won deals/);
});

test("a closed stage at probability 100 is the fallback when the property is absent", () => {
  const deals = Array.from({ length: 5 }, (_, index) => {
    const deal = closedWonDeal(index);
    delete deal.isClosedWon;
    return deal;
  });
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "working");
  assert.match(result.evidence, /of 5 sampled closed-won deals/);
});

test("probability 100 counts only when closed metadata is absent", () => {
  const bare = Array.from({ length: 5 }, (_, index) => {
    const deal = closedWonDeal(index, { stageId: "p100" });
    delete deal.isClosedWon;
    return deal;
  });
  assert.equal(runCheck(attributionRule(), attributionPortal(bare)).status, "working");
  const open = Array.from({ length: 5 }, (_, index) => {
    const deal = closedWonDeal(index, { stageId: "flagged" });
    delete deal.isClosedWon;
    return deal;
  });
  const refused = runCheck(attributionRule(), attributionPortal(open));
  assert.equal(refused.status, "missing");
  assert.match(refused.evidence, /of 0 sampled closed-won deals/);
});

test("fewer than five closed-won deals is missing", () => {
  const deals = Array.from({ length: 4 }, (_, index) => closedWonDeal(index));
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "missing");
  assert.match(result.evidence, /of 4 sampled closed-won deals/);
  assert.match(result.evidence, /Ad spend needs_operator_confirmation/);
});

test("source share below 0.8 is broken and 0.8 is working", () => {
  const thin = Array.from({ length: 5 }, (_, index) => closedWonDeal(index, {
    originalSource: index < 3 ? "PAID_SEARCH" : null,
  }));
  const broken = runCheck(attributionRule(), attributionPortal(thin));
  assert.equal(broken.status, "broken");
  assert.match(broken.evidence, /of 5 sampled closed-won deals/);
  assert.match(broken.evidence, /share 0\.60/);
  const enough = Array.from({ length: 5 }, (_, index) => closedWonDeal(index, {
    originalSource: index < 4 ? "ORGANIC_SEARCH" : null,
  }));
  const working = runCheck(attributionRule(), attributionPortal(enough));
  assert.equal(working.status, "working");
  assert.match(working.evidence, /share 0\.80/);
});

test("a low campaign share alone stays working", () => {
  const deals = Array.from({ length: 5 }, (_, index) => closedWonDeal(index, {
    campaignId: index === 0 ? "campaign-secret-id" : null,
  }));
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "working");
  assert.match(result.evidence, /of 5 sampled closed-won deals/);
  assert.match(result.evidence, /Campaign share 0\.20/);
  assert.match(result.evidence, /Ad spend needs_operator_confirmation/);
  assertNoPrivateDealData(result.evidence);
});

test("a missing campaigns scope reports that part missing and still judges source share", () => {
  const deals = Array.from({ length: 5 }, (_, index) => closedWonDeal(index));
  const result = runCheck(attributionRule(), attributionPortal(deals, {
    campaigns: undefined,
    fetchGaps: [{ area: "campaigns", path: "/marketing/v3/campaigns?limit=100", status: 403 }],
  }));
  assert.equal(result.status, "working");
  assert.match(result.evidence, /of 5 sampled closed-won deals/);
  assert.match(result.evidence, /Campaign part: missing/);
  assert.match(result.recommendedFix, /marketing\.campaigns\.read/);
  assert.match(result.evidence, /Ad spend needs_operator_confirmation/);
});

test("evidence lists per-pipeline counts and leaves out deal identifiers", () => {
  const deals = [
    closedWonDeal(0, { pipelineId: "sales" }),
    closedWonDeal(1, { pipelineId: "sales" }),
    closedWonDeal(2, { pipelineId: "sales" }),
    closedWonDeal(3, { pipelineId: "partners" }),
    closedWonDeal(4, { pipelineId: "partners" }),
  ];
  const result = runCheck(attributionRule(), attributionPortal(deals));
  assert.equal(result.status, "working");
  assert.match(result.evidence, /Sales 3/);
  assert.match(result.evidence, /Partners 2/);
  assert.match(result.evidence, /of 5 sampled closed-won deals/);
  assert.match(result.evidence, /Sources: ORGANIC_SEARCH/);
  assertNoPrivateDealData(result.evidence);
});

test("the Harbour Glass demo reports closed-won attribution without deal identifiers", () => {
  const item = loadRules().find((entry) => entry.id === "reporting.deal-attribution");
  assert.ok(item);
  const finding = runCheck(item, loadDemoPortal());
  assert.equal(finding.status, "working");
  assert.match(finding.evidence, /of \d+ sampled closed-won deals/);
  assert.match(finding.evidence, /Ad spend needs_operator_confirmation/);
  assert.equal(finding.evidence.includes("d3"), false);
  assert.equal(finding.evidence.includes("@"), false);
});

function campaignGuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

test("loadPortal maps attribution fields, caps campaign asset reads at 20, and records campaign gaps", async () => {
  const seen: string[] = [];
  const spring = "11111111-1111-4111-8111-111111111111";
  const autumn = "22222222-2222-4222-8222-222222222222";
  const portal = await loadPortal("pat-na1-fixture", undefined, async (input, init) => {
    const url = new URL(String(input));
    seen.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    if (url.pathname === "/oauth/v2/private-apps/get/access-token-info") {
      return Response.json({ scopes: ["crm.objects.deals.read"] });
    }
    if (url.pathname === "/crm/v3/objects/deals") {
      return Response.json({
        results: [
          {
            id: "deal-1",
            properties: {
              pipeline: "sales",
              dealstage: "won",
              hs_lastmodifieddate: "2026-10-20T00:00:00.000Z",
              amount: "1500.50",
              closedate: "2026-10-01",
              hs_is_closed_won: "true",
              hs_analytics_source: "ORGANIC_SEARCH",
              hs_analytics_source_data_1: "Google",
              hs_campaign: spring,
            },
            associations: { contacts: { results: [{ id: "c1" }, { id: "c1" }, { id: "c2" }] } },
          },
          {
            id: "deal-2",
            properties: {
              pipeline: "sales",
              dealstage: "lost",
              hs_is_closed_won: "false",
              amount: " ",
              hs_analytics_source: "  ",
              hs_campaign: "",
            },
          },
        ],
      });
    }
    if (url.pathname === "/marketing/v3/campaigns") {
      return Response.json({
        results: [
          { id: spring, properties: { hs_name: "Spring studio" } },
          { id: autumn, name: "Autumn kiln" },
        ],
      });
    }
    if (url.pathname === `/marketing/v3/campaigns/${spring}/assets/AD_CAMPAIGN`) {
      return Response.json({ results: [{ id: "ad-1" }, { id: "ad-2" }] });
    }
    if (url.pathname === `/marketing/v3/campaigns/${autumn}/assets/AD_CAMPAIGN`) {
      return Response.json({ results: [] });
    }
    return Response.json({ results: [] });
  });
  assert.equal(seen.some((item) => item.includes("/crm/v3/properties/deals")), false);
  const dealRead = seen.find((item) => item.includes("/crm/v3/objects/deals?"));
  assert.ok(dealRead);
  assert.match(dealRead, /properties=pipeline,dealstage,hs_lastmodifieddate,amount,closedate,hs_is_closed_won,hs_analytics_source,hs_analytics_source_data_1,hs_campaign/);
  assert.match(dealRead, /associations=contacts/);
  assert.match(seen.join("\n"), /\/marketing\/v3\/campaigns\?limit=100&properties=hs_name/);
  assert.equal(portal.deals[0]?.isClosedWon, true);
  assert.equal(portal.deals[0]?.originalSource, "ORGANIC_SEARCH");
  assert.equal(portal.deals[0]?.campaignId, spring);
  assert.equal(portal.deals[0]?.contactCount, 2);
  assert.equal(portal.deals[0]?.amount, 1500.5);
  assert.equal(portal.deals[1]?.isClosedWon, false);
  assert.equal(portal.deals[1]?.originalSource, null);
  assert.equal(portal.deals[1]?.campaignId, null);
  assert.equal(portal.deals[1]?.amount, null);
  assert.equal(portal.deals[1]?.contactCount, 0);
  assert.deepEqual(portal.campaigns, [
    { id: spring, name: "Spring studio", adAssetCount: 2 },
    { id: autumn, name: "Autumn kiln", adAssetCount: 0 },
  ]);

  const capped: string[] = [];
  await loadPortal("pat-na1-fixture", undefined, async (input, init) => {
    const url = new URL(String(input));
    capped.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/oauth/v2/private-apps/get/access-token-info") return Response.json({ scopes: [] });
    if (url.pathname === "/marketing/v3/campaigns") {
      return Response.json({
        results: Array.from({ length: 21 }, (_, index) => ({ id: campaignGuid(index + 1), properties: { hs_name: `Campaign ${index + 1}` } })),
      });
    }
    if (url.pathname.endsWith("/assets/AD_CAMPAIGN")) return Response.json({ results: [{ id: "ad" }] });
    return Response.json({ results: [] });
  });
  const assetReads = capped.filter((item) => item.includes("/assets/AD_CAMPAIGN"));
  assert.equal(assetReads.length, 20);
  assert.equal(assetReads.some((item) => item.includes(campaignGuid(21))), false);

  const denied = await loadPortal("pat-na1-fixture", undefined, async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/oauth/v2/private-apps/get/access-token-info") return Response.json({ scopes: ["crm.objects.deals.read"] });
    if (url.pathname === "/crm/v3/objects/deals") {
      return Response.json({
        results: [{
          id: "deal-3",
          properties: { pipeline: "sales", dealstage: "won", hs_is_closed_won: "true", hs_analytics_source: "DIRECT_TRAFFIC" },
        }],
      });
    }
    if (url.pathname === "/marketing/v3/campaigns") return new Response("{}", { status: 403 });
    return Response.json({ results: [] });
  });
  assert.equal(denied.campaigns, undefined);
  assert.equal(denied.fetchGaps.some((gap) => gap.area === "campaigns" && gap.status === 403), true);
  assert.equal(denied.deals[0]?.originalSource, "DIRECT_TRAFFIC");

  let assetCalls = 0;
  const partial = await loadPortal("pat-na1-fixture", undefined, async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/oauth/v2/private-apps/get/access-token-info") return Response.json({ scopes: [] });
    if (url.pathname === "/marketing/v3/campaigns") {
      return Response.json({
        results: [
          { id: spring, properties: { hs_name: "Spring studio" } },
          { id: autumn, properties: { hs_name: "Autumn kiln" } },
        ],
      });
    }
    if (url.pathname.endsWith("/assets/AD_CAMPAIGN")) {
      assetCalls += 1;
      return new Response("{}", { status: 403 });
    }
    return Response.json({ results: [] });
  });
  assert.equal(partial.fetchGaps.filter((gap) => gap.area === "campaign-assets" && gap.status === 403).length, 1);
  assert.equal(assetCalls >= 1, true);
});
