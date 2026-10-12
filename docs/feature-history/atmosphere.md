# Clouds, passing wildlife and occasional rain

Added at the user's request on 2026-10-09. These are cosmetic and never affect combat, recruitment, hit detection or the encounter RNG.

`Clouds` renders two planes with a shared procedural noise field: translucent banks overhead and offset ground shade. Wind advects the field continuously. The center of the arena uses much lower cloud opacity than the scenery perimeter, preserving actor and attack readability. Colors follow each location's lighting palette. The materials do not write depth.

`Weather` uses a separate ambient clock. Small four-member flocks alternate crow and bat silhouettes, with different wing shapes and flap speeds. Flyovers occupy 16 seconds of a 52-second cycle; dry gaps between showers are longer than the fades. Rain builds over eight seconds, holds, then fades over twelve seconds within a 112-second cycle. Locations offset the schedule; the scorched outskirts use lighter rain. No thunder, flashes, rain audio or gameplay effects were added.

Low graphics uses two cloud-noise octaves, 85 rain streaks and at most three fliers, compared with three octaves, 220 streaks and four fliers otherwise. Reduced motion freezes the clouds and hides rain/wildlife, including when settings change during pause. The arena's pause also stops its ambient clock. GPU buffers/materials are allocated once and released once on scene teardown.

Validation: shader compilation, drifting clouds, rain and a passing three-member flock on Low graphics were inspected in Chrome. Reduced motion visibly removed the rain/wildlife and held the cloud pattern still; the original motion preference was restored afterward. No browser warnings/errors were observed. Preview captures are `.idos/weather-flock.png` and `.idos/weather-final.png`. Presentation tests cover shared cloud drift, reduced motion, quality limits, smooth rain transitions, dry intervals, alternating flock schedules, finite geometry and resource teardown. `npm run check` passed 78 tests, types, production build and the real DEV backend save round-trip. Physical-device performance remains a release check.

Original atmosphere work is included in the later release; see the release-readiness history for publication status.

Local readability follow-up (2026-10-12): cloud air opacity and ground shade are reduced so actors and warning shapes stay clear on portrait screens. The air mask is evaluated at its projected ground position for the fixed camera tilt, keeping the central clearing aligned. Wind, rain, flocks, reduced-motion behavior and combat rules are unchanged. The lighter clouds were rendered in all five locations at phone portrait sizes. Published in version 12 on 2026-10-12; see [release verification](release-readiness.md).
