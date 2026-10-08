// Planar, deterministic encounter rules. Rendering and all input sources use this one simulation.
export const RULES = {
  count: 40, zombieHealth: 30, knightHealth: 900,
  halfWidth: 15, halfDepth: 11, zombieRadius: 0.28, knightRadius: 0.55,
  speed: 3.6, knightSpeed: 1.5, biteRange: 1.35, biteDamage: 4, biteInterval: 0.8,
  attackRange: 2.6, attackDamage: 15, windup: 1.3, recovery: 1.4,
} as const;

export type Outcome = "ready" | "playing" | "won" | "lost";
export interface Zombie {
  id: number; x: number; z: number; hp: number; bite: number;
  facing: number; moving: boolean; flash: number; deadFor: number;
}
export interface Knight {
  x: number; z: number; hp: number; facing: number;
  phase: "hunt" | "windup" | "recovery"; timer: number; flash: number; moving: boolean;
}
export interface Encounter {
  status: Outcome; paused: boolean; elapsed: number; zombies: Zombie[]; knight: Knight;
}
const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function createEncounter(): Encounter {
  return {
    status: "ready", paused: false, elapsed: 0,
    zombies: Array.from({ length: RULES.count }, (_, id) => ({
      id, x: -7 + (id % 8) * 0.78, z: 1 + Math.floor(id / 8) * 0.78,
      hp: RULES.zombieHealth, bite: (id % 5) * 0.1,
      facing: Math.PI / 2, moving: false, flash: 0, deadFor: 0,
    })),
    knight: { x: 6, z: -2, hp: RULES.knightHealth, facing: -Math.PI / 2,
      phase: "hunt", timer: 0, flash: 0, moving: false },
  };
}

export function setPaused(world: Encounter, paused: boolean): void {
  if (world.status === "ready" || world.status === "playing") world.paused = paused;
}

function keepInArena(body: { x: number; z: number }, radius: number): void {
  body.x = clamp(body.x, RULES.halfWidth - radius);
  body.z = clamp(body.z, RULES.halfDepth - radius);
}

function excludeKnight(a: Zombie, knight: Knight): void {
  const d = distance(a, knight), minimum = RULES.zombieRadius + RULES.knightRadius;
  if (knight.hp > 0 && d < minimum) {
    const angle = d > 0.001 ? Math.atan2(a.x - knight.x, a.z - knight.z) : a.id * 2.4;
    a.x = knight.x + Math.sin(angle) * minimum;
    a.z = knight.z + Math.cos(angle) * minimum;
  }
  keepInArena(a, RULES.zombieRadius);
}

function moveHorde(living: Zombie[], knight: Knight, x: number, z: number, dt: number): void {
  const length = Math.hypot(x, z);
  const dx = length ? x / length : 0;
  const dz = length ? z / length : 0;
  const center = living.reduce((sum, a) => ({ x: sum.x + a.x / living.length, z: sum.z + a.z / living.length }), { x: 0, z: 0 });
  // Calculate from a snapshot so array order does not bias steering.
  const moves = living.map(a => {
    if (!length) return { a, x: a.x, z: a.z };
    let vx = dx * RULES.speed + (center.x - a.x) * 0.45;
    let vz = dz * RULES.speed + (center.z - a.z) * 0.45;
    for (const b of living) {
      if (a === b) continue;
      const d = distance(a, b);
      if (d > 0 && d < 0.85) {
        const force = (0.85 - d) * 7 / d;
        vx += (a.x - b.x) * force;
        vz += (a.z - b.z) * force;
      }
    }
    const scale = Math.min(1, RULES.speed / Math.hypot(vx, vz));
    return { a, x: a.x + vx * scale * dt, z: a.z + vz * scale * dt };
  });
  for (const next of moves) {
    const a = next.a;
    const oldX = a.x, oldZ = a.z;
    a.x = next.x; a.z = next.z;
    excludeKnight(a, knight);
    a.moving = Math.hypot(a.x - oldX, a.z - oldZ) > dt * 0.15;
    if (a.moving) a.facing = Math.atan2(a.x - oldX, a.z - oldZ);
  }
  // Body exclusion also at corners, where bounds clamps defeat steering alone.
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const a = living[i]!, b = living[j]!, d = distance(a, b);
      const minimum = RULES.zombieRadius * 2;
      if (d >= minimum) continue;
      const ux = d > 0.001 ? (a.x - b.x) / d : 1;
      const uz = d > 0.001 ? (a.z - b.z) / d : 0;
      const push = (minimum - d) / 2;
      a.x += ux * push; a.z += uz * push;
      b.x -= ux * push; b.z -= uz * push;
      keepInArena(a, RULES.zombieRadius); keepInArena(b, RULES.zombieRadius);
    }
    for (const a of living) excludeKnight(a, knight);
  }
}

