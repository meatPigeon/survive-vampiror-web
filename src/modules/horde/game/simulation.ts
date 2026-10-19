// Pure rules translated from Godot. All input sources use this same state.
import { RULES, SITES } from "./rules";
import { distance } from "./math";
import { alive, addZombies, cancelAim, centerOf, damageKnight, damageZombie, emit, random, startNextWave } from "./world";
import { moveHorde } from "./movement";
import { tickAbility } from "./abilities";
import { updateKnight } from "./combat";
import type { Encounter } from "./types";
import { CAMPAIGN, locationForWave } from '../data/campaign';
import { biteDamage, recruitmentStock } from './perk-effects';
export * from "./types";
export * from "./rules";
export * from "./world";
export * from "./movement";
export * from "./abilities";
export * from "./combat";
export * from './perk-effects';

export function setPaused(w: Encounter, paused: boolean) {
  if (w.status !== "ready" && w.status !== "playing") return;
  w.paused = paused; if (paused) cancelAim(w);
}
function scheduleSite(w: Encounter) {
  if (w.elapsed < w.nextSiteAt) return;
  const candidates = SITES.map((_, i) => i).filter(i => i !== w.lastSite);
  if (w.activeSite !== null) emit(w, { type: "site-closed" });
  w.activeSite = candidates[w.lastSite === null ? 0 : Math.floor(random(w) * candidates.length)]!;
  w.lastSite = w.activeSite; w.siteProgress = 0; w.nextSiteAt = w.elapsed + RULES.siteInterval;
  emit(w, { type: "site-activated" });
}
function recruit(w: Encounter, dt: number) {
  if (w.activeSite === null) return;
  const living = alive(w), site = SITES[w.activeSite]!;
  if (living.length >= RULES.maxAgents || !living.some(a => !a.locked && distance(a, site) <= RULES.siteRadius)) { w.siteProgress = 0; return; }
  w.siteProgress += dt;
  if (w.siteProgress >= RULES.summonTime) {
    if (addZombies(w, recruitmentStock(w), site) > 0) { w.activeSite = null; emit(w, { type: "site-closed" }); w.nextSiteAt = w.elapsed + RULES.siteRespawnDelay; }
    w.siteProgress = 0;
  }
}
export function beginBattle(w: Encounter) {
  if (w.status !== "ready" || w.paused) return;
  w.status = "playing"; scheduleSite(w); emit(w, { type: "battle-start" });
}
export function stepEncounter(w: Encounter, dt: number, inputX = 0, inputZ = 0) {
  if (!Number.isFinite(dt) || dt <= 0 || w.paused || w.status === "won" || w.status === "lost") return;
  if (w.status === "ready") {
    if (Math.hypot(inputX, inputZ) < 1e-6) return;
    beginBattle(w);
  }
  if (w.betweenWaves) {
    if (w.awaitingReward) return;
    w.waveTimeLeft = Math.max(0, w.waveTimeLeft - dt);
    if (w.waveTimeLeft <= 0) startNextWave(w);
    return;
  }
  // Horde physics precedes arena priority 1. Combat ordering is intentional.
  moveHorde(w, { x: inputX, z: inputZ }, dt); w.elapsed += dt; if (w.levelElapsed >= 0) w.levelElapsed += dt;
  w.knight.flash = Math.max(0, w.knight.flash - dt);
  for (const a of w.zombies) { a.flash = Math.max(0, a.flash - dt); if (a.hp <= 0) a.deadFor += dt; }
  w.zombies = w.zombies.filter(a => a.hp > 0 || a.deadFor < 0.6);
  for (const a of alive(w)) {
    if (a.kind === "temporary") { a.lifetime = Math.max(0, a.lifetime - dt); if (a.lifetime <= 0) damageZombie(w, a, a.hp, true); }
    if (w.status !== "playing") return;
  }
  for (const ability of w.abilities) { tickAbility(w, ability, dt); if (w.status !== "playing" || w.betweenWaves) return; }
  scheduleSite(w); updateKnight(w, dt);
  for (const a of alive(w)) {
    if (w.status !== "playing" || w.betweenWaves) break;
    a.bite = Math.max(0, a.bite - dt);
    if (a.locked || a.bite > 0 || w.knight.hp <= 0 || distance(a, w.knight) > RULES.biteRange) continue;
    a.bite = RULES.biteInterval * (a.feasting ? RULES.feastIntervalScale : 1);
    a.facing = Math.atan2(w.knight.x - a.x, w.knight.z - a.z);
    if (a.feasting) a.hp = Math.min(a.maxHp, a.hp + RULES.feastHealing);
    emit(w, { type: "bite", x: a.x, z: a.z }); damageKnight(w, biteDamage(w));
  }
  if (w.status === "playing" && !w.betweenWaves) recruit(w, dt);
}
export function describeEncounter(w: Encounter) {
  const living = alive(w), temporary = living.filter(a => a.kind === "temporary");
  return {
    status: w.status, mode: w.normal ? "Normal" : "Newbie", paused: w.paused, elapsed: w.elapsed, levelElapsed: w.levelElapsed,
    wave: w.wave, betweenWaves: w.betweenWaves, awaitingReward: w.awaitingReward, rewards: [...w.offeredRewards], waveTimeLeft: w.waveTimeLeft,
    totalWaves: CAMPAIGN.length, location: locationForWave(w.wave), passives: [...w.passives],
    route: CAMPAIGN.map((location, index) => ({ id: location.id, name: location.name, shortName: location.shortName, state: index + 1 < w.wave || (index + 1 === w.wave && w.knight.hp <= 0) ? 'conquered' : index + 1 === w.wave ? 'current' : 'ahead' })),
    alive: living.length, permanent: living.length - temporary.length, temporary: temporary.length,
    nextExpiration: temporary.length ? Math.min(...temporary.map(a => a.lifetime)) : null,
    casualties: w.casualties, recruited: w.recruited, expired: w.expiredCount, center: centerOf(living), knight: structuredClone(w.knight),
    sprint: { unlocked: w.sprintUnlocked, remaining: w.sprintRemaining, cooldown: w.sprintCooldown }, abilities: structuredClone(w.abilities),
    site: w.activeSite === null ? null : { ...SITES[w.activeSite]!, stock: recruitmentStock(w), progress: w.siteProgress / RULES.summonTime },
    siteTimeLeft: Math.max(0, w.nextSiteAt - w.elapsed),
    zombies: living.map(a => ({ id: a.id, x: a.x, z: a.z, hp: a.hp, kind: a.kind, locked: a.locked, lifetime: a.lifetime })),
    bounds: { halfWidth: RULES.halfWidth, halfDepth: RULES.halfDepth },
  };
}
