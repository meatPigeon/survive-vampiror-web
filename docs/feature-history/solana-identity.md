# Solana commander identity

Implemented 2026-10-11 using the iDos authentication, blockchain-system and user-custom-data skills.

## Player value

Signing an iDos challenge with a Solana wallet recovers a stable player account, so the same wallet can resume its private campaign checkpoint, settings and records in a fresh browser. This is message authentication: there is no transaction, fee, purchase, token reward or on-chain save. Guests remain welcome. Guest and wallet accounts have separate saves; signing in does not migrate a guest account.

The host owns authentication. `src/walletLogin.tsx` now uses Solana rather than the scaffold's EVM/BSC fallback. Embedded games retain the SDK platform wallet bridge. Standalone pages use installed Wallet Standard wallets when no WalletConnect project ID is configured; the SDK's current standalone lazy Solana component otherwise reports “not configured.” Reown remains supported when an actual project ID is supplied. Do not invent one or prompt injected wallets from the embedded game.

`CommanderIdentity` displays the server-confirmed `LastWalletLogin`, with loading/error/retry states. It never infers authentication from a connected address. Checkpoints remain private, client-written single-player data and are unsuitable as trusted competition scores or financial rewards.

## Backend and release

- Canonical title: `FYVPZFCO`; DEV: `FYVPZFCO-DEV`.
- Solana network `solana` already existed on PROD; its definition was added to DEV. Wallet login is enabled on both environments.
- The private JSON key `horde_profile_v1` has a 131072-byte limit in both environments. PROD registration copied the schema only, never DEV player data.
- Version 8, build `bld8a26c9762b6145d38ed8bcadabf4232b`, was staged, then promoted through Data MCP. The returned status is `Live`, with `Published: true`.
- [Public game](https://idosgames.com/app/FYVPZFCO/) and [DEV artifact](https://fyvpzfco-dev.idos.games/v/bld8a26c9762b6145d38ed8bcadabf4232b/index.html).
- HORDE mainnet mint was verified with a read-only Solana RPC account lookup: `9UB6DJsQncQoxQrBW8a6HyyDAfeWKoYN7WaHmukpidos`, an initialized SPL mint with six decimals. This code does not create or trade a token.

## Evidence and limits

- Strict TypeScript, production packaging and all 83 tests passed.
- `npm run verify:solana` uses disposable, unfunded Ed25519 keys held only in memory. It signs into the actual DEV service, checks server wallet identity, saves a real campaign checkpoint, recovers the same account in a fresh client, restores 40 zombies while paused, and confirms an invalid signature is rejected. No user wallet or funds are used.
- Tests cover incompatible wallets/accounts, altered message bytes, malformed signatures and declined signatures. Signing and session exchange remain in the official iDos SDK.
- Local Chrome inspected the compiled version 8 artifact: Phantom discovery, guest sign-in, cloud connection, account explanation, combat, pause and checkpoint saving. No runtime warnings/errors were observed. A real user Phantom signature has not been completed by automation.
- Hosted DEV inspection is blocked by a saved browser site permission. It was not bypassed. The iDos build API confirms publication; this is distinct from hosted gameplay inspection.
- Existing dependency audit reports 12 issues (5 high, 7 moderate), inherited through the iDos/Reown Solana stack, including the native `bigint-buffer` path. Automated suggested fixes downgrade/break SDK dependencies. No force downgrade was applied; dependency remediation and physical mobile testing remain follow-up work.

References: [Solana message authentication](https://solana.com/docs/frontend/messages-and-auth), installed Wallet Standard declarations and the iDos MCP skills.
