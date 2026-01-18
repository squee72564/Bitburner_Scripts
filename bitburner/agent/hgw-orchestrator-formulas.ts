import { AutocompleteData, NS } from '@ns';
import { ServerDfs } from 'lib/dfs';
import {
  growThreads as formulaGrowThreads,
  hackChance as formulaHackChance,
  hackPercent,
  hackTime as formulaHackTime,
  growTime as formulaGrowTime,
  weakenTime as formulaWeakenTime,
} from 'lib/hacking-formulas';

interface OrchestratorOptions {
  score: string;
  rebalanceMs: number;
  moneyThreshold: number;
  hackFraction: number;
  securityEpsilon: number;
  dryRun: boolean;
  debug: boolean;
}

interface RunnerInfo {
  host: string;
  capacity: number;
  remaining: number;
}

interface TargetInfo {
  host: string;
  score: number;
  desiredThreads: number;
  details?: DesiredThreadsDetails;
}

interface Assignment {
  runner: string;
  target: string;
  threads: number;
}

interface DesiredThreadsDetails {
  weakenThreads: number;
  growThreads: number;
  growWeakenThreads: number;
  hackThreads: number;
  hackWeakenThreads: number;
  maxMoney: number;
  money: number;
  minSec: number;
  sec: number;
  hackTime: number;
  growTime: number;
  weakenTime: number;
}

const HGW_SCRIPT = '/agent/hgw-loop-formulas.js';
const HGW_DEPENDENCIES = ['/lib/hacking-formulas.js'];
const SCORE_MODES = ['money', 'moneyTime', 'prepAware', 'growthWeighted', 'moneyChanceTime'] as const;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags([
    ['score', 'moneyChanceTime'],
    ['rebalance', 1_800_000],
    ['money', 0.9],
    ['hack', 0.1],
    ['epsilon', 1],
    ['dry', false],
    ['debug', false],
    ['help', false],
  ]);

  const lastArg = args.at(-1);
  if (lastArg === '--score') {
    return [...SCORE_MODES];
  }
  const prevArg = args.length > 1 ? args[args.length - 2] : undefined;
  if (prevArg === '--score') {
    const prefix = lastArg ?? '';
    return SCORE_MODES.filter((mode) => mode.startsWith(prefix));
  }
  return [];
}

function parseOptions(ns: NS): OrchestratorOptions | null {
  const flags = ns.flags([
    ['score', 'moneyChanceTime'],
    ['rebalance', 1_800_000],
    ['money', 0.9],
    ['hack', 0.1],
    ['epsilon', 1],
    ['dry', false],
    ['debug', false],
    ['help', false],
  ]);

  if (flags.help) {
    ns.tprint(
      'Usage: run hgw-orchestrator-formulas.js [--score name] [--rebalance ms] [--money 0.9] [--hack 0.1] [--epsilon 1] [--dry] [--debug]',
    );
    return null;
  }

  const score = String(flags.score || 'moneyChanceTime');
  const rebalanceMs = Math.max(60_000, Number(flags.rebalance));
  const moneyThreshold = Math.min(1, Math.max(0, Number(flags.money)));
  const hackFraction = Math.min(1, Math.max(0, Number(flags.hack)));
  const securityEpsilon = Math.max(0, Number(flags.epsilon));
  const dryRun = Boolean(flags.dry);
  const debug = Boolean(flags.debug);

  return { score, rebalanceMs, moneyThreshold, hackFraction, securityEpsilon, dryRun, debug };
}

