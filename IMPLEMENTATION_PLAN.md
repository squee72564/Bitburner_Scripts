# Implementation Plan

You are a senior engineer tasked with implementing the previously written design document.

Based strictly on that design:

Produce a step-by-step implementation plan

Break work into logical phases

Identify key files/modules to create

Specify major types and interfaces

Call out tricky or failure-prone areas

Suggest test strategies (unit + integration)

The output should be a clear execution checklist suitable for a coding agent to follow.
Do not redesign the system. Implement what is specified.

---

## Phase 1: Project Skeleton and Configuration

- Create base project structure:
  - `src/config/` for configuration parsing/validation.
  - `src/logger/` for structured logging.
  - `src/mcp/` for MCP server setup and tool registration.
  - `src/bitburner/` for Remote API client.
  - `src/tools/` for tool handlers and schemas.
- Define configuration schema and defaults in a single module.
- Parse environment variables and validate values at startup.

Key files/modules:
- `src/config/index.ts`
- `src/logger/index.ts`

Major types/interfaces:
- `Config` (RPC URL, log level, size limits, timeouts, backoff settings)

## Phase 2: Bitburner Remote API Client

- Implement a WebSocket client with JSON-RPC 2.0.
- Track connection state and expose it to callers.
- Implement request correlation with a pending map.
- Add per-request timeout handling.
- Add reconnect supervisor with exponential backoff and jitter.

Key files/modules:
- `src/bitburner/client.ts`
- `src/bitburner/types.ts`

Major types/interfaces:
- `JsonRpcRequest`, `JsonRpcResponse`, `JsonRpcError`
- `BitburnerClient` interface with typed methods for each Remote API call
- `ConnectionState` enum or union

Tricky areas:
- Ensuring pending requests are rejected on disconnect.
- Avoiding multiple concurrent reconnect loops.
- Correctly handling late responses after timeouts.

## Phase 3: Tool Schemas and Safety Guard

- Define JSON schemas for each MCP tool.
- Enforce defaults for `server` parameter.
- Implement validation for non-empty filenames.
- Enforce size limits for `write_file` content.

Key files/modules:
- `src/tools/schemas.ts`
- `src/tools/validators.ts`

Major types/interfaces:
- `ToolInput` types per tool
- `ValidationResult` or error helpers

Tricky areas:
- Ensuring unknown properties are rejected by schemas.
- Consistent filename validation across tools.

## Phase 4: MCP Server and Tool Handlers

- Instantiate MCP server using the official TypeScript SDK.
- Register tools with schemas and handlers.
- Map each tool handler to the corresponding Bitburner client method.
- Ensure tool handlers short-circuit on disconnect.
- Standardize error mapping from JSON-RPC errors to MCP errors.

Key files/modules:
- `src/mcp/server.ts`
- `src/tools/handlers.ts`
- `src/index.ts`

Major types/interfaces:
- `ToolHandler` signatures from MCP SDK
- `McpError` mapping helpers

Tricky areas:
- Aligning MCP SDK tool schema format with JSON schema definitions.
- Correctly returning tool outputs with expected types.

## Phase 5: Logging and Observability

- Add structured logging for:
  - Startup and config summary (redacted as needed).
  - WebSocket connect/disconnect/reconnect events.
  - Tool calls with context.
  - Errors and timeouts.
- Optional metrics stubs or counters if supported by chosen logger.

Key files/modules:
- `src/logger/index.ts`
- `src/logger/metrics.ts` (optional)

Tricky areas:
- Avoid logging sensitive URLs if they contain tokens.

## Phase 6: Tests

Unit tests:
- Config validation and defaults.
- Schema validation and filename/content size checks.
- JSON-RPC request/response parsing and timeout handling.
- Error mapping logic.

Integration tests:
- Mock WebSocket server to simulate Bitburner Remote API.
- Validate reconnect logic and in-flight request handling.
- Tool handler end-to-end behavior with mock responses.

Key files/modules:
- `tests/config.test.ts`
- `tests/validators.test.ts`
- `tests/jsonrpc.test.ts`
- `tests/tools.integration.test.ts`

Tricky areas:
- Reliable timing in reconnect and timeout tests.

## Phase 7: Operational Hardening

- Add graceful shutdown handling (close WebSocket, stop MCP server).
- Ensure all unhandled promise rejections are logged.
- Confirm defaults for `server` parameter in tool handlers.

Checklist Summary

- [ ] Config loader implemented and validated.
- [ ] WebSocket JSON-RPC client with reconnection and timeouts.
- [ ] Tool schemas and safety validation.
- [ ] MCP server with registered tools and handlers.
- [ ] Logging and (optional) metrics.
- [ ] Unit and integration tests.
- [ ] Graceful shutdown and error handling hardening.
