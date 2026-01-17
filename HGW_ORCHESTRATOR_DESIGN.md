# HGW Orchestrator Design (Multi-Runner, Single-Target Assignments)

## Prelude
This document defines a long-running orchestration script that launches the advanced HGW loop (`/agent/hgw-loop.js`) across all available runner servers. The orchestrator assigns each target server to exactly one runner, ensuring no overlaps, and periodically rebalances assignments to reflect the current game state (new roots, more RAM, higher hacking level). The script prioritizes target coverage first, then allocates remaining capacity to the best-scored targets.

## Assumptions
- The HGW loop runs on one server and targets exactly one other server.
- No two HGW loops should target the same server (no overlaps).
- The orchestrator can kill scripts on runner servers.
- Home is never used as a runner.
- Purchased servers are runners only and are never targets.
- All state changes on targets are caused by the HGW loops we start (no external interference).
- Root access to targets is required.
- Targets must be hackable by player hacking level (skip otherwise).
- The orchestrator runs continuously and rebalances on a fixed interval.
- Rebalance interval is long (30 minutes).
- The orchestrator can optionally run in dry-run mode (planning only).

## Use Cases
- Automatically utilize all rooted and purchased servers as runners.
- Ensure every hackable target is covered at least once (if RAM allows).
- Prefer high-value targets for additional capacity after coverage.
- Keep the system updated as the player’s hacking level and network evolve.

## Core Features
- **Runner discovery:** rooted servers + purchased servers, excluding home.
- **Target discovery:** rooted, hackable, non-purchased servers with `maxMoney > 0`.
- **Scoring:** configurable scoring formulas to rank target attractiveness.
- **Coverage-first allocation:** guarantee 1 thread per target if total threads allow.
- **Capacity-based allocation:** distribute remaining threads to best targets on the same runner.
- **Multi-target runners:** a single runner can host multiple targets when targets exceed runners or when capacity allows.
- **Rebalancing:** stop current HGW loops and restart with a fresh assignment every 30 minutes.
- **Full wipe on rebalance:** kill all scripts on runners each rebalance cycle (same as startup). The orchestrator host is not killed to avoid terminating itself.
- **Warnings:** if total available threads < number of targets, warn and cover only top-scoring targets.
- **Dry run:** compute and print assignments without killing or launching scripts.

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
- `--dry`: compute plan and print assignments, but do not kill, scp, or exec.

## Data Collection
### Runner metadata
- `maxRam`, `threadsAvailable = floor(maxRam / hgwScriptRam)` (full wipe before launch).
- Purchased servers: `ns.getPurchasedServers()` (added even if not reachable via scan).
- Rooted servers: derived from DFS/BFS over network and `ns.hasRootAccess`.
- Final runner list = union of scanned servers and purchased servers.

### Target metadata
- `maxMoney`, `money`, `minSec`, `sec`, `hackChance`, `hackTime`, `growth`
- `requiredLevel` vs `getHackingLevel()` for filtering

## Assignment Strategy
1) **Compute capacities** for all runners.
2) **Score targets** using selected score function.
3) **Coverage phase** (if possible):
   - If total threads >= target count, assign 1 thread to every target.
4) **Shortfall behavior** (if total threads < target count):
   - Print a warning.
   - Assign one thread to the top-scoring targets until threads are exhausted.
5) **Boost phase** (if threads remain after coverage):
   - Distribute remaining threads to the highest-scoring targets, keeping each target bound to a single runner.

### Placement (greedy assignment)
- Maintain remaining thread capacity per runner.
- Coverage step assigns each target to the runner with the most remaining capacity.
- Boost step adds extra threads to existing assignments if that runner still has capacity.
- A target is always bound to a single runner.

## Rebalancing Behavior
- **Startup:** kill all scripts on runners, then assign and launch.
- **Rebalance cycle (every 30 minutes):**
  - Kill all scripts on runners.
  - Recompute runners, targets, scores, and assignments.
  - Launch new HGW loops.

## Launch Details
- `ns.exec("/agent/hgw-loop.js", runner, threads, target, --money, --hack, --epsilon)`
- `threads = floor(maxRam / hgwScriptRam)` (scripts are killed before launch, so max RAM is available)
- `ns.scp` copies `/agent/hgw-loop.js` to each runner before `exec`

## Logging & Reporting
- Summary of runners and total thread capacity.
- Target count and top-ranked targets.
- Warning if coverage is incomplete.
- Per-assignment output: runner → target, threads.
- Dry run prints assignments without modifying state.

## Non-Goals
- No partial overlap between targets.
- No targeting of purchased servers.
- No use of home as a runner.
- No sophisticated scheduling beyond periodic full rebalance.

## Risks / Edge Cases
- If `hgw-loop.js` RAM cost exceeds some runner’s max RAM, that runner is excluded.
- If total threads < targets, some targets remain unassigned.
- Killed scripts could include non-HGW work if the user runs other scripts on runners.
- Full wipe does not include the orchestrator host (to avoid self-termination). Run the orchestrator on home if you want all other runners wiped each cycle.
- Scoring is heuristic; different formulas may change outcomes.