function scoreTarget(ns: NS, host: string, mode: string): number {
  const server = ns.getServer(host);
  const player = ns.getPlayer();
  const maxMoney = ns.getServerMaxMoney(host);
  const money = ns.getServerMoneyAvailable(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  const sec = ns.getServerSecurityLevel(host);
  const hackChance = formulaHackChance(ns, server, player);
  const hackTime = formulaHackTime(ns, server, player);
  const growth = ns.getServerGrowth(host);

  if (maxMoney <= 0 || hackTime <= 0) {
    return 0;
  }

  switch (mode) {
    case 'money':
      return maxMoney;
    case 'moneyTime':
      return maxMoney / hackTime;
    case 'prepAware':
      return (
        ((maxMoney * hackChance) / hackTime) *
        (maxMoney > 0 ? money / maxMoney : 0) *
        (sec > 0 ? minSec / sec : 0)
      );
    case 'growthWeighted':
      return (maxMoney * (growth / 100)) / hackTime;
    case 'moneyChanceTime':
    default:
      return (maxMoney * hackChance) / hackTime;
  }
}

function computeDesiredThreadsDetails(
  ns: NS,
  host: string,
  moneyThreshold: number,
  hackFraction: number,
  securityEpsilon: number,
): DesiredThreadsDetails {
  const server = ns.getServer(host);
  const player = ns.getPlayer();
  const maxMoney = ns.getServerMaxMoney(host);
  const money = ns.getServerMoneyAvailable(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  const sec = ns.getServerSecurityLevel(host);
  const hackTime = formulaHackTime(ns, server, player);
  const growTime = formulaGrowTime(ns, server, player);
  const weakenTime = formulaWeakenTime(ns, server, player);
  const weakenPerThread = ns.weakenAnalyze(1);

  const needWeaken = Math.max(0, sec - (minSec + securityEpsilon));
  const weakenThreads = weakenPerThread > 0 ? Math.ceil(needWeaken / weakenPerThread) : 0;

  let growThreads = 0;
  let growWeakenThreads = 0;
  if (maxMoney > 0) {
    const growMultiplier = maxMoney / Math.max(money, 1);
    if (money < maxMoney * moneyThreshold && growMultiplier > 1) {
      growThreads = Math.ceil(formulaGrowThreads(ns, server, player, maxMoney));
      const growSec = ns.growthAnalyzeSecurity(growThreads, host);
      growWeakenThreads = weakenPerThread > 0 ? Math.ceil(growSec / weakenPerThread) : 0;
    }
  }

  let hackThreads = 0;
  let hackWeakenThreads = 0;
  if (maxMoney > 0) {
    const desiredHack = maxMoney * hackFraction;
    const pct = hackPercent(ns, server, player);
    hackThreads = pct > 0 ? Math.ceil(desiredHack / (money * pct)) : 0;
    if (!Number.isFinite(hackThreads) || hackThreads < 0) {
      hackThreads = 0;
    }
    const hackSec = ns.hackAnalyzeSecurity(hackThreads, host);
    hackWeakenThreads = weakenPerThread > 0 ? Math.ceil(hackSec / weakenPerThread) : 0;
  }

  return {
    weakenThreads,
    growThreads,
    growWeakenThreads,
    hackThreads,
    hackWeakenThreads,
    maxMoney,
    money,
    minSec,
    sec,
    hackTime,
    growTime,
    weakenTime,
  };
}

function computeDesiredThreads(details: DesiredThreadsDetails): number {
  return Math.max(
    1,
    details.weakenThreads,
    details.growThreads,
    details.growWeakenThreads,
    details.hackThreads,
    details.hackWeakenThreads,
  );
}

function collectServers(ns: NS): string[] {
  const servers: string[] = [];
  const dfs = new ServerDfs(ns, {
    shouldAct: () => true,
    onVisit: (_ns, host) => {
      servers.push(host);
    },
  });
  dfs.traverse('home');
  return servers;
}

function getRunners(
  ns: NS,
  scriptRam: number,
  debug: boolean,
): { runners: RunnerInfo[]; reasons: string[] } {
  const networkServers: string[] = collectServers(ns);
  const purchased: Set<string> = new Set(ns.getPurchasedServers());
  const allServers: string[] = [...new Set([...networkServers, ...purchased])];

  const runners: RunnerInfo[] = [];
  const reasons: string[] = [];
  for (const host of allServers) {
    if (host === 'home') {
      if (debug) {
        reasons.push(`skip ${host}: home excluded`);
      }
      continue;
    }
    if (!ns.hasRootAccess(host)) {
      if (debug) {
        reasons.push(`skip ${host}: no root`);
      }
      continue;
    }
    if (!purchased.has(host) && ns.getServerMaxRam(host) <= 0) {
      if (debug) {
        reasons.push(`skip ${host}: no RAM`);
      }
      continue;
    }

    const maxRam = ns.getServerMaxRam(host);
    const capacity = Math.floor(maxRam / scriptRam);
    if (capacity < 1) {
      if (debug) {
        reasons.push(`skip ${host}: maxRam ${maxRam} < scriptRam ${scriptRam}`);
      }
      continue;
    }
    runners.push({ host, capacity, remaining: capacity });
  }

  return { runners, reasons };
}

function getTargets(ns: NS, debug: boolean): { targets: string[]; reasons: string[] } {
  const allServers = collectServers(ns);
  const purchased = new Set(ns.getPurchasedServers());
  const hackingLevel = ns.getHackingLevel();
  const reasons: string[] = [];

  const targets = allServers.filter((host) => {
    if (host === 'home') {
      if (debug) {
        reasons.push(`skip target ${host}: home excluded`);
      }
      return false;
    }
    if (!ns.hasRootAccess(host)) {
      if (debug) {
        reasons.push(`skip target ${host}: no root`);
      }
      return false;
    }
    if (purchased.has(host)) {
      if (debug) {
        reasons.push(`skip target ${host}: purchased server`);
      }
      return false;
    }
    if (ns.getServerMaxMoney(host) <= 0) {
      if (debug) {
        reasons.push(`skip target ${host}: max money <= 0`);
      }
      return false;
    }
    if (hackingLevel < ns.getServerRequiredHackingLevel(host)) {
      if (debug) {
        reasons.push(`skip target ${host}: hacking level too low`);
      }
      return false;
    }
    return true;
  });

  return { targets, reasons };
}

function pickBestFitRunner(runners: RunnerInfo[], needed: number): RunnerInfo | null {
  const candidates = runners
    .filter((runner) => runner.remaining >= needed)
    .sort((a, b) => a.remaining - b.remaining);

  if (candidates.length > 0) {
    return candidates[0];
  }

  const fallback = runners.sort((a, b) => b.remaining - a.remaining)[0];
  return fallback && fallback.remaining > 0 ? fallback : null;
}

function buildAssignments(runners: RunnerInfo[], targets: TargetInfo[]): Assignment[] {
  const assignments: Assignment[] = [];
  const runnerMap = new Map(runners.map((runner) => [runner.host, runner]));

  for (const target of targets) {
    const runner = pickBestFitRunner(runners, target.desiredThreads);
    if (!runner) {
      continue;
    }

    const threads = Math.min(target.desiredThreads, runner.remaining);
    if (threads <= 0) {
      continue;
    }

    assignments.push({ runner: runner.host, target: target.host, threads });
    runner.remaining -= threads;
    runnerMap.set(runner.host, runner);
  }

  return assignments;
}

function killRunnerScripts(ns: NS, runners: RunnerInfo[]): void {
  const currentHost = ns.getHostname();
  for (const runner of runners) {
    if (runner.host === currentHost) {
      continue;
    }
    ns.killall(runner.host);
  }
}

export async function main(ns: NS): Promise<void> {
  const opts = parseOptions(ns);
  if (!opts) {
    return;
  }

  const currentHost = ns.getHostname();
  const currentPid = ns.getRunningScript()?.pid;
  for (const process of ns.ps(currentHost)) {
    if (process.filename === ns.getScriptName() && process.pid !== currentPid) {
      ns.kill(process.pid);
    }
  }

  while (true) {
    const scriptRam = ns.getScriptRam(HGW_SCRIPT);
    if (!scriptRam || scriptRam <= 0) {
      ns.tprint(`Missing script: ${HGW_SCRIPT}`);
      return;
    }

    const runnerResult = getRunners(ns, scriptRam, opts.debug);
    const runners = runnerResult.runners.sort((a, b) => b.capacity - a.capacity);
    const targetResult = getTargets(ns, opts.debug);
    const targets = targetResult.targets;

    if (opts.debug) {
      ns.tprint(`HGW script RAM: ${ns.formatRam(scriptRam)}`);
      ns.tprint(`Runners found: ${ns.formatNumber(runners.length)}`);
      ns.tprint(`Targets found: ${ns.formatNumber(targets.length)}`);

      ns.tprint(`Runner results ---------`);
      for (const reason of runnerResult.reasons) {
        ns.tprint(reason);
      }

      ns.tprint(`Target results ---------`);
      for (const reason of targetResult.reasons) {
        ns.tprint(reason);
      }
    }

    if (runners.length === 0 || targets.length === 0) {
      ns.tprint('No runners or targets available.');
      await ns.sleep(opts.rebalanceMs);
      continue;
    }

    const scoredTargets: TargetInfo[] = targets
      .map((host) => {
        const details = computeDesiredThreadsDetails(
          ns,
          host,
          opts.moneyThreshold,
          opts.hackFraction,
          opts.securityEpsilon,
        );
        return {
          host,
          score: scoreTarget(ns, host, opts.score),
          desiredThreads: computeDesiredThreads(details),
          details,
        };
      })
      .sort((a, b) => b.score - a.score);

    if (opts.debug) {
      for (const target of scoredTargets) {
        const details = target.details;
        if (!details) {
          continue;
        }
        const moneyRatio = details.maxMoney > 0 ? details.money / details.maxMoney : 0;
        ns.tprint(
          `Target ${target.host}: desired=${ns.formatNumber(target.desiredThreads)} ` +
            `(w:${ns.formatNumber(details.weakenThreads)} g:${ns.formatNumber(details.growThreads)}` +
            `/gw:${ns.formatNumber(details.growWeakenThreads)} h:${ns.formatNumber(details.hackThreads)}` +
            `/hw:${ns.formatNumber(details.hackWeakenThreads)}) ` +
            `money=${ns.formatNumber(details.money)}/${ns.formatNumber(details.maxMoney)} ` +
            `(${ns.formatPercent(moneyRatio)}) ` +
            `sec=${details.sec.toFixed(2)}/${details.minSec.toFixed(2)} ` +
            `time(h/g/w)=${ns.tFormat(details.hackTime)}/${ns.tFormat(details.growTime)}/` +
            `${ns.tFormat(details.weakenTime)}`,
        );
      }
    }

    const totalThreads = runners.reduce((sum, runner) => sum + runner.capacity, 0);

    if (totalThreads < scoredTargets.length) {
      ns.tprint(
        `Warning: only ${ns.formatNumber(totalThreads)} threads available for ` +
          `${ns.formatNumber(scoredTargets.length)} targets. Covering top-scored targets only.`,
      );
    }

    const assignments = buildAssignments(runners, scoredTargets);

    if (opts.dryRun) {
      ns.tprint(`Dry run: ${ns.formatNumber(assignments.length)} assignments planned.`);
      for (const assignment of assignments) {
        ns.tprint(
          `Plan: ${assignment.runner} -> ${assignment.target} ` +
            `(${ns.formatNumber(assignment.threads)} threads)`,
        );
      }
      return;
    } else {
      killRunnerScripts(ns, runners);

      const targetRunners = new Set(assignments.map((assignment) => assignment.runner));
      for (const runner of targetRunners) {
        await ns.scp([HGW_SCRIPT, ...HGW_DEPENDENCIES], runner, 'home');
      }

      for (const assignment of assignments) {
        const { runner, target } = assignment;
        const pid = ns.exec(
          HGW_SCRIPT,
          runner,
          assignment.threads,
          target,
          '--money',
          String(opts.moneyThreshold),
          '--hack',
          String(opts.hackFraction),
          '--epsilon',
          String(opts.securityEpsilon),
        );
        if (pid === 0) {
          ns.tprint(`Failed to launch HGW loop on ${runner} targeting ${target}.`);
        } else {
          ns.tprint(`Launched HGW loop on ${runner} -> ${target} (${assignment.threads} threads)`);
        }
      }
    }

    await ns.sleep(opts.rebalanceMs);
  }
}
