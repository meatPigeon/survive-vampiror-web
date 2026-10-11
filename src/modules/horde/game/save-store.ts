import type { IDosGamesClient } from '@idosgames/core';
import { freshProfile, readProfile, type PlayerProfile } from './player-profile';

export const PROFILE_KEY = 'horde_profile_v1';
type Transport = Pick<IDosGamesClient['userCustomData'], 'getMyUserCustomData' | 'setPrivateData'>;
/** One coalesced writer: an older request can never acknowledge a newer unsent state. */
export class HordeSaveStore {
  profile = freshProfile();
  loaded = false;
  hasSynced = false;
  status: 'loading' | 'saved' | 'saving' | 'error' = 'loading';
  error: string | null = null;
  notice: string | null = null;
  private revision = 0;
  private acknowledged = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> | null = null;
  private disposed = false;
  private reading = false;
  private lastRequestAt = 0;
  onChange = () => {};
  constructor(private transport: Transport) {}
  async load() {
    if (this.loaded || this.disposed || this.reading) return;
    this.reading = true;
    this.status = 'loading'; this.error = null; this.onChange();
    try {
      const delay = Math.max(0, 650 - (Date.now() - this.lastRequestAt));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (this.disposed) return;
      const result = await this.transport.getMyUserCustomData();
      if (this.disposed) return;
      if (!result.ok) throw new Error(result.error || 'Could not connect to your saved game.');
      const value = result.data.Private?.[PROFILE_KEY]?.Value;
      const { profile, notice } = readProfile(value ?? undefined);
      this.hasSynced = !!value;
      this.profile = profile; this.notice = notice; this.loaded = true; this.status = 'saved';
    } catch { if (!this.disposed) { this.status = 'error'; this.error = 'Could not load your cloud save. Check your connection and retry.'; } }
    finally { this.lastRequestAt = Date.now(); this.reading = false; }
    if (!this.disposed) this.onChange();
  }
  update(change: (profile: PlayerProfile) => void) {
    if (!this.loaded || this.disposed) return;
    change(this.profile); this.revision++; this.status = 'saving'; this.error = null; this.onChange();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 800);
  }
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.writing) return this.writing;
    if (!this.loaded || this.disposed || this.acknowledged === this.revision) return Promise.resolve();
    this.writing = this.writePending().finally(() => { this.writing = null; });
    return this.writing;
  }
  private async writePending() {
    while (!this.disposed && this.acknowledged < this.revision) {
      const delay = Math.max(0, 650 - (Date.now() - this.lastRequestAt));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (this.disposed) return;
      const version = this.revision, payload = JSON.stringify(this.profile);
      this.status = 'saving'; this.onChange();
      try {
        const result = await this.transport.setPrivateData(PROFILE_KEY, payload);
        if (this.disposed) return;
        if (!result.ok) throw new Error(result.error || 'Save failed');
        this.acknowledged = version; this.hasSynced = true; this.error = null;
      } catch {
        if (!this.disposed) { this.status = 'error'; this.error = 'Your latest progress has not synced. Keep this tab open and retry.'; this.onChange(); }
        return;
      } finally { this.lastRequestAt = Date.now(); }
    }
    if (!this.disposed) { this.status = 'saved'; this.onChange(); }
  }
  async retry() { if (this.loaded) await this.flush(); else await this.load(); }
  destroy() { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.onChange = () => {}; }
}
