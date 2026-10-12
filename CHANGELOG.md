# Changelog

All notable changes to HubSpot Auditor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
