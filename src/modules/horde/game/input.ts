import { DEFAULT_BINDINGS, type Bindings, type ControlAction } from '../data/controls';
export class HordeInput {
  private keys = new Set<string>();
  private touch = new Map<number, string>();
  private agent = { x: 0, z: 0 };
  private agentUntil = 0;
  onBlur?: () => void;
  onSprint?: () => void;
  onAbility?: (slot: number) => void;
  onFire?: () => void;
  onCancel?: () => void;
  onZoom?: (steps: number) => void;
  onGesture?: () => void;
  onDirection?: (x: number, z: number) => void;
  onStop?: () => void;
  bindings: Bindings = { ...DEFAULT_BINDINGS };
  enabled = () => true;
  pointer = { x: 0, y: 0 };
  constructor(private toggle: () => void, private restart: () => void, private canvas?: HTMLCanvasElement) {}
  private down = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement)?.closest('input, textarea, select')) return;
    // Some virtual keyboards deliver Escape with an empty/unidentified physical code.
    const code = event.key === 'Escape' || event.key === 'Esc' ? 'Escape' : event.code;
    if (event.code === "Space" && (event.target as HTMLElement)?.closest("button")) return;
    const controls = [...Object.values(this.bindings), 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Escape'];
    if (!controls.includes(code)) return;
    event.preventDefault(); this.onGesture?.(); if (event.repeat) return;
    if (code === 'Escape' || code === this.bindings.pause) this.toggle();
    else if (code === this.bindings.restart) this.restart();
    else if (this.enabled()) {
      if (code === this.bindings.sprint) this.onSprint?.();
      else if (code === this.bindings.stop) { this.clear(); this.onStop?.(); }
      else if (code === this.bindings.ability1 || code === this.bindings.ability2) this.onAbility?.(code === this.bindings.ability1 ? 0 : 1);
      else { this.keys.add(code); this.changed(); }
    }
  };
  // Releases are processed even when focused UI consumes the corresponding press.
  private up = (event: KeyboardEvent) => { this.keys.delete(event.code); this.changed(); };
  private hidden = () => { if (document.hidden) this.blur(); };
  private blur = () => { this.clear(); this.onBlur?.(); };
  private point = (event: PointerEvent) => { this.pointer = { x: event.clientX, y: event.clientY }; };
  private click = (event: PointerEvent) => {
    this.point(event); this.onGesture?.(); if (!this.enabled()) return;
    if (event.button === 0) this.onFire?.(); else if (event.button === 2) this.onCancel?.();
  };
  private context = (event: Event) => event.preventDefault();
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.pointer = { x: event.clientX, y: event.clientY }; this.onZoom?.(-Math.sign(event.deltaY)); };
  attach() {
    window.addEventListener('keydown', this.down); window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur); document.addEventListener('visibilitychange', this.hidden);
    window.addEventListener('pointermove', this.point); this.canvas?.addEventListener('pointerdown', this.click);
    this.canvas?.addEventListener('contextmenu', this.context); this.canvas?.addEventListener('wheel', this.wheel, { passive: false });
  }
  detach() {
    this.clear(); window.removeEventListener('keydown', this.down); window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.hidden);
    window.removeEventListener('pointermove', this.point); this.canvas?.removeEventListener('pointerdown', this.click);
    this.canvas?.removeEventListener('contextmenu', this.context); this.canvas?.removeEventListener('wheel', this.wheel);
  }
  clear() { this.keys.clear(); this.touch.clear(); this.agent = { x: 0, z: 0 }; this.agentUntil = 0; }
  holdTouch(id: number, direction: string) { if (this.enabled()) { this.touch.set(id, direction); this.changed(); } }
  releaseTouch(id: number) { this.touch.delete(id); this.changed(); }
  holdAgent(x: number, z: number, ms: number) { this.agent = { x, z }; this.agentUntil = performance.now() + ms; this.changed(); }
  private changed() { const { x, z } = this.direction(); this.onDirection?.(x, z); }
  direction() {
    if (!this.enabled()) return { x: 0, z: 0 };
    const held = (action: ControlAction, arrow: string) => this.keys.has(this.bindings[action]) || (!Object.values(this.bindings).includes(arrow) && this.keys.has(arrow)) || [...this.touch.values()].includes(action);
    const agent = performance.now() < this.agentUntil ? this.agent : { x: 0, z: 0 };
    const x = Number(held('right', 'ArrowRight')) - Number(held('left', 'ArrowLeft')) + agent.x;
    const z = Number(held('down', 'ArrowDown')) - Number(held('up', 'ArrowUp')) + agent.z;
    const length = Math.hypot(x, z); return length > 1 ? { x: x / length, z: z / length } : { x, z };
  }
}
