import { RULES } from "./rules";
import { add, angleBetween, clamp, closest, distance, dot, length, lerp, moveToward, normalized, rotate, scale, subtract } from "./math";
import { alive, centerOf, clampBody, damageZombie, emit } from "./world";
import { locationForWave } from '../data/campaign';
import { advanceSpecialStrike, isSpecial, SPECIALS, specialTarget, startSpecialStrike } from './knight-specials';
import type { Attack, Encounter, Point } from "./types";

export const mountedKnight = (world: Encounter) => locationForWave(world.wave).knightModel === 3;
export const windupTime = (kind: Attack) => isSpecial(kind) ? SPECIALS[kind].windup : ({ sweep: RULES.windup, charge: RULES.chargeWindup, spin: RULES.spinWindup, crossbow: RULES.crossbowWindup, rush: RULES.rushWindup })[kind];
export const strikeTime = (world: Encounter) => isSpecial(world.knight.attack) ? SPECIALS[world.knight.attack].strike : ({ sweep: RULES.strike, charge: RULES.chargeDuration / (mountedKnight(world) ? 1.4 : 1), spin: RULES.spinDuration, crossbow: 0.18, rush: RULES.rushDuration })[world.knight.attack];
export const recoveryTime = (kind: Attack) => isSpecial(kind) ? SPECIALS[kind].recovery : ({ sweep: RULES.recovery, charge: RULES.chargeRecovery, spin: RULES.spinRecovery, crossbow: RULES.crossbowRecovery, rush: RULES.rushRecovery })[kind];
const radius = (world: Encounter) => mountedKnight(world) ? 0.75 : RULES.knightRadius;
const facing = (p: Point) => Math.atan2(p.x, p.z);

