import { PERKS, RULES } from "./rules";
import { add, clamp, distance, scale } from "./math";
import { locationForWave } from '../data/campaign';
import { isPassivePerk } from '../data/perks';
import { startingHealth, recruitLifetime } from './perk-effects';
import type { Ability, Encounter, GameEvent, Knight, Perk, Point, Zombie } from "./types";
export const alive = (world: Encounter) => world.zombies.filter(a => a.hp > 0);
export const permanentCount = (world: Encounter) => world.zombies.filter(a => a.hp > 0 && a.kind === "permanent").length;
export const centerOf = (members: Point[]): Point => members.length ? scale(members.reduce(add, { x: 0, z: 0 }), 1 / members.length) : { x: 0, z: 0 };
export function random(world: Encounter) {
  // Independent local random state: replays can supply a seed; no browser/global RNG in the rules.
  let n = world.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; world.rng = n >>> 0;
  return world.rng / 4294967296;
}
export function emit(world: Encounter, event: GameEvent) { world.events.push(event); if (world.events.length > 128) world.events.shift(); }
export function clampBody(body: Point, radius: number): void {
  body.x = clamp(body.x, -RULES.halfWidth + radius, RULES.halfWidth - radius);
  body.z = clamp(body.z, -RULES.halfDepth + radius, RULES.halfDepth - radius);
}
export function newAbility(): Ability {
  return { upgrade: null, cooldown: 0, fuse: 0, feast: 0, armed: [], projectile: null, flightElapsed: 0,
    launch: { x: 0, z: 0 }, landing: { x: 0, z: 0 }, aiming: false, aim: { x: 0, z: 0 }, aimValid: false, aimOnGround: false };
}
export function newKnight(wave: number, position: Point = { x: 6, z: -3 }): Knight {
  const hp = locationForWave(wave).hp;
  return { ...position, hp, maxHp: hp, facing: 0, phase: 1, state: "hunt", attack: "sweep", timer: 0, attackNumber: 0,
    flash: 0, moving: false, origin: { ...position }, direction: { x: 0, z: -1 }, chargeEnd: { ...position }, hitIds: [],
    crossbowCooldown: 1.5, rushCooldown: 3, rushSpeed: 0, rushTurn: 0, target: { ...position }, specialCooldown: 7,
    bolt: { ...position, flying: false, direction: { x: 0, z: -1 }, remaining: 0 } };
}
export function spawnZombie(world: Encounter, point: Point, kind: Zombie["kind"] = "permanent"): Zombie {
  const health = startingHealth(world);
  const zombie: Zombie = { ...point, id: world.nextId++, kind, hp: health, maxHp: health,
    bite: 0, lifetime: kind === "temporary" ? recruitLifetime(world) : 0, expired: false, locked: false, feasting: false,
    facing: 0, moving: false, speed: 0, flash: 0, deadFor: 0, airborne: 0, flightSpin: 0 };
  clampBody(zombie, RULES.zombieRadius); world.zombies.push(zombie); return zombie;
}
export function createEncounter(normal = false, seed = 0x7e57c0de): Encounter {
  const world: Encounter = { status: "ready", normal, paused: false, elapsed: 0, zombies: [], knight: newKnight(1),
    wave: 1, betweenWaves: false, awaitingReward: false, offeredRewards: [], waveTimeLeft: 0,
    sprintUnlocked: false, sprintRemaining: 0, sprintCooldown: 0, abilities: [newAbility(), newAbility()], passives: [],
    casualties: 0, recruited: 0, expiredCount: 0, nextId: 0, activeSite: null, lastSite: null,
    nextSiteAt: 0, siteProgress: 0, rng: (seed >>> 0) || 1, events: [] };
  for (let i = 0; i < RULES.count; i++) {
    const angle = i * 2.399963, radius = RULES.spawnSpacing * Math.sqrt(i);
    spawnZombie(world, { x: RULES.spawnX + Math.cos(angle) * radius, z: RULES.spawnZ + Math.sin(angle) * radius });
  }
  return world;
}
export function cancelAim(world: Encounter) { for (const a of world.abilities) { a.aiming = false; a.aimValid = false; } }
export function cancelAbilities(world: Encounter) {
  cancelAim(world);
  for (const a of world.abilities) { a.armed = []; a.fuse = 0; a.feast = 0; a.projectile = null; }
  for (const a of alive(world)) { a.locked = false; a.feasting = false; a.airborne = 0; a.flightSpin = 0; }
}
export function finish(world: Encounter, won: boolean) {
  if (world.status === "won" || world.status === "lost") return;
  world.status = won ? "won" : "lost"; world.betweenWaves = false; world.awaitingReward = false;
  world.offeredRewards = []; world.waveTimeLeft = 0; world.sprintRemaining = 0;
  world.knight.state = "stopped"; world.knight.moving = false; world.knight.bolt.flying = false;
  world.knight.rushSpeed = 0; world.knight.rushTurn = 0;
  cancelAbilities(world); for (const a of alive(world)) a.moving = false;
  emit(world, { type: won ? "victory" : "defeat" });
}
export function damageZombie(world: Encounter, a: Zombie, damage: number, expired = false) {
  if (a.hp <= 0 || ["won", "lost"].includes(world.status)) return;
  a.hp = Math.max(0, a.hp - Math.max(0, damage)); if (!expired) a.flash = 0.12;
  if (a.hp > 0) { emit(world, { type: "zombie-hit" }); return; }
  a.expired = expired; a.deadFor = 0; a.moving = false; a.locked = false; a.airborne = 0; a.flightSpin = 0;
  if (expired) world.expiredCount++; else world.casualties++;
  for (const ability of world.abilities) {
    ability.armed = ability.armed.filter(id => id !== a.id);
    if (ability.projectile === a.id) ability.projectile = null;
  }
  emit(world, { type: expired ? "expired" : "zombie-death", x: a.x, z: a.z });
  if (permanentCount(world) === 0) finish(world, false);
}
export function damageKnight(world: Encounter, damage: number) {
  const k = world.knight;
  if (k.hp <= 0 || world.betweenWaves || ["won", "lost"].includes(world.status)) return;
  k.hp = Math.max(0, k.hp - Math.max(0, damage)); k.flash = 0.12; emit(world, { type: "knight-hit" });
  k.phase = Math.max(k.phase, k.hp * 3 <= k.maxHp ? 3 : k.hp * 3 <= k.maxHp * 2 ? 2 : 1);
  if (k.hp > 0) return;
  k.state = "stopped"; k.bolt.flying = false; k.moving = false;
  if (world.wave >= RULES.waves) { finish(world, true); return; }
  world.betweenWaves = true; world.awaitingReward = true; world.waveTimeLeft = RULES.waveBreak;
  cancelAim(world); for (const a of alive(world)) a.moving = false;
  const pool = PERKS.filter(perk => !hasPerk(world, perk) && (isPassivePerk(perk) || perk === 'sprint' || world.abilities.some(a => a.upgrade === null)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random(world) * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  world.offeredRewards = pool.slice(0, 2); emit(world, { type: "wave-cleared" });
}
export function hasPerk(world: Encounter, perk: Perk) {
  return isPassivePerk(perk) ? world.passives.includes(perk) : perk === "sprint" ? world.sprintUnlocked : world.abilities.some(a => a.upgrade === perk);
}
export function grantPerk(world: Encounter, perk: Perk): boolean {
  if (hasPerk(world, perk)) return false;
  if (isPassivePerk(perk)) {
    world.passives.push(perk);
    for (const zombie of alive(world)) {
      if (perk === 'vigor') { zombie.maxHp += 15; zombie.hp = Math.min(zombie.maxHp, zombie.hp + 15); }
      if (perk === 'lasting' && zombie.kind === 'temporary') zombie.lifetime += 20;
    }
    emit(world, { type: 'perk-gained', upgrade: perk }); return true;
  }
  if (perk === "sprint") { world.sprintUnlocked = true; return true; }
  const empty = world.abilities.find(a => a.upgrade === null);
  if (!empty || !PERKS.includes(perk)) return false;
  empty.upgrade = perk; return true;
}
export function addZombies(world: Encounter, amount: number, location: Point, temporary = true) {
  if (permanentCount(world) === 0 || ["won", "lost"].includes(world.status) || (temporary && world.betweenWaves)) return 0;
  const added = Math.max(0, temporary ? Math.min(amount, RULES.maxAgents - alive(world).length) : amount);
  for (let i = 0; i < added; i++) {
    const angle = (i + world.recruited) * 2.399963, radius = RULES.spawnSpacing * Math.sqrt(i + 1);
    spawnZombie(world, { x: location.x + Math.cos(angle) * radius, z: location.z + Math.sin(angle) * radius }, temporary ? "temporary" : "permanent");
  }
  world.recruited += added; if (added) emit(world, { type: "recruited" }); return added;
}
export function resolveReward(world: Encounter, index: number | "skip"): boolean {
  if (!world.awaitingReward || !world.betweenWaves || world.paused || ["won", "lost"].includes(world.status)) return false;
  if (index === "skip") addZombies(world, 10, centerOf(alive(world)), false);
  else { const perk = world.offeredRewards[index]; if (!perk || !grantPerk(world, perk)) return false; }
  world.awaitingReward = false; world.offeredRewards = []; return true;
}
export function startNextWave(world: Encounter) {
  const center = centerOf(alive(world)); let best = { x: 0, z: 0 }, farthest = -1;
  for (const x of [-RULES.halfWidth + 6, RULES.halfWidth - 6]) for (const z of [-RULES.halfDepth + 6, RULES.halfDepth - 6]) {
    const p = { x, z }, d = distance(p, center); if (d > farthest) { farthest = d; best = p; }
  }
  world.wave++; world.knight = newKnight(world.wave, best); world.betweenWaves = false; world.waveTimeLeft = 0;
  world.activeSite = null; world.lastSite = null; world.siteProgress = 0; world.nextSiteAt = world.elapsed;
  emit(world, { type: "wave-start" });
}
