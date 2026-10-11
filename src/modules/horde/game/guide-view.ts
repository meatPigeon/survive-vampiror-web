import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Actor, disposeObjects } from './actors';
import { Previews } from './previews';
import { SceneryMeshes } from './scenery-meshes';
import { siteIndicator } from './site-indicator';
import { GuideLesson } from './guide-lesson';
import type { Point } from './types';

const sources = {
  permanent: new URL('../assets/reference/permanent_zombie.glb', import.meta.url).href,
  temporary: new URL('../assets/reference/temporary_zombie.glb', import.meta.url).href,
  knight: new URL('../assets/reference/knight_wave1.glb', import.meta.url).href,
  crater: new URL('../assets/reference/recruitment_crater.glb', import.meta.url).href,
  grave: new URL('../assets/reference/tombstone.glb', import.meta.url).href,
};

/** Close-up teaching diorama, with the same actors, attack previews and summoning ring as play. */
export class GuideView {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-7, 7, 4.5, -4.5, 0.1, 80);
  private decor = new SceneryMeshes();
  private stage = new THREE.Group();
  private previews = new Previews();
  private site = siteIndicator();
  private marker = new THREE.Group();
  private actors = new Map<number, Actor>();
  private assets = new Map<string, GLTF>();
  private knight: Actor | null = null;
  private destroyed = false;
  private observer: ResizeObserver;
  private lastProgress = -1;
  readonly ready: Promise<void>;
  constructor(private host: HTMLElement, private lesson: GuideLesson) {
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
    this.camera.position.set(0, 9.5, 12); this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xe7f3dc, 0x57604a, 2.3));
    const light = new THREE.DirectionalLight(0xffe0a2, 3); light.position.set(-4, 8, 4); this.scene.add(light);
    const rim = new THREE.DirectionalLight(0x99ded3, 1.7); rim.position.set(5, 4, -4); this.scene.add(rim);
    const kit = this.decor;
    kit.mesh(kit.root, 'cylinder', kit.material(0x293f32), [16, 0.7, 11], [0, -0.42, 0]);
    kit.mesh(kit.root, 'cylinder', kit.material(0x526344), [15.6, 0.16, 10.7], [0, -0.08, 0]);
    for (let i = 0; i < 28; i++) {
      const a = i * 2.399963, x = Math.cos(a) * (5.6 + i % 3 * 0.45), z = Math.sin(a) * 3.9;
      if (Math.abs(z) < 2.7) continue;
      kit.mesh(kit.root, 'leaf', kit.material(i % 2 ? 0x88935a : 0x3f6546), [0.45 + i % 3 * 0.15, 0.5, 0.5], [x, 0.2, z]);
      if (i % 3 === 0) kit.mesh(kit.root, 'sphere', kit.material(0x9b9d84), [0.6, 0.35, 0.5], [x + 0.5, 0.12, z]);
    }
    const o = lesson.origin; this.stage.position.set(-o.x, 0, -o.z);
    this.scene.add(kit.root, this.stage); this.stage.add(this.previews.root);
    for (const mesh of [this.site.track, this.site.fill, this.site.marker]) { mesh.position.x = o.x + 2; mesh.position.z = o.z; this.stage.add(mesh); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.67, 48), new THREE.MeshBasicMaterial({ color: 0xf5de9d, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; this.marker.add(ring); this.stage.add(this.marker);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
    this.ready = this.load();
  }
  private async load() {
    const loader = new GLTFLoader();
    const results = await Promise.allSettled(Object.entries(sources).map(async ([name, url]) => [name, await loader.loadAsync(url)] as const));
    for (const result of results) if (result.status === 'fulfilled') this.assets.set(...result.value);
    if (this.destroyed || results.some(r => r.status === 'rejected')) {
      for (const asset of this.assets.values()) disposeObjects(asset.scene); this.assets.clear();
      if (!this.destroyed) throw new Error('Teaching scene unavailable');
      return;
    }
    this.knight = new Actor(this.assets.get('knight')!, false, true); this.stage.add(this.knight.root); this.shadow(this.knight.root, 1.1);
    if (this.lesson.chapter === 'recruit') {
      const crater = this.assets.get('crater')!.scene; crater.position.set(this.lesson.origin.x + 2, 0, this.lesson.origin.z); this.stage.add(crater);
    }
    const grave = this.assets.get('grave')!.scene; grave.position.set(-5.1, 0, -2.9); grave.rotation.y = 0.35; this.scene.add(grave);
    this.update(0, true);
  }
  private resize() {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight), aspect = width / height;
    const half = Math.max(3.5, 6.6 / aspect);
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false); this.renderer.render(this.scene, this.camera);
  }
  point(clientX: number, clientY: number): Point | null {
    const bounds = this.host.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), this.camera);
    const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0)), new THREE.Vector3());
    return point ? this.lesson.absolute({ x: point.x, z: point.z }) : null;
  }
  update(dt: number, reduced: boolean) {
    if (this.destroyed || !this.knight) return;
    const w = this.lesson.world, active = this.lesson.stage === 'trying' || this.lesson.stage === 'punish';
    for (const z of w.zombies) {
      let actor = this.actors.get(z.id);
      if (!actor) { actor = new Actor(this.assets.get(z.kind)!, z.kind === 'temporary', false, z.id * 0.37); this.actors.set(z.id, actor); this.stage.add(actor.root); this.shadow(actor.root, 0.75); }
      actor.updateZombie(z, w, reduced && !active ? 0 : dt);
    }
    for (const event of w.events.splice(0)) {
      if (event.type === 'bite') { const z = w.zombies.find(z => z.x === event.x && z.z === event.z); if (z) this.actors.get(z.id)?.bite(); }
      if (event.type === 'attack-struck') this.knight.slash(false, 0.18, 1.1);
    }
    this.knight.root.visible = this.lesson.chapter !== 'recruit'; this.knight.updateKnight(w, reduced && !active ? 0 : dt);
    this.previews.update(w, dt);
    const recruiting = this.lesson.chapter === 'recruit', progress = this.lesson.progress;
    this.site.track.visible = recruiting; this.site.marker.visible = recruiting; this.site.fill.visible = recruiting && progress > 0;
    if (recruiting && Math.abs(progress - this.lastProgress) > 0.015) { this.site.fill.geometry.dispose(); this.site.fill.geometry = this.site.geometry(progress); this.lastProgress = progress; }
    const goal = this.lesson.destination ?? this.lesson.goal;
    this.marker.visible = !recruiting && this.lesson.stage !== 'complete'; this.marker.position.set(goal.x, 0.06, goal.z);
    this.renderer.render(this.scene, this.camera);
  }
  private shadow(root: THREE.Object3D, size: number) {
    this.decor.mesh(root, 'cylinder', this.decor.material(0x172b20, true, 0.23), [size, 0.003, size * 0.68], [0, 0.009, 0]);
  }
  destroy() {
    this.destroyed = true; this.observer.disconnect();
    for (const actor of this.actors.values()) actor.destroy(); this.actors.clear(); this.knight?.destroy();
    this.previews.reset(); this.decor.destroy();
    for (const mesh of [this.site.track, this.site.fill, this.site.marker]) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); }
    disposeObjects(this.marker);
    for (const asset of this.assets.values()) disposeObjects(asset.scene); this.assets.clear();
    this.scene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
