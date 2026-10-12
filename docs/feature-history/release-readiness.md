# Release candidate: player experience and reliable progress

## Current update

Responsive follow-up, 2026-10-12 (locally verified; owner authorized deployment): portrait cameras frame the living horde, knight and active recruitment site together, reserving space for warnings and controls. Whole-arena overview remains available by zooming out. Manual zoom starts from the currently visible scale; Auto restores adaptive framing. Resizing reprojects the current encounter immediately, including during pause. Pause zoom also renders immediately without advancing the simulation. Camera regression tests cover objective visibility, zoom direction after rotation and paused projection, rather than only checking a zoom parameter.

The compact HUD reserves both iDos host corners; wide phone landscape places health, population and recruitment in one upper row. Below 1180 pixels the route dock stays in Pause to keep it clear of combat warnings. Pause secondary actions use a compact grid. Mobile rewards use horizontal artwork/text cards with concise effect descriptions, preserving detailed ability help separately.

Fresh local Chrome checks rendered all five locations in portrait, simultaneous abilities/sprint/aim/shockwave warning at 320 and 390 CSS pixels, reward selection/confirmation at 320 pixels, cooldowns, pause route/perks and settings. The integrated iDos host verified Continue, paused camera controls, keyboard access to the route disclosure, the Solana help disclosure and its Open account action. The existing DEV checkpoint remained at 00:52 with 38 survivors. Captures are under `.idos/review/`. Live pointer checks verified movement, automatic bites, Stop, temporary-only mine detonation, sprint, sling cancellation and firing. Final 700×380 and 844×390 landscape, 1024×769 laptop and 1440×900 desktop renders were checked; an overlap between the route dock and warning at 1024 pixels was fixed and rechecked. Browser warnings/errors were absent. Strict types, 85 tests, packaging, real DEV checkpoint round-trips and Solana signature/recovery checks passed. Physical touch hardware and low-end device performance remain unverified. Publication was explicitly authorized after the local checks; the upload receipt will be recorded here.

2026-10-12: mobile combat now uses tap-to-move without the direction pad or its visibility setting. Portrait phones, short landscape screens and coarse-pointer devices use compact health/population/recruitment chips and a single row of ability buttons with readable cooldowns. Route, passive perks and camera zoom are available in Pause; camera adjustment does not resume combat. The old `settings.touch` field remains readable for version 1 save compatibility but no longer controls any UI. Keyboard movement remains available. The first-command hint is reduced to two lines on mobile, and the command bar keeps a small Stop/Cancel control at the edge.

Mobile verification: types, all 83 tests, production build, live DEV checkpoint checks and Solana identity checks passed. A controller regression verifies that paused zoom does not enable movement or advance combat. Chrome verified actual Continue, pause zoom, tap-to-move and Stop; a local, account-free layout fixture exercised both ability slots, sprint, cooldowns, the long shockwave warning and simultaneous sling aiming at phone portrait/landscape widths, including a 320 CSS-pixel width. The aim prompt was moved above attack warnings after that check exposed an overlap. The fixture is ignored and is not part of the shipped game. Chrome's extension UI interrupted the last real-page pause disclosure check. Physical touch hardware and the hosted candidate remain unverified.

2026-10-12: removed the temporary knight-kill button, its controller action and the practice-run state used exclusively by that cheat. It is now absent from local development as well as production. The separate playable field-guide exercises are unchanged.

2026-10-11: version 8 is now live, PROD has the private save schema, and Solana account recovery is implemented. See [Solana identity](solana-identity.md) for current evidence and limits. The original release-candidate history below describes the earlier pass.

## Original October 9 release history

The sections below preserve the initial release pass. Later updates above supersede its direction-pad, development-control and deployment status statements.

## Scope and state

Local release-readiness pass, 2026-10-09. The five-location campaign remains the content boundary: forty starting zombies, five defenders, ten attacks, nine perks and temporary-only passable mines. No Solana gameplay or economy work was added. Release update, 2026-10-11: source committed and pushed as `3cae75e`, then staged as DEV version 6 (`bldded8bbac29fc46efa5b5e4c39012e9b5`, `deploy=false`). The repository is now public. Previous DEV version 5 remains the earlier three-wave game.

The host now opens `horde` after authentication. Its client is injected into the scene; the module never creates another SDK client or logs in itself. The host theme, page title, favicon and description match the game. Source models, animation, music and fonts remain the authored Godot assets. Build output includes Vite's generated dependency notices and the source Noto font license.

## Player experience

