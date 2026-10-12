import type { FetchGap, FormDef, LandingPage, MarketingEmail, PortalSnapshot, Workflow } from "../types.ts";
import { loadRules } from "../rules.ts";
import { HubSpotReadClient } from "./client.ts";
import { classifyMailAuth, lookupTxt, resilientFetch } from "./net.ts";

interface Page<T> {
  results?: T[];
  paging?: { next?: { after?: string } };
}

interface RawObject {
  id: string;
  properties?: Record<string, string | null>;
}

interface RawProperty {
  name: string;
  label: string;
  hubspotDefined?: boolean;
}

interface RawStage {
  id: string;
  label: string;
  metadata?: { probability?: string };
  requiredProperties?: string[];
}

interface RawPipeline {
  id: string;
  label: string;
  stages?: RawStage[];
}

interface RawLandingPage {
  id: string;
  name?: string;
  state?: string;
  htmlTitle?: string;
  metaDescription?: string;
  url?: string;
  campaign?: string;
  campaignName?: string;
}

interface RawEmail {
  id: string;
  name?: string;
  subject?: string;
  subjectLine?: string;
  state?: string;
  currentState?: string;
  isPublished?: boolean;
  campaign?: string;
  campaignName?: string;
  primaryEmailCampaignId?: string | null;
  allEmailCampaignIds?: string[];
  subscriptionDetails?: { subscriptionId?: string | null };
}

interface RawList {
  listId?: string;
  id?: string;
  name?: string;
  processingType?: string;
  dynamic?: boolean;
}

interface RawForm {
  id: string;
  name: string;
  archived?: boolean;
  fieldGroups?: { fields?: { name?: string }[] }[];
  configuration?: {
    recaptchaEnabled?: boolean;
    postSubmitAction?: { type?: string } | string;
  };
  legalConsentOptions?: unknown;
}

interface RawDomain {
  domain?: string;
  isPrimarySitePage?: boolean;
  isPrimaryLandingPage?: boolean;
  isPrimaryEmail?: boolean;
  isUsedForEmail?: boolean;
}

function sampledContactProperties(): string[] {
  const names = new Set([
    "email",
    "firstname",
    "lifecyclestage",
    "hs_lead_status",
    "hs_analytics_source",
    "hs_predictivecontactscore",
    "hubspotscore",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ]);
  for (const rule of loadRules()) {
    if (rule.id !== "crm.missing-required-properties" && rule.id !== "program.lead-score") continue;
    const extra = rule.params.names;
    if (Array.isArray(extra)) for (const name of extra) names.add(String(name));
  }
  return [...names];
}

function emailPublished(raw: { isPublished?: boolean; state?: string; currentState?: string }): boolean {
  if (typeof raw.isPublished === "boolean") return raw.isPublished;
  const state = String(raw.state ?? raw.currentState ?? "");
  if (/DRAFT|ARCHIVED/i.test(state)) return false;
  return /PUBLISH|AUTOMATED|SCHEDULED/i.test(state);
}

