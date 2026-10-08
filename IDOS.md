# IDOS.md — project guide

Every AI agent working on this game reads this file first: the platform's AI editor loads it into
context on every run, and external agents reach it through `AGENTS.md` / `CLAUDE.md`. Keep it short
and evergreen — what the game is, how the project is laid out, rules that hold for all of it. The
history of individual features does NOT belong here (see "Feature history" at the end).

## This game

<!-- 2–4 lines, filled in once the direction is clear: genre, core loop, target platform, tone.
     Update it when the concept changes — not with every feature. -->

Survive Vampiror is a low-poly 3D horde game: the player commands zombies against three escalating knight waves. This repository is its native iDos web port, developed locally with Codex and iDos Code MCP. The current checkout contains the platform starter; horde gameplay is not implemented yet.

## Installed modules

Mirror of the `modules` array in `src/modules.ts` (the source of truth). Update both lists when
adding or removing modules in this local repository.

<!-- idos:modules:start -->

- `inventory`
- `quests`
- `friends`
- `invite`
- `mailbox`
- `profile`
- `mini-game`
<!-- idos:modules:end -->

## How the project is built

**The base + modules** on the iDosGames SDK. The base is sign-in and the lobby; everything else — the
systems (shop, heroes, leaderboards…) and the games — is a module. Two kinds of game:

- a game whose route says `inLobby: true` (idle-rpg) lives INSIDE the lobby: after sign-in the player
  lands in it, the lobby's balances and profile on top, its tabs at the bottom, "Play" is the game
  itself, any other tab opens that system's screen (`src/base/lobby/GameFrame.tsx` — the host's
  `header`/`footer` panel slots lay the game out between them);
- any other game (voxelcraft, board-game) takes the whole screen: sign-in → the lobby, "Play" launches
  it, a small button over the game returns to the lobby (`src/base/lobby/BackToLobby.tsx`).

- `src/main.tsx` — creates ONE `IDosGamesClient` and calls `mountHost(...)` with the base first, then
  the modules. The host signs the player in before any module runs; modules never create a client or
  log in themselves.
- `src/base/` — **the base**, ordinary code of this project: `login/` (the sign-in and play-access
  screens), `lobby/` (tabs, balances, wallet, profile, "Play"), `module.ts` (`baseModule`). It takes
  the shared-UI roles `currency-bar`, `wallet`, `account`, `menu`, `modes`, so a game hides its own
  balances and wallet by itself (`ctx.sharedUi.shouldDraw`) — don't edit games for that.