- **Continue march** restores a frozen checkpoint. Resume is explicit, so a loading tab cannot spend a run's health or temporary recruits.
- **Retry location** restores a separate checkpoint from the location entrance. A defeated player can recover the entrance roster, upgrades and health instead of being trapped in a nearly-dead autosave. Continue still uses the latest progress; legacy saves without an entrance checkpoint can retry their latest checkpoint.
- **Adventure / Relentless** are the audience-facing names for the existing Newbie / Normal rules. The underlying `normal` boolean and damage balance are unchanged. The menu explains lethal hits and crossbows.
- **Field guide** teaches movement, dodging and recruitment through playable miniature scenes, followed by a visual route/reward chapter. Controls, saves and credits have separate reference views. See [playable field guide](visual-guide.md). An optional first-command hint stays until movement starts. Players can reopen help from Pause.
- **Pointer movement:** click/tap the floor to place a destination marker. The moving horde's center follows it, excluding planted bombs and launched recruits. Keyboard/direction input takes over immediately. Stop, X or right-click cancels; a sling in aim mode uses the same tap to fire and offers an explicit Cancel button.
- **Keyboard:** all ten actions are remappable; conflicts swap assignments, Escape stays reserved for pause. Unassigned arrow keys remain movement aliases. Ctrl/Cmd/Alt browser shortcuts are left alone. Touch direction buttons have pointer capture/release and keyboard press/release behavior.
- **Pause and restart:** switching away, hiding or suspending the game pauses it, cancels held input/aim/destination and attempts a checkpoint save. Starting over asks before replacing progress. Returning to the menu keeps the checkpoint.
- **Settings:** music/effects, graphics Auto/Low/High, ambient motion System/Reduced/Full, hints, direction-button visibility and bindings persist with the player. Auto uses lower pixel density and disables shadows on coarse-pointer devices. Reduced motion quiets ambient scenery, menu animation, particles and CSS animation; combat movement and warnings remain visible.
- **Results and records:** result screens show the conquered route, time, survivors and recruits. The menu keeps up to eight recent finished attempts, total victories, best progress, fastest victory and most survivors. These are private personal records, not a leaderboard. A retry after a recorded defeat gets a new attempt ID.
- Dialogs contain keyboard focus, restore it on close and make the underlying game UI inert. Long dialogs/menu content scroll, controls have 44px minimum targets and HUD insets respect device safe areas.
- Asset failures, unavailable WebGL and lost graphics contexts have visible recovery UI. Interrupted combat is paused. A restored later location fits its camera immediately while paused.

The local **Insta-kill knight** control starts a practice run. It preserves the real checkpoint before the first kill and excludes the remainder of that run from saves and records. It still uses ordinary rewards/travel/victory gates. The control is absent from production bundles.

## Private player data

The `user-custom-data` and `dev-test-loop` Code MCP skills were read before implementing persistence. Only the DEV title was configured through Data MCP:

| Field | Value |
| --- | --- |
| Title | `FYVPZFCO-DEV` |
| KeyID | `horde_profile_v1` |
| Bucket / type | `Private` / `Json` |
| MaxValueLengthBytes | `131072` |
| TTL | None |

The payload holds version 1 settings, two complete encounter checkpoints (latest progress and location entrance) and private run history/counters. The optional entrance checkpoint is backward compatible with earlier version 1 profiles. It grants no economy rewards or competitive progression. It is intentionally client-written and must not become a trusted balance, prize or leaderboard source.

`HordeSaveStore` uses `client.userCustomData.getMyUserCustomData()` and `setPrivateData()`. It coalesces ordinary changes for 800ms and has one ordered writer, leaving at least 650ms after any player-data request before the next one, including load-to-first-save and retry. The service has a shared 500ms server limit as well as a 600ms client endpoint throttle, so pacing writes alone is insufficient. Revisions prevent an earlier request from acknowledging newer unsent state. Failed writes retain the current in-memory state and expose Retry. A failed initial read blocks new play until Retry succeeds, preventing an empty profile from overwriting an unknown cloud checkpoint. Read attempts cannot overlap.

Checkpoints happen at the first ready state, every 30 seconds during combat, on pause, around rewards and at location arrival. The entrance copy changes only when starting a march, arriving at a location or retrying that entrance. They preserve health, roster, lifetimes, active bombs/projectiles, cooldowns, warning/strike state, recruitment and RNG. Restore copies known fields, checks finite numbers, legal states, roster/ability references and campaign bounds, then clears transient events/aim/input and pauses. Invalid checkpoints are discarded with a notice while valid settings and records are retained; a valid entrance copy can recover a damaged latest checkpoint. Defeat retains both checkpoints; victory clears both. Future incompatible balance or schema changes require migration/versioning rather than silently trusting an old world.

