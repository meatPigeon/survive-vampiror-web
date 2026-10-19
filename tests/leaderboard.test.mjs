import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulation as game, loadGame, loadShared } from './load-source.mjs';
const { captureCheckpoint, readCheckpoint } = await loadGame('checkpoint');
const { freshProfile, readProfile } = await loadGame('player-profile');
const { recordLevelClear } = await loadGame('level-records');
const { LeaderboardSync } = await loadGame('leaderboard-sync');
const { levelBoardId, formatClearTime } = await loadShared('level-leaderboards');
const id = levelBoardId(1, false);

test('location timer excludes ready, pause, rewards and travel, then resets for the next defender', () => {
  const w = game.createEncounter();
  game.stepEncounter(w, 1); assert.equal(w.levelElapsed, 0);
  game.stepEncounter(w, 1 / 60, 1, 0); const first = w.levelElapsed;
  game.setPaused(w, true); game.stepEncounter(w, 3, 1, 0); assert.equal(w.levelElapsed, first);
  game.setPaused(w, false); game.damageKnight(w, 9999);
  game.stepEncounter(w, 8); assert.equal(w.levelElapsed, first);
  game.resolveReward(w, 'skip'); game.stepEncounter(w, 10);
  assert.equal(w.wave, 2); assert.equal(w.levelElapsed, 0); assert.equal(w.elapsed, first);
  game.stepEncounter(w, 1 / 60); assert.equal(w.levelElapsed, 1 / 60);
});

test('Continue preserves a partial location time; legacy later-wave saves never submit partial splits', () => {
  const w = game.createEncounter(); game.stepEncounter(w, 1 / 60, 1, 0);
  let saved = captureCheckpoint(w, 'timer-test');
  assert.equal(readCheckpoint(saved).world.levelElapsed, w.levelElapsed);
  delete saved.world.levelElapsed;
  assert.equal(readCheckpoint(saved).world.levelElapsed, w.elapsed);
  game.damageKnight(w, 9999); game.resolveReward(w, 'skip'); game.stepEncounter(w, 10);
  saved = captureCheckpoint(w, 'legacy-later'); delete saved.world.levelElapsed;
  const legacy = readCheckpoint(saved).world; assert.equal(legacy.levelElapsed, -1);
  game.setPaused(legacy, false); game.stepEncounter(legacy, 1 / 60); game.damageKnight(legacy, 9999);
  assert.equal(recordLevelClear({}, legacy), false);
  game.resolveReward(legacy, 'skip'); game.stepEncounter(legacy, 10); assert.equal(legacy.levelElapsed, 0);
});

test('each clear records its own best, difficulty is separate and the final castle counts', () => {
  const bests = {}, w = game.createEncounter(); game.beginBattle(w);
  w.elapsed = w.levelElapsed = 12.345;
  assert.equal(recordLevelClear(bests, w), false); // Not defeated.
  game.damageKnight(w, 9999); assert.equal(recordLevelClear(bests, w), true);
  assert.deepEqual(bests[id], { milliseconds: 12345, pending: true });
  w.levelElapsed = 15; assert.equal(recordLevelClear(bests, w), false);
  w.levelElapsed = 11; assert.equal(recordLevelClear(bests, w), true);
  w.normal = true; assert.equal(recordLevelClear(bests, w), true);
  assert.equal(bests[levelBoardId(1, true)].milliseconds, 11000);
  for (let wave = 2; wave <= 5; wave++) {
    game.resolveReward(w, 'skip'); game.stepEncounter(w, 10);
    w.levelElapsed = 10 + wave; game.damageKnight(w, 9999);
    assert.equal(recordLevelClear(bests, w), true);
    assert.equal(bests[levelBoardId(wave, true)].milliseconds, (10 + wave) * 1000);
  }
  assert.equal(w.status, 'won');
});

