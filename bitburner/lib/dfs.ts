import { NS } from "@ns";
import { isHome } from "lib/host";

export type DfsOptions = {
  shouldAct?: (ns: NS, host: string) => boolean;
  onVisit?: (ns: NS, host: string) => void;
  visited?: Set<string>;
};

export class ServerDfs {
  private readonly ns: NS;
  private readonly shouldAct?: (ns: NS, host: string) => boolean;
  private readonly onVisit?: (ns: NS, host: string) => void;
  readonly visited: Set<string>;

  constructor(ns: NS, options: DfsOptions = {}) {
    this.ns = ns;
    this.shouldAct = options.shouldAct;
    this.onVisit = options.onVisit;
    this.visited = options.visited ?? new Set<string>();
  }

  traverse(start?: string): void {
    const root = start ?? this.ns.getHostname();
    this.visit(root);
  }

  private visit(host: string): void {
    if (this.visited.has(host)) {
      return;
    }
    this.visited.add(host);

    if (!isHome(host) && (!this.shouldAct || this.shouldAct(this.ns, host))) {
      this.onVisit?.(this.ns, host);
    }

    for (const next of this.ns.scan(host)) {
      if (!this.visited.has(next)) {
        this.visit(next);
      }
    }
  }
}
