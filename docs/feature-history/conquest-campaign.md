# Conquest campaign

The user chose a visible invasion of the kingdom: each defeated defender advances the horde into a new place. This iteration adds five locations, five knight attacks and five passive perks. It deliberately extends the original three-wave Godot baseline. Keep the original movement, recruitment, planted-mine, input and host contracts described in [Horde encounter](horde-encounter.md).

This iteration stays local and uncommitted for review. No DEV upload or live promotion was requested for these changes. The temporary development-only **Insta-kill knight** button remains available for inspecting locations and reward screens; it uses normal defeat/reward/victory transitions and is omitted from production builds.

## The march

| Wave | Location | Defender | HP | Signature attack | Visual landmarks |
| --- | --- | --- | --- | --- | --- |
| 1 | Village Graveyard | Village Watchman | 800 | Shield bash | Crooked fences, mossy tombs, candle pools and green soil |
| 2 | Village Chapel | Chapel Guardian | 1000 | Consecration | Ivory gable, teal roof, rose window, flared bell, herb gardens and moss-edged paving |
| 3 | Royal Road | Royal Lancer | 1200 | Lance thrust | Tan rutted road, rounded green/ochre foliage, carts, guard shelter and a banner gate |
| 4 | Fortress Outskirts | Ashbound Warden | 1450 | Firebomb | Burned orchard, palisades, watchtower, flames and smoke |
| 5 | Castle Courtyard | Crown Champion | 1800 | Royal shockwave | Quiet limestone court, slate spires, iron gate, sage gardens, banners and royal tombs |

Only waves 3 and 5 use the authored mounted knight. Wave 4 reuses the on-foot armored model. Each place changes its geometry, procedural ground pattern and palette-driven lighting. Tall props sit beyond the movement rectangle so scenery does not imply a new navigation or collision system. Ground debris remains flat and passable. Five recruitment craters remain available in every location.

The route HUD marks a location conquered when its defender dies. Rewards name the next location, and the four-second break describes the march there. Wounds, active abilities, passive perks and remaining temporary lifetimes carry over. Recruitment starts afresh at West after each move. Winning requires defeating the fifth defender; losing the last permanent zombie still ends the encounter immediately.

## Knight attacks

These attacks supplement the original sweep, spin, charge, crossbow and mounted rush. Each defender introduces its own signature rather than selecting all five indiscriminately. The first signature becomes available after seven gameplay seconds; later cooldowns count down only during live combat. Warnings lock the origin, direction or target disk and never chase the player after appearing.

| Attack | Warning | Danger | Newbie effect |
| --- | --- | --- | --- |
| Shield bash | 1.15 s | Three-unit, 110-degree forward cone | 8 damage, 2.5-unit knockback clamped to arena |
| Consecration | 1.8 s | Three-unit-radius disk at a locked horde position | One 18-damage strike |
| Lance thrust | 1.4 s | 7.5-unit-long, 1.5-unit-wide forward lane | One 22-damage strike; knight stays still |
| Firebomb | 1.7 s | Locked 2.7-unit-radius disk, burning for 3 s | 8 landing damage plus six 4-damage half-second ticks |
| Royal shockwave | 1.9 s | Expanding ring, radius 0 to 9 over 1.8 s | 18 damage once per zombie; the passed center is safe |

Normal-mode hits remain lethal even with increased health. The shockwave's warning outlines its maximum reach; during the strike the actual moving ring is the danger. A player outside its reach must stay out until it passes, or enter the safe center after the ring has passed. Fire is a persistent hazard until its strike ends. Shared specs drive both simulation hit shapes and rendered previews. Swept ring checks prevent a long frame from skipping targets; hit IDs prevent repeated ring damage. Fire cadence handles all crossed half-second ticks. Pause, rewards, breaks and terminal outcomes freeze or cancel combat through the existing gates.

## New passive perks

| Perk | Effect |
| --- | --- |
| Gravehide | Living zombies gain 15 maximum HP and recover 15 HP. Future permanent and temporary spawns start at 45 HP. |
| Ravenous fangs | Automatic bites deal 6 damage instead of 4; bite timing stays the same. |
| Grave calling | Each recruitment crater supplies 16 temporary zombies instead of 12, subject to the existing recruitment cutoff of 60 living zombies. |
| Restless march | Ordinary movement is 15% faster and combines with sprint. |
| Lingering souls | Current temporary lifetimes gain 20 seconds once; future recruits last 65 seconds. |

Passive perks are always active, do not consume Q/E slots, cannot be granted twice and are shown as HUD badges. The original mines, sling, feast and Space sprint remain. Reward offers exclude owned perks and active abilities when both slots are full, while passives and sprint remain eligible. The +10 permanent-zombie skip reward keeps its original behavior; 60 is the recruitment cutoff, not a cap on permanent skip rewards.

## Extending the campaign

`src/modules/horde/data/campaign.ts` owns the ordered location definitions: names, story line, defender HP, authored model, signature and palette. Campaign length determines the wave total, route, next-location text and final victory gate. To add a location, extend that table and add its scenery builder and shader theme; reuse existing models/attacks or provide new specs and assets as needed. Keep simulation data separate from procedural Three.js scenery.

