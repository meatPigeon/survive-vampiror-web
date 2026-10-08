import * as THREE from "three";
import { RULES } from "./rules";
import { distance } from "./math";
import type { Encounter, Point } from "./types";
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
export class Previews {
  readonly root = new THREE.Group();
  private warning: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private key = "";
  private aim = new THREE.Group();
  private pulses: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; time: number; duration: number; opacity: number }[] = [];
  constructor() {
    this.aim.add(flat(arc(RULES.slingSpread), 0x72dbe6, 0.2), flat(arc(RULES.slingSpread, 360, RULES.slingSpread - 0.09), 0x72dbe6, 0.9));
    this.root.add(this.aim); this.aim.visible = false;
  }
  pulse(p: Point, radius: number, color: number, duration = 0.3, opacity = 0.35) {
    const mesh = flat(arc(radius), color, opacity); mesh.position.set(p.x, 0.065, p.z); this.root.add(mesh); this.pulses.push({ mesh, time: 0, duration, opacity });
  }
  update(world: Encounter, dt: number) {
    const k = world.knight, visible = k.state === "windup" || k.state === "strike", key = `${world.wave}:${k.attackNumber}:${k.attack}`;
    if (this.key !== key) {
      this.key = key;
      if (this.warning) { this.warning.removeFromParent(); this.warning.geometry.dispose(); this.warning.material.dispose(); }
      const lane = (length: number, width: number) => { const g = new THREE.PlaneGeometry(width, length); g.rotateX(-Math.PI / 2); g.translate(0, 0, length / 2); return g; };
      this.warning = flat(k.attack === "sweep" ? arc(RULES.attackRange, 160) : k.attack === "spin" ? arc(RULES.spinRadius) : k.attack === "rush" ? rushGeometry() : lane(k.attack === "charge" ? distance(k.origin, k.chargeEnd) : RULES.crossbowRange, k.attack === "crossbow" ? 0.8 : 2), { sweep: 0xff4d14, charge: 0xffcc1a, spin: 0xcc33ff, crossbow: 0x4dd9ff, rush: 0xff5238 }[k.attack], k.attack === "spin" ? 0.45 : k.attack === "rush" ? 0.72 : 0.5);
      this.root.add(this.warning);
    }
    if (this.warning) {
      this.warning.visible = visible && world.status === "playing" && !world.betweenWaves;
      const p = k.attack === "rush" && k.state === "strike" ? k : k.origin;
      this.warning.position.set(p.x, 0.05, p.z); this.warning.rotation.y = Math.atan2(k.direction.x, k.direction.z);
    }
    const aiming = world.abilities.find(a => a.aiming);
    this.aim.visible = !!aiming && aiming.aimOnGround;
    if (aiming) { this.aim.position.set(aiming.aim.x, 0, aiming.aim.z); this.aim.traverse(o => { if (o instanceof THREE.Mesh) o.material.color.setHex(aiming.aimValid ? 0x72dbe6 : 0xe89b88); }); }
    for (const pulse of this.pulses) { pulse.time += dt; pulse.mesh.material.opacity = pulse.opacity * Math.max(0, 1 - pulse.time / pulse.duration); }
    this.pulses = this.pulses.filter(p => { if (p.time < p.duration) return true; p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); return false; });
  }
  reset() { for (const p of this.pulses) { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); } this.pulses = []; this.key = ""; }
}
