import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { simulation as game, HordeInput } from './load-source.mjs';
const { RULES, SITES, createEncounter, stepEncounter, setPaused, describeEncounter, beginAttack, updateKnight, damageKnight, damageZombie, addZombies, resolveReward, grantPerk, activateAbility, updateAim, fireSling, tickAbility, advanceBolt, sprint, alive } = game;
const advance = (w, seconds, x = 0, z = 0) => { for (let i = 0; i < Math.round(seconds * 60); i++) stepEncounter(w, 1 / 60, x, z); };
const isolated = () => { const w = createEncounter(); w.status = 'playing'; w.knight.state = 'recovery'; w.knight.timer = -10000; w.knight.x = 28; w.knight.z = -20; return w; };
const crowd = (points, normal = false) => {
  const w = createEncounter(normal); w.status = 'playing'; w.zombies = w.zombies.slice(0, points.length);
  points.forEach((p, i) => Object.assign(w.zombies[i], { x: p[0], z: p[1], bite: 1000 }));
  Object.assign(w.knight, { x: 0, z: 0 }); return w;
};
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('input shares keyboard/touch/agent intents, processes UI releases, cancels focus and detaches', () => {
  const surface = () => { const handlers = new Map(); return { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name, fn) => { if (handlers.get(name) === fn) handlers.delete(name); }, send: (name, e = {}) => handlers.get(name)?.(e), count: () => handlers.size }; };
  const oldWindow = globalThis.window, oldDocument = globalThis.document, window = surface(), document = surface();
  globalThis.window = window; globalThis.document = document;
  try {
    let pauses = 0, restarts = 0, blurs = 0, sprints = 0, slot = -1;
    const input = new HordeInput(() => pauses++, () => restarts++); input.onBlur = () => blurs++; input.onSprint = () => sprints++; input.onAbility = value => slot = value; input.attach();
    const key = (code, repeat = false, editing = false) => ({ code, repeat, target: { closest: selector => editing && selector.includes('input') ? {} : null }, preventDefault() {} });
    window.send('keydown', key('KeyW')); assert.deepEqual(input.direction(), { x: 0, z: -1 });
    window.send('keydown', key('KeyD')); near(Math.hypot(...Object.values(input.direction())), 1);
    window.send('keyup', key('KeyW', false, true)); window.send('keyup', key('KeyD')); assert.deepEqual(input.direction(), { x: 0, z: 0 });
    input.holdTouch(1, 'right'); assert.equal(input.direction().x, 1); input.releaseTouch(1);
    input.holdAgent(-1, 0, 100); assert.equal(input.direction().x, -1); input.clear();
    window.send('keydown', key('Escape')); window.send('keydown', key('Escape', true)); assert.equal(pauses, 1);
    window.send('keydown', { ...key('Unidentified'), key: 'Escape' }); assert.equal(pauses, 2);
    window.send('keydown', key('KeyR')); assert.equal(restarts, 1); window.send('keydown', key('Space')); assert.equal(sprints, 1);
    window.send('keydown', key('KeyE')); assert.equal(slot, 1);
    window.send('keydown', key('KeyW', false, true)); assert.equal(input.direction().z, 0);
    input.holdTouch(2, 'up'); window.send('blur'); assert.equal(blurs, 1); assert.equal(input.direction().z, 0);
    input.enabled = () => false; window.send('keydown', key('KeyW')); assert.equal(input.direction().z, 0);
    input.detach(); assert.equal(window.count() + document.count(), 0);
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});

test('source defaults: arena, golden-angle spawn, health and first command gate', () => {
  const w = createEncounter(); assert.equal(w.knight.hp, 800); assert.equal(w.zombies.length, 40); assert.deepEqual(describeEncounter(w).bounds, { halfWidth: 30, halfDepth: 22 });
  near(w.zombies[0].x, -8); near(w.zombies[0].z, 3); near(w.zombies[1].x, -8 + Math.cos(2.399963) * 0.8);
  const ready = structuredClone(w); advance(w, 10); assert.deepEqual(w, ready);
  stepEncounter(w, 1 / 60, 1, 0); assert.equal(w.status, 'playing'); assert.equal(w.activeSite, 0); near(w.elapsed, 1 / 60);
  setPaused(w, true); const paused = structuredClone(w); advance(w, 10, -1, 1); assert.deepEqual(w, paused);
});

