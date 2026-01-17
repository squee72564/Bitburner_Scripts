# HGW Loop Model (Single Target, Single Controller)

## Prelude
This document specifies a formal model and control strategy for an HGW (hack/grow/weaken) loop when a single script runs on one machine and targets exactly one other machine, with no overlapping scripts targeting the same host. The goal is to maximize money throughput while keeping target security low and money near maximum, within the RAM limits of the runner.

## Assumptions
- The HGW loop script runs on one machine (the runner).
- The runner targets exactly one hackable server (the target).
- No other script is targeting the same target server (no external interference).
- All state changes on the target are produced by this script alone.
- The loop recomputes current server state each cycle.
- Root access to the target already exists.
- Hack/grow/weaken calls are awaited (the loop is sequential).
- Thread counts are integers and are limited by the script thread budget.
- `BasicHGWOptions.threads` accepts non-integers, but we use integer threads for clarity.
- Hacks are only attempted if `getHackingLevel() >= getServerRequiredHackingLevel(target)`.

## Summary of Approach
We treat the target server as a controlled system whose money and security evolve only due to this script. The loop enforces two invariants: security near the minimum and money near the maximum. If security rises, we weaken. If money is low, we grow and then weaken to offset the security increase. If money is high and security is low, we hack a controlled fraction, then regrow and re-weaken. Thread counts are computed from the analysis functions and capped by the script thread budget (which is derived from runner RAM when the script is launched).

## Script Interface (hgw-loop)
The implementation accepts a positional target and optional flags:

- `target` (positional): server hostname, default `n00dles`
- `--money <ratio>`: money threshold (default `0.9`)
- `--hack <ratio>`: hack fraction (default `0.1`)
- `--epsilon <value>`: security buffer (default `1`)

## Formal Mathematical Model

### State Variables
Let the target be server `s`.

- Money: `M_t = ns.getServerMoneyAvailable(s)`
- Max money: `M_max = ns.getServerMaxMoney(s)`
- Security: `S_t = ns.getServerSecurityLevel(s)`
- Min security: `S_min = ns.getServerMinSecurityLevel(s)`
- Base security: `S_base = ns.getServerBaseSecurityLevel(s)`
- Growth parameter: `G = ns.getServerGrowth(s)`
- Player hacking level: `H = ns.getHackingLevel()`
- Required level: `H_req = ns.getServerRequiredHackingLevel(s)`

### Thread Budget (Derived from RAM)
Runner available RAM: `R_avail`

HGW loop script RAM cost: `R_script = ns.getScriptRam("/agent/hgw-loop.js")`

Script thread budget (set when launching the script):

```
T_budget = floor(R_avail / R_script)
```

BasicHGWOptions allow per-call thread usage:

```
0 <= T_h, T_g, T_w <= T_budget
```

Operation RAM costs (for reference):
- hack: `0.1` GB
- grow: `0.15` GB
- weaken: `0.15` GB

### Hack
- Fraction per thread: `p = ns.hackAnalyze(s)`
- Success chance: `c = ns.hackAnalyzeChance(s)`
- Threads: `T_h`

Expected money stolen:

```
E[Delta M_h] = c * min(M_t, M_t * p * T_h)
```

Security increase:

```
Delta S_h = ns.hackAnalyzeSecurity(T_h, s)
```

### Grow
Choose target multiplier `m = M_target / M_t`.

Threads:

```
T_g = ceil(ns.growthAnalyze(s, m))
```

Security increase:

```
Delta S_g = ns.growthAnalyzeSecurity(T_g, s)
```

### Weaken
Required threads to offset security deltas:

```
T_w = ceil((Delta S_h + Delta S_g + (S_t - S_min)) / ns.weakenAnalyze(1))
```

### Timing
Operation durations (milliseconds):

- Hack time: `t_h = ns.getHackTime(s)`
- Grow time: `t_g = ns.getGrowTime(s)`
- Weaken time: `t_w = ns.getWeakenTime(s)`

Note: times depend on current security at call time.

## Pseudocode

```pseudo
function hgwLoop(target, threadBudget):
  while true:
    M = getServerMoneyAvailable(target)
    Mmax = getServerMaxMoney(target)
    S = getServerSecurityLevel(target)
    Smin = getServerMinSecurityLevel(target)

    // 1) Security control
    if S > Smin + SEC_EPSILON:
      Tw = ceil((S - Smin) / weakenAnalyze(1))
      Tw = capThreads(Tw, threadBudget)
      await weaken(target, threads=Tw)
      continue

    // 2) Money control
    if M < Mmax * MONEY_THRESHOLD:
      multiplier = Mmax / max(M, 1)
      Tg = ceil(growthAnalyze(target, multiplier))
      Sw = growthAnalyzeSecurity(Tg)
      Tw = ceil(Sw / weakenAnalyze(1))
      (Tg, Tw) = scaleToBudget({Tg, Tw}, threadBudget)
      await grow(target, threads=Tg)
      await weaken(target, threads=Tw)
      continue

    // 3) Hack cycle (only if hacking level is sufficient)
    if getHackingLevel() < getServerRequiredHackingLevel(target):
      sleep(1s)
      continue
    hackFraction = TARGET_HACK_FRACTION
    desiredHackAmount = M * hackFraction
    Th = ceil(hackAnalyzeThreads(target, desiredHackAmount))
    Th = capThreads(Th, threadBudget)

    Sh = hackAnalyzeSecurity(Th, target)
    Tw = ceil(Sh / weakenAnalyze(1))
    (Th, Tw) = scaleToBudget({Th, Tw}, threadBudget)
    await hack(target, threads=Th)

    // Restore money + security
    M_after = getServerMoneyAvailable(target)
    multiplier = Mmax / max(M_after, 1)
    Tg = ceil(growthAnalyze(target, multiplier))
    Sg = growthAnalyzeSecurity(Tg)
    Tw2 = ceil(Sg / weakenAnalyze(1))
    (Tg, Tw2) = scaleToBudget({Tg, Tw2}, threadBudget)
    await grow(target, threads=Tg)
    await weaken(target, threads=Tw2)
```

Utility helpers referenced:

```pseudo
function capThreads(T, threadBudget):
  return min(T, threadBudget)

function scaleToBudget(threadMap, threadBudget):
  total = sum(threadMap[i])
  if total <= threadBudget:
    return threadMap
  alpha = threadBudget / total
  return { floor(alpha * threadMap[i]) for each i }
```
