import * as THREE from "three";
import { RULES } from "./rules";
import { alive, centerOf } from "./world";
import type { Encounter, Point } from "./types";
export class ArenaCamera {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 100);
  factor = 1;
  private aspect = 1;
  private fitted = 40.2;
  private size = 40.2;
  private focus = new THREE.Vector3();
  constructor() { this.camera.position.set(0, 32, 24); this.camera.lookAt(0, 0, 0); }
  resize(width: number, height: number) {
    this.aspect = width / height; this.fitted = Math.max((RULES.halfWidth * 2 + 5) / this.aspect, RULES.halfDepth * 2 * 0.8 + 5);
    this.size = this.fitted * this.factor; this.project();
  }
  zoom(steps: number) { this.factor = THREE.MathUtils.clamp(this.factor * Math.pow(0.88, steps), 0.45, 1.25); }
  reset() { this.factor = 1; this.size = this.fitted; this.focus.set(0, 0, 0); this.camera.position.set(0, 32, 24); this.project(); }
  update(world: Encounter, dt: number) {
    this.size = THREE.MathUtils.lerp(this.size, this.fitted * this.factor, 1 - Math.exp(-12 * dt));
    if (this.factor < 1) {
      const mobile = alive(world).filter(a => !a.locked);
      if (mobile.length) { const p = centerOf(mobile); this.focus.set(p.x, 0, p.z); }
      else { this.project(); return; }
    } else this.focus.set(0, 0, 0);
    this.camera.position.lerp(new THREE.Vector3(this.focus.x, 32, 24 + this.focus.z), 1 - Math.exp(-8 * dt));
    this.project();
  }
  private project() {
    this.camera.top = this.size / 2; this.camera.bottom = -this.size / 2;
    this.camera.left = -this.size * this.aspect / 2; this.camera.right = this.size * this.aspect / 2;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  screen(canvas: HTMLCanvasElement, point: Point) {
    const rect = canvas.getBoundingClientRect();
    const p = new THREE.Vector3(point.x, 0, point.z).project(this.camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  }
  aim(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect(), p = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(p, this.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return { point: { x: hit?.x ?? 0, z: hit?.z ?? 0 }, onGround: hit !== null && clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom };
  }
}