test('saved bests reject malformed entries and older profiles default to no leaderboard records', () => {
  const p = freshProfile(); delete p.levelBests;
  assert.deepEqual(readProfile(JSON.stringify(p)).profile.levelBests, {});
  p.levelBests = { [id]: { milliseconds: 24567, pending: true }, bad: { milliseconds: 1, pending: true },
    [levelBoardId(2, false)]: { milliseconds: -1, pending: true }, [levelBoardId(3, false)]: { milliseconds: 2.5, pending: false },
    [levelBoardId(99, false)]: { milliseconds: 500, pending: true } };
  assert.deepEqual(readProfile(JSON.stringify(p)).profile.levelBests, { [id]: { milliseconds: 24567, pending: true } });
  assert.equal(formatClearTime(62345), '01:02.345'); assert.equal(formatClearTime(0), '—');
});

function saveWith(bests) { return { loaded: true, status: 'saved', profile: { ...freshProfile(), levelBests: bests }, update(fn) { fn(this.profile); }, async flush() {} }; }
const accepted = scores => ({ ok: true, data: scores.map(s => ({ Id: s.LeaderboardID, Success: true, Data: { NewScore: s.Score } })) });
test('network failure preserves the score outbox; Retry submits it and duplicate requests share one operation', async () => {
  const saves = saveWith({ [id]: { milliseconds: 12345, pending: true } }); let calls = 0;
  const sync = new LeaderboardSync({ async submitScoresBatch(scores) { calls++; return calls === 1 ? { ok: false, reason: 'connection' } : accepted(scores); } }, saves);
  const first = sync.sync(); assert.equal(sync.sync(), first); await first;
  assert.equal(sync.status, 'error'); assert.equal(saves.profile.levelBests[id].pending, true);
  await sync.sync(); assert.equal(sync.status, 'idle'); assert.equal(saves.profile.levelBests[id].pending, false);
  await sync.sync(); assert.equal(calls, 2); sync.destroy();
});
test('partial batch failure only acknowledges confirmed entries', async () => {
  const second = levelBoardId(2, false), saves = saveWith({ [id]: { milliseconds: 12000, pending: true }, [second]: { milliseconds: 16000, pending: true } });
  const sync = new LeaderboardSync({ async submitScoresBatch(scores) { return { ok: true, data: [accepted(scores).data[0], { Id: second, Success: false, Error: 'Unavailable' }] }; } }, saves);
  await sync.sync(); assert.equal(saves.profile.levelBests[id].pending, false); assert.equal(saves.profile.levelBests[second].pending, true); assert.equal(sync.status, 'error'); sync.destroy();
});
test('a faster score arriving during submission stays pending until its own confirmation', async () => {
  const saves = saveWith({ [id]: { milliseconds: 12000, pending: true } }); let calls = 0;
  const sync = new LeaderboardSync({ async submitScoresBatch(scores) { calls++; if (calls === 1) saves.profile.levelBests[id] = { milliseconds: 10000, pending: true }; return accepted(scores); } }, saves);
  await sync.sync(); assert.equal(calls, 2); assert.deepEqual(saves.profile.levelBests[id], { milliseconds: 10000, pending: false }); sync.destroy();
});
test('failed cloud save never discards the upload queue or submits before it is durable', async () => {
  const saves = saveWith({ [id]: { milliseconds: 12000, pending: true } }); saves.status = 'error'; let calls = 0;
  const sync = new LeaderboardSync({ async submitScoresBatch(scores) { calls++; return accepted(scores); } }, saves);
  await sync.sync(); assert.equal(calls, 0); assert.equal(sync.status, 'error'); assert.equal(saves.profile.levelBests[id].pending, true); sync.destroy();
});


test('the server best from another device replaces a slower local best', async () => {
  const saves = saveWith({ [id]: { milliseconds: 12000, pending: true } });
  const sync = new LeaderboardSync({ async submitScoresBatch() { return {ok:true,data:[{Id:id,Success:true,Data:{NewScore:10000}}]}; } }, saves);
  await sync.sync(); assert.deepEqual(saves.profile.levelBests[id],{milliseconds:10000,pending:false}); sync.destroy();
});
