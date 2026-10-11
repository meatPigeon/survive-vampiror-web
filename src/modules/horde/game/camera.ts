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
  private pan = new THREE.Vector3();
  private readonly eyeDirection = new THREE.Vector3(0, 0.8, 0.6);
  private sceneryFrame: { width: number; height: number; z: number } | null = null;
  constructor() { this.camera.position.set(0, 32, 24); this.camera.lookAt(0, 0, 0); }
  resize(width: number, height: number) {
    this.aspect = width / height; this.fit();
    this.size = this.fitted * this.factor; this.project();
  }
  /** Fit actual landmark vertices once at travel, retaining the original graveyard contract. */
  frameScenery(root: THREE.Object3D | null) {
    this.sceneryFrame = null;
    if (root) {
      root.updateMatrixWorld(true);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion), p = new THREE.Vector3();
      let north = 20.1, south = -20.1, halfWidth = RULES.halfWidth + 2.5;
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.getAttribute('position');
        for (let i = 0; i < vertices.count; i++) {
          p.fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
          const height = p.dot(up); north = Math.max(north, height); south = Math.min(south, height); halfWidth = Math.max(halfWidth, Math.abs(p.x));
        }
      });
      // Reserve the top 12% for the health/location HUD; retain 1.2 units below scenery.
      // (1 - hudFraction) * height = visible landmark span + bottom padding.
      const hudFraction = 0.12, height = (north - south + 1.2) / (1 - hudFraction);
      const center = north - (0.5 - hudFraction) * height;
      this.sceneryFrame = { width: halfWidth * 2 + 2.4, height, z: center / up.z };
    }
    this.fit();
  }
  private fit() {
    this.fitted = Math.max((this.sceneryFrame?.width ?? RULES.halfWidth * 2 + 5) / this.aspect, this.sceneryFrame?.height ?? RULES.halfDepth * 2 * 0.8 + 5);
  }
  zoom(steps: number) { this.factor = THREE.MathUtils.clamp(this.factor * Math.pow(0.88, steps), 0.45, 1.25); }
  reset() { this.factor = 1; this.frameScenery(null); this.size = this.fitted; this.focus.set(0, 0, 0); this.pan.set(0, 0, 0); this.project(); }
  update(world: Encounter, dt: number, snap = false) {
    this.size = THREE.MathUtils.lerp(this.size, this.fitted * this.factor, snap ? 1 : 1 - Math.exp(-12 * dt));
    if (this.factor < 1) {
      const mobile = alive(world).filter(a => !a.locked);
      if (mobile.length) { const p = centerOf(mobile); this.focus.set(p.x, 0, p.z); }
      else { this.project(); return; }
    } else this.focus.set(0, 0, this.sceneryFrame?.z ?? 0);
    this.pan.lerp(this.focus, snap ? 1 : 1 - Math.exp(-8 * dt));
    this.project();
  }
  private project() {
    this.camera.top = this.size / 2; this.camera.bottom = -this.size / 2;
    this.camera.left = -this.size * this.aspect / 2; this.camera.right = this.size * this.aspect / 2;
    // Portrait framing exposes more foreground ground. Pull back along the same
    // view axis so the near plane cannot cut it, without changing the projection.
    const groundDepth = this.size / 2 * this.eyeDirection.z / this.eyeDirection.y;
    const distance = Math.max(40, groundDepth + this.camera.near + 2);
    this.camera.position.copy(this.pan).addScaledVector(this.eyeDirection, distance);
    this.camera.far = Math.max(100, distance + groundDepth + 20);
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
