import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadController, loadGame, simulation as game } from './load-source.mjs';
const { HordeController } = await loadController();
const { freshProfile } = await loadGame('player-profile');
const { captureCheckpoint } = await loadGame('checkpoint');
const { PROFILE_KEY } = await loadGame('save-store');

async function withController(run, profile = freshProfile()) {
  const previous = {window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const window = new EventTarget(), document = new EventTarget(); let frame;
  window.matchMedia = () => Object.assign(new EventTarget(), {matches:false});
  globalThis.window = window; globalThis.document = document;
  globalThis.requestAnimationFrame = cb => {frame = cb; return 1;}; globalThis.cancelAnimationFrame = () => {};
  const writes = [];
  const client = {userCustomData:{getMyUserCustomData:async () => ({ok:true,data:{Private:{[PROFILE_KEY]:{Value:JSON.stringify(profile)}}}}),setPrivateData:async (_key,value) => {writes.push(JSON.parse(value)); return {ok:true,data:{}};}}};
  const controller = new HordeController({}, client);
  try { await controller.ready; controller.setRunning(true); await run(controller, window, writes, () => frame(performance.now() + 100)); }
  finally { controller.destroy(); await controller.saves.flush(); Object.assign(globalThis,previous); }
}

test('controller start, focus loss, menu and Continue preserve the checkpoint and stop held movement', async () => {
  await withController(async (c, window, writes, frame) => {
    c.start(); c.input.holdAgent(1, 0, 1000); frame(); assert.equal(c.world.status,'playing'); assert.ok(c.world.elapsed > 0);
    window.dispatchEvent(new Event('blur')); assert.equal(c.world.paused,true); assert.equal(c.audio.paused,true); assert.deepEqual(c.input.direction(),{x:0,z:0});
    await c.saves.flush(); assert.ok(writes.at(-1).checkpoint); const elapsed = c.world.elapsed, position = c.world.zombies[0].x;
    c.returnToMenu(); assert.equal(c.getSnapshot().menu,true); assert.ok(c.getSnapshot().savedRun);
    c.continueRun(); assert.equal(c.getSnapshot().menu,false); assert.equal(c.world.paused,true); assert.equal(c.world.elapsed,elapsed); assert.equal(c.world.zombies[0].x,position);
    c.togglePause(); assert.equal(c.world.paused,false);
    c.restart(); assert.equal(c.world.paused,true); assert.equal(c.getSnapshot().confirmNew,true); assert.equal(c.world.elapsed,elapsed);
    c.cancelNew(); assert.equal(c.world.elapsed,elapsed); assert.equal(c.world.paused,true);
  });
});

test('debug practice traverses rewards and results without replacing the real saved run or awarding records', async () => {
  await withController(async c => {
    c.start(); await c.saves.flush(); const id = c.saves.profile.checkpoint.runId;
    c.debugKillKnight(); assert.equal(c.getSnapshot().practice,true); assert.equal(c.world.awaitingReward,true); assert.equal(c.saves.profile.checkpoint.world.knight.hp,800);
    for (let wave = 1; wave < 5; wave++) { c.reward('skip'); for (let i = 0; i < 241; i++) game.stepEncounter(c.world,1/60); c.debugKillKnight(); }
    assert.equal(c.world.status,'won'); assert.equal(c.saves.profile.completed,0); assert.equal(c.saves.profile.wins,0); assert.equal(c.saves.profile.checkpoint.runId,id); assert.equal(c.saves.profile.checkpoint.world.wave,1);
    c.returnToMenu(); c.continueRun(); assert.equal(c.world.wave,1); assert.equal(c.getSnapshot().practice,false);
  });
});

test('restored runs stay frozen behind help/settings, and a declined new march cannot discard them', async () => {
  const profile = freshProfile(), world = game.createEncounter(true); game.beginBattle(world); world.knight.hp = 455; profile.checkpoint = captureCheckpoint(world,'existing-run');
  await withController(async c => {
    c.start(); assert.equal(c.getSnapshot().confirmNew,true); assert.equal(c.saves.profile.checkpoint.world.knight.hp,455);
    c.cancelNew(); c.continueRun(); assert.equal(c.world.paused,true); assert.equal(c.world.normal,true);
    c.openPanel('settings'); c.setting('music',0); c.bind('up','KeyI'); assert.equal(c.audio.settings.music,0); assert.equal(c.input.bindings.up,'KeyI');
    c.closePanel(); assert.equal(c.world.paused,true); assert.equal(c.world.knight.hp,455);
    c.togglePause(); c.openPanel('help'); assert.equal(c.world.paused,true); assert.equal(c.getSnapshot().panel,'help');
    c.closePanel(); c.start(true); assert.equal(c.world.status,'ready'); assert.equal(c.world.knight.hp,800); assert.equal(c.world.zombies.length,40);
  },profile);
});

test('pointer commands use the ordinary movement path; Stop and graphics interruption release them safely', async () => {
  await withController(async (c, _window, _writes, frame) => {
    c.start(); const before = game.centerOf(game.alive(c.world));
    const click = new Event('pointerdown'); Object.assign(click,{clientX:25,clientY:3,button:0}); c.view.renderer.domElement.dispatchEvent(click);
    assert.equal(c.world.status,'playing'); assert.deepEqual(c.getSnapshot().destination,{x:25,z:3}); frame();
    assert.ok(game.centerOf(game.alive(c.world)).x > before.x); c.stop(); assert.equal(c.getSnapshot().destination,null);
    c.view.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})); assert.equal(c.world.paused,true); assert.match(c.getSnapshot().error,/graphics/);
    assert.ok(c.saves.profile.checkpoint); assert.equal(c.input.enabled(),false);
  });
});

test('defeat retries the location entrance instead of the latest nearly-dead autosave', async () => {
  await withController(async c => {
    c.start(); const originalId = c.saves.profile.retryCheckpoint.runId;
    c.world.zombies.slice(1).forEach(z => game.damageZombie(c.world,z,z.hp)); c.world.zombies[0].hp = 1; game.beginBattle(c.world);
    c.togglePause(); assert.equal(c.saves.profile.checkpoint.world.zombies.filter(z => z.hp > 0).length,1);
    assert.equal(c.saves.profile.retryCheckpoint.world.zombies.length,40);
    c.continueRun(true); assert.equal(c.world.zombies.length,40); assert.ok(c.world.zombies.every(z => z.hp === 30));
    assert.equal(c.world.knight.hp,800); assert.equal(c.world.elapsed,0); assert.equal(c.world.paused,true);
    assert.notEqual(c.saves.profile.checkpoint.runId,originalId); assert.equal(c.saves.profile.retryCheckpoint.runId,c.saves.profile.checkpoint.runId);
  });
});
