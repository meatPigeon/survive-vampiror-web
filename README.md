# Survive Vampiror — iDos web port

Native web source for iDos title `FYVPZFCO`, developed with Codex and iDos Code MCP.

**Start here:** [Open the project and begin coding](START_HERE.md).

Lead forty zombies on a five-location march: Village Graveyard → Village Chapel → Royal Road → Fortress Outskirts → Castle Courtyard. Each defender adds a signature attack, with new passive perks between waves. The port uses the Godot reference's baseline combat, recruitment, difficulty, rewards and authored assets, with procedural scenery, ground shaders, lighting and combat sparks. The existing iDos host handles authentication and shared UI.

Recruit temporary allies at five rotating craters. Corpse mines plant half your available temporary recruits (at least one); the horde can walk through them while their two-second fuse burns. Permanent zombies are never spent as mines.

Tap/click the ground, use WASD/arrows, or hold touch direction buttons to move; bites happen automatically. Q/E use unlocked abilities, Space sprints once unlocked, and the sling fires by tapping a valid landing spot. X/right-click/Stop cancel a destination or aim. Scroll or the phone zoom buttons adjust the view. Esc pauses; R opens a new-march confirmation. Keys are remappable. Keep at least one permanent zombie alive.

The five-location campaign and release-readiness pass are committed on `main`. The game includes cloud checkpoints/Continue, a fair Retry location from the entrance, a field guide, persistent sound/graphics/motion/control settings, automatic pause on focus loss, clearer results and private personal records. Adventure and Relentless are the new names for the original Newbie and Normal rules. See the [release candidate notes and remaining checks](docs/feature-history/release-readiness.md). Its [campaign history](docs/feature-history/conquest-campaign.md) explains the new attacks, five passive perks and extension points. A development-only **Insta-kill knight** button makes the locations and reward flow quick to inspect; those practice runs preserve the real checkpoint and do not enter personal records.

