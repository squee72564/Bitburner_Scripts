import { NS } from '@ns';
import { OpenOrder, Position, TradingState } from 'lib/stock/types.js';

const DEFAULT_STATE: TradingState = {
  version: 1,
  updatedAt: 0,
  strategy: {
    lastForecasts: {},
    lastPrices: {},
    cooldownTicks: {},
  },
  risk: {
    cash: 0,
    maxPerSymbol: 0,
    maxGrossExposure: 0,
    maxNetExposure: 0,
    maxPositionPercent: 0,
    minEdge: 0,
  },
  orderTracker: {},
  portfolio: {
    pnlRealized: 0,
    pnlUnrealized: 0,
    lastTick: 0,
    lastPositions: {},
    paper: {
      positions: {},
      pnlRealized: 0,
      pnlUnrealized: 0,
    },
  },
  openOrders: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOpenOrders(value: unknown): Record<string, OpenOrder[]> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, OpenOrder[]> = {};
  for (const [sym, orders] of Object.entries(value)) {
    if (Array.isArray(orders)) {
      result[sym] = orders.filter((order) => isRecord(order)) as OpenOrder[];
    }
  }
  return result;
}

function normalizePositions(value: unknown): Record<string, Position> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, Position> = {};
  for (const [sym, raw] of Object.entries(value)) {
    if (isRecord(raw)) {
      const sharesLong = typeof raw.sharesLong === 'number' ? raw.sharesLong : 0;
      const avgLongPrice = typeof raw.avgLongPrice === 'number' ? raw.avgLongPrice : 0;
      const sharesShort = typeof raw.sharesShort === 'number' ? raw.sharesShort : 0;
      const avgShortPrice = typeof raw.avgShortPrice === 'number' ? raw.avgShortPrice : 0;
      result[sym] = { sym, sharesLong, avgLongPrice, sharesShort, avgShortPrice };
    }
  }

  return result;
}

function coerceTradingState(raw: unknown, fallback: TradingState): TradingState {
  if (!isRecord(raw)) {
    return fallback;
  }

  const strategy = isRecord(raw.strategy) ? raw.strategy : {};
  const risk = isRecord(raw.risk) ? raw.risk : {};
  const orderTracker = isRecord(raw.orderTracker) ? raw.orderTracker : {};
  const portfolio = isRecord(raw.portfolio) ? raw.portfolio : {};
  const paper = isRecord(portfolio.paper) ? portfolio.paper : {};

  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : fallback.updatedAt,
    strategy: {
      lastForecasts: isRecord(strategy.lastForecasts)
        ? (strategy.lastForecasts as Record<string, number>)
        : {},
      lastPrices: isRecord(strategy.lastPrices)
        ? (strategy.lastPrices as Record<string, number>)
        : {},
      cooldownTicks: isRecord(strategy.cooldownTicks)
        ? (strategy.cooldownTicks as Record<string, number>)
        : {},
    },
    risk: {
      cash: typeof risk.cash === 'number' ? risk.cash : fallback.risk.cash,
      maxPerSymbol:
        typeof risk.maxPerSymbol === 'number' ? risk.maxPerSymbol : fallback.risk.maxPerSymbol,
      maxGrossExposure:
        typeof risk.maxGrossExposure === 'number'
          ? risk.maxGrossExposure
          : fallback.risk.maxGrossExposure,
      maxNetExposure:
        typeof risk.maxNetExposure === 'number'
          ? risk.maxNetExposure
          : fallback.risk.maxNetExposure,
      maxPositionPercent:
        typeof risk.maxPositionPercent === 'number'
          ? risk.maxPositionPercent
          : fallback.risk.maxPositionPercent,
      minEdge: typeof risk.minEdge === 'number' ? risk.minEdge : fallback.risk.minEdge,
    },
    orderTracker: isRecord(orderTracker)
      ? (orderTracker as Record<string, number>)
      : fallback.orderTracker,
    portfolio: {
      pnlRealized:
        typeof portfolio.pnlRealized === 'number'
          ? portfolio.pnlRealized
          : fallback.portfolio.pnlRealized,
      pnlUnrealized:
        typeof portfolio.pnlUnrealized === 'number'
          ? portfolio.pnlUnrealized
          : fallback.portfolio.pnlUnrealized,
      lastTick:
        typeof portfolio.lastTick === 'number' ? portfolio.lastTick : fallback.portfolio.lastTick,
      lastPositions: normalizePositions(portfolio.lastPositions),
      paper: {
        positions: normalizePositions(paper.positions),
        pnlRealized:
          typeof paper.pnlRealized === 'number'
            ? paper.pnlRealized
            : fallback.portfolio.paper.pnlRealized,
        pnlUnrealized:
          typeof paper.pnlUnrealized === 'number'
            ? paper.pnlUnrealized
            : fallback.portfolio.paper.pnlUnrealized,
      },
    },
    openOrders: normalizeOpenOrders(raw.openOrders),
  };
}

export function getDefaultTradingState(): TradingState {
  return JSON.parse(JSON.stringify(DEFAULT_STATE)) as TradingState;
}

export function loadTradingState(ns: NS, filename: string, fallback?: TradingState): TradingState {
  const seed = fallback ?? getDefaultTradingState();
  const raw = ns.read(filename);

  if (!raw) {
    return seed;
  }

  try {
    return coerceTradingState(JSON.parse(raw), seed);
  } catch {
    return seed;
  }
}

export async function saveTradingState(
  ns: NS,
  filename: string,
  state: TradingState,
): Promise<void> {
  const payload: TradingState = {
    ...state,
    version: 1,
    updatedAt: Date.now(),
  };
  await ns.write(filename, JSON.stringify(payload, null, 2), 'w');
}
