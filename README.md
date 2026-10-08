# Survive Vampiror — iDos web port

Native web source for iDos title `FYVPZFCO`, developed with Codex and iDos Code MCP.

**Start here:** [Open the project and begin coding](START_HERE.md).

The gameplay goal is to command a zombie horde against three escalating knight waves. This initial repository contains the official iDos host and the seven starter modules currently listed in the title: inventory, quests, friends, invite, mailbox, profile and mini-game. The horde gameplay has not been ported yet.

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

The private remote is https://github.com/meatPigeon/survive-vampiror-web. Commit and push changes with normal Git commands. The existing Godot project has its own repository in the sibling `survive-vampiror` directory. Keep its assets and behavior as references for the port.

GitHub stores the local source. It does not automatically deploy or copy files into the iDos AI Coder. Its built-in GitHub connector requires the iDos Start plan. Code MCP supplies source and SDK guidance. App Data MCP manages backend data and ready-build uploads. Its upload tools require the canonical title ID even for a staged test version, so staging adds an entry to the live title's build history. Live promotion is a separate operation. [DEV version 1](https://fyvpzfco-dev.idos.games/v/blde7df07c403b846bab863c89d235353dd/index.html) is uploaded and verified.

## Tool connection setup on another machine

This machine already has both MCP servers registered. On a different machine with Node and Codex installed:

```sh
codex mcp add idos-code -- npx -y @idosgames/mcp@0.1.28
codex mcp add idos-data --url https://site.idosgames.com/api/v2/mcp
codex mcp login idos-data --scopes config:read,config:write,cloudcode:write,build:write
```

For backend configuration, grant `FYVPZFCO-DEV`. Staged build uploads additionally require `build:write` on canonical `FYVPZFCO`; select the permissions needed by that workflow. Set `tool_timeout_sec = 180` under `[mcp_servers.idos-data]` in Codex configuration for the finish-upload wait, then start a fresh Codex session after connecting. `npm run mcp:check` verifies both connections and reads the DEV currency configuration through Codex's native MCP transport, without starting a model turn or reading OAuth credentials. This machine's Data MCP reports 137 tools and access on both the live and DEV titles; configuration work should target `FYVPZFCO-DEV`.

`npm run check` performs strict TypeScript checks, creates the production bundle, and verifies guest login, player bootstrap and public title configuration against the real DEV backend. It needs network access. `npm run verify` runs only the backend check.

## Staged DEV build

```sh
npm run stage:dev
```

Runs type/backend checks, creates the DEV archive, uploads it and stages a test version with `deploy=false`. It returns the DEV test URL and writes `.idos/last-stage.json` (ignored). The command uses the canonical identity from `src/idos.title.ts`; configuration and the returned test host use DEV. Live promotion is a separate publishing action.

For a label or a read-only status check:

```sh
npm run stage:dev -- "First horde encounter"
npm run stage:dev -- --status blde7df07c403b846bab863c89d235353dd
```

The initial upload/finish workflow was verified end to end. The helper's status mode reads the same staged version without creating an extra build.

## DEV build archive

```sh
npm run package:dev
```

This builds for DEV and creates `.idos/dev-build.zip`, with `index.html` at the archive root. The archive is ignored by Git. Vite uses relative asset paths so the bundle works under an iDos test-version path. Packaging uses the system `zip` and `unzip`, both installed on this machine. Only compiled public client files enter the archive; OAuth credentials stay in Codex's own storage.

## Source origin

Bootstrapped from the official `@idosgames/mcp@0.1.28` registry. The title ID and starter-module list were verified in the publisher's browser editor. This is an MCP starter baseline, rather than a byte-for-byte export of every file in the online editor. Registry fingerprints are recorded in [docs/idos-registry.json](docs/idos-registry.json).

This setup includes the staged DEV starter. On-chain gameplay integration is a later milestone; load the matching MCP skill before adding a platform feature.
