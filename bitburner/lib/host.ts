import { NS } from "@ns";

export function isHome(server: string): boolean {
  return server === "home";
}

export function pickTarget(ns: NS, flags: { server?: string; s?: string }): string {
  return flags.server || flags.s || ns.getHostname();
}
