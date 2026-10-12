const MUTATING = /\b(POST|PUT|PATCH|DELETE)\b/;

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
  if (MUTATING.test(path)) {
    throw new ReadOnlyError(`Refused path ${path}.`);
  }
}

export class HubSpotReadClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(token: string, fetchImpl: typeof fetch = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async get<T>(path: string): Promise<T> {
    assertReadOnly("GET", path);
    const response = await this.fetchImpl(`https://api.hubapi.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} for ${path}`);
      (error as Error & { status: number; path: string }).status = response.status;
      (error as Error & { status: number; path: string }).path = path;
      throw error;
    }
    return (await response.json()) as T;
  }
}
