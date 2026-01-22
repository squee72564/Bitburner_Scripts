import { AutocompleteData, NS } from '@ns';
import { ServerDfs } from '/lib/core/dfs';
import { CODING_CONTRACT_ANSWERS } from '/lib/coding-contracts/answers';
import { CODING_CONTRACT_DESCRIPTIONS } from '/lib/coding-contracts/descriptions';

const FLAG_SCHEMA: [string, string | number | boolean][] = [
  ['verbose', false],
  ['dry-run', false],
  ['daemon', false],
  ['interval', 60000],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  ns.disableLog('ls');
  ns.disableLog('codingcontract.getContractType');
  ns.disableLog('codingcontract.getData');
  ns.disableLog('codingcontract.getNumTriesRemaining');
  ns.disableLog('codingcontract.getDescription');
  ns.disableLog('codingcontract.attempt');

  const flags = ns.flags(FLAG_SCHEMA);

  if (flags.help || flags.h) {
    ns.tprint(
      'Usage: run scripts/coding-contract-solve.js [--verbose] [--dry-run] [--daemon] [--interval 60000]',
    );
    return;
  }

  const verbose = Boolean(flags.verbose);
  const dryRun = Boolean(flags['dry-run']);
  const daemon = Boolean(flags.daemon);
  const interval = Math.max(1000, Number(flags.interval) || 60000);

  const found: Array<{ host: string; file: string }> = [];

  do {
    found.length = 0;
    const dfs = new ServerDfs(ns, {
      shouldAct: () => true,
      onVisit: (_ns, host) => {
        const contracts = ns.ls(host, '.cct');
        if (contracts.length === 0) {
          return;
        }

        for (const file of contracts) {
          found.push({ host, file });
        }
      },
    });

    dfs.traverse('home');

    if (found.length === 0) {
      ns.tprint('No coding contracts found.');
      if (!daemon) {
        return;
      }
      await ns.sleep(interval);
      continue;
    }

    let attempted = 0;
    let solved = 0;
    let skipped = 0;
    let failed = 0;

    ns.tprint(`Found ${found.length} coding contract(s):`);
    for (const entry of found) {
      const type = ns.codingcontract.getContractType(entry.file, entry.host);
      const data = ns.codingcontract.getData(entry.file, entry.host);
      const tries = ns.codingcontract.getNumTriesRemaining(entry.file, entry.host);
      const answerFn = CODING_CONTRACT_ANSWERS[type];
      const solverFn = CODING_CONTRACT_DESCRIPTIONS[type]?.solver;

      if (!answerFn) {
        skipped += 1;
        ns.tprint(
          `\n${entry.host}: ${entry.file} | ${type} | tries=${tries} | answer=no | solver=${
            solverFn ? 'yes' : 'no'
          }`,
        );
        continue;
      }

      let answer: unknown;
      try {
        answer = answerFn(data as never);
      } catch (err) {
        failed += 1;
        ns.tprint(`\n${entry.host}: ${entry.file} | ${type} | ERROR generating answer`);
        ns.tprint(String(err));
        continue;
      }

      if (solverFn) {
        let valid = false;
        try {
          valid = solverFn(data as never, answer as never);
        } catch (err) {
          failed += 1;
          ns.tprint(`\n${entry.host}: ${entry.file} | ${type} | ERROR validating answer`);
          ns.tprint(String(err));
          continue;
        }
        if (!valid) {
          failed += 1;
          ns.tprint(`\n${entry.host}: ${entry.file} | ${type} | INVALID answer by solver`);
          if (verbose) {
            ns.tprint(`Answer: ${safeStringify(answer)}`);
          }
          continue;
        }
      }

      if (verbose) {
        ns.tprint(
          `\n${entry.host}: ${entry.file} | ${type} | tries=${tries} | answer=yes | solver=${
            solverFn ? 'yes' : 'no'
          }`,
        );
        ns.tprint(`Answer: ${safeStringify(answer)}`);
      }

      if (dryRun) {
        attempted += 1;
        continue;
      }

      attempted += 1;
      const reward = ns.codingcontract.attempt(answer as never, entry.file, entry.host);
      if (reward) {
        solved += 1;
        ns.tprint(`\n${entry.host}: ${entry.file} | ${type} | SOLVED: ${reward}`);
      } else {
        failed += 1;
        ns.tprint(`\n${entry.host}: ${entry.file} | ${type} | FAILED`);
      }
    }

    ns.tprint(
      `\nSummary: attempted=${attempted} solved=${solved} failed=${failed} skipped=${skipped} dryRun=${
        dryRun ? 'yes' : 'no'
      }`,
    );

    if (daemon) {
      await ns.sleep(interval);
    }
  } while (daemon);
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(FLAG_SCHEMA);
  return [];
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val), 2);
}
