import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulation as game, campaign, loadGame } from './load-source.mjs';

const { SPECIALS, shockwaveRadius } = await loadGame('knight-specials');
const { createEncounter, beginAttack, updateKnight, stepEncounter, setPaused, damageKnight, addZombies } = game;
const near = (a, b, epsilon = 0.00001) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const fixture = (points, normal = false) => {
  const world = createEncounter(normal); world.status = 'playing'; world.zombies = world.zombies.slice(0, points.length);
  points.forEach(([x, z], index) => Object.assign(world.zombies[index], { x, z, bite: 10000 }));
  Object.assign(world.knight, { x: 0, z: 0 }); return world;
};
const strike = (world, kind, target) => { beginAttack(world, kind, target); updateKnight(world, SPECIALS[kind].windup); assert.equal(world.knight.state, 'strike'); };

test('each defender chooses its own new signature when available and mounted models are restricted to road and castle', () => {
  for (let wave = 1; wave <= 5; wave++) {
    const world = fixture([[0, 2]]); world.wave = wave;
    Object.assign(world.knight, { specialCooldown: 0, crossbowCooldown: 0, rushCooldown: 0 });
    updateKnight(world, 1 / 60);
    const special = campaign.locationForWave(wave).special;
    assert.equal(world.knight.attack, special); assert.equal(world.knight.state, 'windup');
    near(world.knight.specialCooldown, SPECIALS[special].cooldown);
    assert.equal(game.mountedKnight(world), wave === 3 || wave === 5);
    const mounted = fixture([[0, 5]]); mounted.wave = wave; const before = structuredClone(mounted);
    beginAttack(mounted, 'rush', { x: 0, z: 5 });
    if (wave === 3 || wave === 5) assert.equal(mounted.knight.attack, 'rush'); else assert.deepEqual(mounted, before);
  }
});

test('every new attack waits for its full warning, locks its shown target and permits escape', () => {
  for (const kind of Object.keys(SPECIALS)) {
    const world = fixture([[0, 2], [20, 15]]); beginAttack(world, kind, { x: 0, z: 2 });
    const origin = structuredClone(world.knight.origin), target = structuredClone(world.knight.target), direction = structuredClone(world.knight.direction);
    assert.equal(world.events.at(-1).type, 'attack-warned');
    updateKnight(world, SPECIALS[kind].windup - 0.000001); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [30, 30]);
    Object.assign(world.zombies[0], { x: -20, z: -15 });
    assert.deepEqual(world.knight.origin, origin); assert.deepEqual(world.knight.target, target); assert.deepEqual(world.knight.direction, direction);
    updateKnight(world, 0.000002); updateKnight(world, SPECIALS[kind].strike);
    assert.deepEqual(world.zombies.map(zombie => zombie.hp), [30, 30], kind);
    assert.equal(world.knight.state, 'recovery');
  }
});

test('shield bash hits only its locked three-unit cone once and clamps surviving knockback to the arena', () => {
  const angle = degrees => [2 * Math.sin(degrees * Math.PI / 180), 2 * Math.cos(degrees * Math.PI / 180)];
  const world = fixture([[0, 3], angle(54.9), angle(55.1), [0, 3.001], [0, -1], [0, 0]]);
  strike(world, 'bash', { x: 0, z: 3 }); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [22, 22, 30, 30, 30, 22]);
  near(world.zombies[0].z, 5.5); near(world.zombies[5].z, 2.5);
  updateKnight(world, 0.2); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [22, 22, 30, 30, 30, 22]);
  const edge = fixture([[29.5, 0]]); edge.knight.x = 28;
  strike(edge, 'bash', { x: 29.5, z: 0 }); near(edge.zombies[0].x, 29.72); assert.equal(edge.zombies[0].hp, 22);
});

