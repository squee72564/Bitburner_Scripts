import { NS } from '@ns';
import { ServerBfs } from '/lib/bfs';
import {
  isHome,
  getServerAvailableRam,
  isServerHackable,
} from "/lib/host";
import {
  scoreTarget,
  ScoringFunction,
  SCORE_MODES,
  HGWCompletionPayload,
  getHGWThreadPlan,
  HGWScripts,
} from '/lib/hgw-helpers';
import {
  PortQueue,
} from '/lib/port-queue';
import {
  PriorityQueue,
} from '/lib/priority-queue';


interface RunnerMetadata {
  name: string;
  ram: number;
};

interface OrchestratorOptions {
  includeHome: boolean;
  port: number;
  mode: ScoringFunction; 
  securityEpsilon: number;
  moneyThreshold: number;
  hackFraction: number;
  minHackChance: number;
}

const HGW_SCRIPTS: HGWScripts = {
  hack: '/scripts/hgw-hack.js',
  grow: '/scripts/hgw-grow.js',
  weaken: '/scripts/hgw-weaken.js',
};

const DEFAULT_OPTIONS = [
  ["include-home", false],
  ["help", false],
  ["h", false],
  ["port", 1],
  ["mode", "moneyChanceTime"],
  ["security-epsilon", 1],
  ["money-threshold", 0.9],
  ["hack-fraction", 0.1],
  ["min-hack-chance", 0.5],
];

function parseOptions(ns: NS): OrchestratorOptions | null {
  const flags = ns.flags(DEFAULT_OPTIONS);
  const usageMessage = `Usage: run scripts/${ns.getScriptName()} [--include-home] [--port] [--mode ${SCORE_MODES.join('|')}] [--security-epsilon] [--money-threshold] [--hack-fraction] [--min-hack-chance]`;
  
  if (flags.help || flags.h) {
    ns.tprint(usageMessage);
    return null;
  }

  const includeHome = Boolean(flags["include-home"]);
  const port = Math.max(1, Number(flags.port));
  const mode = String(flags.mode) as ScoringFunction;
  const securityEpsilon = Math.max(0, Number(flags["security-epsilon"]));
  const moneyThreshold = clampRatio(flags["money-threshold"]);
  const hackFraction = clampRatio(flags["hack-fraction"]);
  const minHackChance = clampRatio(flags["min-hack-chance"]);

  if (!SCORE_MODES.includes(mode)) {
    ns.tprint('Invalid scoring function: ' + mode);
    ns.tprint(usageMessage);
    return null;
  }

  return {
    includeHome,
    port,
    mode,
    securityEpsilon,
    moneyThreshold,
    hackFraction,
    minHackChance,
  };
}

export async function main(ns: NS): Promise<void> {
  const opts: OrchestratorOptions | null = parseOptions(ns);
  if (!opts) {
    return;
  }

  const currentlyTargetedServers: Set<string> = new Set();
  const runnerQueue = new PriorityQueue<RunnerMetadata>(
    (a: RunnerMetadata, b: RunnerMetadata) => b.ram - a.ram
  );
  const portReader: PortQueue<HGWCompletionPayload> = new PortQueue(
    ns,
    opts.port
  );

  while (true) {
    // Available targets sorted by scoring function
    const { availableTargets, availableRunners } = getRunnersAndTargets(
      ns,
      opts,
      currentlyTargetedServers
    );

    runnerQueue.clear();
    for (const runner of availableRunners) {
      runnerQueue.push(runner);
    }

    for (const target of availableTargets) {

      const runner = runnerQueue.pop();
      if (!runner) {
        break;
      }

      const plan = getHGWThreadPlan(ns, target.name, runner.name, HGW_SCRIPTS, {
        availableRam: runner.ram,
        securityEpsilon: opts.securityEpsilon,
        moneyThreshold: opts.moneyThreshold,
        hackFraction: opts.hackFraction,
        minHackChance: opts.minHackChance,
      });

      if (plan.threads <= 0) {
        runnerQueue.push(runner);
        continue;
      }

      const script = HGW_SCRIPTS[plan.op];
      await ns.scp(script, runner.name);
      const pid = ns.exec(
        script,
        runner.name,
        plan.threads,
        '--target',
        target.name,
        '--port',
        opts.port,
        '--threads',
        plan.threads,
        '--runner',
        runner.name,
      );

      if (pid === 0) {
        runnerQueue.push(runner);
        continue;
      }

      currentlyTargetedServers.add(target.name);

      const updatedRam = getServerAvailableRam(ns, runner.name);
      if (updatedRam > 0) {
        runnerQueue.push({
          name: runner.name,
          ram: updatedRam,
        });
      }
    }

    await portReader.nextWrite();
    
    for (const completedPayload of portReader.drain()) {
      currentlyTargetedServers.delete(completedPayload.host);
    }
  }
}

function getRunnersAndTargets(ns: NS, opts: OrchestratorOptions, currentlyTargetedServers: Set<string>) {
  const allServers = getAllServersMetadata(
    ns, opts
  );

  // Filter out non-hackable servers and sort by best score
  const availableTargets = allServers.slice()
    .filter((target) => !isHome(target.name) && isServerHackable(ns, target.name) && !currentlyTargetedServers.has(target.name))
    .sort((a, b) => scoreTarget(ns, b.name, opts.mode) - scoreTarget(ns, a.name, opts.mode));

  // Filter out all non-rooted servers and sort by RAM
  const purchasedServers: RunnerMetadata[] =
    ns.getPurchasedServers().map((pserv: string) => ({name: pserv, ram: getServerAvailableRam(ns, pserv)}));

  const availableRunners = [...allServers, ...purchasedServers]
    .filter((runner) => runner.ram > 0 && ns.hasRootAccess(runner.name));

  return {
    availableTargets,
    availableRunners
  };
}

function getAllServersMetadata(ns: NS, opts: OrchestratorOptions): RunnerMetadata[] {
  const servers: RunnerMetadata[] = [];

  const bfs = new ServerBfs(ns, {
    shouldAct: (_ns, host) => {
      if (isHome(host) && !opts.includeHome) {
        return false; 
      }
      return true;
    },
    onVisit: (ns, host) => {
      servers.push({
        name: host,
        ram: getServerAvailableRam(ns, host)
      });
    },
  });
  bfs.traverse('home');
  return servers;
}


function clampRatio(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(1, parsed));
}
