import { AutocompleteData, NS } from '@ns';
import {
  buildTelemetrySnapshot,
  loadTradingState,
  saveTradingState,
  type MarketData,
  type OpenOrder,
  type OrderIntent,
  type Position,
  type TradingState,
  writeTelemetry,
} from 'lib/stock/index.js';

type AccessState = {
  hasWSE: boolean;
  hasTIX: boolean;
  has4SData: boolean;
  has4STIX: boolean;
  mode: 'basic' | 'forecast';
};

const DEFAULT_CONFIG = {
  stateFile: 'data/stock-state.json',
  telemetryFile: 'data/stock-telemetry.json',
  configFile: 'data/stock-config.json',
  dryRun: false,
  strategy: {
    minEdge: 0.1,
    cooldownTicks: 3,
    forecastThreshold: 0.6,
    stopLossPct: 0.05,
    takeProfitPct: 0.1,
    useForecast: true,
  },
  risk: {
    maxPerSymbol: 1_000_000_000,
    maxGrossExposure: 5_000_000_000,
    maxNetExposure: 2_500_000_000,
    maxPositionPercent: 0.2,
  },
  execution: {
    limitOffset: 0.01,
    stopOffset: 0.02,
    orderType: 'market' as 'market' | 'limit' | 'stop',
    cancelStaleAfterTicks: 5,
    replaceIfBetter: true,
    replacePriceDeltaPct: 0.0025,
  },
  access: {
    autoPurchaseWSE: true,
    autoPurchaseTIX: true,
    autoPurchase4SData: false,
    autoPurchase4STIX: false,
  },
};

