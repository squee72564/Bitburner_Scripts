export const CODING_CONTRACT_ANSWERS_ALGORITHMICSTOCKTRADER = {
  'Algorithmic Stock Trader I': (prices: number[]): number => {
    let minPrice = Infinity;
    let best = 0;
    for (const price of prices) {
      minPrice = Math.min(minPrice, price);
      best = Math.max(best, price - minPrice);
    }
    return best;
  },
  'Algorithmic Stock Trader II': (prices: number[]): number => {
    let profit = 0;
    for (let i = 1; i < prices.length; i++) {
      profit += Math.max(0, prices[i] - prices[i - 1]);
    }
    return profit;
  },
  'Algorithmic Stock Trader III': (prices: number[]): number => {
    let hold1 = Number.MIN_SAFE_INTEGER;
    let hold2 = Number.MIN_SAFE_INTEGER;
    let release1 = 0;
    let release2 = 0;
    for (const price of prices) {
      release2 = Math.max(release2, hold2 + price);
      hold2 = Math.max(hold2, release1 - price);
      release1 = Math.max(release1, hold1 + price);
      hold1 = Math.max(hold1, -price);
    }
    return release2;
  },
  'Algorithmic Stock Trader IV': (data: [number, number[]]): number => {
    const k = data[0];
    const prices = data[1];
    const n = prices.length;
    if (n < 2 || k <= 0) return 0;
    if (k >= Math.floor(n / 2)) {
      let profit = 0;
      for (let i = 1; i < n; i++) profit += Math.max(0, prices[i] - prices[i - 1]);
      return profit;
    }
    const dpHold: number[] = Array(k + 1).fill(Number.MIN_SAFE_INTEGER);
    const dpRelease: number[] = Array(k + 1).fill(0);
    for (const price of prices) {
      for (let t = 1; t <= k; t++) {
        dpRelease[t] = Math.max(dpRelease[t], dpHold[t] + price);
        dpHold[t] = Math.max(dpHold[t], dpRelease[t - 1] - price);
      }
    }
    return dpRelease[k];
  },
} as Record<string, (data: unknown) => unknown>;
