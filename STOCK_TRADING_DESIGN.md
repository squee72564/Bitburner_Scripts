# Bitburner Stock Trading Automation - Spec & Design

## Purpose
Design a robust, real-time stock trading automation system for Bitburner’s TIX API. This document is intended to be a full blueprint for implementation.

## Goals
- Provide a clean architecture that separates concerns (data, signals, risk, execution, persistence).
- Be resilient across restarts and transient failures.
- Be extensible for multiple strategies and risk policies.
- Align behavior to Bitburner’s tick-based market updates.

## Non-goals
- A turnkey “best strategy” that works optimally in all contexts.
- A full historical backtesting engine.
- A UI or dashboard (though it can be added later).

## Assumptions & Premises
- The trading loop should synchronize to stock update ticks via `ns.stock.nextUpdate()`.
- The TIX API is the source of truth for market and position state.
- Forecast data is only available with 4S data access, and the system must degrade gracefully when not available.
- Limit/stop orders are only available after unlocking their in-game capability.
- The system operates in a single script process at a time (no parallel competing traders).
- Script restarts are expected; persistence must handle partial or stale state.
- All monetary values are in Bitburner dollars (numbers).
- The system will run on a player’s home server (or another stable host with enough RAM).
- Configuration can come from defaults, a JSON file, and CLI flags; overrides must be deterministic.
- Stop-loss/take-profit are evaluated against average entry price from `getPosition`.
- Exposure caps account for both live positions and pending open orders.

## Core API Surface (TIX Namespace)
Data and access:
- `getSymbols()`, `getPrice(sym)`, `getAskPrice(sym)`, `getBidPrice(sym)`, `getVolatility(sym)`
- `getForecast(sym)` (requires 4S data)
- `getConstants()`, `getBonusTime()`, `nextUpdate()`
- `hasWSEAccount()`, `hasTIXAPIAccess()`, `has4SData()`, `has4SDataTIXAPI()`
- `purchaseWseAccount()`, `purchaseTixApi()`, `purchase4SMarketData()`, `purchase4SMarketDataTixApi()`

Trading and orders:
- `buyStock`, `sellStock`, `buyShort`, `sellShort`
- `placeOrder`, `cancelOrder`, `getOrders()`
- `getPosition(sym)`, `getMaxShares(sym)`
- `getPurchaseCost`, `getSaleGain`

### API Notes
- `placeOrder` only supports Limit and Stop orders and returns `boolean` for placement success.
- Market order functions return the executed price or `0` if not executed.

### TIX API Coverage (Current Usage)
Used by implementation:
- `getSymbols`, `getPrice`, `getAskPrice`, `getBidPrice`, `getVolatility`, `getForecast`
- `getPosition`, `getMaxShares`, `getOrders`, `placeOrder`, `cancelOrder`
- `buyStock`, `sellStock`, `buyShort`, `sellShort`
- `getSaleGain`, `nextUpdate`
- `hasWSEAccount`, `hasTIXAPIAccess`, `has4SData`, `has4SDataTIXAPI`
- `purchaseWseAccount`, `purchaseTixApi`, `purchase4SMarketData`, `purchase4SMarketDataTixApi`

Not currently used (available for future extensions):
- `getBonusTime`, `getConstants`, `getOrganization`, `getPurchaseCost`

## System Architecture

### Modules
1) **AccessGate**
- Verifies access permissions and optionally purchases access.
- Determines whether the system can use forecast data.

2) **MarketDataFeed**
- Builds a per-symbol `MarketData` snapshot each tick.
- Tracks tick index and timing metadata.

3) **SignalEngine**
- Generates trade intents based on `MarketData` and `StrategyState`.
- Supports multiple strategy types (forecast edge, momentum, mean reversion).

4) **RiskEngine**
- Accepts raw intents and sizes or rejects them based on `RiskState` and portfolio exposure.

5) **OrderManager**
- Executes market orders or submits limit/stop orders.
- Tracks and reconciles open orders with `getOrders()`.

6) **PortfolioTracker**
- Pulls positions from `getPosition(sym)`.
- Calculates unrealized P&L from `getPrice` and realized P&L from fills.

7) **Persistence**
- Loads and saves `TradingState` to disk.
- Normalizes partial or corrupted state.

8) **Telemetry Reporter**
- Writes per-tick snapshots to a JSON file for external UI consumption.

