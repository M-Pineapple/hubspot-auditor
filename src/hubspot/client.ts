import { resilientFetch } from "./net.ts";

export class ReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyError";
  }
}

export function assertReadOnly(method: string, path: string): void {
  const verb = method.toUpperCase();
  if (verb !== "GET") {
    throw new ReadOnlyError(`Refused ${verb} ${path}. HubSpot Auditor never writes to a portal.`);
  }
}

export class HubSpotReadClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(token: string, fetchImpl: typeof fetch = resilientFetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async get<T>(path: string): Promise<T> {
    assertReadOnly("GET", path);
    let last: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetchImpl(`https://api.hubapi.com${path}`, {
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
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header && /^\d+$/.test(header)) return Math.min(Number(header) * 1000, 10_000);
  return Math.min(500 * 2 ** attempt, 10_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
