import type { Perk } from '../game/types';
import { PERK_INFO } from '../data/perks';
import { IconGlyph } from './HordeIcon';

// Original emblem illustrations: faceted frames keep every reward in the same family.
export function PerkArtwork({ perk }: { perk: Perk }) {
  return <svg className="horde-perk-artwork" viewBox="0 0 240 190" aria-hidden="true" focusable="false" style={{ color: PERK_INFO[perk].color }}>
    <path d="M12 166 37 138 57 152 82 121 123 150 156 120 182 145 209 132 230 165v25H12Z" fill="#18231f" />
    <ellipse cx="120" cy="163" rx="74" ry="14" fill="#070b09" opacity=".6" />
    <path d="m120 9 75 38v77l-75 41-75-41V47Z" fill="#26302a" stroke="currentColor" strokeOpacity=".35" />
    <path d="m120 18 66 33v68l-66 36-66-36V51Z" fill="currentColor" opacity=".12" />
    <path d="m54 51 66-33 66 33-66-8Z" fill="currentColor" opacity=".2" />
    <path d="m54 51 11 67 55 37-66-36Zm132 0-11 67-55 37 66-36Z" fill="#080e0b" opacity=".45" />
    <path d="m120 28 48 27v57l-48 27-48-27V55Z" fill="#101a16" stroke="currentColor" strokeOpacity=".2" />
    <g transform="translate(78 42) scale(2.65)"><IconGlyph name={perk} /></g>
    <path d="m43 131 15 4-8 8m139-12-15 4 8 8M33 148l9 1m165-1-9 1" fill="none" stroke="currentColor" opacity=".7" strokeWidth="2" />
    <circle cx="120" cy="157" r="3" fill="currentColor" />
  </svg>;
}
