import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MotionAir } from "./motion-air";
import { characterLight } from './material-look';
import { recoveryTime, strikeTime, windupTime } from "./combat";
import { RULES } from "./rules";
import { locationForWave } from '../data/campaign';
import type { Attack, Encounter, Zombie } from "./types";

export function disposeObjects(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
function kindRing(temporary: boolean) {
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ color: temporary ? 0x78dfef : 0xedd9ad, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < (temporary ? 4 : 1); i++) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.39, temporary ? 10 : 48, 1, i * Math.PI / 2 + (temporary ? 0.18 : 0), temporary ? Math.PI / 2 - 0.36 : Math.PI * 2), material);
    mesh.rotation.x = -Math.PI / 2; group.add(mesh);
  }
  group.position.y = 0.035; return { group, material };
}
export class Actor {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly ring: ReturnType<typeof kindRing>;
  private action: THREE.AnimationAction | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private rig: THREE.Object3D;
  private materials: THREE.MeshStandardMaterial[] = [];
  private materialsReady = false;
  private deathTime = 0;
  private biteTime = -1;
  private stride = 0;
  private air: MotionAir;
  private yaw = 0;
  private speed = 0;
  private bank = 0;
  private hitRemaining = 0;
  private hitCooldown = 0;
  private lastHp = Infinity;
  private recoil = 0;
  private deathPose: { rotation: THREE.Euler; position: THREE.Vector3; scale: THREE.Vector3 } | null = null;
  private fuse: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial> | null = null;
  constructor(asset: GLTF, temporary = false, private knight = false, phase = 0) {
    this.model = clone(asset.scene); this.root.add(this.model);
    this.rig = this.model.getObjectByName("CharacterRig") ?? this.model;
    this.air = new MotionAir(this.model.getObjectByName("Visual") ?? this.model, phase, knight ? new THREE.Color(1, 0.96, 0.82) : undefined, knight ? 0.8 : 0.65);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of asset.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.ring = kindRing(temporary); this.root.add(this.ring.group); this.ring.group.visible = !knight;
    this.model.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    this.play("idle", phase);
  }
  private play(name: string, offset = 0) {
    const action = this.actions.get(name); if (!action) return null;
    if (this.action !== action) {
      this.action?.stop(); action.reset().play(); action.time = offset % action.getClip().duration; this.action = action;
    }
    return action;
  }
  slash(spinning: boolean, duration: number, height: number) { this.air.slash(spinning, duration, height); }
  bite() { if (this.deathTime === 0) { this.biteTime = 0; this.play("combat_bite"); } }
  private flash(on: boolean) {
    if (!this.materialsReady) {
      this.model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const cloneMaterial = (material: THREE.Material) => {
          const copy = material.clone(); if (copy instanceof THREE.MeshStandardMaterial) { characterLight(copy, this.knight); this.materials.push(copy); } return copy;
        };
        object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
      });
      this.materialsReady = true;
    }
    for (const material of this.materials) { material.emissive.setHex(on ? 0xffffff : 0); material.emissiveIntensity = on ? 0.8 : 0; }
  }
  private hit(hp: number, dt: number) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (hp < this.lastHp && this.lastHp !== Infinity && (!this.knight || this.hitCooldown <= 0)) {
      this.hitRemaining = 0.18; this.hitCooldown = 0.18;
    }
    this.lastHp = hp; this.hitRemaining = Math.max(0, this.hitRemaining - dt);
    this.flash(hp > 0 && this.hitRemaining > (this.knight ? 0.125 : 0.11));
  }
  updateZombie(a: Zombie, world: Encounter, dt: number) {
    this.root.position.set(a.x, 0, a.z);
    if (this.fuse) this.fuse.visible = false;
    const turn = Math.atan2(Math.sin(a.facing - this.yaw), Math.cos(a.facing - this.yaw));
    const speedTarget = a.moving && !a.locked ? THREE.MathUtils.clamp(a.speed / RULES.speed, 0, 2) : 0;
    this.speed = THREE.MathUtils.lerp(this.speed, speedTarget, 1 - Math.exp(-12 * dt));
    this.bank = THREE.MathUtils.lerp(this.bank, a.moving && this.biteTime < 0 ? THREE.MathUtils.clamp(turn, -1, 1) * speedTarget : 0, 1 - Math.exp(-10 * dt));
    this.yaw += turn * (this.biteTime >= 0 ? 1 : Math.min(10 * dt, 1)); this.root.rotation.y = this.yaw;
    this.hit(a.hp, dt); this.ring.group.visible = a.hp > 0;
    if (a.hp <= 0) {
      this.deathPose ??= { rotation: this.rig.rotation.clone(), position: this.rig.position.clone(), scale: this.rig.scale.clone() };
      this.deathTime += dt; this.mixer.update(0); this.air.clear();
      const t = this.deathTime, pose = this.deathPose;
      if (a.expired) {
        const u = Math.min(1, t / 0.22), back = u * u * (2.70158 * u - 1.70158);
        this.rig.scale.copy(pose.scale).lerp(new THREE.Vector3(1.15, 0.22, 1.15), back);
      } else {
        const u = Math.min(1, t / 0.26) ** 2;
        this.rig.rotation.set(THREE.MathUtils.lerp(pose.rotation.x, 0.18, u), pose.rotation.y * (1 - u), THREE.MathUtils.lerp(pose.rotation.z, (a.id % 2 ? -1 : 1) * 1.55, u));
        this.rig.position.y = t < 0.26 ? THREE.MathUtils.lerp(pose.position.y, 0.5, 1 - (1 - Math.min(1, t / 0.09)) ** 2) : THREE.MathUtils.lerp(0.5, 0.34, bounceOut(Math.min(1, (t - 0.26) / 0.07)));
      }
      const shrinkAt = a.expired ? 0.29 : 0.4;
      if (t > shrinkAt) this.rig.scale.copy(a.expired ? new THREE.Vector3(1.15, 0.22, 1.15) : pose.scale).lerp(new THREE.Vector3(0.03, 0.03, 0.03), Math.min(1, (t - shrinkAt) / 0.2) ** 2);
      this.root.visible = t < shrinkAt + 0.2; return;
    }
    this.deathTime = 0; this.root.visible = true; this.rig.scale.setScalar(1);
    const mine = world.abilities.find(ability => ability.armed.includes(a.id));
    this.ring.material.color.setHex(mine ? 0xef9b53 : a.airborne > 0 || a.locked ? 0x72dbe6 : a.feasting ? 0xc894e8 : a.kind === "temporary" ? 0x78dfef : 0xedd9ad);
    const ringScale = mine ? 1.5 + 0.4 * Math.sin(mine.fuse * 18) : a.locked || a.feasting ? 1.8 : 1;
    this.ring.group.scale.set(ringScale, 1, ringScale);
    this.model.position.y = a.airborne; this.model.rotation.z = a.flightSpin;
    if (mine) {
      // Planted recruits hold a low pose instead of continuing their walking/bite cycle.
      this.biteTime = -1; this.play("idle", a.id * 0.37); this.mixer.update(0); this.air.clear();
      this.rig.rotation.set(0.2, 0, 0); this.rig.position.set(0, 0, 0); this.rig.scale.set(1.08, 0.68, 1.08);
      this.fuse ??= new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffd17a, toneMapped: false }));
      if (!this.fuse.parent) this.root.add(this.fuse);
      this.fuse.position.set(0, 0.83, 0); this.fuse.scale.setScalar(1 + 0.2 * Math.sin(mine.fuse * 18)); this.fuse.visible = true;
      return;
    }
    if (this.biteTime >= 0 && this.biteTime < 0.36) { this.biteTime += dt; this.mixer.update(dt); }
    else {
      this.biteTime = -1; const action = this.play(a.moving ? "run" : "idle", a.id * 0.37);
      if (action) action.timeScale = a.moving ? 1.5 * THREE.MathUtils.clamp(a.speed / RULES.speed, 0.5, 2) : 1;
      this.mixer.update(dt);
      const gait = a.moving ? Math.cos((action?.time ?? 0) / 0.8 * Math.PI * 4) : 0;
      this.recoil = this.hitRemaining > 0 ? Math.sin(this.hitRemaining / 0.18 * Math.PI) : 0;
      const weight = Math.min(this.speed, 1.5);
      this.rig.rotation.set(-0.1 * this.speed + this.recoil * 0.16, 0, -0.1 * this.bank);
      this.rig.position.set(0, Math.max(0, -gait) * 0.1 * weight, this.recoil * 0.13);
      this.rig.scale.set(1 - gait * 0.025 * weight + this.recoil * 0.05, 1 + gait * 0.045 * weight - this.recoil * 0.08, 1 - gait * 0.025 * weight);
    }
    this.air.update(dt, world.sprintRemaining > 0 && a.moving);
  }
  updateKnight(world: Encounter, dt: number) {
    const k = world.knight, mounted = locationForWave(world.wave).knightModel === 3, attacking = ["windup", "strike", "recovery"].includes(k.state);
    this.root.position.set(k.x, 0, k.z); this.root.rotation.y = k.facing;
    this.hit(k.hp, dt);
    const skeleton = this.model.getObjectByName('Skeleton3D');
    if (skeleton) skeleton.position.z = k.hp > 0 ? (attacking ? 0.055 : 0.1) * Math.max(0, (this.hitRemaining - 0.02) / 0.16) ** 2 : 0;
    const horse = this.model.getObjectByName("Horse"), crossbow = this.model.getObjectByName("Crossbow"), halberd = this.model.getObjectByName("Halberd");
    if (horse) horse.visible = mounted;
    const shooting = attacking && k.attack === "crossbow";
    if (crossbow) {
      crossbow.visible = world.wave >= 2; crossbow.position.set(0, 1.65 + (mounted ? 0.65 : 0), shooting ? -0.62 : 0.38);
      crossbow.rotation.set(0, shooting ? 0 : Math.PI / 2, shooting ? 0 : -0.3);
    }
    if (halberd) halberd.visible = !shooting;
    if (k.hp <= 0) {
      this.deathPose ??= { rotation: this.rig.rotation.clone(), position: this.rig.position.clone(), scale: this.rig.scale.clone() };
      this.deathTime += dt; this.air.clear(); this.mixer.update(0);
      const t = this.deathTime, pose = this.deathPose;
      this.rig.rotation.z = t < 0.12 ? THREE.MathUtils.lerp(pose.rotation.z, -0.14, 1 - (1 - t / 0.12) ** 2) : t < 0.46 ? THREE.MathUtils.lerp(-0.14, 1.5, ((t - 0.12) / 0.34) ** 2) : THREE.MathUtils.lerp(1.5, 1.4, 1 - (1 - Math.min(1, (t - 0.46) / 0.12)) ** 2);
      this.rig.position.y = t < 0.12 ? THREE.MathUtils.lerp(pose.position.y, -0.1, t / 0.12) : t < 0.46 ? THREE.MathUtils.lerp(-0.1, 0.1, (t - 0.12) / 0.34) : THREE.MathUtils.lerp(0.1, 0.025, Math.min(1, (t - 0.46) / 0.12));
      return;
    }
    if (attacking) {
      // Reuse the authored skeleton clips, mapping each special's phases into a real pose.
      const fallback: Partial<Record<Attack, Attack>> = { bash: 'sweep', consecration: 'spin', lance: 'charge', firebomb: 'crossbow', shockwave: 'spin' };
      const pose = fallback[k.attack] ?? k.attack;
      const name = [...this.actions.keys()].find(name => name.startsWith(`combat_${pose}_`));
      const action = name ? this.play(name) : null;
      if (action) {
        if (fallback[k.attack]) {
          const clips = action.getClip().name.match(/_(\d+)_(\d+)_(\d+)_(\d+)_(\d+)_(\d+)$/);
          const authored = clips ? [Number(clips[1]) + Number(clips[2]) / 1000, Number(clips[3]) + Number(clips[4]) / 1000, Number(clips[5]) + Number(clips[6]) / 1000] : [1, 0.3, 1];
          const phase = k.state === 'windup' ? 0 : k.state === 'strike' ? 1 : 2;
          const duration = phase === 0 ? windupTime(k.attack) : phase === 1 ? strikeTime(world) : recoveryTime(k.attack);
          action.time = authored.slice(0, phase).reduce((sum, n) => sum + n, 0) + authored[phase]! * Math.min(1, k.timer / duration);
        } else action.time = (k.state === "windup" ? 0 : windupTime(k.attack)) + (k.state === "recovery" ? strikeTime(world) : 0) + Math.min(k.timer, k.state === "recovery" ? recoveryTime(k.attack) : Infinity);
        this.mixer.update(0);
      }
    } else { this.play(mounted ? k.moving ? "combat_mounted_run" : "combat_mounted_idle" : k.moving ? "run" : "idle"); if (this.action) this.action.timeScale = k.moving ? 0.9 : 1; this.mixer.update(dt); }
    this.rig.rotation.set(0, 0, 0); this.rig.position.set(0, 0, 0);
    if (attacking && ['bash', 'consecration', 'lance', 'firebomb', 'shockwave'].includes(k.attack)) {
      const charging = k.state === 'windup', striking = k.state === 'strike';
      if (k.attack === 'bash') this.rig.rotation.x = charging ? 0.13 : striking ? -0.2 : 0;
      if (k.attack === 'consecration') { this.rig.position.y = charging ? 0.12 : 0; this.rig.rotation.x = charging ? -0.08 : 0; }
      if (k.attack === 'lance') { this.rig.rotation.x = charging ? 0.1 : striking ? -0.24 : 0; this.rig.position.z = striking ? 0.18 : 0; }
      if (k.attack === 'firebomb') this.rig.rotation.z = charging ? -0.08 : striking && k.timer < 0.3 ? 0.12 : 0;
      if (k.attack === 'shockwave') this.rig.position.y = charging ? -0.14 : striking ? Math.sin(Math.min(1, k.timer / 0.3) * Math.PI) * 0.18 : 0;
    }
    if (horse) {
      if (k.moving) this.stride += dt * 12;
      ["FrontLeft", "FrontRight", "RearLeft", "RearRight"].forEach((name, i) => {
        const leg = horse.getObjectByName(name); if (leg) leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, k.moving ? Math.sin(this.stride + ([1, 2].includes(i) ? Math.PI : 0)) * 0.6 : 0, 1 - Math.exp(-18 * dt));
      });
      const body = horse.getObjectByName("Body"); if (body) body.position.y = k.moving ? Math.sin(this.stride * 2) * 0.035 : 0;
    }
    this.air.update(dt, mounted && k.moving || k.state === "strike" && ["charge", "rush", "lance"].includes(k.attack), mounted ? 1.6 : 1.15, 1.1);
    this.model.rotation.z = k.attack === "rush" && k.state === "strike" ? -k.rushTurn / (50 * Math.PI / 180) * 0.08 : 0;
  }
  destroy() {
    this.air.destroy(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); this.root.removeFromParent();
    // Geometry and original materials belong to the shared asset cache.
    for (const material of this.materials) material.dispose();
    this.ring.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); this.ring.material.dispose();
    this.fuse?.geometry.dispose(); this.fuse?.material.dispose();
    this.model.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose(); });
  }
}
function bounceOut(t: number) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t - 1.5 / 2.75) ** 2 + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (t - 2.625 / 2.75) ** 2 + 0.984375;
}
