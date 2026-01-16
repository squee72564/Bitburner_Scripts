# Bitburner MCP Server

An MCP (Model Context Protocol) server that wraps the Bitburner Remote API to provide safe, filesystem-only tooling for LLM coding agents. The repo also includes a Bitburner TypeScript workflow for your in-game scripts, based on the official Bitburner TypeScript template (without Docker).

## Project Goals

- Provide a stable bridge between LLM agents and the Bitburner in-game filesystem.
- Map Bitburner Remote API methods 1:1 into MCP tools.
- Enforce safety constraints (default to `home`, reject empty filenames, limit file sizes).
- Offer a local TypeScript workflow for writing Bitburner scripts.

## Repository Layout

- MCP server source: `src/`
- Bitburner scripts source: `bitburner/`
- Bitburner build output: `dist/`
- MCP server build output: `dist-mcp/`
- Bitburner sync config (file types/output): `filesync.json`
- Remote sync client: `build/remote-sync.js`
  - Agent-managed scripts: `bitburner/agent/`

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

If you use React inside Bitburner UI scripts, import the helper shim:

```
import React, { ReactDOM } from "@react";
```

## Linting

```
pnpm run lint
```

```
pnpm run lint:fix
```

## MCP Server

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

## Scope

- Filesystem-level access only (read/write/delete/list, RAM calculation, type definitions).
- No gameplay control or in-game state manipulation.
