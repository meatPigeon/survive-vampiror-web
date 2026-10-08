import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute the exact source simulation without introducing a browser/test dependency.
const source = await readFile(new URL('../src/modules/horde/game/simulation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { RULES, createEncounter, stepEncounter, setPaused, describeEncounter } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const advance = (world, seconds, x = 0, z = 0) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepEncounter(world, 1 / 60, x, z);
};
const positions = world => world.zombies.map(a => [a.x, a.z]);
const isolated = () => {
  const world = createEncounter();
  world.knight.phase = 'recovery'; world.knight.timer = 10000;
  world.knight.x = 14; world.knight.z = -10;
  return world;
};

test('keyboard, touch and agent movement share input; Escape/restart and focus cleanup work', async () => {
  const code = await readFile(new URL('../src/modules/horde/game/input.ts', import.meta.url), 'utf8');
  const compiledInput = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const { HordeInput } = await import(`data:text/javascript;base64,${Buffer.from(compiledInput).toString('base64')}`);
  const surface = () => {
    const handlers = new Map();
    return {
      addEventListener(name, listener) { handlers.set(name, listener); },
      removeEventListener(name, listener) { if (handlers.get(name) === listener) handlers.delete(name); },
      send(name, event = {}) { handlers.get(name)?.(event); },
      count: () => handlers.size,
    };
  };
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const window = surface(), document = surface();
  globalThis.window = window; globalThis.document = document;
  try {
    let pauses = 0, restarts = 0, blurs = 0;
    const input = new HordeInput(() => pauses++, () => restarts++);
    input.onBlur = () => blurs++; input.attach();
    const key = (code, repeat = false, editing = false) => ({ code, repeat, target: { closest: () => editing ? {} : null }, preventDefault() {} });
    window.send('keydown', key('KeyW')); assert.deepEqual(input.direction(), { x: 0, z: -1 });
    window.send('keydown', key('KeyS')); assert.deepEqual(input.direction(), { x: 0, z: 0 });
    window.send('keyup', key('KeyW')); window.send('keyup', key('KeyS'));
    input.holdTouch(1, 'right'); assert.deepEqual(input.direction(), { x: 1, z: 0 }); input.releaseTouch(1);
    input.holdAgent(-1, 0, 100); assert.deepEqual(input.direction(), { x: -1, z: 0 }); input.clear();
    window.send('keydown', key('Escape')); window.send('keydown', key('Escape', true)); assert.equal(pauses, 1);
    window.send('keydown', key('KeyR')); assert.equal(restarts, 1);
    window.send('keydown', key('KeyW', false, true)); assert.deepEqual(input.direction(), { x: 0, z: 0 });
    input.holdTouch(2, 'up'); window.send('blur'); assert.equal(blurs, 1); assert.deepEqual(input.direction(), { x: 0, z: 0 });
    input.detach(); assert.equal(window.count() + document.count(), 0);
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  }
});

test('the ready arena waits for movement; pause freezes all encounter state', () => {
  const world = createEncounter();
  const ready = structuredClone(world);
  advance(world, 10); assert.deepEqual(world, ready);
  advance(world, 1, 1, 0); assert.equal(world.status, 'playing');
  setPaused(world, true); const paused = structuredClone(world);
  advance(world, 10, -1, 1); assert.deepEqual(world, paused);
  setPaused(world, false); advance(world, 1, -1, 0); assert.ok(world.elapsed > paused.elapsed);
});

test('shared direction moves all zombies, diagonals are bounded, release stops movement', () => {
  const world = isolated(); const start = describeEncounter(world).center;
  advance(world, 1, 1, -1);
  const center = describeEncounter(world).center;
  const travelled = Math.hypot(center.x - start.x, center.z - start.z);
  assert.ok(travelled > 2.8 && travelled <= RULES.speed + 0.01);
  assert.ok(world.zombies.every(a => a.x > -7 + (a.id % 8) * 0.78));
  const stopped = positions(world); advance(world, 1); assert.deepEqual(positions(world), stopped);
});

test('every arena corner contains the entire horde without severe overlap', () => {
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const world = isolated(); world.knight.x = -x * 14; world.knight.z = -z * 10;
    advance(world, 20, x, z);
    for (const a of world.zombies) {
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
      assert.ok(Math.abs(a.x) <= RULES.halfWidth - RULES.zombieRadius + 1e-6);
      assert.ok(Math.abs(a.z) <= RULES.halfDepth - RULES.zombieRadius + 1e-6);
    }
    let minimum = Infinity;
    for (const a of world.zombies) for (const b of world.zombies) {
      if (a.id !== b.id) minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.z - b.z));
    }
    assert.ok(minimum > 0.45, `Corner ${x},${z}: nearest pair ${minimum}`);
  }
});

test('the knight locks the warned sweep, damages once, and misses the rear', () => {
  const world = createEncounter(); world.status = 'playing';
  world.zombies = world.zombies.slice(0, 2);
  Object.assign(world.zombies[0], { x: 0, z: 1.8, bite: 100 });
  Object.assign(world.zombies[1], { x: 0, z: -1.8, bite: 100 });
  Object.assign(world.knight, { x: 0, z: 0, facing: 0, phase: 'windup', timer: RULES.windup });
  advance(world, 1.2); assert.equal(world.zombies[0].hp, 30);
  advance(world, 0.2); assert.equal(world.zombies[0].hp, 15); assert.equal(world.zombies[1].hp, 30);
  assert.equal(world.knight.phase, 'recovery');
  advance(world, 1); assert.equal(world.zombies[0].hp, 15);
});

function play(strategy) {
  const world = createEncounter(); stepEncounter(world, 1 / 60, 1, 0);
  for (let i = 0; i < 120 * 60 && world.status === 'playing'; i++) {
    const center = describeEncounter(world).center, knight = world.knight;
    let x = 0, z = 0;
    if (strategy !== 'idle') {
      x = knight.x - center.x; z = knight.z - center.z;
      if (strategy === 'dodge' && knight.phase === 'windup') { x = -x; z = -z; }
    }
    stepEncounter(world, 1 / 60, x, z);
  }
  return world;
}

test('a horde that retreats on windup wins through ordinary movement and automatic bites', () => {
  const world = play('dodge'); assert.equal(world.status, 'won'); assert.equal(world.knight.hp, 0);
  assert.ok(world.zombies.some(a => a.hp > 0));
  const result = structuredClone(world); advance(world, 5, 1, 1); assert.deepEqual(world, result);
});

test('rushing into sweeps causes casualties; an unattended horde loses', () => {
  const rush = play('rush'); assert.ok(rush.zombies.some(a => a.hp === 0));
  assert.ok(['won', 'lost'].includes(rush.status));
  const world = play('idle'); assert.equal(world.status, 'lost');
  assert.ok(world.zombies.every(a => a.hp === 0)); assert.ok(world.knight.hp > 0);
  const result = structuredClone(world); advance(world, 5); assert.deepEqual(world, result);
});

test('a new encounter resets health, dead units, timers and outcome', () => {
  const finished = play('idle'); assert.equal(finished.status, 'lost');
  const fresh = createEncounter(); assert.equal(fresh.status, 'ready');
  assert.equal(fresh.elapsed, 0); assert.equal(fresh.paused, false); assert.equal(fresh.knight.hp, RULES.knightHealth);
  assert.equal(fresh.zombies.length, RULES.count); assert.ok(fresh.zombies.every(a => a.hp === 30 && a.deadFor === 0));
});
