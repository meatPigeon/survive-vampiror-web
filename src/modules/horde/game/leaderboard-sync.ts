import type { IDosGamesClient } from '@idosgames/core';
import type { HordeSaveStore } from './save-store';

/** Persist a small outbox with the profile; BestTime makes retries safe after a lost response. */
export class LeaderboardSync {
  status: 'idle' | 'sending' | 'error' = 'idle';
  onChange = () => {};
  private running: Promise<void> | null = null;
  private disposed = false;
  private lastRequestAt = 0;
  constructor(private api: Pick<IDosGamesClient['leaderboard'], 'submitScoresBatch'>, private saves: HordeSaveStore) {}
  sync(): Promise<void> {
    if (this.disposed || !this.saves.loaded) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.send().finally(() => { this.running = null; });
    return this.running;
  }
  private async send() {
    try {
      while (!this.disposed) {
        const scores = Object.entries(this.saves.profile.levelBests).filter(([, best]) => best.pending)
          .map(([LeaderboardID, best]) => ({ LeaderboardID, Score: best.milliseconds }));
        if (!scores.length) break;
        this.status = 'sending'; this.onChange();
        await this.saves.flush();
        if (this.disposed) return;
        if (this.saves.status === 'error') throw new Error('Save pending');
        const delay = Math.max(0, 650 - (Date.now() - this.lastRequestAt));
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (this.disposed) return;
        const result = await this.api.submitScoresBatch(scores);
        this.lastRequestAt = Date.now();
        if (this.disposed) return;
        if (!result.ok) throw new Error('Score submission failed');
        const confirmed = scores.filter(score => result.data.some(item => item.Id === score.LeaderboardID && item.Success && item.Data && item.Data.NewScore > 0 && item.Data.NewScore <= score.Score));
        if (confirmed.length) this.saves.update(profile => {
          for (const score of confirmed) {
            const best = profile.levelBests[score.LeaderboardID];
            // A faster clear may have arrived while the old request was in flight.
            if (best?.milliseconds === score.Score) {
              best.milliseconds = result.data.find(item => item.Id === score.LeaderboardID)!.Data!.NewScore;
              best.pending = false;
            }
          }
        });
        await this.saves.flush();
        if (confirmed.length !== scores.length) throw new Error('Some scores were not accepted');
      }
      this.status = 'idle';
    } catch { this.status = 'error'; }
    if (!this.disposed) this.onChange();
  }
  destroy() { this.disposed = true; this.onChange = () => {}; }
}