const FLAG_SCHEMA: [string, string | number | boolean][] = [
  ['config', DEFAULT_CONFIG.configFile],
  ['state-file', DEFAULT_CONFIG.stateFile],
  ['telemetry-file', DEFAULT_CONFIG.telemetryFile],
  ['order-type', DEFAULT_CONFIG.execution.orderType],
  ['limit-offset', DEFAULT_CONFIG.execution.limitOffset],
  ['stop-offset', DEFAULT_CONFIG.execution.stopOffset],
  ['cancel-stale-after', DEFAULT_CONFIG.execution.cancelStaleAfterTicks],
  ['replace-if-better', DEFAULT_CONFIG.execution.replaceIfBetter],
  ['replace-delta-pct', DEFAULT_CONFIG.execution.replacePriceDeltaPct],
  ['min-edge', DEFAULT_CONFIG.strategy.minEdge],
  ['cooldown-ticks', DEFAULT_CONFIG.strategy.cooldownTicks],
  ['forecast-threshold', DEFAULT_CONFIG.strategy.forecastThreshold],
  ['stop-loss-pct', DEFAULT_CONFIG.strategy.stopLossPct],
  ['take-profit-pct', DEFAULT_CONFIG.strategy.takeProfitPct],
  ['use-forecast', DEFAULT_CONFIG.strategy.useForecast],
  ['max-per-symbol', DEFAULT_CONFIG.risk.maxPerSymbol],
  ['max-gross', DEFAULT_CONFIG.risk.maxGrossExposure],
  ['max-net', DEFAULT_CONFIG.risk.maxNetExposure],
  ['max-position-pct', DEFAULT_CONFIG.risk.maxPositionPercent],
  ['auto-wse', DEFAULT_CONFIG.access.autoPurchaseWSE],
  ['auto-tix', DEFAULT_CONFIG.access.autoPurchaseTIX],
  ['auto-4s-data', DEFAULT_CONFIG.access.autoPurchase4SData],
  ['auto-4s-tix', DEFAULT_CONFIG.access.autoPurchase4STIX],
  ['dry-run', DEFAULT_CONFIG.dryRun],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  killOtherInstances(ns);
  const flags = ns.flags(FLAG_SCHEMA);
  if (flags.help || flags.h) {
    ns.tprint(
      'Usage: run scripts/stock/stock-trader.js [--config data/stock-config.json] ' +
        '[--state-file data/stock-state.json] [--telemetry-file data/stock-telemetry.json] ' +
        '[--order-type market|limit|stop] [--limit-offset 0.01] [--stop-offset 0.02] ' +
        '[--cancel-stale-after 5] [--replace-if-better] [--replace-delta-pct 0.0025] ' +
        '[--min-edge 0.1] [--cooldown-ticks 3] ' +
        '[--forecast-threshold 0.6] [--stop-loss-pct 0.05] [--take-profit-pct 0.1] [--use-forecast] ' +
        '[--max-per-symbol 1e9] ' +
        '[--max-gross 5e9] [--max-net 2.5e9] [--max-position-pct 0.2] ' +
        '[--auto-wse] [--auto-tix] [--auto-4s-data] [--auto-4s-tix] [--dry-run]',
    );
    return;
  }

  const config = loadConfig(ns, flags);

  ns.disableLog('stock.getPrice');
  ns.disableLog('stock.getAskPrice');
  ns.disableLog('stock.getBidPrice');
  ns.disableLog('stock.getVolatility');
  ns.disableLog('stock.getForecast');
  ns.disableLog('stock.getPosition');
  ns.disableLog('stock.getOrders');
  ns.disableLog('sleep');

  const symbols = ns.stock.getSymbols();
  let state = loadTradingState(ns, config.stateFile);
  state = mergeConfigIntoState(state, config);
  let tick = state.portfolio.lastTick ?? 0;
  let lastPositions = Object.keys(state.portfolio.lastPositions ?? {}).length
    ? state.portfolio.lastPositions
    : refreshPositions(ns, symbols, true);
  let paperPositions = Object.keys(state.portfolio.paper.positions ?? {}).length
    ? state.portfolio.paper.positions
    : {};

  while (true) {
    await ns.stock.nextUpdate();
    tick += 1;

    const access = ensureAccess(ns, config.access, config.strategy.useForecast, config.dryRun);
    const marketData = getMarketData(
      ns,
      symbols,
      access.mode,
      tick,
      access.hasWSE || access.hasTIX,
    );
    const marketPrices = mapPrices(marketData);
    const marketMap = mapBySymbol(marketData);

    const positions = refreshPositions(ns, symbols, access.hasTIX);
    const openOrders = syncOpenOrders(ns, access.hasTIX);
    const orderTracking = cancelStaleOrders(
      ns,
      openOrders,
      state.orderTracker,
      tick,
      config,
      config.dryRun,
    );
    state.orderTracker = orderTracking.orderTracker;
    const cleanedOrders =
      orderTracking.cancelled > 0 ? syncOpenOrders(ns, access.hasTIX) : orderTracking.openOrders;
    state.portfolio.pnlRealized += calculateRealizedPnLDelta(ns, lastPositions, positions);

    const positionsForSignals = config.dryRun ? paperPositions : positions;
    const intents = computeSignals(marketData, positionsForSignals, state, access.mode, config);
    const gatedIntents = applyCooldown(intents, state, tick, config);
    const sizedIntents = sizeIntents(
      ns,
      gatedIntents,
      positionsForSignals,
      cleanedOrders,
      state,
      marketPrices,
      config,
    );

    if (config.dryRun) {
      const paperResult = applyPaperFills(paperPositions, sizedIntents, marketPrices);
      paperPositions = paperResult.positions;
      state.portfolio.paper.pnlRealized += paperResult.realizedDelta;
      state.portfolio.paper.pnlUnrealized = calculateUnrealizedPnL(paperPositions, marketPrices);
      state.portfolio.paper.positions = paperPositions;
    }

    const pnlUnrealized = calculateUnrealizedPnL(positions, marketPrices);
    state.portfolio.pnlUnrealized = pnlUnrealized;
    state.openOrders = cleanedOrders;
    state.risk.cash = ns.getServerMoneyAvailable('home');

    const { placed, rejected, replaced } = access.hasTIX
      ? placeOrders(ns, sizedIntents, marketMap, cleanedOrders, config, config.dryRun)
      : { placed: [], rejected: sizedIntents, replaced: 0 };

    if (replaced > 0) {
      state.openOrders = syncOpenOrders(ns, access.hasTIX);
    }

    updateStrategyState(state, marketData, tick, placed);
    state.portfolio.lastTick = tick;

    await saveTradingState(ns, config.stateFile, state);
    lastPositions = positions;
    state.portfolio.lastPositions = positions;

    const telemetryPositions = config.dryRun ? paperPositions : positions;
    const telemetryPnlRealized = config.dryRun
      ? state.portfolio.paper.pnlRealized
      : state.portfolio.pnlRealized;
    const telemetryPnlUnrealized = config.dryRun
      ? state.portfolio.paper.pnlUnrealized
      : state.portfolio.pnlUnrealized;

    const snapshot = buildTelemetrySnapshot({
      tick,
      mode: config.dryRun ? 'paper' : 'live',
      access: {
        hasWSE: access.hasWSE,
        hasTIX: access.hasTIX,
        has4SData: access.has4SData,
        has4STIX: access.has4STIX,
      },
      cash: state.risk.cash,
      pnl: {
        realized: telemetryPnlRealized,
        unrealized: telemetryPnlUnrealized,
      },
      positions: telemetryPositions,
      marketPrices,
      openOrders: state.openOrders,
      lastActions: {
        placed: placed.length,
        rejected: rejected.length,
        cancelled: orderTracking.cancelled,
      },
    });
    await writeTelemetry(ns, config.telemetryFile, snapshot);
  }
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(FLAG_SCHEMA);
  return [];
}

