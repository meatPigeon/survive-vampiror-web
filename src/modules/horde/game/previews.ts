import * as THREE from "three";
import { RULES } from "./rules";
import { windupTime } from './combat';
import { distance } from "./math";
import type { Attack, Encounter, Point } from "./types";
export function arc(radius: number, degrees = 360, inner = 0) {
  const positions: number[] = [], segments = inner === 0 ? 32 : 48, start = -degrees * Math.PI / 360;
  for (let i = 0; i < segments; i++) {
    const a = start + degrees * Math.PI / 180 * i / segments, b = start + degrees * Math.PI / 180 * (i + 1) / segments;
    const p = (t: number, r: number) => [Math.sin(t) * r, 0, Math.cos(t) * r];
    positions.push(...p(a, inner), ...p(a, radius), ...p(b, inner), ...p(a, radius), ...p(b, radius), ...p(b, inner));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); return geometry;
}
function rushGeometry() {
  const vertices: number[] = [];
  for (const d of [1, 2.5]) for (const side of [-1, 1]) { const tip = [0, 0, d + 1], inner = [0, 0, d + 0.62], edge = [side, 0, d], inset = [side, 0, d - 0.38]; vertices.push(...tip, ...edge, ...inner, ...inner, ...edge, ...inset); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); return geometry;
}
export function flat(geometry: THREE.BufferGeometry, color: number, opacity = 0.5) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.y = 0.06; return mesh;
}
function warningBorder(attack: Attack, length: number, color: number) {
  const group = new THREE.Group();
  const line = (width: number, depth: number, x: number, z: number, yaw = 0) => {
    const g = new THREE.PlaneGeometry(width, depth); g.rotateX(-Math.PI / 2);
    const mesh = flat(g, color, 0.95); mesh.position.set(x, 0, z); mesh.rotation.y = yaw; group.add(mesh);
  };
  if (attack === 'sweep' || attack === 'spin') {
    const radius = attack === 'spin' ? RULES.spinRadius : RULES.attackRange;
    group.add(flat(arc(radius, attack === 'spin' ? 360 : 160, radius - 0.075), color, 0.95));
    if (attack === 'sweep') for (const angle of [-80, 80].map(d => d * Math.PI / 180)) line(0.06, radius, Math.sin(angle) * radius / 2, Math.cos(angle) * radius / 2, angle);
  } else if (attack !== 'rush') {
    const width = attack === 'crossbow' ? 0.8 : 2;
    for (const x of [-width / 2, width / 2]) line(0.065, length, x, length / 2);
    line(width, 0.065, 0, length); line(width, 0.065, 0, 0);
  }
  group.position.y = 0.075; return group;
}
export class Previews {
  readonly root = new THREE.Group();
  private warning: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private border: THREE.Group | null = null;
  private key = "";
  private aim = new THREE.Group();
  private pulses: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; time: number; duration: number; opacity: number }[] = [];
  constructor() {
    this.aim.add(flat(arc(RULES.slingSpread), 0x72dbe6, 0.2), flat(arc(RULES.slingSpread, 360, RULES.slingSpread - 0.09), 0x72dbe6, 0.9));
    this.root.add(this.aim); this.aim.visible = false;
  }
  pulse(p: Point, radius: number, color: number, duration = 0.3, opacity = 0.35) {
    const mesh = flat(arc(radius, 360, radius * 0.84), color, Math.min(1, opacity * 2)); mesh.position.set(p.x, 0.085, p.z); this.root.add(mesh); this.pulses.push({ mesh, time: 0, duration, opacity: Math.min(1, opacity * 2) });
  }
  update(world: Encounter, dt: number) {
    const k = world.knight, visible = k.state === "windup" || k.state === "strike", key = `${world.wave}:${k.attackNumber}:${k.attack}`;
    if (this.key !== key) {
      this.key = key;
      this.clearWarning();
      const lane = (length: number, width: number) => { const g = new THREE.PlaneGeometry(width, length); g.rotateX(-Math.PI / 2); g.translate(0, 0, length / 2); return g; };
      const color = { sweep: 0xff7845, charge: 0xffd56a, spin: 0xd891ff, crossbow: 0x7eeaff, rush: 0xff775e }[k.attack];
      const length = k.attack === 'charge' ? distance(k.origin, k.chargeEnd) : RULES.crossbowRange;
      this.warning = flat(k.attack === "sweep" ? arc(RULES.attackRange, 160) : k.attack === "spin" ? arc(RULES.spinRadius) : k.attack === "rush" ? rushGeometry() : lane(length, k.attack === "crossbow" ? 0.8 : 2), color, 0.3);
      this.border = warningBorder(k.attack, length, color); this.root.add(this.warning, this.border);
    }
    if (this.warning) {
      this.warning.visible = visible && world.status === "playing" && !world.betweenWaves;
      this.warning.material.opacity = k.attack === 'rush' ? 0.78 : k.state === 'strike' ? 0.58 : 0.2 + Math.min(1, k.timer / windupTime(k.attack)) * 0.18;
      const p = k.attack === "rush" && k.state === "strike" ? k : k.origin;
      this.warning.position.set(p.x, 0.05, p.z); this.warning.rotation.y = Math.atan2(k.direction.x, k.direction.z);
      if (this.border) { this.border.visible = this.warning.visible; this.border.position.set(p.x, 0.075, p.z); this.border.rotation.y = this.warning.rotation.y; }
    }
    const aiming = world.abilities.find(a => a.aiming);
    this.aim.visible = !!aiming && aiming.aimOnGround;
    if (aiming) { this.aim.position.set(aiming.aim.x, 0, aiming.aim.z); this.aim.traverse(o => { if (o instanceof THREE.Mesh) o.material.color.setHex(aiming.aimValid ? 0x72dbe6 : 0xe89b88); }); }
    for (const pulse of this.pulses) { pulse.time += dt; const t = Math.min(1, pulse.time / pulse.duration); pulse.mesh.material.opacity = pulse.opacity * (1 - t); pulse.mesh.scale.setScalar(0.45 + t * 0.55); }
    this.pulses = this.pulses.filter(p => { if (p.time < p.duration) return true; p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); return false; });
  }
  private clearWarning() {
    if (this.warning) { this.warning.removeFromParent(); this.warning.geometry.dispose(); this.warning.material.dispose(); this.warning = null; }
    this.border?.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose(); } }); this.border?.removeFromParent(); this.border = null;
  }
  reset() { for (const p of this.pulses) { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); } this.pulses = []; this.key = ""; this.clearWarning(); }
}
