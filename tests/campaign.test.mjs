import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulation as game, campaign } from './load-source.mjs';

const { CAMPAIGN, locationForWave } = campaign;
const { RULES, createEncounter, addZombies, alive, grantPerk, hasPerk, damageKnight, resolveReward, startNextWave, stepEncounter, moveHorde, describeEncounter } = game;
const advance = (world, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) stepEncounter(world, 1 / 60); };
const isolated = () => { const world = createEncounter(); world.status = 'playing'; Object.assign(world.knight, { x: 28, z: -20, state: 'recovery', timer: -10000 }); for (const zombie of world.zombies) zombie.bite = 10000; return world; };
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
const PASSIVES = ['vigor', 'fangs', 'necromancy', 'haste', 'lasting'];

test('ordered campaign has five distinct places, defenders, scenery palettes and signature attacks', () => {
  assert.equal(RULES.waves, 5); assert.equal(CAMPAIGN.length, 5);
  assert.deepEqual(CAMPAIGN.map(location => location.id), ['graveyard', 'chapel', 'road', 'outskirts', 'castle']);
  assert.deepEqual(CAMPAIGN.map(location => location.special), ['bash', 'consecration', 'lance', 'firebomb', 'shockwave']);
  assert.deepEqual(CAMPAIGN.map(location => location.hp), [800, 1000, 1200, 1450, 1800]);
  for (const key of ['name', 'defender', 'subtitle', 'craterName']) assert.equal(new Set(CAMPAIGN.map(location => location[key])).size, 5, key);
  assert.equal(new Set(CAMPAIGN.map(location => JSON.stringify(location.palette))).size, 5);
  for (const [index, location] of CAMPAIGN.entries()) {
    assert.equal(locationForWave(index + 1), location); assert.ok([1, 2, 3].includes(location.knightModel));
    for (const color of Object.values(location.palette)) assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff);
  }
  assert.equal(locationForWave(0), CAMPAIGN[0]); assert.equal(locationForWave(99), CAMPAIGN.at(-1));
});

test('five passive perks do not consume Q/E slots, cannot stack twice and persist through location travel', () => {
  const world = isolated(); grantPerk(world, 'mines'); grantPerk(world, 'sling');
  for (const perk of PASSIVES) {
    assert.equal(grantPerk(world, perk), true, perk); assert.equal(hasPerk(world, perk), true, perk);
    const granted = structuredClone(world); assert.equal(grantPerk(world, perk), false, perk); assert.deepEqual(world, granted, perk);
  }
  assert.deepEqual(world.abilities.map(ability => ability.upgrade), ['mines', 'sling']);
  for (let wave = 1; wave < 5; wave++) {
    damageKnight(world, world.knight.hp); assert.ok(world.awaitingReward); assert.ok(resolveReward(world, 'skip'));
    assert.deepEqual(describeEncounter(world).route.map(step => step.state), Array.from({ length: 5 }, (_, index) => index < wave ? 'conquered' : 'ahead'));
    startNextWave(world); assert.equal(world.wave, wave + 1);
    assert.equal(describeEncounter(world).route[wave].state, 'current');
    for (const perk of PASSIVES) assert.ok(hasPerk(world, perk), `${perk} at wave ${world.wave}`);
  }
  damageKnight(world, world.knight.hp); assert.equal(world.status, 'won'); assert.ok(describeEncounter(world).route.every(step => step.state === 'conquered'));
  const fresh = createEncounter(); for (const perk of PASSIVES) assert.equal(hasPerk(fresh, perk), false);
  assert.deepEqual(fresh.passives, []); assert.ok(fresh.zombies.every(zombie => zombie.maxHp === 30));
});

test('vigor adds fifteen health to living members and future permanent and temporary spawns', () => {
  const world = isolated(); addZombies(world, 2, { x: 0, z: 0 });
  const temporary = alive(world).filter(zombie => zombie.kind === 'temporary');
  world.zombies[0].hp = 7; temporary[0].hp = 12; world.zombies[1].hp = 0;
  const dead = structuredClone(world.zombies[1]); assert.ok(grantPerk(world, 'vigor'));
  assert.equal(world.zombies[0].hp, 22); assert.equal(temporary[0].hp, 27);
  assert.ok(alive(world).every(zombie => zombie.maxHp === 45)); assert.deepEqual(world.zombies[1], dead);
  addZombies(world, 1, { x: 0, z: 0 }); addZombies(world, 1, { x: 0, z: 0 }, false);
  assert.ok(world.zombies.slice(-2).every(zombie => zombie.hp === 45 && zombie.maxHp === 45));
});

