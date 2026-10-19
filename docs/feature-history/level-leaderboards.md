# Per-location best times

## Behavior and boundaries

Added 2026-10-19. The five campaign locations each have separate Adventure and Relentless all-time boards. Lower combat time wins; the screen displays milliseconds, server ranks, player names and the local player's position. Ties follow the platform rule (first to reach that score). The screen comes from the iDos `leaderboard` catalog module 0.1.1, customized for time formatting, two compact selectors, cancellable loading and visible Retry. Game entry points use `ctx.features.open`, with no cross-module imports. Shared IDs/formatting are pure helpers.

`levelElapsed` advances only with active combat. It freezes while ready, paused, choosing a reward or travelling; each new defender resets it. Continue carries the split, and Retry uses the entrance checkpoint, rather than subtracting total campaign time or charging failed attempts. A clear (including the final castle) records a positive integer millisecond value. Defeats and unfinished levels do not post. Campaign perks and survivors carry between levels; these are campaign splits, not equal-loadout time trials.

Old version-1 saves stay readable. Wave 1 can recover its timer from total combat time. A later legacy checkpoint gets a sentinel of -1 until the next level; an unknown partial time never enters a board. Private personal records remain separate from public leaderboard entries.

## Submission and reliability

The profile's small `levelBests` map stores each best and its pending-upload flag. Before posting, the ordered save writer persists the outbox. `submitScoresBatch` only sends pending bests; the server's BestTime aggregation prevents replayed requests or slower clears overwriting faster times. Per-item confirmations clear only the corresponding pending entry. A newer time arriving during an old request stays pending. Server bests from another device replace slower local bests. Network/save errors retain data and expose Retry from menu, Pause and results; reload also retries. Opening the leaderboard pauses the game.

Scores are client-reported. Client validation, persistence and server BestTime aggregation are not authoritative gameplay verification or an anti-cheat system. No prizes, currency, token grants or payout logic use these results. Wallet identity still belongs to the host, and no wallet transaction is involved.

## Backend configuration

Configured **DEV only**, title `FYVPZFCO-DEV`, through iDos Data MCP after reading the existing Leaderboard section. IDs are `horde_adventure_{1..5}_v1` and `horde_relentless_{1..5}_v1`, in campaign order. Existing unrelated definitions must be preserved whenever configuring another environment.

Every board uses `ScoreAggregation: BestTime`, `Schedule: { Mode: Cyclic, IsActive: true, Cyclic: { Reset: Never } }`, `TopUsersLimit: 100`, `MinScoreToEnterTop: 1`, `BracketSize: 0`, enabled, with no rank rewards or milestones. Score sources explicitly contain `ClientScore` with `Limits: { PerActivationCap: 86400000, DailyCap: 300 }` (milliseconds, matching the save's 24-hour bound).

The older local Code MCP recipe omitted the now-required ClientScore permission. The current Data MCP leaderboard skill and real server error established that requirement. After saving it, the score API initially still served the earlier config; a later fresh verification saw the update and succeeded. Do not weaken or bypass a score rejection; check published configuration and propagation.

## Verification and release

95 automated tests and strict types pass. Regression coverage includes pause/travel exclusions, split reset, legacy saves, all five clears including victory, difficulty separation, persistent pending scores, duplicate calls, partial failures, newer in-flight records and cross-device server bests. Controller tests exercise actual clear-event submission and frozen Continue. Production packaging passes with the existing dependency chunk-size warning.

`npm run verify:leaderboards` exercises the real DEV backend using two dedicated smoke accounts: all ten definitions, faster/slower replacement, ascending two-player ranking, per-location/difficulty isolation, combined top/progress reads and rejection of zero at the SDK boundary. Smoke entries exist only in DEV. The script runs during `check` and `stage:dev`.

Local Chrome review covered 320×640 portrait, 844×390 landscape and 1440×900 desktop CSS viewports. The live DEV results, difficulty/location changes, empty boards, Refresh, and menu/Pause entry points were checked. Closing the board returned to the same paused wave-1 checkpoint (00:15, forty survivors), with no browser warnings or errors in the final session. The clear-time reward row was also inspected at 320px in the isolated local fixture. Screenshots are in `.idos/review/leaderboard-{phone,desktop,clear-phone}.png` (ignored local evidence).

The review exposed the SDK Window's implicit grid column expanding beyond 320px. A small base-owned overlay layout rule constrains the track; screens can opt out of its balance counters through `data-hide-overlay-balances`. The leaderboard does so, leaving space for its title and Close. Its own grid tracks and name truncation keep complete times visible without horizontal overflow.

Staged as **DEV version 13**, build `bld661d0c899af24b118a31e83b5f347b7b`, on 2026-10-19: [review candidate](https://fyvpzfco-dev.idos.games/v/bld661d0c899af24b118a31e83b5f347b7b/index.html). The upload helper ran strict types, all 95 tests, live private-save, Solana-signature and leaderboard checks, then built and validated the 4,974,563-byte ZIP. Receipt: `Staged`, `livePromotion: false`. Hosted browser gameplay remains unverified because the saved browser preference blocks the DEV hosting domain; local rendering and real backend verification are separate evidence.

PROD configuration and the public version 12 game have not been changed. A future approved promotion must add these same definitions to PROD, read them back and verify the production environment before switching the public build. Do not copy test-player data.
