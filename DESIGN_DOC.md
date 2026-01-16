# Bitburner MCP Server Design Doc

You are a senior software engineer designing an MCP server that wraps the Bitburner Remote API.

Using the provided project brief, write a comprehensive technical design document that includes:

High-level architecture diagram (described in text)

Component responsibilities

WebSocket lifecycle and reconnection strategy

JSON-RPC request/response handling

MCP tool definitions and schemas

Error handling strategy

Configuration and environment variables

Logging and observability

Security and safety constraints

Assumptions and non-goals

The design should be implementation-ready, explicit, and unambiguous.
Do not write code. Focus on architecture and decisions.

---

## Overview

This document defines an implementation-ready design for an MCP server that wraps the Bitburner Remote API. The server exposes Remote API methods as structured MCP tools with strict schemas and safety constraints. The server connects to Bitburner via WebSockets using JSON-RPC 2.0 and treats Bitburner as an external, unreliable dependency.

## High-Level Architecture (Text Diagram)

[LLM Agent]
  -> MCP client transport (stdio or HTTP/SSE)
    -> MCP Server
      -> Tool Router
        -> Bitburner Remote API Client
          -> WebSocket (JSON-RPC 2.0)
            -> Bitburner game instance

Supporting components:
- Config loader (env + defaults)
- Safety guard (input validation, size limits)
- Logger/metrics
- Reconnect supervisor

## Component Responsibilities

### MCP Server
- Hosts MCP protocol server and registers tools.
- Validates tool inputs against JSON schemas.
- Delegates tool calls to tool handlers.
- Applies safety constraints before any Remote API call.

### Tool Router / Handlers
- Maps each MCP tool to a single Remote API method.
- Normalizes inputs (default server = "home").
- Performs preflight validation (non-empty filename, size limits).
- Translates Remote API errors into MCP errors.

### Bitburner Remote API Client
- Owns WebSocket connection lifecycle.
- Sends JSON-RPC requests and correlates responses.
- Provides typed methods for each Remote API call.
- Handles reconnect and backoff strategy.

### Safety Guard
- Rejects empty or whitespace-only filenames.
- Enforces maximum content size for writes.
- Prevents arbitrary JSON-RPC passthrough.

### Configuration Loader
- Loads config from environment variables.
- Provides defaults and validation.

### Logging and Observability
- Structured logs for requests, responses, errors, reconnects.
- Optional metrics counters for tool calls and failures.

## WebSocket Lifecycle and Reconnection Strategy

- On startup, establish a WebSocket connection to the Bitburner Remote API endpoint.
- If connection fails, retry with exponential backoff and jitter.
- If connection drops during operation:
  - Immediately mark connection state as "disconnected".
  - Reject in-flight requests with a transient error indicating disconnect.
  - Attempt reconnect using the same backoff strategy.
- On successful reconnect:
  - Reset backoff timer.
  - Resume accepting tool calls.
- Ensure only one active connection at a time.
- Connection state is exposed internally so tool handlers can short-circuit when disconnected.

Backoff policy:
- Base delay: configurable (e.g., 250ms).
- Max delay: configurable (e.g., 10s).
- Jitter: +/- 20%.
- Max retry attempts: unlimited by default.

## JSON-RPC Request/Response Handling

- Use JSON-RPC 2.0 over WebSocket.
- Each request includes:
  - jsonrpc: "2.0"
  - id: unique integer or string
  - method: Remote API method name
  - params: method-specific payload
- Maintain a pending map from id -> resolver/rejector.
- Time out requests after a configurable duration and reject with a transient error.
- Validate that responses include matching id; ignore unsolicited responses.
- Handle JSON-RPC error objects and map to MCP errors with clear messages.

## MCP Tool Definitions and Schemas

Each Remote API method maps 1:1 to an MCP tool with strict JSON schemas.

### list_files
- Backed by: getFileNames
- Input schema:
  - server: string (default: "home")
- Output:
  - string[]

### read_file
- Backed by: getFile
- Input schema:
  - filename: string (required, non-empty)
  - server: string (default: "home")
- Output:
  - string (file contents)

### write_file
- Backed by: pushFile
- Input schema:
  - filename: string (required, non-empty)
  - content: string (required, size-limited)
  - server: string (default: "home")
- Output:
  - "OK"

### delete_file
- Backed by: deleteFile
- Input schema:
  - filename: string (required, non-empty)
  - server: string (default: "home")
- Output:
  - "OK"

### get_all_files
- Backed by: getAllFiles
- Input schema:
  - server: string (default: "home")
- Output:
  - { filename: string; content: string }[]

### calculate_ram
- Backed by: calculateRam
- Input schema:
  - filename: string (required, non-empty)
  - server: string (default: "home")
- Output:
  - number

### get_netscript_definitions
- Backed by: getDefinitionFile
- Input schema:
  - no inputs
- Output:
  - string (TypeScript .d.ts content)

Schema requirements:
- Reject unknown properties.
- Default server to "home" if omitted.
- Empty or whitespace-only filename is invalid.
- write_file enforces content size limit.

## Error Handling Strategy

- Convert Remote API connection errors into a transient MCP error: "Bitburner disconnected".
- Convert JSON-RPC error objects to MCP errors, preserving message and code.
- Validate inputs before any network call; return invalid-argument errors for schema violations.
- Surface timeouts as transient errors, including elapsed time.
- Log all errors with context (tool name, request id, server, filename).

## Configuration and Environment Variables

- BITBURNER_RPC_URL: WebSocket URL for Remote API (required).
- MCP_LOG_LEVEL: log verbosity (default: info).
- FILE_WRITE_MAX_BYTES: maximum allowed write size (default: 1_000_000 bytes).
- RPC_TIMEOUT_MS: per-request timeout (default: 5000ms).
- RPC_RECONNECT_BASE_MS: base backoff delay (default: 250ms).
- RPC_RECONNECT_MAX_MS: max backoff delay (default: 10000ms).

All configuration values are validated at startup. Invalid config aborts startup with a clear error.

## Logging and Observability

- Structured logs (JSON or key-value) for:
  - Server startup and configuration summary (redacting secrets).
  - WebSocket connect/disconnect/reconnect attempts.
  - Tool calls (tool name, server, filename if present, size if present).
  - Remote API request/response timing.
  - Errors and timeouts with context.
- Optional metrics:
  - tool_calls_total (by tool)
  - tool_errors_total (by tool)
  - rpc_timeouts_total
  - ws_reconnects_total

## Security and Safety Constraints

- Default server parameter to "home" for all tools.
- Reject empty filenames or whitespace-only strings.
- Enforce max content size for write_file.
- Do not expose arbitrary JSON-RPC passthrough.
- Keep MCP tools restricted to filesystem operations only.
- Treat Bitburner as untrusted/unreliable; do not assume availability.

## Assumptions and Non-Goals

Assumptions:
- Bitburner Remote API is enabled and reachable via WebSocket.
- JSON-RPC 2.0 responses are well-formed.
- MCP clients will send valid tool requests.

Non-goals:
- Executing scripts or interacting with in-game state.
- Providing gameplay automation or decision logic.
- Providing generic JSON-RPC proxying.
- Supporting non-Node runtimes.
