import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";

type JsonRpcId = number | string | null;

type PendingRequest = {
  client: WebSocket;
  originalId: JsonRpcId;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function parsePort(value: string | undefined, fallback: number, name: string): number {
  const raw = value ?? String(fallback);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const gamePort = parsePort(process.env.PROXY_GAME_PORT, 12526, "PROXY_GAME_PORT");
const clientPort = parsePort(process.env.PROXY_CLIENT_PORT, 12528, "PROXY_CLIENT_PORT");
const logLevel = (process.env.PROXY_LOG_LEVEL ?? "info").toLowerCase();
const logDebug = logLevel === "debug";

function log(message: string, meta?: Record<string, unknown>): void {
  const payload = { level: "info", message, time: new Date().toISOString(), ...meta };
  console.error(JSON.stringify(payload));
}

function logError(message: string, error: unknown): void {
  const payload = {
    level: "error",
    message,
    time: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  console.error(JSON.stringify(payload));
}

function logDebugMessage(message: string, meta?: Record<string, unknown>): void {
  if (!logDebug) return;
  const payload = { level: "debug", message, time: new Date().toISOString(), ...meta };
  console.error(JSON.stringify(payload));
}

function resolveUpstreamId(id: JsonRpcId): number | null {
  if (typeof id === "number") return id;
  if (typeof id === "string" && /^[0-9]+$/.test(id)) {
    const parsed = Number.parseInt(id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const pending = new Map<number, PendingRequest>();
let nextId = 1;
let gameSocket: WebSocket | null = null;

function sendJson(ws: WebSocket, payload: JsonRpcResponse): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function sendClientError(ws: WebSocket, id: JsonRpcId, message: string): void {
  sendJson(ws, { jsonrpc: "2.0", id, error: { code: -32000, message } });
}

function rejectAllPending(message: string): void {
  for (const [id, entry] of pending.entries()) {
    sendClientError(entry.client, entry.originalId, message);
    pending.delete(id);
  }
}

function handleGameResponse(message: JsonRpcResponse): void {
  if (!message || typeof message !== "object" || typeof message.id === "undefined") return;

  const upstreamId = resolveUpstreamId(message.id);
  if (upstreamId === null) {
    logDebugMessage("Proxy response ignored (non-numeric id)", { id: message.id });
    return;
  }

  const entry = pending.get(upstreamId);
  if (!entry) {
    logDebugMessage("Proxy response ignored (unknown id)", { upstreamId });
    return;
  }

  pending.delete(upstreamId);
  sendJson(entry.client, { ...message, id: entry.originalId });
  logDebugMessage("Proxy response forwarded", { upstreamId, originalId: entry.originalId });
}

function handleGameMessage(payload: string): void {
  let message: JsonRpcResponse | JsonRpcResponse[];
  try {
    message = JSON.parse(payload) as JsonRpcResponse | JsonRpcResponse[];
  } catch {
    return;
  }

  if (Array.isArray(message)) {
    for (const item of message) handleGameResponse(item);
    return;
  }

  handleGameResponse(message);
}

function forwardToGame(request: JsonRpcRequest, client: WebSocket): void {
  if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) {
    if (typeof request.id !== "undefined") {
      sendClientError(client, request.id, "Game not connected");
    }
    return;
  }

  const hasId = typeof request.id !== "undefined";
  if (!hasId) {
    gameSocket.send(JSON.stringify(request));
    return;
  }

  const upstreamId = nextId++;
  pending.set(upstreamId, { client, originalId: request.id ?? null });
  gameSocket.send(JSON.stringify({ ...request, id: upstreamId }));
  logDebugMessage("Proxy request forwarded", {
    method: request.method,
    upstreamId,
    originalId: request.id ?? null,
  });
}

const gameServer = new WebSocketServer({ port: gamePort });
gameServer.on("listening", () => log("Proxy listening for game", { port: gamePort }));
gameServer.on("connection", (ws) => {
  if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
    gameSocket.close(1000, "Replaced by new game connection");
  }

  gameSocket = ws;
  log("Game connected");

  ws.on("message", (data) => handleGameMessage(data.toString()));
  ws.on("close", (code, reason) => {
    if (gameSocket === ws) {
      gameSocket = null;
      log("Game disconnected", { code, reason: reason?.toString() });
      rejectAllPending("Game disconnected");
    }
  });
  ws.on("error", (err) => logError("Game socket error", err));
});

const clientServer = new WebSocketServer({ port: clientPort });
clientServer.on("listening", () => log("Proxy listening for clients", { port: clientPort }));
clientServer.on("connection", (client) => {
  client.on("message", (data) => {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(data.toString()) as JsonRpcRequest;
    } catch {
      return;
    }

    if (!request || typeof request !== "object" || typeof request.method !== "string") return;
    forwardToGame(request, client);
  });

  client.on("close", () => {
    for (const [id, entry] of pending.entries()) {
      if (entry.client === client) pending.delete(id);
    }
  });
});
