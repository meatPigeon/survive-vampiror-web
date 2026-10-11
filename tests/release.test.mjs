import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulation as game, loadGame, HordeInput } from './load-source.mjs';
const { captureCheckpoint, readCheckpoint } = await loadGame('checkpoint');
const { freshProfile, readProfile, finishRecord } = await loadGame('player-profile');
const { HordeSaveStore, PROFILE_KEY } = await loadGame('save-store');
const { boundedDestination, destinationDirection } = await loadGame('navigation');
const runId = 'test-run-1';
const advance = (world, seconds, x = 0, z = 0) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.stepEncounter(world, 1 / 60, x, z); };

test('checkpoint restores full deterministic combat, pauses time and does not share live arrays', () => {
  const world = game.createEncounter(false, 0xffffffff); game.beginBattle(world); game.addZombies(world, 8, {x: -8,z: 3});
  game.grantPerk(world, 'vigor'); game.grantPerk(world, 'lasting'); game.grantPerk(world, 'mines'); game.activateAbility(world, 0);
  world.zombies[0].hp = 12; world.sprintCooldown = 6.8; game.beginAttack(world, 'bash', world.zombies[0]);
  advance(world, 0.2); world.events = [];
  const checkpoint = captureCheckpoint(world, runId, 123), encoded = JSON.stringify(checkpoint), restored = readCheckpoint(JSON.parse(encoded));
  assert.ok(restored); assert.equal(restored.world.paused, true); assert.equal(restored.world.rng, world.rng);
  assert.deepEqual(restored.world.abilities, world.abilities); assert.deepEqual(restored.world.knight, world.knight); assert.deepEqual(restored.world.passives, ['vigor', 'lasting']);
  const frozen = JSON.stringify(restored.world); advance(restored.world, 5, 1, 0); assert.equal(JSON.stringify(restored.world), frozen);
  game.setPaused(restored.world, false); advance(world, 1.2, 0, -1); advance(restored.world, 1.2, 0, -1);
  assert.deepEqual(restored.world, world); assert.equal(JSON.stringify(checkpoint), encoded);
});

test('launched sling and all five location checkpoints retain valid gates and can finish the campaign', () => {
  const sling = game.createEncounter(); game.beginBattle(sling); game.addZombies(sling, 4, {x: -8,z: 3}); game.grantPerk(sling, 'sling');
  game.activateAbility(sling, 0); game.updateAim(sling, {x: 0, z: 3}, true); assert.equal(game.fireSling(sling), true); advance(sling, 0.1);
  const shot = captureCheckpoint(sling, runId); assert.ok(shot); assert.notEqual(shot.world.abilities[0].projectile, null);
  let world = game.createEncounter(); game.beginBattle(world);
  for (let wave = 1; wave <= 5; wave++) {
    const entry = readCheckpoint(captureCheckpoint(world, runId)); assert.ok(entry, `wave ${wave}`); world = entry.world; game.setPaused(world, false);
    game.damageKnight(world, world.knight.hp);
    if (wave < 5) {
      const reward = readCheckpoint(captureCheckpoint(world, runId)); assert.ok(reward); assert.equal(reward.world.awaitingReward, true);
      world = reward.world; assert.equal(game.resolveReward(world, 'skip'), false); game.setPaused(world, false); assert.equal(game.resolveReward(world, 'skip'), true);
      const travel = readCheckpoint(captureCheckpoint(world, runId)); assert.ok(travel); world = travel.world; game.setPaused(world, false); advance(world, 4.02);
      assert.equal(world.wave, wave + 1);
    }
  }
  assert.equal(world.status, 'won'); assert.equal(captureCheckpoint(world, runId), null);
});

test('damaged checkpoints are rejected instead of feeding malformed references or numbers into combat', () => {
  const source = captureCheckpoint(game.createEncounter(), runId);
  const edits = [s => s.world.zombies[0].hp = Infinity, s => s.world.rng = 0, s => s.world.wave = 6, s => s.world.knight.maxHp = 1,
    s => s.world.zombies[1].id = 0, s => s.world.activeSite = 99, s => s.world.abilities[0].armed = [0], s => s.world.abilities[0].projectile = 999,
    s => s.world.zombies = [], s => s.world.zombies.forEach(z => z.hp = 0), s => s.world.passives = ['vigor', 'vigor'], s => s.world.status = 'lost',
    s => s.world.knight.state = 'unknown', s => delete s.world.knight.bolt, s => s.world.offeredRewards = ['unknown'], s => s.world.elapsed = -5,
    s => s.world.zombies[0].locked = true, s => s.world.sprintCooldown = -4, s => s.world.abilities[0].cooldown = -1];
  for (const edit of edits) { const malformed = structuredClone(source); edit(malformed); assert.equal(readCheckpoint(malformed), null); }
  const extra = structuredClone(source); extra.world.injected = { bad: true }; assert.equal('injected' in readCheckpoint(extra).world, false);
});

