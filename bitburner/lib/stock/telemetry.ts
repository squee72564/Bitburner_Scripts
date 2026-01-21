import { NS } from '@ns';
import { writeResult } from 'lib/write-result.js';
import { OpenOrder, Position, TelemetrySnapshot } from 'lib/stock/types.js';

type AccessState = TelemetrySnapshot['access'];
type PnlState = TelemetrySnapshot['pnl'];
type LastActions = TelemetrySnapshot['lastActions'];

export function buildTelemetrySnapshot(options: {
  tick: number;
  mode: TelemetrySnapshot['mode'];
  access: AccessState;
  cash: number;
  pnl: PnlState;
  positions: Record<string, Position>;
  marketPrices: Record<string, number>;
  openOrders: Record<string, OpenOrder[]>;
  lastActions: LastActions;
  timestamp?: number;
}): TelemetrySnapshot {
  const positions = Object.values(options.positions)
    .map((position) => ({
      sym: position.sym,
      sharesLong: position.sharesLong,
      avgLongPrice: position.avgLongPrice,
      sharesShort: position.sharesShort,
      avgShortPrice: position.avgShortPrice,
      marketPrice: options.marketPrices[position.sym] ?? 0,
    }))
    .sort((a, b) => a.sym.localeCompare(b.sym));

  return {
    timestamp: options.timestamp ?? Date.now(),
    tick: options.tick,
    mode: options.mode,
    access: options.access,
    cash: options.cash,
    pnl: options.pnl,
    positions,
    openOrders: options.openOrders,
    lastActions: options.lastActions,
  };
}

export async function writeTelemetry(
  ns: NS,
  filename: string,
  snapshot: TelemetrySnapshot,
): Promise<void> {
  await writeResult(ns, filename, snapshot);
}