test('shield bash damages planted mines and launched sling recruits without relocating their locked origins', () => {
  for (const perk of ['mines', 'sling']) {
    const world = fixture([[0, 1], [15, 15]]); addZombies(world, 1, { x: 0, z: 1 });
    const recruit = world.zombies.at(-1); Object.assign(recruit, { x: 0, z: 1 }); game.grantPerk(world, perk); assert.ok(game.activateAbility(world));
    if (perk === 'sling') { game.updateAim(world, { x: 3, z: 1 }); assert.ok(game.fireSling(world)); }
    const launch = structuredClone(world.abilities[0].launch), initial = { x: recruit.x, z: recruit.z };
    strike(world, 'bash', { x: 0, z: 1 }); near(world.zombies[0].z, 3.5); assert.equal(world.zombies[0].hp, 22);
    assert.equal(recruit.hp, 22); assert.equal(recruit.locked, true); assert.deepEqual({ x: recruit.x, z: recruit.z }, initial);
    if (perk === 'sling') {
      assert.deepEqual(world.abilities[0].launch, launch); game.tickAbility(world, world.abilities[0], 0.1);
      assert.notDeepEqual({ x: recruit.x, z: recruit.z }, initial); assert.ok(recruit.airborne > 0);
    } else assert.ok(world.abilities[0].armed.includes(recruit.id));
  }
});

test('consecration strikes the locked target disk once, including its boundary, with no retargeting', () => {
  const world = fixture([[0, 6], [3, 6], [3.001, 6], [0, 0]]);
  beginAttack(world, 'consecration', { x: 0, z: 6 });
  updateKnight(world, 1); world.zombies[3].x = 8; world.zombies[3].z = 6;
  updateKnight(world, 0.8); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [12, 12, 30, 30]);
  updateKnight(world, 0.35); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [12, 12, 30, 30]);
  const edge = fixture([[29, 20]]); beginAttack(edge, 'consecration', { x: 100, z: 100 });
  assert.ok(Math.abs(edge.knight.target.x) <= 27); assert.ok(Math.abs(edge.knight.target.z) <= 19);
  assert.ok(Math.hypot(edge.knight.target.x, edge.knight.target.z) <= 16.000001);
});

test('lance thrust keeps the knight stationary and hits only the shown forward lane once', () => {
  const world = fixture([[0, 0.1], [0.75, 4], [0.751, 4], [0, -0.001], [0, 7.5], [0, 7.501]]);
  strike(world, 'lance', { x: 0, z: 7.5 }); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [8, 8, 30, 30, 8, 30]);
  near(world.knight.x, 0); near(world.knight.z, 0); updateKnight(world, 1);
  assert.deepEqual(world.zombies.map(zombie => zombie.hp), [8, 8, 30, 30, 8, 30]); near(world.knight.z, 0);
});

test('firebomb applies one landing hit, then six half-second fire ticks with long frames matching short frames', () => {
  const make = () => {
    const world = fixture([[0, 6], [2.7, 6], [2.701, 6], [15, 15]]);
    for (const zombie of world.zombies) { zombie.hp = 100; zombie.maxHp = 100; }
    strike(world, 'firebomb', { x: 0, z: 6 }); assert.deepEqual(world.zombies.map(zombie => zombie.hp), [92, 92, 100, 100]); return world;
  };
  const short = make(), long = make();
  updateKnight(short, 0.499); assert.deepEqual(short.zombies.map(zombie => zombie.hp), [92, 92, 100, 100]);
  updateKnight(short, 0.001); assert.deepEqual(short.zombies.map(zombie => zombie.hp), [88, 88, 100, 100]);
  for (let i = 0; i < 150; i++) updateKnight(short, 1 / 60);
  updateKnight(long, 3); assert.deepEqual(long.zombies.map(zombie => zombie.hp), [68, 68, 100, 100]);
  assert.deepEqual(short.zombies.map(zombie => zombie.hp), long.zombies.map(zombie => zombie.hp));
  assert.equal(long.knight.state, 'recovery'); updateKnight(long, 0.2); assert.deepEqual(long.zombies.map(zombie => zombie.hp), [68, 68, 100, 100]);
});

