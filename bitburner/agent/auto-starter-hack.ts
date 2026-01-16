import { NS } from "@ns";
import { ServerDfs } from "lib/dfs";

const SCRIPT = "agent/starter-hack.js";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("scan");
  const servers = getAllServers(ns);

  const runners = servers.filter(
    (host) => ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0
  );
  const targets = servers.filter((host) => {
    if (host === "home") {
      return false;
    }
    if (!ns.hasRootAccess(host)) {
      return false;
    }
    if (ns.getServerMaxMoney(host) <= 0) {
      return false;
    }
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host);
  });

  const alreadyRunning = getRunningTargets(ns, runners);
  const ramPerThread = ns.getScriptRam(SCRIPT, "home");
  const freeRamByHost = new Map(
    runners.map((host) => [
      host,
      ns.getServerMaxRam(host) - ns.getServerUsedRam(host),
    ])
  );

  for (const target of targets) {
    if (alreadyRunning.has(target)) {
      continue;
    }
    const runner = pickRunner(freeRamByHost, ramPerThread);
    if (!runner) {
      ns.tprint(`WARN no RAM available for ${target}`);
      continue;
    }
    if (runner !== "home") {
      await ns.scp(SCRIPT, runner, "home");
    }
    const pid = ns.exec(SCRIPT, runner, 1, target);
    if (pid !== 0) {
      ns.tprint(`started ${SCRIPT} on ${runner} targeting ${target}`);
      freeRamByHost.set(runner, (freeRamByHost.get(runner) ?? 0) - ramPerThread);
    } else {
      ns.tprint(`WARN failed to start ${target} on ${runner}`);
    }
  }
}

function getAllServers(ns: NS): string[] {
  const servers: string[] = ["home"];
  const dfs = new ServerDfs(ns, {
    onVisit: (_ns, host) => {
      servers.push(host);
    },
  });
  dfs.traverse("home");
  return servers;
}

function getRunningTargets(ns: NS, runners: string[]): Set<string> {
  const running = new Set<string>();
  for (const host of runners) {
    for (const proc of ns.ps(host)) {
      if (proc.filename === SCRIPT && proc.args.length > 0) {
        const target = String(proc.args[0]);
        running.add(target);
      }
    }
  }
  return running;
}

function pickRunner(freeRam: Map<string, number>, ramPerThread: number): string | null {
  for (const [host, free] of freeRam) {
    if (free >= ramPerThread) {
      return host;
    }
  }
  return null;
}
