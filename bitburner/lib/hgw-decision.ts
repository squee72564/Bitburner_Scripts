import { NS } from "@ns";

export type HgwDecisionConfig = {
  securityEpsilon?: number;
  minMoneyRatio?: number;
  minHackChance?: number;
  hackFraction?: number;
  maxThreads?: number;
};

export type HgwDecision = {
  op: "weaken" | "grow" | "hack" | "skip";
  threads: number;
  reason: string;
};

export function decideHgwOperation(
  ns: NS,
  host: string,
  runner: string,
  config: HgwDecisionConfig = {}
): HgwDecision {
  if (!ns.hasRootAccess(host)) {
    return { op: "skip", threads: 0, reason: "no-root" };
  }

  const security = ns.getServerSecurityLevel(host);
  const minSecurity = ns.getServerMinSecurityLevel(host);
  const money = ns.getServerMoneyAvailable(host);
  const maxMoney = ns.getServerMaxMoney(host);
  const moneyRatio = maxMoney > 0 ? money / maxMoney : 0;

  const epsilon = config.securityEpsilon ?? 0;
  const minMoneyRatio = config.minMoneyRatio ?? 0.9;
  const minHackChance = config.minHackChance ?? 0.5;
  const hackFraction = config.hackFraction ?? 0.1;

  const cores = ns.getServer(runner).cpuCores ?? 1;

  if (security > minSecurity + epsilon) {
    const weakenPerThread = ns.weakenAnalyze(1, cores);
    const needed = weakenPerThread > 0 ? Math.ceil((security - minSecurity) / weakenPerThread) : 0;
    const threads = capThreads(needed, maxThreadsFor(ns, "weaken", runner, config.maxThreads));
    return { op: "weaken", threads, reason: "security-high" };
  }

  if (moneyRatio < minMoneyRatio) {
    const multiplier = maxMoney > 0 ? maxMoney / Math.max(money, 1) : 1;
    const needed = Math.ceil(ns.growthAnalyze(host, multiplier, cores));
    const threads = capThreads(needed, maxThreadsFor(ns, "grow", runner, config.maxThreads));
    return { op: "grow", threads, reason: "money-low" };
  }

  const requiredLevel = ns.getServerRequiredHackingLevel(host);
  if (ns.getHackingLevel() < requiredLevel) {
    return { op: "skip", threads: 0, reason: "hack-level-low" };
  }

  const chance = ns.hackAnalyzeChance(host);
  if (chance < minHackChance) {
    return { op: "skip", threads: 0, reason: "hack-chance-low" };
  }

  const hackPerThread = ns.hackAnalyze(host);
  if (hackPerThread <= 0 || maxMoney <= 0) {
    return { op: "skip", threads: 0, reason: "no-hack-value" };
  }

  const needed = Math.ceil(hackFraction / hackPerThread);
  const threads = capThreads(needed, maxThreadsFor(ns, "hack", runner, config.maxThreads));
  return { op: "hack", threads, reason: "ready" };
}

function maxThreadsFor(
  ns: NS,
  op: "weaken" | "grow" | "hack",
  runner: string,
  cap?: number
): number {
  const ramCost = ns.getFunctionRamCost(op);
  const free = ns.getServerMaxRam(runner) - ns.getServerUsedRam(runner);
  const raw = ramCost > 0 ? Math.floor(free / ramCost) : 0;
  const limited = cap !== undefined ? Math.min(raw, cap) : raw;
  return Math.max(0, limited);
}

function capThreads(needed: number, maxThreads: number): number {
  if (needed <= 0 || maxThreads <= 0) {
    return 0;
  }
  return Math.min(needed, maxThreads);
}
