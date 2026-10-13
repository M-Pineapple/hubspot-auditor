# Contributing

You need Node.js 22 or newer.

```bash
git clone https://github.com/M-Pineapple/hubspot-auditor.git
cd hubspot-auditor
npm install
npm run build
npm test
```

`npm run build` compiles TypeScript to `dist/`. The published CLI and MCP server run that JavaScript. Tests import the TypeScript sources.

## Add a check

1. Add an entry under `checks` in the matching `rules/*.yaml` file.
2. Add a function with the same `id` in `src/checks.ts`.
3. Add a test under `tests/` for that auditor.
4. Run `npm test` and `npm run audit:demo`.

An id with no function becomes a `missing` finding that names the id.

## Pull requests

- Keep the change small and tested.
- Use British English in user-facing text.
- Do not commit tokens, live portal dumps, or files under `reports/`.
