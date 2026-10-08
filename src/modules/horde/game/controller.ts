import { createEncounter, describeEncounter, setPaused, stepEncounter, beginBattle, activateAbility, updateAim, fireSling, cancelAim, resolveReward, sprint, abilityText, canActivate } from './simulation';
import { HordeInput } from './input';
import { HordeView } from './view';
import { HordeAudio } from './audio';

export class HordeController {
  world = createEncounter();
  readonly view: HordeView;
  readonly input: HordeInput;
  readonly audio = new HordeAudio();
  menu = true;
  private normal = false;
  private active = false;
  private loaded = false;
  private destroyed = false;
  private error: string | null = null;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private notified = 0;
  private lastDirection = { x: 0, z: 0 };
  private trail = 800;
  private trailDelay = 0;
  private lastHealth = 800;
  private listeners = new Set<() => void>();
  private snapshot = this.makeSnapshot();
  readonly ready: Promise<void>;
  constructor(host: HTMLElement) {
    this.view = new HordeView(host);
    this.input = new HordeInput(() => this.togglePause(), () => this.restart(), this.view.renderer.domElement);
    this.input.enabled = () => !this.menu && !this.world.paused && !this.world.betweenWaves && ['ready', 'playing'].includes(this.world.status);
    this.input.onBlur = () => { cancelAim(this.world); this.publish(); };
    this.input.onSprint = () => this.sprint(); this.input.onAbility = slot => this.ability(slot);
    this.input.onFire = () => { this.refreshAim(); this.fire(); }; this.input.onCancel = () => this.cancelAim();
    this.input.onZoom = steps => this.zoom(steps); this.input.onGesture = () => this.audio.unlock();
    this.input.onDirection = (x, z) => {
      if (!this.input.enabled() || Math.hypot(x, z) === 0) return;
      beginBattle(this.world); this.consumeEvents(); this.publish();
    };
    this.audio.menu();
    this.ready = this.view.ready.then(() => {
      if (this.destroyed) return;
      this.loaded = true; this.view.update(this.world, 0, this.menu); this.publish();
    }).catch(error => {
      if (this.destroyed) return;
      this.error = 'The game assets could not load. Return to the lobby and reload to retry.';
      console.error('[horde] asset loading failed', error); this.publish();
    });
  }
  private makeSnapshot() {
    return { ...describeEncounter(this.world), loaded: this.loaded, error: this.error, menu: this.menu, normal: this.normal,
      audio: this.audio.settings, healthTrail: this.trail,
      abilityLabels: this.world.abilities.map((a, i) => abilityText(this.world, a, i === 0 ? 'Q' : 'E')),
      abilityReady: this.world.abilities.map(a => canActivate(this.world, a)) };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = this.makeSnapshot(); for (const listener of this.listeners) listener(); }
  setNormal(normal: boolean) { if (this.menu) { this.normal = normal; this.publish(); } }
  setVolume(bus: 'music' | 'effects', volume: number) { this.audio.setVolume(bus, volume); this.publish(); }
  start() { if (!this.loaded) return; this.menu = false; this.reset(); }
  private reset() {
    this.audio.stopAll(); this.input.clear(); this.world = createEncounter(this.normal, Math.floor(Math.random() * 0xffffffff)); this.accumulator = 0;
    this.lastDirection = { x: 0, z: 0 }; this.trail = this.lastHealth = 800; this.trailDelay = 0;
    this.view.reset(); this.view.update(this.world, 0, this.menu); this.publish();
  }
  restart() { if (!this.menu) this.reset(); }
  returnToMenu() { this.menu = true; this.reset(); this.audio.menu(); this.publish(); }
  togglePause() {
    if (this.menu) return;
    this.input.clear(); setPaused(this.world, !this.world.paused); this.audio.pause(this.world.paused); this.publish();
  }
  sprint() { sprint(this.world); this.consumeEvents(); this.publish(); }
  ability(slot = 0) { activateAbility(this.world, slot); this.refreshAim(); this.consumeEvents(); this.publish(); }
  aim(x: number, z: number) {
    this.input.pointer = this.view.camera.screen(this.view.renderer.domElement, { x, z });
    this.refreshAim(); this.publish();
  }
  fire() { const fired = fireSling(this.world); this.consumeEvents(); this.publish(); return fired; }
  cancelAim() { cancelAim(this.world); this.publish(); }
  zoom(steps: number) { if (!this.menu && !this.world.paused && ['ready', 'playing'].includes(this.world.status)) this.view.camera.zoom(steps); }
  reward(index: number | 'skip') { if (resolveReward(this.world, index)) { this.input.clear(); this.consumeEvents(); this.publish(); } }
  private refreshAim() {
    if (!this.world.abilities.some(a => a.aiming)) return;
    const aim = this.view.camera.aim(this.view.renderer.domElement, this.input.pointer.x, this.input.pointer.y);
    updateAim(this.world, aim.point, aim.onGround);
  }
  private consumeEvents() {
    const events = this.world.events.splice(0); this.audio.events(events); this.view.handleEvents(events, this.world);
    if (events.some(e => e.type === 'wave-cleared' || e.type === 'wave-start' || e.type === 'victory' || e.type === 'defeat')) this.input.clear();
  }
  setRunning(running: boolean) {
    if (this.active === running) return;
    this.active = running;
    if (running) { this.audio.pause(this.world.paused); this.input.attach(); this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
    else { this.input.detach(); cancelAnimationFrame(this.frame); this.accumulator = 0; this.audio.pause(true); cancelAim(this.world); }
    this.publish();
  }
  private tick = (now: number) => {
    if (!this.active || this.destroyed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.loaded && !this.world.paused) {
      if (!this.menu) {
        this.audio.tick(dt); this.refreshAim(); this.accumulator += dt;
        while (this.accumulator >= 1 / 60) {
          const direction = this.input.direction();
          if (Math.hypot(direction.x, direction.z) > 0 && (direction.x !== this.lastDirection.x || direction.z !== this.lastDirection.z)) this.audio.command();
          this.lastDirection = direction;
          stepEncounter(this.world, 1 / 60, direction.x, direction.z); this.consumeEvents(); this.accumulator -= 1 / 60;
        }
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
  describe() {
    return { mounted: true, active: this.active, loaded: this.loaded, error: this.error, menu: this.menu, zoom: this.view.camera.factor,
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
  destroy() { this.setRunning(false); this.destroyed = true; this.audio.destroy(); this.view.destroy(); this.listeners.clear(); }
}
