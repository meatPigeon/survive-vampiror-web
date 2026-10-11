import type { HordeController } from '../game/controller';
import { PERK_INFO } from '../data/perks';
import { HordeIcon } from './HordeIcon';

type Snapshot = ReturnType<HordeController['getSnapshot']>;
export function CampaignHud({ state }: { state: Snapshot }) {
  const conquered = state.route.filter(place => place.state === 'conquered').length;
  return <aside className="horde-conquest-dock" aria-label="Campaign progress">
    <nav className="horde-route" aria-label="Conquest route">
      <div className="horde-route-heading"><span>The march</span><b>{conquered}<span> / {state.totalWaves}</span></b></div>
      <ol>{state.route.map(place => <li key={place.id} className={`horde-route-${place.state}`} aria-label={`${place.name} · ${place.state}`} aria-current={place.state === 'current' ? 'step' : undefined} title={`${place.name} · ${place.state}`}>
        <span className="horde-route-marker"><HordeIcon name={place.id} />{place.state === 'conquered' && <HordeIcon name="check" className="horde-route-check" />}</span><small>{place.shortName}</small>
      </li>)}</ol>
    </nav>
    {state.passives.length > 0 && <div className="horde-passives" aria-label="Passive perks">{state.passives.map(perk => <span key={perk} className="horde-passive-badge" tabIndex={0} aria-label={`${PERK_INFO[perk].title}. ${PERK_INFO[perk].text}`} title={`${PERK_INFO[perk].title}: ${PERK_INFO[perk].text}`} style={{ color: PERK_INFO[perk].color }}><HordeIcon name={perk} /><span className="horde-passive-name">{PERK_INFO[perk].title}</span></span>)}</div>}
  </aside>;
}
