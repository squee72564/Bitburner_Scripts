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
- Bitburner file sync config: `filesync.json`
  - Agent-managed scripts: `bitburner/agent/`

## Bitburner TypeScript Workflow

This setup mirrors the important parts of the official template:

- `filesync.json` configures the Remote API file sync (port, output folder, definition file).
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

Then connect from Bitburner:
- Options -> Remote API -> port `12525` -> connect

This will:
- Compile `bitburner/` TypeScript to `dist/`.
- Sync `dist/` into the in-game filesystem.
- Download `NetscriptDefinitions.d.ts` on connection.

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

Copy the env template, then run the server over stdio:

```
cp .env.example .env
```

```
pnpm run dev:mcp
```

Required environment variables:
- `BITBURNER_RPC_URL` (e.g., `ws://localhost:12525`)

Notes:
- The MCP server writes logs to stderr to keep stdout clean for MCP protocol messages.

## Documents

- Design doc: `DESIGN_DOC.md`
- Implementation plan: `IMPLEMENTATION_PLAN.md`

## Scope

- Filesystem-level access only (read/write/delete/list, RAM calculation, type definitions).
- No gameplay control or in-game state manipulation.
