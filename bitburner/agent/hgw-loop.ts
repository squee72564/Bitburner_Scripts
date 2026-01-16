import { NS } from "@ns";
import { decideHgwOperation } from "lib/hgw-decision";
import { pickTarget } from "lib/host";

export async function main(ns: NS): Promise<void> {
  ns.enableLog("ALL");
  const flags = ns.flags([
    ["server", ""],
    ["s", ""],
    ["sleep", 200],
    ["once", false],
  ]);
  const target = pickTarget(ns, flags);
  const runner = ns.getHostname();
  const sleepMs = Number(flags.sleep) || 200;

  while (true) {
    const decision = decideHgwOperation(ns, target, runner);
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyRatio = maxMoney > 0 ? money / maxMoney : 0;
    const chance = ns.hackAnalyzeChance(target);
    if (decision.op === "skip" || decision.threads < 1) {
      ns.printf(
        "INFO %s skip (%s) threads=%d sec=%.2f/%.2f money=%.0f/%.0f (%.2f) chance=%.2f",
        target,
        decision.reason,
        decision.threads,
        security,
        minSecurity,
        money,
        maxMoney,
        moneyRatio,
        chance
      );
      if (flags.once) {
        return;
      }
      await ns.sleep(sleepMs);
      continue;
    }

    ns.printf(
      "INFO %s op=%s threads=%d reason=%s sec=%.2f/%.2f money=%.0f/%.0f (%.2f) chance=%.2f",
      target,
      decision.op,
      decision.threads,
      decision.reason,
      security,
      minSecurity,
      money,
      maxMoney,
      moneyRatio,
      chance
    );
    if (decision.op === "weaken") {
      await ns.weaken(target, { threads: decision.threads });
    } else if (decision.op === "grow") {
      await ns.grow(target, { threads: decision.threads });
    } else {
      await ns.hack(target, { threads: decision.threads });
    }

    if (flags.once) {
      return;
    }
  }
}
