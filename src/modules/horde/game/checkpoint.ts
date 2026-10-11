import { createEncounter, cancelAim } from './world';
import { PERKS, RULES, SITES } from './rules';
import { PASSIVE_PERKS } from '../data/perks';
import { locationForWave } from '../data/campaign';
import type { Encounter, Perk } from './types';

export interface Checkpoint { runId: string; savedAt: number; world: Encounter }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const unique = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max && new Set(value).size === value.length;
const nonnegative = (values: number[], max = 86400) => values.every(n => n >= 0 && n <= max);

// Read only the known structure. Unknown properties never become live simulation fields.
function copyShape<T extends object>(template: T, value: unknown): T {
  if (!object(value)) throw new Error('Invalid checkpoint object');
  const result = template as Record<string, unknown>;
  for (const [key, expected] of Object.entries(result)) {
    if (Array.isArray(expected)) continue;
    const actual = value[key];
    if (object(expected)) result[key] = copyShape(expected, actual);
    else if (typeof expected === 'number') {
      if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual) > 0xffffffff) throw new Error('Invalid checkpoint number');
      result[key] = actual;
    } else if (expected === null) {
      if (actual !== null && !integer(actual, 0, 1e9)) throw new Error('Invalid checkpoint reference');
      result[key] = actual;
    } else {
      if (typeof expected !== typeof actual) throw new Error('Invalid checkpoint field');
      result[key] = actual;
    }
  }
  return template;
}
export function readCheckpoint(value: unknown): Checkpoint | null {
  try {
    if (!object(value) || typeof value.runId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.runId) || !integer(value.savedAt, 0, Number.MAX_SAFE_INTEGER) || !object(value.world)) return null;
    const source = value.world, world = copyShape(createEncounter(), source);
    if (!['ready', 'playing'].includes(world.status) || !integer(world.wave, 1, RULES.waves) || world.elapsed < 0 || world.elapsed > 86400 || !integer(world.rng, 1, 0xffffffff)) return null;
    if (![world.nextId, world.casualties, world.recruited, world.expiredCount].every(n => integer(n, 0, 1e9)) || !nonnegative([world.waveTimeLeft, world.sprintRemaining, world.sprintCooldown, world.nextSiteAt, world.siteProgress])) return null;
    if (!Array.isArray(source.zombies) || source.zombies.length > 200 || source.zombies.length === 0) return null;
    const zombieTemplate = createEncounter().zombies[0]!;
    world.zombies = source.zombies.map(value => copyShape({ ...zombieTemplate }, value));
    const ids = new Set<number>();
    for (const z of world.zombies) {
      if (!integer(z.id, 0, 1e9) || ids.has(z.id) || !['permanent', 'temporary'].includes(z.kind) || z.hp < 0 || z.hp > z.maxHp || ![30, 45].includes(z.maxHp) || Math.abs(z.x) > RULES.halfWidth || Math.abs(z.z) > RULES.halfDepth || z.lifetime < 0 || z.lifetime > 65) return null;
      if (!nonnegative([z.bite, z.flash, z.deadFor, z.airborne, z.speed], 200)) return null;
      ids.add(z.id);
    }
    if (!world.zombies.some(z => z.hp > 0 && z.kind === 'permanent') || world.nextId <= Math.max(...ids)) return null;
    if (!Array.isArray(source.abilities) || source.abilities.length !== 2) return null;
    world.abilities = source.abilities.map(value => {
      if (!object(value) || ![null, 'mines', 'sling', 'feast'].includes(value.upgrade as null | string)) throw new Error('Invalid ability');
      const a = copyShape({ ...createEncounter().abilities[0]!, upgrade: null }, { ...value, upgrade: null });
      a.upgrade = value.upgrade as typeof a.upgrade;
      if (!nonnegative([a.cooldown, a.fuse, a.feast, a.flightElapsed], 120)) throw new Error('Invalid ability time');
      if (!unique(value.armed, 200) || !value.armed.every(id => integer(id, 0, 1e9) && world.zombies.some(z => z.id === id && z.kind === 'temporary' && z.locked && z.hp > 0))) throw new Error('Invalid mines');
      a.armed = [...value.armed] as number[];
      if (a.projectile !== null && !world.zombies.some(z => z.id === a.projectile && z.kind === 'temporary' && z.locked && z.hp > 0)) throw new Error('Invalid projectile');
      if (a.armed.length && a.upgrade !== 'mines' || a.projectile !== null && a.upgrade !== 'sling' || a.feast > 0 && a.upgrade !== 'feast') throw new Error('Invalid active effect');
      return a;
    });
    const activePerks = world.abilities.map(a => a.upgrade).filter(p => p !== null);
    if (new Set(activePerks).size !== activePerks.length) return null;
    const lockedIds = world.abilities.flatMap(a => [...a.armed, ...(a.projectile === null ? [] : [a.projectile])]);
    if (new Set(lockedIds).size !== lockedIds.length || world.zombies.some(z => z.locked && !lockedIds.includes(z.id))) return null;
    if (!unique(source.passives, PASSIVE_PERKS.length) || !source.passives.every(p => (PASSIVE_PERKS as readonly unknown[]).includes(p))) return null;
    world.passives = [...source.passives] as Encounter['passives'];
    if (!unique(source.offeredRewards, 2) || !source.offeredRewards.every(p => PERKS.includes(p as Perk))) return null;
    world.offeredRewards = [...source.offeredRewards] as Perk[];
    const k = world.knight;
    if (!['hunt', 'windup', 'strike', 'recovery', 'stopped'].includes(k.state) || !['sweep', 'spin', 'charge', 'crossbow', 'rush', 'bash', 'consecration', 'lance', 'firebomb', 'shockwave'].includes(k.attack) || !integer(k.phase, 1, 3) || k.maxHp !== locationForWave(world.wave).hp || k.hp < 0 || k.hp > k.maxHp || (k.hp === 0) !== world.betweenWaves) return null;
    if (!nonnegative([k.timer, k.flash, k.crossbowCooldown, k.rushCooldown, k.specialCooldown, k.rushSpeed, k.bolt.remaining], 120) || !integer(k.attackNumber, 0, 1e9)) return null;
    if (world.awaitingReward && !world.betweenWaves || !world.awaitingReward && world.offeredRewards.length) return null;
    const sourceKnight = source.knight as Record<string, unknown>;
    if (!unique(sourceKnight.hitIds, 200) || !sourceKnight.hitIds.every(id => integer(id, 0, 1e9))) return null;
    k.hitIds = [...sourceKnight.hitIds] as number[];
    for (const site of [world.activeSite, world.lastSite]) if (site !== null && !integer(site, 0, SITES.length - 1)) return null;
    world.events = []; world.paused = true; cancelAim(world);
    for (const z of world.zombies) z.moving = false;
    return { runId: value.runId, savedAt: value.savedAt, world };
  } catch { return null; }
}
export function captureCheckpoint(world: Encounter, runId: string, now = Date.now()): Checkpoint | null {
  if (!['ready', 'playing'].includes(world.status)) return null;
  return readCheckpoint({ runId, savedAt: now, world: structuredClone(world) });
}