function killOtherInstances(ns: NS): void {
  const host = ns.getHostname();
  const script = ns.getScriptName();
  const currentPid = ns.getRunningScript()?.pid;
  for (const proc of ns.ps(host)) {
    if (proc.filename === script && proc.pid !== currentPid) {
      ns.kill(proc.pid);
    }
  }
}

function ensureAccess(
  ns: NS,
  config: typeof DEFAULT_CONFIG.access,
  useForecast: boolean,
  dryRun: boolean,
): AccessState {
  if (dryRun) {
    const hasWSE = ns.stock.hasWSEAccount();
    const hasTIX = ns.stock.hasTIXAPIAccess();
    const has4SData = ns.stock.has4SData();
    const has4STIX = ns.stock.has4SDataTIXAPI();
    const mode: AccessState['mode'] = useForecast && has4SData ? 'forecast' : 'basic';
    return { hasWSE, hasTIX, has4SData, has4STIX, mode };
  }

  if (config.autoPurchaseWSE && !ns.stock.hasWSEAccount()) {
    ns.stock.purchaseWseAccount();
  }
  if (config.autoPurchaseTIX && !ns.stock.hasTIXAPIAccess()) {
    ns.stock.purchaseTixApi();
  }
  if (config.autoPurchase4SData && !ns.stock.has4SData()) {
    ns.stock.purchase4SMarketData();
  }
  if (config.autoPurchase4STIX && !ns.stock.has4SDataTIXAPI()) {
    ns.stock.purchase4SMarketDataTixApi();
  }

  const hasWSE = ns.stock.hasWSEAccount();
  const hasTIX = ns.stock.hasTIXAPIAccess();
  const has4SData = ns.stock.has4SData();
  const has4STIX = ns.stock.has4SDataTIXAPI();
  const mode: AccessState['mode'] = useForecast && has4SData ? 'forecast' : 'basic';

  return { hasWSE, hasTIX, has4SData, has4STIX, mode };
}

function getMarketData(
  ns: NS,
  symbols: string[],
  mode: AccessState['mode'],
  tick: number,
  allow: boolean,
): MarketData[] {
  if (!allow) {
    return [];
  }
  try {
    return symbols.map((sym) => ({
      sym,
      price: ns.stock.getPrice(sym),
      bid: ns.stock.getBidPrice(sym),
      ask: ns.stock.getAskPrice(sym),
      volatility: ns.stock.getVolatility(sym),
      forecast: mode === 'forecast' ? ns.stock.getForecast(sym) : undefined,
      tick,
    }));
  } catch (error) {
    ns.print(`WARN unable to read stock market data: ${String(error)}`);
    return [];
  }
}

function refreshPositions(ns: NS, symbols: string[], allow: boolean): Record<string, Position> {
  const positions: Record<string, Position> = {};
  if (!allow) {
    return positions;
  }
  try {
    for (const sym of symbols) {
      const [sharesLong, avgLongPrice, sharesShort, avgShortPrice] = ns.stock.getPosition(sym);
      positions[sym] = { sym, sharesLong, avgLongPrice, sharesShort, avgShortPrice };
    }
  } catch (error) {
    ns.print(`WARN unable to read positions: ${String(error)}`);
  }
  return positions;
}

function syncOpenOrders(ns: NS, allow: boolean): Record<string, OpenOrder[]> {
  if (!allow) {
    return {};
  }
  let orders: ReturnType<NS['stock']['getOrders']>;
  try {
    orders = ns.stock.getOrders();
  } catch (error) {
    ns.print(`WARN unable to read open orders: ${String(error)}`);
    return {};
  }
  const result: Record<string, OpenOrder[]> = {};

  for (const [sym, entries] of Object.entries(orders)) {
    result[sym] = entries.map((entry) => ({
      sym,
      type: entry.type,
      position: entry.position === 'L' ? 'Long' : 'Short',
      shares: entry.shares,
      price: entry.price,
    }));
  }

  return result;
}

