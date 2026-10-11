import * as THREE from "three";
import { RULES } from "./rules";
import { windupTime } from './combat';
import { distance } from "./math";
import { SPECIALS, shockwaveRadius } from './knight-specials';
import type { Attack, Encounter, Point } from "./types";
const COLORS: Record<Attack, number> = { sweep: 0xff7845, charge: 0xffd56a, spin: 0xd891ff, crossbow: 0x7eeaff, rush: 0xff775e, bash: 0xff995f, consecration: 0xffefad, lance: 0xa0cfff, firebomb: 0xff632e, shockwave: 0xff9dbb };
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
  if (attack === 'sweep' || attack === 'spin' || attack === 'bash' || attack === 'consecration' || attack === 'firebomb' || attack === 'shockwave') {
    const radius = attack === 'spin' ? RULES.spinRadius : attack === 'bash' ? SPECIALS.bash.range : attack === 'consecration' || attack === 'firebomb' ? SPECIALS[attack].radius : attack === 'shockwave' ? SPECIALS.shockwave.range + SPECIALS.shockwave.width / 2 : RULES.attackRange;
    const degrees = attack === 'sweep' ? 160 : attack === 'bash' ? SPECIALS.bash.degrees : 360;
    if (attack === 'consecration') {
      // A dark inner rim keeps the pale gold warning readable on limestone.
      // Both rings end at the exact danger radius; the warning never suggests extra reach.
      const contrast = flat(arc(radius, degrees, radius - 0.22), 0x583e20, 0.95);
      contrast.position.y = 0.035; group.add(contrast);
    }
    group.add(flat(arc(radius, degrees, radius - 0.075), color, 0.95));
    if (degrees < 360) for (const angle of [-degrees / 2, degrees / 2].map(d => d * Math.PI / 180)) line(0.06, radius, Math.sin(angle) * radius / 2, Math.cos(angle) * radius / 2, angle);
  } else if (attack !== 'rush') {
    const width = attack === 'crossbow' ? RULES.boltRadius * 2 : attack === 'lance' ? SPECIALS.lance.width : RULES.chargeWidth;
    for (const x of [-width / 2, width / 2]) line(0.065, length, x, length / 2);
    line(width, 0.065, 0, length); line(width, 0.065, 0, 0);
  }
  group.position.y = 0.075; return group;
}
function laneGeometry(length: number, width: number) {
  const geometry = new THREE.PlaneGeometry(width, length); geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, length / 2); return geometry;
}
function warningGeometry(world: Encounter) {
  const k = world.knight;
  switch (k.attack) {
    case 'sweep': return arc(RULES.attackRange, 160);
    case 'spin': return arc(RULES.spinRadius);
    case 'rush': return rushGeometry();
    case 'charge': return laneGeometry(distance(k.origin, k.chargeEnd), RULES.chargeWidth);
    case 'crossbow': return laneGeometry(RULES.crossbowRange, RULES.boltRadius * 2);
    case 'bash': return arc(SPECIALS.bash.range, SPECIALS.bash.degrees);
    case 'lance': return laneGeometry(SPECIALS.lance.range, SPECIALS.lance.width);
    case 'consecration': case 'firebomb': return arc(SPECIALS[k.attack].radius);
    case 'shockwave': return arc(SPECIALS.shockwave.range + SPECIALS.shockwave.width / 2);
  }
}
function updateShockwaveGeometry(geometry: THREE.BufferGeometry, timer: number, striking: boolean) {
  const position = geometry.getAttribute('position'), segments = position.count / 6;
  const radius = shockwaveRadius(timer), half = SPECIALS.shockwave.width / 2;
  const outer = striking ? radius + half : SPECIALS.shockwave.range + half, inner = striking ? Math.max(0, radius - half) : 0;
  for (let i = 0; i < segments; i++) {
    const a = -Math.PI + Math.PI * 2 * i / segments, b = -Math.PI + Math.PI * 2 * (i + 1) / segments;
    const point = (v: number, angle: number, r: number) => position.setXYZ(i * 6 + v, Math.sin(angle) * r, 0, Math.cos(angle) * r);
    point(0, a, inner); point(1, a, outer); point(2, b, inner);
    point(3, a, outer); point(4, b, outer); point(5, b, inner);
  }
  position.needsUpdate = true;
  // The geometry always fits the original disk; avoid rebuilding its bound every frame.
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
      const color = COLORS[k.attack];
      const length = k.attack === 'charge' ? distance(k.origin, k.chargeEnd) : k.attack === 'lance' ? SPECIALS.lance.range : RULES.crossbowRange;
      this.warning = flat(warningGeometry(world), color, 0.3);
      this.warning.geometry.computeBoundingSphere();
      this.border = warningBorder(k.attack, length, color); this.root.add(this.warning, this.border);
    }
    if (this.warning) {
      this.warning.visible = visible && world.status === "playing" && !world.betweenWaves;
      this.warning.material.opacity = k.attack === 'rush' ? 0.78 : k.state === 'strike' ? k.attack === 'firebomb' ? 0.45 + Math.sin(k.timer * 15) * 0.1 : 0.58 : 0.2 + Math.min(1, k.timer / windupTime(k.attack)) * 0.18;
      const p = k.attack === 'consecration' || k.attack === 'firebomb' ? k.target : k.attack === "rush" && k.state === "strike" ? k : k.origin;
      this.warning.position.set(p.x, 0.05, p.z); this.warning.rotation.y = Math.atan2(k.direction.x, k.direction.z);
      if (k.attack === 'shockwave') updateShockwaveGeometry(this.warning.geometry, k.timer, k.state === 'strike');
      if (this.border) { this.border.visible = this.warning.visible && !(k.attack === 'shockwave' && k.state === 'strike'); this.border.position.set(p.x, 0.075, p.z); this.border.rotation.y = this.warning.rotation.y; }
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
  reset() { for (const p of this.pulses) { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); } this.pulses = []; this.key = ""; this.aim.visible = false; this.clearWarning(); }
}
