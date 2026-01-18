import { NS } from '@ns';
import { ServerDfs } from 'lib/dfs';
import { isHome } from 'lib/host';

type Mode = 'rooted' | 'hackable' | 'not-hackable';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  const flags = ns.flags([
    ['mode', 'rooted'],
    ['m', 'rooted'],
    ['debug', false],
    ['help', false],
    ['h', false],
  ]);

  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const modeFlag = flags.m !== 'rooted' ? String(flags.m) : String(flags.mode);
  const mode = parseMode(modeFlag);
  if (!mode) {
    ns.tprint(`WARN invalid --mode=${String(flags.mode)}`);
    printHelp(ns);
    return;
  }

  const playerHack = ns.getHackingLevel();
  const debug = Boolean(flags.debug);
  const dfs = new ServerDfs(ns, {
    shouldAct: (_ns, host) => !isHome(host),
    onVisit: (_ns: NS, host: string) => {
      if (!ns.hasRootAccess(host)) {
        return;
      }
      const required = ns.getServerRequiredHackingLevel(host);
      const isHackable = playerHack >= required;

      if (mode === 'rooted') {
        ns.tprint(host);
      } else if (mode === 'hackable' && isHackable) {
        ns.tprint(host);
      } else if (mode === 'not-hackable' && !isHackable) {
        if (debug) {
          ns.tprint(`${host}: required ${required}, player ${playerHack}`);
        } else {
          ns.tprint(host);
        }
      }
    },
  });
  dfs.traverse('home');
}

function parseMode(value: string): Mode | null {
  if (value === 'rooted' || value === 'hackable' || value === 'not-hackable') {
    return value;
  }
  return null;
}

function printHelp(ns: NS): void {
  ns.tprint('Usage: run agent/rooted-list.js [--mode rooted|hackable|not-hackable] [--debug]');
  ns.tprint('Defaults: --mode rooted');
  ns.tprint('Examples:');
  ns.tprint('  run agent/rooted-list.js');
  ns.tprint('  run agent/rooted-list.js --mode hackable');
  ns.tprint('  run agent/rooted-list.js --mode not-hackable');
  ns.tprint('  run agent/rooted-list.js --mode not-hackable --debug');
}
