import { RULES } from "./rules";
import { add, distance, length, limited, normalized, scale, subtract } from "./math";
import { alive, centerOf, clampBody, emit } from "./world";
import type { Encounter, Point } from "./types";

export function sprint(world: Encounter): boolean {
  if (!world.sprintUnlocked || world.paused || world.betweenWaves || world.status !== "playing" || world.sprintCooldown > 0) return false;
  world.sprintRemaining = RULES.sprintDuration; world.sprintCooldown = RULES.sprintCooldown;
  emit(world, { type: "sprint" }); return true;
}
export function moveHorde(world: Encounter, direction: Point, dt: number) {
  const living = alive(world), center = centerOf(living.filter(a => !a.locked));
  world.sprintRemaining = Math.max(0, world.sprintRemaining - dt); world.sprintCooldown = Math.max(0, world.sprintCooldown - dt);
  const speed = RULES.speed * (world.sprintRemaining > 0 ? RULES.sprintMultiplier : 1), intent = limited(direction);
  let travelled = 0;
  for (const a of living) {
    if (a.locked) continue;
    if (length(intent) < 1e-6) { a.moving = false; a.speed = 0; continue; }
    const attraction = scale(limited(add(intent, scale(subtract(center, a), 1 / RULES.cohesionRadius))), speed);
    let separation = { x: 0, z: 0 };
    // Godot moves members in order; subsequent members see these updated positions.
    for (const b of living) {
      if (a === b) continue;
      let away = subtract(a, b), d = length(away); if (d >= RULES.separationRadius) continue;
      if (d < 0.001) { away = { x: a.id > b.id ? 1 : -1, z: 0 }; d = 0.001; }
      separation = add(separation, scale(normalized(away), (RULES.separationRadius - d) / Math.max(d * d, 0.01)));
    }
    const velocity = limited(add(attraction, scale(separation, RULES.separationStrength)), speed), next = add(a, scale(velocity, dt));
    const k = world.knight, minimum = RULES.zombieRadius + (world.wave >= 3 ? 0.75 : RULES.knightRadius);
    if (k.hp > 0 && distance(next, k) < minimum) {
      let away = subtract(next, k); if (length(away) < 1e-6) away = { x: 1, z: 0 };
      Object.assign(next, add(k, scale(normalized(away), minimum)));
    }
    clampBody(next, RULES.zombieRadius);
    travelled += distance(next, a);
    const actual = scale(subtract(next, a), 1 / dt); Object.assign(a, next);
    a.speed = length(actual); a.moving = a.speed > 0.15 * (a.moving ? 0.5 : 1);
    if (a.moving) a.facing = Math.atan2(actual.x, actual.z);
  }
  if (living.length) emit(world, { type: "horde-moved", amount: travelled / living.length });
}
