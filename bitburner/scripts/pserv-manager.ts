import { AutocompleteData, NS } from '@ns';
import { killOtherInstances } from '/lib/core/process';

const FLAG_SCHEMA: [string, string | number | boolean][] = [
  ['interval', 5000],
  ['reserve-pct', 0.1],
  ['utilization', 0.85],
  ['min-ram', 8],
  ['max-ram', 0],
  ['prefix', 'pserv'],
  ['skip-busy', false],
  ['dry-run', false],
  ['verbose', false],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  killOtherInstances(ns);
  const flags = ns.flags(FLAG_SCHEMA);
  if (flags.help || flags.h) {
    ns.tprint(
      'Usage: run scripts/pserv-manager.js [--interval 5000] [--reserve-pct 0.1] [--utilization 0.85] ' +
        '[--min-ram 8] [--max-ram 0] [--prefix pserv] [--skip-busy] [--dry-run] [--verbose]',
    );
    return;
  }

  ns.disableLog('sleep');
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('getServerMaxRam');
  ns.disableLog('getServerUsedRam');

  const interval = Math.max(250, Number(flags.interval) || 5000);
  const reservePct = clamp(Number(flags['reserve-pct']) || 0, 0, 0.95);
  const utilizationTarget = clamp(Number(flags.utilization) || 0, 0, 1);
  const prefix = String(flags.prefix || 'pserv');
  const minRam = toPow2Ceil(Math.max(2, Number(flags['min-ram']) || 2));
  const maxRamLimit = Number(flags['max-ram']) || 0;
  const skipBusy = Boolean(flags['skip-busy']);
  const dryRun = Boolean(flags['dry-run']);
  const verbose = Boolean(flags.verbose);

  while (true) {
    const maxRam = maxRamLimit > 0 ? toPow2Floor(maxRamLimit) : ns.getPurchasedServerMaxRam();
    if (maxRam < minRam) {
      ns.tprint(`WARN max RAM ${ns.formatRam(maxRam)} is below min RAM ${ns.formatRam(minRam)}.`);
      await ns.sleep(interval);
      continue;
    }

    const purchased = ns.getPurchasedServers();
    const limit = ns.getPurchasedServerLimit();
    const utilization = getFleetUtilization(ns, purchased);

    if (utilization < utilizationTarget) {
      if (verbose) {
        ns.print(
          `Utilization ${(utilization * 100).toFixed(1)}% below target ${(utilizationTarget * 100).toFixed(1)}%.`,
        );
      }
      await ns.sleep(interval);
      continue;
    }

    const money = ns.getServerMoneyAvailable('home');
    const budget = money * (1 - reservePct);
    if (budget <= 0) {
      if (verbose) {
        ns.print('Budget is zero after reserve; waiting.');
      }
      await ns.sleep(interval);
      continue;
    }

    if (purchased.length < limit) {
      const targetRam = getMaxAffordablePurchaseRam(ns, minRam, maxRam, budget);
      if (targetRam >= minRam) {
        const cost = ns.getPurchasedServerCost(targetRam);
        if (cost <= budget) {
          const name = nextPurchasedName(prefix, purchased);
          if (dryRun) {
            ns.tprint(
              `DRY RUN purchase ${name} (${ns.formatRam(targetRam)}) for ${ns.formatNumber(cost)}`,
            );
          } else {
            const host = ns.purchaseServer(name, targetRam);
            if (host) {
              ns.tprint(
                `Purchased ${host} (${ns.formatRam(targetRam)}) for ${ns.formatNumber(cost)}`,
              );
            } else if (verbose) {
              ns.print(`Purchase failed for ${name} (${ns.formatRam(targetRam)}).`);
            }
          }
        }
      }
      await ns.sleep(interval);
      continue;
    }

    const smallest = pickSmallestServer(ns, purchased);
    if (!smallest) {
      await ns.sleep(interval);
      continue;
    }

    const currentRam = ns.getServerMaxRam(smallest);
    if (skipBusy && ns.getServerUsedRam(smallest) > 0) {
      if (verbose) {
        ns.print(`Skipping ${smallest}; scripts are running.`);
      }
      await ns.sleep(interval);
      continue;
    }

    const targetRam = getMaxAffordableUpgradeRam(ns, smallest, minRam, maxRam, budget);
    if (targetRam <= currentRam) {
      if (verbose) {
        ns.print(`No affordable upgrade for ${smallest} beyond ${ns.formatRam(currentRam)}.`);
      }
      await ns.sleep(interval);
      continue;
    }

    const cost = ns.getPurchasedServerUpgradeCost(smallest, targetRam);
    if (cost < 0 || cost > budget) {
      await ns.sleep(interval);
      continue;
    }

    if (dryRun) {
      ns.tprint(
        `DRY RUN upgrade ${smallest} to ${ns.formatRam(targetRam)} for ${ns.formatNumber(cost)}`,
      );
    } else {
      const ok = ns.upgradePurchasedServer(smallest, targetRam);
      if (ok) {
        ns.tprint(
          `Upgraded ${smallest} to ${ns.formatRam(targetRam)} for ${ns.formatNumber(cost)}`,
        );
      } else if (verbose) {
        ns.print(`Upgrade failed for ${smallest} to ${ns.formatRam(targetRam)}.`);
      }
    }

    await ns.sleep(interval);
  }
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(FLAG_SCHEMA);
  return [];
}