test('fangs raises each successful bite by two without changing the bite interval', () => {
  for (const [perk, damage] of [[false, 4], [true, 6]]) {
    const world = isolated(); world.zombies = world.zombies.slice(0, 1);
    Object.assign(world.zombies[0], { x: 0, z: 1, bite: 0 }); Object.assign(world.knight, { x: 0, z: 0 });
    if (perk) assert.ok(grantPerk(world, 'fangs'));
    stepEncounter(world, 1 / 60); assert.equal(world.knight.hp, 800 - damage); near(world.zombies[0].bite, RULES.biteInterval);
    stepEncounter(world, 1 / 60); assert.equal(world.knight.hp, 800 - damage);
  }
});

test('necromancy grants four more recruits from an active crater and reports the actual stock', () => {
  const world = isolated(); assert.ok(grantPerk(world, 'necromancy')); game.beginBattle(world);
  world.activeSite = 0; world.lastSite = 0; world.nextSiteAt = 30;
  Object.assign(world.zombies[0], game.SITES[0]);
  assert.equal(describeEncounter(world).site.stock, 16);
  advance(world, RULES.summonTime + 0.1);
  assert.equal(alive(world).filter(zombie => zombie.kind === 'temporary').length, 16);
  assert.equal(world.recruited, 16); assert.equal(world.activeSite, null);
});

test('haste increases ordinary movement by fifteen percent and combines with sprint', () => {
  for (const sprinting of [false, true]) {
    const slow = isolated(), fast = isolated();
    for (const world of [slow, fast]) {
      world.zombies = world.zombies.slice(0, 1); Object.assign(world.zombies[0], { x: 0, z: 0 });
      if (sprinting) { grantPerk(world, 'sprint'); assert.ok(game.sprint(world)); }
    }
    assert.ok(grantPerk(fast, 'haste'));
    for (let i = 0; i < 60; i++) { moveHorde(slow, { x: 1, z: 0 }, 1 / 60); moveHorde(fast, { x: 1, z: 0 }, 1 / 60); }
    near(fast.zombies[0].x, slow.zombies[0].x * 1.15); near(fast.zombies[0].speed, slow.zombies[0].speed * 1.15);
    near(slow.zombies[0].x, RULES.speed * (sprinting ? RULES.sprintMultiplier : 1));
  }
});

test('lasting extends current and future temporary recruits by twenty seconds and leaves permanent members unchanged', () => {
  const world = isolated(); addZombies(world, 2, { x: 0, z: 0 });
  const recruits = alive(world).filter(zombie => zombie.kind === 'temporary'); recruits[0].lifetime = 2.5; recruits[1].hp = 0;
  const dead = structuredClone(recruits[1]), permanent = structuredClone(world.zombies.filter(zombie => zombie.kind === 'permanent'));
  assert.ok(grantPerk(world, 'lasting')); near(recruits[0].lifetime, 22.5);
  assert.deepEqual(recruits[1], dead); assert.deepEqual(world.zombies.filter(zombie => zombie.kind === 'permanent'), permanent);
  addZombies(world, 1, { x: 0, z: 0 }); near(world.zombies.at(-1).lifetime, RULES.lifetime + 20);
  advance(world, 22.6); assert.equal(recruits[0].hp, 0); assert.equal(world.expiredCount, 1); assert.ok(world.zombies.at(-1).hp > 0);
});

test('reward offers exclude owned perks and unusable third active slots, while passives remain selectable', () => {
  for (let seed = 1; seed <= 64; seed++) {
    const world = createEncounter(false, seed); world.status = 'playing';
    for (const perk of ['mines', 'feast', 'sprint']) assert.ok(grantPerk(world, perk));
    damageKnight(world, 800); assert.equal(world.offeredRewards.length, 2);
    assert.ok(world.offeredRewards.every(perk => PASSIVES.includes(perk)), `${seed}: ${world.offeredRewards}`);
    assert.ok(resolveReward(world, 0)); assert.ok(hasPerk(world, world.passives[0]));
  }
  const complete = isolated(); for (const perk of ['mines', 'feast', 'sprint', ...PASSIVES]) assert.ok(grantPerk(complete, perk));
  damageKnight(complete, 800); assert.deepEqual(complete.offeredRewards, []);
  assert.equal(resolveReward(complete, 0), false); assert.ok(resolveReward(complete, 'skip')); assert.equal(complete.awaitingReward, false);
});
