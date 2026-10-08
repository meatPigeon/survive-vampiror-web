import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { siteIndicator } from "./site-indicator";
import { Actor, disposeObjects } from "./actors";
import { ArenaCamera } from "./camera";
import { Previews } from "./previews";
import { characterLight, moonlight, terrainMaterial } from './material-look';
import { Graveyard } from './graveyard';
import { CombatEffects } from './effects';
import { strikeTime } from './combat';
import { RULES, SITES } from "./rules";
import type { Encounter, GameEvent } from "./types";

const urls = {
  permanent: new URL('../assets/reference/permanent_zombie.glb', import.meta.url).href,
  temporary: new URL('../assets/reference/temporary_zombie.glb', import.meta.url).href,
  knight1: new URL('../assets/reference/knight_wave1.glb', import.meta.url).href,
  knight2: new URL('../assets/reference/knight_wave2.glb', import.meta.url).href,
  knight3: new URL('../assets/reference/knight_wave3.glb', import.meta.url).href,
  environment: new URL('../assets/reference/arena_environment.glb', import.meta.url).href,
  menu: new URL('../assets/reference/menu_diorama.glb', import.meta.url).href,
  crater: new URL('../assets/reference/recruitment_crater.glb', import.meta.url).href,
  grave: new URL('../assets/reference/tombstone.glb', import.meta.url).href,
};
interface SiteVisual { root: THREE.Group; graves: THREE.Object3D[]; track: THREE.Mesh; fill: THREE.Mesh; marker: THREE.Mesh; geometry: (fraction: number) => THREE.BufferGeometry; active: boolean; elapsed: number; }
export class HordeView {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  readonly camera = new ArenaCamera();
  private scene = new THREE.Scene();
  private menu = new THREE.Scene();
  private menuCamera = new THREE.OrthographicCamera(-1, 1, 4.9, -4.9, 0.05, 100);
  private menuMixer: THREE.AnimationMixer | null = null;
  private assets = new Map<keyof typeof urls, GLTF>();
  private actors = new Map<number, Actor>();
  private knight: Actor | null = null;
  private wave = 0;
  private previews = new Previews();
  private terrain = terrainMaterial();
  private graveyard: Graveyard | null = null;
  private effects = new CombatEffects();
  private sites: SiteVisual[] = [];
  private bolt = new THREE.Group();
  private observer: ResizeObserver;
  private destroyed = false;
  private width = 1;
  private height = 1;
  private inMenu = true;
  readonly ready: Promise<void>;
  constructor(host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    this.renderer.domElement.setAttribute('aria-label', 'Horde arena'); host.appendChild(this.renderer.domElement);
    moonlight(this.scene); this.scene.add(this.effects.root);
    this.menu.background = new THREE.Color(0x132724);
    for (const [size, y] of [[200, -0.02], [60, 0]] as const) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size === 60 ? 44 : size), this.terrain.material);
      ground.rotation.x = -Math.PI / 2; ground.position.y = y; ground.receiveShadow = true; this.scene.add(ground);
    }
    this.scene.add(this.previews.root);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), new THREE.MeshStandardMaterial({ color: 0xb2afa0 }));
    shaft.rotation.x = Math.PI / 2; this.bolt.add(shaft); this.bolt.visible = false; this.scene.add(this.bolt);
    this.observer = new ResizeObserver(() => this.resize(host)); this.observer.observe(host); this.resize(host);
    this.ready = this.load();
  }
  private async load() {
    const loader = new GLTFLoader();
    const assets = await Promise.all(Object.entries(urls).map(async ([key, url]) => [key as keyof typeof urls, await loader.loadAsync(url)] as const));
    if (this.destroyed) { for (const [, asset] of assets) disposeObjects(asset.scene); return; }
    for (const [key, asset] of assets) this.assets.set(key, asset);
    const environment = this.assets.get('environment')!.scene; this.scene.add(environment);
    // Replace the exported overlapping flat patches with one continuous procedural surface.
    const patches = environment.getObjectByName('GroundPatches'); if (patches) patches.visible = false;
    environment.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.graveyard = new Graveyard(this.assets.get('grave')!.scene); this.scene.add(this.graveyard.root);
    const menu = this.assets.get('menu')!; this.menu.add(menu.scene);
    menu.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.menu.add(new THREE.HemisphereLight(0xbce9e2, 0x7e6242, 1.1));
    menu.scene.traverse(o => {
      if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof THREE.MeshStandardMaterial) characterLight(m, false);
      }
    });
    const sourceCamera = menu.cameras[0];
    if (sourceCamera) { sourceCamera.updateWorldMatrix(true, false); sourceCamera.getWorldPosition(this.menuCamera.position); sourceCamera.getWorldQuaternion(this.menuCamera.quaternion); }
    else { this.menuCamera.position.set(5, 6, 12); this.menuCamera.lookAt(0, 1, 0); }
    this.menuMixer = new THREE.AnimationMixer(menu.scene);
    for (const clip of menu.animations.filter(c => /idle/.test(c.name))) this.menuMixer.clipAction(clip).play();
    this.sites = SITES.map(site => {
      const root = new THREE.Group(); root.position.set(site.x, 0, site.z); root.add(this.assets.get('crater')!.scene.clone(true));
      const graves = [[-1.3, -1.25, -18, -6], [0, -1.65, 5, 3], [1.3, -1.2, 18, 8]].map(([x, z, yaw, lean]) => {
        const grave = this.assets.get('grave')!.scene.clone(true); grave.position.set(x!, 0.055, z!); grave.rotation.set(0, yaw! * Math.PI / 180, lean! * Math.PI / 180); root.add(grave); grave.visible = false; return grave;
      });
      const { track, fill, marker, geometry } = siteIndicator();
      for (const mesh of [track, fill, marker]) root.add(mesh);
      this.scene.add(root); return { root, graves, track, fill, marker, geometry, active: false, elapsed: 0 };
    });
  }
  private resize(host: HTMLElement) {
    this.width = Math.max(1, host.clientWidth); this.height = Math.max(1, host.clientHeight);
    this.camera.resize(this.width, this.height); const aspect = this.width * 0.66 / this.height;
    this.menuCamera.left = -4.9 * aspect; this.menuCamera.right = 4.9 * aspect; this.menuCamera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false); this.render();
  }
  reset() {
    for (const actor of this.actors.values()) actor.destroy(); this.actors.clear(); this.knight?.destroy(); this.knight = null; this.wave = 0;
    this.camera.reset(); this.previews.reset(); this.effects.reset(); this.terrain.active.value.fill(0);
    for (const site of this.sites) { site.active = false; site.elapsed = 0; for (const grave of site.graves) grave.visible = false; site.track.visible = false; site.fill.visible = false; site.marker.visible = false; }
  }
  handleEvents(events: GameEvent[], world: Encounter) {
    for (const event of events) {
      this.effects.event(event);
      if (event.type === 'recruited') {
        const recruit = world.zombies.at(-1); if (recruit) this.effects.burst(recruit, 0x9bf0bb, 18, 2);
      }
      if (event.type === 'attack-struck' && (event.attack === 'sweep' || event.attack === 'spin')) this.knight?.slash(event.attack === 'spin', strikeTime(world), 1.1 + (world.wave >= 3 ? 0.65 : 0));
      if (event.type === 'bite') {
        const zombie = world.zombies.find(a => a.hp > 0 && a.x === event.x && a.z === event.z); if (zombie) this.actors.get(zombie.id)?.bite();
      }
      if (['blast', 'sling-landing', 'sling-impact'].includes(event.type)) this.previews.pulse({ x: event.x!, z: event.z! }, event.radius!, event.type === 'blast' ? 0xff7326 : 0x4dd9e6, event.type === 'sling-landing' ? 0.8 : 0.3, event.type === 'sling-landing' ? 0.22 : 0.35);
    }
  }
  update(world: Encounter, dt: number, menu = false) {
    this.inMenu = menu;
    if (menu) { this.menuMixer?.update(dt); this.render(); return; }
    if (!this.assets.size) return;
    const ids = new Set(world.zombies.map(a => a.id));
    for (const [id, actor] of this.actors) if (!ids.has(id)) { actor.destroy(); this.actors.delete(id); }
    for (const a of world.zombies) {
      let actor = this.actors.get(a.id);
      if (!actor) { actor = new Actor(this.assets.get(a.kind === 'temporary' ? 'temporary' : 'permanent')!, a.kind === 'temporary', false, a.id * 0.37); this.actors.set(a.id, actor); this.scene.add(actor.root); }
      actor.updateZombie(a, world, dt);
    }
    if (this.wave !== world.wave) {
      this.knight?.destroy(); this.wave = world.wave; this.knight = new Actor(this.assets.get(`knight${world.wave}` as keyof typeof urls)!, false, true); this.scene.add(this.knight.root);
    }
    this.knight?.updateKnight(world, dt); this.camera.update(world, dt); this.previews.update(world, dt);
    this.graveyard?.update(dt);
    this.effects.update(dt, this.height * this.renderer.getPixelRatio() / (this.camera.camera.top - this.camera.camera.bottom));
    const bolt = world.knight.bolt; this.bolt.visible = bolt.flying; this.bolt.position.set(bolt.x, world.wave >= 3 ? 1.7 : 1.2, bolt.z); this.bolt.rotation.y = Math.atan2(bolt.direction.x, bolt.direction.z);
    this.sites.forEach((site, index) => {
      const active = world.activeSite === index;
      if (active !== site.active) { site.active = active; site.elapsed = 0; }
      site.elapsed += dt; site.track.visible = active; site.marker.visible = active; site.fill.visible = active && world.siteProgress > 0;
      this.terrain.active.value[index] = THREE.MathUtils.lerp(this.terrain.active.value[index]!, active ? 1 : 0, 1 - Math.exp(-4 * dt));
      if (site.fill.visible) { site.fill.geometry.dispose(); site.fill.geometry = site.geometry(Math.min(1, world.siteProgress / RULES.summonTime)); }
      site.graves.forEach((grave, i) => {
        const t = THREE.MathUtils.clamp((site.elapsed - i * 0.09) / (active ? 0.55 : 0.4), 0, 1);
        const eased = active ? 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2 : t * t;
        grave.rotation.x = 0.12 * (active ? 1 - (1 - (1 - t) ** 3) : eased);
        grave.rotation.z = [-6, 3, 8][i]! * Math.PI / 180 + (i % 2 === 0 ? 0.1 : -0.1) * (active ? (1 - t) ** 3 : eased);
        grave.position.y = 0.055 - 1.5 * (active ? 1 - eased : eased); grave.visible = active || t < 1;
      });
    });
    this.render();
  }
  render() {
    if (this.destroyed) return;
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, this.width, this.height);
    if (this.inMenu) {
      this.renderer.setClearColor(this.menu.background as THREE.Color); this.renderer.clear();
      this.renderer.setViewport(this.width * 0.34, 0, this.width * 0.66, this.height); this.renderer.render(this.menu, this.menuCamera);
    } else this.renderer.render(this.scene, this.camera.camera);
  }
  capture(): Promise<Blob | null> { if (this.destroyed) return Promise.resolve(null); this.render(); return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png')); }
  destroy() {
    this.destroyed = true; this.observer.disconnect(); this.reset(); this.menuMixer?.stopAllAction(); this.effects.destroy();
    disposeObjects(this.scene); disposeObjects(this.menu);
    for (const asset of this.assets.values()) disposeObjects(asset.scene);
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
