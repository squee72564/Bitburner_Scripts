import { NS } from "@ns";
import { ServerDfs } from "lib/dfs";

const PORT_OPENERS: Array<{
  file: string;
  open: (ns: NS, host: string) => void;
}> = [
  { file: "brutessh.exe", open: (ns, host) => ns.brutessh(host) },
  { file: "ftpcrack.exe", open: (ns, host) => ns.ftpcrack(host) },
  { file: "relaysmtp.exe", open: (ns, host) => ns.relaysmtp(host) },
  { file: "httpworm.exe", open: (ns, host) => ns.httpworm(host) },
  { file: "sqlinject.exe", open: (ns, host) => ns.sqlinject(host) },
];

export async function main(ns: NS): Promise<void> {
  ns.disableLog("scan");
  const availableOpeners = getAvailablePortOpeners(ns);

  const dfs = new ServerDfs(ns, {
    shouldAct: (_ns: NS, host: string) => {
      if (ns.hasRootAccess(host)) {
        return false;
      }
      const requiredPorts = ns.getServerNumPortsRequired(host);
      return availableOpeners.length >= requiredPorts;
    },
    onVisit: (_ns: NS, host: string) => {
      const requiredPorts = ns.getServerNumPortsRequired(host);
      if (requiredPorts > 0) {
        openPorts(ns, host, requiredPorts, availableOpeners);
      }
      if (ns.nuke(host)) {
        ns.tprint(`nuked ${host}`);
      }
    },
  });

  dfs.traverse();
}

function getAvailablePortOpeners(ns: NS): Array<(ns: NS, host: string) => void> {
  return PORT_OPENERS.filter(({ file }) => ns.fileExists(file, "home")).map(
    ({ open }) => open
  );
}

function openPorts(
  ns: NS,
  host: string,
  requiredPorts: number,
  openers: Array<(ns: NS, host: string) => void>
): void {
  for (let i = 0; i < openers.length && i < requiredPorts; i += 1) {
    openers[i](ns, host);
  }
}