- `src/app.config.ts` — what happens after sign-in (`start`: `"game"` — straight into the game, the
  default; `"lobby"`; or a game's mode id) and the order of the lobby's tabs. The look, animations and sounds of the WHOLE app — sign-in included:
  `src/ui.config.ts` (the only file a restyle edits; see the `idosgames-ui-kit` skill).
- `src/modules.ts` — the composition list. The platform regenerates it in the browser editor;
  locally maintain it when adding or removing modules. It holds only imports and the `modules` array. It is
  also the list of what the app has: remove a system here and its tab is gone.
- `src/modules/<id>/` — one folder per module: the catalog's systems and games and the game's own
  modules alike. A system registers its screen with `ctx.features.register` (a lobby tab) and hides it
  while the title has nothing for it (`available: false` + `ctx.features.setAvailable`); a game
  registers a route (`ctx.registerRoute`) and gets a "Play" button.
- `src/shared/` — created when needed: code two or more of this game's modules share.
- `src/idos.title.ts` — the verified identity `FYVPZFCO`, seeded from the publisher editor.
  Keep this canonical identity stable; DEV selection belongs in `.env.local` or the hosting address.
- `src/config.ts` — the official environment resolver. Keep the SDK contract intact; browser AI
  builds replace it with the platform copy, while local Vite builds use this file.
  Resolves the effective title and environment: identity from `src/idos.title.ts`, DEV vs PROD from
  the address (`{id}-dev.idos.games` vs `{id}.idos.games`) — never from the link's query. Never read
  the title from the URL yourself: use `client.titleID`, or `ctx.titleId` inside a module's `setup()`.
- `src/env.ts` — build-time values from `.env.local` (local development only).
- `src/walletLogin.tsx` — the wallet sign-in button, generated for web3 titles; safe to edit.
- `docs/idos-registry.json` records this starter's catalog versions and source fingerprints.
  The browser editor has its own generated module lock; it is not part of this manual baseline.

## Where new code goes

Full standard: the `idosgames-project-structure` skill — load it before creating a module, touching
`src/shared/`, or moving code around.

- A catalog module already does it (a shop, heroes, leaderboards, rewards, …) → install that module
  instead of rebuilding it.
- It extends an existing module → change that module. The lobby, sign-in, balances, wallet and
  profile → change `src/base/`.
- It is its own mode, screen or system → a NEW module `src/modules/<feature-id>/` (kebab-case):
  `index.ts` exporting `<camelCaseId>Module`, `module.ts`, `module.meta.json`, and as needed
  `components/` (React UI), `game/` (engine & simulation), `data/` (static tables), `react/` (hooks,
  context). Register it in `src/modules.ts`. A screen → `ctx.features.register` (it becomes a lobby
  tab); a mode of its own → `ctx.registerRoute` (it gets a "Play" button).
- To open another system's screen from your code: `ctx.features.open("store")` — never import it. To
  switch modes: `ctx.navigate("lobby")` or a game's mode id. Other UI shown over every mode → a panel
  with `activeOnly: false`.
- Modules never reach into each other: a module imports only its own folder, `src/shared/` and npm
  packages — never another module's files or host files. Durable shared state lives in the SDK
  client; live signals go through `ctx.events` with typed topics
  (`defineTopic("<module-id>:<event>@1", shape({…}))`) declared in the module's `module.meta.json`;
  to listen to another module, copy its topic, never import it.
- `src/shared/` holds code TWO or more modules need (code one module needs stays inside it), by
  purpose — `shared/ui/`, `shared/types/`, `shared/utils/`: types, constants, UI, pure helpers; no
  game state or logic. It never imports a module.
- When a change adds a new responsibility to a file past ~400 lines, put that part in its own file.

## The SDK is npm packages — its source is NOT in this project

`@idosgames/core`, `@idosgames/react`, `@idosgames/module-sdk`, `@idosgames/app-shell` are
dependencies in `package.json`. The browser AI Coder has no `node_modules` or SDK declarations
to inspect. Local installs do, but the matching MCP skills remain the first source for supported APIs.

1. **Load the matching skill first.** Skills are the authoritative recipes for this SDK — one per
   service (store, currency, item, quest, leaderboard, auth, blockchain, …).
2. Then copy the patterns from the modules already in `src/modules/`.
3. Never invent an SDK method, hook, or type name — it looks plausible and fails the build.

`client.<service>.<action>()` returns `OperationResult<T>` (check `isOk` / `isFail`; it does not
throw). In React, reach the client with `useIDosGamesClient()` and player state with
`useUserState()` from `@idosgames/react`.

## Backend features live in the Title configuration, not in this repo

Currencies, items, characters, store offers, quests, lootboxes, leaderboards and seasons are
configured per environment in the platform. There is **no config file in this project** — do not
create `config/*.json`; it would be ignored. Write code against ids that exist in the title; if a
feature needs an entity that is not configured yet, name exactly what has to be added instead of
inventing ids.

## Stack & running

- React 19 + TypeScript (strict) + Vite 8 + Three.js 0.185.1 (matching the Code MCP
  3D modules), ready for the existing Godot game's 3D port.
- In the platform's AI editor there is no terminal and no package install: the project is built on
  the server after each turn and shown in the live preview. Use only what `package.json` lists.
- Locally (exported project or an external agent): `npm ci --ignore-scripts`, then `npm run dev`;
  `npm run check` verifies types, build and the live DEV backend. `npm run mcp:check` verifies both MCP connections.
- Client code ships to players: never put secrets, keys or tokens in any file here.
- Assets are not stored in the project — generated images/audio/3D are CDN URLs; reference those.

## Feature history — how this project remembers

This file stays short on purpose: it is loaded on every run, so every paragraph here is paid for
by all future work. When a game system or feature is done and something about it is worth
remembering that the code does not show — why it is designed this way, a non-obvious constraint,
a decision the user made — write it to `docs/feature-history/<slug>.md` (one file per system;
update that file when the system changes) and add ONE line to `docs/feature-history/README.md`:
`- [Title](slug.md) — one-line gist`. Never append a feature write-up to this file. Those entries
are not loaded automatically: open the relevant one before changing that system.