function computeSignals(
  marketData: MarketData[],
  positions: Record<string, Position>,
  state: TradingState,
  mode: AccessState['mode'],
  config: typeof DEFAULT_CONFIG,
): OrderIntent[] {
  const intents: OrderIntent[] = [];
  for (const md of marketData) {
    const hasForecast =
      md.forecast !== undefined && config.strategy.useForecast && mode === 'forecast';
    const edge = hasForecast ? md.forecast! - 0.5 : 0;
    const position = positions[md.sym];
    const hasLong = position ? position.sharesLong > 0 : false;
    const hasShort = position ? position.sharesShort > 0 : false;
    const stopLoss = config.strategy.stopLossPct;
    const takeProfit = config.strategy.takeProfitPct;

    if (hasForecast && hasLong && md.forecast! <= 1 - config.strategy.forecastThreshold) {
      intents.push({
        sym: md.sym,
        side: 'sell',
        position: 'long',
        shares: 0,
        orderType: 'market',
        reason: 'forecast-exit-long',
      });
      continue;
    }

    if (hasLong && (stopLoss > 0 || takeProfit > 0)) {
      const pnlPct = (md.price - position.avgLongPrice) / Math.max(0.01, position.avgLongPrice);
      if ((stopLoss > 0 && pnlPct <= -stopLoss) || (takeProfit > 0 && pnlPct >= takeProfit)) {
        intents.push({
          sym: md.sym,
          side: 'sell',
          position: 'long',
          shares: 0,
          orderType: 'market',
          reason: pnlPct <= -stopLoss ? 'stop-loss-long' : 'take-profit-long',
        });
        continue;
      }
    }

    if (hasForecast && hasShort && md.forecast! >= config.strategy.forecastThreshold) {
      intents.push({
        sym: md.sym,
        side: 'sell',
        position: 'short',
        shares: 0,
        orderType: 'market',
        reason: 'forecast-exit-short',
      });
      continue;
    }

    if (hasShort && (stopLoss > 0 || takeProfit > 0)) {
      const pnlPct = (position.avgShortPrice - md.price) / Math.max(0.01, position.avgShortPrice);
      if ((stopLoss > 0 && pnlPct <= -stopLoss) || (takeProfit > 0 && pnlPct >= takeProfit)) {
        intents.push({
          sym: md.sym,
          side: 'sell',
          position: 'short',
          shares: 0,
          orderType: 'market',
          reason: pnlPct <= -stopLoss ? 'stop-loss-short' : 'take-profit-short',
        });
        continue;
      }
    }

    if (
      hasForecast &&
      edge >= config.strategy.minEdge &&
      md.forecast! >= config.strategy.forecastThreshold
    ) {
      intents.push({
        sym: md.sym,
        side: 'buy',
        position: 'long',
        shares: 0,
        orderType: 'market',
        reason: 'forecast-long',
      });
    } else if (
      hasForecast &&
      -edge >= config.strategy.minEdge &&
      md.forecast! <= 1 - config.strategy.forecastThreshold
    ) {
      intents.push({
        sym: md.sym,
        side: 'buy',
        position: 'short',
        shares: 0,
        orderType: 'market',
        reason: 'forecast-short',
      });
    }
  }

  return intents;
}

function applyCooldown(
  intents: OrderIntent[],
  state: TradingState,
  tick: number,
  config: typeof DEFAULT_CONFIG,
): OrderIntent[] {
  return intents.filter((intent) => {
    const lastTick = state.strategy.cooldownTicks[intent.sym] ?? 0;
    return tick - lastTick >= config.strategy.cooldownTicks;
  });
}

function sizeIntents(
  ns: NS,
  intents: OrderIntent[],
  positions: Record<string, Position>,
  openOrders: Record<string, OpenOrder[]>,
  state: TradingState,
  marketPrices: Record<string, number>,
  config: typeof DEFAULT_CONFIG,
): OrderIntent[] {
  const sized: OrderIntent[] = [];
  const budgetCap = Math.min(
    config.risk.maxPerSymbol,
    config.risk.maxPositionPercent * state.risk.cash,
  );
  const exposure = calculateExposure(positions, openOrders, marketPrices);

  for (const intent of intents) {
    const price = marketPrices[intent.sym] ?? 0;
    if (price <= 0) {
      continue;
    }

    const position = positions[intent.sym];
    const currentLong = position ? position.sharesLong : 0;
    const currentShort = position ? position.sharesShort : 0;
    const pending = getPendingShares(openOrders[intent.sym] ?? []);
    const pendingLong = pending.long;
    const pendingShort = pending.short;
    const maxShares = ns.stock.getMaxShares(intent.sym);
    const targetShares = Math.floor(budgetCap / price);
    let desiredShares = 0;

    if (intent.side === 'sell') {
      desiredShares = intent.position === 'long' ? currentLong : currentShort;
    } else if (intent.position === 'long') {
      desiredShares = Math.max(0, targetShares - currentLong - pendingLong);
    } else {
      desiredShares = Math.max(0, targetShares - currentShort - pendingShort);
    }

    let boundedShares = Math.max(0, Math.min(desiredShares, maxShares));
    if (boundedShares === 0) {
      continue;
    }

    if (intent.side === 'buy') {
      const grossRemaining = config.risk.maxGrossExposure - exposure.gross;
      const netRemaining = config.risk.maxNetExposure - exposure.net;
      const netRemainingShort = config.risk.maxNetExposure + exposure.net;
      const grossCapShares = Math.floor(grossRemaining / price);

      let netCapShares = Infinity;
      if (intent.position === 'long') {
        netCapShares = Math.floor(netRemaining / price);
      } else {
        netCapShares = Math.floor(netRemainingShort / price);
      }

      const capped = Math.max(0, Math.min(boundedShares, grossCapShares, netCapShares));
      boundedShares = capped;
    }

    if (boundedShares > 0) {
      sized.push({ ...intent, shares: boundedShares });
      if (intent.side === 'buy') {
        const delta = boundedShares * price;
        exposure.gross += delta;
        exposure.net += intent.position === 'long' ? delta : -delta;
      }
    }
  }

  return sized;
}

