import { RULES } from './rules';
import type { Encounter, PassivePerk } from './types';

export const hasPassive = (world: Encounter, perk: PassivePerk) => world.passives.includes(perk);
export const startingHealth = (world: Encounter) => RULES.zombieHealth + (hasPassive(world, 'vigor') ? 15 : 0);
export const recruitLifetime = (world: Encounter) => RULES.lifetime + (hasPassive(world, 'lasting') ? 20 : 0);
export const recruitmentStock = (world: Encounter) => RULES.reserves + (hasPassive(world, 'necromancy') ? 4 : 0);
export const biteDamage = (world: Encounter) => RULES.biteDamage + (hasPassive(world, 'fangs') ? 2 : 0);
export const marchSpeed = (world: Encounter) => RULES.speed * (hasPassive(world, 'haste') ? 1.15 : 1);