function daysSince(value: string | null | undefined): number {
  if (!value) return 0;
  const then = Date.parse(value);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

async function noteUnmapped(
  client: HubSpotReadClient,
  path: string,
  area: string,
  gaps: FetchGap[],
): Promise<void> {
  try {
    await client.get(path);
    gaps.push({ area, path, status: 200 });
  } catch (error) {
    gaps.push({ area, path, status: (error as { status?: number }).status ?? 0 });
  }
}

async function tryGet<T>(
  client: HubSpotReadClient,
  path: string,
  area: string,
  gaps: FetchGap[],
): Promise<T | null> {
  try {
    return await client.get<T>(path);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 0;
    gaps.push({ area, path, status });
    return null;
  }
}

async function listAll<T>(
  client: HubSpotReadClient,
  path: string,
  area: string,
  gaps: FetchGap[],
  limit = 500,
): Promise<T[] | null> {
  const rows: T[] = [];
  let after: string | undefined;
  let page = 0;
  while (rows.length < limit && page < 10) {
    const joiner = path.includes("?") ? "&" : "?";
    const url = `${path}${joiner}limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const body = page === 0
      ? await tryGet<Page<T>>(client, url, area, gaps)
      : await client.get<Page<T>>(url).catch(() => null);
    if (!body) return rows.length > 0 ? rows : null;
    rows.push(...(body.results ?? []));
    after = body.paging?.next?.after;
    if (!after) break;
    page += 1;
  }
  return rows;
}

function mapForm(form: RawForm, html: string | null): FormDef {
  const fields = (form.fieldGroups ?? []).flatMap((group) => group.fields ?? []);
  const unmapped = fields.filter((field) => !field.name).length;
  return {
    id: form.id,
    name: form.name,
    archived: Boolean(form.archived),
    embedded: html ? html.includes(form.id) : null,
    unmappedFields: fields.length === 0 ? null : unmapped,
    gdprConsent: form.legalConsentOptions == null ? false : true,
    followUpEmail: null,
    spamProtection: form.configuration?.recaptchaEnabled ?? null,
    followUpEmail: followUpFrom(form),
  };
}

function followUpFrom(form: RawForm): boolean | null {
  if (!form.configuration) return null;
  const action = form.configuration.postSubmitAction;
  const type = typeof action === "string" ? action : action?.type ?? "";
  return /email|follow/i.test(type);
}

export async function loadPortal(
  token: string,
  publicSiteUrl?: string,
  fetchImpl: typeof fetch = resilientFetch,
): Promise<PortalSnapshot> {
  const client = new HubSpotReadClient(token, fetchImpl);
  const gaps: FetchGap[] = [];
  const account = await tryGet<{ portalId?: number }>(client, "/account-info/v3/details", "account", gaps);
  const contactProperties = sampledContactProperties();
  const contacts = await listAll<RawObject>(
    client,
    `/crm/v3/objects/contacts?properties=${contactProperties.join(",")}`,
    "contacts",
    gaps,
  );
  const companies = await listAll<RawObject>(client, "/crm/v3/objects/companies?properties=domain", "companies", gaps);
  const properties = await tryGet<{ results?: RawProperty[] }>(client, "/crm/v3/properties/contacts", "properties", gaps);
  const dealPipelines = await tryGet<{ results?: RawPipeline[] }>(client, "/crm/v3/pipelines/deals", "pipelines-deals", gaps);
  const ticketPipelines = await tryGet<{ results?: RawPipeline[] }>(client, "/crm/v3/pipelines/tickets", "pipelines-tickets", gaps);
  const deals = await listAll<RawObject>(
    client,
    "/crm/v3/objects/deals?properties=pipeline,dealstage,hs_lastmodifieddate",
    "deals",
    gaps,
  );
  const formList = await tryGet<{ results?: RawForm[] }>(client, "/marketing/v3/forms", "forms", gaps);
  const forms: RawForm[] = [];
  for (const form of (formList?.results ?? []).slice(0, 30)) {
    const detail = await client.get<RawForm>(`/marketing/v3/forms/${form.id}`).catch(() => null);
    forms.push(detail ?? form);
  }
  const flows = await tryGet<{ results?: { id: string; name: string; isEnabled?: boolean; flowType?: string }[] }>(
    client,
    "/automation/v4/flows?limit=100",
    "workflows",
    gaps,
  );

  const landingResult = await tryGet<{ results?: RawLandingPage[] }>(client, "/cms/v3/pages/landing-pages", "landing-pages", gaps);
  const sitePages = await client.get<{ results?: RawLandingPage[] }>("/cms/v3/pages/site-pages").catch(() => null);
  if (landingResult && sitePages?.results?.length) {
    landingResult.results = [...(landingResult.results ?? []), ...sitePages.results];
  }
  const pageList = landingResult ?? (sitePages?.results?.length ? { results: sitePages.results } : null);
  if (!landingResult && pageList) {
    const index = gaps.findIndex((gap) => gap.area === "landing-pages");
    if (index >= 0) gaps.splice(index, 1);
  }
  const emailList = await tryGet<{ results?: RawEmail[] }>(client, "/marketing/v3/emails?limit=100", "emails", gaps);
  const legacyLists = await tryGet<{ lists?: RawList[] }>(client, "/contacts/v1/lists?count=100", "lists", gaps);
  const subscriptionPage = await tryGet<{ subscriptionDefinitions?: { id: string; name: string }[]; results?: { id: string; name: string }[] }>(
    client,
    "/communication-preferences/v3/definitions",
    "subscriptions",
    gaps,
  );
  const domainPage = await tryGet<{ results?: RawDomain[] }>(client, "/cms/v3/domains", "senders", gaps);
  const ownerPage = await tryGet<{ results?: { id: string }[] }>(client, "/crm/v3/owners?limit=100", "owners", gaps);
  await noteUnmapped(client, "/integrations/v1/me", "integrations", gaps);
  await noteUnmapped(client, "/webhooks/v3/subscriptions", "webhooks", gaps);
  await noteUnmapped(client, "/analytics/v2/reports", "reports", gaps);
  let siteUrl = publicSiteUrl;
  const primary = (domainPage?.results ?? []).find((item) => item.isPrimarySitePage || item.isPrimaryLandingPage);
  if (!siteUrl && primary?.domain) siteUrl = `https://${primary.domain}`;
  const senderDomains = [];
  for (const item of domainPage?.results ?? []) {
    if (!item.domain || (!item.isUsedForEmail && !item.isPrimaryEmail)) continue;
    const names = [item.domain, `_dmarc.${item.domain}`, `hs1._domainkey.${item.domain}`, `hs2._domainkey.${item.domain}`];
    const records = [];
    for (const name of names) {
      const values = await lookupTxt(name).catch(() => []);
      for (const value of values) records.push({ name, value });
    }
    const auth = classifyMailAuth(records, item.domain);
    senderDomains.push({ domain: item.domain, ...auth });
  }

  const contactRows = contacts ?? [];
  const contactProps = properties?.results ?? [];
  const sampled = new Set(contactProperties);
  const filled = (name: string) => contactRows.filter((contact) => (contact.properties?.[name] ?? "").trim() !== "").length;
  const utmNames = ["utm_source", "utm_medium", "utm_campaign"].filter((name) => contactProps.some((property) => property.name === name));
  const landingPages: LandingPage[] = [];
  for (const page of (pageList?.results ?? []).slice(0, 20)) {
    let html: string | null = null;
    if (page.url) {
      try {
        assertPublicFetch(page.url);
        const response = await fetchImpl(page.url, { method: "GET" });
        html = response.ok ? await response.text() : null;
      } catch {
        html = null;
      }
    }
    landingPages.push({
      id: page.id,
      name: page.name ?? page.id,
      published: String(page.state ?? "").toUpperCase().includes("PUBLISH"),
      metaTitle: page.htmlTitle ?? null,
      metaDescription: page.metaDescription ?? null,
      html,
      hasCampaign: null,
    });
  }
  const emails: MarketingEmail[] = (emailList?.results ?? []).map((email) => ({
    id: email.id,
    name: email.name ?? email.id,
    subject: email.subject ?? email.subjectLine ?? null,
    published: emailPublished(email),
    hasCampaign: Boolean(email.primaryEmailCampaignId || email.campaign || email.campaignName || email.allEmailCampaignIds?.length),
    hasSubscription: Boolean(email.subscriptionDetails?.subscriptionId),
  }));
  const listRows = legacyLists?.lists ?? [];

  let html: string | null = null;
  let fetchError: string | null = null;
  if (siteUrl) {
    try {
      assertPublicFetch(siteUrl);
      const response = await fetchImpl(siteUrl, { method: "GET" });
      html = await response.text();
    } catch (error) {
      fetchError = `Could not fetch the public site: ${(error as Error).message}`;
    }
  }

  const mapPipeline = (pipeline: RawPipeline, objectType: "deals" | "tickets") => ({
    objectType,
    id: pipeline.id,
    label: pipeline.label,
    stages: (pipeline.stages ?? []).map((stage) => ({
      id: stage.id,
      label: stage.label,
      probability: stage.metadata?.probability ? Number(stage.metadata.probability) * 100 : null,
      requiredProperties: stage.requiredProperties ?? [],
    })),
    automatedStageIds: [] as string[],
    automationKnown: false,
    requirementsKnown: false,
  });

  const workflows: Workflow[] = (flows?.results ?? []).map((flow) => ({
    id: flow.id,
    name: flow.name,
    enabled: Boolean(flow.isEnabled),
    errored: null,
    enrolmentCount: null,
    kind: "workflow" as const,
  }));

  return {
    portalName: account?.portalId ? `Portal ${account.portalId}` : "HubSpot portal",
    fictional: false,
    contacts: contactRows.map((contact) => ({
      id: contact.id,
      email: contact.properties?.email ?? null,
      lifecycleStage: contact.properties?.lifecyclestage ?? null,
      leadStatus: contact.properties?.hs_lead_status ?? null,
    })),
    companies: (companies ?? []).map((company) => ({
      id: company.id,
      domain: company.properties?.domain ?? null,
    })),
    properties: contactProps.map((property) => ({
      objectType: "contacts" as const,
      name: property.name,
      label: property.label,
      custom: property.hubspotDefined === false,
      required: property.name === "email",
      filledCount: sampled.has(property.name) ? filled(property.name) : null,
      totalCount: contactRows.length,
    })),
    pipelines: [
      ...(dealPipelines?.results ?? []).map((pipeline) => mapPipeline(pipeline, "deals")),
      ...(ticketPipelines?.results ?? []).map((pipeline) => mapPipeline(pipeline, "tickets")),
    ],
    deals: (deals ?? []).map((deal) => ({
      id: deal.id,
      pipelineId: deal.properties?.pipeline ?? "",
      stageId: deal.properties?.dealstage ?? "",
      daysSinceUpdate: daysSince(deal.properties?.hs_lastmodifieddate),
    })),
    forms: forms.map((form) => mapForm(form, [html, ...landingPages.map((page) => page.html)].filter(Boolean).join("\n") || null)),
    tracking: {
      publicSiteUrl: siteUrl ?? null,
      html,
      fetchError,
      cookieBanner: html ? /cookie|consent|onetrust|cookiebot/i.test(html) : false,
      utmFilled: utmNames.reduce((sum, name) => sum + filled(name), 0),
      utmTotal: utmNames.length === 0 ? 0 : utmNames.length * contactRows.length,
      originalSourceFilled: contactRows.filter((contact) => (contact.properties?.hs_analytics_source ?? "").trim() !== "")
        .length,
      contactCount: contactRows.length,
    },
    workflows,
    senderDomains,
    integrations: [],
    webhooks: [],
    reports: [],
    landingPages,
    emails,
    lists: listRows.map((list) => ({
      id: String(list.listId ?? list.id ?? ""),
      name: list.name ?? "",
      dynamic: list.dynamic === true || String(list.processingType ?? "").toUpperCase() === "DYNAMIC",
    })),
    subscriptionTypes: (subscriptionPage?.subscriptionDefinitions ?? subscriptionPage?.results ?? []).map((item) => ({
      id: String(item.id),
      name: item.name,
    })),
    owners: (ownerPage?.results ?? []).map((owner) => ({ id: String(owner.id) })),
    fetchGaps: gaps,
  };
}

export function assertPublicFetch(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https site URLs can be fetched.");
  }
}
