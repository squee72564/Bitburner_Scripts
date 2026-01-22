import { NS } from '@ns';

export function killOtherInstances(ns: NS): void {
  const host = ns.getHostname();
  const script = ns.getScriptName();
  const currentPid = ns.getRunningScript()?.pid;
  for (const proc of ns.ps(host)) {
    if (proc.filename === script && proc.pid !== currentPid) {
      ns.kill(proc.pid);
    }
  }
}