export function stepEncounter(world: Encounter, dt: number, inputX = 0, inputZ = 0): void {
  if (world.paused || world.status === "won" || world.status === "lost") return;
  if (world.status === "ready") {
    if (!Math.hypot(inputX, inputZ)) return;
    world.status = "playing";
  }
  dt = Math.max(0, Math.min(dt, 1 / 30));
  if (!dt) return;
  world.elapsed += dt;
  const k = world.knight;
  const living = world.zombies.filter(a => a.hp > 0);
  for (const a of world.zombies) {
    a.flash = Math.max(0, a.flash - dt);
    if (a.hp <= 0) a.deadFor += dt;
    else a.bite = Math.max(0, a.bite - dt);
  }
  k.flash = Math.max(0, k.flash - dt);
  moveHorde(living, k, inputX, inputZ, dt);
  for (const a of living) {
    if (distance(a, k) <= RULES.biteRange && a.bite === 0) {
      k.hp = Math.max(0, k.hp - RULES.biteDamage);
      k.flash = 0.12; a.bite = RULES.biteInterval;
      a.facing = Math.atan2(k.x - a.x, k.z - a.z);
    }
  }
  if (k.hp === 0) { world.status = "won"; k.moving = false; return; }
  k.moving = false;
  if (k.phase === "hunt") {
    const nearest = living.reduce<Zombie | null>((best, a) => !best || distance(a, k) < distance(best, k) ? a : best, null);
    if (nearest) {
      const d = distance(nearest, k);
      k.facing = Math.atan2(nearest.x - k.x, nearest.z - k.z);
      if (d <= RULES.attackRange - 0.3) { k.phase = "windup"; k.timer = RULES.windup; }
      else {
        k.x += Math.sin(k.facing) * RULES.knightSpeed * dt;
        k.z += Math.cos(k.facing) * RULES.knightSpeed * dt;
        keepInArena(k, RULES.knightRadius); k.moving = true;
        for (const a of living) excludeKnight(a, k);
      }
    }
  } else {
    k.timer -= dt;
    if (k.timer <= 0 && k.phase === "windup") {
      for (const a of living) {
        const d = distance(a, k);
        const dot = ((a.x - k.x) * Math.sin(k.facing) + (a.z - k.z) * Math.cos(k.facing)) / Math.max(d, 0.001);
        if (d <= RULES.attackRange && dot >= Math.cos(80 * Math.PI / 180)) {
          a.hp = Math.max(0, a.hp - RULES.attackDamage); a.flash = 0.18;
        }
      }
      k.phase = "recovery"; k.timer = RULES.recovery;
    } else if (k.timer <= 0) k.phase = "hunt";
  }
  if (!world.zombies.some(a => a.hp > 0)) world.status = "lost";
}

export function describeEncounter(world: Encounter) {
  const living = world.zombies.filter(a => a.hp > 0);
  return {
    status: world.status, paused: world.paused, elapsed: world.elapsed,
    alive: living.length, casualties: RULES.count - living.length,
    center: living.reduce((sum, a) => ({ x: sum.x + a.x / living.length, z: sum.z + a.z / living.length }), { x: 0, z: 0 }),
    knight: { ...world.knight },
    zombies: world.zombies.map(a => ({ id: a.id, x: a.x, z: a.z, hp: a.hp })),
    bounds: { halfWidth: RULES.halfWidth, halfDepth: RULES.halfDepth },
  };
}
