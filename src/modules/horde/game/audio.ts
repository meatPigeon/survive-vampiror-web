import type { GameEvent, Perk } from './types';
const files = import.meta.glob('../assets/reference/audio/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (name: string) => files[`../assets/reference/audio/${name}`]!;
const levels = { warning: -7, swish: -12, impact: -6, voice: -15, rise: -13, sink: -16, footsteps: -22, bite: -17, command: -17, notice: -14, result: -8, cast: -13, perkImpact: -10 };
let volumes = { music: 1, effects: 1 };
export class HordeAudio {
  private music = new Audio();
  private channels = new Map<keyof typeof levels, HTMLAudioElement>();
  private voiceCooldown = 0;
  private biteCooldown = 0;
  private commandCooldown = 0;
  private stepTravel = 0;
  private hitHeard = false;
  private suspended = new Set<HTMLAudioElement>();
  private isPaused = false;
  constructor() {
    this.music.loop = true;
    for (const key of Object.keys(levels) as (keyof typeof levels)[]) { const player = new Audio(); player.preservesPitch = false; this.channels.set(key, player); }
    this.syncVolumes();
  }
  get settings() { return { music: Math.round(volumes.music * 100), effects: Math.round(volumes.effects * 100) }; }
  setVolume(bus: 'music' | 'effects', value: number, feedback = true) { volumes = { ...volumes, [bus]: Math.max(0, Math.min(1, value / 100)) }; this.syncVolumes(); if (feedback && bus === 'effects') { const player = this.channels.get('notice')!; if (player.paused) { player.src = url('command.wav'); player.play().catch(() => {}); } } }
  private syncVolumes() {
    this.music.volume = volumes.music * 10 ** (-12 / 20);
    for (const [key, player] of this.channels) player.volume = volumes.effects * 10 ** (levels[key] / 20);
  }
  menu() { this.stopAll(); this.music.src = url('undead_march.ogg'); this.music.play().catch(() => {}); }
  unlock() { if (this.music.src && this.music.paused && !this.isPaused) this.music.play().catch(() => {}); }
  beginBattle() { this.music.src = url('graveyard_groove.ogg'); this.music.play().catch(() => {}); }
  private play(channel: keyof typeof levels, filename: string, pitch = 1) {
    if (this.isPaused) return;
    const player = this.channels.get(channel)!; player.src = url(filename); player.playbackRate = pitch; player.play().catch(() => {});
  }
  private voice(pitch: number) {
    if (this.voiceCooldown > 0 || !this.channels.get('voice')!.paused) return;
    this.play('voice', 'zombie_grunt.wav', pitch * (0.93 + Math.random() * 0.14)); this.voiceCooldown = 0.9;
  }
  tick(dt: number) { this.voiceCooldown = Math.max(0, this.voiceCooldown - dt); this.biteCooldown = Math.max(0, this.biteCooldown - dt); this.commandCooldown = Math.max(0, this.commandCooldown - dt); }
  command() { if (this.commandCooldown > 0 || /sprint/.test(this.channels.get('command')!.src) && !this.channels.get('command')!.paused) return; this.play('command', 'command.wav'); this.commandCooldown = 0.12; }
  travel(distance: number) {
    if (distance < 0.001) { this.stepTravel = 0; return; }
    this.stepTravel = Math.min(this.stepTravel + distance, 0.85);
    if (this.stepTravel >= 0.85 && this.channels.get('footsteps')!.paused) { this.stepTravel = 0; this.play('footsteps', 'horde_step.wav', 0.9 + Math.random() * 0.25); }
  }
  events(events: GameEvent[]) {
    for (const event of events) switch (event.type) {
      case 'horde-moved': this.travel(event.amount ?? 0); break;
      case 'battle-start': this.beginBattle(); break;
      case 'sprint': this.play('command', 'sprint.wav'); break;
      case 'attack-warned':
        this.hitHeard = false; this.play('warning', `warning_${event.attack === 'sweep' || event.attack === 'spin' ? event.attack : 'charge'}.wav`, event.attack === 'crossbow' ? 1.5 : event.attack === 'rush' ? 0.7 : 1); break;
      case 'attack-struck': this.channels.get('warning')!.pause(); this.play('swish', 'halberd_swish.wav', event.attack === 'crossbow' ? 1.65 : event.attack === 'spin' ? 0.75 : 1); break;
      case 'attack-hit': if (!this.hitHeard) { this.hitHeard = true; this.play('impact', 'halberd_hit.wav', 0.92 + Math.random() * 0.14); } break;
      case 'knight-hit':
        this.voice(1.08); if (this.biteCooldown <= 0 && this.channels.get('bite')!.paused) { this.play('bite', 'zombie_bite.wav', 0.9 + Math.random() * 0.22); this.biteCooldown = 0.35; } break;
      case 'zombie-death': this.voice(0.86); break;
      case 'expired': if (this.channels.get('notice')!.paused) this.play('notice', 'expired.wav'); break;
      case 'recruited': this.voice(1); this.play('notice', 'recruited.wav'); break;
      case 'site-closed': this.play('sink', 'grave_sink.wav'); break;
      case 'site-activated': this.play('rise', 'grave_rise.wav'); break;
      case 'ability-activated': { const cues: Partial<Record<Perk, string>> = { mines: 'mine_arm.wav', sling: 'sling_launch.wav', feast: 'feast_start.wav', sprint: 'sprint.wav' }; const cue = event.upgrade && cues[event.upgrade]; if (cue) this.play('cast', cue); break; }
      case 'perk-gained': this.play('notice', 'recruited.wav', 0.85); break;
      case 'ability-impact': this.play('perkImpact', event.upgrade === 'mines' ? 'mine_blast.wav' : 'sling_land.wav'); break;
      case 'feast-ended': if (this.channels.get('cast')!.paused) this.play('cast', 'feast_end.wav'); break;
      case 'wave-cleared': this.stopEffects(); break;
      case 'victory': case 'defeat': this.stopAll(); this.play('result', `${event.type}.wav`); break;
    }
  }
  pause(paused: boolean) {
    if (this.isPaused === paused) return; this.isPaused = paused;
    if (paused) { for (const p of [this.music, ...this.channels.values()]) if (!p.paused) { this.suspended.add(p); p.pause(); } }
    else { for (const p of this.suspended) p.play().catch(() => {}); this.suspended.clear(); }
  }
  private stopEffects() { for (const p of this.channels.values()) { p.pause(); p.currentTime = 0; this.suspended.delete(p); } this.stepTravel = 0; }
  stopAll() { this.stopEffects(); this.music.pause(); this.music.currentTime = 0; this.music.removeAttribute("src"); this.suspended.clear(); this.isPaused = false; this.voiceCooldown = 0; this.biteCooldown = 0; this.commandCooldown = 0; }
  destroy() { this.stopAll(); for (const p of [this.music, ...this.channels.values()]) { p.removeAttribute('src'); p.load(); } }
}