### Data Flow (Tick Loop)
1. Await `ns.stock.nextUpdate()`
2. Load `TradingState` (or keep in-memory state if already loaded)
3. AccessGate checks access and upgrade state if configured
4. MarketDataFeed builds snapshot for all symbols
5. PortfolioTracker refreshes positions and open orders
6. OrderManager cancels stale orders and refreshes `openOrders`
7. SignalEngine emits `OrderIntent[]` (entries + exits)
8. RiskEngine sizes/rejects intents with exposure caps
9. OrderManager places orders
10. Update `TradingState` (strategy, portfolio, openOrders, orderTracker, lastPositions)
11. Persist `TradingState`
12. Write telemetry snapshot

## Data Structures (Types)
Defined in `bitburner/lib/stock/types.ts`.

### MarketData
```
{ sym, price, bid, ask, volatility, forecast?, tick }
```

### Position
```
{ sym, sharesLong, avgLongPrice, sharesShort, avgShortPrice }
```

### OrderIntent
```
{ sym, side, position, shares, orderType, price?, reason }
```

### OpenOrder
```
{ sym, type, position, shares, price }
```

### RiskState
```
{ cash, maxPerSymbol, maxGrossExposure, maxNetExposure, maxPositionPercent, minEdge }
```

### PortfolioState
```
{ positions, openOrders, pnlRealized, pnlUnrealized }
```

### StrategyState
```
{ lastForecasts, lastPrices, cooldownTicks }
```

### TradingState
```
{
  version, updatedAt,
  strategy, risk,
  orderTracker, // order key -> first seen tick
  portfolio: { pnlRealized, pnlUnrealized, lastTick, lastPositions },
  openOrders
}
```

### TelemetrySnapshot
```
{
  timestamp, tick, access, cash,
  pnl: { realized, unrealized },
  positions: [ { sym, sharesLong, avgLongPrice, sharesShort, avgShortPrice, marketPrice } ],
  openOrders,
  lastActions: { placed, rejected, cancelled }
}
```

## Persistence Layer
Implemented in `bitburner/lib/stock/persistence.ts`.

### Public API
- `getDefaultTradingState()`
- `loadTradingState(ns, filename, fallback?)`
- `saveTradingState(ns, filename, state)`

### Persistence Rules
- Persist strategy, risk, order tracking, P&L summary, and last positions snapshot.
- Positions are always re-derived from TIX each tick.
- Always overwrite `updatedAt` on save.
- If persisted state is invalid, fall back to defaults.

## Interfaces & API Surfaces (Implementation Spec)

### AccessGate Interface
```
checkAccess(ns) -> {
  hasWSE: boolean,
  hasTIX: boolean,
  has4SData: boolean,
  has4STIX: boolean
}

ensureAccess(ns, config) -> {
  hasWSE, hasTIX, has4SData, has4STIX,
  mode: 'basic' | 'forecast'
}
```

### MarketDataFeed Interface
```
getMarketData(ns, symbols, accessMode, tick) -> MarketData[]
```

### SignalEngine Interface
```
computeSignals(marketData, positions, strategyState, config) -> OrderIntent[]
```

### RiskEngine Interface
```
sizeIntents(intents, positions, openOrders, riskState, marketDataMap) -> OrderIntent[]
```

### OrderManager Interface
```
placeOrders(ns, intents, openOrders) -> {
  placed: OrderIntent[],
  rejected: OrderIntent[]
}

syncOpenOrders(ns) -> Record<sym, OpenOrder[]>

cancelStaleOrders(ns, openOrders, orderTracker, tick, config) -> {
  openOrders,
  orderTracker,
  cancelled
}
```

### PortfolioTracker Interface
```
refreshPositions(ns, symbols) -> Record<sym, Position>

calculatePnL(positions, marketDataMap) -> {
  pnlUnrealized: number,
  pnlRealized: number
}

calculateRealizedPnLDelta(prevPositions, currentPositions) -> number
```

### Persistence Interface
```
loadTradingState(ns, filename, fallback?) -> TradingState
saveTradingState(ns, filename, state) -> void
```

### Telemetry Output Interface
```
buildTelemetrySnapshot(...) -> TelemetrySnapshot
writeTelemetry(ns, filename, snapshot) -> void
```

## Configuration Surface
Suggested config object (can be a JSON file or script constants):