test('leaving fire prevents future ticks and entering after landing receives only later ticks', () => {
  const world = fixture([[0, 6], [10, 6], [15, 15]]); strike(world, 'firebomb', { x: 0, z: 6 });
  assert.equal(world.zombies[0].hp, 22); world.zombies[0].x = 10; world.zombies[1].x = 0;
  updateKnight(world, 0.5); assert.equal(world.zombies[0].hp, 22); assert.equal(world.zombies[1].hp, 26);
  world.zombies[1].x = 10; updateKnight(world, 2.5); assert.equal(world.zombies[1].hp, 26);
});

test('expanding shockwave sweeps the shown ring across long frames, hits once and leaves its passed center safe', () => {
  const make = () => fixture([[0, 0], [0, 1], [0, 4.5], [0, 9.2], [0, 9.28], [15, 15]]);
  const short = make(), long = make();
  for (const world of [short, long]) strike(world, 'shockwave', { x: 0, z: 4.5 });
  assert.equal(short.zombies[0].hp, 12); assert.equal(short.zombies[1].hp, 30);
  for (let i = 0; i < 108; i++) updateKnight(short, 1 / 60);
  updateKnight(long, 1.8); assert.deepEqual(long.zombies.map(zombie => zombie.hp), [12, 12, 12, 12, 30, 30]);
  assert.deepEqual(short.zombies.map(zombie => zombie.hp), long.zombies.map(zombie => zombie.hp));
  const safe = fixture([[0, 4], [15, 15]]); strike(safe, 'shockwave', { x: 0, z: 4 }); updateKnight(safe, 1);
  assert.equal(safe.zombies[0].hp, 12); safe.zombies[0].z = 6; safe.zombies[1].x = 0; safe.zombies[1].z = 0;
  updateKnight(safe, 0.8); assert.equal(safe.zombies[0].hp, 12); assert.equal(safe.zombies[1].hp, 30);
  near(shockwaveRadius(-1), 0); near(shockwaveRadius(0.9), 4.5); near(shockwaveRadius(99), 9);
});

test('special attacks freeze on pause and rewards, and terminal loss stops later damage in the same strike', () => {
  for (const kind of Object.keys(SPECIALS)) {
    const paused = fixture([[0, 2], [15, 15]]); beginAttack(paused, kind, { x: 0, z: 2 }); setPaused(paused, true);
    const before = structuredClone(paused); stepEncounter(paused, 20); updateKnight(paused, 20); assert.deepEqual(paused, before, kind);
    setPaused(paused, false); damageKnight(paused, paused.knight.hp); const reward = structuredClone(paused);
    stepEncounter(paused, 20); updateKnight(paused, 20); assert.deepEqual(paused, reward, kind);
    const terminal = fixture([[0, 0.1]]); terminal.zombies[0].hp = 1;
    addZombies(terminal, 1, { x: 0, z: 0.1 }); const recruit = terminal.zombies.at(-1); Object.assign(recruit, { x: 0, z: 0.1 });
    beginAttack(terminal, kind, { x: 0, z: 0.1 }); updateKnight(terminal, SPECIALS[kind].windup);
    assert.equal(terminal.status, 'lost', kind); assert.equal(recruit.hp, 30, kind); assert.equal(terminal.knight.state, 'stopped');
    const result = structuredClone(terminal); updateKnight(terminal, 20); stepEncounter(terminal, 20); assert.deepEqual(terminal, result);
  }
});

test('Normal mode new attacks kill high-health targets rather than merely applying Newbie damage', () => {
  for (const kind of Object.keys(SPECIALS)) {
    const world = fixture([[0, 0.1], [15, 15]], true); world.zombies[0].hp = 300; world.zombies[0].maxHp = 300;
    strike(world, kind, { x: 0, z: 0.1 }); assert.equal(world.zombies[0].hp, 0, kind); assert.equal(world.status, 'playing');
  }
});
