import { version } from "./version.ts";

export const usage = `HubSpot Auditor ${version}

Read-only HubSpot portal audit. GET requests only.

Usage:
  hubspot-auditor --demo
  hubspot-auditor --demo --out reports
  hubspot-auditor --demo --summary
  hubspot-auditor --site https://example.com --summary

With no arguments, the process speaks MCP over stdio.

Options:
  --demo          Use the fictional Harbour Glass portal
  --out DIR       Write Markdown, JSON, and PDF reports to DIR
  --site URL      Public https page for tracking checks
  --summary       Print counts and check ids as JSON
  --at TIME       Fix the clock for the audit (ISO 8601)
  --help, -h      Show this help
  --version, -v   Show the version
`;
