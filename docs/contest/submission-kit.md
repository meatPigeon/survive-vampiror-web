# Crypto World's Fair and iDos side-track submission kit

Prepared 2026-10-11 for Survive Vampiror. The current public iDos game is at
https://idosgames.com/app/FYVPZFCO/. The current published build (version 8), also available in DEV, is at
https://fyvpzfco-dev.idos.games/v/bld8a26c9762b6145d38ed8bcadabf4232b/index.html.

## Project presentation

**Survive Vampiror — You are the Horde** is a low-poly real-time strategy game about commanding
the monsters instead of the hero. Lead a persistent horde of forty zombies from the village
graveyard through the chapel, royal road and fortress outskirts to the castle. Read each knight's
telegraphed attacks, move as a group, recruit temporary allies from scattered graves, and choose
new abilities and perks between battles. The campaign includes five distinct arenas, five defenders and ten
knight attacks with readable warnings.

The game is built as a native web title on iDos Games. Solana Ed25519 message signatures authenticate a persistent player identity. A fresh browser using the same wallet recovers the same account and its private campaign checkpoint, preferences and personal records. No transaction fee or token purchase is required; guests remain welcome with separate saves. Saves are off-chain iDos data. **HORDE mainnet mint is verified:** `9UB6DJsQncQoxQrBW8a6HyyDAfeWKoYN7WaHmukpidos`.

The existing [Colosseum project](https://colosseum.com/arena/projects/survive-vampiror) has a saved draft with game details, Solana explanation, repository and live links. Telegram contact, founder profile, artwork upload and video URLs remain incomplete. Browser file uploads require enabling file-URL access for the ChatGPT extension. The project has not been finally submitted.

## Demo video recording plan (60–90 seconds)

Record the actual staged/production game on desktop or phone. Show only behaviors that occur in the
current build; do not use the development-only insta-kill control in the submitted recording.

1. Open the game, show its title/menu and explain “You are the Horde.”
2. Start the first march and use a click/tap plus keyboard or touch movement to steer around the
   knight's visible warning.
3. Show automatic bites, permanent and temporary recruit counts, and one recruitment crater.
4. Use one unlocked ability or a mine after explaining its cost; show that a mine spends temporary
   allies and that the horde can walk past them.
5. Show a location result and perk choice, then the next visibly different arena.
6. End on the five-location campaign map or victory only if reached in an ordinary run. Mention
   that the staged DEV URL is a test build if it remains the footage source.

Suggested narration: “In Survive Vampiror, you command the horde. Lead forty zombies across five
locations, dodge attacks the knight telegraphs, recruit temporary allies, and choose how the horde
grows between battles. Your permanent zombies are the lifeline: keep at least one alive.”

## Project pitch video script (about 45 seconds)

“Most survival games ask you to be the lone hero. Survive Vampiror flips that fantasy: you command the monsters. I built a five-location campaign where you guide forty zombies, dodge readable knight attacks, recruit temporary allies and choose tactical perks. The horde advances from a village graveyard to a castle. Solana wallets give the player a signature-verified identity that can recover the same campaign on another browser, without a transaction fee. The game is live on iDos and its source is public. My next step is feedback from more players and devices.”

Add a short introduction in your own voice and explain your background accurately. Colosseum asks for a founder pitch of up to two minutes, separate from a live-product demo of up to three minutes. Do not substitute a slide deck for the demo.

## Submission fields

- iDos project: https://idosgames.com/app/FYVPZFCO/
- GitHub: https://github.com/meatPigeon/survive-vampiror-web (public; anonymous access verified 2026-10-11)
- Colosseum project: https://colosseum.com/arena/projects/survive-vampiror (draft; not finally submitted)
- Superteam Earn side-track submission: not submitted yet
- Demo and pitch video URLs: not recorded or uploaded yet
- Solana integration: signature-authenticated cloud campaign recovery implemented and tested
- HORDE mainnet token: https://solscan.io/token/9UB6DJsQncQoxQrBW8a6HyyDAfeWKoYN7WaHmukpidos (verified by read-only mainnet RPC)
- Pitch deck: output/pitch/survive-vampiror-pitch-solana.pptx; PDF export in output/pdf/

## Release evidence and boundaries

- Version 8, build `bld8a26c9762b6145d38ed8bcadabf4232b`, promoted with API status `Live` and `Published: true`.
- 83 automated tests passed, strict TypeScript/build passed, guest cloud-save round-trip passed, and actual Solana signature/campaign recovery checks passed.
- Local Chrome inspected the compiled release and discovered Phantom. Hosted DEV browser access is blocked by a saved site permission and was not bypassed.
- DEV and PROD both have Solana wallet login enabled and the private save schema registered.
- The agent performed no wallet payment or token mint. The user-completed mint is now verified. Video uploads and final contest submission remain incomplete.
- Deadline shown on the official contest page: October 13, 2026, 11:59 Almaty time (October 12, 23:59 PDT).
