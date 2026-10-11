import type { Snapshot } from './GameMenu';
import { HordeIcon } from './HordeIcon';
export function GuideReference({ page, state }: { page: 'controls' | 'credits'; state: Snapshot }) {
  if (page === 'credits') return <div className="guide-reference guide-credits"><HordeIcon name="crown" /><span className="horde-kicker">THE PEOPLE BEHIND THE DEAD</span><h2>Survive Vampiror</h2><p>A game by <strong>meatPigeon</strong>.</p><p>Characters, animation and music from the original Survive Vampiror.</p><dl><div><dt>Built with</dt><dd>Three.js · React · iDos</dd></div><div><dt>Typeset in</dt><dd>Noto Sans · Noto Serif</dd></div></dl><div className="horde-credit-links"><a href="./licenses/noto.txt" target="_blank" rel="noopener noreferrer">Font license ↗</a>{import.meta.env.PROD && <a href="./third-party-licenses.md" target="_blank" rel="noopener noreferrer">Software licenses ↗</a>}</div></div>;
  const k = state.keys;
  return <div className="guide-reference"><span className="horde-kicker">WHEN YOU NEED A REMINDER</span><h2>Your controls. Your pace.</h2><div className="guide-control-list">
    <div><span>Move together</span><b><kbd>{k.up}</kbd><kbd>{k.left}</kbd><kbd>{k.down}</kbd><kbd>{k.right}</kbd></b><small>Or tap/click the ground. Touch direction buttons are in Settings.</small></div>
    <div><span>Stop / cancel aim</span><b><kbd>{k.stop}</kbd></b><small>Or right-click / tap Stop.</small></div>
    <div><span>Use abilities</span><b><kbd>{k.ability1}</kbd><kbd>{k.ability2}</kbd></b><small>Sling: select it, then tap a landing spot.</small></div>
    <div><span>Sprint, once unlocked</span><b><kbd>{k.sprint}</kbd></b><small>Ability buttons show costs and cooldowns.</small></div>
    <div><span>Pause</span><b><kbd>Esc</kbd><kbd>{k.pause}</kbd></b><small>Change keys, sound and motion in Settings.</small></div>
    <div><span>Zoom</span><b>Scroll / + / −</b><small>Get a closer look, or see the whole arena.</small></div>
  </div><div className="guide-save-note"><HordeIcon name="clock" /><div><b>Come back when you are ready.</b><p>Progress saves every 30 seconds, on pause and between locations. Continue restores your latest checkpoint; Retry location returns to its entrance. Check for “Saved to your account” before closing.</p><small>A guest account belongs to this browser. Clearing browser data can lose access.</small></div></div></div>;
}
