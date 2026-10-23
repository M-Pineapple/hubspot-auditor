export type Status = "working" | "broken" | "missing" | "needs_operator_confirmation";
export type Severity = "critical" | "high" | "medium" | "low";

export type BusinessProcess =
  | "territory assignment"
  | "billing"
  | "lead routing"
  | "consent"
  | "deliverability"
  | "conversion"
  | "reporting"
  | "data hygiene";

export interface Finding {
  id: string;
  auditor: string;
  status: Status;
  severity: Severity;
  process: BusinessProcess;
  title: string;
  evidence: string;
  recommendedFix: string;
  ownerRole: string;
  retest: string;
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
  filledCount: number | null;
  totalCount: number;
}

export interface Stage {
  id: string;
  label: string;
  probability: number | null;
  isClosed?: boolean;
  requiredProperties: string[];
}

export interface Pipeline {
  objectType: "deals" | "tickets";
  id: string;
  label: string;
  stages: Stage[];
  automatedStageIds: string[];
  automationKnown?: boolean;
  requirementsKnown?: boolean;
}

export interface Deal {
  id: string;
  pipelineId: string;
  stageId: string;
  daysSinceUpdate: number;
  amount?: number | null;
  /** True or false when `hs_is_closed_won` was read. Absent when the property was not returned. */
  isClosedWon?: boolean;
  originalSource?: string | null;
  campaignId?: string | null;
  contactCount?: number;
}

export interface CampaignRecord {
  id: string;
  name: string;
  adAssetCount: number;
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
  /** Submissions in the last 30 days. Null when the read did not return a count. */
  recentSubmissions?: number | null;
  submissionsCapped?: boolean;
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

export interface LandingPage {
  id: string;
  name: string;
  published: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  html: string | null;
  hasCampaign: boolean | null;
}

export interface MarketingEmail {
  id: string;
  name: string;
  subject: string | null;
  published: boolean;
  hasCampaign: boolean | null;
  hasSubscription: boolean;
}

export interface OwnerRecord {
  id: string;
}

export interface ContactList {
  id: string;
  name: string;
  dynamic: boolean;
}

export interface SubscriptionType {
  id: string;
  name: string;
}

export interface FetchGap {
  area: string;
  path: string;
  status: number;
}

export interface TokenScopes {
  scopes: string[] | null;
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
  campaigns?: CampaignRecord[];
  forms: FormDef[];
  tracking: Tracking;
  workflows: Workflow[];
  senderDomains: SenderDomain[];
  integrations: Integration[];
  webhooks: WebhookSub[];
  reports: ReportAsset[];
  landingPages: LandingPage[];
  emails: MarketingEmail[];
  lists: ContactList[];
  subscriptionTypes: SubscriptionType[];
  owners: OwnerRecord[];
  fetchGaps: FetchGap[];
  tokenScopes?: TokenScopes;
}
