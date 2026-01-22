import { AutocompleteData, NS, Person, Server } from '@ns';
import { ServerBfs } from '/lib/core/bfs';
import { isHome, getServerAvailableRam, isServerHackable } from '/lib/core/host';
import {
  scoreTarget,
  ScoringFunction,
  SCORE_MODES,
  HGWCompletionPayload,
  HGWScripts,
  HGW_CYCLE_OP,
  getHGWCycleOperation,
} from '/lib/hgw/hgw-helpers';
import {
  growAmount,
  growThreads,
  growTime,
  hackChance,
  hackPercent,
  hackTime,
  weakenTime,
} from '/lib/hgw/hacking-formulas';
import { PortQueue } from '/lib/core/port-queue';
import { PriorityQueue } from '/lib/core/priority-queue';
import { killOtherInstances } from '/lib/core/process';

interface RunnerMetadata {
  name: string;
  ram: number;
}

type BatchEntryMode = 'auto' | 'always';

interface OrchestratorOptions {
  includeHome: boolean;
  port: number;
  mode: ScoringFunction;
  securityEpsilon: number;
  moneyThreshold: number;
  hackFraction: number;
  minHackChance: number;
  batchMode: BatchEntryMode;
  batchCycles: number;
  gapMs: number;
  useExpectedHackChance: boolean;
}

interface HGWBatchOptions {
  entryMode: BatchEntryMode;
  cycles: number;
  gapMs: number;
  useExpectedHackChance: boolean;
}

interface HGWBatchStep {
  op: HGW_CYCLE_OP;
  threads: number;
  maxThreads: number;
  scriptRam: number;
  expectedSecurityDelta: number;
  expectedMoneyDelta: number;
  durationMs: number;
  startDelayMs: number;
  reason: string;
}

interface HGWBatchPlan {
  target: string;
  runner: string;
  steps: HGWBatchStep[];
  totalRam: number;
  totalDurationMs: number;
  reason?: string;
}

interface SimState {
  money: number;
  moneyMax: number;
  sec: number;
  minSec: number;
  growth: number;
}

interface ActiveBatch {
  batchId: string;
  remainingSteps: number;
}

const HGW_SCRIPTS: HGWScripts = {
  hack: '/scripts/hgw-hack.js',
  grow: '/scripts/hgw-grow.js',
  weaken: '/scripts/hgw-weaken.js',
};

const HGW_KILL_SCRIPTS = new Set<string>([
  HGW_SCRIPTS.hack,
  HGW_SCRIPTS.grow,
  HGW_SCRIPTS.weaken,
  stripLeadingSlash(HGW_SCRIPTS.hack),
  stripLeadingSlash(HGW_SCRIPTS.grow),
  stripLeadingSlash(HGW_SCRIPTS.weaken),
]);

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
  ['batch-mode', 'auto'],
  ['batch-cycles', 1],
  ['gap-ms', 200],
  ['expected-hack-chance', false],
];
const USAGE_INDENT = '                                            ';
const BATCH_MODES: BatchEntryMode[] = ['auto', 'always'];

function buildUsageMessage(scriptName: string): string {
  return (
    `\nusage: run ${scriptName} [--include-home] [--port <n>] [--mode <score>]\n` +
    `${USAGE_INDENT}[--security-epsilon <n>] [--money-threshold <ratio>]\n` +
    `${USAGE_INDENT}[--hack-fraction <ratio>] [--min-hack-chance <ratio>]\n` +
    `${USAGE_INDENT}[--batch-mode <auto|always>] [--batch-cycles <n>] [--gap-ms <ms>]\n` +
    `${USAGE_INDENT}[--expected-hack-chance] [--help]`
  );
}

