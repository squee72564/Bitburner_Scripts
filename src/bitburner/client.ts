import WebSocket, { RawData } from "ws";
import { Logger } from "../logger";
import type { ConnectionState, JsonRpcRequest, JsonRpcResponse, JsonRpcFailure } from "./types";
import { RemoteApiError } from "./types";

export type ClientOptions = {
  url: string;
  timeoutMs: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class BitburnerClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay: number;
  private stopped = false;

  constructor(private options: ClientOptions, private logger: Logger) {
    this.reconnectDelay = options.reconnectBaseMs;
  }

  getState(): ConnectionState {
    return this.state;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearReconnect();
    this.closeSocket();
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    if (this.state !== "connected" || !this.ws) {
      throw new Error("Bitburner disconnected");
    }

    const id = this.nextId++;
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Remote API timeout after ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws?.send(JSON.stringify(payload), (err?: Error) => {
        if (err) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  async getFileNames(server: string): Promise<string[]> {
    return (await this.call("getFileNames", { server })) as string[];
  }

  async getFile(filename: string, server: string): Promise<string> {
    return (await this.call("getFile", { filename, server })) as string;
  }

  async pushFile(filename: string, content: string, server: string): Promise<"OK"> {
    return (await this.call("pushFile", { filename, content, server })) as "OK";
  }

  async deleteFile(filename: string, server: string): Promise<"OK"> {
    return (await this.call("deleteFile", { filename, server })) as "OK";
  }

  async getAllFiles(server: string): Promise<{ filename: string; content: string }[]> {
    return (await this.call("getAllFiles", { server })) as { filename: string; content: string }[];
  }

  async calculateRam(filename: string, server: string): Promise<number> {
    return (await this.call("calculateRam", { filename, server })) as number;
  }

  async getDefinitionFile(): Promise<string> {
    return (await this.call("getDefinitionFile")) as string;
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.state === "connecting" || this.state === "connected") {
      return;
    }

    this.state = "connecting";
    this.logger.info("Connecting to Bitburner Remote API", { url: this.options.url });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.options.url);
      this.ws = ws;

      ws.on("open", () => {
        this.state = "connected";
        this.reconnectDelay = this.options.reconnectBaseMs;
        this.logger.info("Bitburner Remote API connected");
        resolve();
      });

      ws.on("message", (data: RawData) => this.handleMessage(data.toString()));

      ws.on("close", () => {
        this.logger.warn("Bitburner Remote API disconnected");
        this.state = "disconnected";
        this.rejectPending(new Error("Bitburner disconnected"));
        this.scheduleReconnect();
      });

      ws.on("error", (err: Error) => {
        this.logger.error("Bitburner Remote API error", { error: err.message });
        if (this.state !== "connected") {
          this.state = "disconnected";
          this.scheduleReconnect();
          reject(err);
        }
      });
    });
  }

  private handleMessage(payload: string): void {
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(payload) as JsonRpcResponse;
    } catch (err) {
      this.logger.warn("Invalid JSON-RPC message", { payload });
      return;
    }

    if (!message || typeof message !== "object" || typeof message.id !== "number") {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if ((message as JsonRpcFailure).error) {
      const error = (message as JsonRpcFailure).error;
      pending.reject(new RemoteApiError(error.code, error.message, error.data));
      return;
    }

    pending.resolve((message as { result: unknown }).result);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;

    const jitter = 0.2 * this.reconnectDelay;
    const delay = this.reconnectDelay + (Math.random() * 2 - 1) * jitter;
    const nextDelay = Math.min(this.reconnectDelay * 2, this.options.reconnectMaxMs);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        this.logger.warn("Reconnect attempt failed", { error: err.message });
        this.scheduleReconnect();
      });
    }, Math.max(this.options.reconnectBaseMs, delay));

    this.reconnectDelay = nextDelay;
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
