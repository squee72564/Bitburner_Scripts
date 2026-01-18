import { AutocompleteData, NS } from '@ns';
import { React } from '/ui/react';
import { ExpandableList, ExpandableItem } from '/ui/components/ExpandableList';
import { ServerDfs } from 'lib/dfs';
import { isHome } from 'lib/host';

export function autocomplete(data: AutocompleteData): string[] {
  data.flags([
    ['debug', false],
    ['help', false],
    ['h', false],
  ]);
  return [];
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  const flags = ns.flags([
    ['debug', false],
    ['help', false],
    ['h', false],
  ]);

  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const playerHack = ns.getHackingLevel();
  const debug = Boolean(flags.debug);
  const rooted: string[] = [];
  const hackable: string[] = [];
  const notHackable: Array<{ host: string; required: number }> = [];

  const dfs = new ServerDfs(ns, {
    shouldAct: (_ns, host) => !isHome(host),
    onVisit: (_ns: NS, host: string) => {
      if (!ns.hasRootAccess(host)) {
        return;
      }
      const required = ns.getServerRequiredHackingLevel(host);
      const isHackable = playerHack >= required;

      rooted.push(host);
      if (isHackable) {
        hackable.push(host);
      } else {
        notHackable.push({ host, required });
      }
    },
  });
  dfs.traverse('home');

  const el = React.createElement;
  const items: ExpandableItem[] = [
    {
      id: 'rooted',
      header: el('span', null, `Rooted (${ns.formatNumber(rooted.length)})`),
      content: el(
        'div',
        null,
        rooted.map((host) => el('div', { key: host }, host)),
      ),
    },
    {
      id: 'hackable',
      header: el('span', null, `Hackable (${ns.formatNumber(hackable.length)})`),
      content: el(
        'div',
        null,
        hackable.map((host) => el('div', { key: host }, host)),
      ),
    },
    {
      id: 'not-hackable',
      header: el('span', null, `Not hackable (${ns.formatNumber(notHackable.length)})`),
      content: el(
        'div',
        null,
        notHackable.map((entry) =>
          el(
            'div',
            { key: entry.host },
            debug
              ? `${entry.host}: required ${entry.required}, player ${playerHack}`
              : entry.host,
          ),
        ),
      ),
    },
  ];

  ns.tprintRaw(el(ExpandableList, { items }));
}

function printHelp(ns: NS): void {
  ns.tprint('Usage: run agent/rooted-list.js [--debug]');
  ns.tprint('Examples:');
  ns.tprint('  run agent/rooted-list.js');
  ns.tprint('  run agent/rooted-list.js --debug');
}
