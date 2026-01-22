/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');

  const maxLevel = 200;
  const maxRam = 64;
  const maxCores = 16;

  while (true) {
    while (ns.hacknet.purchaseNode() !== -1) {
      // Keep purchasing while affordable.
    }

    const count = ns.hacknet.numNodes();
    for (let i = 0; i < count; i++) {
      const stats = ns.hacknet.getNodeStats(i);

      while (
        stats.level < maxLevel &&
        ns.hacknet.getLevelUpgradeCost(i, 1) <= ns.getPlayer().money
      ) {
        if (!ns.hacknet.upgradeLevel(i, 1)) break;
        stats.level += 1;
      }

      while (stats.ram < maxRam && ns.hacknet.getRamUpgradeCost(i, 1) <= ns.getPlayer().money) {
        if (!ns.hacknet.upgradeRam(i, 1)) break;
        stats.ram *= 2;
      }

      while (
        stats.cores < maxCores &&
        ns.hacknet.getCoreUpgradeCost(i, 1) <= ns.getPlayer().money
      ) {
        if (!ns.hacknet.upgradeCore(i, 1)) break;
        stats.cores += 1;
      }
    }

    await ns.sleep(1000);
  }
}
