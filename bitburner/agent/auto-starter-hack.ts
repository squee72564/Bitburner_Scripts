import { NS } from '@ns';
import { ServerDfs } from 'lib/dfs';

const SCRIPT = 'agent/starter-hack.js';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  const servers = getAllServers(ns);

  const purchased = new Set(ns.getPurchasedServers());
  const ramPerThread = ns.getScriptRam(SCRIPT, 'home');
  const runners = getRunnerTiers(ns, servers, purchased, ramPerThread);
  const targets = servers.filter((host) => {
    if (host === 'home') {
      return false;
    }
    if (!ns.hasRootAccess(host)) {
      return false;
    }
    if (ns.getServerMaxMoney(host) <= 0) {
      return false;
    }
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host);
  });

  const runnerList = [...runners.tierA, ...runners.tierB, ...runners.tierC];
  const alreadyRunning = getRunningTargets(ns, runnerList);
  const freeRamByHost = new Map(
    runnerList.map((host) => [host, ns.getServerMaxRam(host) - ns.getServerUsedRam(host)]),
  );

  for (const target of targets) {
    if (alreadyRunning.has(target)) {
      continue;
    }
    const runner =
      pickRunner(runners.tierA, freeRamByHost, ramPerThread) ??
      pickRunner(runners.tierB, freeRamByHost, ramPerThread) ??
      pickRunner(runners.tierC, freeRamByHost, ramPerThread);
    if (!runner) {
      ns.tprint(`WARN no RAM available for ${target}`);
      continue;
    }
    if (runner !== 'home') {
      await ns.scp(SCRIPT, runner, 'home');
    }
    const pid = ns.exec(SCRIPT, runner, 1, target);
    if (pid !== 0) {
      ns.tprint(`started ${SCRIPT} on ${runner} targeting ${target}`);
      freeRamByHost.set(runner, (freeRamByHost.get(runner) ?? 0) - ramPerThread);
    } else {
      ns.tprint(`WARN failed to start ${target} on ${runner}`);
    }
  }
}

function getAllServers(ns: NS): string[] {
  const servers: string[] = ['home'];
  const dfs = new ServerDfs(ns, {
    onVisit: (_ns, host) => {
      servers.push(host);
    },
  });
  dfs.traverse('home');
  return servers;
}

function getRunningTargets(ns: NS, runners: string[]): Set<string> {
  const running = new Set<string>();
  for (const host of runners) {
    for (const proc of ns.ps(host)) {
      if (proc.filename === SCRIPT && proc.args.length > 0) {
        const target = String(proc.args[0]);
        running.add(target);
      }
    }
  }
  return running;
}

function getRunnerTiers(
  ns: NS,
  servers: string[],
  purchased: Set<string>,
  ramPerThread: number,
): { tierA: string[]; tierB: string[]; tierC: string[] } {
  const tierA = servers.filter((host) => {
    if (host === 'home') return false;
    if (!ns.hasRootAccess(host)) return false;
    if (purchased.has(host)) return false;
    const maxRam = ns.getServerMaxRam(host);
    return maxRam >= ramPerThread;
  });

  const tierB = servers.filter((host) => {
    if (!purchased.has(host)) return false;
    if (!ns.hasRootAccess(host)) return false;
    const maxRam = ns.getServerMaxRam(host);
    return maxRam >= ramPerThread;
  });

  const tierC =
    ns.hasRootAccess('home') && ns.getServerMaxRam('home') >= ramPerThread ? ['home'] : [];

  return { tierA, tierB, tierC };
}

function pickRunner(
  candidates: string[],
  freeRam: Map<string, number>,
  ramPerThread: number,
): string | null {
  for (const host of candidates) {
    const free = freeRam.get(host) ?? 0;
    if (free >= ramPerThread) {
      return host;
    }
  }
  return null;
}
