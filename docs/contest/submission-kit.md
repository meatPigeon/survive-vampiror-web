# Crypto World's Fair and iDos side-track submission kit

Prepared 2026-10-11 for Survive Vampiror. The current public iDos game is at
https://idosgames.com/app/FYVPZFCO/. The current staged DEV build (version 6) is at
https://fyvpzfco-dev.idos.games/v/bldded8bbac29fc46efa5b5e4c39012e9b5/index.html.

## Project presentation

**Survive Vampiror — You are the Horde** is a low-poly real-time strategy game about commanding
the monsters instead of the hero. Lead a persistent horde of forty zombies from the village
graveyard through the chapel, royal road and fortress outskirts to the castle. Read each knight's
telegraphed attacks, move as a group, recruit temporary allies from scattered graves, and choose
new abilities and perks between battles. The campaign includes five distinct arenas and ten
defenders, each with a recognizable attack pattern.

The game is built as a native web title on the iDos Games engine. Its current host provides account
and wallet sign-in; the horde game itself remains playable without buying anything. **Solana token
integration is not live yet.** The proposed HORDE token is still awaiting its creator's funded launch
transaction. Update this section and the submission copy only after verifying the token on Solana
mainnet and implementing or confirming its actual in-game use. Never claim wallet sign-in alone is
the game's meaningful Solana integration.

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

“Most survival games ask you to be the lone hero. Survive Vampiror flips that fantasy: you command
the monsters. I built a playable five-location campaign where you guide a living horde, evade
readable knight attacks, recruit short-lived allies and shape your strategy with perks between
waves. The challenge is to preserve your permanent horde while using temporary recruits for tactical
abilities. The game is built on iDos Games and its complete source and tests are in the project
repository. The planned HORDE token has not launched yet, so I will describe the Solana integration
only after the mainnet launch and its in-game use are verified.”

Re-record or edit the final two sentences after the Solana feature is genuinely implemented; judges
expect meaningful integration, not just a token ticker.

## Submission fields

- iDos project: https://idosgames.com/app/FYVPZFCO/
- GitHub: https://github.com/meatPigeon/survive-vampiror-web (currently private; make accessible to
  judges before submitting)
- Colosseum Crypto World's Fair project page: not created yet
- Superteam Earn side-track submission: not submitted yet
- Demo and pitch video URLs: not recorded or uploaded yet
- Solana mainnet token and meaningful in-game integration: not complete

## Release evidence and boundaries

- Commit: `3cae75e` (`Prepare five-location horde release candidate`).
- DEV stage: version 6, build `bldded8bbac29fc46efa5b5e4c39012e9b5`, `deploy=false`.
- Automated release checks: 80 tests passed, strict TypeScript/build passed, and real DEV profile
  save round-trip passed (24,433 bytes).
- No PROD promotion, wallet payment, token mint, or public contest submission has been performed.
- The official Colosseum first-filter checklist also requires a complete project page, repository
  configured under its rules, a project presentation, demo video and pitch video.
