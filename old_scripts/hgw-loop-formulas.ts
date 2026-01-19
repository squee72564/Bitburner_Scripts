import { NS } from '@ns';
import { growThreads as formulaGrowThreads, hackPercent } from 'lib/hacking-formulas';

interface LoopOptions {
  target: string;
  moneyThreshold: number;
  hackFraction: number;
  securityEpsilon: number;
}

function getThreadBudget(ns: NS): number {
  const running = ns.getRunningScript();
  if (!running) {
    return 1;
  }
  return Math.max(1, Math.floor(running.threads));
}

function capThreads(needed: number, budget: number): number {
  if (!Number.isFinite(needed) || needed <= 0) {
    return 0;
  }
  return Math.min(Math.ceil(needed), budget);
}

function parseOptions(ns: NS): LoopOptions | null {
  const flags = ns.flags([
    ['money', 0.9],
    ['hack', 0.1],
    ['epsilon', 1],
    ['help', false],
  ]);

  if (flags.help) {
    ns.tprint(
      'Usage: run scripts/hgw-loop-formulas.js [target] [--money 0.9] [--hack 0.1] [--epsilon 1]',
    );
    return null;
  }

  const target = (flags._ as string[])[0] || 'n00dles';
  const moneyThreshold = Math.min(1, Math.max(0, Number(flags.money)));
  const hackFraction = Math.min(1, Math.max(0, Number(flags.hack)));
  const securityEpsilon = Math.max(0, Number(flags.epsilon));

  return { target, moneyThreshold, hackFraction, securityEpsilon };
}

export async function main(ns: NS): Promise<void> {
  const opts = parseOptions(ns);
  if (!opts) {
    return;
  }

  const { target, moneyThreshold, hackFraction, securityEpsilon } = opts;

  if (!ns.hasRootAccess(target)) {
    ns.tprint(`No root access for ${target}.`);
    return;
  }

  const threadBudget = getThreadBudget(ns);

  while (true) {
    const server = ns.getServer(target);
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const weakenPerThread = ns.weakenAnalyze(1);

    if (security > minSecurity + securityEpsilon) {
      const neededWeaken = (security - minSecurity) / weakenPerThread;
      const weakenThreads = capThreads(neededWeaken, threadBudget);
      if (weakenThreads > 0) {
        await ns.weaken(target, { threads: weakenThreads });
      } else {
        await ns.sleep(200);
      }
      continue;
    }

    if (maxMoney > 0 && money < maxMoney * moneyThreshold) {
      const neededGrow = formulaGrowThreads(ns, server, player, maxMoney);
      const growThreads = capThreads(neededGrow, threadBudget);
      if (growThreads > 0) {
        const growSec = ns.growthAnalyzeSecurity(growThreads, target);
        const neededWeaken = growSec / weakenPerThread;
        const weakenThreads = capThreads(neededWeaken, threadBudget);
        await ns.grow(target, { threads: growThreads });
        if (weakenThreads > 0) {
          await ns.weaken(target, { threads: weakenThreads });
        }
      } else {
        await ns.sleep(200);
      }
      continue;
    }

    const hackingLevel = ns.getHackingLevel();
    const requiredLevel = ns.getServerRequiredHackingLevel(target);
    if (hackingLevel < requiredLevel) {
      await ns.sleep(1000);
      continue;
    }

    const desiredHackAmount = money * hackFraction;
    const pct = hackPercent(ns, server, player);
    const neededHack = pct > 0 ? desiredHackAmount / (money * pct) : 0;
    const hackThreads = capThreads(neededHack, threadBudget);
    if (hackThreads <= 0) {
      await ns.sleep(200);
      continue;
    }

    const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);
    const hackWeakenThreads = capThreads(hackSec / weakenPerThread, threadBudget);

    await ns.hack(target, { threads: hackThreads });

    if (hackWeakenThreads > 0) {
      await ns.weaken(target, { threads: hackWeakenThreads });
    }

    const moneyAfter = ns.getServerMoneyAvailable(target);
    if (maxMoney > 0 && moneyAfter < maxMoney) {
      const serverAfter = ns.getServer(target);
      const neededGrow = formulaGrowThreads(ns, serverAfter, player, maxMoney);
      const growThreads = capThreads(neededGrow, threadBudget);
      if (growThreads > 0) {
        const growSec = ns.growthAnalyzeSecurity(growThreads, target);
        const growWeakenThreads = capThreads(growSec / weakenPerThread, threadBudget);
        await ns.grow(target, { threads: growThreads });
        if (growWeakenThreads > 0) {
          await ns.weaken(target, { threads: growWeakenThreads });
        }
      }
    }
  }
}
