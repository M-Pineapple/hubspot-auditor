import type { FetchGap, FormDef, PortalSnapshot, Workflow } from "../types.ts";
import { HubSpotReadClient } from "./client.ts";

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

interface RawForm {
  id: string;
  name: string;
  archived?: boolean;
  fieldGroups?: { fields?: { name?: string }[] }[];
  configuration?: { recaptchaEnabled?: boolean };
  legalConsentOptions?: unknown;
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
  };
}

export async function loadPortal(
  token: string,
  publicSiteUrl?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PortalSnapshot> {
  const client = new HubSpotReadClient(token, fetchImpl);
  const gaps: FetchGap[] = [];
  const account = await tryGet<{ portalId?: number }>(client, "/account-info/v3/details", "account", gaps);
  const contacts = await listAll<RawObject>(
    client,
    "/crm/v3/objects/contacts?properties=email,lifecyclestage,hs_lead_status,hs_analytics_source",
    "contacts",
    gaps,
  );
  const companies = await listAll<RawObject>(client, "/crm/v3/objects/companies?properties=domain", "companies", gaps);
  const properties = await tryGet<{ results?: RawProperty[] }>(client, "/crm/v3/properties/contacts", "properties", gaps);
  const dealPipelines = await tryGet<{ results?: RawPipeline[] }>(client, "/crm/v3/pipelines/deals", "pipelines", gaps);
  const ticketPipelines = await tryGet<{ results?: RawPipeline[] }>(client, "/crm/v3/pipelines/tickets", "pipelines", gaps);
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

  gaps.push({ area: "stage-automation", path: "/crm/v3/pipelines/deals", status: 0 });
  await noteUnmapped(client, "/marketing/v3/domains", "senders", gaps);
  await noteUnmapped(client, "/integrations/v1/me", "integrations", gaps);
  await noteUnmapped(client, "/webhooks/v3/subscriptions", "webhooks", gaps);
  await noteUnmapped(client, "/analytics/v2/reports", "reports", gaps);

  const contactRows = contacts ?? [];
  const contactProps = properties?.results ?? [];
  const filled = (name: string) => contactRows.filter((contact) => (contact.properties?.[name] ?? "").trim() !== "").length;

  let html: string | null = null;
  let fetchError: string | null = null;
  if (publicSiteUrl) {
    try {
      assertPublicFetch(publicSiteUrl);
      const response = await fetchImpl(publicSiteUrl, { method: "GET" });
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
      filledCount: filled(property.name),
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
    forms: forms.map((form) => mapForm(form, html)),
    tracking: {
      publicSiteUrl: publicSiteUrl ?? null,
      html,
      fetchError,
      cookieBanner: html ? /cookie|consent|onetrust|cookiebot/i.test(html) : false,
      utmFilled: 0,
      utmTotal: 0,
      originalSourceFilled: contactRows.filter((contact) => (contact.properties?.hs_analytics_source ?? "").trim() !== "")
        .length,
      contactCount: contactRows.length,
    },
    workflows,
    senderDomains: [],
    integrations: [],
    webhooks: [],
    reports: [],
    fetchGaps: gaps,
  };
}

export function assertPublicFetch(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https site URLs can be fetched.");
  }
}
