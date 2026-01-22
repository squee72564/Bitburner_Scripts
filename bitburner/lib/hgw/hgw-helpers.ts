import { NS } from '@ns';
import { hackChance, hackPercent, hackTime, growThreads } from '/lib/hgw/hacking-formulas';
import { getServerAvailableRam } from '/lib/core/host';

export type HGW_CYCLE_OP = 'hack' | 'grow' | 'weaken';

export const SCORE_MODES = [
  'money',
  'moneyTime',
  'prepAware',
  'growthWeighted',
  'moneyChanceTime',
] as const;

export type ScoringFunction = (typeof SCORE_MODES)[number];

export type HGWDecisionOptions = {
  securityEpsilon?: number;
  moneyThreshold?: number;
  hackFraction?: number;
  minHackChance?: number;
};

export type HGWThreadPlanOptions = HGWDecisionOptions & {
  availableRam?: number;
};

export type HGWScripts = {
  hack: string;
  grow: string;
  weaken: string;
};

export type HGWThreadPlan = {
  op: HGW_CYCLE_OP;
  threads: number;
  maxThreads: number;
  scriptRam: number;
  expectedSecurityDelta: number;
  reason: string;
};

export type HGWCompletionPayload = {
  host: string;
  op: HGW_CYCLE_OP;
  threads: number;
  runner?: string;
  result: number;
  ts: number;
  batchId?: string;
  batchStep?: number;
  batchSteps?: number;
  delayMs?: number;
};

export function scoreTarget(ns: NS, host: string, mode: ScoringFunction): number {
  const server = ns.getServer(host);
  const player = ns.getPlayer();
  const maxMoney = ns.getServerMaxMoney(host);
  const money = ns.getServerMoneyAvailable(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  const sec = ns.getServerSecurityLevel(host);
  const chance = hackChance(ns, server, player);
  const time = hackTime(ns, server, player);
  const growth = ns.getServerGrowth(host);

  if (maxMoney <= 0 || time <= 0) {
    return 0;
  }

  switch (mode) {
    case 'money':
      return maxMoney;
    case 'moneyTime':
      return maxMoney / time;
    case 'prepAware':
      return (
        ((maxMoney * chance) / time) *
        (maxMoney > 0 ? money / maxMoney : 0) *
        (sec > 0 ? minSec / sec : 0)
      );
    case 'growthWeighted':
      return (maxMoney * (growth / 100)) / time;
    case 'moneyChanceTime':
    default:
      return (maxMoney * chance) / time;
  }
}

export function getHGWCycleOperation(
  ns: NS,
  target: string,
  opts: HGWDecisionOptions = {},
): HGW_CYCLE_OP {
  const server = ns.getServer(target);
  const hackDifficulty = server.hackDifficulty ?? ns.getServerSecurityLevel(target);
  const minDifficulty = server.minDifficulty ?? ns.getServerMinSecurityLevel(target);
  const moneyMax = server.moneyMax ?? ns.getServerMaxMoney(target);
  const moneyAvailable = server.moneyAvailable ?? ns.getServerMoneyAvailable(target);
  const player = ns.getPlayer();
  const securityEpsilon = opts.securityEpsilon ?? 1;
  const moneyThreshold = opts.moneyThreshold ?? 0.9;
  const minHackChance = opts.minHackChance ?? 0.5;

  if (hackDifficulty > minDifficulty + securityEpsilon) {
    return 'weaken';
  }

  if (moneyMax > 0 && moneyAvailable < moneyMax * moneyThreshold) {
    return 'grow';
  }

  const chance = hackChance(ns, server, player);
  if (chance >= minHackChance || hackDifficulty == 0) {
    return 'hack';
  }

  return 'weaken';
}

export function getHGWThreadPlan(
  ns: NS,
  target: string,
  runnerHost: string,
  scripts: HGWScripts,
  opts: HGWThreadPlanOptions = {},
): HGWThreadPlan {
  const op = getHGWCycleOperation(ns, target, opts);
  const script = scripts[op];
  const scriptRam = ns.getScriptRam(script, 'home');
  const availableRam = opts.availableRam ?? getServerAvailableRam(ns, runnerHost);

  if (!Number.isFinite(scriptRam) || scriptRam <= 0) {
    return {
      op,
      threads: 0,
      maxThreads: 0,
      scriptRam,
      expectedSecurityDelta: 0,
      reason: 'missing_script',
    };
  }

  if (availableRam <= 0) {
    return {
      op,
      threads: 0,
      maxThreads: 0,
      scriptRam,
      expectedSecurityDelta: 0,
      reason: 'no_ram',
    };
  }

  const maxThreads = Math.floor(availableRam / scriptRam);
  if (maxThreads <= 0) {
    return {
      op,
      threads: 0,
      maxThreads,
      scriptRam,
      expectedSecurityDelta: 0,
      reason: 'no_threads',
    };
  }

  const server = ns.getServer(target);
  const hackDifficulty = server.hackDifficulty ?? ns.getServerSecurityLevel(target);
  const minDifficulty = server.minDifficulty ?? ns.getServerMinSecurityLevel(target);
  const moneyMax = server.moneyMax ?? ns.getServerMaxMoney(target);
  const player = ns.getPlayer();
  const cores = ns.getServer(runnerHost).cpuCores;
  const hackFraction = opts.hackFraction ?? 0.1;

  switch (op) {
    case 'hack': {
      const percent = hackPercent(ns, server, player);
      if (percent <= 0) {
        return {
          op,
          threads: 0,
          maxThreads,
          scriptRam,
          expectedSecurityDelta: 0,
          reason: 'hack_percent_zero',
        };
      }
      const desiredThreads = Math.ceil(hackFraction / percent);
      const threads = clampThreads(desiredThreads, maxThreads);
      return {
        op,
        threads,
        maxThreads,
        scriptRam,
        expectedSecurityDelta: ns.hackAnalyzeSecurity(threads, target),
        reason: 'hack_ready',
      };
    }
    case 'grow': {
      const desiredThreads = Math.ceil(growThreads(ns, server, player, moneyMax, cores));
      const threads = clampThreads(desiredThreads, maxThreads);
      return {
        op,
        threads,
        maxThreads,
        scriptRam,
        expectedSecurityDelta: ns.growthAnalyzeSecurity(threads, target, cores),
        reason: 'money_low',
      };
    }
    case 'weaken':
    default: {
      const perThread = ns.weakenAnalyze(1, cores);
      if (perThread <= 0) {
        return {
          op,
          threads: 0,
          maxThreads,
          scriptRam,
          expectedSecurityDelta: 0,
          reason: 'weaken_zero',
        };
      }
      const desiredThreads = Math.ceil((hackDifficulty - minDifficulty) / perThread);
      const threads = clampThreads(desiredThreads, maxThreads);
      return {
        op,
        threads,
        maxThreads,
        scriptRam,
        expectedSecurityDelta: -ns.weakenAnalyze(threads, cores),
        reason: 'security_high',
      };
    }
  }
}

function clampThreads(threads: number, maxThreads: number): number {
  if (!Number.isFinite(threads) || threads <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(Math.ceil(threads), maxThreads));
}
