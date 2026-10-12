import https from "node:https";
import { lookup } from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";

const cache = new Map<string, { address: string; until: number }>();

export function isResolutionError(error: unknown): boolean {
  const pending = [error];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const code = (current as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return true;
    const cause = (current as { cause?: unknown }).cause;
    if (cause) pending.push(cause);
    const errors = (current as { errors?: unknown[] }).errors;
    if (Array.isArray(errors)) pending.push(...errors);
  }
  return false;
}

function headerList(headers: IncomingHttpHeaders): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") pairs.push([key, value]);
    else if (Array.isArray(value)) for (const item of value) pairs.push([key, item]);
  }
  return pairs;
}

function requestHttps(ip: string, hostname: string, path: string, headers: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        servername: hostname,
        path,
        method: "GET",
        headers: { ...headers, host: hostname },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers: headerList(res.headers) }));
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function resolveWithDoh(hostname: string): Promise<string> {
  const response = await requestHttps(
    "1.1.1.1",
    "cloudflare-dns.com",
    `/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    { accept: "application/dns-json" },
  );
  const body = (await response.json()) as { Answer?: { type?: number; data?: string }[] };
  const address = body.Answer?.find((item) => item.type === 1 && item.data)?.data;
  if (!address) throw new Error(`No address for ${hostname}`);
  return address;
}

export async function resolveHost(hostname: string): Promise<string> {
  const cached = cache.get(hostname);
  if (cached && cached.until > Date.now()) return cached.address;
  let address: string;
  try {
    address = (await lookup(hostname)).address;
  } catch (error) {
    if (!isResolutionError(error)) throw error;
    address = await resolveWithDoh(hostname);
  }
  cache.set(hostname, { address, until: Date.now() + 60_000 });
  return address;
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const record: Record<string, string> = {};
  if (!headers) return record;
  const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers);
  for (const [key, value] of entries) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isResolutionError(error)) throw error;
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") throw error;
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const address = await resolveHost(target.hostname);
    return requestHttps(address, target.hostname, `${target.pathname}${target.search}`, headerRecord(init?.headers));
  }
}
