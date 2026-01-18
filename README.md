# Bitburner Helper Toolkit (Scripts, UI, Sync, and MCP)

This repo is primarily a Bitburner automation toolkit: user-run scripts, UI components, helper libraries, and a local TypeScript workflow that syncs to the game. It also includes an optional MCP (Model Context Protocol) server for LLM tooling.

## Project Goals (Current Focus)

- Ship reusable Bitburner scripts under `bitburner/scripts/`.
- Provide a clean TS workflow + sync pipeline (`bitburner/` → `dist/` → game).
- Support in-game React rendering with a light UI toolkit.
- Keep local Bitburner API docs for quick lookup and LLM use.
- Optionally expose an MCP server for read-only tooling over the Remote API.

## Repository Layout (High-Level)

- Bitburner scripts source: `bitburner/`
  - User scripts: `bitburner/scripts/`
  - UI components: `bitburner/ui/components/`
  - UI React/DOM shim: `bitburner/ui/react.ts`
  - Helpers and traversal utilities: `bitburner/lib/`
  - TS shim: `bitburner/react-shim.d.ts`
- Bitburner build output (synced to game): `dist/`
- Sync helpers + Remote API client: `build/` and `build/remote-sync.js`
- Sync config: `filesync.json`
- Local Bitburner docs: `docs/bitburner/`
- MCP server source (optional): `src/`
- MCP server build output: `dist-mcp/`

## Bitburner TypeScript Workflow

This setup mirrors the important parts of the official template:

- `filesync.json` configures sync file types/output folder and definition file (the `port` field is unused now).
- `build/remote-sync.js` pushes `dist/` to the game over the Remote API.
- `build/` scripts keep `dist/` in sync with `bitburner/` (static files and deletions).
- `tsconfig.bitburner.json` compiles Bitburner scripts to `dist/` with Netscript typings.

### Install deps

```
pnpm install
```

### Start the Bitburner watchers

```
pnpm run watch:bb
```

Requires the proxy to be running (see below).

This will:
- Compile `bitburner/` TypeScript to `dist/`.
- Sync `dist/` into the in-game filesystem (via the proxy).

### Build scripts once

```
pnpm run build:bb
```

### React helper (optional)

If you use React inside Bitburner UI scripts, import the in-game shim:

```
import { React, ReactDOM } from "/ui/react";
```

## Linting

```
pnpm run lint
```

```
pnpm run lint:fix
```

## Formatting

```
pnpm run format
```

```
pnpm run format:check
```

## UI Scripts (React)

This repo includes a lightweight UI toolkit for Bitburner scripts under `bitburner/ui/`. Use the React/DOM shim in `bitburner/ui/react.ts` to render floating panels or modals directly into the game UI.

## Local Bitburner Docs

Use `scripts/refresh-bitburner-docs.js` to pull API docs into `docs/bitburner/` for offline lookup or LLM usage.

## MCP Server (Optional)

The MCP server is implemented under `src/` and connects to Bitburner’s Remote API over WebSocket using MCP stdio transport.

### MCP Server (Local Run)

Copy the env template, then build and run the server over stdio:

```
cp .env.example .env
```

```
pnpm run build:mcp
pnpm run start:mcp
```

Required environment variables:
- `BITBURNER_RPC_URL` (e.g., `ws://localhost:12528` when using the proxy)

Notes:
- The MCP server writes logs to stderr to keep stdout clean for MCP protocol messages.
- Rebuild after source changes (`pnpm run build:mcp`).
- For Codex, point MCP config to the compiled entrypoint: `node /home/alan/Programming/BitBurner/dist-mcp/index.js`.
- MCP tools are read-only; file modifications happen via local edits + sync.

### Remote API Proxy (MCP + watch:bb together)

Bitburner’s Remote API expects the game to connect out to a server. The proxy hosts that server and lets local clients (MCP + sync) share a single game connection.

1) Build the server:
```
pnpm run build:mcp
```

2) Start the proxy:
```
pnpm run start:proxy
```

3) In Bitburner, open Remote API and connect to:
- Host: `localhost`
- Port: `PROXY_GAME_PORT` (default `12526`)

4) Ensure `.env` points MCP + sync at the proxy clients port:
- `PROXY_CLIENT_PORT=12528`
- `BITBURNER_RPC_URL=ws://localhost:12528`

5) Start `watch:bb` after the proxy is running so sync can attach.

6) Restart Codex after `.env` changes so MCP reloads the URL.

Optional: set `PROXY_LOG_LEVEL=debug` in `.env` to see proxy request/response logs.

## Documents

- Design doc: `DESIGN_DOC.md`
- Implementation plan: `IMPLEMENTATION_PLAN.md`

## MCP Scope

- MCP tooling is filesystem-only (read/write/delete/list, RAM calculation, type definitions).
- No gameplay control or in-game state manipulation via MCP.
