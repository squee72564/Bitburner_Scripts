# HGW Orchestrator Design (Multi-Runner, Single-Target Assignments — Formulas-Aware)

## Prelude
This document defines the formulas-aware orchestrator that launches `/scripts/hgw-loop-formulas.js` across available runner servers. The orchestrator assigns each target server to a single runner (no overlaps) and periodically rebalances assignments. It uses formulas-based scoring and thread estimates when available.

## Assumptions
- The HGW loop runs on one server and targets exactly one other server.
- No two HGW loops should target the same server (no overlaps).
- The orchestrator can kill scripts on runner servers.
- Home is excluded by default, but can be included with `--include-home` (with a RAM reserve).
- Purchased servers are runners only and are never targets.
- All state changes on targets are caused by the HGW loops we start (no external interference).
- Root access to targets is required.
- Targets must be hackable by player hacking level (skip otherwise).
- The orchestrator runs continuously and rebalances on a fixed interval.
- Rebalance interval defaults to 30 minutes (clamped to >= 60s).
- The orchestrator can optionally run in dry-run mode (planning only).

## Use Cases
- Automatically utilize all rooted and purchased servers as runners.
- Ensure every hackable target is covered at least once (if RAM allows).
- Prefer high-value targets for additional capacity after coverage.
- Keep the system updated as the player’s hacking level and network evolve.

## Core Features
- **Runner discovery:** rooted servers + purchased servers, excluding home by default.
- **Target discovery:** rooted, hackable, non-purchased servers with `maxMoney > 0`.
- **Scoring:** configurable scoring formulas to rank target attractiveness.
- **Greedy allocation:** each target requests a desired thread count (max of weaken/grow/hack needs). A runner is chosen by best-fit capacity. Targets may be skipped if no runner has capacity for their desired threads.
- **Multi-target runners:** a single runner can host multiple targets when targets exceed runners or when capacity allows.
- **Rebalancing:** stop current HGW loops and restart with a fresh assignment every rebalance cycle.
- **Full wipe on rebalance:** kill all scripts on runners each cycle. The orchestrator host is not killed to avoid terminating itself.
- **Warnings:** if total available threads < number of targets, warn and cover only top-scoring targets.
- **Dry run:** compute assignments and render the plan UI; no killing or launching occurs.

## Inputs / Flags
- `--score <name>`: choose target scoring model.
  - `moneyChanceTime` (default): `maxMoney * hackChance / hackTime`
  - `money`: `maxMoney`
  - `moneyTime`: `maxMoney / hackTime`
  - `prepAware`: `maxMoney * hackChance / hackTime * (money/maxMoney) * (minSec/sec)`
  - `growthWeighted`: `maxMoney * (growth/100) / hackTime`
- `--rebalance <ms>`: interval in milliseconds. Default: 1_800_000 (30 minutes). Values below 60_000 are clamped to 60_000.
- `--money <ratio>`: forwarded to HGW loop (`--money` threshold).
- `--hack <ratio>`: forwarded to HGW loop (`--hack` fraction).
- `--epsilon <value>`: forwarded to HGW loop (`--epsilon` security buffer).
- `--include-home`: allow home as a runner with a 32GB reserve.
- `--dry`: compute plan and render assignments, but do not kill, scp, or exec.

## Data Collection
### Runner metadata
- `maxRam`, `threadsAvailable = floor(maxRam / hgwScriptRam)` (full wipe before launch).
- If home is included, reservable RAM is `maxRam - 32GB`.
- Purchased servers: `ns.getPurchasedServers()` (added even if not reachable via scan).
- Rooted servers: derived from DFS/BFS over network and `ns.hasRootAccess`.
- Final runner list = union of scanned servers and purchased servers.

### Target metadata
- `maxMoney`, `money`, `minSec`, `sec`, `hackChance`, `hackTime`, `growth`
- `requiredLevel` vs `getHackingLevel()` for filtering

## Assignment Strategy
1) **Compute capacities** for all runners.
2) **Score targets** using selected score function.
3) **Compute desired threads** per target:
   - `weakenThreads` from `(sec - (minSec + epsilon)) / weakenAnalyze(1)`
   - `growThreads` from `growThreads(formulas, maxMoney)` when money is below threshold
   - `hackThreads` from `hackPercent(formulas)` and desired fraction of max money
   - `desiredThreads = max(weakenThreads, growThreads, growWeakenThreads, hackThreads, hackWeakenThreads)`
4) **Greedy placement** by best-fit runner capacity:
   - Pick the smallest runner that can fit the target’s desired threads.
   - If none can fit, fall back to the largest runner (if it has any remaining threads).
   - Targets can be skipped if no runner has remaining capacity.

### Placement (greedy assignment)
- Maintain remaining thread capacity per runner.
- Assign targets by best-fit capacity with no overlap.

## Rebalancing Behavior
- **Startup:** kill all scripts on runners, then assign and launch.
- **Rebalance cycle (every 30 minutes):**
  - Kill all scripts on runners.
  - Recompute runners, targets, scores, and assignments.
  - Launch new HGW loops.

## Launch Details
- `ns.exec("/scripts/hgw-loop-formulas.js", runner, threads, target, --money, --hack, --epsilon)`
- `threads = floor(maxRam / hgwScriptRam)` (scripts are killed before launch, so max RAM is available)
- `ns.scp` copies `/scripts/hgw-loop-formulas.js` and `/lib/hacking-formulas.js` to each runner before `exec`

## Logging & Reporting
- Terminal output is rendered as an **ExpandableList UI** (via `tprintRaw`).
- Sections: runner skips, target skips, target details, run plan, launch results.
- Launch results report `pid` or `FAILED` per assignment.

## Non-Goals
- No partial overlap between targets.
- No targeting of purchased servers.
- Home is excluded by default, but can be included with `--include-home` (32GB reserve).
- No sophisticated scheduling beyond periodic full rebalance.

## Risks / Edge Cases
- If `hgw-loop.js` RAM cost exceeds some runner’s max RAM, that runner is excluded.
- If total threads < targets, some targets remain unassigned.
- Killed scripts could include non-HGW work if the user runs other scripts on runners.
- Full wipe does not include the orchestrator host (to avoid self-termination). Run on home to wipe all other runners each cycle.
- Scoring is heuristic; different formulas may change outcomes.
