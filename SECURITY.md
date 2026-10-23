# Security

HubSpot Auditor is read-only. Every request is checked against a GET allowlist plus one token-info POST. Requests to any other host or path are refused. Do not grant write scopes to the private app token.

## Token handling

- Read `HUBSPOT_ACCESS_TOKEN` from the environment only.
- Never pass the token as an MCP tool argument.
- Never commit a token or a `.env` file.

## Reporting a vulnerability

Use GitHub's private advisory form:

https://github.com/M-Pineapple/hubspot-auditor/security/advisories/new

Do not open a public issue for a vulnerability.
