# Repository Guidelines

## Project Structure & Module Organization
- `src/`: MCP server source (TypeScript). This is the Node runtime codebase.
- `bitburner/`: Bitburner script sources (TypeScript/JS). Agent-owned files go in `bitburner/agent/`.
- `dist/`: Compiled Bitburner scripts pushed into the game (generated).
- `dist-mcp/`: Compiled MCP server output (generated).
- `build/`: Local sync helpers used by the Bitburner workflow.
- `filesync.json`: Bitburner Remote API sync configuration.
- `tsconfig.json`: MCP server TS config.
- `tsconfig.bitburner.json`: Bitburner TS config.

## Build, Test, and Development Commands
- `pnpm run watch:bb`: Compile Bitburner scripts and sync `dist/` to the game via Remote API.
- `pnpm run build:bb`: One-off Bitburner build to `dist/`.
- `pnpm run typecheck:bb`: Typecheck Bitburner scripts.
- `pnpm run build:mcp`: Build MCP server to `dist-mcp/`.
- `pnpm run dev:mcp`: Run MCP server entrypoint in TS (once implemented).
- `pnpm run typecheck:mcp`: Typecheck MCP server.
- `pnpm run lint`: Run ESLint across the repo.

## Coding Style & Naming Conventions
- Indentation: 2 spaces.
- TypeScript: prefer `camelCase` for variables/functions, `PascalCase` for types/classes.
- Filenames: `kebab-case` for scripts is fine; keep Bitburner scripts concise.
- Linting: ESLint via `eslint.config.cjs`. Use `pnpm run lint:fix` for autofixes.

## Testing Guidelines
- No test framework configured yet. If you add tests, document the runner and conventions in this file.
- Suggested naming: `*.test.ts` under `tests/` or alongside modules.

## Commit & Pull Request Guidelines
- Commit style follows Conventional Commits (e.g., `chore(setup): ...`, `docs: ...`).
- Keep commits focused and atomic; avoid mixing tooling and feature changes.
- PRs should include a short summary, key commands run, and any relevant screenshots (UI only).

## Agent-Specific Instructions
- Agent-generated scripts should live under `bitburner/agent/` to avoid collisions.
- Do not edit `dist/` directly; edit `bitburner/` and let the watch pipeline compile/sync.

## Local Bitburner API Docs
- Netscript API docs are mirrored under `docs/bitburner/`.
- Start with `docs/bitburner/bitburner.ns.md` (index of APIs).
- For direct lookups, use `docs/bitburner/index.json` (function name → doc file).
- Refresh docs with `pnpm run docs:refresh`.
