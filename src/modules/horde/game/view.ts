import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { RULES, type Encounter } from "./simulation";

interface Actor {
  root: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction; run: THREE.AnimationAction; running: boolean;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  deadFor: number;
}
export class HordeView {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-18, 18, 13, -13, 0.1, 100);
  private actors: Actor[] = [];
  private knight: Actor | null = null;
  private warning = new THREE.Group();
  private observer: ResizeObserver;
  private destroyed = false;
  readonly ready: Promise<void>;

  constructor(host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x101c25);
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";
    this.renderer.domElement.setAttribute("aria-label", "Horde arena: move with WASD or the direction buttons");
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 28, 24); this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xddefff, 0x465541, 2.6));
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.8);
    sun.position.set(-8, 16, 6); this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.35, 22),
      new THREE.MeshStandardMaterial({ color: 0x394b42, roughness: 1 }));
    floor.position.y = -0.19; this.scene.add(floor);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(floor.geometry),
      new THREE.LineBasicMaterial({ color: 0x9ba789 }));
    edge.position.copy(floor.position); this.scene.add(edge);
    const grid = new THREE.GridHelper(30, 15, 0x687665, 0x485d50);
    grid.scale.z = 22 / 30; grid.position.y = 0.005; this.scene.add(grid);
    const stoneGeometry = new THREE.DodecahedronGeometry(1, 0);
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x69746d, roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      const side = i % 2 ? -1 : 1;
      stone.position.set(side * (16.8 + (i % 3) * 0.4), 0.1, -10 + i * 1.6);
      stone.scale.set(0.7 + (i % 3) * 0.3, 0.6, 1.1); stone.rotation.y = i;
      this.scene.add(stone);
    }
    const cone = new THREE.Mesh(new THREE.RingGeometry(0, RULES.attackRange, 40, 1,
      -Math.PI / 2 - 80 * Math.PI / 180, 160 * Math.PI / 180),
      new THREE.MeshBasicMaterial({ color: 0xff914d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = -Math.PI / 2; cone.position.y = 0.03;
    this.warning.add(cone); this.scene.add(this.warning);
    this.warning.visible = false;
    this.observer = new ResizeObserver(() => this.resize(host));
    this.observer.observe(host); this.resize(host);
    this.ready = this.loadActors();
  }
  private resize(host: HTMLElement) {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const aspect = width / height, halfHeight = Math.max(13.5, 18 / aspect);
    this.camera.left = -halfHeight * aspect; this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
    this.render();
  }
  private createActor(asset: GLTF, scale: number, color: number): Actor {
    const root = new THREE.Group(), model = clone(asset.scene);
    model.scale.setScalar(scale); model.rotation.y = Math.PI; root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const idleClip = asset.animations.find(clip => clip.name === "idle")!;
    const runClip = asset.animations.find(clip => clip.name === "run")!;
    const idle = mixer.clipAction(idleClip), run = mixer.clipAction(runClip);
    idle.play(); run.play(); run.setEffectiveWeight(0); run.timeScale = 1.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.36, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; root.add(ring);
    this.scene.add(root);
    return { root, model, mixer, idle, run, running: false, ring, deadFor: 0 };
  }
  private async loadActors() {
    const loader = new GLTFLoader();
    const assets = await Promise.all([
      loader.loadAsync(new URL("../assets/zombie.glb", import.meta.url).href),
      loader.loadAsync(new URL("../assets/medieval_knight.glb", import.meta.url).href),
    ]);
    if (this.destroyed) { for (const asset of assets) disposeObjects(asset.scene); return; }
    this.actors = Array.from({ length: RULES.count }, () => this.createActor(assets[0]!, 0.48, 0xdce8a4));
    this.knight = this.createActor(assets[1]!, 0.65, 0xffb37c);
    this.knight.ring.scale.setScalar(1.6);
  }
  private animate(actor: Actor, x: number, z: number, facing: number, moving: boolean, hp: number, flash: number, deadFor: number, dt: number) {
    actor.root.position.set(x, 0, z); actor.root.rotation.set(0, facing, 0);
    actor.deadFor = hp <= 0 ? Math.max(deadFor, actor.deadFor + dt) : 0;
    actor.root.visible = hp > 0 || actor.deadFor < 0.6;
    const collapse = hp <= 0 ? Math.min(1, actor.deadFor / 0.6) : 0;
    actor.model.rotation.z = collapse * Math.PI / 2;
    actor.root.scale.setScalar(1 - collapse * 0.95);
    actor.ring.material.opacity = flash > 0 ? 1 : 0.55 + hp / RULES.zombieHealth * 0.2;
    actor.ring.material.color.setHex(flash > 0 ? 0xff634a : actor === this.knight ? 0xffb37c : 0xdce8a4);
    actor.idle.setEffectiveWeight(moving ? 0 : 1); actor.run.setEffectiveWeight(moving ? 1 : 0);
    actor.mixer.update(dt);
  }
  update(world: Encounter, dt: number) {
    for (const a of world.zombies) {
      const actor = this.actors[a.id];
      if (actor) this.animate(actor, a.x, a.z, a.facing, a.moving, a.hp, a.flash, a.deadFor, dt);
    }
    const k = world.knight;
    if (this.knight) {
      this.animate(this.knight, k.x, k.z, k.facing, k.moving, k.hp, k.flash, world.status === "won" ? 0.3 : 0, dt);
      // A readable anticipation / swing using the existing idle/run rig.
      this.knight.model.rotation.z = k.hp === 0 ? Math.PI / 2 : k.phase === "windup" ? -0.12 : k.phase === "recovery" && k.timer > 1.15 ? 0.24 : 0;
      this.knight.root.scale.setScalar(1);
      this.knight.root.visible = true;
      this.knight.ring.material.opacity = 0.8;
    }
    this.warning.visible = world.status === "playing" && k.phase === "windup";
    this.warning.position.set(k.x, 0, k.z); this.warning.rotation.y = k.facing;
    this.render();
  }
  render() { if (!this.destroyed) this.renderer.render(this.scene, this.camera); }
  capture(): Promise<Blob | null> {
    if (this.destroyed) return Promise.resolve(null);
    this.render(); return new Promise(resolve => this.renderer.domElement.toBlob(resolve, "image/png"));
  }
  destroy() {
    this.destroyed = true; this.observer.disconnect();
    for (const actor of [...this.actors, ...(this.knight ? [this.knight] : [])]) {
      actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.model);
    }
    disposeObjects(this.scene); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function disposeObjects(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
