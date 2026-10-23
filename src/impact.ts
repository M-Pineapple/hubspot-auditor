import type { BusinessProcess, Finding, Severity } from "./types.ts";

export const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const processRank: Record<BusinessProcess, number> = {
  "territory assignment": 0,
  billing: 1,
  "lead routing": 2,
  consent: 3,
  deliverability: 4,
  conversion: 5,
  reporting: 6,
  "data hygiene": 7,
};

export const CONFIRM_NOTE = " A read-only token cannot confirm the business rule behind this pass.";

export interface CheckMeta {
  process: BusinessProcess;
  ownerRole: string;
  retest: string;
  confirmPass?: boolean;
}

const territoryNames = new Set([
  "country",
  "hs_country_region_code",
  "ip_country_code",
  "state",
  "hs_state_code",
  "zip",
  "postalcode",
  "postal_code",
  "billing_country",
  "shipping_country",
  "territory",
]);

export function propertyImpact(name: string): { process: BusinessProcess; severity: Severity } | null {
  const normalised = name.trim().toLowerCase();
  if (territoryNames.has(normalised) || normalised.endsWith("_country") || normalised.endsWith("_territory") || normalised.endsWith("_state")) {
    return { process: "territory assignment", severity: "critical" };
  }
  if (
    normalised === "amount" ||
    normalised === "hs_arr" ||
    normalised === "hs_mrr" ||
    normalised === "hs_acv" ||
    normalised === "deal_currency_code" ||
    normalised.includes("billing") ||
    normalised.includes("invoice")
  ) {
    return { process: "billing", severity: "critical" };
  }
  if (normalised === "hubspot_owner_id" || normalised === "lifecyclestage" || normalised === "hs_lead_status") {
    return { process: "lead routing", severity: "high" };
  }
  return null;
}

export function namesByImpact(names: string[]): string[] {
  return [...names].sort((left, right) => {
    const leftHit = propertyImpact(left);
    const rightHit = propertyImpact(right);
    const leftRank = leftHit ? processRank[leftHit.process] : 99;
    const rightRank = rightHit ? processRank[rightHit.process] : 99;
    return leftRank - rightRank || left.localeCompare(right);
  });
}

/** Raise process and severity to the worst named property. A longer list does not raise either. */
export function applyPropertyImpact(item: Finding, names: string[]): Finding {
  let process = item.process;
  let severity = item.severity;
  for (const name of names) {
    const hit = propertyImpact(name);
    if (!hit) continue;
    if (processRank[hit.process] < processRank[process]) process = hit.process;
    if (severityRank[hit.severity] < severityRank[severity]) severity = hit.severity;
  }
  if (process === item.process && severity === item.severity) return item;
  return { ...item, process, severity };
}

export function compareFindings(left: Finding, right: Finding): number {
  return processRank[left.process] - processRank[right.process]
    || severityRank[left.severity] - severityRank[right.severity]
    || left.id.localeCompare(right.id);
}