test('profiles salvage valid preferences and records while discarding invalid saves and key maps', () => {
  const profile = freshProfile(); profile.settings.music = 31; profile.settings.motion = 'reduced'; profile.settings.bindings.up = 'KeyI';
  profile.checkpoint = captureCheckpoint(game.createEncounter(), runId); profile.checkpoint.world.zombies = [];
  const read = readProfile(JSON.stringify(profile)); assert.equal(read.profile.settings.music, 31); assert.equal(read.profile.settings.motion, 'reduced');
  assert.equal(read.profile.settings.bindings.up, 'KeyI'); assert.equal(read.profile.checkpoint, null); assert.match(read.notice, /checkpoint/);
  profile.settings.bindings.left = 'KeyI'; profile.settings.effects = 900; const invalid = readProfile(JSON.stringify(profile));
  assert.equal(invalid.profile.settings.bindings.up, 'KeyW'); assert.equal(invalid.profile.settings.effects, 80);
  assert.ok(readProfile('{').notice); assert.deepEqual(readProfile().profile, freshProfile());
});

test('personal history is idempotent, bounded and excludes practice; defeat retains a retry checkpoint', () => {
  const profile = freshProfile(), world = game.createEncounter(); profile.checkpoint = captureCheckpoint(world, runId);
  world.wave = 3; world.elapsed = 200; world.status = 'lost';
  assert.equal(finishRecord(profile, world, runId, true), null); assert.equal(profile.completed, 0);
  finishRecord(profile, world, runId); assert.equal(profile.bestWave, 2); assert.ok(profile.checkpoint); assert.equal(profile.completed, 1);
  assert.equal(finishRecord(profile, world, runId), null); assert.equal(profile.completed, 1);
  world.status = 'won'; world.wave = 5; world.elapsed = 300;
  finishRecord(profile, world, 'retry-run'); assert.equal(profile.wins, 1); assert.equal(profile.checkpoint, null); assert.equal(profile.bestTime, 300);
  for (let i = 0; i < 12; i++) { world.elapsed = 400 + i; finishRecord(profile, world, `run-${i}`); }
  assert.equal(profile.history.length, 8); assert.equal(profile.bestTime, 300); assert.equal(profile.bestWave, 5);
});

const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const ok = data => ({ok:true, data});
test('save queue coalesces edits, waits for earlier writes and never acknowledges newer unsent progress', async () => {
  const writes = [], first = deferred(), started = deferred();
  const store = new HordeSaveStore({getMyUserCustomData: async () => ok({Private:{}}), setPrivateData: async (key, value) => { assert.equal(key, PROFILE_KEY); writes.push(JSON.parse(value)); started.resolve(); if (writes.length === 1) await first.promise; return ok({}); }});
  await store.load(); store.update(p => p.settings.music = 20); store.update(p => p.settings.music = 21);
  const saving = store.flush(); await started.promise; assert.equal(writes.length, 1); assert.equal(writes[0].settings.music, 21);
  store.update(p => p.settings.music = 42); store.update(p => p.checkpoint = captureCheckpoint(game.createEncounter(), runId));
  assert.equal(store.status, 'saving'); first.resolve(); await saving;
  assert.equal(writes.length, 2); assert.equal(writes[1].settings.music, 42); assert.equal(writes[1].checkpoint.runId, runId); assert.equal(store.status, 'saved'); store.destroy();
});

test('failed writes retain progress for retry and never announce a save that did not succeed', async () => {
  let succeed = false, value;
  const store = new HordeSaveStore({getMyUserCustomData: async () => ok({Private:{}}), setPrivateData: async (_key, payload) => { value = payload; return succeed ? ok({}) : {ok:false,error:'offline'}; }});
  await store.load(); store.update(p => p.settings.effects = 7); await store.flush(); assert.equal(store.status, 'error'); assert.match(store.error, /not synced/);
  succeed = true; await store.retry(); assert.equal(store.status, 'saved'); assert.equal(JSON.parse(value).settings.effects, 7); store.destroy();
});

test('a failed initial read cannot overwrite an unknown cloud checkpoint; retry loads it intact', async () => {
  let available = false, writes = 0; const profile = freshProfile(); profile.checkpoint = captureCheckpoint(game.createEncounter(), runId);
  const store = new HordeSaveStore({getMyUserCustomData: async () => available ? ok({Private:{[PROFILE_KEY]:{Value:JSON.stringify(profile)}}}) : {ok:false,error:'offline'}, setPrivateData: async () => { writes++; return ok({}); }});
  await store.load(); assert.equal(store.loaded, false); assert.equal(store.status, 'error'); store.update(p => p.checkpoint = null); await store.flush(); assert.equal(writes, 0);
  available = true; await store.retry(); assert.equal(store.loaded, true); assert.equal(store.profile.checkpoint.runId, runId); store.destroy();
});

