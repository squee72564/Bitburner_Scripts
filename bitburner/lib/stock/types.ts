export type MarketData = {
  sym: string;
  price: number;
  bid: number;
  ask: number;
  volatility: number;
  forecast?: number;
  tick: number;
};

export type Position = {
  sym: string;
  sharesLong: number;
  avgLongPrice: number;
  sharesShort: number;
  avgShortPrice: number;
};

export type OrderIntent = {
  sym: string;
  side: 'buy' | 'sell';
  position: 'long' | 'short';
  shares: number;
  orderType: 'market' | 'limit' | 'stop';
  price?: number;
  reason: string;
};

export type OpenOrder = {
  sym: string;
  type: 'Limit Buy Order' | 'Limit Sell Order' | 'Stop Buy Order' | 'Stop Sell Order';
  position: 'Long' | 'Short';
  shares: number;
  price: number;
};

export type RiskState = {
  cash: number;
  maxPerSymbol: number;
  maxGrossExposure: number;
  maxNetExposure: number;
  maxPositionPercent: number;
  minEdge: number;
};

export type PortfolioState = {
  positions: Record<string, Position>;
  openOrders: Record<string, OpenOrder[]>;
  pnlRealized: number;
  pnlUnrealized: number;
};

export type StrategyState = {
  lastForecasts: Record<string, number>;
  lastPrices: Record<string, number>;
  cooldownTicks: Record<string, number>;
};

export type TradingState = {
  version: 1;
  updatedAt: number;
  strategy: StrategyState;
  risk: RiskState;
  orderTracker: Record<string, number>;
  portfolio: {
    pnlRealized: number;
    pnlUnrealized: number;
    lastTick: number;
    lastPositions: Record<string, Position>;
    paper: {
      positions: Record<string, Position>;
      pnlRealized: number;
      pnlUnrealized: number;
    };
  };
  openOrders: Record<string, OpenOrder[]>;
};

export type TelemetrySnapshot = {
  timestamp: number;
  tick: number;
  mode: 'live' | 'paper';
  access: {
    hasWSE: boolean;
    hasTIX: boolean;
    has4SData: boolean;
    has4STIX: boolean;
  };
  cash: number;
  pnl: {
    realized: number;
    unrealized: number;
  };
  positions: Array<{
    sym: string;
    sharesLong: number;
    avgLongPrice: number;
    sharesShort: number;
    avgShortPrice: number;
    marketPrice: number;
  }>;
  openOrders: Record<string, OpenOrder[]>;
  lastActions: {
    placed: number;
    rejected: number;
    cancelled: number;
  };
};