Cloud writes are last-write-wins. Use one active game session per player. Closing the browser before a pending write finishes can lose changes since the last successful checkpoint; the UI tells players to check save status. This pass does not add an offline identity or a localStorage save layer. Guest identity and authentication remain owned by iDos.

## Verification

- `npm run check`: strict types, 80 gameplay/presentation/input/save/controller/tutorial/atmosphere tests, production build, and real DEV verification passed. The authored environment placement check verifies that rock geometry remains intact and tall rocks clear the movement area. Portrait ground-frustum checks cover every location, paused resizing, reset and maximum zoom-out.
- The complete five-wave movement strategy now repeatedly serializes/restores checkpoints before reaching victory. Deterministic combat resumes, bombs and sling flights, reward/travel gates, corrupt saves, failed reads/writes, queued updates, SDK write spacing, focus loss, restart confirmation and practice exclusions are covered.
- Controller tests use the actual controller/input/save code with GPU/audio stand-ins. They do not claim to render a browser or test physical touch hardware.
- `npm run verify` authenticated a dedicated DEV smoke player, validated the registered key and wrote/read a 24,433-byte actual profile containing both checkpoints through the real SDK. It restores any prior smoke-player payload and does not reset title data. Browser-player data is separate.
- `npm run mcp:check` passed both Code and Data connections and an authenticated DEV configuration read.
- Local Chrome checks passed for first movement, pointer destination/Stop, settings and key remapping, actual cloud persistence across reload, frozen Continue, cancelled new-march confirmation, modal keyboard focus wrapping, rewards, natural defeat and Retry location. Retry restored forty healthy zombies at 00:00 after a Relentless defeat at 00:49. A complete DEV practice traversal reached the five-location victory screen without changing the real checkpoint or victory records.
- Desktop, 390×844 portrait and 844×390 landscape layouts were rendered. Settings/help/rewards scroll within short screens; attack warnings now clear the route display and direction buttons on portrait. Screenshots include `/tmp/release-phone-final.png`, `/tmp/release-retry-final.png`, `/tmp/release-settings-final.png`, `/tmp/release-phone-rewards.png`, `/tmp/release-landscape-rewards.png` and `/tmp/release-victory.png`. Direction buttons were forced visible for a desktop-browser viewport check; this is not a physical touch-device test. Browser testing left two real test defeats in this DEV player's private history.
- The irregular terrain/border pass was rendered across all five locations through the practice controls. Castle phone inspection exposed foreground floor clipping; adaptive orthographic eye distance and a larger continuous ground fixed it, then the 390×844 render was checked again. Captures are `.idos/organic-{graveyard,chapel,road,outskirts,castle}.png` and `.idos/organic-castle-phone.png`. Browser warnings/errors were absent. The original hints preference and frozen Wave 1/00:00/40-zombie checkpoint were restored afterward.
- Focus-loss/hidden-page pause and failed-save feedback are covered in automated controller/store tests. Browser automation did not produce an actual tab visibility change, so tab-switch behavior still needs a manual device check. No browser console warnings/errors were observed during the rendered pass.
- `npm run package:dev` passed; `.idos/dev-build.zip` passed archive integrity checking. It contains the compiled DEV client only; the subsequent 2026-10-11 checked build was uploaded as DEV version 6. Production bundles omit the local knight-kill control and include dependency/font notices.
- The production build retains the existing large-chunk warning from the host/Three.js/wallet dependency graph. No new dependencies were installed. Actual low-end device performance remains to be measured.

## Before public promotion

1. Check physical touch input, real tab switching, network interruption/recovery and the intended mobile/desktop browsers. The local Chrome pass and automated failure tests do not replace those device checks.
2. Have new players complete Adventure and try Relentless; automated victory is not a human difficulty/readability review. Check sound and frame rate on the intended browsers/devices.
3. Register the same private key on PROD before a public build uses `FYVPZFCO`. The production title was not changed in this pass.
4. Verify the exact hosted DEV version 6 artifact before a separate live promotion. Commit/push and DEV staging are complete; hosted gameplay verification remains outstanding. Earlier denied hosted access must not be bypassed.

## References

Control remapping, self-paced help and avoiding reliance on one input method were informed by the [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/) and [Microsoft XAG 107: Input](https://learn.microsoft.com/en-za/gaming/accessibility/xbox-accessibility-guidelines/107). These choices are not accessibility certification. Dependency notice generation follows the installed Vite API and [official build.license documentation](https://vite.dev/config/build-options#build-license).