test('save teardown discards queued writes and ignores an unfinished read', async () => {
  let writes = 0; const reading = deferred();
  const store = new HordeSaveStore({getMyUserCustomData: () => reading.promise, setPrivateData: async () => { writes++; return ok({}); }});
  const load = store.load(); store.destroy(); reading.resolve(ok({Private:{}})); await load;
  assert.equal(store.loaded, false); store.update(p => p.settings.music = 0); await store.flush(); assert.equal(writes, 0);
});

test('pointer destinations clamp to the arena, stop on arrival and follow moving members rather than planted bombs', () => {
  assert.deepEqual(boundedDestination({x:100,z:-100}), {x:28,z:-20}); assert.equal(boundedDestination({x:NaN,z:0}), null);
  const world = game.createEncounter(); world.zombies = world.zombies.slice(0, 3);
  Object.assign(world.zombies[0], {x:0,z:0}); Object.assign(world.zombies[1], {x:0,z:0}); Object.assign(world.zombies[2], {x:20,z:20,locked:true,kind:'temporary'});
  assert.deepEqual(destinationDirection(world, {x:0.2,z:0.1}), {x:0,z:0,arrived:true}); assert.deepEqual(destinationDirection(world, {x:4,z:0}), {x:1,z:0,arrived:false});
  world.zombies[0].hp = 0; world.zombies[1].locked = true; assert.equal(destinationDirection(world, {x:10,z:0}).arrived, true);
});

test('remapped movement and stop work without hijacking browser shortcuts, and hidden pages release all input', () => {
  const surface = () => { const handlers = new Map(); return {addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),send:(name,event={})=>handlers.get(name)?.(event)}; };
  const oldWindow = globalThis.window, oldDocument = globalThis.document; const window = surface(), document = {...surface(),hidden:true}; globalThis.window = window; globalThis.document = document;
  try {
    let restarted = 0, stopped = 0, paused = 0; const input = new HordeInput(() => {}, () => restarted++); input.bindings.up = 'KeyI'; input.onStop = () => stopped++; input.onBlur = () => paused++; input.attach();
    const event = code => ({code,target:{closest:()=>null},preventDefault(){}});
    window.send('keydown', event('KeyW')); assert.equal(input.direction().z, 0); window.send('keydown', event('KeyI')); assert.equal(input.direction().z,-1);
    window.send('keydown', {...event('KeyR'),ctrlKey:true}); assert.equal(restarted,0); window.send('keydown', event('KeyX')); assert.equal(stopped,1); assert.equal(input.direction().z,0);
    input.holdTouch(1,'left'); document.send('visibilitychange'); assert.equal(paused,1); assert.deepEqual(input.direction(),{x:0,z:0}); input.detach();
  } finally { globalThis.window=oldWindow;globalThis.document=oldDocument; }
});

test('separate explicit flushes respect the backend write interval, including retries', async () => {
  const times = []; let fail = true, readAt = 0;
  const store = new HordeSaveStore({getMyUserCustomData:async () => {readAt=Date.now(); return ok({Private:{}});},setPrivateData:async () => {times.push(Date.now()); return fail ? {ok:false,error:'offline'} : ok({});}});
  await store.load(); assert.equal(store.hasSynced,false); store.update(p => p.settings.music = 1); await store.flush();
  fail = false; await store.retry(); assert.equal(store.hasSynced,true); store.update(p => p.settings.music = 2); await store.flush();
  assert.equal(times.length,3); assert.ok(times[0]-readAt >= 600); assert.ok(times[1]-times[0] >= 600); assert.ok(times[2]-times[1] >= 600); store.destroy();
});

test('location retry checkpoints round trip, recover a damaged latest save and clear on victory', () => {
  const p = freshProfile(); p.checkpoint = captureCheckpoint(game.createEncounter(),runId); p.retryCheckpoint = captureCheckpoint(game.createEncounter(),runId);
  const valid = readProfile(JSON.stringify(p)); assert.equal(valid.profile.retryCheckpoint.world.zombies.length,40);
  p.checkpoint.world.zombies = []; const recovered = readProfile(JSON.stringify(p)); assert.equal(recovered.profile.checkpoint.world.zombies.length,40); assert.match(recovered.notice,/entrance/);
  const won = game.createEncounter(); won.status='won'; won.wave=5; finishRecord(recovered.profile,won,runId); assert.equal(recovered.profile.checkpoint,null); assert.equal(recovered.profile.retryCheckpoint,null);
});