function placeOrders(
  ns: NS,
  intents: OrderIntent[],
  marketMap: Record<string, MarketData>,
  openOrders: Record<string, OpenOrder[]>,
  config: typeof DEFAULT_CONFIG,
  dryRun: boolean,
): { placed: OrderIntent[]; rejected: OrderIntent[]; replaced: number } {
  const placed: OrderIntent[] = [];
  const rejected: OrderIntent[] = [];
  let replaced = 0;

  for (const intent of intents) {
    const orderType = intent.orderType === 'market' ? config.execution.orderType : intent.orderType;

    if (orderType === 'market') {
      const price = dryRun ? 1 : executeMarketOrder(ns, intent);
      if (price > 0) {
        placed.push(intent);
      } else {
        rejected.push(intent);
      }
      continue;
    }

    const market = marketMap[intent.sym];
    if (!market) {
      rejected.push(intent);
      continue;
    }

    const orderSpec = buildOrderSpec(intent, market, orderType, config);
    const existing = findMatchingOrder(openOrders, intent.sym, orderSpec.type, orderSpec.pos);
    if (existing && !shouldReplaceOrder(existing, orderSpec.price, config)) {
      rejected.push(intent);
      continue;
    }
    if (existing) {
      const ok = replaceOrder(
        ns,
        intent.sym,
        existing,
        orderSpec.price,
        orderSpec.type,
        orderSpec.pos,
        intent.shares,
        dryRun,
      );
      if (ok) {
        replaced += 1;
        placed.push(intent);
      } else {
        rejected.push(intent);
      }
      continue;
    }
    const ok = dryRun
      ? true
      : ns.stock.placeOrder(
          intent.sym,
          intent.shares,
          orderSpec.price,
          orderSpec.type,
          orderSpec.pos,
        );
    if (ok) {
      placed.push(intent);
    } else {
      rejected.push(intent);
    }
  }

  return { placed, rejected, replaced };
}

function updateStrategyState(
  state: TradingState,
  marketData: MarketData[],
  tick: number,
  placed: OrderIntent[],
): void {
  for (const md of marketData) {
    if (md.forecast !== undefined) {
      state.strategy.lastForecasts[md.sym] = md.forecast;
    }
    state.strategy.lastPrices[md.sym] = md.price;
  }

  for (const intent of placed) {
    state.strategy.cooldownTicks[intent.sym] = tick;
  }
}

function calculateUnrealizedPnL(
  positions: Record<string, Position>,
  marketPrices: Record<string, number>,
): number {
  let pnl = 0;
  for (const position of Object.values(positions)) {
    const price = marketPrices[position.sym] ?? 0;
    if (position.sharesLong > 0) {
      pnl += (price - position.avgLongPrice) * position.sharesLong;
    }
    if (position.sharesShort > 0) {
      pnl += (position.avgShortPrice - price) * position.sharesShort;
    }
  }
  return pnl;
}

function calculateExposure(
  positions: Record<string, Position>,
  openOrders: Record<string, OpenOrder[]>,
  marketPrices: Record<string, number>,
): { gross: number; net: number } {
  let gross = 0;
  let net = 0;
  for (const position of Object.values(positions)) {
    const price = marketPrices[position.sym] ?? 0;
    const longValue = price * position.sharesLong;
    const shortValue = price * position.sharesShort;
    gross += longValue + shortValue;
    net += longValue - shortValue;
  }

  for (const [sym, orders] of Object.entries(openOrders)) {
    const price = marketPrices[sym] ?? 0;
    if (price <= 0) {
      continue;
    }
    const pending = getPendingShares(orders);
    const longValue = price * pending.long;
    const shortValue = price * pending.short;
    gross += longValue + shortValue;
    net += longValue - shortValue;
  }
  return { gross, net };
}

