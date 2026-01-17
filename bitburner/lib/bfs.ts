import { NS } from "@ns";

export type BfsOptions = {
  shouldAct?: (ns: NS, host: string) => boolean;
  onVisit?: (ns: NS, host: string) => void;
  visited?: Set<string>;
};

export class ServerBfs {
  private readonly ns: NS;
  private readonly shouldAct?: (ns: NS, host: string) => boolean;
  private readonly onVisit?: (ns: NS, host: string) => void;
  readonly visited: Set<string>;

  constructor(ns: NS, options: BfsOptions = {}) {
    this.ns = ns;
    this.shouldAct = options.shouldAct;
    this.onVisit = options.onVisit;
    this.visited = options.visited ?? new Set<string>();
  }

  traverse(start?: string): void {
    const root = start ?? this.ns.getHostname();
    this.visit(root);
  }

  private visit(start: string): void {
    const queue: string[] = [start];
    while (queue.length > 0) {
      const host = queue.shift();
      if (!host || this.visited.has(host)) {
        continue;
      }
      this.visited.add(host);

      if (!this.shouldAct || this.shouldAct(this.ns, host)) {
        this.onVisit?.(this.ns, host);
      }

      for (const next of this.ns.scan(host)) {
        if (!this.visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }
}