```
{
  stateFile: 'data/stock-state.json',
  telemetryFile: 'data/stock-telemetry.json',
  configFile: 'data/stock-config.json',
  strategy: {
    minEdge: 0.1,
    cooldownTicks: 3,
    forecastThreshold: 0.6,
    stopLossPct: 0.05,
    takeProfitPct: 0.1,
    useForecast: true
  },
  risk: {
    maxPerSymbol: 1_000_000_000,
    maxGrossExposure: 5_000_000_000,
    maxNetExposure: 2_500_000_000,
    maxPositionPercent: 0.2
  },
  execution: {
    orderType: 'market', // market | limit | stop
    limitOffset: 0.01,
    stopOffset: 0.02,
    cancelStaleAfterTicks: 5
  },
  access: {
    autoPurchaseWSE: true,
    autoPurchaseTIX: true,
    autoPurchase4SData: false,
    autoPurchase4STIX: false
  }
}
```

### Config Resolution Order
1. Defaults in code.
2. JSON config file (`--config`).
3. CLI flags (highest priority).

### CLI Flags
- `--config <file>`: JSON config file path (default `data/stock-config.json`)
- `--state-file <file>`: state persistence file
- `--telemetry-file <file>`: telemetry output file
- `--order-type <market|limit|stop>`
- `--limit-offset <number>`
- `--stop-offset <number>`
- `--cancel-stale-after <ticks>`
- `--min-edge <number>`
- `--cooldown-ticks <number>`
- `--forecast-threshold <number>`
- `--stop-loss-pct <number>`
- `--take-profit-pct <number>`
- `--use-forecast` (boolean)
- `--max-per-symbol <number>`
- `--max-gross <number>`
- `--max-net <number>`
- `--max-position-pct <number>`
- `--auto-wse` (boolean)
- `--auto-tix` (boolean)
- `--auto-4s-data` (boolean)
- `--auto-4s-tix` (boolean)
- `--help` / `--h`

## Error Handling & Recovery
- If a market order returns `0`, treat as failed and do not assume fill.
- If `placeOrder` returns false, treat as rejected and do not assume it entered the book.
- Reconcile `openOrders` each tick using `getOrders()`.
- If local open orders exist but `getOrders()` returns none, clear local entries.
- After cancelling stale orders, refresh `openOrders` from the API to ensure accuracy.
- If persistence file is corrupted, fall back to defaults and continue.
- If 4S access is missing, disable forecast-based signals.
- If telemetry write fails, log and continue (telemetry must not break trading).

## Pseudocode (End-to-End Trading Loop)

```
init:
  config = loadConfig(flags, json)
  state = loadTradingState(ns, config.stateFile)
  symbols = ns.stock.getSymbols()
  tick = 0
  lastPositions = state.portfolio.lastPositions ?? refreshPositions(ns, symbols)

loop:
  await ns.stock.nextUpdate()
  tick += 1

  access = ensureAccess(ns, config.access)

  marketData = getMarketData(ns, symbols, access.mode, tick)
  marketMap = mapBySymbol(marketData)

  positions = refreshPositions(ns, symbols)
  openOrders = syncOpenOrders(ns)
  { openOrders, orderTracker, cancelled } = cancelStaleOrders(ns, openOrders, state.orderTracker, tick, config.execution)
  if cancelled > 0:
    openOrders = syncOpenOrders(ns)
  state.orderTracker = orderTracker
  state.portfolio.pnlRealized += calcRealizedPnLDelta(lastPositions, positions)

  state.portfolio.pnlUnrealized = calcUnrealizedPnL(positions, marketMap)
  state.openOrders = openOrders
  state.portfolio.lastPositions = positions

  intents = computeSignals(marketData, positions, state.strategy, access.mode, config)
  intents = applyCooldown(intents, state.strategy, tick)

  sizedIntents = sizeIntents(intents, positions, openOrders, state.risk, marketMap)

  { placed, rejected } = placeOrders(ns, sizedIntents, openOrders)

  updateStrategyState(state.strategy, marketData, tick)
  state.portfolio.lastTick = tick

  saveTradingState(ns, config.stateFile, state)
  lastPositions = positions
  writeTelemetry(ns, config.telemetryFile, buildTelemetrySnapshot(...))
```

## Telemetry (File Output)
The system should emit a compact JSON snapshot each tick for external UI tooling. This output is intentionally decoupled from the persistence file so UIs can be safely built without mutating state.

