export type Status = "working" | "broken" | "missing";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Finding {
  id: string;
  auditor: string;
  status: Status;
  severity: Severity;
  title: string;
  evidence: string;
  recommendedFix: string;
}

export interface CheckRule {
  id: string;
  auditor: string;
  title: string;
  severity: Severity;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface Contact {
  id: string;
  email: string | null;
  lifecycleStage: string | null;
  leadStatus: string | null;
}

export interface Company {
  id: string;
  domain: string | null;
}

export interface PropertyDef {
  objectType: "contacts" | "companies" | "deals";
  name: string;
  label: string;
  custom: boolean;
  required: boolean;
  filledCount: number;
  totalCount: number;
}

export interface Stage {
  id: string;
  label: string;
  probability: number | null;
  requiredProperties: string[];
}

export interface Pipeline {
  objectType: "deals" | "tickets";
  id: string;
  label: string;
  stages: Stage[];
  automatedStageIds: string[];
}

export interface Deal {
  id: string;
  pipelineId: string;
  stageId: string;
  daysSinceUpdate: number;
}

export interface FormDef {
  id: string;
  name: string;
  archived: boolean;
  embedded: boolean | null;
  unmappedFields: number | null;
  gdprConsent: boolean | null;
  followUpEmail: boolean | null;
  spamProtection: boolean | null;
}

export interface Tracking {
  publicSiteUrl: string | null;
  html: string | null;
  fetchError: string | null;
  cookieBanner: boolean;
  utmFilled: number;
  utmTotal: number;
  originalSourceFilled: number;
  contactCount: number;
}

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  errored: boolean | null;
  enrolmentCount: number | null;
  kind: "workflow" | "nurture" | "unengaged";
}

export interface SenderDomain {
  domain: string;
  spf: "pass" | "fail" | "missing";
  dkim: "pass" | "fail" | "missing";
  dmarc: "pass" | "fail" | "missing";
}

export interface Integration {
  id: string;
  name: string;
  connected: boolean;
  syncError: boolean;
}

export interface WebhookSub {
  id: string;
  eventType: string;
  active: boolean;
  errorCount: number;
}

export interface ReportAsset {
  id: string;
  name: string;
  kind: "dashboard" | "attribution" | "lifecycle-funnel";
}

export interface FetchGap {
  area: string;
  path: string;
  status: number;
}

export interface PortalSnapshot {
  portalName: string;
  fictional: boolean;
  contacts: Contact[];
  companies: Company[];
  properties: PropertyDef[];
  pipelines: Pipeline[];
  deals: Deal[];
  forms: FormDef[];
  tracking: Tracking;
  workflows: Workflow[];
  senderDomains: SenderDomain[];
  integrations: Integration[];
  webhooks: WebhookSub[];
  reports: ReportAsset[];
  fetchGaps: FetchGap[];
}
