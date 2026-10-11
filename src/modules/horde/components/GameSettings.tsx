import { useState } from 'react';
import type { HordeController } from '../game/controller';
import { CONTROL_NAMES, allowedKey, type ControlAction } from '../data/controls';
import { Modal } from './Modal';
import { SaveStatus, type Snapshot } from './GameMenu';
export function GameSettings({ state, controller }: { state: Snapshot; controller: HordeController }) {
  const [binding, setBinding] = useState<ControlAction | null>(null);
  const settings = state.settings;
  return <Modal label="Settings" onClose={() => controller.closePanel()} className="horde-settings">
    <div className="horde-dialog-heading"><div><span className="horde-kicker">MAKE YOURSELF AT HOME</span><h1>Settings</h1></div><button data-autofocus onClick={() => controller.closePanel()}>Done</button></div>
    <h2>Sound</h2><div className="horde-audio">{(['music', 'effects'] as const).map(bus => <label key={bus}><span>{bus === 'music' ? 'Music' : 'Effects'}<b>{settings[bus]}%</b></span><input type="range" aria-label={`${bus === 'music' ? 'Music' : 'Effects'} volume`} min="0" max="100" step="1" value={settings[bus]} onChange={e => controller.setVolume(bus, Number(e.target.value))} /></label>)}</div>
    <h2>Display & guidance</h2><div className="horde-setting-grid">
      <label>Graphics<select value={settings.quality} onChange={e => controller.setting('quality', e.target.value as typeof settings.quality)}><option value="auto">Auto</option><option value="low">Low · lighter on battery</option><option value="high">High · shadows & detail</option></select></label>
      <label>Ambient motion<select value={settings.motion} onChange={e => controller.setting('motion', e.target.value as typeof settings.motion)}><option value="system">Use device preference</option><option value="reduced">Reduced</option><option value="full">Full</option></select></label>
      <label className="horde-toggle"><input type="checkbox" checked={settings.hints} onChange={e => controller.setting('hints', e.target.checked)} />Show movement and recruitment hints</label>
    </div><p className="horde-fineprint">Reduced motion stills clouds, hides rain and flying wildlife, and quiets scenery and UI animation. Combat movement and attack warnings stay visible.</p>
    <h2>Keyboard controls</h2><p className="horde-fineprint" role="status">{binding ? `Press a letter, number, arrow or Space for ${CONTROL_NAMES[binding].toLowerCase()}. Escape cancels.` : 'Select a control, then press a new key. Used keys swap places. Escape always pauses.'}</p>
    <div className="horde-bindings">{(Object.keys(CONTROL_NAMES) as ControlAction[]).map(action => <button key={action} aria-label={`Remap ${CONTROL_NAMES[action]}`} aria-pressed={binding === action} onClick={() => setBinding(action)} onBlur={() => setBinding(null)} onKeyDown={event => {
      if (binding !== action) return;
      if (event.key === 'Tab') { setBinding(null); return; }
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') setBinding(null);
      else if (!event.ctrlKey && !event.metaKey && !event.altKey && allowedKey(event.code)) { controller.bind(action, event.code); setBinding(null); }
    }}><span>{CONTROL_NAMES[action]}</span><kbd>{binding === action ? 'Press key…' : state.keys[action]}</kbd></button>)}</div>
    <button className="horde-reset-bindings" onClick={() => { controller.resetBindings(); setBinding(null); }}>Reset keyboard controls</button>
    <SaveStatus state={state} controller={controller} />
  </Modal>;
}
