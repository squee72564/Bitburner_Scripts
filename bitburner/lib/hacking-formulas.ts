import { NS, Person, Server } from '@ns';

export interface FormulaOptions {
  useFormulas?: boolean;
}

function shouldUseFormulas(ns: NS, opts?: FormulaOptions): boolean {
  if (opts?.useFormulas !== undefined) {
    return opts.useFormulas;
  }
  return ns.fileExists('Formulas.exe', 'home') && !!ns.formulas?.hacking;
}

function estimateGrowthMultiplier(ns: NS, host: string, threads: number, cores = 1): number {
  if (!Number.isFinite(threads) || threads <= 0) {
    return 1;
  }

  let low = 1;
  let high = 1;

  for (let i = 0; i < 20; i += 1) {
    const estimate = ns.growthAnalyze(host, high, cores);
    if (Number.isFinite(estimate) && estimate >= threads) {
      break;
    }
    high *= 2;
  }

  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    const estimate = ns.growthAnalyze(host, mid, cores);
    if (!Number.isFinite(estimate)) {
      high = mid;
      continue;
    }
    if (estimate >= threads) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

function growAmountFallback(ns: NS, server: Server, threads: number, cores = 1): number {
  const moneyAvailable = server.moneyAvailable ?? 0;
  const moneyMax = server.moneyMax ?? 0;
  if (!Number.isFinite(threads) || threads <= 0) {
    return moneyAvailable;
  }

  const multiplier = estimateGrowthMultiplier(ns, server.hostname, threads, cores);
  const moneyAfterAdd = moneyAvailable + threads;
  return Math.min(moneyMax, moneyAfterAdd * multiplier);
}

export function growAmount(
  ns: NS,
  server: Server,
  player: Person,
  threads: number,
  cores?: number,
  opts?: FormulaOptions,
): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.growAmount(server, player, threads, cores);
  }
  return growAmountFallback(ns, server, threads, cores);
}

export function growPercent(
  ns: NS,
  server: Server,
  player: Person,
  threads: number,
  cores?: number,
  opts?: FormulaOptions,
): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.growPercent(server, threads, player, cores);
  }
  return estimateGrowthMultiplier(ns, server.hostname, threads, cores);
}

export function growThreads(
  ns: NS,
  server: Server,
  player: Person,
  targetMoney: number,
  cores?: number,
  opts?: FormulaOptions,
): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.growThreads(server, player, targetMoney, cores);
  }

  const moneyAvailable = server.moneyAvailable ?? 0;
  const moneyMax = server.moneyMax ?? 0;
  const desiredMoney = Math.min(targetMoney, moneyMax);
  if (!Number.isFinite(desiredMoney) || desiredMoney <= moneyAvailable) {
    return 0;
  }

  const coresValue = cores ?? 1;
  const multiplier = desiredMoney / Math.max(moneyAvailable, 1);
  let high = Math.ceil(ns.growthAnalyze(server.hostname, multiplier, coresValue));
  if (!Number.isFinite(high) || high < 1) {
    high = 1;
  }

  let attempts = 0;
  while (growAmountFallback(ns, server, high, coresValue) < desiredMoney && attempts < 20) {
    high *= 2;
    attempts += 1;
  }

  let low = 0;
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    const result = growAmountFallback(ns, server, mid, coresValue);
    if (result >= desiredMoney) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

export function growTime(ns: NS, server: Server, player: Person, opts?: FormulaOptions): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.growTime(server, player);
  }
  return ns.getGrowTime(server.hostname);
}

export function hackChance(ns: NS, server: Server, player: Person, opts?: FormulaOptions): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.hackChance(server, player);
  }
  return ns.hackAnalyzeChance(server.hostname);
}

export function hackExp(
  ns: NS,
  server: Server,
  player: Person,
  opts?: FormulaOptions,
): number | null {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.hackExp(server, player);
  }
  return null;
}

export function hackPercent(ns: NS, server: Server, player: Person, opts?: FormulaOptions): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.hackPercent(server, player);
  }
  return ns.hackAnalyze(server.hostname);
}

export function hackTime(ns: NS, server: Server, player: Person, opts?: FormulaOptions): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.hackTime(server, player);
  }
  return ns.getHackTime(server.hostname);
}

export function weakenTime(ns: NS, server: Server, player: Person, opts?: FormulaOptions): number {
  if (shouldUseFormulas(ns, opts)) {
    return ns.formulas.hacking.weakenTime(server, player);
  }
  return ns.getWeakenTime(server.hostname);
}
