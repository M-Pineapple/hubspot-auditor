import type { CheckRule, PortalSnapshot } from "../src/types.ts";

export function rule(id: string, auditor: string, params: Record<string, unknown> = {}): CheckRule {
  return { id, auditor, title: id, severity: "high", enabled: true, params };
}

export function snapshot(partial: Partial<PortalSnapshot> = {}): PortalSnapshot {
  return {
    portalName: "Fixture",
    fictional: true,
    contacts: [],
    companies: [],
    properties: [],
    pipelines: [],
    deals: [],
    forms: [],
    tracking: {
      publicSiteUrl: null,
      html: null,
      fetchError: null,
      cookieBanner: false,
      utmFilled: 0,
      utmTotal: 0,
      originalSourceFilled: 0,
      contactCount: 0,
    },
    workflows: [],
    senderDomains: [],
    integrations: [],
    webhooks: [],
    reports: [],
    landingPages: [],
    emails: [],
    lists: [],
    subscriptionTypes: [],
    owners: [],
    fetchGaps: [],
    ...partial,
  };
}
