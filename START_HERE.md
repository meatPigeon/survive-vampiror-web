# Start working on Survive Vampiror

## Open the right project

In Codex, add/open a local project and select:

```text
/home/meatpigeon/Projects/gamedev/survive-vampiror-web
```

Make this the primary folder if the project has multiple folders, then start a new chat there so Codex loads its `AGENTS.md` and iDos MCP tools. See the [official project instructions](https://learn.chatgpt.com/docs/projects?surface=app). The sibling `survive-vampiror` folder contains the original Godot game; use it as the reference for rules and assets.

Node, dependencies, Git, Code MCP and authenticated App Data MCP are already set up on this machine. The checkout contains the native five-location horde campaign on the existing platform host. The campaign and release-readiness changes were committed and pushed on 2026-10-11 (`3cae75e`), and staged as DEV version 6. The GitHub repository is public. Live promotion remains separate. See [release-readiness notes](docs/feature-history/release-readiness.md) for saves, fair location retries, controls, completed browser checks and remaining device checks.

## Continuing with Codex

Read [the encounter's baseline](docs/feature-history/horde-encounter.md) and [the campaign decisions](docs/feature-history/conquest-campaign.md) before changing gameplay. A new request can use this starting prompt:

> Read AGENTS.md, IDOS.md, START_HERE.md and the relevant feature history. Use iDos Code MCP guidance and the sibling Godot project as references. Implement the requested iteration in the horde module, preserving the existing iDos host for authentication and shared UI. Load the project-structure, module-contract and agent-debug-surface skills before changing the canvas module. Verify it locally and keep the result reviewable. Follow the current user instruction about commits, pushes and staged DEV uploads; the current candidate is staged as DEV version 6. Keep live promotion for an explicit publishing request.

The campaign moves through Village Graveyard, Village Chapel, Royal Road, Fortress Outskirts and Castle Courtyard. There are ten knight attacks, temporary recruitment, mines, sling, feast and sprint, five passive perks, Adventure/Relentless difficulty (the original Newbie/Normal rules), wave rewards, and the source models, animations, audio and fonts. Tap/click the ground or WASD/arrows move the horde; bites happen automatically. The first movement command starts combat. Esc pauses; R asks before replacing the current march. X, right-click or Stop cancels a destination. Unlocked abilities use Q/E, sprint uses Space, and the sling fires by tapping/clicking a valid landing spot. Mouse wheel zooms; Pause holds zoom buttons, the route and passive perks. Mobile uses tap-to-move without an arrow pad, with compact combat controls at the screen edges. Keyboard bindings are remappable. Cloud checkpoints, Continue, a field guide, sound/display/motion settings and personal records are now part of the game.

The temporary knight-kill development control has been removed. Inspect progression through normal combat; automated tests cover all five locations and reward gates.

There are five rotating recruitment craters. Corpse mines use only available temporary recruits, planting half of them (at least one) as stationary bombs that the moving horde can walk through.

## Preview and checks

The development preview is already running at http://127.0.0.1:5180/.

If it is stopped, open a terminal in this project and run:

```sh
npm run dev
```

Changes reload automatically in that local preview. The compiled build can be viewed with `npm run build`, then `npm run preview`.

Codex can handle the rest of the workflow:

```sh
npm run check
npm run mcp:check
npm run stage:dev
```

`check` verifies TypeScript, gameplay/input/presentation tests, build, and the real DEV player/backend connection. Tests include all ten attacks, new perks, five-site recruitment, temporary-only passable bombs, a five-wave victory through ordinary movement, valid rewards and repeated checkpoint restores, camera projection, converted rigs, Godot movement fixtures and visual resource lifecycle. Save/controller tests cover write ordering and retries, failed initial reads, corrupted checkpoints, focus loss and control remapping. Real DEV verification includes a private checkpoint write/read on a dedicated smoke player. `mcp:check` verifies both MCP connections and an authenticated DEV configuration read. `stage:dev` checks types, gameplay and the DEV backend, builds and zips the game, uploads it to iDos and returns a DEV test link. Its receipt is `.idos/last-stage.json` (ignored by Git). Verify the exact hosted candidate before live promotion.

`npm run assets:port` regenerates the owned reference assets from the sibling project using Godot 4.7.2. See the [asset origin and export notes](src/modules/horde/assets/reference/README.md). Runtime builds do not need Godot.

## How source and hosting connect

The local files are the source of truth. GitHub stores committed source; the repository is https://github.com/meatPigeon/survive-vampiror-web. Local preview refresh is automatic. Git pushes and staged iDos uploads are explicit operations that Codex handles after a completed iteration. Automatic source synchronization with the browser AI editor is not configured; an uploaded compiled build does not import editable source into that editor.

The build API stores versions under canonical title FYVPZFCO. The uploaded artifact targets FYVPZFCO-DEV, and `stage:dev` always uses `deploy=false`. Live promotion is a separate publishing operation.

Setup verification (2026-10-08): fresh-clone install, types/build/backend checks and both MCP connections pass. The hosted starter passes guest login, game start, result and restart in Chrome with no browser errors.

[Open the previous five-crater build, DEV version 5](https://fyvpzfco-dev.idos.games/v/bld82469a232b124490b01dc2c8d02e327d/index.html). This still contains the three-wave game, with temporary-only passable mines, a low planted pose and amber fuse. Types, 31 tests, build, real DEV backend and both MCP checks passed for that upload. Its validation is recorded in the [encounter history](docs/feature-history/horde-encounter.md); the five-location campaign is now staged as [DEV version 6](https://fyvpzfco-dev.idos.games/v/bldded8bbac29fc46efa5b5e4c39012e9b5/index.html). Hosted browser access was denied during earlier verification; hosted gameplay remains unverified. Live promotion is disabled.

[Previous moonlit graveyard build, DEV version 4](https://fyvpzfco-dev.idos.games/v/bld7d856fe7471442739571c0051503af99/index.html).

[Previous three-wave port, DEV version 3](https://fyvpzfco-dev.idos.games/v/bld71000a964b604278a0c401ceb324bffe/index.html).

[Previously verified DEV starter, version 1](https://fyvpzfco-dev.idos.games/v/blde7df07c403b846bab863c89d235353dd/index.html).
