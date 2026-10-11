import type { PassivePerk, Perk } from '../game/types';

export const PASSIVE_PERKS = ['vigor', 'fangs', 'necromancy', 'haste', 'lasting'] as const;
export const isPassivePerk = (perk: Perk): perk is PassivePerk => (PASSIVE_PERKS as readonly string[]).includes(perk);
export const PERK_INFO = {
  mines: { title: 'Corpse mines', role: 'TRAPS', cost: 'Temporary recruits only · needs 1+', color: '#e4ad72', text: 'Q plants half your available temporary recruits (rounded down, at least one). They stay still for 2 seconds, then explode. Your horde can walk through them.' },
  sling: { title: 'Zombie sling', role: 'ARTILLERY', cost: 'Uses temporary zombies', color: '#95ccd1', text: 'Q aims the sling. Move the mouse, then left-click to launch a temporary zombie into the scatter circle. Right-click cancels.' },
  feast: { title: 'Blood feast', role: 'SUSTAIN', cost: 'Bite to recover health', color: '#c8a4d8', text: 'Q grants 5 seconds of faster bites that heal the biting zombie. Get close and feed to recover.' },
  sprint: { title: 'Sprint', role: 'MOBILITY', cost: 'Keeps Q / E slots free', color: '#c5cf91', text: 'Space doubles movement speed for 1.4 seconds. Recharges in 7 seconds. Keeps Q/E free for other abilities.' },
  vigor: { title: 'Gravehide', role: 'PASSIVE · SURVIVAL', cost: 'Always active · no ability slot', color: '#b3cc9c', text: 'All living zombies gain 15 maximum health and recover 15 health. Future zombies also start with 45 health. Normal knight hits and crossbow bolts still kill.' },
  fangs: { title: 'Ravenous fangs', role: 'PASSIVE · DAMAGE', cost: 'Always active · no ability slot', color: '#e49b91', text: 'Every automatic bite deals 6 damage instead of 4. Applies to permanent zombies and temporary recruits for the rest of the march.' },
  necromancy: { title: 'Grave calling', role: 'PASSIVE · RECRUITMENT', cost: 'Always active · no ability slot', color: '#9cd5ba', text: 'Recruitment craters raise 16 temporary zombies instead of 12. Summoning still takes 2 seconds and respects the recruitment capacity of 60 living zombies.' },
  haste: { title: 'Restless march', role: 'PASSIVE · MOVEMENT', cost: 'Always active · no ability slot', color: '#95cddd', text: 'The horde moves 15% faster, including during Sprint. Use the extra speed to escape warnings and reach the next active crater.' },
  lasting: { title: 'Lingering souls', role: 'PASSIVE · RECRUITS', cost: 'Always active · no ability slot', color: '#bca8df', text: 'Temporary recruits last 20 seconds longer. Existing recruits gain 20 seconds immediately, and new recruits start with 65 seconds.' },
} satisfies Record<Perk, { title: string; role: string; cost: string; color: string; text: string }>;
