# Start coding Survive Vampiror

## Open the right project

In Codex, add/open a local project and select:

```text
/home/meatpigeon/Projects/gamedev/survive-vampiror-web
```

Make this the primary folder if the project has multiple folders, then start a new chat there so Codex loads its `AGENTS.md` and iDos MCP tools. See the [official project instructions](https://learn.chatgpt.com/docs/projects?surface=app). The sibling `survive-vampiror` folder contains the original Godot game; use it as the reference for rules and assets.

Node, dependencies, Git, Code MCP and authenticated App Data MCP are already set up on this machine. The checkout contains a working platform starter; the horde gameplay is the next task.

## First message to Codex

Paste this to begin the first playable slice:

> Read AGENTS.md, IDOS.md and START_HERE.md. Use iDos Code MCP guidance and the sibling Godot project as references. Port the minimum playable horde encounter into a new Three.js module: one arena, one AI-controlled knight, a player-controlled zombie horde, movement, combat, damage/death, win/loss and restart. Keep this iteration small. Use the existing iDos host for authentication and shared UI. Load the project-structure, module-contract and agent-debug-surface skills before writing the canvas module. Verify it locally, commit and push the tested changes, and stage a DEV test build. Keep live promotion for an explicit publishing request.

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

`check` verifies TypeScript, build, and the real DEV player/backend connection. `mcp:check` verifies both MCP connections and an authenticated DEV configuration read. `stage:dev` checks types and the DEV backend, builds and zips the game, uploads it to iDos and returns a DEV test link. Its receipt is `.idos/last-stage.json` (ignored by Git).

## How source and hosting connect

The local files are the source of truth. GitHub stores committed source; the repository is https://github.com/meatPigeon/survive-vampiror-web. Local preview refresh is automatic. Git pushes and staged iDos uploads are explicit operations that Codex handles after a completed iteration. Automatic source synchronization with the browser AI editor is not configured; an uploaded compiled build does not import editable source into that editor.

The build API stores versions under canonical title FYVPZFCO. The uploaded artifact targets FYVPZFCO-DEV, and `stage:dev` always uses `deploy=false`. Live promotion is a separate publishing operation.

Setup verification (2026-10-08): fresh-clone install, types/build/backend checks and both MCP connections pass. The hosted starter passes guest login, game start, result and restart in Chrome with no browser errors.

[Open verified DEV version 1](https://fyvpzfco-dev.idos.games/v/blde7df07c403b846bab863c89d235353dd/index.html).
