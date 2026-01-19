import { NS } from '@ns';

const DEFAULT_OPTIONS: [string, string | number | boolean][] = [
  ['target', ''],
  ['port', 1],
  ['threads', 0],
  ['runner', ''],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags(DEFAULT_OPTIONS);
  if (flags.help || flags.h) {
    ns.tprint(`Usage: run ${ns.getScriptName()} --target <host> --port <port> --threads <n> [--runner <host>]`);
    return;
  }

  const target = String(flags.target ?? '');
  const port = Number(flags.port);
  const threads = Number(flags.threads);
  const runner = String(flags.runner ?? '');

  if (!target || !Number.isFinite(port) || port <= 0 || !Number.isFinite(threads) || threads <= 0) {
    return;
  }

  const result = await ns.grow(target, { threads });
  ns.writePort(port, {
    host: target,
    op: 'grow',
    threads,
    runner: runner || undefined,
    result,
    ts: Date.now(),
  });
}
