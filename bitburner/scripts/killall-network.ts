import { NS } from '@ns';
import { ServerDfs } from 'lib/dfs';

interface Options {
  dryRun: boolean;
  debug: boolean;
}

function parseOptions(ns: NS): Options | null {
  const flags = ns.flags([
    ['dry', false],
    ['debug', false],
    ['help', false],
  ]);

  if (flags.help) {
    ns.tprint('Usage: run killall-network.js [--dry] [--debug]');
    return null;
  }

  return {
    dryRun: Boolean(flags.dry),
    debug: Boolean(flags.debug),
  };
}

export async function main(ns: NS): Promise<void> {
  const opts = parseOptions(ns);
  if (!opts) {
    return;
  }

  let killed = 0;
  let failed = 0;
  let skipped = 0;

  const dfs = new ServerDfs(ns, {
    shouldAct: (_ns, host) => host !== 'home',
    onVisit: (_ns, host) => {
      if (!ns.hasRootAccess(host)) {
        skipped += 1;
        if (opts.debug) {
          ns.tprint(`skip ${host}: no root access`);
        }
        return;
      }

      if (opts.dryRun) {
        ns.tprint(`Dry run: would killall on ${host}`);
        return;
      }

      const success = ns.killall(host);
      if (success) {
        killed += 1;
      } else {
        failed += 1;
      }

      if (opts.debug) {
        ns.tprint(`killall ${host}: ${success ? 'ok' : 'failed'}`);
      }
    },
  });

  dfs.traverse('home');

  if (opts.dryRun) {
    ns.tprint('Dry run complete.');
    return;
  }

  ns.tprint(`Killall complete: ${killed} succeeded, ${failed} failed, ${skipped} skipped.`);
}
