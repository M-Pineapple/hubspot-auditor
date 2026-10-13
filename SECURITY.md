# Security

HubSpot Auditor is read-only. The HubSpot client throws if any method other than GET is used. Do not grant write scopes to the private app token.

## Token handling

- Read `HUBSPOT_ACCESS_TOKEN` from the environment only.
- Never pass the token as an MCP tool argument.
- Never commit a token or a `.env` file.

## Reporting a vulnerability

Use GitHub's private advisory form:

https://github.com/M-Pineapple/hubspot-auditor/security/advisories/new

Do not open a public issue for a vulnerability.
