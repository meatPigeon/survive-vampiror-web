import { createEncounter, describeEncounter, setPaused, stepEncounter } from "./simulation";
import { HordeInput } from "./input";
import { HordeView } from "./view";

export class HordeController {
  world = createEncounter();
  readonly view: HordeView;
  readonly input = new HordeInput(() => this.togglePause(), () => this.restart());
  private active = false;
  private loaded = false;
  private destroyed = false;
  private error: string | null = null;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private notified = 0;
  private listeners = new Set<() => void>();
  private snapshot = this.makeSnapshot();
  readonly ready: Promise<void>;

  constructor(host: HTMLElement) {
    this.view = new HordeView(host);
    this.input.onBlur = () => {
      if (this.world.status === "playing") { setPaused(this.world, true); this.publish(); }
    };
    this.ready = this.view.ready.then(() => {
      if (this.destroyed) return;
      this.loaded = true; this.view.update(this.world, 0); this.publish();
    }).catch(error => {
      if (this.destroyed) return;
      this.error = "The character models could not load. Return to the lobby and reload to retry.";
      console.error("[horde] asset loading failed", error); this.publish();
    });
  }
  private makeSnapshot() {
    return { loaded: this.loaded, error: this.error, status: this.world.status,
      paused: this.world.paused, alive: this.world.zombies.filter(a => a.hp > 0).length,
      knightHp: this.world.knight.hp, phase: this.world.knight.phase, elapsed: this.world.elapsed };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = this.makeSnapshot(); for (const listener of this.listeners) listener(); }
  restart() {
    this.input.clear(); this.world = createEncounter(); this.accumulator = 0;
    this.view.update(this.world, 0); this.publish();
  }
  togglePause() { this.input.clear(); setPaused(this.world, !this.world.paused); this.publish(); }
  setRunning(running: boolean) {
    if (this.active === running) return;
    this.active = running;
    if (running) { this.input.attach(); this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
    else { this.input.detach(); cancelAnimationFrame(this.frame); this.accumulator = 0; }
    this.publish();
  }
  private tick = (now: number) => {
    if (!this.active || this.destroyed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.loaded && !this.world.paused) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) {
        const direction = this.input.direction();
        stepEncounter(this.world, 1 / 60, direction.x, direction.z);
        this.accumulator -= 1 / 60;
      }
      this.view.update(this.world, dt);
    }
    if (now - this.notified >= 100) { this.publish(); this.notified = now; }
    this.frame = requestAnimationFrame(this.tick);
  };
  describe() {
    return { mounted: true, active: this.active, loaded: this.loaded, error: this.error,
      playing: this.active && this.loaded && !this.world.paused && this.world.status === "playing",
      ...describeEncounter(this.world) };
  }
  async move(args?: Record<string, unknown>) {
    const directions: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
      "up-left": [-1, -1], "up-right": [1, -1], "down-left": [-1, 1], "down-right": [1, 1] };
    const direction = directions[String(args?.dir)];
    const ms = Number(args?.ms ?? 500);
    if (!direction || !Number.isFinite(ms)) throw new Error("move needs dir: up|down|left|right|up-left|up-right|down-left|down-right and finite ms.");
    if (!this.active || !this.loaded || this.world.paused || ["won", "lost"].includes(this.world.status)) throw new Error("The encounter must be loaded, active, and unpaused to move.");
    const duration = Math.max(50, Math.min(3000, ms));
    this.input.holdAgent(direction[0], direction[1], duration);
    await new Promise(resolve => setTimeout(resolve, duration));
    return this.describe();
  }
  destroy() { this.setRunning(false); this.destroyed = true; this.view.destroy(); this.listeners.clear(); }
}
