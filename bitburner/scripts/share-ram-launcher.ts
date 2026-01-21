import { AutocompleteData, NS } from '@ns';
import { ServerBfs } from '/lib/bfs';

const RAM_SCRIPT = 'scripts/share-ram-worker.js';
const RAM_SCRIPT_ALIASES = new Set<string>([RAM_SCRIPT, `/${RAM_SCRIPT}`]);

interface ShareRamScriptOpts {
  ramUsageRatio: number;
  host: string;
  interval: number;
  bufferRam: number;
  bufferPct: number;
  includeHome: boolean;
  minRam: number;
  verbose: boolean;
}

const defaultFlags: [string, string | number | boolean | string[]][] = [
  ['ramUsageRatio', 0.5],
  ['host', ''],
  ['interval', 250],
  ['buffer-ram', 2],
  ['buffer-pct', 0],
  ['include-home', false],
  ['min-ram', 2],
  ['verbose', false],
  ['help', false],
  ['h', false],
];

function printHelp(ns: NS): void {
  ns.tprint(
    `usage: ${ns.getScriptName()} [--ramUsageRatio] [--host] [--interval] [--buffer-ram] [--buffer-pct] [--include-home] [--min-ram]`,
  );
}

function parseArgs(ns: NS): ShareRamScriptOpts | null {
  const flags = ns.flags(defaultFlags);

  if (flags.help || flags.h) {
    printHelp(ns);
    return null;
  }

  const ramUsageRatio = Math.min(1, Math.max(0.01, Number(flags.ramUsageRatio)));
  const host = String(flags.host);
  const interval = Math.max(50, Number(flags.interval) || 250);
  const bufferRam = Math.max(0, Number(flags['buffer-ram']) || 0);
  const bufferPct = Math.min(0.9, Math.max(0, Number(flags['buffer-pct']) || 0));
  const includeHome = Boolean(flags['include-home']);
  const minRam = Math.max(1, Number(flags['min-ram']) || 1);
  const verbose = Boolean(flags.verbose);

  return {
    ramUsageRatio,
    host,
    interval,
    bufferRam,
    bufferPct,
    includeHome,
    minRam,
    verbose,
  };
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(defaultFlags);
  return [];
}

export async function main(ns: NS): Promise<void> {
  killOtherInstances(ns);
  ns.disableLog('ALL');
  const opts = parseArgs(ns);
  if (!opts) return;

  while (true) {
    const hosts = getTargetHosts(ns, opts.host, opts.includeHome, opts.minRam);
    for (const host of hosts) {
      await rebalanceHost(ns, host, opts);
    }
    await ns.sleep(opts.interval);
  }
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

async function rebalanceHost(ns: NS, host: string, opts: ShareRamScriptOpts): Promise<void> {
  if (!ns.fileExists(RAM_SCRIPT, host)) {
    await ns.scp([RAM_SCRIPT], host);
  }

  const shareRamScriptCost = ns.getScriptRam(RAM_SCRIPT, host);
  if (!Number.isFinite(shareRamScriptCost) || shareRamScriptCost <= 0) {
    if (opts.verbose) {
      ns.print(`WARN failed to determine RAM cost for ${RAM_SCRIPT} on ${host}.`);
    }
    return;
  }

  const maxRam = ns.getServerMaxRam(host);
  if (maxRam <= 0) {
    return;
  }

  const current = getCurrentShareThreads(ns, host, shareRamScriptCost);
  const usedRam = ns.getServerUsedRam(host);
  const buffer = Math.max(opts.bufferRam, maxRam * opts.bufferPct);
  const desiredRam = maxRam * opts.ramUsageRatio;
  const availableForShare = Math.min(desiredRam, maxRam - (usedRam - current.ramUsed) - buffer);
  const targetThreads = Math.max(0, Math.floor(availableForShare / shareRamScriptCost));

  if (targetThreads === current.threads) {
    return;
  }

  if (current.threads > 0) {
    for (const proc of ns.ps(host)) {
      if (RAM_SCRIPT_ALIASES.has(proc.filename)) {
        ns.kill(proc.pid);
      }
    }
  }

  if (targetThreads <= 0) {
    if (opts.verbose && current.threads > 0) {
      ns.print(`Freed share RAM on ${host}.`);
    }
    return;
  }

  const ret = ns.exec(RAM_SCRIPT, host, targetThreads);
  if (ret === 0 && opts.verbose) {
    ns.print(`WARN failed to launch share script on ${host}.`);
  }
}

function getCurrentShareThreads(
  ns: NS,
  host: string,
  shareRamScriptCost: number,
): { threads: number; ramUsed: number } {
  let threads = 0;
  for (const proc of ns.ps(host)) {
    if (RAM_SCRIPT_ALIASES.has(proc.filename)) {
      threads += proc.threads;
    }
  }
  return { threads, ramUsed: threads * shareRamScriptCost };
}

function getTargetHosts(ns: NS, hostFlag: string, includeHome: boolean, minRam: number): string[] {
  if (hostFlag) {
    return [hostFlag];
  }

  const hosts: string[] = [];
  const bfs = new ServerBfs(ns, {
    shouldAct: (_ns, host) => {
      if (!includeHome && host === 'home') {
        return false;
      }
      return ns.hasRootAccess(host) && ns.getServerMaxRam(host) >= minRam;
    },
    onVisit: (_ns, host) => {
      hosts.push(host);
    },
  });
  bfs.traverse('home');
  return hosts;
}