const movementFixture = JSON.parse(await readFile(new URL('./godot-movement.json', import.meta.url), 'utf8'));
test('Godot movement fixture agrees within floating point tolerance', () => {
  const w = isolated(); w.knight.hp = 0;
  for (let i = 0; i < 60; i++) game.moveHorde(w, {x: Math.SQRT1_2, z: -Math.SQRT1_2}, 1 / 60);
  w.zombies.forEach((a, i) => { near(a.x, movementFixture.diagonal_one_second[i][0], 0.00001); near(a.z, movementFixture.diagonal_one_second[i][1], 0.00001); });
});

test('movement is bounded in every corner, and releasing movement preserves positions', () => {
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const w = isolated(); w.knight.hp = 0; for (let i = 0; i < 1800; i++) game.moveHorde(w, {x: x * Math.SQRT1_2, z: z * Math.SQRT1_2}, 1 / 60);
    for (const a of alive(w)) { assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z)); assert.ok(Math.abs(a.x) <= 29.72 + 1e-6); assert.ok(Math.abs(a.z) <= 21.72 + 1e-6); }
    const positions = w.zombies.map(a => [a.x, a.z]); advance(w, 1); assert.deepEqual(w.zombies.map(a => [a.x, a.z]), positions);
    let nearest = Infinity; for (const a of alive(w)) for (const b of alive(w)) if (a !== b) nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.z - b.z));
    const reference = movementFixture.corners.find(p => p.x === x && p.z === z);
    near(nearest, reference.nearest, 0.0002);
  }
});

test('sweep locks its sector and strikes once; Normal kills while Newbie wounds', () => {
  for (const normal of [false, true]) {
    const w = crowd([[0, 1.8], [0, -1.8]], normal); beginAttack(w, 'sweep', { x: 0, z: 1.8 });
    for (let i = 0; i < 77; i++) updateKnight(w, 1 / 60); assert.equal(w.zombies[0].hp, 30);
    updateKnight(w, 1 / 30); assert.equal(w.zombies[0].hp, normal ? 0 : 15); assert.equal(w.zombies[1].hp, 30);
    for (let i = 0; i < 40; i++) updateKnight(w, 1 / 60); assert.equal(w.zombies[0].hp, normal ? 0 : 15);
  }
});

test('charge swept geometry cannot tunnel, repeat-hit or damage past the shown lane', () => {
  const w = crowd([[0, 3], [0.9, 5], [1.1, 3], [0, -0.2], [0, 8.1]]);
  beginAttack(w, 'charge', { x: 0, z: 8 }); near(w.knight.chargeEnd.z, 8);
  updateKnight(w, 1.5); updateKnight(w, 0.7);
  assert.deepEqual(w.zombies.map(a => a.hp), [10, 10, 30, 30, 30]);
  updateKnight(w, 0.1); assert.equal(w.zombies[0].hp, 10);
});

test('phase pattern changes, crossbow and mounted rush have source priority and cooldowns', () => {
  const w = crowd([[0, 5], [4, 4]]); updateKnight(w, 1 / 60); assert.equal(w.knight.attack, 'charge');
  w.knight.state = 'hunt'; w.wave = 2; w.knight.crossbowCooldown = 0; updateKnight(w, 1 / 60); assert.equal(w.knight.attack, 'crossbow'); near(w.knight.crossbowCooldown, 6);
  w.knight.state = 'hunt'; w.wave = 3; w.knight.crossbowCooldown = 0; w.knight.rushCooldown = 0; updateKnight(w, 1 / 60); assert.equal(w.knight.attack, 'rush'); near(w.knight.rushCooldown, 14);
  damageKnight(w, 535); assert.equal(w.knight.phase, 3);
});

