# Changelog

All notable changes to HubSpot Auditor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.4] - 2026-10-15

### Security

- Site checks block a few more non-public address forms, and the PDF report writer refuses to follow symbolic links in the reports folder. Details are in a private advisory. Please update once released.

### Changed

- CI: actions pinned to commit SHAs (#22).

## [1.4.3] - 2026-10-13

### Security

- Site checks now block more non-public addresses, including IPv6 forms that embed IPv4. Please update.

## [1.4.2] - 2026-10-13

### Added

- `mcpName` for the official MCP Registry, plus `server.json` and an MCPB manifest.

## [1.4.1] - 2026-10-13

### Changed

- Republished so the npm maintainer record uses the current account email.

## [1.4.0] - 2026-10-13

### Added

- A TypeScript build that emits JavaScript under `dist/`. The `hubspot-auditor` command and the MCP server run that compiled output, so Node no longer needs `--experimental-strip-types`.
- `prepublishOnly` runs the build so an npm publish ships `dist/`, `rules/`, and `demo/`.
- A GitHub Actions workflow that runs the build and the tests.

### Changed

- MCP client configs use `npx -y hubspot-auditor`. From a git clone, run `npm run build` first and start `node dist/main.js`.

### Fixed

- The form mapper no longer lists `followUpEmail` twice, so the TypeScript build can emit.
- The PDF test looks for demo contact domains instead of any `@` byte, which font streams can contain.

## [1.3.2] - 2026-10-13

### Fixed

- Site fetches also reject IPv6-mapped forms of private and loopback addresses, including `[::ffff:127.0.0.1]`, which Node rewrites to `::ffff:7f00:1`.

## [1.3.1] - 2026-10-12

### Fixed

- Site fetches require `https`, reject non-public addresses, and re-check redirects.
- `run_audit` writes a PDF only as a file name under `reports/`, and does not overwrite unless asked.
- HTTP 429 and 5xx are retried, then reported as throttling or an outage.
- Portal names in evidence are shortened and stripped of control characters.
- Sender TXT lookups use the system resolver first. Set `HUBSPOT_AUDITOR_DOH=0` to disable the DNS-over-HTTPS fallback.
- The `hubspot-auditor` command runs through a Node shim, so a fresh install does not need a TypeScript build.

## [1.3.0] - 2026-10-12

### Added

- Brand checks for a logo, a favicon, a level-one heading, and the colour palette. Extra phrases stay optional.
- Sender authentication is read from SPF, DKIM, and DMARC records for the portal's email domains.
- Published emails are checked for a subscription type. Record owners are checked.
- The lifecycle funnel is read from contact stages when HubSpot does not return a report object.
- Lists, subscription types, email campaign links, and form follow-up actions are read from the fields HubSpot actually returns.
- When no public site URL is passed, tracking uses the portal's primary site domain.

## [1.2.0] - 2026-10-12

### Added

- A PDF report with the score, a working, broken, and missing bar, each finding and its fix, and the 30/60/90-day plan.
- `run_audit` accepts `pdfPath`. The CLI writes a `.pdf` next to the Markdown and JSON when you pass `--out`.

### Fixed

- When the system resolver cannot find `api.hubapi.com`, reads fall back to DNS over HTTPS and connect with the original host name.
- A failed lookup is reported as no HTTP response, rather than as a missing scope.

## [1.1.0] - 2026-10-12

### Added

- Landing page checks for a published page, title, meta description, tracking script, and call to action.
- Optional brand markers in `rules/brand.yaml`. The check stays missing until you set your own markers.
- Buyer-journey email hooks in `rules/journey.yaml`. Each stage looks for a published email or an active workflow.
- Program checks for dynamic lists, lead score, email subscription types, and campaign links.

### Fixed

- A failed ticket-pipeline read no longer hides deal pipeline checks.
- Contact fill rates count only properties that were requested. An unsampled property is not treated as empty.
- The audit does not choose a company domain as the public site. Pass `--site` for that check. Landing pages use their own CMS URL.

## [1.0.0] - 2026-10-12

### Added

- Read-only HubSpot audit over stdio MCP and a local CLI.
- Auditors for CRM, pipelines, forms, tracking, email, integrations, and reporting.
- Versioned YAML checks, a fictional demo portal, and a scored Markdown and JSON report with a 30/60/90-day plan.