export const checkMeta: Record<string, CheckMeta> = {
  "crm.duplicate-contacts": {
    process: "data hygiene",
    ownerRole: "RevOps",
    retest: "Import ten rows that repeat one email and confirm HubSpot does not create a second contact.",
  },
  "crm.duplicate-companies": {
    process: "data hygiene",
    ownerRole: "RevOps",
    retest: "Import two companies that share a domain and confirm they are blocked or merged.",
  },
  "crm.missing-required-properties": {
    process: "lead routing",
    ownerRole: "RevOps",
    confirmPass: true,
    retest: "Agree which fields are required, backfill any field still under the ratio, and rerun the audit.",
  },
  "crm.unused-custom-properties": {
    process: "data hygiene",
    ownerRole: "RevOps",
    retest: "Archive each named property or place it on a form, then rerun and confirm the fill count is no longer zero.",
  },
  "crm.lifecycle-lead-status": {
    process: "lead routing",
    ownerRole: "Sales ops",
    confirmPass: true,
    retest: "Agree the allowed lifecycle and lead-status pairs, clear any conflicting row, and rerun the audit.",
  },
  "pipelines.stage-probabilities": {
    process: "reporting",
    ownerRole: "Sales ops",
    confirmPass: true,
    retest: "Agree the probability floor, set it on each open stage, and rerun the audit.",
  },
  "pipelines.stale-deals": {
    process: "lead routing",
    ownerRole: "Sales ops",
    confirmPass: true,
    retest: "Agree the stale-day threshold, let the task workflow fire on one quiet deal, and rerun the audit.",
  },
  "pipelines.required-fields": {
    process: "reporting",
    ownerRole: "Sales ops",
    confirmPass: true,
    retest: "Move a test deal into the stage with the field blank and confirm HubSpot blocks the move.",
  },
  "pipelines.stage-automation": {
    process: "lead routing",
    ownerRole: "RevOps",
    confirmPass: true,
    retest: "Move one test deal into the handoff stage and confirm the workflow enrols that deal.",
  },
  "pipelines.ticket-pipeline": {
    process: "reporting",
    ownerRole: "Support lead",
    retest: "Open a test ticket, move it to closed, and confirm the pipeline still has a resolution field.",
  },
  "forms.live-forms": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Load the primary page and confirm the live form is the one that should accept submissions.",
  },
  "forms.unused-forms": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Archive each unembedded form or place it on a page, then rerun the audit.",
  },
  "forms.field-mapping": {
    process: "lead routing",
    ownerRole: "Marketing ops",
    retest: "Submit the form once and confirm each answer lands on the intended contact property.",
  },
  "forms.gdpr-consent": {
    process: "consent",
    ownerRole: "Marketing ops",
    retest: "Submit the form and confirm the contact stores the consent checkbox and the lawful basis.",
  },
  "forms.follow-up-email": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Submit the embedded form from an inbox you control and confirm the follow-up arrives.",
  },
  "forms.spam-protection": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Submit the form once as a person and confirm a bot-style submission is blocked or dropped.",
  },
  "tracking.install-code": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Load the public page and confirm the HubSpot tracking script request returns.",
  },
  "tracking.cookie-banner": {
    process: "consent",
    ownerRole: "Marketing ops",
    retest: "Load the page in a fresh browser and confirm non-essential cookies wait for the banner.",
  },
  "tracking.utm-capture": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Open the form with utm_source set and confirm the hidden field stores that value.",
  },
  "tracking.original-source": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Import one new contact and confirm the import does not clear original source.",
  },
  "email.workflows-health": {
    process: "lead routing",
    ownerRole: "RevOps",
    retest: "Open each errored workflow, fix the failing action, and confirm a new test contact enrols.",
  },
  "email.nurture-sequence": {
    process: "lead routing",
    ownerRole: "Marketing ops",
    retest: "Enrol one new lead and confirm the nurture sends, then stops when the contact becomes a customer.",
  },
  "email.unengaged-handling": {
    process: "deliverability",
    ownerRole: "Marketing ops",
    retest: "Mark one test contact unengaged and confirm the sunset workflow suppresses further sends.",
  },
  "email.sender-authentication": {
    process: "deliverability",
    ownerRole: "Marketing ops",
    retest: "Query the sender domain and confirm SPF, DKIM, and DMARC each return a pass.",
  },
  "email.subscription-coverage": {
    process: "deliverability",
    ownerRole: "Marketing ops",
    retest: "Open each published email and confirm it is tied to one subscription type before the next send.",
  },
  "integrations.connected-apps": {
    process: "data hygiene",
    ownerRole: "Integration owner",
    retest: "Disconnect any app you no longer use and confirm the remaining apps still sync.",
  },
  "integrations.webhook-subscriptions": {
    process: "lead routing",
    ownerRole: "Integration owner",
    retest: "Send one test event and confirm the subscription receives it.",
  },
  "integrations.sync-errors": {
    process: "lead routing",
    ownerRole: "Integration owner",
    retest: "Find the integration that created the bad row, correct that route, and rerun a ten-row import.",
  },
  "integrations.token-scopes": {
    process: "data hygiene",
    ownerRole: "Integration owner",
    retest: "Open the private app Scopes tab, remove every write scope, and rerun the audit.",
  },
  "reporting.dashboards": {
    process: "reporting",
    ownerRole: "RevOps",
    retest: "Open the operating dashboard and confirm pipeline and lifecycle both render.",
  },
  "reporting.attribution": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Open the attribution report and confirm paid and organic channels both appear.",
  },
  "reporting.lifecycle-funnel": {
    process: "reporting",
    ownerRole: "RevOps",
    retest: "Compare the funnel stage names with the lifecycle property and confirm they match.",
  },
  "reporting.deal-attribution": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Open five closed-won deals and confirm each original source, then rerun the audit.",
  },
  "brand.published-pages": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Open the primary campaign URL and confirm the published page loads.",
  },
  "brand.page-meta": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "View the page source and confirm the title and meta description match the offer.",
  },
  "brand.page-tracking": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Load the landing page and confirm the tracking script request returns.",
  },
  "brand.page-cta": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Click the call to action and confirm it opens the intended form or meeting link.",
  },
  "brand.logo": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Open the landing page and confirm the shared logo is visible in the header.",
  },
  "brand.favicon": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Reload the page and confirm the browser tab shows the favicon.",
  },
  "brand.heading": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Open the page and confirm it has one level-one heading.",
  },
  "brand.colours": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Compare the page with the shared palette and confirm no extra colours were introduced.",
  },
  "brand.markers": {
    process: "conversion",
    ownerRole: "Marketing ops",
    retest: "Search the published HTML for each configured phrase and confirm it is present.",
  },
  "journey.stage-hooks": {
    process: "lead routing",
    ownerRole: "Marketing ops",
    retest: "Move one test contact into each uncovered stage and confirm the matching email or workflow exists.",
  },
  "program.dynamic-lists": {
    process: "lead routing",
    ownerRole: "Marketing ops",
    retest: "Change one contact's lifecycle stage and confirm the dynamic list gains or loses that contact.",
  },
  "program.lead-score": {
    process: "lead routing",
    ownerRole: "RevOps",
    retest: "Open a scored contact and confirm the score property has a current value.",
  },
  "program.subscription-types": {
    process: "deliverability",
    ownerRole: "Marketing ops",
    retest: "Open the subscription settings and confirm each marketing email maps to one type.",
  },
  "program.campaigns": {
    process: "reporting",
    ownerRole: "Marketing ops",
    retest: "Open each live asset and confirm it is attached to the campaign for that offer.",
  },
  "program.owners": {
    process: "lead routing",
    ownerRole: "RevOps",
    retest: "Create one test contact and confirm an owner is set before it is routed.",
  },
};
