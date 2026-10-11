import { add, clamp, distance, dot, length, normalized, scale, subtract } from './math';
import { RULES } from './rules';
import { alive, clampBody, damageZombie, emit } from './world';
import type { SignatureAttack } from '../data/campaign';
import type { Attack, Encounter, Point } from './types';

// The damage rules and the ground previews share these dimensions and durations.
export const SPECIALS = {
  bash: { windup: 1.15, strike: 0.22, recovery: 1.55, cooldown: 10, range: 3, degrees: 110, damage: 8, knockback: 2.5 },
  consecration: { windup: 1.8, strike: 0.35, recovery: 1.8, cooldown: 12, range: 16, radius: 3, damage: 18 },
  lance: { windup: 1.4, strike: 0.28, recovery: 1.9, cooldown: 11, range: 7.5, width: 1.5, damage: 22 },
  firebomb: { windup: 1.7, strike: 3, recovery: 1.7, cooldown: 13, range: 16, radius: 2.7, damage: 8, tickDamage: 4, cadence: 0.5 },
  shockwave: { windup: 1.9, strike: 1.8, recovery: 2.1, cooldown: 14, range: 9, width: 0.55, damage: 18 },
} as const;
export const isSpecial = (attack: Attack): attack is SignatureAttack => Object.hasOwn(SPECIALS, attack);
export const shockwaveRadius = (elapsed: number) => SPECIALS.shockwave.range * clamp(elapsed / SPECIALS.shockwave.strike, 0, 1);

export function specialTarget(world: Encounter, kind: SignatureAttack, target: Point): Point {
  const k = world.knight, offset = subtract(target, k), reach = SPECIALS[kind].range;
  const p = add(k, scale(normalized(offset), Math.min(reach, length(offset))));
  if (kind === 'consecration' || kind === 'firebomb') clampBody(p, SPECIALS[kind].radius);
  return p;
}
export function insideSpecial(world: Encounter, kind: SignatureAttack, point: Point): boolean {
  const k = world.knight;
  if (kind === 'consecration' || kind === 'firebomb') return distance(point, k.target) <= SPECIALS[kind].radius;
  const offset = subtract(point, k.origin);
  if (kind === 'bash') return length(offset) <= SPECIALS.bash.range && (length(offset) < 1e-9 || dot(normalized(offset), k.direction) >= Math.cos(SPECIALS.bash.degrees * Math.PI / 360));
  if (kind === 'lance') {
    const along = dot(offset, k.direction);
    return along >= 0 && along <= SPECIALS.lance.range && length(subtract(offset, scale(k.direction, along))) <= SPECIALS.lance.width / 2;
  }
  return false;
}
function damageInside(world: Encounter, kind: SignatureAttack, damage: number, knockback = 0) {
  const k = world.knight; let hit = false;
  for (const a of alive(world)) {
    if (k.state === 'stopped') break;
    if (!insideSpecial(world, kind, a)) continue;
    damageZombie(world, a, world.normal ? a.hp : damage); hit = true;
    if (knockback && !a.locked && a.hp > 0 && (k.state as string) !== 'stopped') {
      const offset = normalized(subtract(a, k.origin));
      Object.assign(a, add(a, scale(length(offset) ? offset : k.direction, knockback)));
      clampBody(a, RULES.zombieRadius);
    }
  }
  if (hit) emit(world, { type: 'attack-hit', attack: kind });
}
export function startSpecialStrike(world: Encounter) {
  const kind = world.knight.attack;
  if (!isSpecial(kind)) return;
  if (kind === 'shockwave') advanceSpecialStrike(world, 0, 0);
  else damageInside(world, kind, SPECIALS[kind].damage, kind === 'bash' ? SPECIALS.bash.knockback : 0);
}
export function advanceSpecialStrike(world: Encounter, previous: number, current: number) {
  const k = world.knight;
  if (k.attack === 'firebomb') {
    const spec = SPECIALS.firebomb;
    // A crossed cadence boundary causes one tick, even when a frame is long.
    const first = Math.floor(Math.min(previous, spec.strike) / spec.cadence + 1e-9);
    const last = Math.floor(Math.min(current, spec.strike) / spec.cadence + 1e-9);
    for (let tick = first; tick < last && k.state !== 'stopped'; tick++) damageInside(world, 'firebomb', spec.tickDamage);
  } else if (k.attack === 'shockwave') {
    const halfWidth = SPECIALS.shockwave.width / 2;
    const inner = Math.max(0, shockwaveRadius(previous) - halfWidth), outer = shockwaveRadius(current) + halfWidth;
    let hit = false;
    for (const a of alive(world)) {
      if (k.state === 'stopped') break;
      const radius = distance(a, k.origin);
      if (k.hitIds.includes(a.id) || radius < inner || radius > outer) continue;
      k.hitIds.push(a.id); damageZombie(world, a, world.normal ? a.hp : SPECIALS.shockwave.damage); hit = true;
    }
    if (hit) emit(world, { type: 'attack-hit', attack: 'shockwave' });
  }
}
