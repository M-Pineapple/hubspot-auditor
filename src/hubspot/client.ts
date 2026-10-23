import { assertAllowed, hubSpotUrl, ReadOnlyError } from "./allowlist.ts";
import { resilientFetch } from "./net.ts";

export { ReadOnlyError };

const TOKEN_INFO_PATH = "/oauth/v2/private-apps/get/access-token-info";

export function assertReadOnly(method: string, path: string): void {
  assertAllowed(method, hubSpotUrl(path));
}

export class HubSpotReadClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(token: string, fetchImpl: typeof fetch = resilientFetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async get<T>(path: string): Promise<T> {
    const url = hubSpotUrl(path);
    assertAllowed("GET", url);
    let last: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
      });
      last = response;
      if (response.ok) return (await response.json()) as T;
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await delay(retryDelay(response, attempt));
        continue;
      }
      break;
    }
    const status = last?.status ?? 0;
    const error = new Error(`HTTP ${status} for ${path}`);
    (error as Error & { status: number; path: string }).status = status;
    (error as Error & { status: number; path: string }).path = path;
    throw error;
  }

  async tokenInfo(): Promise<{ scopes: string[] } | { error: number }> {
    const url = hubSpotUrl(TOKEN_INFO_PATH);
    assertAllowed("POST", url);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tokenKey: this.token }),
      });
    } catch (error) {
      if (error instanceof ReadOnlyError) throw error;
      return { error: 0 };
    }
    if (!response.ok) return { error: response.status };
    try {
      const body = (await response.json()) as { scopes?: unknown };
      if (!Array.isArray(body.scopes) || body.scopes.some((item) => typeof item !== "string")) {
        return { error: response.status };
      }
      return { scopes: body.scopes };
    } catch {
      return { error: response.status };
    }
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header && /^\d+$/.test(header)) return Math.min(Number(header) * 1000, 10_000);
  return Math.min(500 * 2 ** attempt, 10_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