`data/perks.ts` owns reward metadata. `game/perk-effects.ts` keeps passive values in pure helpers used by spawning, bites, recruitment and movement. New passive types need grant/carryover behavior there and an artwork entry in `components/PerkArtwork.tsx`; active abilities still use the two existing slots.

Procedural scenery owns and disposes its geometry/materials on a wave switch, restart and teardown. Flame, smoke and flag motion is bounded and advances with the view timestep. New-location camera framing measures actual landmark vertices and leaves the top 12% for the HUD; graveyard framing and zoomed horde follow retain their original behavior. Ground shaders use Three.js material hooks and uniform palette changes; existing character skinning, rim light, shadows and authored clips remain intact. No new dependencies or generated/downloaded assets are required.

## Visual refinement

The user wants land that feels irregular and lived in, with open gaps and uneven clusters rather than boxed arenas, parallel borders or mirrored prop rows. Ground and cloud falloffs must not trace the movement rectangle. Paths bend, paving has weathered irregular margins, and fences/garden edging survive in short fragments. Keep the chapel and castle recognizable, while staggering their surrounding walls, gardens and approaches. Imported environment props are recomposed at runtime; their authored geometry stays intact. These are visual boundaries: the existing movement bounds and tall-prop clearance still apply. The continuous ground extends beyond portrait framing. Its orthographic camera pulls back along the same view axis when necessary and extends its far plane, avoiding a foreground near-plane cut without changing tilt, visual scale or ground aiming.

The user's next direction was a reference, render, critique and refinement loop. Original procedural work uses [Dorfromantik's studio presskit](https://www.toukana.com/dorfromantik/presskit) for grouped village scenery, [Thronefall's official store screenshots](https://store.steampowered.com/app/2239150/Thronefall/) for readable silhouettes and restrained floors, and [Kenney's fantasy town](https://kenney.nl/assets/fantasy-town-kit), [nature](https://kenney.nl/assets/nature-kit) and [game icon](https://kenney.nl/assets/game-icons) sets for clear shape language. Reference images stay outside the repository. No external game art is copied into the runtime.

The first review removed purple road rails, the castle's permanent circular crest that resembled a shockwave warning, high-contrast burned-floor blotches and paving over the entire chapel arena. Scenery now uses sage vegetation, limestone, teal roofs and restrained ochre, with gardens and architecture grouped at the perimeter. Floor variation stays soft so recruitment rings and attack previews have priority.

The first new Chrome renders led to a second pass: darker paving, an ivory chapel gable and readable window/bell detail, brighter upcoming route markers, and a 44-pixel phone Pause target. A live consecration capture still showed a faint gold circle, so its preview gained a dark inner rim beneath the gold boundary; both rings end at the exact damage radius. Wide-screen counts and recruitment panels moved into the top margin to reveal the castle tower caps. Reward entry fades start at 85% opacity so delayed cards are readable immediately.

All nine perks now share original faceted SVG medallions. `HordeIcon.tsx` supplies matching route, perk, recruitment and action glyphs. HUD plates separate counts, defender health and controls; active tiles retain Q/E/Space gates and add status/cooldown meters. The compact route/passive dock sits at the bottom on narrow screens, reserving the touch direction controls below it on coarse-pointer devices. Hidden phone labels retain accessible location names and progress states. Phone Zoom in/out buttons have 44-pixel targets and call the existing camera zoom/follow behavior; default overview framing stays the same. The iDos UI-kit guidance was read; platform sign-in and lobby styling stay owned by the host.

## Validation

Automated checks cover campaign ordering, defender HP/model/attack mapping, five-wave victory and carryover, passive effects and reward eligibility, warning lock/escape, exact hit boundaries, fire cadence, swept shockwave hits, pause and terminal priority. Presentation checks exercise all ten previews, distinct landmarks, finite animation and resource disposal. They verify that tall scenery stays outside the playable rectangle and below the top HUD reserve, targeted-circle borders match the damage radius, and every warning/border resource is released exactly once across attack changes and reset.

Verified locally on 2026-10-09: all 54 tests, strict types, production build, real DEV guest/player/configuration checks, both MCP connections and the authenticated DEV configuration read pass. The deterministic Newbie movement test wins all five locations in 573.27 gameplay seconds with eight permanent survivors, choosing actually offered Restless march, Blood feast, Ravenous fangs and Lingering souls. It uses normal movement, bites and ability activation, without overriding health or knight damage. This establishes one viable strategy, not comprehensive balance across seeds or Normal difficulty.

Chrome inspection traversed all five locations through the development test button, selected and carried passive perks, exercised the skip reward, reached the five-conquered victory screen and restarted to 40 permanent zombies, 800 knight HP, zero elapsed time and an empty perk set. Final visual inspection repeated the five-location traversal, captured the actual consecration warning, and checked rewards and the HUD at 390×844. Phone zoom buttons increased unit readability and returned to overview; Blood feast and Sprint activation showed their active/cooldown states. The viewport override was reset and the local preview left open at the ready graveyard. Browser warnings, JavaScript errors and shader errors were absent. All 54 tests passed again after the final preview/resource assertions. This checks presentation and progression through the test button, not a complete human combat playthrough, physical touch-device check or measured mobile performance.

Hosted access was denied in an earlier iteration and is not retried here. Earlier DEV version 5 still contains the three-wave, five-crater build. This campaign has not been committed, pushed or uploaded.