function buildHelpMessage(scriptName: string): string {
  const usageMessage = buildUsageMessage(scriptName);
  return (
    `${usageMessage}\n\n` +
    'HGW batch orchestrator that launches pipelined hack/grow/weaken batches and listens for completion on a port.\n\n' +
    'Options:\n' +
    '  --include-home            Include home as a runner (default: false)\n' +
    '  --port <n>                Completion port number (default: 1)\n' +
    `  --mode <score>            Scoring mode: ${SCORE_MODES.join('|')}\n` +
    '                            (default: moneyChanceTime)\n' +
    '  --security-epsilon <n>    Allowed security above minimum before weakening (default: 1)\n' +
    '  --money-threshold <ratio> Minimum money ratio before growing, 0..1 (default: 0.9)\n' +
    '  --hack-fraction <ratio>   Fraction of max money to hack per cycle, 0..1 (default: 0.1)\n' +
    '  --min-hack-chance <ratio> Minimum hack chance to consider a target, 0..1 (default: 0.5)\n' +
    '  --batch-mode <auto|always>Start at auto-selected op or always GHWH (default: auto)\n' +
    '  --batch-cycles <n>        Number of cycles to pipeline per batch (default: 1)\n' +
    '  --gap-ms <ms>             Gap between batch step completions (default: 200)\n' +
    '  --expected-hack-chance    Use hack chance when estimating money deltas\n' +
    '  -h, --help                Show this help message'
  );
}

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
  data.flags(DEFAULT_OPTIONS);
  const lastArg = args.at(-1);
  if (lastArg === '--mode') {
    return [...SCORE_MODES];
  }
  if (lastArg === '--batch-mode') {
    return [...BATCH_MODES];
  }
  const prevArg = args.length > 1 ? args[args.length - 2] : undefined;
  if (prevArg === '--mode') {
    const prefix = lastArg ?? '';
    return SCORE_MODES.filter((mode) => mode.startsWith(prefix));
  }
  if (prevArg === '--batch-mode') {
    const prefix = lastArg ?? '';
    return BATCH_MODES.filter((mode) => mode.startsWith(prefix));
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
  const batchMode = String(flags['batch-mode'] ?? 'auto') as BatchEntryMode;
  const batchCyclesRaw = Number(flags['batch-cycles'] ?? 1);
  const batchCycles = Number.isFinite(batchCyclesRaw) ? Math.max(1, Math.floor(batchCyclesRaw)) : 1;
  const gapMs = Math.max(0, Number(flags['gap-ms'] ?? 0));
  const useExpectedHackChance = Boolean(flags['expected-hack-chance']);

  if (!SCORE_MODES.includes(mode)) {
    ns.tprint('Invalid scoring function: ' + mode);
    ns.tprint(usageMessage);
    return null;
  }

  if (!BATCH_MODES.includes(batchMode)) {
    ns.tprint('Invalid batch mode: ' + batchMode);
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
    batchMode,
    batchCycles,
    gapMs,
    useExpectedHackChance,
  };
}

