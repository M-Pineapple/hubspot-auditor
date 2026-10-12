import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { httpsGet } from "./net.ts";

const MAX_BYTES = 2_000_000;
const MAX_HOPS = 3;

export function isNonPublicAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (value.startsWith("::ffff:")) return isNonPublicAddress(value.slice("::ffff:".length));
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (value.startsWith("ff")) return true;
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export async function assertPublicDestination(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]> = resolvePublicHosts,
): Promise<{ url: URL; address: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Site checks require https.");
  if (parsed.username || parsed.password) throw new Error("Site URL must not include credentials.");
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost") throw new Error("Site host is not public.");
  const addresses = isIP(hostname) ? [hostname] : await resolveHost(hostname);
  if (addresses.length === 0 || addresses.some((address) => isNonPublicAddress(address))) {
    throw new Error("Site host does not resolve to a public address.");
  }
  return { url: parsed, address: addresses[0] };
}

async function resolvePublicHosts(hostname: string): Promise<string[]> {
  const looked = await lookup(hostname, { all: true, verbatim: true });
  return looked.map((item) => item.address);
}

export async function fetchPublicPage(url: string): Promise<string> {
  let current = url;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const target = await assertPublicDestination(current);
    const response = await httpsGet(target.url, target.address, { timeoutMs: 10_000, maxBytes: MAX_BYTES });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect had no location.");
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error("Page is larger than 2 MB.");
    return text;
  }
  throw new Error("Too many redirects.");
}
