# Local development and source ownership

This native iDos web port is developed in its own Git repository, separate from the Godot original. The local source is the development baseline; GitHub version control does not imply a deployment or synchronization with the AI Coder editor.

The starter came from the official Code MCP registry, with the seven module IDs verified in the publisher editor. It is not a byte-for-byte export of that editor. `docs/idos-registry.json` records the source fingerprints. Before importing further browser-editor changes, compare them and preserve local changes.

The canonical title is `FYVPZFCO`. `.env.local` selects its DEV environment for local work and is ignored by Git. Client configuration is public browser data; backend OAuth credentials do not belong here.

Keep Viem pinned to 2.55.2 and Wagmi companions to `@wagmi/core@3.6.2` / `@wagmi/connectors@8.0.23`, matching Wagmi 3.7.2: the scaffold's Wagmi 3.7.2 imports `viem/tempo/zones`, which the later 2.57.4 export map removed. Letting the Reown adapter select later Wagmi companion versions also produced an undefined `waitForTempoBlock` import; explicit compatible versions avoid that mismatch. The wallet's optional Solana peer packages must be explicit dependencies because the lazy wallet bundle is resolved during the production build, even before the title has Solana configured. Keep a committed npm lockfile and verify typecheck/build after changing these dependencies.

Fresh `npm ci --ignore-scripts` succeeds. The starter is manually verified in Chrome for DEV guest login, lobby, mini-game start, result and return to lobby. The automated backend smoke uses memory-only credentials and a stable test device identity; it checks guest login, player bootstrap and title configuration, then logs out.

The MCP connection check uses Codex app-server's native RPC with an ephemeral thread only as an MCP connection context. It never starts a model turn and never reads credential storage. Unexpected interactive RPC requests fail and direct the user back to Codex. The machine's normal Codex configuration and OAuth storage remain authoritative.

Three.js 0.185.1 is installed for the 3D port, matching the current Code MCP board-game/voxelcraft dependencies. TypeScript declarations use `@types/three@0.185.0`. Importing Three.js and constructing its geometry succeeds; this does not imply that any horde gameplay or WebGL scene has been implemented.

Both MCP connections are verified: Code exposes seven tools; App Data exposes 137 tools and an actual `get_currency` read on FYVPZFCO-DEV succeeds. The service's title list reports both live and DEV access for this connection, despite the prepared consent page selecting DEV only; do not describe the credentials as DEV-isolated. Explicit DEV title IDs remain the configuration workflow.

The upload API requires canonical title FYVPZFCO, not FYVPZFCO-DEV. A staged DEV artifact therefore creates a build-history record under the live title even with `deploy=false`. Automatic approval review blocked that mutation until the user approves staging explicitly. The archive is ready, with relative assets, but hosted upload has not been verified yet. Data MCP's tool timeout is 180 seconds for the documented finish-upload wait of about 100 seconds; the native RPC transport timeout matches it.
