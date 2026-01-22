# Repository Guidelines

## Project Structure & Module Organization
- `bitburner/lib/core`: core helpers
- `bitburner/lib/hgw`: hack/grow/weaken math + orchestration helpers.
- `bitburner/lib/coding-contracts`: generated contract data, answers, signatures.
- `bitburner/scripts`: user-run Bitburner scripts.
- `bitburner/ui`: shared React UI components + theme/shims.

## Coding Style & Naming Conventions
- Indentation: 2 spaces.
- TypeScript: prefer `camelCase` for variables/functions, `PascalCase` for types/classes and`kebab-case` for filenames.

## Build, Test, and Development Commands
- Run these commands after making updates to check if everything works.
- `pnpm run typecheck:bb && pnpm run lint --fix && pnpm run format`

## Agent-Specific Instructions
- Do not edit `dist/` directly
- UI scripts can render React panels using the shared UI library in `bitburner/ui/` and the React/DOM shim in `bitburner/ui/react.ts`.
- Prefer `bitburner/lib/hacking-formulas.ts` for hacking math.
- For agent-readable outputs, write results to a file (e.g., `data/last-run.txt`) and use MCP `read_file`.

## Local Bitburner API Docs
- Netscript API docs `docs/bitburner/`.
- Index of APIs `docs/bitburner/bitburner.ns.md`
- For direct lookups `docs/bitburner/index.json`
