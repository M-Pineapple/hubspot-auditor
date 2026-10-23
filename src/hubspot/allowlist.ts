export const HUBSPOT_ORIGIN = "https://api.hubapi.com";

const id = "[A-Za-z0-9-]+";
const GET = "GET" as const;
const POST = "POST" as const;

export interface AllowedRequest {
  method: "GET" | "POST";
  pattern: RegExp;
  purpose: string;
}

export const ALLOWED_REQUESTS: AllowedRequest[] = [
  { method: GET, pattern: /^\/account-info\/v3\/details$/, purpose: "Account details" },
  { method: GET, pattern: /^\/crm\/v3\/objects\/(?:contacts|companies|deals)$/, purpose: "CRM object sample" },
  { method: GET, pattern: /^\/crm\/v3\/properties\/contacts$/, purpose: "Contact properties" },
  { method: GET, pattern: /^\/crm\/v3\/pipelines\/(?:deals|tickets)$/, purpose: "Pipelines" },
  { method: GET, pattern: /^\/marketing\/v3\/forms$/, purpose: "Form list" },
  { method: GET, pattern: new RegExp(`^/marketing/v3/forms/${id}$`), purpose: "Form detail" },
  { method: GET, pattern: new RegExp(`^/form-integrations/v1/submissions/forms/${id}$`), purpose: "Form submissions" },
  { method: GET, pattern: /^\/automation\/v4\/flows$/, purpose: "Workflows" },
  { method: GET, pattern: /^\/cms\/v3\/pages\/landing-pages$/, purpose: "Landing pages" },
  { method: GET, pattern: /^\/cms\/v3\/pages\/site-pages$/, purpose: "Site pages" },
  { method: GET, pattern: /^\/marketing\/v3\/emails$/, purpose: "Marketing emails" },
  { method: GET, pattern: /^\/marketing\/v3\/campaigns$/, purpose: "Marketing campaigns" },
  { method: GET, pattern: new RegExp(`^/marketing/v3/campaigns/${id}/assets/AD_CAMPAIGN$`), purpose: "Campaign ad assets" },
  { method: GET, pattern: /^\/contacts\/v1\/lists$/, purpose: "Contact lists" },
  { method: GET, pattern: /^\/communication-preferences\/v3\/definitions$/, purpose: "Subscription types" },
  { method: GET, pattern: /^\/cms\/v3\/domains$/, purpose: "Domains" },
  { method: GET, pattern: /^\/crm\/v3\/owners$/, purpose: "Owners" },
  { method: GET, pattern: /^\/integrations\/v1\/me$/, purpose: "Connected app probe" },
  { method: GET, pattern: /^\/webhooks\/v3\/subscriptions$/, purpose: "Webhook probe" },
  { method: GET, pattern: /^\/analytics\/v2\/reports$/, purpose: "Reports probe" },
  { method: POST, pattern: /^\/oauth\/v2\/private-apps\/get\/access-token-info$/, purpose: "Private app token scopes" },
];

export class ReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyError";
  }
}

export function hubSpotUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${HUBSPOT_ORIGIN}${path}`;
}

function rawPath(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  if (/^https?:\/\//i.test(withoutQuery)) {
    return withoutQuery.replace(/^https?:\/\/[^/]+/i, "") || "/";
  }
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

export function assertAllowed(method: string, url: string): void {
  const verb = method.toUpperCase();
  const path = rawPath(url);
  const refuse = (shown: string): never => {
    throw new ReadOnlyError(`Refused ${verb} ${shown}. HubSpot Auditor never writes to a portal.`);
  };
  // Reject before URL normalisation, which would drop ".." and hide the path.
  if (path.includes("..") || /%2f/i.test(path) || /%5c/i.test(path) || /%2e%2e/i.test(path)) {
    refuse(path);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ReadOnlyError(`Refused ${verb} ${path || "/"}. HubSpot Auditor never writes to a portal.`);
  }
  if (parsed.username || parsed.password || parsed.origin !== HUBSPOT_ORIGIN) {
    refuse(parsed.pathname);
  }
  const allowed = ALLOWED_REQUESTS.some((entry) => entry.method === verb && entry.pattern.test(parsed.pathname));
  if (!allowed) refuse(parsed.pathname);
}
