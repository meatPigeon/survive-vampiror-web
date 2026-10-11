import { useState, type CSSProperties } from 'react';
import { CAMPAIGN } from '../data/campaign';
import { PerkArtwork } from './PerkArtwork';
import { HordeIcon } from './HordeIcon';
const choices = [
  { id: 'fangs', title: 'Hit harder', name: 'Ravenous Fangs', detail: 'A passive perk. Every bite becomes stronger, without another button to press.', type: 'PASSIVE' },
  { id: 'mines', title: 'Make a trap', name: 'Corpse Mines', detail: 'An active perk. Plant half your available temporary recruits as bombs. The horde can walk through them; permanent zombies are never spent.', type: 'ACTIVE' },
  { id: 'reinforce', title: 'Grow the horde', name: '+10 permanent zombies', detail: 'Skip the offered perks for ten permanent reinforcements. These zombies stay with you through the march.', type: 'REINFORCEMENTS' },
] as const;
export function GuideConquest({ onChoose }: { onChoose: () => void }) {
  const [choice, setChoice] = useState(0), selected = choices[choice]!;
  return <div className="guide-conquest"><div className="guide-map"><span className="horde-kicker">FROM FORGOTTEN GRAVES TO THE CASTLE GATES</span><div className="guide-map-route">{CAMPAIGN.map((location, i) => <div key={location.id} style={{ '--stop': i } as CSSProperties}><span><HordeIcon name={location.id} /></span><b>0{i + 1}</b><small>{location.shortName}</small></div>)}</div><p>Five places. Five defenders. One growing horde.</p></div>
    <div className="guide-lesson-copy"><div><span className="horde-kicker">04 / MAKE IT YOUR MARCH</span><h2>Win a fight. Change your horde.</h2><p>Between locations, take one of two offered perks—or ten more zombies.</p></div></div>
    <div className="guide-perk-choices" role="group" aria-label="Explore reward types">{choices.map((item, i) => <button key={item.id} aria-pressed={choice === i} onClick={() => { setChoice(i); onChoose(); }}>{item.id === 'reinforce' ? <div className="guide-ten"><HordeIcon name="permanent" /><strong>+10</strong></div> : <PerkArtwork perk={item.id} />}<small>{item.type}</small><b>{item.title}</b></button>)}</div>
    <div className="guide-perk-detail" role="status"><HordeIcon name={selected.id === 'reinforce' ? 'permanent' : selected.id} /><div><b>{selected.name}</b><p>{selected.detail}</p></div></div><p className="guide-example-note">Example rewards · your real choices vary each march.</p>
  </div>;
}
