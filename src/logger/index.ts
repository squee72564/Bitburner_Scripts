import type { LogLevel } from "../config";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel) {
    this.level = level;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta, true);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>, isError = false): void {
    if (levelRank[level] < levelRank[this.level]) return;
    const payload = {
      level,
      message,
      time: new Date().toISOString(),
      ...meta,
    };
    const serialized = JSON.stringify(payload);
    // MCP stdio requires stdout be reserved for protocol; log to stderr.
    console.error(serialized);
  }
}
