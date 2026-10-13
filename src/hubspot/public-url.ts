import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { httpsGet } from "./net.ts";

const MAX_BYTES = 2_000_000;
const MAX_HOPS = 3;

function bareAddress(address: string): string {
  let value = address.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  return zone === -1 ? value : value.slice(0, zone);
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function ipv4NonPublic(value: string): boolean {
  const [a, b, c] = value.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return a >= 224;
}

function expandIpv6(address: string): string[] | null {
  let value = bareAddress(address);
  if (value.includes(".")) {
    const splitAt = value.lastIndexOf(":");
    const tail = value.slice(splitAt + 1);
    if (!isIpv4(tail)) return null;
    const [a, b, c, d] = tail.split(".").map(Number);
    value = `${value.slice(0, splitAt)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill("0"), ...right];
}

function mappedIpv4(address: string): string | null {
  const groups = expandIpv6(address);
  if (!groups) return null;
  const words = groups.map((group) => parseInt(group || "0", 16));
  if (words.slice(0, 5).some((word) => word !== 0) || words[5] !== 0xffff) return null;
  return `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
}

export function isNonPublicAddress(address: string): boolean {
  const value = bareAddress(address);
  if (isIpv4(value)) return ipv4NonPublic(value);
  const mapped = mappedIpv4(value);
  if (mapped) return ipv4NonPublic(mapped);
  const groups = expandIpv6(value);
  if (!groups) return false;
  const words = groups.map((group) => parseInt(group || "0", 16));
  if (words.every((word) => word === 0)) return true;
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true;
  const first = words[0];
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  if (first >= 0xfc00 && first <= 0xfdff) return true;
  return (first & 0xff00) === 0xff00;
}

export async function assertPublicDestination(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]> = resolvePublicHosts,
): Promise<{ url: URL; address: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Site checks require https.");
  if (parsed.username || parsed.password) throw new Error("Site URL must not include credentials.");
  let hostname = parsed.hostname;
  if (hostname.startsWith("[") && hostname.endsWith("]")) hostname = hostname.slice(1, -1);
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
