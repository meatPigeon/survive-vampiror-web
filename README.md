# Survive Vampiror — iDos web port

Native web source for iDos title `FYVPZFCO`, developed with Codex and iDos Code MCP.

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

GitHub stores the local source. It does not automatically deploy or copy files into the iDos AI Coder. Its built-in GitHub connector requires the iDos Start plan. Code MCP supplies source and SDK guidance. App Data MCP manages backend data and ready-build uploads. Its upload tools require the canonical title ID even for a staged test version, so staging adds an entry to the live title's build history. Live promotion is a separate operation. The prepared DEV archive has not yet been uploaded.

## Tool connection setup on another machine

This machine already has both MCP servers registered. On a different machine with Node and Codex installed:

```sh
codex mcp add idos-code -- npx -y @idosgames/mcp@0.1.28
codex mcp add idos-data --url https://site.idosgames.com/api/v2/mcp
codex mcp login idos-data --scopes config:read,config:write,cloudcode:write,build:write
```

Select only `FYVPZFCO-DEV` on the authorization page. Keep production access unselected. Restart or refresh the Codex session after connecting. `npm run mcp:check` verifies both connections and reads the DEV currency configuration through Codex's native MCP transport, without starting a model turn or reading OAuth credentials. This machine's Data MCP reports 137 tools and access on both the live and DEV titles; configuration work should target `FYVPZFCO-DEV`.

`npm run check` performs strict TypeScript checks, creates the production bundle, and verifies guest login, player bootstrap and public title configuration against the real DEV backend. It needs network access. `npm run verify` runs only the backend check.

## DEV build archive

```sh
npm run package:dev
```

This builds for DEV and creates `.idos/dev-build.zip`, with `index.html` at the archive root. The archive is ignored by Git. Vite uses relative asset paths so the bundle works under an iDos test-version path. Packaging uses the system `zip` and `unzip`, both installed on this machine. Only compiled public client files enter the archive; OAuth credentials stay in Codex's own storage.

## Source origin

Bootstrapped from the official `@idosgames/mcp@0.1.28` registry. The title ID and starter-module list were verified in the publisher's browser editor. This is an MCP starter baseline, rather than a byte-for-byte export of every file in the online editor. Registry fingerprints are recorded in [docs/idos-registry.json](docs/idos-registry.json).

No token, funded reward pool, on-chain reward, game deployment or publishing is included in this setup. Load the matching MCP skill before adding a platform feature.
