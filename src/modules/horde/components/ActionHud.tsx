import type { CSSProperties } from 'react';
import type { HordeController } from '../game/controller';
import { RULES } from '../game/simulation';
import { PERK_INFO } from '../data/perks';
import { HordeIcon } from './HordeIcon';

type Snapshot = ReturnType<HordeController['getSnapshot']>;
export function ActionHud({ state, controller }: { state: Snapshot; controller: HordeController }) {
  const duration = { mines: RULES.mineCooldown, sling: RULES.slingCooldown, feast: RULES.feastCooldown };
  return <div className="horde-action-dock" aria-label="Horde abilities">
    {state.abilities.map((ability, slot) => {
      const perk = ability.upgrade; if (!perk) return null;
      const active = ability.armed.length > 0 || ability.feast > 0 || ability.aiming;
      const label = ability.aiming ? 'Tap a landing spot to fire' : ability.armed.length ? `Detonates in ${ability.fuse.toFixed(1)}s` : ability.feast > 0 ? `Feasting · ${ability.feast.toFixed(1)}s` : ability.cooldown > 0 ? `Ready in ${ability.cooldown.toFixed(1)}s` : state.abilityReady[slot] ? 'Ready' : 'Need a temporary recruit';
      const ready = Math.max(0, 1 - ability.cooldown / duration[perk]);
      return <button key={slot} className={`horde-action ${active ? 'horde-action-active' : ''}`} style={{ '--action-accent': PERK_INFO[perk].color } as CSSProperties} disabled={!state.abilityReady[slot]} aria-label={state.abilityLabels[slot]} title={PERK_INFO[perk].text.replace('Q ', `${slot === 0 ? state.keys.ability1 : state.keys.ability2} `)} onClick={() => controller.ability(slot)}>
        <HordeIcon name={perk} /><span className="horde-action-copy"><b>{PERK_INFO[perk].title}</b><small>{label}</small></span><kbd>{slot === 0 ? state.keys.ability1 : state.keys.ability2}</kbd>
        <span className="horde-action-meter" aria-hidden="true"><i style={{ width: `${ready * 100}%` }} /></span>
      </button>;
    })}
    {state.sprint.unlocked && state.status === 'playing' && <button className={`horde-action horde-action-sprint ${state.sprint.remaining > 0 ? 'horde-action-active' : ''}`} disabled={state.sprint.cooldown > 0} onClick={() => controller.sprint()} aria-label={state.sprint.remaining > 0 ? 'Sprinting' : state.sprint.cooldown > 0 ? `Sprint ${state.sprint.cooldown.toFixed(1)}s` : `Sprint ${state.keys.sprint}`}>
      <HordeIcon name="sprint" /><span className="horde-action-copy"><b>Sprint</b><small>{state.sprint.remaining > 0 ? 'Sprinting' : state.sprint.cooldown > 0 ? `Ready in ${state.sprint.cooldown.toFixed(1)}s` : 'Ready'}</small></span><kbd>{state.keys.sprint}</kbd>
      <span className="horde-action-meter" aria-hidden="true"><i style={{ width: `${Math.max(0, 1 - state.sprint.cooldown / RULES.sprintCooldown) * 100}%` }} /></span>
    </button>}
  </div>;
}