test('spin hits a circle once; a mounted rush accelerates, steers and stops at the floor boundary', () => {
  const spin = crowd([[0, -3], [3.3, 0], [0, 1.8]]); beginAttack(spin, 'spin', spin.zombies[0]); updateKnight(spin, 1.8); assert.deepEqual(spin.zombies.map(a => a.hp), [10, 30, 10]);
  const w = crowd([[8, 10], [9, 11]]); w.wave = 3; beginAttack(w, 'rush', { x: 0, z: 15 }); updateKnight(w, 1.4); updateKnight(w, 0.5);
  near(w.knight.rushSpeed, 8); assert.ok(w.knight.x > 0); assert.ok(w.knight.direction.x > 0); assert.equal(w.knight.state, 'strike');
  w.knight.x = 29.2; w.knight.z = 0; w.knight.direction = { x: 1, z: 0 }; updateKnight(w, 0.1); assert.equal(w.knight.state, 'recovery'); assert.ok(w.knight.x <= 29.25);
});

test('crossbow kills high-HP targets front-to-back and stops on final permanent loss', () => {
  const w = crowd([[0, 5], [0, 1], [0, 3], [0, -0.2], [0.5, 2]]);
  w.zombies[0].kind = 'temporary'; w.zombies[0].hp = 300; w.zombies[2].kind = 'temporary'; w.zombies[3].kind = 'temporary'; w.zombies[4].kind = 'temporary';
  Object.assign(w.knight.bolt, { x: 0, z: 0, flying: true, remaining: 16, direction: { x: 0, z: 1 } }); advanceBolt(w, 1);
  assert.equal(w.status, 'lost'); assert.deepEqual(w.zombies.map(a => a.hp), [300, 0, 30, 0, 30]); near(w.knight.bolt.z, 0.6);
});

test('temporary lifetime expires before sling landing and counts separately from kills', () => {
  const w = isolated(); addZombies(w, 1, { x: 0, z: 0 }); grantPerk(w, 'sling'); const ammo = alive(w).find(a => a.kind === 'temporary'); ammo.lifetime = 0.1;
  assert.ok(activateAbility(w)); updateAim(w, { x: 0, z: 0 }); assert.ok(fireSling(w));
  w.knight.x = w.abilities[0].landing.x; w.knight.z = w.abilities[0].landing.z;
  advance(w, 1); assert.equal(w.expiredCount, 1); assert.equal(w.casualties, 0); assert.equal(w.abilities[0].projectile, null); assert.equal(w.knight.hp, 800);
});

test('recruitment holds continuously, discards excess stock, closes, and never repeats sites', () => {
  const w = isolated(); w.activeSite = 0; w.lastSite = 0; w.nextSiteAt = 30;
  Object.assign(w.zombies[0], SITES[0]); advance(w, 1); near(w.siteProgress, 1);
  w.zombies[0].x += 4; stepEncounter(w, 1 / 60); assert.equal(w.siteProgress, 0);
  addZombies(w, 18, { x: 0, z: 0 }); Object.assign(w.zombies[0], SITES[0]); advance(w, 2.1);
  assert.equal(alive(w).length, 60); assert.equal(w.recruited, 20); assert.equal(w.activeSite, null); near(w.nextSiteAt - w.elapsed, 5, 0.1);
  advance(w, 5.1); assert.notEqual(w.activeSite, 0);
});

