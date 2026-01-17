import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const target = (ns.args[0] as string) || 'n00dles';

  if (!ns.hasRootAccess(target)) {
    ns.tprint(`No root access for ${target}.`);
    return;
  }

  while (true) {
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    if (security > minSecurity + 5) {
      await ns.weaken(target);
    } else if (money < maxMoney * 0.75) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