function endpoint(world: Encounter, target: Point): Point {
  const k = world.knight, offset = subtract(target, k);
  const end = add(k, scale(normalized(offset), Math.min(RULES.chargeRange, length(offset) + 1.5)));
  clampBody(end, radius(world)); return end;
}
function countTargets(world: Encounter, kind: Attack, target: Point, targets: Point[]) {
  const k = world.knight;
  let direction = normalized(subtract(target, k)), laneLength = 0, width: number = RULES.chargeWidth;
  if (kind === "crossbow") { laneLength = RULES.crossbowRange; width = RULES.boltRadius * 2; }
  if (kind === "charge") {
    const end = endpoint(world, target); laneLength = distance(k, end);
    if (laneLength < 0.1) return 0;
    direction = normalized(subtract(end, k));
  }
  return targets.filter(point => {
    const offset = subtract(point, k);
    if (kind === "sweep") return dot(normalized(offset), direction) >= Math.cos(80 * Math.PI / 180);
    const along = dot(offset, direction);
    return along >= 0 && along <= laneLength && length(subtract(offset, scale(direction, along))) <= width / 2;
  }).length;
}
export function chooseAttackTarget(world: Encounter, kind: Attack, fallback: Point): Point {
  if (kind === "spin") return { ...fallback };
  if (isSpecial(kind)) {
    if (kind !== 'consecration' && kind !== 'firebomb') return { ...fallback };
    const candidates = [fallback, centerOf(alive(world)), ...alive(world)];
    let best = specialTarget(world, kind, fallback), count = -1;
    for (const candidate of candidates) {
      const target = specialTarget(world, kind, candidate);
      const found = alive(world).filter(a => distance(a, target) <= SPECIALS[kind].radius).length;
      if (found > count) { best = target; count = found; }
    }
    return best;
  }
  const k = world.knight;
  const reach = kind === "crossbow" ? RULES.crossbowRange : kind === "charge" ? Math.hypot(RULES.chargeRange, RULES.chargeWidth / 2) : RULES.attackRange;
  const targets = alive(world).filter(a => distance(a, k) <= reach);
  let best = { ...fallback }, count = countTargets(world, kind, best, targets);
  for (const target of targets) {
    const offset = subtract(target, k); if (length(offset) < 1e-6) continue;
    const width = kind === "crossbow" ? RULES.boltRadius * 2 : RULES.chargeWidth;
    const half = Math.max(0, (kind === "sweep" ? 80 * Math.PI / 180 : Math.asin(Math.min(1, width / 2 / length(offset)))) - 0.0001);
    for (const angle of [0, -half, half]) {
      const aim = add(k, rotate(offset, angle)), candidate = countTargets(world, kind, aim, targets);
      if (candidate > count) { count = candidate; best = aim; }
    }
  }
  return best;
}
export function beginAttack(world: Encounter, kind: Attack, target: Point) {
  if (kind === "rush" && !mountedKnight(world)) return;
  const k = world.knight;
  k.attack = kind; k.attackNumber++; k.direction = normalized(subtract(target, k));
  if (length(k.direction) < 1e-6) k.direction = { x: 0, z: -1 };
  k.origin = { x: k.x, z: k.z }; k.chargeEnd = endpoint(world, target); k.target = isSpecial(kind) ? specialTarget(world, kind, target) : { ...target };
  if (kind === "charge" && distance(k.origin, k.chargeEnd) < 0.1) k.attack = kind = "sweep";
  if (kind === "charge") k.direction = normalized(subtract(k.chargeEnd, k.origin));
  if (kind === "crossbow") k.crossbowCooldown = RULES.crossbowInterval;
  if (kind === "rush") { k.rushCooldown = RULES.rushInterval; k.rushSpeed = RULES.knightSpeed * 2; k.rushTurn = 0; }
  if (isSpecial(kind)) k.specialCooldown = SPECIALS[kind].cooldown;
  k.state = "windup"; k.timer = 0; k.hitIds = []; k.moving = false; k.facing = facing(k.direction);
  emit(world, { type: "attack-warned", attack: kind });
}
function recover(world: Encounter) {
  const k = world.knight; k.state = "recovery"; k.timer = 0; k.moving = false; k.rushSpeed = 0; k.rushTurn = 0;
}
function hitArea(world: Encounter) {
  const k = world.knight; let hit = false;
  for (const a of alive(world)) {
    if (k.state === "stopped") break;
    const offset = subtract(a, k.origin);
    const inside = k.attack === "spin" ? length(offset) <= RULES.spinRadius : length(offset) <= RULES.attackRange && dot(normalized(offset), k.direction) >= Math.cos(80 * Math.PI / 180);
    if (inside) { damageZombie(world, a, world.normal ? a.hp : k.attack === "spin" ? RULES.spinDamage : RULES.attackDamage); hit = true; }
  }
  if (hit) emit(world, { type: "attack-hit" });
}
function hitPath(world: Encounter, from: Point, to: Point, rush: boolean) {
  const k = world.knight; let hit = false;
  for (const a of alive(world)) {
    if (k.state === "stopped") break;
    if (k.hitIds.includes(a.id)) continue;
    const along = dot(subtract(a, k.origin), k.direction);
    if (!rush && (along < 0 || along > distance(k.origin, k.chargeEnd))) continue;
    if (distance(a, closest(a, from, to)) <= (rush ? RULES.rushWidth : RULES.chargeWidth) / 2) {
      k.hitIds.push(a.id); damageZombie(world, a, world.normal ? a.hp : rush ? RULES.rushDamage : RULES.chargeDamage); hit = true;
    }
  }
  if (hit) emit(world, { type: "attack-hit" });
}
export function advanceBolt(world: Encounter, dt: number) {
  const bolt = world.knight.bolt; if (!bolt.flying) return;
  const travel = Math.min(RULES.boltSpeed * dt, bolt.remaining), origin = { x: bolt.x, z: bolt.z };
  const entries = alive(world).flatMap(a => {
    const offset = subtract(a, origin), along = dot(offset, bolt.direction);
    const sideSquared = Math.max(0, dot(offset, offset) - along * along);
    if (sideSquared > RULES.boltRadius ** 2) return [];
    const halfChord = Math.sqrt(RULES.boltRadius ** 2 - sideSquared), entry = Math.max(0, along - halfChord);
    return along + halfChord >= 0 && entry <= travel ? [{ a, entry }] : [];
  }).sort((a, b) => a.entry - b.entry);
  let hit = false;
  for (const { a, entry } of entries) {
    if (!bolt.flying) break;
    Object.assign(bolt, add(origin, scale(bolt.direction, entry))); damageZombie(world, a, a.hp); hit = true;
  }
  if (hit) emit(world, { type: "attack-hit" });
  if (!bolt.flying) return;
  Object.assign(bolt, add(origin, scale(bolt.direction, travel))); bolt.remaining -= travel;
  if (bolt.remaining <= 0) bolt.flying = false;
}
function advanceRush(world: Encounter, dt: number) {
  const k = world.knight, turnLimit = RULES.rushTurnSpeed * Math.PI / 180;
  let remaining = dt;
  while (remaining > 0.00001 && k.state === "strike") {
    const step = Math.min(remaining, 1 / 60); remaining -= step;
    const offset = subtract(centerOf(alive(world)), k);
    const desiredTurn = dot(offset, offset) > 0.25 ? clamp(angleBetween(k.direction, normalized(offset)) * 2, -turnLimit, turnLimit) : 0;
    k.rushTurn = moveToward(k.rushTurn, desiredTurn, RULES.rushTurnAcceleration * Math.PI / 180 * step);
    k.direction = normalized(rotate(k.direction, k.rushTurn * step));
    k.rushSpeed = moveToward(k.rushSpeed, RULES.rushSpeed, RULES.rushAcceleration * step);
    const previous = { x: k.x, z: k.z }, next = add(k, scale(k.direction, k.rushSpeed * step));
    Object.assign(k, next); clampBody(k, radius(world)); hitPath(world, previous, k, true);
    if ((k.state as string) === "stopped") return;
    if (distance(k, next) > 1e-6) { recover(world); return; }
  }
  k.facing = facing(k.direction); k.moving = true;
}
function hunt(world: Encounter, dt: number) {
  const k = world.knight, living = alive(world);
  const nearest = living.reduce<typeof living[number] | null>((best, a) => !best || distance(a, k) < distance(best, k) ? a : best, null);
  if (!nearest) return;
  const d = distance(nearest, k);
  const location = locationForWave(world.wave), special = location.special;
  if (k.specialCooldown <= 0 && d <= SPECIALS[special].range) { beginAttack(world, special, chooseAttackTarget(world, special, nearest)); return; }
  if (mountedKnight(world) && k.rushCooldown <= 0 && d <= RULES.rushRange) { beginAttack(world, "rush", centerOf(living)); return; }
  if (location.knightModel >= 2 && k.crossbowCooldown <= 0 && d >= RULES.crossbowMinRange && d <= RULES.crossbowRange) { beginAttack(world, "crossbow", chooseAttackTarget(world, "crossbow", nearest)); return; }
  const pattern: Attack[] = k.phase === 1 ? ["sweep", "sweep", "charge"] : k.phase === 2 ? ["sweep", "charge", "spin"] : ["charge", "spin", "sweep", "spin"];
  let next = pattern[k.attackNumber % pattern.length]!;
  if (d > RULES.attackRange && d <= RULES.chargeRange) next = "charge";
  const reach = next === "charge" ? RULES.chargeRange : next === "spin" ? RULES.spinRadius : RULES.attackRange;
  if (d <= reach) { beginAttack(world, next, chooseAttackTarget(world, next, nearest)); return; }
  const direction = normalized(subtract(nearest, k)); Object.assign(k, add(k, scale(direction, RULES.knightSpeed * (mountedKnight(world) ? 2 : 1) * dt)));
  clampBody(k, radius(world)); k.facing = facing(direction); k.moving = true;
}
export function updateKnight(world: Encounter, dt: number) {
  const k = world.knight; if (world.status !== 'playing' || world.paused || world.betweenWaves || k.state === "stopped" || k.hp <= 0) return;
  k.crossbowCooldown = Math.max(0, k.crossbowCooldown - dt); k.rushCooldown = Math.max(0, k.rushCooldown - dt); k.specialCooldown = Math.max(0, k.specialCooldown - dt);
  advanceBolt(world, dt); if ((k.state as string) === "stopped") return;
  k.moving = false;
  switch (k.state) {
    case "hunt": hunt(world, dt); break;
    case "windup":
      k.timer += dt;
      if (k.timer >= windupTime(k.attack)) {
        k.state = "strike"; k.timer = 0;
        const target = k.attack === 'consecration' || k.attack === 'firebomb' ? k.target : k.origin;
        const reach = isSpecial(k.attack) ? SPECIALS[k.attack].range : undefined;
        emit(world, { type: "attack-struck", attack: k.attack, x: target.x, z: target.z, radius: k.attack === 'consecration' || k.attack === 'firebomb' ? SPECIALS[k.attack].radius : reach });
        if (k.attack === "crossbow") Object.assign(k.bolt, k.origin, { flying: true, direction: { ...k.direction }, remaining: RULES.crossbowRange });
        else if (isSpecial(k.attack)) startSpecialStrike(world);
        else if (k.attack !== "charge" && k.attack !== "rush") hitArea(world);
      }
      break;
    case "strike":
      if (k.attack === "rush") { advanceRush(world, Math.min(dt, Math.max(0, RULES.rushDuration - k.timer))); if (k.state !== "strike") return; }
      if (isSpecial(k.attack)) advanceSpecialStrike(world, k.timer, k.timer + dt);
      k.timer += dt;
      if (k.attack === "charge") {
        const previous = { x: k.x, z: k.z }; Object.assign(k, lerp(k.origin, k.chargeEnd, Math.min(k.timer / strikeTime(world), 1)));
        k.moving = true; hitPath(world, previous, k, false);
      }
      if ((k.state as string) !== "stopped" && k.timer >= strikeTime(world)) recover(world);
      break;
    case "recovery": k.timer += dt; if (k.timer >= recoveryTime(k.attack)) { k.state = "hunt"; k.timer = 0; } break;
  }
}
