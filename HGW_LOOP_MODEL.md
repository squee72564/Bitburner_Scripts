# HGW Loop Model (Single Target, Single Controller — Formulas-Aware)

## Prelude
This document specifies the current formulas-aware HGW (hack/grow/weaken) loop used by `hgw-loop-formulas`. It models a single script running on one machine that targets exactly one server. The goal is to keep security near minimum, money near max, and hack a controlled fraction when ready, all within the thread budget of the running script.

## Assumptions
- The HGW loop script runs on one machine (the runner).
- The runner targets exactly one hackable server (the target).
- No other script is targeting the same target server (no external interference).
- All state changes on the target are produced by this script alone.
- The loop recomputes current server state each cycle.
- Root access to the target already exists.
- Hack/grow/weaken calls are awaited (the loop is sequential).
- Thread counts are integers and are limited by the script thread budget.
- Hacks are only attempted if `getHackingLevel() >= getServerRequiredHackingLevel(target)`.
- Formulas are used for grow threads and hack percent when available (`Formulas.exe`), with fallbacks to analysis helpers.

## Summary of Approach
We treat the target server as a controlled system whose money and security evolve only due to this script. The loop enforces two invariants: security near the minimum and money near the maximum. If security rises, we weaken. If money is low, we grow and then weaken to offset the security increase. If money is high and security is low, we hack a controlled fraction, then regrow and re-weaken. Thread counts are computed from the analysis functions and capped by the script thread budget (which is derived from runner RAM when the script is launched).

## Script Interface (hgw-loop-formulas)
The implementation accepts a positional target and optional flags:

- `target` (positional): server hostname, default `n00dles`
- `--money <ratio>`: money threshold (default `0.9`)
- `--hack <ratio>`: hack fraction (default `0.1`)
- `--epsilon <value>`: security buffer (default `1`)

## Formal Mathematical Model (Current Implementation)

### State Variables
Let the target be server `s`.

- Money: `M_t = ns.getServerMoneyAvailable(s)`
- Max money: `M_max = ns.getServerMaxMoney(s)`
- Security: `S_t = ns.getServerSecurityLevel(s)`
- Min security: `S_min = ns.getServerMinSecurityLevel(s)`
- Player hacking level: `H = ns.getHackingLevel()`
- Required level: `H_req = ns.getServerRequiredHackingLevel(s)`

### Thread Budget (Runtime Script Threads)
Thread budget comes from the running script’s assigned threads:

```
T_budget = floor(ns.getRunningScript().threads)
```

All computed thread counts are capped independently by `T_budget`.

### Hack (Formulas Percent)
Per-thread fraction: `p = hackPercent(ns, server, player)`

Threads are computed from desired money amount:

```
desiredHack = M_t * hackFraction
T_h = ceil(desiredHack / (M_t * p))   if p > 0
```

Security increase:

```
Delta S_h = ns.hackAnalyzeSecurity(T_h, s)
```

### Grow (Formulas Threads)
Grow threads are computed directly from target money:

```
T_g = growThreads(ns, server, player, M_max)
```

Security increase:

```
Delta S_g = ns.growthAnalyzeSecurity(T_g, s)
```

### Weaken
Weaken is computed from the current delta (or per-operation delta), and capped independently:

```
T_w = ceil((S_t - S_min) / ns.weakenAnalyze(1))
```

For grow/hack follow-ups, weaken threads are computed from the security increase of that operation only.

### Timing
The loop does not use timing functions in its logic.

## Pseudocode (Current Behavior)

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
      Tg = ceil(growThreads(server, player, Mmax))
      Sw = growthAnalyzeSecurity(Tg)
      Tw = ceil(Sw / weakenAnalyze(1))
      (Tg, Tw) = capThreads(Tg), capThreads(Tw)
      await grow(target, threads=Tg)
      await weaken(target, threads=Tw)
      continue

    // 3) Hack cycle (only if hacking level is sufficient)
    if getHackingLevel() < getServerRequiredHackingLevel(target):
      sleep(1s)
      continue
    hackFraction = TARGET_HACK_FRACTION
    desiredHackAmount = M * hackFraction
    p = hackPercent(server, player)
    Th = ceil(desiredHackAmount / (M * p))
    Th = capThreads(Th)

    Sh = hackAnalyzeSecurity(Th, target)
    Tw = ceil(Sh / weakenAnalyze(1))
    (Th, Tw) = scaleToBudget({Th, Tw}, threadBudget)
    await hack(target, threads=Th)

    // Restore money + security (only if below max)
    M_after = getServerMoneyAvailable(target)
    if M_after < Mmax:
      Tg = ceil(growThreads(server, player, Mmax))
      Sg = growthAnalyzeSecurity(Tg)
      Tw2 = ceil(Sg / weakenAnalyze(1))
      (Tg, Tw2) = capThreads(Tg), capThreads(Tw2)
      await grow(target, threads=Tg)
      await weaken(target, threads=Tw2)
```

Utility helper referenced:

```pseudo
function capThreads(T, threadBudget):
  return min(ceil(T), threadBudget)
```