function calculateRealizedPnLDelta(
  ns: NS,
  previous: Record<string, Position>,
  current: Record<string, Position>,
): number {
  let realized = 0;
  const symbols = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const sym of symbols) {
    const prev = previous[sym] ?? {
      sym,
      sharesLong: 0,
      avgLongPrice: 0,
      sharesShort: 0,
      avgShortPrice: 0,
    };
    const curr = current[sym] ?? {
      sym,
      sharesLong: 0,
      avgLongPrice: 0,
      sharesShort: 0,
      avgShortPrice: 0,
    };

    const soldLong = prev.sharesLong - curr.sharesLong;
    if (soldLong > 0) {
      realized += ns.stock.getSaleGain(sym, soldLong, 'Long');
    }

    const coveredShort = prev.sharesShort - curr.sharesShort;
    if (coveredShort > 0) {
      realized += ns.stock.getSaleGain(sym, coveredShort, 'Short');
    }
  }

  return realized;
}

function applyPaperFills(
  positions: Record<string, Position>,
  intents: OrderIntent[],
  marketPrices: Record<string, number>,
): { positions: Record<string, Position>; realizedDelta: number } {
  let realizedDelta = 0;
  const next: Record<string, Position> = { ...positions };

  for (const intent of intents) {
    const price = marketPrices[intent.sym] ?? 0;
    if (price <= 0 || intent.shares <= 0) {
      continue;
    }

    const current = next[intent.sym] ?? {
      sym: intent.sym,
      sharesLong: 0,
      avgLongPrice: 0,
      sharesShort: 0,
      avgShortPrice: 0,
    };

    if (intent.side === 'buy' && intent.position === 'long') {
      const totalShares = current.sharesLong + intent.shares;
      const totalCost = current.avgLongPrice * current.sharesLong + price * intent.shares;
      current.sharesLong = totalShares;
      current.avgLongPrice = totalShares > 0 ? totalCost / totalShares : 0;
    } else if (intent.side === 'sell' && intent.position === 'long') {
      const sharesSold = Math.min(current.sharesLong, intent.shares);
      realizedDelta += (price - current.avgLongPrice) * sharesSold;
      current.sharesLong -= sharesSold;
      if (current.sharesLong <= 0) {
        current.sharesLong = 0;
        current.avgLongPrice = 0;
      }
    } else if (intent.side === 'buy' && intent.position === 'short') {
      const totalShares = current.sharesShort + intent.shares;
      const totalCost = current.avgShortPrice * current.sharesShort + price * intent.shares;
      current.sharesShort = totalShares;
      current.avgShortPrice = totalShares > 0 ? totalCost / totalShares : 0;
    } else if (intent.side === 'sell' && intent.position === 'short') {
      const sharesCovered = Math.min(current.sharesShort, intent.shares);
      realizedDelta += (current.avgShortPrice - price) * sharesCovered;
      current.sharesShort -= sharesCovered;
      if (current.sharesShort <= 0) {
        current.sharesShort = 0;
        current.avgShortPrice = 0;
      }
    }

    next[intent.sym] = current;
  }

  return { positions: next, realizedDelta };
}

function mapPrices(marketData: MarketData[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const md of marketData) {
    map[md.sym] = md.price;
  }
  return map;
}

function mapBySymbol(marketData: MarketData[]): Record<string, MarketData> {
  const map: Record<string, MarketData> = {};
  for (const md of marketData) {
    map[md.sym] = md;
  }
  return map;
}

function mergeConfigIntoState(state: TradingState, config: typeof DEFAULT_CONFIG): TradingState {
  return {
    ...state,
    risk: {
      ...state.risk,
      maxPerSymbol: config.risk.maxPerSymbol,
      maxGrossExposure: config.risk.maxGrossExposure,
      maxNetExposure: config.risk.maxNetExposure,
      maxPositionPercent: config.risk.maxPositionPercent,
      minEdge: config.strategy.minEdge,
    },
  };
}

function executeMarketOrder(ns: NS, intent: OrderIntent): number {
  if (intent.position === 'long' && intent.side === 'buy') {
    return ns.stock.buyStock(intent.sym, intent.shares);
  }
  if (intent.position === 'long' && intent.side === 'sell') {
    return ns.stock.sellStock(intent.sym, intent.shares);
  }
  if (intent.position === 'short' && intent.side === 'buy') {
    return ns.stock.buyShort(intent.sym, intent.shares);
  }
  if (intent.position === 'short' && intent.side === 'sell') {
    return ns.stock.sellShort(intent.sym, intent.shares);
  }
  return 0;
}

