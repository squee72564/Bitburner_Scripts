import { NS } from '@ns';

interface ScriptData {
  path: string;
  args: (string | number)[];
}

const SCRIPTS: ScriptData[] = [
  { path: 'scripts/root-all.js', args: ['--daemon'] },
  { path: 'scripts/pserv-manager.js', args: ['--utilization', 0.0] },
  {
    path: 'scripts/hgw-orchestrator-batch.js',
    args: [
      '--include-home',
      '--money-threshold',
      0.99,
      '--security-epsilon',
      0.001,
      '--hack-fraction',
      0.33333,
      '--min-hack-chance',
      0.75,
      '--batch-cycles',
      15,
    ],
  },
  { path: 'scripts/coding-contract-solve.js', args: ['--daemon'] },
];

export async function main(ns: NS): Promise<void> {
  for (const script of SCRIPTS) {
    const pid = ns.run(script.path, 1, ...script.args);
    if (pid === 0) {
      ns.tprint(`WARN: Failed to start ${script.path} with args: ${script.args.join(' ')}`);
    }
  }
}
