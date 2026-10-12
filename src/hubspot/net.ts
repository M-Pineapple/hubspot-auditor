import https from "node:https";
import { lookup, resolveTxt } from "node:dns/promises";
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

function requestHttps(
  ip: string,
  hostname: string,
  path: string,
  headers: Record<string, string>,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<Response> {
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
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (options?.maxBytes && size > options.maxBytes) {
            req.destroy(new Error("Page is larger than 2 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers: headerList(res.headers) }));
        });
      },
    );
    if (options?.timeoutMs) req.setTimeout(options.timeoutMs, () => req.destroy(new Error("The site fetch timed out.")));
    req.on("error", reject);
    req.end();
  });
}

export function httpsGet(target: URL, address: string, options?: { timeoutMs?: number; maxBytes?: number }): Promise<Response> {
  return requestHttps(address, target.hostname, `${target.pathname}${target.search}`, {}, options);
}

export function dohEnabled(): boolean {
  return process.env.HUBSPOT_AUDITOR_DOH !== "0";
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

export interface MailAuth {
  spf: "pass" | "missing";
  dkim: "pass" | "missing";
  dmarc: "pass" | "missing";
}

export function classifyMailAuth(records: { name: string; value: string }[], domain: string): MailAuth {
  const host = domain.toLowerCase().replace(/\.$/, "");
  const rows = records.map((record) => ({
    name: record.name.toLowerCase().replace(/\.$/, ""),
    value: record.value.toLowerCase().replaceAll('"', ""),
  }));
  const spf = rows.some((row) => (row.name === host || row.name.endsWith(`.${host}`)) && row.value.includes("v=spf1") && row.name === host);
  const dmarc = rows.some((row) => row.name === `_dmarc.${host}` && row.value.includes("v=dmarc1"));
  const dkim = rows.some((row) => row.name.endsWith(`._domainkey.${host}`) && (row.value.includes("v=dkim1") || row.value.includes("p=")));
  return {
    spf: spf ? "pass" : "missing",
    dkim: dkim ? "pass" : "missing",
    dmarc: dmarc ? "pass" : "missing",
  };
}

async function lookupTxtWithDoh(hostname: string): Promise<string[]> {
  const response = await requestHttps(
    "1.1.1.1",
    "cloudflare-dns.com",
    `/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`,
    { accept: "application/dns-json" },
  );
  const body = (await response.json()) as { Answer?: { type?: number; data?: string }[] };
  return (body.Answer ?? [])
    .filter((item) => item.type === 16 && item.data)
    .map((item) => String(item.data).replaceAll('"', ""));
}

export async function lookupTxt(hostname: string): Promise<string[]> {
  try {
    const rows = await resolveTxt(hostname);
    return rows.map((parts) => parts.join(""));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return [];
    if (!dohEnabled()) return [];
    return lookupTxtWithDoh(hostname);
  }
}

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isResolutionError(error) || !dohEnabled()) throw error;
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") throw error;
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const address = await resolveHost(target.hostname);
    return requestHttps(address, target.hostname, `${target.pathname}${target.search}`, headerRecord(init?.headers));
  }
}