function buildOrderSpec(
  intent: OrderIntent,
  market: MarketData,
  orderType: 'limit' | 'stop',
  config: typeof DEFAULT_CONFIG,
): { price: number; type: string; pos: string } {
  const pos = intent.position === 'long' ? 'Long' : 'Short';
  const isBuy = intent.side === 'buy';
  const base = isBuy ? market.ask : market.bid;
  const offset = orderType === 'limit' ? config.execution.limitOffset : config.execution.stopOffset;
  const direction = orderType === 'limit' ? -1 : 1;
  const price = Math.max(0.01, base * (1 + direction * offset * (isBuy ? 1 : -1)));

  const type =
    orderType === 'limit'
      ? isBuy
        ? 'Limit Buy Order'
        : 'Limit Sell Order'
      : isBuy
        ? 'Stop Buy Order'
        : 'Stop Sell Order';

  return { price, type, pos };
}

function findMatchingOrder(
  openOrders: Record<string, OpenOrder[]>,
  sym: string,
  type: string,
  pos: string,
): OpenOrder | null {
  const entries = openOrders[sym];
  if (!entries || entries.length === 0) {
    return null;
  }
  return entries.find((entry) => entry.type === type && entry.position === pos) ?? null;
}

function shouldReplaceOrder(
  existing: OpenOrder,
  nextPrice: number,
  config: typeof DEFAULT_CONFIG,
): boolean {
  if (!config.execution.replaceIfBetter) {
    return false;
  }
  if (existing.price <= 0) {
    return true;
  }
  const deltaPct = Math.abs(nextPrice - existing.price) / existing.price;
  return deltaPct >= config.execution.replacePriceDeltaPct;
}

function replaceOrder(
  ns: NS,
  sym: string,
  existing: OpenOrder,
  nextPrice: number,
  nextType: string,
  nextPos: string,
  nextShares: number,
  dryRun: boolean,
): boolean {
  if (dryRun) {
    return true;
  }

  ns.stock.cancelOrder(sym, existing.shares, existing.price, existing.type, existing.position);
  const placed = ns.stock.placeOrder(sym, nextShares, nextPrice, nextType, nextPos);
  if (placed) {
    return true;
  }
  ns.stock.placeOrder(sym, existing.shares, existing.price, existing.type, existing.position);
  return false;
}

function getPendingShares(orders: OpenOrder[]): { long: number; short: number } {
  let long = 0;
  let short = 0;
  for (const order of orders) {
    if (order.position === 'Long') {
      long += order.shares;
    } else if (order.position === 'Short') {
      short += order.shares;
    }
  }
  return { long, short };
}

function cancelStaleOrders(
  ns: NS,
  openOrders: Record<string, OpenOrder[]>,
  orderTracker: Record<string, number>,
  tick: number,
  config: typeof DEFAULT_CONFIG,
  dryRun: boolean,
): {
  openOrders: Record<string, OpenOrder[]>;
  orderTracker: Record<string, number>;
  cancelled: number;
} {
  const limit = config.execution.cancelStaleAfterTicks;
  if (limit <= 0) {
    return { openOrders, orderTracker, cancelled: 0 };
  }

  const nextTracker: Record<string, number> = { ...orderTracker };
  const currentKeys = new Set<string>();
  for (const entries of Object.values(openOrders)) {
    for (const entry of entries) {
      const key = makeOrderKey(entry);
      currentKeys.add(key);
      if (nextTracker[key] === undefined) {
        nextTracker[key] = tick;
      }
    }
  }

  for (const key of Object.keys(nextTracker)) {
    if (!currentKeys.has(key)) {
      delete nextTracker[key];
    }
  }

  let cancelled = 0;
  let cleanedOrders = openOrders;
  for (const key of currentKeys) {
    const firstSeen = nextTracker[key];
    if (firstSeen === undefined || tick - firstSeen < limit) {
      continue;
    }
    const parsed = parseOrderKey(key);
    if (!parsed) {
      delete nextTracker[key];
      continue;
    }
    if (!dryRun) {
      ns.stock.cancelOrder(parsed.sym, parsed.shares, parsed.price, parsed.type, parsed.pos);
    }
    cancelled += 1;
    delete nextTracker[key];
    cleanedOrders = removeOrder(cleanedOrders, parsed);
  }

  return { openOrders: cleanedOrders, orderTracker: nextTracker, cancelled };
}

function makeOrderKey(order: OpenOrder): string {
  return `${order.sym}|${order.type}|${order.position}|${order.price}|${order.shares}`;
}

