import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDemoPortal } from "../src/demo.ts";
import { reportToPdf } from "../src/pdf.ts";
import { audit } from "../src/report.ts";

test("the demo report renders a multi-page PDF without contact addresses", async () => {
  const pdf = await reportToPdf(audit(loadDemoPortal(), "2026-10-12T00:00:00.000Z"));
  const raw = pdf.toString("latin1");
  const decoded = [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
  assert.equal(raw.startsWith("%PDF-"), true);
  assert.match(decoded, /HubSpot Auditor/);
  assert.match(decoded, /Harbour Glass Co/);
  assert.match(decoded, /30\/60\/90-day plan/);
  assert.equal(decoded.includes("@"), false);
  assert.ok((raw.match(/\/Type \/Page[^s]/g) ?? []).length >= 2);
});
