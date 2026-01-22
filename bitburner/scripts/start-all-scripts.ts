import { NS } from '@ns';

interface ScriptData {
  path: string;
  flags: string[];
};

const SCRIPTS: ScriptData[] = [
  {path: "scripts/root-all.js", flags: ["--daemon"]},
  {path: "scripts/pserv-manager.js", flags: ["--utilization 0.0"]},
  {
    path: "scripts/hgw-orchestrator-batch.js",
    flags: [
      "--include-home",
      "--money-threshold 0.99",
      "--security-threshold 0.001",
      "--hack-fraction 0.33333",
      "--min-hack-chance 0.75",
      "--batch-cycles 15"
    ]
  },
];

export async function main(ns: NS): Promise<void> {
  for (const script of SCRIPTS) {
    const pid = ns.run(
      script.path,
      1,
      ...script.flags 
    );
    if (pid === 0) {
      ns.tprint(`WARN: Failed to start ${script.path} with flags: ${script.flags.join(" ")}`);
    }
  }
}