function parseOrderKey(
  key: string,
): { sym: string; type: string; pos: string; price: number; shares: number } | null {
  const parts = key.split('|');
  if (parts.length !== 5) {
    return null;
  }
  const [sym, type, pos, priceRaw, sharesRaw] = parts;
  const price = Number(priceRaw);
  const shares = Number(sharesRaw);
  if (!Number.isFinite(price) || !Number.isFinite(shares)) {
    return null;
  }
  return { sym, type, pos, price, shares };
}

function removeOrder(
  openOrders: Record<string, OpenOrder[]>,
  target: { sym: string; type: string; pos: string; price: number; shares: number },
): Record<string, OpenOrder[]> {
  const entries = openOrders[target.sym];
  if (!entries || entries.length === 0) {
    return openOrders;
  }

  const filtered = entries.filter(
    (entry) =>
      !(
        entry.type === target.type &&
        entry.position === target.pos &&
        entry.price === target.price &&
        entry.shares === target.shares
      ),
  );

  if (filtered.length === entries.length) {
    return openOrders;
  }

  return {
    ...openOrders,
    [target.sym]: filtered,
  };
}

function loadConfig(ns: NS, flags: Record<string, unknown>): typeof DEFAULT_CONFIG {
  const configFile = String(flags.config || DEFAULT_CONFIG.configFile);
  const fileConfig = readJsonConfig(ns, configFile);
  const merged = mergeDeep(DEFAULT_CONFIG, fileConfig ?? {});

  const orderType = normalizeOrderType(String(flags['order-type'] ?? merged.execution.orderType));
  return {
    ...merged,
    stateFile: String(flags['state-file'] ?? merged.stateFile),
    telemetryFile: String(flags['telemetry-file'] ?? merged.telemetryFile),
    configFile,
    strategy: {
      ...merged.strategy,
      minEdge: toNumber(flags['min-edge'], merged.strategy.minEdge),
      cooldownTicks: toNumber(flags['cooldown-ticks'], merged.strategy.cooldownTicks),
      forecastThreshold: clamp01(
        toNumber(flags['forecast-threshold'], merged.strategy.forecastThreshold),
      ),
      stopLossPct: clamp01(toNumber(flags['stop-loss-pct'], merged.strategy.stopLossPct)),
      takeProfitPct: clamp01(toNumber(flags['take-profit-pct'], merged.strategy.takeProfitPct)),
      useForecast: toBoolean(flags['use-forecast'], merged.strategy.useForecast),
    },
    risk: {
      ...merged.risk,
      maxPerSymbol: toNumber(flags['max-per-symbol'], merged.risk.maxPerSymbol),
      maxGrossExposure: toNumber(flags['max-gross'], merged.risk.maxGrossExposure),
      maxNetExposure: toNumber(flags['max-net'], merged.risk.maxNetExposure),
      maxPositionPercent: clamp01(
        toNumber(flags['max-position-pct'], merged.risk.maxPositionPercent),
      ),
    },
    execution: {
      ...merged.execution,
      orderType,
      limitOffset: clamp01(toNumber(flags['limit-offset'], merged.execution.limitOffset)),
      stopOffset: clamp01(toNumber(flags['stop-offset'], merged.execution.stopOffset)),
      cancelStaleAfterTicks: Math.max(
        0,
        toNumber(flags['cancel-stale-after'], merged.execution.cancelStaleAfterTicks),
      ),
      replaceIfBetter: toBoolean(flags['replace-if-better'], merged.execution.replaceIfBetter),
      replacePriceDeltaPct: clamp01(
        toNumber(flags['replace-delta-pct'], merged.execution.replacePriceDeltaPct),
      ),
    },
    access: {
      ...merged.access,
      autoPurchaseWSE: toBoolean(flags['auto-wse'], merged.access.autoPurchaseWSE),
      autoPurchaseTIX: toBoolean(flags['auto-tix'], merged.access.autoPurchaseTIX),
      autoPurchase4SData: toBoolean(flags['auto-4s-data'], merged.access.autoPurchase4SData),
      autoPurchase4STIX: toBoolean(flags['auto-4s-tix'], merged.access.autoPurchase4STIX),
    },
    dryRun: toBoolean(flags['dry-run'], merged.dryRun),
  };
}

function readJsonConfig(ns: NS, filename: string): Record<string, unknown> | null {
  const raw = ns.read(filename);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    ns.print(`WARN invalid config JSON at ${filename}; using defaults.`);
    return null;
  }
}

function mergeDeep<T>(base: T, override: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const baseValue = result[key];
      if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        result[key] = mergeDeep(
          baseValue as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeOrderType(value: string): 'market' | 'limit' | 'stop' {
  if (value === 'limit' || value === 'stop') {
    return value;
  }
  return 'market';
}
