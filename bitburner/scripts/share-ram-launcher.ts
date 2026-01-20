import { AutocompleteData, NS } from '@ns';
import { getServerAvailableRam } from '/lib/host';

const RAM_SCRIPT = 'scripts/share-ram-worker.js';

interface ShareRamScriptOpts {
  ramUsageRatio: number;
  host: string;
}

const defaultFlags: [string, string | number | boolean | string[]][] = [
  ['ramUsageRatio', 0.5],
  ['host', 'home'],
];

function printHelp(ns: NS): void {
  ns.tprint(`usage: ${ns.getScriptName()} [--ramUsageRatio] [--host]`);
}

function parseArgs(ns: NS): ShareRamScriptOpts | null {
  const flags = ns.flags(defaultFlags);

  if (flags.help || flags.h) {
    printHelp(ns);
    return null;
  }

  const ramUsageRatio = Math.min(1, Math.max(0.01, Number(flags.ramUsageRatio)));
  const host = String(flags.host);

  return {
    ramUsageRatio,
    host,
  };
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(defaultFlags);
  return [];
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  const opts = parseArgs(ns);
  if (!opts) return;

  const host = opts.host;

  if (!ns.fileExists(ns.getScriptName(), host)) {
    ns.scp([ns.getScriptName()], host);
  }

  if (!ns.fileExists(RAM_SCRIPT, host)) {
    ns.scp([RAM_SCRIPT], host);
  }

  const shareRamScriptCost = ns.getScriptRam(RAM_SCRIPT, host);
  if (!Number.isFinite(shareRamScriptCost) || shareRamScriptCost <= 0) {
    ns.tprint(`Failed to determine RAM cost for ${RAM_SCRIPT}. Is it on ${host}?`);
    return;
  }
  const availableRAM = getServerAvailableRam(ns, host);
  const desiredRAM = ns.getServerMaxRam(host) * opts.ramUsageRatio;
  const actualRAM = Math.min(availableRAM, desiredRAM);
  const numThreads = Math.floor(actualRAM / shareRamScriptCost);
  if (numThreads < 1) {
    return;
  }

  ns.kill(RAM_SCRIPT, host);
  const ret = ns.exec(RAM_SCRIPT, host, numThreads);

  if (ret === 0) {
    ns.tprint('Failed to launch RAM share script!');
  }
}