export async function main(ns: NS): Promise<void> {
  killOtherInstances(ns);
  killHGWScriptsAllServers(ns);
  ns.disableLog('ALL');

  const opts: OrchestratorOptions | null = parseOptions(ns);
  if (!opts) {
    return;
  }

  ns.printf(
    'Starting batch orchestrator port=%d mode=%s batch=%s cycles=%d gap=%d thresholds: sec=%.2f money=%.2f hack=%.2f chance=%.2f',
    opts.port,
    opts.mode,
    opts.batchMode,
    opts.batchCycles,
    opts.gapMs,
    opts.securityEpsilon,
    opts.moneyThreshold,
    opts.hackFraction,
    opts.minHackChance,
  );

  const currentlyTargetedServers: Set<string> = new Set();
  const activeBatches: Map<string, ActiveBatch> = new Map();
  const runnerQueue = new PriorityQueue<RunnerMetadata>(
    (a: RunnerMetadata, b: RunnerMetadata) => b.ram - a.ram,
  );
  const portReader: PortQueue<HGWCompletionPayload> = new PortQueue(ns, opts.port);

  ns.clearPort(opts.port);

  while (true) {
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

      const batchPlan = planHGWBatch(
        ns,
        target.name,
        runner.name,
        HGW_SCRIPTS,
        {
          availableRam: runner.ram,
          securityEpsilon: opts.securityEpsilon,
          moneyThreshold: opts.moneyThreshold,
          hackFraction: opts.hackFraction,
          minHackChance: opts.minHackChance,
        },
        {
          entryMode: opts.batchMode,
          cycles: opts.batchCycles,
          gapMs: opts.gapMs,
          useExpectedHackChance: opts.useExpectedHackChance,
        },
      );

      if (batchPlan.steps.length === 0 || batchPlan.reason) {
        runnerQueue.push(runner);
        continue;
      }

      const scriptsToCopy = new Set(batchPlan.steps.map((step) => HGW_SCRIPTS[step.op]));
      ns.scp([...scriptsToCopy], runner.name);

      const batchId = `${target.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      let launchedSteps = 0;
      let usedRam = 0;

      for (let i = 0; i < batchPlan.steps.length; i += 1) {
        const step = batchPlan.steps[i];
        const script = HGW_SCRIPTS[step.op];
        const delayMs = Math.max(0, Math.floor(step.startDelayMs));

        const pid = ns.exec(
          script,
          runner.name,
          step.threads,
          '--target',
          target.name,
          '--port',
          opts.port,
          '--threads',
          step.threads,
          '--runner',
          runner.name,
          '--delay',
          delayMs,
          '--batch-id',
          batchId,
          '--batch-step',
          i + 1,
          '--batch-steps',
          batchPlan.steps.length,
        );

        if (pid === 0) {
          ns.printf(
            'Exec failed batch=%s op=%s target=%s runner=%s threads=%d',
            batchId,
            step.op,
            target.name,
            runner.name,
            step.threads,
          );
          continue;
        }

        launchedSteps += 1;
        usedRam += step.threads * step.scriptRam;

        ns.printf(
          'Dispatched batch=%s op=%s target=%s runner=%s threads=%d delay=%d',
          batchId,
          step.op,
          target.name,
          runner.name,
          step.threads,
          delayMs,
        );
      }

      if (launchedSteps > 0) {
        currentlyTargetedServers.add(target.name);
        activeBatches.set(target.name, {
          batchId,
          remainingSteps: launchedSteps,
        });

        const updatedRam = Math.max(0, runner.ram - usedRam);
        if (updatedRam > 0) {
          runnerQueue.push({
            name: runner.name,
            ram: updatedRam,
          });
        }
      } else {
        runnerQueue.push(runner);
      }
    }

    for (const completedPayload of portReader.drain()) {
      const active = activeBatches.get(completedPayload.host);
      if (active && completedPayload.batchId && completedPayload.batchId !== active.batchId) {
        continue;
      }

      if (active) {
        active.remainingSteps -= 1;
        if (active.remainingSteps <= 0) {
          activeBatches.delete(completedPayload.host);
          currentlyTargetedServers.delete(completedPayload.host);
        }
      } else {
        currentlyTargetedServers.delete(completedPayload.host);
      }

      ns.printf(
        'Completed op=%s target=%s threads=%d runner=%s result=%.2f batch=%s step=%s/%s',
        completedPayload.op,
        completedPayload.host,
        completedPayload.threads,
        completedPayload.runner ?? 'unknown',
        completedPayload.result,
        completedPayload.batchId ?? 'none',
        completedPayload.batchStep ?? '?',
        completedPayload.batchSteps ?? '?',
      );
    }

    await ns.sleep(1000);
  }
}

function killHGWScriptsAllServers(ns: NS): void {
  const servers = getAllServers(ns);
  for (const host of servers) {
    for (const proc of ns.ps(host)) {
      if (HGW_KILL_SCRIPTS.has(proc.filename)) {
        ns.kill(proc.pid);
      }
    }
  }
}

function getAllServers(ns: NS): string[] {
  const servers: string[] = [];
  const bfs = new ServerBfs(ns, {
    shouldAct: () => true,
    onVisit: (_ns, host) => {
      servers.push(host);
    },
  });
  bfs.traverse('home');
  return servers;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function planHGWBatch(
  ns: NS,
  target: string,
  runner: string,
  scripts: HGWScripts,
  opts: {
    availableRam: number;
    securityEpsilon: number;
    moneyThreshold: number;
    hackFraction: number;
    minHackChance: number;
  },
  batchOpts: HGWBatchOptions,
): HGWBatchPlan {
  const server = ns.getServer(target);
  const runnerServer = ns.getServer(runner);
  const player = ns.getPlayer();
  const cores = runnerServer.cpuCores;
  const availableRam = Math.max(0, opts.availableRam);

  const sim: SimState = {
    money: server.moneyAvailable ?? 0,
    moneyMax: server.moneyMax ?? 0,
    sec: server.hackDifficulty ?? ns.getServerSecurityLevel(target),
    minSec: server.minDifficulty ?? ns.getServerMinSecurityLevel(target),
    growth: server.serverGrowth ?? ns.getServerGrowth(target),
  };

  const entryOp =
    batchOpts.entryMode === 'always'
      ? 'grow'
      : getHGWCycleOperation(ns, target, {
          securityEpsilon: opts.securityEpsilon,
          moneyThreshold: opts.moneyThreshold,
          minHackChance: opts.minHackChance,
        });

  const sequence = buildBatchSequence(entryOp, batchOpts.entryMode, batchOpts.cycles);
  const steps: HGWBatchStep[] = [];

  for (const op of sequence) {
    const shadow = buildShadowServer(server, sim);
    const step = planBatchStep(ns, op, target, scripts, shadow, player, cores, opts, batchOpts);
    if (step.threads <= 0) {
      if (step.reason === 'no_threads') {
        continue;
      }
      return {
        target,
        runner,
        steps: [],
        totalRam: 0,
        totalDurationMs: 0,
        reason: step.reason,
      };
    }

    steps.push(step);
    applyStepToSim(sim, step);
  }

  const totalRam = steps.reduce((sum, step) => sum + step.threads * step.scriptRam, 0);
  if (totalRam > availableRam) {
    return {
      target,
      runner,
      steps,
      totalRam,
      totalDurationMs: 0,
      reason: 'no_ram',
    };
  }

  if (steps.length === 0) {
    return {
      target,
      runner,
      steps,
      totalRam,
      totalDurationMs: 0,
      reason: 'no_steps',
    };
  }

  const maxDuration = steps.reduce((max, step) => Math.max(max, step.durationMs), 0);
  const totalDurationMs = maxDuration + (steps.length - 1) * batchOpts.gapMs;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const landingTime = maxDuration + i * batchOpts.gapMs;
    step.startDelayMs = Math.max(0, landingTime - step.durationMs);
  }

  return {
    target,
    runner,
    steps,
    totalRam,
    totalDurationMs,
  };
}

function buildBatchSequence(
  entryOp: HGW_CYCLE_OP,
  mode: BatchEntryMode,
  cycles: number,
): HGW_CYCLE_OP[] {
  let base: HGW_CYCLE_OP[];

  if (mode === 'always') {
    base = ['grow', 'weaken', 'hack', 'weaken'];
  } else {
    switch (entryOp) {
      case 'grow':
        base = ['grow', 'weaken', 'hack', 'weaken'];
        break;
      case 'weaken':
        base = ['weaken', 'hack', 'weaken'];
        break;
      case 'hack':
      default:
        base = ['hack', 'weaken'];
        break;
    }
  }

  const totalCycles = Math.max(1, Math.floor(cycles));
  const sequence: HGW_CYCLE_OP[] = [];
  for (let i = 0; i < totalCycles; i += 1) {
    sequence.push(...base);
  }
  return sequence;
}

function planBatchStep(
  ns: NS,
  op: HGW_CYCLE_OP,
  target: string,
  scripts: HGWScripts,
  server: Server,
  player: Person,
  cores: number,
  opts: {
    securityEpsilon: number;
    moneyThreshold: number;
    hackFraction: number;
    minHackChance: number;
  },
  batchOpts: HGWBatchOptions,
): HGWBatchStep {
  const script = scripts[op];
  const scriptRam = ns.getScriptRam(script, 'home');
  if (!Number.isFinite(scriptRam) || scriptRam <= 0) {
    return {
      op,
      threads: 0,
      maxThreads: 0,
      scriptRam,
      expectedSecurityDelta: 0,
      expectedMoneyDelta: 0,
      durationMs: 0,
      startDelayMs: 0,
      reason: 'missing_script',
    };
  }

  const durationMs = getOpDuration(ns, op, server, player);

  switch (op) {
    case 'hack': {
      const percent = hackPercent(ns, server, player);
      if (!Number.isFinite(percent) || percent <= 0) {
        return {
          op,
          threads: 0,
          maxThreads: 0,
          scriptRam,
          expectedSecurityDelta: 0,
          expectedMoneyDelta: 0,
          durationMs,
          startDelayMs: 0,
          reason: 'hack_percent_zero',
        };
      }
      const desiredThreads = Math.ceil((opts.hackFraction || 0.1) / percent);
      const threads = clampThreads(desiredThreads);
      if (threads <= 0) {
        return {
          op,
          threads: 0,
          maxThreads: 0,
          scriptRam,
          expectedSecurityDelta: 0,
          expectedMoneyDelta: 0,
          durationMs,
          startDelayMs: 0,
          reason: 'no_threads',
        };
      }
      const chance = hackChance(ns, server, player);
      const hackFactor = batchOpts.useExpectedHackChance ? chance : 1;
      const rawAmount = (server.moneyAvailable ?? 0) * percent * threads * hackFactor;
      const expectedMoneyDelta = -Math.min(server.moneyAvailable ?? 0, rawAmount);
      return {
        op,
        threads,
        maxThreads: threads,
        scriptRam,
        expectedSecurityDelta: ns.hackAnalyzeSecurity(threads, target),
        expectedMoneyDelta,
        durationMs,
        startDelayMs: 0,
        reason: 'hack_ready',
      };
    }
    case 'grow': {
      const desiredThreads = Math.ceil(
        growThreads(ns, server, player, server.moneyMax ?? 0, cores),
      );
      const threads = clampThreads(desiredThreads);
      if (threads <= 0) {
        return {
          op,
          threads: 0,
          maxThreads: 0,
          scriptRam,
          expectedSecurityDelta: 0,
          expectedMoneyDelta: 0,
          durationMs,
          startDelayMs: 0,
          reason: 'no_threads',
        };
      }
      const grownMoney = growAmount(ns, server, player, threads, cores);
      const moneyAfter = Math.min(server.moneyMax ?? 0, grownMoney);
      return {
        op,
        threads,
        maxThreads: threads,
        scriptRam,
        expectedSecurityDelta: ns.growthAnalyzeSecurity(threads, target, cores),
        expectedMoneyDelta: moneyAfter - (server.moneyAvailable ?? 0),
        durationMs,
        startDelayMs: 0,
        reason: 'money_low',
      };
    }
    case 'weaken':
    default: {
      const perThread = ns.weakenAnalyze(1, cores);
      if (!Number.isFinite(perThread) || perThread <= 0) {
        return {
          op,
          threads: 0,
          maxThreads: 0,
          scriptRam,
          expectedSecurityDelta: 0,
          expectedMoneyDelta: 0,
          durationMs,
          startDelayMs: 0,
          reason: 'weaken_zero',
        };
      }
      const sec = server.hackDifficulty ?? ns.getServerSecurityLevel(target);
      const minSec = server.minDifficulty ?? ns.getServerMinSecurityLevel(target);
      const desiredThreads = Math.ceil((sec - minSec) / perThread);
      const threads = clampThreads(desiredThreads);
      if (threads <= 0) {
        return {
          op,
          threads: 0,
          maxThreads: 0,
          scriptRam,
          expectedSecurityDelta: 0,
          expectedMoneyDelta: 0,
          durationMs,
          startDelayMs: 0,
          reason: 'no_threads',
        };
      }
      return {
        op,
        threads,
        maxThreads: threads,
        scriptRam,
        expectedSecurityDelta: -ns.weakenAnalyze(threads, cores),
        expectedMoneyDelta: 0,
        durationMs,
        startDelayMs: 0,
        reason: 'security_high',
      };
    }
  }
}

function getOpDuration(ns: NS, op: HGW_CYCLE_OP, server: Server, player: Person): number {
  switch (op) {
    case 'hack':
      return hackTime(ns, server, player);
    case 'grow':
      return growTime(ns, server, player);
    case 'weaken':
    default:
      return weakenTime(ns, server, player);
  }
}

function applyStepToSim(sim: SimState, step: HGWBatchStep): void {
  if (step.expectedMoneyDelta !== 0) {
    sim.money = clampMoney(sim.money + step.expectedMoneyDelta, sim.moneyMax);
  }
  if (step.expectedSecurityDelta !== 0) {
    sim.sec = clampSecurity(sim.sec + step.expectedSecurityDelta, sim.minSec);
  }
}

function buildShadowServer(base: Server, sim: SimState): Server {
  return {
    ...base,
    moneyAvailable: sim.money,
    moneyMax: sim.moneyMax,
    hackDifficulty: sim.sec,
    minDifficulty: sim.minSec,
    serverGrowth: sim.growth,
  };
}

function getRunnersAndTargets(
  ns: NS,
  opts: OrchestratorOptions,
  currentlyTargetedServers: Set<string>,
) {
  const allServers = getAllServersMetadata(ns, opts);
  const purchasedServersList = ns.getPurchasedServers();
  const purchasedServersSet = new Set(purchasedServersList);

  const availableTargets = allServers
    .slice()
    .filter(
      (target) =>
        !isHome(target.name) &&
        !purchasedServersSet.has(target.name) &&
        ns.getServerMaxMoney(target.name) > 0 &&
        ns.hasRootAccess(target.name) &&
        isServerHackable(ns, target.name) &&
        !currentlyTargetedServers.has(target.name),
    )
    .sort((a, b) => scoreTarget(ns, b.name, opts.mode) - scoreTarget(ns, a.name, opts.mode));

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

function clampThreads(threads: number): number {
  if (!Number.isFinite(threads) || threads <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(threads));
}

function clampMoney(value: number, maxValue: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(value, maxValue));
}

function clampSecurity(value: number, minValue: number): number {
  if (!Number.isFinite(value)) {
    return minValue;
  }
  return Math.max(minValue, value);
}
