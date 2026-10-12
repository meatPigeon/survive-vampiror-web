import { useState, type CSSProperties } from 'react';
import type { HordeController } from '../game/controller';
import { CAMPAIGN } from '../data/campaign';
import { PERK_INFO as perks, isPassivePerk } from '../data/perks';
import { PerkArtwork } from './PerkArtwork';
import { HordeIcon } from './HordeIcon';
import { Modal } from './Modal';
import type { Snapshot } from './GameMenu';
export function RewardDialog({ state, controller }: { state: Snapshot; controller: HordeController }) {
  const [choice, setChoice] = useState<number | null>(null);
  const key = state.abilities[0]?.upgrade ? state.keys.ability2 : state.keys.ability1;
  return <Modal label="Choose an upgrade" className="horde-rewards" onClose={() => controller.togglePause()}>
    <span className="horde-kicker">{state.location.name.toUpperCase()} CONQUERED</span><h1>Wave cleared</h1><p>Next: {CAMPAIGN[state.wave]?.name}. Choose an upgrade for the rest of your march.</p>
    <div className="horde-cards">{state.rewards.map((perk, index) => <button key={perk} className="horde-card" style={{ '--accent': perks[perk].color, animationDelay: `${index * 0.08}s` } as CSSProperties} aria-pressed={choice === index} onClick={() => setChoice(index)}>
      <div className="horde-card-art"><PerkArtwork perk={perk} /><span>{perks[perk].role}</span><b>{isPassivePerk(perk) ? 'Always on' : perk === 'sprint' ? state.keys.sprint : key}</b></div>
      <h2>{perks[perk].title}</h2><p>{perks[perk].summary}</p><footer><span>{isPassivePerk(perk) ? 'Always active' : perks[perk].cost}</span><b>{choice === index ? '✓ SELECTED' : 'SELECT'}</b></footer>
    </button>)}</div>
    <div className="horde-confirm"><span>{choice === null ? 'Select your upgrade' : `${perks[state.rewards[choice]!].title} selected`}</span><button disabled={choice === null} onClick={() => choice !== null && controller.reward(choice)}>Take upgrade →</button></div>
    <div className="horde-or">OR GROW YOUR NUMBERS</div><button className="horde-skip" onClick={() => controller.reward('skip')}><HordeIcon name="permanent" />Skip upgrade · +10 permanent zombies</button>
  </Modal>;
}
