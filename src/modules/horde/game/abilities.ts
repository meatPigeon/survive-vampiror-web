import { RULES } from "./rules";
import { distance, lerp } from "./math";
import { alive, damageKnight, damageZombie, emit, random } from "./world";
import type { Ability, Encounter, Point, Zombie } from "./types";

const enabled = (w: Encounter) => w.status === "playing" && !w.paused && !w.betweenWaves;
export function slingAmmo(w: Encounter, target?: Point): Zombie | null {
  let nearest: Zombie | null = null, reach: number = RULES.slingRange;
  for (const a of alive(w)) {
    if (a.kind !== "temporary" || a.locked) continue;
    if (!target) return a;
    const d = distance(a, target) + RULES.slingSpread;
    if (d <= reach) { nearest = a; reach = d; }
  }
  return nearest;
}
export function canActivate(w: Encounter, a: Ability) {
  if (!enabled(w) || a.cooldown > 0) return false;
  switch (a.upgrade) {
    case "mines": return alive(w).length >= 2 && !a.armed.length;
    case "sling": return slingAmmo(w) !== null && a.projectile === null;
    case "feast": return alive(w).length > 0 && a.feast <= 0;
    default: return false;
  }
}
export function activateAbility(w: Encounter, slot = 0): boolean {
  const a = w.abilities[slot]; if (!a || !canActivate(w, a)) return false;
  switch (a.upgrade) {
    case "mines": {
      const living = alive(w), available = living.filter(z => !z.locked), n = Math.min(Math.floor(living.length / 2), available.length);
      for (let i = 0; i < n; i++) { const z = available[Math.floor(i * available.length / n)]!; z.locked = true; z.moving = false; a.armed.push(z.id); }
      a.fuse = RULES.fuseDuration; a.cooldown = RULES.mineCooldown;
      if (a.armed.length) emit(w, { type: "ability-activated", upgrade: "mines" }); break;
    }
    case "sling": a.aiming = !a.aiming; a.aimValid = false; break;
    case "feast":
      a.feast = RULES.feastDuration; a.cooldown = RULES.feastCooldown;
      for (const z of alive(w)) z.feasting = true;
      emit(w, { type: "ability-activated", upgrade: "feast" }); break;
  }
  return true;
}
export function updateAim(w: Encounter, p: Point, onGround = true) {
  if (!enabled(w)) return;
  for (const a of w.abilities) {
    if (!a.aiming) continue;
    a.aim = { ...p }; a.aimOnGround = onGround;
    // Godot Rect2 includes the lower edge, excludes the upper edge.
    a.aimValid = onGround && p.x >= -RULES.halfWidth + RULES.slingSpread && p.x < RULES.halfWidth - RULES.slingSpread && p.z >= -RULES.halfDepth + RULES.slingSpread && p.z < RULES.halfDepth - RULES.slingSpread && slingAmmo(w, p) !== null;
  }
}
export function fireSling(w: Encounter) {
  if (!enabled(w)) return false;
  let fired = false;
  for (const a of w.abilities) {
    if (!a.aiming || !a.aimValid || !canActivate(w, a)) continue;
    const ammo = slingAmmo(w, a.aim); if (!ammo) continue;
    a.projectile = ammo.id; ammo.locked = true; ammo.moving = false; a.launch = { x: ammo.x, z: ammo.z };
    const angle = random(w) * Math.PI * 2, radius = RULES.slingSpread * Math.sqrt(random(w));
    a.landing = { x: a.aim.x + Math.cos(angle) * radius, z: a.aim.z + Math.sin(angle) * radius };
    a.flightElapsed = 0; a.cooldown = RULES.slingCooldown; a.aiming = false; a.aimValid = false;
    emit(w, { type: "sling-landing", ...a.landing, radius: RULES.impactRadius });
    emit(w, { type: "ability-activated", upgrade: "sling" }); fired = true;
  }
  return fired;
}
function detonate(w: Encounter, a: Ability) {
  const batch = [...a.armed]; a.armed = []; let damage = 0, signaled = false;
  for (const id of batch) {
    const z = w.zombies.find(z => z.id === id); if (!z || z.hp <= 0) continue;
    if (!enabled(w)) break;
    if (!signaled) { emit(w, { type: "ability-impact", upgrade: "mines" }); signaled = true; }
    if (w.knight.hp > 0 && distance(z, w.knight) <= RULES.blastRadius) damage += RULES.blastDamage;
    emit(w, { type: "blast", x: z.x, z: z.z, radius: RULES.blastRadius }); damageZombie(w, z, z.hp);
  }
  // Sacrificing the last permanent zombie ends the run before knight damage.
  if (enabled(w) && damage > 0) damageKnight(w, damage);
}
export function tickAbility(w: Encounter, a: Ability, dt: number) {
  if (!enabled(w)) return;
  a.cooldown = Math.max(0, a.cooldown - dt);
  if (a.aiming && !slingAmmo(w)) { a.aiming = false; a.aimValid = false; }
  if (a.feast > 0) {
    a.feast = Math.max(0, a.feast - dt); for (const z of alive(w)) z.feasting = a.feast > 0;
    if (a.feast <= 0) emit(w, { type: "feast-ended" });
  }
  if (a.armed.length) { a.fuse = Math.max(0, a.fuse - dt); if (a.fuse <= 0) detonate(w, a); }
  if (!enabled(w) || a.projectile === null) return;
  const z = w.zombies.find(z => z.id === a.projectile);
  if (!z || z.hp <= 0) { a.projectile = null; return; }
  a.flightElapsed += dt; const t = Math.min(1, a.flightElapsed / RULES.flightDuration);
  Object.assign(z, lerp(a.launch, a.landing, t)); z.airborne = Math.sin(t * Math.PI) * RULES.flightHeight; z.flightSpin = t * Math.PI * 2;
  if (t >= 1) {
    a.projectile = null; z.locked = false; z.airborne = 0; z.flightSpin = 0;
    emit(w, { type: "ability-impact", upgrade: "sling" }); damageZombie(w, z, z.hp);
    emit(w, { type: "sling-impact", ...a.landing, radius: RULES.impactRadius });
    if (enabled(w) && w.knight.hp > 0 && distance(w.knight, a.landing) <= RULES.impactRadius) damageKnight(w, RULES.impactDamage);
  }
}
export function abilityText(w: Encounter, a: Ability, key: string) {
  const titles = { mines: "Mines", sling: "Sling", feast: "Feast" };
  if (!a.upgrade) return "";
  if (a.aiming) return "Sling · LMB fire · RMB cancel";
  if (a.armed.length) return `Detonating · ${a.fuse.toFixed(1)}s`;
  if (a.feast > 0) return `Feasting · ${a.feast.toFixed(1)}s`;
  if (a.cooldown > 0) return `${titles[a.upgrade]} · ${a.cooldown.toFixed(1)}s`;
  if (a.upgrade === "sling" && !slingAmmo(w)) return "Sling · need a recruit";
  if (a.upgrade === "mines" && alive(w).length < 2) return "Mines · need 2 zombies";
  return `${titles[a.upgrade]} · ${key}`;
}
