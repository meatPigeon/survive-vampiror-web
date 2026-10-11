import { DEFAULT_BINDINGS, allowedKey, type Bindings } from '../data/controls';
import { readCheckpoint, type Checkpoint } from './checkpoint';
import type { Encounter } from './types';
import { RULES } from './rules';

export interface GameSettings {
  music: number; effects: number; normal: boolean; hints: boolean;
  quality: 'auto' | 'low' | 'high'; motion: 'system' | 'reduced' | 'full'; touch: 'auto' | 'always' | 'hidden'; bindings: Bindings;
}
export interface RunRecord { id: string; won: boolean; normal: boolean; elapsed: number; conquered: number; survivors: number; recruited: number; casualties: number; finishedAt: number }
export interface PlayerProfile { version: 1; settings: GameSettings; checkpoint: Checkpoint | null; retryCheckpoint: Checkpoint | null; history: RunRecord[]; wins: number; completed: number; bestWave: number; bestTime: number | null; bestSurvivors: number }
export function freshProfile(): PlayerProfile {
  return { version: 1, settings: { music: 65, effects: 80, normal: false, hints: true, quality: 'auto', motion: 'system', touch: 'auto', bindings: { ...DEFAULT_BINDINGS } }, checkpoint: null, retryCheckpoint: null, history: [], wins: 0, completed: 0, bestWave: 0, bestTime: null, bestSurvivors: 0 };
}
const count = (value: unknown, max = 1e7) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
export function readProfile(raw?: string): { profile: PlayerProfile; notice: string | null } {
  const profile = freshProfile();
  if (!raw) return { profile, notice: null };
  try {
    const source = JSON.parse(raw);
    if (source?.version !== 1 || !source.settings) throw new Error('Unknown save format');
    const s = source.settings;
    for (const bus of ['music', 'effects'] as const) if (count(s[bus], 100)) profile.settings[bus] = s[bus];
    for (const key of ['normal', 'hints'] as const) if (typeof s[key] === 'boolean') profile.settings[key] = s[key];
    if (['auto', 'low', 'high'].includes(s.quality)) profile.settings.quality = s.quality;
    if (['system', 'reduced', 'full'].includes(s.motion)) profile.settings.motion = s.motion;
    if (['auto', 'always', 'hidden'].includes(s.touch)) profile.settings.touch = s.touch;
    const keys = Object.keys(DEFAULT_BINDINGS) as (keyof Bindings)[];
    if (s.bindings && keys.every(k => typeof s.bindings[k] === 'string' && allowedKey(s.bindings[k])) && new Set(keys.map(k => s.bindings[k])).size === keys.length) profile.settings.bindings = Object.fromEntries(keys.map(k => [k, s.bindings[k]])) as Bindings;
    for (const key of ['wins', 'completed', 'bestSurvivors'] as const) if (count(source[key])) profile[key] = source[key];
    if (count(source.bestWave, RULES.waves)) profile.bestWave = source.bestWave;
    if (typeof source.bestTime === 'number' && Number.isFinite(source.bestTime) && source.bestTime > 0 && source.bestTime <= 86400) profile.bestTime = source.bestTime;
    if (Array.isArray(source.history)) profile.history = source.history.filter((r: RunRecord) => r && typeof r.id === 'string' && r.id.length <= 80 && typeof r.won === 'boolean' && typeof r.normal === 'boolean' && Number.isFinite(r.elapsed) && r.elapsed >= 0 && r.elapsed <= 86400 && count(r.conquered, RULES.waves) && count(r.survivors, 200) && count(r.recruited) && count(r.casualties) && count(r.finishedAt, Number.MAX_SAFE_INTEGER)).slice(0, 8).map((r: RunRecord) => ({ id: r.id, won: r.won, normal: r.normal, elapsed: r.elapsed, conquered: r.conquered, survivors: r.survivors, recruited: r.recruited, casualties: r.casualties, finishedAt: r.finishedAt }));
    profile.checkpoint = readCheckpoint(source.checkpoint);
    const invalidCheckpoint = source.checkpoint && !profile.checkpoint;
    profile.retryCheckpoint = readCheckpoint(source.retryCheckpoint);
    if (profile.checkpoint && profile.retryCheckpoint && (profile.checkpoint.world.wave !== profile.retryCheckpoint.world.wave || profile.checkpoint.world.normal !== profile.retryCheckpoint.world.normal)) profile.retryCheckpoint = null;
    if (!profile.checkpoint && profile.retryCheckpoint) profile.checkpoint = readCheckpoint(profile.retryCheckpoint);
    return { profile, notice: invalidCheckpoint ? profile.retryCheckpoint ? 'Your latest checkpoint could not be restored. The location entrance is still available.' : 'An older checkpoint could not be restored. Your settings and records are still available.' : null };
  } catch { return { profile, notice: 'The saved data could not be read. Start a new march to replace it.' }; }
}
export function finishRecord(profile: PlayerProfile, world: Encounter, runId: string, practice = false, now = Date.now()): RunRecord | null {
  if (practice || !['won', 'lost'].includes(world.status) || profile.history.some(r => r.id === runId)) return null;
  const won = world.status === 'won', conquered = won ? RULES.waves : world.wave - 1;
  const record = { id: runId, won, normal: world.normal, elapsed: world.elapsed, conquered,
    survivors: world.zombies.filter(z => z.hp > 0 && z.kind === 'permanent').length, recruited: world.recruited, casualties: world.casualties, finishedAt: now };
  profile.history = [record, ...profile.history].slice(0, 8); profile.completed++;
  profile.bestWave = Math.max(profile.bestWave, conquered);
  if (won) { profile.wins++; profile.bestTime = profile.bestTime === null ? world.elapsed : Math.min(profile.bestTime, world.elapsed); profile.bestSurvivors = Math.max(profile.bestSurvivors, record.survivors); profile.checkpoint = null; profile.retryCheckpoint = null; }
  return record;
}
