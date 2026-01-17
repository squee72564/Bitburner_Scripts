export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Config = {
  rpcUrl: string;
  logLevel: LogLevel;
  fileWriteMaxBytes: number;
  rpcTimeoutMs: number;
  rpcReconnectBaseMs: number;
  rpcReconnectMaxMs: number;
};

function parseIntEnv(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return 'info';
  const normalized = value.toLowerCase();
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
  ) {
    return normalized;
  }
  throw new Error('MCP_LOG_LEVEL must be one of: debug, info, warn, error');
}

export function loadConfig(): Config {
  const rpcUrl = process.env.BITBURNER_RPC_URL;
  if (!rpcUrl) {
    throw new Error('BITBURNER_RPC_URL is required');
  }

  return {
    rpcUrl,
    logLevel: parseLogLevel(process.env.MCP_LOG_LEVEL),
    fileWriteMaxBytes: parseIntEnv(
      process.env.FILE_WRITE_MAX_BYTES,
      1_000_000,
      'FILE_WRITE_MAX_BYTES',
    ),
    rpcTimeoutMs: parseIntEnv(process.env.RPC_TIMEOUT_MS, 5000, 'RPC_TIMEOUT_MS'),
    rpcReconnectBaseMs: parseIntEnv(
      process.env.RPC_RECONNECT_BASE_MS,
      250,
      'RPC_RECONNECT_BASE_MS',
    ),
    rpcReconnectMaxMs: parseIntEnv(process.env.RPC_RECONNECT_MAX_MS, 10000, 'RPC_RECONNECT_MAX_MS'),
  };
}
