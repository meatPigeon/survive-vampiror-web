export class HordeInput {
  private keys = new Set<string>();
  private touch = new Map<number, string>();
  private agent = { x: 0, z: 0 };
  private agentUntil = 0;
  constructor(privateToggle: () => void, privateRestart: () => void) {
    this.toggle = privateToggle; this.restart = privateRestart;
  }
  private toggle: () => void;
  private restart: () => void;
  private down = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest("input, textarea, select")) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Escape", "KeyR"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat && event.code === "Escape") this.toggle();
      else if (!event.repeat && event.code === "KeyR") this.restart();
      else this.keys.add(event.code);
    }
  };
  private up = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private hidden = () => { if (document.hidden) this.blur(); };
  private blur = () => { this.clear(); this.onBlur?.(); };
  onBlur?: () => void;
  attach() {
    window.addEventListener("keydown", this.down); window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur); document.addEventListener("visibilitychange", this.hidden);
  }
  detach() {
    this.clear(); window.removeEventListener("keydown", this.down); window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur); document.removeEventListener("visibilitychange", this.hidden);
  }
  clear() { this.keys.clear(); this.touch.clear(); this.agent = { x: 0, z: 0 }; this.agentUntil = 0; }
  holdTouch(id: number, direction: string) { this.touch.set(id, direction); }
  releaseTouch(id: number) { this.touch.delete(id); }
  // Bounded agent intents join the same direction read by the fixed-step simulation.
  holdAgent(x: number, z: number, ms: number) { this.agent = { x, z }; this.agentUntil = performance.now() + ms; }
  direction() {
    const held = (codes: string[], direction: string) => codes.some(code => this.keys.has(code)) || [...this.touch.values()].includes(direction);
    const agent = performance.now() < this.agentUntil ? this.agent : { x: 0, z: 0 };
    return {
      x: Number(held(["KeyD", "ArrowRight"], "right")) - Number(held(["KeyA", "ArrowLeft"], "left")) + agent.x,
      z: Number(held(["KeyS", "ArrowDown"], "down")) - Number(held(["KeyW", "ArrowUp"], "up")) + agent.z,
    };
  }
}
