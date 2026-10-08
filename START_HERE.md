# Start working on Survive Vampiror

## Open the right project

In Codex, add/open a local project and select:

```text
/home/meatpigeon/Projects/gamedev/survive-vampiror-web
```

Make this the primary folder if the project has multiple folders, then start a new chat there so Codex loads its `AGENTS.md` and iDos MCP tools. See the [official project instructions](https://learn.chatgpt.com/docs/projects?surface=app). The sibling `survive-vampiror` folder contains the original Godot game; use it as the reference for rules and assets.

Node, dependencies, Git, Code MCP and authenticated App Data MCP are already set up on this machine. The checkout contains the native three-wave horde game on the existing platform host.

## Continuing with Codex

Read [the encounter's scope and decisions](docs/feature-history/horde-encounter.md) before changing gameplay. A new request can use this starting prompt:

> Read AGENTS.md, IDOS.md, START_HERE.md and the relevant feature history. Use iDos Code MCP guidance and the sibling Godot project as references. Implement the requested iteration in the horde module, preserving the existing iDos host for authentication and shared UI. Load the project-structure, module-contract and agent-debug-surface skills before changing the canvas module. Verify it locally, commit and push the tested changes, and stage a DEV test build. Keep live promotion for an explicit publishing request.

The port has three waves, five knight attacks, temporary recruitment, mines, sling, feast and sprint, Newbie/Normal difficulty, wave rewards, the source models, animations, audio and fonts. WASD/arrows move the horde; bites happen automatically. The first movement command starts combat. Esc pauses; R restarts. Unlocked abilities use Q/E, sprint uses Space, and the sling uses mouse aim, left-click to fire and right-click to cancel. Mouse wheel zooms; touch direction controls appear on touch devices.

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

`check` verifies TypeScript, 23 gameplay/input/presentation tests, build, and the real DEV player/backend connection. Tests include a three-wave victory through ordinary movement and valid rewards, camera projection, converted rigs, Godot movement fixtures and particle lifecycle. `mcp:check` verifies both MCP connections and an authenticated DEV configuration read. `stage:dev` checks types, gameplay and the DEV backend, builds and zips the game, uploads it to iDos and returns a DEV test link. Its receipt is `.idos/last-stage.json` (ignored by Git).

`npm run assets:port` regenerates the owned reference assets from the sibling project using Godot 4.7.2. See the [asset origin and export notes](src/modules/horde/assets/reference/README.md). Runtime builds do not need Godot.

## How source and hosting connect

The local files are the source of truth. GitHub stores committed source; the repository is https://github.com/meatPigeon/survive-vampiror-web. Local preview refresh is automatic. Git pushes and staged iDos uploads are explicit operations that Codex handles after a completed iteration. Automatic source synchronization with the browser AI editor is not configured; an uploaded compiled build does not import editable source into that editor.

The build API stores versions under canonical title FYVPZFCO. The uploaded artifact targets FYVPZFCO-DEV, and `stage:dev` always uses `deploy=false`. Live promotion is a separate publishing operation.

Setup verification (2026-10-08): fresh-clone install, types/build/backend checks and both MCP connections pass. The hosted starter passes guest login, game start, result and restart in Chrome with no browser errors.

[Open the moonlit graveyard build, DEV version 4](https://fyvpzfco-dev.idos.games/v/bld7d856fe7471442739571c0051503af99/index.html). It adds procedural ground, candles, character rim lighting, ambient motes, combat sparks and clearer telegraphs. Types, 23 tests, build, real DEV backend and both MCP checks pass. Local Chrome menu, arena, start, zoom and combat rendering have been inspected without console errors. Current validation and differences from the source are recorded in the [encounter history](docs/feature-history/horde-encounter.md). Hosted browser access was denied during earlier verification; hosted gameplay remains unverified. Live promotion is disabled.

[Previous three-wave port, DEV version 3](https://fyvpzfco-dev.idos.games/v/bld71000a964b604278a0c401ceb324bffe/index.html).

[Previously verified DEV starter, version 1](https://fyvpzfco-dev.idos.games/v/blde7df07c403b846bab863c89d235353dd/index.html).