test('five recruitment craters retain West first, rotate without repeats and recruit at both new sites', () => {
  assert.equal(SITES.length, 5);
  assert.deepEqual(SITES.slice(0, 3), [{ name: 'West', x: -14, z: -8 }, { name: 'South', x: -10, z: 10 }, { name: 'East', x: 14, z: 8 }]);
  const scheduled = isolated(); stepEncounter(scheduled, 1 / 60); assert.equal(scheduled.activeSite, 0);
  const seen = new Set([scheduled.activeSite]);
  for (let i = 0; i < 80; i++) {
    const previous = scheduled.activeSite; scheduled.nextSiteAt = scheduled.elapsed;
    stepEncounter(scheduled, 1 / 60); assert.notEqual(scheduled.activeSite, previous); seen.add(scheduled.activeSite);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  for (const index of [3, 4]) {
    const site = SITES[index]; assert.ok(Math.abs(site.x) < RULES.halfWidth && Math.abs(site.z) < RULES.halfDepth);
    const w = isolated(); w.activeSite = index; w.lastSite = index; w.nextSiteAt = 30;
    Object.assign(w.zombies[0], site); advance(w, RULES.summonTime + 0.1);
    assert.equal(w.recruited, RULES.reserves); assert.equal(alive(w).filter(a => a.kind === 'temporary').length, RULES.reserves);
    assert.equal(w.activeSite, null); near(w.nextSiteAt - w.elapsed, RULES.siteRespawnDelay, 0.1);
  }
});

test('wave rewards resolve once; breaks freeze wounds, lifetimes, perks and clocks; final wave alone wins', () => {
  const w = isolated(); addZombies(w, 20, { x: -5, z: 0 }); w.zombies[0].hp = 12; grantPerk(w, 'feast'); w.abilities[0].cooldown = 7; w.sprintCooldown = 3;
  damageKnight(w, 800); assert.equal(w.status, 'playing'); assert.equal(w.awaitingReward, true); assert.equal(w.offeredRewards.length, 2); assert.ok(!w.offeredRewards.includes('feast'));
  const before = structuredClone(w); advance(w, 20, 1, 1); assert.deepEqual(w, before);
  assert.equal(resolveReward(w, -1), false); assert.equal(resolveReward(w, 'skip'), true); assert.equal(resolveReward(w, 'skip'), false); assert.equal(alive(w).length, 70); assert.equal(game.permanentCount(w), 50);
  advance(w, 4.1); assert.equal(w.wave, 2); assert.equal(w.knight.maxHp, 1000); assert.equal(w.zombies[0].hp, 12); near(w.abilities[0].cooldown, 6.9, 0.03); near(w.sprintCooldown, 2.9, 0.03);
  damageKnight(w, 1000); resolveReward(w, 'skip'); advance(w, 4.1); assert.equal(w.wave, 3); assert.equal(w.knight.maxHp, 1200);
  damageKnight(w, 1200); assert.equal(w.status, 'won'); const result = structuredClone(w); advance(w, 5); assert.deepEqual(w, result);
});

test('two Q/E perks coexist while sprint owns no slot; sprint gates start, cooldown and pause', () => {
  const w = createEncounter(); grantPerk(w, 'sprint'); assert.equal(sprint(w), false);
  stepEncounter(w, 1 / 60, 1, 0); grantPerk(w, 'mines'); grantPerk(w, 'feast'); assert.equal(grantPerk(w, 'sling'), false);
  assert.ok(sprint(w)); assert.equal(sprint(w), false); near(w.sprintRemaining, 1.4); near(w.sprintCooldown, 7);
  addZombies(w, 12, { x: 0, z: 0 });
  assert.ok(activateAbility(w, 0)); assert.ok(activateAbility(w, 1)); assert.equal(w.abilities[0].armed.length, 6); assert.ok(alive(w).every(a => a.feasting));
  setPaused(w, true); const state = structuredClone(w); advance(w, 10, 1, 0); assert.deepEqual(w, state);
});

test('mines require an available temporary recruit and rejecting activation changes nothing', () => {
  const w = isolated(); grantPerk(w, 'mines');
  for (const withLockedRecruits of [false, true]) {
    if (withLockedRecruits) { addZombies(w, 2, { x: 0, z: 0 }); for (const a of alive(w)) if (a.kind === 'temporary') a.locked = true; }
    const before = structuredClone(w); assert.equal(game.canActivate(w, w.abilities[0]), false); assert.equal(activateAbility(w), false);
    assert.deepEqual(w, before); assert.equal(w.abilities[0].fuse, 0); assert.equal(w.abilities[0].cooldown, 0);
  }
});

test('mines arm half the eligible recruits rounded down, with one recruit sufficient and permanent survivors untouched', () => {
  for (const [count, expected] of [[1, 1], [5, 2], [12, 6]]) {
    const w = isolated(); addZombies(w, count, { x: 0, z: 0 }); grantPerk(w, 'mines');
    const permanent = structuredClone(w.zombies.filter(a => a.kind === 'permanent'));
    assert.ok(game.canActivate(w, w.abilities[0])); assert.ok(activateAbility(w));
    const ability = w.abilities[0]; assert.equal(ability.armed.length, expected);
    assert.ok(ability.armed.every(id => { const a = w.zombies.find(a => a.id === id); return a.kind === 'temporary' && a.hp > 0 && a.locked && !a.moving; }));
    assert.deepEqual(w.zombies.filter(a => a.kind === 'permanent'), permanent);
    assert.equal(activateAbility(w), false); near(ability.fuse, RULES.fuseDuration); near(ability.cooldown, RULES.mineCooldown);
  }
  const w = isolated(); addZombies(w, 12, { x: 0, z: 0 }); grantPerk(w, 'mines');
  const recruits = alive(w).filter(a => a.kind === 'temporary'); recruits.slice(0, 4).forEach(a => a.locked = true); damageZombie(w, recruits[4], recruits[4].hp);
  const eligible = new Set(recruits.slice(5).map(a => a.id)); assert.ok(activateAbility(w));
  assert.equal(w.abilities[0].armed.length, 3); assert.ok(w.abilities[0].armed.every(id => eligible.has(id)));
});

test('temporary mines detonate once after the fuse, accumulating damage while permanent survivors remain safe', () => {
  const w = isolated(); Object.assign(w.knight, { x: 0, z: 0 }); addZombies(w, 4, { x: 0, z: 0 });
  for (const a of alive(w)) if (a.kind === 'temporary') Object.assign(a, { x: 0, z: 1 });
  grantPerk(w, 'mines'); const permanent = structuredClone(w.zombies.filter(a => a.kind === 'permanent')); assert.ok(activateAbility(w));
  const ability = w.abilities[0]; tickAbility(w, ability, RULES.fuseDuration - 0.01); assert.equal(w.casualties, 0); assert.equal(w.knight.hp, 800);
  tickAbility(w, ability, 0.02); assert.equal(w.casualties, 2); assert.equal(w.knight.hp, 800 - 2 * RULES.blastDamage); assert.deepEqual(ability.armed, []);
  assert.deepEqual(w.zombies.filter(a => a.kind === 'permanent'), permanent); near(ability.cooldown, RULES.mineCooldown - RULES.fuseDuration - 0.01);
  tickAbility(w, ability, 1); assert.equal(w.casualties, 2); assert.equal(w.knight.hp, 710);
});

test('armed temporary bombs stay still, cannot bite or serve as sling ammo, and do not repel moving horde members', () => {
  const w = crowd([[-0.3, 0], [0.3, 0]]); w.knight.hp = 0; addZombies(w, 1, { x: 0, z: 0 });
  const bomb = alive(w).find(a => a.kind === 'temporary'); Object.assign(bomb, { x: 0, z: 0 }); grantPerk(w, 'mines'); assert.ok(activateAbility(w));
  const unobstructed = structuredClone(w); unobstructed.zombies = unobstructed.zombies.filter(a => a.id !== bomb.id); unobstructed.abilities[0].armed = [];
  for (let i = 0; i < 60; i++) {
    game.moveHorde(w, { x: 0, z: 1 }, 1 / 60); game.moveHorde(unobstructed, { x: 0, z: 1 }, 1 / 60);
    assert.deepEqual(w.zombies.filter(a => a.id !== bomb.id), unobstructed.zombies);
  }
  assert.deepEqual([bomb.x, bomb.z], [0, 0]); assert.equal(bomb.moving, false); assert.equal(game.slingAmmo(w), null);
  grantPerk(w, 'sling'); assert.equal(activateAbility(w, 1), false);
  const biting = isolated(); Object.assign(biting.knight, { x: 0, z: 0 }); addZombies(biting, 1, { x: 0, z: 0 });
  Object.assign(alive(biting).find(a => a.kind === 'temporary'), { x: 0, z: 1, bite: 0 }); grantPerk(biting, 'mines'); activateAbility(biting); advance(biting, 0.5);
  assert.equal(biting.knight.hp, 800); assert.ok(!biting.events.some(event => event.type === 'bite'));
});

test('ordinary locked sling members retain separation while armed mine recruits are passable', () => {
  const w = crowd([[0, 0]]); w.knight.hp = 0; addZombies(w, 1, { x: 0, z: 0 });
  const locked = alive(w).find(a => a.kind === 'temporary'); Object.assign(locked, { x: 0.1, z: 0, locked: true });
  const absent = structuredClone(w); absent.zombies = absent.zombies.filter(a => a.id !== locked.id);
  game.moveHorde(w, { x: 1, z: 0 }, 1 / 60); game.moveHorde(absent, { x: 1, z: 0 }, 1 / 60);
  assert.notEqual(w.zombies[0].x, absent.zombies[0].x); assert.equal(locked.x, 0.1);
});

test('mine fuse and recruits freeze during pause and wave breaks; expiry cleans bombs before damage', () => {
  const w = isolated(); Object.assign(w.knight, { x: 0, z: 0 }); addZombies(w, 1, { x: 0, z: 1 });
  const bomb = alive(w).find(a => a.kind === 'temporary'); bomb.lifetime = 0.1; grantPerk(w, 'mines'); activateAbility(w);
  setPaused(w, true); const paused = structuredClone(w); advance(w, 10, 1, 0); assert.deepEqual(w, paused); setPaused(w, false);
  advance(w, 0.2); assert.equal(w.expiredCount, 1); assert.equal(w.casualties, 0); assert.deepEqual(w.abilities[0].armed, []); assert.equal(bomb.locked, false);
  advance(w, RULES.fuseDuration); assert.equal(w.knight.hp, 800); assert.ok(!w.events.some(event => event.type === 'blast'));
  const between = isolated(); addZombies(between, 1, { x: 0, z: 0 }); grantPerk(between, 'mines'); activateAbility(between); damageKnight(between, 800);
  const frozen = structuredClone(between); advance(between, 10, 1, 0); assert.deepEqual(between, frozen);
});

test('last permanent loss cancels armed temporary mines before any knight damage', () => {
  const w = crowd([[0, 1]]); addZombies(w, 1, { x: 0, z: 1 }); w.knight.hp = 20; grantPerk(w, 'mines'); activateAbility(w);
  const bomb = alive(w).find(a => a.kind === 'temporary'); damageZombie(w, w.zombies[0], w.zombies[0].hp); tickAbility(w, w.abilities[0], RULES.fuseDuration);
  assert.equal(w.status, 'lost'); assert.equal(w.knight.hp, 20); assert.equal(bomb.hp, 30); assert.equal(bomb.locked, false); assert.deepEqual(w.abilities[0].armed, []);
});

test('sling consumes only recruits, costs nothing to aim/cancel, validates full disk, and lands once', () => {
  const w = isolated(); grantPerk(w, 'sling'); assert.equal(activateAbility(w), false); addZombies(w, 1, { x: 0, z: 0 }); assert.ok(activateAbility(w));
  updateAim(w, { x: 29, z: 0 }); assert.equal(w.abilities[0].aimValid, false); assert.equal(fireSling(w), false);
  updateAim(w, { x: 22, z: 0 }); assert.equal(w.abilities[0].aimValid, false);
  activateAbility(w); assert.equal(w.abilities[0].cooldown, 0); assert.equal(w.casualties, 0);
  activateAbility(w); updateAim(w, { x: 3, z: 0 }); assert.ok(fireSling(w)); const a = w.abilities[0]; assert.ok(Math.hypot(a.landing.x - 3, a.landing.z) <= 2.5);
  Object.assign(w.knight, a.landing); tickAbility(w, a, 0.4); assert.ok(w.zombies.find(z => z.id === a.projectile).airborne > 3.49); assert.equal(w.knight.hp, 800);
  tickAbility(w, a, 0.4); assert.equal(w.casualties, 1); assert.equal(w.knight.hp, 700); assert.equal(a.projectile, null); tickAbility(w, a, 1); assert.equal(w.knight.hp, 700);
});

test('feast heals the biting zombie and halves its bite interval without healing others', () => {
  const w = isolated(); w.knight.x = 0; w.knight.z = 0;
  Object.assign(w.zombies[0], { x: 0, z: 1, hp: 10 }); w.zombies[1].hp = 10; grantPerk(w, 'feast'); activateAbility(w);
  stepEncounter(w, 1 / 60); assert.equal(w.zombies[0].hp, 12); near(w.zombies[0].bite, 0.4); assert.equal(w.zombies[1].hp, 10);
  advance(w, 5.1); assert.equal(w.zombies[0].feasting, false); assert.equal(w.abilities[0].feast, 0);
});

test('zero permanent survivors immediately loses even while recruits are alive; restart resets every system', () => {
  const w = isolated(); addZombies(w, 2, { x: 0, z: 0 }); for (const a of [...alive(w)]) if (a.kind === 'permanent') damageZombie(w, a, a.hp);
  assert.equal(w.status, 'lost'); assert.equal(alive(w).length, 2); assert.equal(w.knight.state, 'stopped');
  const fresh = createEncounter(true); assert.equal(fresh.normal, true); assert.equal(fresh.status, 'ready'); assert.equal(fresh.wave, 1); assert.equal(fresh.recruited + fresh.casualties + fresh.expiredCount, 0);
  assert.ok(fresh.zombies.every(a => a.hp === 30 && !a.locked)); assert.ok(fresh.abilities.every(a => a.upgrade === null)); assert.equal(fresh.sprintUnlocked, false);
});

test('a brief first command starts the battle even when released before a physics frame', () => {
  const w = createEncounter(); game.beginBattle(w); assert.equal(w.status, 'playing'); assert.equal(w.activeSite, 0);
  stepEncounter(w, 1 / 60); near(w.elapsed, 1 / 60);
});

test('ordinary movement and valid skip rewards can win all three waves', () => {
  const w = createEncounter(false, 231); stepEncounter(w, 1 / 60, 1, 0);
  for (let i = 0; i < 360 * 60 && w.status === 'playing'; i++) {
    if (w.awaitingReward) { assert.ok(resolveReward(w, 'skip')); continue; }
    const k = w.knight, c = describeEncounter(w).center; let x = k.x - c.x, z = k.z - c.z;
    const d = Math.hypot(x, z);
    if (k.state === 'windup') {
      if (k.attack === 'sweep' || k.attack === 'spin') { x = -x; z = -z; }
      else { const side = (c.x - k.origin.x) * k.direction.z - (c.z - k.origin.z) * k.direction.x; x = k.direction.z * (side >= 0 ? 1 : -1); z = -k.direction.x * (side >= 0 ? 1 : -1); }
    }
    if (k.state === 'strike' && k.attack === 'rush') { x = -k.direction.z; z = k.direction.x; }
    if (k.state === 'hunt' && d < 1) { x = 0; z = 0; }
    stepEncounter(w, 1 / 60, x, z);
  }
  assert.equal(w.status, 'won'); assert.equal(w.wave, 3); assert.ok(game.permanentCount(w) > 0); assert.equal(w.knight.hp, 0);
});