### Telemetry Snapshot Schema (Suggested)
```
{
  timestamp: number,
  tick: number,
  access: { hasWSE, hasTIX, has4SData, has4STIX },
  cash: number,
  pnl: { realized, unrealized },
  positions: [
    { sym, sharesLong, avgLongPrice, sharesShort, avgShortPrice, marketPrice }
  ],
  openOrders: {
    sym: [ { type, position, shares, price } ]
  },
  lastActions: {
    placed: number,
    rejected: number,
    cancelled: number
  }
}
```

### Telemetry Principles
- Write once per tick after order placement and state updates.
- Keep the schema stable; prefer additive changes for UI compatibility.
- Do not store large historical arrays in telemetry; log history elsewhere if needed.

## Module Pseudocode (Selected)

### MarketDataFeed
```
function getMarketData(ns, symbols, accessMode, tick):
  data = []
  for sym in symbols:
    price = ns.stock.getPrice(sym)
    bid = ns.stock.getBidPrice(sym)
    ask = ns.stock.getAskPrice(sym)
    vol = ns.stock.getVolatility(sym)
    forecast = accessMode == 'forecast' ? ns.stock.getForecast(sym) : undefined
    data.push({ sym, price, bid, ask, volatility: vol, forecast, tick })
  return data
```

### SignalEngine (Forecast + stop-loss/take-profit)
```
function computeSignals(marketData, positions, accessMode, config):
  intents = []
  for md in marketData:
    position = positions[md.sym]
    hasLong = position?.sharesLong > 0
    hasShort = position?.sharesShort > 0
    hasForecast = md.forecast != null and config.useForecast and accessMode == 'forecast'

    if hasForecast and hasLong and md.forecast <= 1 - config.forecastThreshold:
      intents.push(exit long, reason: forecast-exit-long); continue
    if hasForecast and hasShort and md.forecast >= config.forecastThreshold:
      intents.push(exit short, reason: forecast-exit-short); continue

    if hasLong and stopLoss/takeProfit hit:
      intents.push(exit long, reason: stop-loss or take-profit); continue
    if hasShort and stopLoss/takeProfit hit:
      intents.push(exit short, reason: stop-loss or take-profit); continue

    if hasForecast and md.forecast >= config.forecastThreshold and edge >= minEdge:
      intents.push(enter long)
    else if hasForecast and md.forecast <= (1 - config.forecastThreshold) and -edge >= minEdge:
      intents.push(enter short)
  return intents
```

### RiskEngine (Sizing with exposure + open orders)
```
function sizeIntents(intents, positions, openOrders, risk, marketMap):
  exposure = calculateExposure(positions, openOrders, marketMap)
  for intent in intents:
    price = marketMap[intent.sym].price
    maxShares = ns.stock.getMaxShares(intent.sym)
    targetShares = floor(min(risk.maxPerSymbol, risk.maxPositionPercent * risk.cash) / price)
    pending = pendingShares(openOrders[intent.sym])

    if intent is buy long:
      desired = max(0, targetShares - currentLong - pending.long)
    if intent is buy short:
      desired = max(0, targetShares - currentShort - pending.short)
    if intent is sell:
      desired = current position size

    desired = clamp(desired, 0, maxShares)
    if intent is buy:
      apply gross/net exposure caps using exposure
    if desired > 0:
      push intent with shares
      update exposure if buy
```

### OrderManager (Market + limit/stop)
```
function placeOrders(ns, intents, openOrders):
  for intent in intents:
    if intent.orderType == 'market':
      execute buy/sell long/short
    else:
      build limit/stop price from bid/ask + offset
      if duplicate order exists: reject
      ns.stock.placeOrder(sym, shares, price, type, pos)
```

### OrderManager (Stale order cancellation)
```
function cancelStaleOrders(openOrders, orderTracker, tick, cancelAfter):
  for each order in openOrders:
    if firstSeen not set: set to tick
  for each tracked order:
    if tick - firstSeen >= cancelAfter:
      ns.stock.cancelOrder(sym, shares, price, type, pos)
  return updated openOrders/orderTracker + cancelled count
```

## Testing & Validation
- Use a dry-run mode that logs intents but does not place orders.
- Compare local position state with `getPosition()` for reconciliation.
- Validate persistence loading with intentionally corrupted JSON.
- Validate telemetry writes by reading the latest file and checking key fields.

## File Locations
- Types: `bitburner/lib/stock/types.ts`
- Persistence: `bitburner/lib/stock/persistence.ts`
- Telemetry helpers: `bitburner/lib/stock/telemetry.ts`
- Barrel exports: `bitburner/lib/stock/index.ts`
- Design doc: `STOCK_TRADING_DESIGN.md`
