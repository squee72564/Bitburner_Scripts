import { NS } from '@ns';
import { ServerDfs } from 'lib/dfs';

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
}

interface Assignment {
  runner: string;
  target: string;
  threads: number;
}

const HGW_SCRIPT = '/agent/hgw-loop.js';

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
      'Usage: run hgw-orchestrator.js [--score name] [--rebalance ms] [--money 0.9] [--hack 0.1] [--epsilon 1] [--dry] [--debug]',
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
  const maxMoney = ns.getServerMaxMoney(host);
  const money = ns.getServerMoneyAvailable(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  const sec = ns.getServerSecurityLevel(host);
  const hackChance = ns.hackAnalyzeChance(host);
  const hackTime = ns.getHackTime(host);
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
  const networkServers = collectServers(ns);
  const purchased = new Set(ns.getPurchasedServers());
  const allServers = [...new Set([...networkServers, ...purchased])];

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

function pickRunner(runners: RunnerInfo[]): RunnerInfo | null {
  const sorted = runners.sort((a, b) => b.remaining - a.remaining);
  const runner = sorted[0];
  return runner && runner.remaining > 0 ? runner : null;
}

function buildAssignments(
  runners: RunnerInfo[],
  targets: TargetInfo[],
  totalThreads: number,
): Assignment[] {
  const assignments: Assignment[] = [];
  const assignmentByTarget = new Map<string, Assignment>();
  const runnerMap = new Map(runners.map((runner) => [runner.host, runner]));

  const coverageCount = Math.min(targets.length, totalThreads);
  for (let i = 0; i < coverageCount; i += 1) {
    const runner = pickRunner(runners);
    if (!runner) {
      break;
    }
    const target = targets[i];
    const assignment = { runner: runner.host, target: target.host, threads: 1 };
    assignments.push(assignment);
    assignmentByTarget.set(target.host, assignment);
    runner.remaining -= 1;
  }

  let remaining = runners.reduce((sum, runner) => sum + runner.remaining, 0);
  if (remaining <= 0) {
    return assignments;
  }

  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const target of targets) {
      const assignment = assignmentByTarget.get(target.host);
      if (!assignment) {
        continue;
      }
      const runner = runnerMap.get(assignment.runner);
      if (!runner || runner.remaining <= 0) {
        continue;
      }
      assignment.threads += 1;
      runner.remaining -= 1;
      remaining -= 1;
      progressed = true;
      if (remaining <= 0) {
        break;
      }
    }
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
      ns.tprint(`HGW script RAM: ${scriptRam}`);
      ns.tprint(`Runners found: ${runners.length}`);
      ns.tprint(`Targets found: ${targets.length}`);
      for (const reason of runnerResult.reasons) {
        ns.tprint(reason);
      }
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
      .map((host) => ({ host, score: scoreTarget(ns, host, opts.score) }))
      .sort((a, b) => b.score - a.score);

    const totalThreads = runners.reduce((sum, runner) => sum + runner.capacity, 0);

    if (totalThreads < scoredTargets.length) {
      ns.tprint(
        `Warning: only ${totalThreads} threads available for ${scoredTargets.length} targets. ` +
          'Covering top-scored targets only.',
      );
    }

    const assignments = buildAssignments(runners, scoredTargets, totalThreads);

    if (opts.dryRun) {
      ns.tprint(`Dry run: ${assignments.length} assignments planned.`);
      for (const assignment of assignments) {
        ns.tprint(
          `Plan: ${assignment.runner} -> ${assignment.target} (${assignment.threads} threads)`,
        );
      }
    } else {
      killRunnerScripts(ns, runners);

      const targetRunners = new Set(assignments.map((assignment) => assignment.runner));
      for (const runner of targetRunners) {
        await ns.scp(HGW_SCRIPT, runner, 'home');
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
