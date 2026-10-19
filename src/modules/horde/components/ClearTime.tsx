import { formatClearTime } from '../../../shared/level-leaderboards';
import type { HordeController } from '../game/controller';
import type { Snapshot } from './GameMenu';

export function ClearTime({ state, controller, openLeaderboard }: { state: Snapshot; controller: HordeController; openLeaderboard?: () => void }) {
  const valid = state.knight.hp <= 0 && state.levelElapsed > 0;
  return <div className="horde-clear-time">
    {valid && <span>Location clear <b>{formatClearTime(state.levelElapsed * 1000)}</b>{state.levelBest && <small>Your best {formatClearTime(state.levelBest.milliseconds)}</small>}</span>}
    {state.knight.hp <= 0 && state.levelElapsed < 0 && <small>Timing starts from the next location for this older save.</small>}
    <ScoreSyncStatus state={state} controller={controller} />
    {openLeaderboard && <button onClick={openLeaderboard}>Best times</button>}
  </div>;
}

export function ScoreSyncStatus({ state, controller }: { state: Snapshot; controller: HordeController }) {
  if (!state.pendingScores) return null;
  return <div className="horde-score-sync"><small role="status">{state.leaderboardStatus === 'sending' ? 'Posting your best time…' : 'Best time waiting to upload'}</small>{state.leaderboardStatus === 'error' && <button onClick={() => void controller.retryScores()}>Retry time upload</button>}</div>;
}
