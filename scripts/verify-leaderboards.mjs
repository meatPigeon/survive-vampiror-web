import assert from 'node:assert/strict';
import { createIDosGamesClient, MemoryStorage, NoopPlatformAdapter } from '@idosgames/core';
import { campaign, loadShared } from '../tests/load-source.mjs';
const { levelBoardId } = await loadShared('level-leaderboards');
const titleID = process.env.IDOS_TITLE_ID || 'FYVPZFCO-DEV';
if (!/^[A-Z0-9]{8}-DEV$/.test(titleID)) throw new Error('Leaderboard verification requires DEV.');
const clients = [];
const pause = () => new Promise(resolve => setTimeout(resolve, 700));
function ok(result) { if (!result.ok) throw new Error(`${result.reason}: ${result.error}`); return result.data; }
async function player(suffix) {
  class Platform extends NoopPlatformAdapter { getDeviceID() { return `horde-level-time-verification-${titleID}-${suffix}`; } }
  const client = createIDosGamesClient({ titleID, platform: new Platform(new MemoryStorage()) });
  clients.push(client); client.auth.setRememberSession(false); ok(await client.auth.loginWithDeviceID()); return client;
}
try {
  const a = await player('a'), b = await player('b');
  const definitions = ok(await a.leaderboard.getDefinitions());
  const ids = [false, true].flatMap(normal => campaign.CAMPAIGN.map((_, i) => levelBoardId(i + 1, normal)));
  for (const id of ids) {
    const def = definitions.Definitions?.[id];
    assert.equal(def?.ScoreAggregation, 'BestTime'); assert.equal(def?.Schedule?.Cyclic?.Reset, 'Never');
    assert.ok(def?.ScoreSources?.some(source => source.SourceType === 'ClientScore'), `ClientScore configuration not yet visible: ${id}`);
    assert.equal(def?.IsEnabled, true); assert.equal(def?.RankRewards?.length ?? 0, 0);
  }
  const board = ids[0];
  ok(await a.leaderboard.submitScore(board, 16000)); await pause();
  ok(await a.leaderboard.submitScore(board, 18000)); await pause();
  const faster = ok(await a.leaderboard.submitScore(board, 12000)); assert.equal(faster.NewScore, 12000); await pause();
  const slower = ok(await a.leaderboard.submitScore(board, 20000)); assert.equal(slower.NewScore, 12000);
  ok(await b.leaderboard.submitScore(board, 12500));
  const separate = ok(await a.leaderboard.submitScoresBatch([{ LeaderboardID: levelBoardId(1, true), Score: 27000 }, { LeaderboardID: levelBoardId(2, false), Score: 19000 }]));
  assert.ok(separate.every(item => item.Success));
  const overview = ok(await a.leaderboard.getOverviewBatch(ids));
  assert.equal(overview.length, 10); assert.ok(overview.every(x => x.Leaderboard?.Success && x.Progress?.Success));
  const first = overview.find(x => x.LeaderboardID === board), top = first.Leaderboard.Data.TopUsers;
  const aId = a.auth.context.userID, bId = b.auth.context.userID;
  assert.equal(first.Progress.Data.CurrentScore, 12000);
  assert.ok(top.findIndex(x => x.UserID === aId) < top.findIndex(x => x.UserID === bId));
  assert.equal(overview.find(x => x.LeaderboardID === levelBoardId(1, true)).Progress.Data.CurrentScore, 27000);
  assert.equal(overview.find(x => x.LeaderboardID === levelBoardId(2, false)).Progress.Data.CurrentScore, 19000);
  assert.equal((await a.leaderboard.submitScore(board, 0)).ok, false);
  console.log(JSON.stringify({ ok: true, titleID, boards: 10, checks: ['BestTime and Never definitions', 'slower cannot replace faster', 'ascending public ranking across two players', 'location and difficulty isolation', 'overview and own rank', 'zero score rejected'], note: 'Uses two dedicated DEV smoke accounts only; no PROD scores or rewards.' }, null, 2));
} finally { clients.forEach(client => client.auth.logout()); }
