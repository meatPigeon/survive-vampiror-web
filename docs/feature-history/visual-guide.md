# Playable field guide

Replaced the long manual after the user found it too much like documentation (2026-10-09).
The guide now has four short chapters, with the controls/save reference and credits on separate views.

- **Move as one:** command six practice zombies; the ordinary bite rule completes the exercise.
- **Dodge & bite:** escape a real sweep warning, then counterattack. Getting caught gives feedback and a reset, not a false success.
- **Raise recruits:** occupy an actual recruitment ring for its normal duration and raise twelve temporary allies.
- **Claim the land:** inspect the five-stop route and selectable examples of passive perks, active perks and permanent reinforcements. These are labeled examples, not a promise of particular reward rolls.

`GuideLesson` owns a new, disposable encounter and calls the existing movement/combat/recruitment rules. It has no controller or save-store reference. The smaller roster, waiting defender and self-paced counterattack are teaching accommodations; they do not change campaign balance. Pointer movement, configured movement keys, accessible action buttons and a Show me example all use that encounter. Closing help still leaves a real encounter paused.

`GuideView` renders the authored characters, shared warning geometry and summoning ring in a close-up training diorama. It releases actors, source assets, geometry, materials, renderer and WebGL context on close/reset. Reduced motion quiets idle animation while retaining the movement needed to demonstrate the lesson. The iDos tutorial skill was reviewed: this replayable local reference has no configured server flow, unlocks or rewards, so it does not call the production TutorialService or impersonate its completion state.

Header/exit and footer/next controls stay visible while a small screen scrolls the lesson body. Switching chapters/reference views returns that body to its top. Existing modal focus containment remains in use; auxiliary controls and credits no longer compete with the first lesson.

Validation: four pure tests cover waiting for a command, real bites, successful/failed dodges, recruitment, example completion, input takeover and separation from a real encounter. Chrome verified pointer movement, the two-step dodge/counterattack, twelve-recruit completion, reward selection and reference views. Portrait 390×844 and landscape 844×390 were inspected. These are browser viewport checks, not physical touch-device results. The local preview was restarted so Vite recognizes the newly added public font-license file; its response is now `text/plain`, rather than the SPA fallback.

This iteration remains uncommitted and local.
