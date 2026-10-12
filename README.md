# HubSpot Auditor

![HubSpot Auditor](assets/hero.svg)

Read-only audit of a HubSpot portal. You get a scored report of what works, what is broken, and what is missing, plus a 30/60/90-day fix plan.

The server speaks MCP over stdio. A CLI runs the same audit. It never sends POST, PUT, PATCH, or DELETE to HubSpot.

What's new in v1.1.0: landing page and brand checks, buyer-journey email hooks, and list, score, subscription, and campaign checks. A failed ticket-pipeline read no longer hides the deal pipeline. See [CHANGELOG.md](CHANGELOG.md).

## Who is this for?

**RevOps lead cleaning a portal before a process change.** You need one pass over duplicates, pipelines, and forms.

- "Audit this portal in demo mode and show the broken checks."
- "Which required contact properties are thin?"
- "Which deal stages have a weak probability?"

You get findings with severity, evidence, and a recommended fix.

**Administrator checking consent and sending.** You need GDPR fields, spam controls, and sender authentication called out first.

- "Run the demo audit and list the critical findings."
- "What does the email auditor check?"
- "Show the 30-day plan."

You get critical and high items at the top of the plan.

**Consultant handing a client a checklist.** You need a report you can regenerate after they change a YAML threshold.

- "List every check and its severity."
- "Run the fictional Harbour Glass audit."
- "Write the Markdown and JSON reports."

You get `examples/example-report.md` and `examples/example-report.json` from the sample portal. No customer data is in that example.

**Agent user who already has HubSpot connected.** You want a second server that only scores the portal.

- "Run a read-only audit. Do not change the portal."
- "Use demo true if no token is set."

You get the same report. The token stays in the environment. It is not a tool argument.

## What it checks

Rules live in versioned YAML under `rules/`. Each file has `version: 1` and a list of checks. Turn a check off with `enabled: false`. Thresholds sit under `params`.

| Auditor | Checks |
| --- | --- |
| CRM | Duplicate contacts, duplicate companies, required properties, unused custom properties, lifecycle stage against lead status |
| Pipelines | Deal stage probabilities, stale deals, required fields per stage, stage-change automation, ticket pipeline |
| Forms | Live forms, embedded versus unused, field mapping, GDPR consent, follow-up email, spam protection |
| Tracking | Tracking code on a public URL, cookie banner, UTM capture, original source |
| Email | Workflow health, nurture sequence, unengaged contacts, SPF, DKIM, and DMARC |
| Integrations | Connected apps, webhook subscriptions, sync errors |
| Reporting | Dashboards, attribution reports, lifecycle funnel |
| Brand | Published landing pages, title and meta description, tracking script, call to action, optional brand markers |
| Journey | A published email or active workflow for each buyer stage you list |
| Program | Dynamic lists, lead score, email subscription types, campaign links |

A check returns `working`, `broken`, or `missing`. Evidence is counts and property names. The report does not print contact records.

The score is the percentage of checks that are working. The 30-day plan is critical and high broken items. The 60-day plan is medium broken items plus critical and high missing items. The 90-day plan is what remains.

Live mode reads HubSpot with GET requests and a private app token. If a call is forbidden or the payload has no field for that check, the finding is `missing`. A failed ticket-pipeline read does not hide the deal pipeline. Fill rates count only contact properties that were requested. Demo mode loads `demo/portal.json`, a fictional company called Harbour Glass Co.

`brand.markers` stays missing until you add your own phrases, colour tokens, or asset names under `params.markers` in `rules/brand.yaml`. The buyer-stage patterns live in `rules/journey.yaml`. Pass `--site` only for the public site you want judged. The audit does not pick a company domain for you. Landing page checks use the CMS page URL.

## MCP tools

| Tool | Parameters | Purpose |
| --- | --- | --- |
| `list_checks` | none | Return the YAML checks, including severity and params |
| `run_audit` | `demo` (optional boolean), `publicSiteUrl` (optional string) | Run the audit. `demo: true` uses the sample portal. Live mode reads `HUBSPOT_ACCESS_TOKEN` from the environment |

## Example workflow

You: "Run the Harbour Glass demo and tell me the score."

The server calls `run_audit` with `demo: true`.

You get a score of 15, with 6 working, 20 broken, and 14 missing. The first 30-day items are sender authentication, GDPR consent, and the missing tracking script.

## Setup

You need Node.js 22 or newer.

```bash
git clone https://github.com/M-Pineapple/hubspot-auditor.git
cd hubspot-auditor
npm install
npm test
npm run audit:demo
```

`npm run audit:demo` writes `examples/example-report.md` and `examples/example-report.json`.

For a live portal, create a HubSpot private app and copy a token that has read scopes only. Do not grant write scopes. Put the token in the environment. Do not pass it as a tool argument.

```bash
export HUBSPOT_ACCESS_TOKEN="paste-a-read-only-private-app-token"
node --experimental-strip-types src/cli.ts --site https://example.com --summary
```

`--site` is the public page the tracking checks fetch. `--summary` prints counts and check ids only.

Suggested read scopes for the calls this server makes:

- `crm.objects.contacts.read`
- `crm.objects.companies.read`
- `crm.objects.deals.read`
- `crm.schemas.contacts.read`
- `forms`
- `automation`

A missing scope becomes a `missing` finding for that area. The client still does not retry with a write method.

### Claude Desktop

Use `config/claude-desktop.json`. Replace the path and the token.

### Cursor

Use `config/cursor-mcp.json`. Replace the path and the token.

### Claude Code

Add the same command from `config/claude-code.json` to your MCP settings.

Start the server on its own with:

```bash
npm start
```

## How this differs from the official HubSpot MCP

| | Official HubSpot MCP | HubSpot Auditor |
| --- | --- | --- |
| Job | Read and update CRM objects through HubSpot tools | Score the portal and recommend fixes |
| Writes | Depends on the app scopes you grant | None. Non-GET methods throw |
| Rules | Not a checklist | Versioned YAML in `rules/` |
| Sample data | Your portal | Fictional demo portal with no token |

Use the official server when you want an agent to work in the CRM. Use this server when you want a read-only audit.

## Example report

The full fictional report is [examples/example-report.md](examples/example-report.md). The JSON form is [examples/example-report.json](examples/example-report.json).

Harbour Glass Co scores **15**. Six checks are working, 20 are broken, and 14 are missing.

```markdown
# HubSpot audit: Harbour Glass Co

This report uses a fictional sample portal. It is not a customer account.

Score: **15** (share of checks that are working).

| Status | Count |
| --- | ---: |
| Working | 6 |
| Broken | 20 |
| Missing | 14 |
```

The broken list starts with sender authentication, GDPR consent on forms, and the tracking code. The 30-day plan takes the critical and high broken items. The 60-day and 90-day plans follow in the same file.

## Extend a check

1. Add an entry under `checks` in the matching `rules/*.yaml` file.
2. Add a function with the same `id` in `src/checks.ts`.
3. Add a test under `tests/` for that auditor.
4. Run `npm test` and `npm run audit:demo`.

An id with no function becomes a `missing` finding that names the id.

## 💖 Support This Project

If HubSpot Auditor has helped you audit a portal, consider supporting its development:

<a href="https://www.buymeacoffee.com/mpineapple" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Licence

MIT. Copyright (c) 2026 M-Pineapple.
