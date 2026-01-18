# Repository Guidelines

## Project Structure & Module Organization
- `src/`: MCP server source (TypeScript). This is the Node runtime codebase.
- `bitburner/`: Bitburner script sources (TypeScript/JS). User-run scripts live in `bitburner/scripts/`.
- `dist/`: Compiled Bitburner scripts pushed into the game (generated).
- `dist-mcp/`: Compiled MCP server output (generated).
- `build/`: Local sync helpers used by the Bitburner workflow.
- `build/remote-sync.js`: Remote API sync client used by `watch:bb`.
- `filesync.json`: Sync file types/output folder for local workflows (port is unused now).
- `tsconfig.json`: MCP server TS config.
- `tsconfig.bitburner.json`: Bitburner TS config.

## Build, Test, and Development Commands
- `pnpm run watch:bb`: Compile Bitburner scripts and sync `dist/` to the game via the proxy.
- `pnpm run build:bb`: One-off Bitburner build to `dist/`.
- `pnpm run typecheck:bb`: Typecheck Bitburner scripts.
- `pnpm run build:mcp`: Build MCP server to `dist-mcp/`.
- `pnpm run start:mcp`: Run the compiled MCP server (stdio). Build first after changes.
- `pnpm run start:proxy`: Start the Remote API proxy for multiplexing MCP + filesync.
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
- Agent-generated scripts should live under `bitburner/scripts/` to avoid collisions.
- Do not edit `dist/` directly; edit `bitburner/` and let the watch pipeline compile/sync.
 - MCP server logs go to stderr to keep stdout clean for MCP protocol traffic.
- UI scripts can render React panels using the shared UI library in `bitburner/ui/` and the React/DOM shim in `bitburner/ui/react.ts`.
- Prefer `bitburner/lib/hacking-formulas.ts` for hacking math. It wraps `ns.formulas.hacking` when Formulas.exe is available and falls back to NS analysis helpers when not.
- If using the proxy, set `PROXY_GAME_PORT=12526`, `PROXY_CLIENT_PORT=12528`, and `BITBURNER_RPC_URL=ws://localhost:12528`.
- In Bitburner Remote API, connect to `localhost:PROXY_GAME_PORT` so the proxy can forward requests.
- Run `pnpm run start:proxy` before `pnpm run watch:bb` so sync can connect.
- For agent-readable outputs, write results to a file (e.g., `data/last-run.txt`) and use MCP `read_file`.
- MCP tools are read-only; make changes locally and let sync push them into the game.

## Local Bitburner API Docs
- Netscript API docs are mirrored under `docs/bitburner/`.
- Start with `docs/bitburner/bitburner.ns.md` (index of APIs).
- For direct lookups, use `docs/bitburner/index.json` (function name → doc file).
- Refresh docs with `pnpm run docs:refresh`.
