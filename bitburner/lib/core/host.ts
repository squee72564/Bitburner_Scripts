import { NS } from '@ns';

export function isHome(server: string): boolean {
  return server === 'home';
}

export function getServerAvailableRam(ns: NS, host: string): number {
  return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}

export function isServerHackable(ns: NS, host: string): boolean {
  return ns.getServerRequiredHackingLevel(host) <= ns.getHackingLevel();
}
