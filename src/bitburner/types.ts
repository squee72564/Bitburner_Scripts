export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: number;
  error: JsonRpcError;
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export type ConnectionState = "disconnected" | "connecting" | "connected";

export class RemoteApiError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
