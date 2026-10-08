import * as THREE from 'three';
// The source's streamed ribbons and weapon trails. Travel, not input, gates the streams.
export class MotionAir {
  readonly mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  private previous = new THREE.Vector3();
  private back = new THREE.Vector3(0, 0, 1);
  private weight = 0;
  private clock = 0;
  private slashAge = -1;
  private slashDuration = 0.18;
  private slashHeight = 1;
  private spinning = false;
  constructor(private host: THREE.Object3D, private phase: number, private color = new THREE.Color(0.9, 0.97, 0.92), private alpha = 0.65) { host.add(this.mesh); this.mesh.visible = false; }
  slash(spinning: boolean, duration: number, height: number) { this.spinning = spinning; this.slashDuration = Math.max(duration, 0.05); this.slashHeight = height; this.slashAge = 0; }
  update(dt: number, streaming: boolean, size = 1, height = 1) {
    const world = this.host.getWorldPosition(new THREE.Vector3()), travel = world.clone().sub(this.previous); this.previous.copy(world); travel.y = 0;
    const moving = travel.length() > dt * 0.3 && travel.length() < 2;
    if (moving) this.back.copy(travel.negate().applyQuaternion(this.host.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize());
    this.weight = THREE.MathUtils.clamp(this.weight + (streaming && moving ? dt * 9 : -dt * 9), 0, 1); this.clock += dt;
    if (this.slashAge >= 0) { this.slashAge += dt; if (this.slashAge >= this.slashDuration + 0.14) this.slashAge = -1; }
    if (this.weight <= 0 && this.slashAge < 0) { this.mesh.visible = false; return; }
    this.mesh.visible = true; const positions: number[] = [], colors: number[] = [];
    const ribbon = (points: THREE.Vector3[], width: number, opacity: number) => {
      const edges = points.map((_, i) => points[Math.min(i + 1, points.length - 1)]!.clone().sub(points[Math.max(i - 1, 0)]!).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(width * Math.sin(i / (points.length - 1) * Math.PI)));
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!.clone().sub(edges[i]!), b = points[i]!.clone().add(edges[i]!), c = points[i + 1]!.clone().sub(edges[i + 1]!), d = points[i + 1]!.clone().add(edges[i + 1]!);
        for (const v of [a, b, c, b, d, c]) { positions.push(v.x, v.y, v.z); colors.push(this.color.r, this.color.g, this.color.b, this.alpha * opacity); }
      }
    };
    if (this.weight > 0) {
      const side = this.back.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      for (let line = 0; line < 2; line++) {
        const cycle = (this.clock * 2.6 + this.phase + line * 0.5) % 1, points: THREE.Vector3[] = [];
        for (let step = 0; step < 11; step++) { const t = step / 10; points.push(side.clone().multiplyScalar((0.66 + Math.sin(t * Math.PI) * 0.17) * (line === 0 ? -1 : 1) * size).addScaledVector(this.back, (-0.35 + t * 1.65 + cycle * 0.55) * size).add(new THREE.Vector3(0, height + Math.sin(t * Math.PI) * 0.12, 0))); }
        ribbon(points, 0.08 * size, this.weight * Math.sin(cycle * Math.PI) * 0.75);
      }
    }
    if (this.slashAge >= 0) {
      const progress = Math.min(this.slashAge / this.slashDuration, 1), fade = 1 - THREE.MathUtils.clamp((this.slashAge - this.slashDuration) / 0.14, 0, 1);
      const head = 1.35 - (this.spinning ? Math.PI * 2 : 2.7) * progress;
      for (let line = 0; line < 2; line++) {
        const radius = (this.spinning ? 2.65 : 2.25) + line * 0.2, points = Array.from({ length: 19 }, (_, step) => { const angle = head + (this.spinning ? 2.2 : 1.65) * (1 - step / 18); return new THREE.Vector3(Math.sin(angle) * radius, this.slashHeight + Math.cos(angle) * 0.12, -Math.cos(angle) * radius); });
        ribbon(points, 0.22 * (line === 0 ? 1 : 0.22), fade * (line === 0 ? 1 : 0.55));
      }
    }
    this.mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); this.mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); this.mesh.geometry.computeBoundingSphere();
  }
  clear() { this.weight = 0; this.slashAge = -1; this.mesh.visible = false; }
  destroy() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
