#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDemoPortal } from "./demo.ts";
import { loadPortal } from "./hubspot/load.ts";
import { reportToPdf } from "./pdf.ts";
import { audit, reportToJson, reportToMarkdown } from "./report.ts";
import { loadRules } from "./rules.ts";

const server = new McpServer({ name: "HubSpot Auditor", version: "1.2.0" });

server.registerTool(
  "list_checks",
  {
    description: "List the versioned audit checks from the YAML rules.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(loadRules(), null, 2) }],
  }),
);

server.registerTool(
  "run_audit",
  {
    description:
      "Run a read-only HubSpot audit. Demo mode uses the fictional sample portal. Live mode reads HUBSPOT_ACCESS_TOKEN from the environment and never accepts a token as an argument.",
    inputSchema: {
      demo: z.boolean().optional().describe("Use the fictional sample portal."),
      publicSiteUrl: z.string().optional().describe("Public site URL to fetch for the tracking checks."),
      pdfPath: z.string().optional().describe("Local .pdf path for the formatted report. Omit to skip the file."),
    },
  },
  async ({ demo, publicSiteUrl, pdfPath }) => {
    if (!demo && !process.env.HUBSPOT_ACCESS_TOKEN) {
      return {
        content: [{ type: "text", text: "Set HUBSPOT_ACCESS_TOKEN or run with demo true." }],
        isError: true,
      };
    }
    const snapshot = demo ? loadDemoPortal() : await loadPortal(process.env.HUBSPOT_ACCESS_TOKEN ?? "", publicSiteUrl);
    if (pdfPath && !snapshot.fictional && pdfPath.split("/").includes("examples")) {
      return {
        content: [{ type: "text", text: "Refusing to write a live report into examples/." }],
        isError: true,
      };
    }
    const report = audit(snapshot);
    const content: { type: "text"; text: string }[] = [
      { type: "text", text: reportToMarkdown(report) },
      { type: "text", text: reportToJson(report) },
    ];
    if (pdfPath) {
      if (!pdfPath.endsWith(".pdf")) {
        return { content: [{ type: "text", text: "pdfPath must end in .pdf." }], isError: true };
      }
      mkdirSync(dirname(pdfPath), { recursive: true });
      writeFileSync(pdfPath, await reportToPdf(report));
      content.push({ type: "text", text: `Wrote the PDF report to ${pdfPath}.` });
    }
    return { content };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
