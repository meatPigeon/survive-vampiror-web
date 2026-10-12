import type { IDosGamesClient } from '@idosgames/core';
import { createEncounter, describeEncounter, setPaused, stepEncounter, beginBattle, activateAbility, updateAim, fireSling, cancelAim, resolveReward, sprint, abilityText, canActivate } from './simulation';
import { HordeInput } from './input';
import { HordeView } from './view';
import { HordeAudio } from './audio';
import { HordeSaveStore } from './save-store';
import { captureCheckpoint, readCheckpoint } from './checkpoint';
import { finishRecord, type GameSettings } from './player-profile';
import { boundedDestination, destinationDirection } from './navigation';
import { controlKey, rebind, DEFAULT_BINDINGS, type ControlAction } from '../data/controls';
import { locationForWave } from '../data/campaign';
import type { Point } from './types';

export class HordeController {
  world = createEncounter();
  readonly view: HordeView;
  readonly input: HordeInput;
  readonly audio = new HordeAudio();
  readonly saves: HordeSaveStore;
  menu = true;
  private panel: 'help' | 'settings' | null = null;
  private confirmNew = false;
  private active = false;
  private loaded = false;
  private destroyed = false;
  private error: string | null = null;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private notified = 0;
  private saveElapsed = 0;
  private runId = '';
  private destination: Point | null = null;
  private lastDirection = { x: 0, z: 0 };
  private trail = 800;
  private trailDelay = 0;
  private lastHealth = 800;
  private listeners = new Set<() => void>();
  private snapshot: ReturnType<HordeController['makeSnapshot']>;
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  readonly ready: Promise<void>;
  constructor(host: HTMLElement, client: IDosGamesClient) {
    this.saves = new HordeSaveStore(client.userCustomData);
    this.view = new HordeView(host);
    this.input = new HordeInput(() => this.togglePause(), () => this.restart(), this.view.renderer.domElement);
    this.input.enabled = () => this.loaded && this.saves.loaded && !this.menu && !this.panel && !this.confirmNew && !this.world.paused && !this.world.betweenWaves && ['ready', 'playing'].includes(this.world.status);
    this.input.onBlur = () => this.pause();
    this.input.onSprint = () => this.sprint(); this.input.onAbility = slot => this.ability(slot);
    this.input.onFire = () => this.pointCommand(); this.input.onCancel = () => this.stop(); this.input.onStop = () => this.stop();
    this.input.onZoom = steps => this.zoom(steps); this.input.onGesture = () => this.audio.unlock();
    this.input.onDirection = (x, z) => {
      if (!this.input.enabled() || Math.hypot(x, z) === 0) return;
      this.clearDestination(); beginBattle(this.world); this.consumeEvents(); this.publish();
    };
    this.snapshot = this.makeSnapshot();
    this.saves.onChange = () => { if (!this.destroyed) this.publish(); };
    this.motion.addEventListener('change', this.applySettings);
    this.view.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.applySettings();
    const saveReady = this.saves.load().then(() => { if (!this.destroyed) { this.applySettings(); if (this.saves.loaded) this.audio.menu(); this.publish(); } });
    const assetsReady = this.view.ready.then(() => {
      if (this.destroyed) return;
      this.loaded = true; this.view.update(this.world, 0, this.menu); this.publish();
    }).catch(error => {
      if (this.destroyed) return;
      this.error = 'The game assets could not load. Check your connection and reload the game to retry.';
      console.error('[horde] asset loading failed', error); this.publish();
    });
    this.ready = Promise.all([saveReady, assetsReady]).then(() => {});
  }
  private makeSnapshot() {
    const p = this.saves.profile, checkpoint = p.checkpoint, settings = p.settings;
    return { ...describeEncounter(this.world), loaded: this.loaded && this.saves.loaded, error: this.error, menu: this.menu, normal: settings.normal,
      panel: this.panel, confirmNew: this.confirmNew, settings, reducedMotion: this.reducedMotion,
      mode: this.world.normal ? 'Relentless' : 'Adventure', audio: this.audio.settings, healthTrail: this.trail,
      saveStatus: this.saves.status, saveError: this.saves.error, saveNotice: this.saves.notice, hasSynced: this.saves.hasSynced,
      savedRun: checkpoint ? { location: locationForWave(checkpoint.world.wave).name, wave: checkpoint.world.wave, elapsed: checkpoint.world.elapsed, savedAt: checkpoint.savedAt, normal: checkpoint.world.normal } : null,
      retryLocation: p.retryCheckpoint ? locationForWave(p.retryCheckpoint.world.wave).name : null,
      records: { history: p.history, wins: p.wins, completed: p.completed, bestWave: p.bestWave, bestTime: p.bestTime, bestSurvivors: p.bestSurvivors },
      destination: this.destination, keys: Object.fromEntries(Object.entries(settings.bindings).map(([action, code]) => [action, controlKey(code)])) as Record<ControlAction, string>,
      abilityLabels: this.world.abilities.map((a, i) => abilityText(this.world, a, controlKey(settings.bindings[i === 0 ? 'ability1' : 'ability2']))),
      abilityReady: this.world.abilities.map(a => canActivate(this.world, a)) };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = this.makeSnapshot(); for (const listener of this.listeners) listener(); }
  private get reducedMotion() { return this.saves.profile.settings.motion === 'reduced' || this.saves.profile.settings.motion === 'system' && this.motion.matches; }
  private applySettings = () => {
    const settings = this.saves.profile.settings;
    this.input.bindings = { ...settings.bindings };
    this.audio.setVolume('music', settings.music, false); this.audio.setVolume('effects', settings.effects, false);
    this.view.configure(settings.quality, this.reducedMotion); this.publish();
  };
  setting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) { this.saves.update(p => { p.settings = { ...p.settings, [key]: value }; }); this.applySettings(); }
  setNormal(normal: boolean) { if (this.menu) this.setting('normal', normal); }
  setVolume(bus: 'music' | 'effects', volume: number) { this.setting(bus, Math.max(0, Math.min(100, Math.round(volume)))); }
  bind(action: ControlAction, code: string) { this.setting('bindings', rebind(this.saves.profile.settings.bindings, action, code)); }
  resetBindings() { this.setting('bindings', { ...DEFAULT_BINDINGS }); }
  async retrySave() { await this.saves.retry(); if (!this.destroyed) this.applySettings(); }
  openPanel(panel: 'help' | 'settings') { this.audio.unlock(); this.pause(); this.panel = panel; this.publish(); }
  closePanel() { this.panel = null; this.publish(); }
  start(confirmed = false) {
    if (!this.loaded || !this.saves.loaded || this.error) return;
    if (!confirmed && this.saves.profile.checkpoint) { this.confirmNew = true; this.publish(); return; }
    this.confirmNew = false; this.panel = null; this.menu = false; this.runId = crypto.randomUUID();
    this.world = createEncounter(this.saves.profile.settings.normal, Math.floor(Math.random() * 0xffffffff));
    this.resetView(); this.checkpoint(true, true); this.publish();
  }
  continueRun(retry = false) {
    const checkpoint = readCheckpoint(retry ? this.saves.profile.retryCheckpoint ?? this.saves.profile.checkpoint : this.saves.profile.checkpoint);
    if (!checkpoint || !this.loaded || this.error) return;
    this.world = checkpoint.world; this.runId = retry || this.saves.profile.history.some(r => r.id === checkpoint.runId) ? crypto.randomUUID() : checkpoint.runId;
    this.menu = false; this.panel = null; this.confirmNew = false; this.resetView();
    this.audio.beginBattle(); this.audio.pause(true); this.checkpoint(true, retry); this.publish();
  }
  private resetView() {
    this.audio.stopAll(); this.input.clear(); this.clearDestination(); this.accumulator = 0; this.saveElapsed = 0;
    this.lastDirection = { x: 0, z: 0 }; this.trail = this.lastHealth = this.world.knight.hp; this.trailDelay = 0;
    this.view.reset(); this.view.update(this.world, 0, this.menu); this.view.camera.update(this.world, 0, true); this.view.render();
  }
  restart() {
    if (this.panel || this.confirmNew || this.menu) return;
    this.pause(); this.confirmNew = true; this.publish();
  }
  cancelNew() { this.confirmNew = false; this.publish(); }
  returnToMenu() {
    this.pause(); this.checkpoint(true); this.menu = true; this.panel = null; this.confirmNew = false;
    this.audio.menu(); this.view.update(this.world, 0, true); this.publish();
  }
  private checkpoint(flush = false, locationEntry = false) {
    if (this.menu || !this.runId) return;
    const checkpoint = captureCheckpoint(this.world, this.runId);
    if (checkpoint) { this.saves.update(p => { p.checkpoint = checkpoint; if (locationEntry) p.retryCheckpoint = checkpoint; }); this.saveElapsed = 0; }
    if (flush) void this.saves.flush();
  }
  private pause() {
    if (this.menu || !['ready', 'playing'].includes(this.world.status)) return;
    this.input.clear(); this.clearDestination(); setPaused(this.world, true); this.audio.pause(true); this.checkpoint(true); this.publish();
  }
  togglePause() {
    if (this.panel) { this.closePanel(); return; }
    if (this.confirmNew) { this.cancelNew(); return; }
    if (this.menu || this.error) return;
    if (!this.world.paused) { this.pause(); return; }
    this.input.clear(); this.clearDestination(); this.accumulator = 0;
    setPaused(this.world, false); this.audio.pause(false); this.publish();
  }
  sprint() { if (!this.input.enabled()) return; sprint(this.world); this.consumeEvents(); this.publish(); }
  ability(slot = 0) { if (!this.input.enabled()) return; activateAbility(this.world, slot); this.refreshAim(); this.consumeEvents(); this.publish(); }
  aim(x: number, z: number) {
    this.input.pointer = this.view.camera.screen(this.view.renderer.domElement, { x, z });
    this.refreshAim(); this.publish();
  }
  fire() { if (!this.input.enabled()) return false; const fired = fireSling(this.world); this.consumeEvents(); this.publish(); return fired; }
  cancelAim() { cancelAim(this.world); this.publish(); }
  private clearDestination() { this.destination = null; this.view.setDestination(null); }
  stop() { this.input.clear(); this.clearDestination(); cancelAim(this.world); this.publish(); }
  private pointCommand() {
    if (!this.input.enabled()) return;
    if (this.world.abilities.some(a => a.aiming)) { this.refreshAim(); this.fire(); return; }
    const aim = this.view.camera.aim(this.view.renderer.domElement, this.input.pointer.x, this.input.pointer.y);
    if (!aim.onGround) return;
    this.destination = boundedDestination(aim.point); this.view.setDestination(this.destination);
    beginBattle(this.world); this.audio.command(); this.consumeEvents(); this.publish();
  }
  zoom(steps: number) {
    // Camera adjustment is safe while paused; movement and abilities remain gated.
    if (this.loaded && !this.error && !this.menu && !this.panel && !this.confirmNew && ['ready', 'playing'].includes(this.world.status)) {
      this.view.camera.zoom(steps);
      if (this.world.paused) { this.view.camera.update(this.world, 0, true); this.view.render(); }
    }
  }
  reward(index: number | 'skip') { if (this.panel || this.confirmNew || this.menu) return; if (resolveReward(this.world, index)) { this.input.clear(); this.consumeEvents(); this.checkpoint(true); this.publish(); } }
  private refreshAim() {
    if (!this.world.abilities.some(a => a.aiming)) return;
    const aim = this.view.camera.aim(this.view.renderer.domElement, this.input.pointer.x, this.input.pointer.y);
    updateAim(this.world, aim.point, aim.onGround);
  }
  private consumeEvents() {
    const events = this.world.events.splice(0); this.audio.events(events); this.view.handleEvents(events, this.world);
    if (events.some(e => ['wave-cleared', 'wave-start', 'victory', 'defeat'].includes(e.type))) {
      this.input.clear(); this.clearDestination();
      if (['won', 'lost'].includes(this.world.status)) {
        this.saves.update(p => { finishRecord(p, this.world, this.runId); }); void this.saves.flush();
      } else this.checkpoint(true, events.some(e => e.type === 'wave-start'));
    }
  }
  setRunning(running: boolean) {
    if (this.active === running) return;
    this.active = running;
    if (running) { this.audio.pause(!this.menu && this.world.paused); this.input.attach(); this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
    else { this.pause(); this.input.detach(); cancelAnimationFrame(this.frame); this.accumulator = 0; this.audio.pause(true); cancelAim(this.world); }
    this.publish();
  }
  private tick = (now: number) => {
    if (!this.active || this.destroyed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.loaded && (this.menu || !this.world.paused)) {
      if (!this.menu) {
        this.audio.tick(dt); this.refreshAim(); this.accumulator += dt;
        while (this.accumulator >= 1 / 60) {
          let direction = this.input.direction();
          if (Math.hypot(direction.x, direction.z) > 0) this.clearDestination();
          else if (this.input.enabled() && this.destination) {
            const next = destinationDirection(this.world, this.destination); direction = next;
            if (next.arrived) this.clearDestination();
          }
          if (Math.hypot(direction.x, direction.z) > 0 && (direction.x !== this.lastDirection.x || direction.z !== this.lastDirection.z)) this.audio.command();
          this.lastDirection = direction;
          stepEncounter(this.world, 1 / 60, direction.x, direction.z); this.consumeEvents(); this.accumulator -= 1 / 60;
        }
        this.saveElapsed += dt; if (this.saveElapsed >= 30 && this.world.status === 'playing') this.checkpoint();
        const hp = this.world.knight.hp;
        if (hp > this.lastHealth) this.trail = hp;
        else if (hp < this.lastHealth && Math.abs(this.trail - this.lastHealth) < 0.5) this.trailDelay = 0.16;
        this.lastHealth = hp; this.trailDelay = Math.max(0, this.trailDelay - dt);
        if (this.trailDelay <= 0 && !['won', 'lost'].includes(this.world.status)) this.trail += (hp - this.trail) * (1 - Math.exp(-9 * dt));
      }
      this.view.update(this.world, dt, this.menu); this.refreshAim();
    }
    if (now - this.notified >= 100) { this.publish(); this.notified = now; }
    this.frame = requestAnimationFrame(this.tick);
  };
  private contextLost = (event: Event) => {
    event.preventDefault(); this.pause(); this.error = 'The graphics connection was interrupted. Your last synced checkpoint is safe. Reload to reconnect.'; this.publish();
  };
  reload() { this.checkpoint(true); void this.saves.flush().then(() => window.location.reload()); }
  describe() {
    return { mounted: true, active: this.active, loaded: this.loaded && this.saves.loaded, error: this.error, menu: this.menu, zoom: this.view.camera.factor,
      saveStatus: this.saves.status, destination: this.destination, panel: this.panel,
      playing: this.active && this.loaded && !this.menu && !this.world.paused && !this.world.betweenWaves && this.world.status === 'playing', ...describeEncounter(this.world) };
  }
  async move(args?: Record<string, unknown>) {
    const directions: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], 'up-left': [-1, -1], 'up-right': [1, -1], 'down-left': [-1, 1], 'down-right': [1, 1] };
    const direction = directions[String(args?.dir)], ms = Number(args?.ms ?? 500);
    if (!direction || !Number.isFinite(ms)) throw new Error('move needs a valid dir and finite ms.');
    if (!this.active || !this.loaded || !this.input.enabled()) throw new Error('Start a loaded, active, unpaused encounter before moving.');
    const duration = Math.max(50, Math.min(3000, ms)); this.input.holdAgent(direction[0], direction[1], duration);
    await new Promise(resolve => setTimeout(resolve, duration)); return this.describe();
  }
  destroy() {
    this.setRunning(false); this.destroyed = true; this.saves.onChange = () => {}; void this.saves.flush().finally(() => this.saves.destroy());
    this.motion.removeEventListener('change', this.applySettings); this.view.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.audio.destroy(); this.view.destroy(); this.listeners.clear();
  }
}