[Contest candidate (DEV version 6)](https://fyvpzfco-dev.idos.games/v/bldded8bbac29fc46efa5b5e4c39012e9b5/index.html) contains the five-location campaign and passes the local release checks and DEV save round-trip. It is staged for testing, not promoted live. Human device checks and public promotion remain outstanding. The earlier [DEV version 5](https://fyvpzfco-dev.idos.games/v/bld82469a232b124490b01dc2c8d02e327d/index.html) contains the older three-wave game.

## Local development

Use Node 22.12+; this workspace pins Node 24.15.0 in `.node-version`. The stack is React, strict TypeScript, Vite and Three.js 0.185.1, matching iDos's 3D module registry.

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

Open the local Vite URL printed by the command (normally `http://localhost:5180`). Local development uses `FYVPZFCO-DEV`; the canonical title identity remains `FYVPZFCO`. Wallet sign-in, guest access and title configuration come from the iDos backend.

```sh
npm run check
npm run mcp:check
```

## Codex workflow

Open this repository as the Codex workspace. Read [IDOS.md](IDOS.md), then use the `idos-code` MCP for SDK guidance and module source. Backend configuration is handled by the separate `idos-data` MCP. OAuth is connected on this machine, and an authenticated DEV configuration read has passed.

The remote is https://github.com/meatPigeon/survive-vampiror-web. The repository is public; anonymous GitHub API access was verified on 2026-10-11, so contest judges can view its source. The existing Godot project has its own repository in the sibling `survive-vampiror` directory. Keep its assets and behavior as references for the port.

GitHub stores the local source. It does not automatically deploy or copy files into the iDos AI Coder. Its built-in GitHub connector requires the iDos Start plan. Code MCP supplies source and SDK guidance. App Data MCP manages backend data and ready-build uploads. Its upload tools require the canonical title ID even for a staged test version, so staging adds an entry to the live title's build history. Live promotion is a separate operation. [DEV version 1](https://fyvpzfco-dev.idos.games/v/blde7df07c403b846bab863c89d235353dd/index.html) is uploaded and verified.

## Tool connection setup on another machine

This machine already has both MCP servers registered. On a different machine with Node and Codex installed:

```sh
codex mcp add idos-code -- npx -y @idosgames/mcp@0.1.28
codex mcp add idos-data --url https://site.idosgames.com/api/v2/mcp
codex mcp login idos-data --scopes config:read,config:write,cloudcode:write,build:write
```

For backend configuration, grant `FYVPZFCO-DEV`. Staged build uploads additionally require `build:write` on canonical `FYVPZFCO`; select the permissions needed by that workflow. Set `tool_timeout_sec = 180` under `[mcp_servers.idos-data]` in Codex configuration for the finish-upload wait, then start a fresh Codex session after connecting. `npm run mcp:check` verifies both connections and reads the DEV currency configuration through Codex's native MCP transport, without starting a model turn or reading OAuth credentials. This machine's Data MCP reports 137 tools and access on both the live and DEV titles; configuration work should target `FYVPZFCO-DEV`.

`npm run check` performs strict TypeScript checks, runs gameplay/input/presentation tests, creates the production bundle, and verifies guest login, player bootstrap, title configuration, the private save schema and a complete checkpoint write/read against the real DEV backend. It needs network access. Tests cover all ten attacks, passive perks and reward gating, five-site recruitment, temporary-only passable mines, wave carryover, terminal outcomes, input cleanup, camera projection and converted rigs, plus a five-wave victory using ordinary movement, valid offered upgrades and repeated checkpoint restores. Release tests cover failed/corrupt saves, write ordering/throttling, controller lifecycle, practice exclusion, remapping and pointer destinations. Presentation checks cover scenery bounds, finite animation, previews, particle lifecycle, planted-bomb pose and GPU resource disposal. `npm run verify` runs only the backend check.

`npm run assets:port` reproducibly exports the source scenes and authored combat clips, copies audio/fonts/UI art and records a revision/hash manifest. It needs the sibling Godot project and Godot 4.7.2; normal builds use the committed assets. The movement fixture can be refreshed with the Godot script described in [the encounter history](docs/feature-history/horde-encounter.md).

## Staged DEV build

```sh
npm run stage:dev
```

Runs type, gameplay and backend checks, creates the DEV archive, uploads it and stages a test version with `deploy=false`. It returns the DEV test URL and writes `.idos/last-stage.json` (ignored). The command uses the canonical identity from `src/idos.title.ts`; configuration and the returned test host use DEV. Live promotion is a separate publishing action.

For a label or a read-only status check:

```sh
npm run stage:dev -- "Five-location release candidate"
npm run stage:dev -- --status blde7df07c403b846bab863c89d235353dd
```

The initial upload/finish workflow was verified end to end. The helper's status mode reads the same staged version without creating an extra build. DEV version 6 is the current staged candidate; its hosted game has not yet had a manual human playthrough.

## DEV build archive

```sh
npm run package:dev
```

This builds for DEV and creates `.idos/dev-build.zip`, with `index.html` at the archive root. The archive is ignored by Git. Vite uses relative asset paths so the bundle works under an iDos test-version path. Packaging uses the system `zip` and `unzip`, both installed on this machine. Only compiled public client files enter the archive; OAuth credentials stay in Codex's own storage.

## Source origin

Bootstrapped from the official `@idosgames/mcp@0.1.28` registry. The title ID and starter-module list were verified in the publisher's browser editor. This is an MCP starter baseline, rather than a byte-for-byte export of every file in the online editor. Registry fingerprints are recorded in [docs/idos-registry.json](docs/idos-registry.json).

The active game module is `horde`; the unregistered `mini-game` folder is retained as a catalog reference. [Horde encounter decisions](docs/feature-history/horde-encounter.md) record source parity, architecture and verification limits. On-chain gameplay integration is a later milestone; load the matching MCP skill before adding a platform feature.