function getFleetUtilization(ns: NS, purchased: string[]): number {
  const hosts = purchased;
  let totalMax = 0;
  let totalUsed = 0;
  for (const host of hosts) {
    const maxRam = ns.getServerMaxRam(host);
    totalMax += maxRam;
    totalUsed += ns.getServerUsedRam(host);
  }
  if (totalMax <= 0) {
    return 0;
  }
  return totalUsed / totalMax;
}

function pickSmallestServer(ns: NS, purchased: string[]): string | null {
  let smallest: string | null = null;
  let smallestRam = Infinity;
  for (const host of purchased) {
    const maxRam = ns.getServerMaxRam(host);
    if (maxRam < smallestRam) {
      smallestRam = maxRam;
      smallest = host;
    }
  }
  return smallest;
}

function getMaxAffordablePurchaseRam(
  ns: NS,
  minRam: number,
  maxRam: number,
  budget: number,
): number {
  let best = 0;
  for (let ram = minRam; ram <= maxRam; ram *= 2) {
    const cost = ns.getPurchasedServerCost(ram);
    if (cost <= budget) {
      best = ram;
    }
  }
  return best;
}

function getMaxAffordableUpgradeRam(
  ns: NS,
  host: string,
  minRam: number,
  maxRam: number,
  budget: number,
): number {
  const currentRam = ns.getServerMaxRam(host);
  let start = minRam;
  if (start <= currentRam) {
    start = toPow2Ceil(currentRam + 1);
  }
  let best = currentRam;
  for (let ram = start; ram <= maxRam; ram *= 2) {
    const cost = ns.getPurchasedServerUpgradeCost(host, ram);
    if (cost >= 0 && cost <= budget) {
      best = ram;
    }
  }
  return best;
}

function nextPurchasedName(prefix: string, existing: string[]): string {
  const used = new Set(existing);
  for (let i = 1; i <= 9999; i += 1) {
    const name = `${prefix}-${String(i).padStart(3, '0')}`;
    if (!used.has(name)) {
      return name;
    }
  }
  return `${prefix}-${Date.now()}`;
}

function toPow2Ceil(value: number): number {
  let pow = 1;
  while (pow < value) {
    pow *= 2;
  }
  return pow;
}

function toPow2Floor(value: number): number {
  let pow = 1;
  while (pow * 2 <= value) {
    pow *= 2;
  }
  return pow;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
