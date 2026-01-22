import { AutocompleteData, NS } from '@ns';
import { ServerBfs } from '/lib/core/bfs';
import { isHome, getServerAvailableRam, isServerHackable } from '/lib/core/host';
import {
  scoreTarget,
  ScoringFunction,
  SCORE_MODES,
  HGWCompletionPayload,
  getHGWThreadPlan,
  HGWScripts,
} from '/lib/hgw/hgw-helpers';
import { PortQueue } from '/lib/core/port-queue';
import { PriorityQueue } from '/lib/core/priority-queue';

interface RunnerMetadata {
  name: string;
  ram: number;
}

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

const DEFAULT_OPTIONS: [string, string | number | boolean | string[]][] = [
  ['include-home', false],
  ['help', false],
  ['h', false],
  ['port', 1],
  ['mode', 'moneyChanceTime'],
  ['security-epsilon', 1],
  ['money-threshold', 0.9],
  ['hack-fraction', 0.1],
  ['min-hack-chance', 0.5],
];
const USAGE_INDENT = '                                            ';

function buildUsageMessage(scriptName: string): string {
  return (
    `\nusage: run ${scriptName} [--include-home] [--port <n>] [--mode <score>]\n` +
    `${USAGE_INDENT}[--security-epsilon <n>] [--money-threshold <ratio>]\n` +
    `${USAGE_INDENT}[--hack-fraction <ratio>] [--min-hack-chance <ratio>]\n` +
    `${USAGE_INDENT}[--help]`
  );
}

function buildHelpMessage(scriptName: string): string {
  const usageMessage = buildUsageMessage(scriptName);
  return (
    `${usageMessage}\n\n` +
    'HGW orchestrator that launches hack/grow/weaken scripts and listens for their completion status on a port.\n\n' +
    'Options:\n' +
    '  --include-home            Include home as a runner (default: false)\n' +
    '  --port <n>                Completion port number (default: 1)\n' +
    `  --mode <score>            Scoring mode: ${SCORE_MODES.join('|')}\n` +
    '                            (default: moneyChanceTime)\n' +
    '  --security-epsilon <n>    Allowed security above minimum before weakening (default: 1)\n' +
    '  --money-threshold <ratio> Minimum money ratio before growing, 0..1 (default: 0.9)\n' +
    '  --hack-fraction <ratio>   Fraction of max money to hack per cycle, 0..1 (default: 0.1)\n' +
    '  --min-hack-chance <ratio> Minimum hack chance to consider a target, 0..1 (default: 0.5)\n' +
    '  -h, --help                Show this help message'
  );
}

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags(DEFAULT_OPTIONS);
  const lastArg = args.at(-1);
  if (lastArg === '--mode') {
    return [...SCORE_MODES];
  }
  const prevArg = args.length > 1 ? args[args.length - 2] : undefined;
  if (prevArg === '--mode') {
    const prefix = lastArg ?? '';
    return SCORE_MODES.filter((mode) => mode.startsWith(prefix));
  }
  return [];
}

function parseOptions(ns: NS): OrchestratorOptions | null {
  const flags = ns.flags(DEFAULT_OPTIONS);
  const usageMessage = buildUsageMessage(ns.getScriptName());
  const helpMessage = buildHelpMessage(ns.getScriptName());

  if (flags.help || flags.h) {
    ns.tprint(helpMessage);
    return null;
  }

  const includeHome = Boolean(flags['include-home']);
  const port = Math.max(1, Number(flags.port));
  const mode = String(flags.mode) as ScoringFunction;
  const securityEpsilon = Math.max(0, Number(flags['security-epsilon']));
  const moneyThreshold = clampRatio(flags['money-threshold']);
  const hackFraction = clampRatio(flags['hack-fraction']);
  const minHackChance = clampRatio(flags['min-hack-chance']);

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
  ns.disableLog('ALL');

  const opts: OrchestratorOptions | null = parseOptions(ns);
  if (!opts) {
    return;
  }

  ns.printf(
    'Starting orchestrator port=%d mode=%s thresholds: sec=%.2f money=%.2f hack=%.2f chance=%.2f',
    opts.port,
    opts.mode,
    opts.securityEpsilon,
    opts.moneyThreshold,
    opts.hackFraction,
    opts.minHackChance,
  );

  const currentlyTargetedServers: Set<string> = new Set();
  const runnerQueue = new PriorityQueue<RunnerMetadata>(
    (a: RunnerMetadata, b: RunnerMetadata) => b.ram - a.ram,
  );
  const portReader: PortQueue<HGWCompletionPayload> = new PortQueue(ns, opts.port);

  ns.clearPort(opts.port);

  while (true) {
    // Available targets sorted by scoring function
    const { availableTargets, availableRunners } = getRunnersAndTargets(
      ns,
      opts,
      currentlyTargetedServers,
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
      ns.scp(script, runner.name);

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
        ns.printf(
          'Exec failed op=%s target=%s runner=%s threads=%d',
          plan.op,
          target.name,
          runner.name,
          plan.threads,
        );

        runnerQueue.push(runner);
        continue;
      }

      currentlyTargetedServers.add(target.name);

      ns.printf(
        'Dispatched op=%s target=%s runner=%s threads=%d',
        plan.op,
        target.name,
        runner.name,
        plan.threads,
      );

      const updatedRam = Math.max(0, runner.ram - plan.threads * plan.scriptRam);

      if (updatedRam > 0) {
        runnerQueue.push({
          name: runner.name,
          ram: updatedRam,
        });
      }
    }

    for (const completedPayload of portReader.drain()) {
      currentlyTargetedServers.delete(completedPayload.host);
      ns.printf(
        'Completed op=%s target=%s threads=%d runner=%s result=%.2f',
        completedPayload.op,
        completedPayload.host,
        completedPayload.threads,
        completedPayload.runner ?? 'unknown',
        completedPayload.result,
      );
    }

    await ns.sleep(2000);
  }
}

function getRunnersAndTargets(
  ns: NS,
  opts: OrchestratorOptions,
  currentlyTargetedServers: Set<string>,
) {
  const allServers = getAllServersMetadata(ns, opts);
  const purchasedServersList = ns.getPurchasedServers();
  const purchasedServersSet = new Set(purchasedServersList);

  // Filter out non-hackable servers and sort by best score
  const availableTargets = allServers
    .slice()
    .filter(
      (target) =>
        !isHome(target.name) &&
        !purchasedServersSet.has(target.name) &&
        ns.getServerMaxMoney(target.name) > 0 &&
        ns.hasRootAccess(target.name) && // we need root access for weaken/grow
        isServerHackable(ns, target.name) &&
        !currentlyTargetedServers.has(target.name),
    )
    .sort((a, b) => scoreTarget(ns, b.name, opts.mode) - scoreTarget(ns, a.name, opts.mode));

  // Filter out all non-rooted servers and sort by RAM
  const purchasedServers: RunnerMetadata[] = purchasedServersList.map((pserv: string) => ({
    name: pserv,
    ram: getServerAvailableRam(ns, pserv),
  }));

  const availableRunners = [...allServers, ...purchasedServers].filter(
    (runner) => runner.ram > 0 && ns.hasRootAccess(runner.name),
  );

  return {
    availableTargets,
    availableRunners,
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
        ram: getServerAvailableRam(ns, host),
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
