import { NS } from '@ns';

const DEFAULT_OPTIONS: [string, string | number | boolean][] = [
  ['target', ''],
  ['port', 1],
  ['threads', 0],
  ['runner', ''],
  ['delay', 0],
  ['batch-id', ''],
  ['batch-step', 0],
  ['batch-steps', 0],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags(DEFAULT_OPTIONS);
  if (flags.help || flags.h) {
    ns.tprint(
      `Usage: run ${ns.getScriptName()} --target <host> --port <port> --threads <n> [--runner <host>] [--delay <ms>] [--batch-id <id>] [--batch-step <n>] [--batch-steps <n>]`,
    );
    return;
  }

  const target = String(flags.target ?? '');
  const port = Number(flags.port);
  const threads = Number(flags.threads);
  const runner = String(flags.runner ?? '');
  const delay = Number(flags.delay ?? 0);
  const batchId = String(flags['batch-id'] ?? '');
  const batchStep = Number(flags['batch-step'] ?? 0);
  const batchSteps = Number(flags['batch-steps'] ?? 0);

  if (!target || !Number.isFinite(port) || port <= 0 || !Number.isFinite(threads) || threads <= 0) {
    return;
  }

  if (Number.isFinite(delay) && delay > 0) {
    await ns.sleep(delay);
  }

  const result = await ns.weaken(target, { threads });
  ns.writePort(port, {
    host: target,
    op: 'weaken',
    threads,
    runner: runner || undefined,
    result,
    ts: Date.now(),
    batchId: batchId || undefined,
    batchStep: Number.isFinite(batchStep) && batchStep > 0 ? batchStep : undefined,
    batchSteps: Number.isFinite(batchSteps) && batchSteps > 0 ? batchSteps : undefined,
    delayMs: Number.isFinite(delay) && delay > 0 ? delay : undefined,
  });
}
