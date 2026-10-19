import { levelBoardId, parseLevelBoard } from '../../../shared/level-leaderboards';
import { CAMPAIGN } from '../data/campaign';
import type { Encounter } from './types';

export interface LevelBest { milliseconds: number; pending: boolean }
export type LevelBests = Record<string, LevelBest>;
export function readLevelBests(value: unknown): LevelBests {
  const bests: LevelBests = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bests;
  for (const [id, entry] of Object.entries(value)) {
    const board = parseLevelBoard(id);
    if (!board || board.wave > CAMPAIGN.length || !entry || !Number.isInteger(entry.milliseconds) || entry.milliseconds < 1 || entry.milliseconds > 86400000 || typeof entry.pending !== 'boolean') continue;
    bests[id] = { milliseconds: entry.milliseconds, pending: entry.pending };
  }
  return bests;
}
/** Only a defeated defender earns a time; old partial checkpoints cannot manufacture a split. */
export function recordLevelClear(bests: LevelBests, world: Encounter): boolean {
  if (world.knight.hp !== 0 || !(world.awaitingReward || world.status === 'won') || !Number.isFinite(world.levelElapsed) || world.levelElapsed <= 0 || world.levelElapsed > 86400) return false;
  const id = levelBoardId(world.wave, world.normal), milliseconds = Math.max(1, Math.round(world.levelElapsed * 1000));
  if (bests[id] && bests[id].milliseconds <= milliseconds) return false;
  bests[id] = { milliseconds, pending: true };
  return true;
}
