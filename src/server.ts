#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDemoPortal } from "./demo.ts";
import { loadPortal } from "./hubspot/load.ts";
import { loadRules } from "./rules.ts";
import { audit, reportToJson, reportToMarkdown } from "./report.ts";

const server = new McpServer({ name: "HubSpot Auditor", version: "1.1.0" });

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
    },
  },
  async ({ demo, publicSiteUrl }) => {
    if (!demo && !process.env.HUBSPOT_ACCESS_TOKEN) {
      return {
        content: [{ type: "text", text: "Set HUBSPOT_ACCESS_TOKEN or run with demo true." }],
        isError: true,
      };
    }
    const snapshot = demo ? loadDemoPortal() : await loadPortal(process.env.HUBSPOT_ACCESS_TOKEN ?? "", publicSiteUrl);
    const report = audit(snapshot);
    return {
      content: [
        { type: "text", text: reportToMarkdown(report) },
        { type: "text", text: reportToJson(report) },
      ],
    };
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
