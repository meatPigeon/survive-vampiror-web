import * as THREE from 'three';
import type { GameEvent, Point } from './types';

const CAPACITY = 320;
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number; color: THREE.Color }
function pointMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { pixelScale: { value: 20 } },
    vertexShader: `attribute vec4 spark; attribute vec3 tint; varying vec3 vTint; varying float vAlpha;
      uniform float pixelScale;
      void main() { vTint = tint; vAlpha = spark.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, spark.x * pixelScale); }`,
    fragmentShader: `varying vec3 vTint; varying float vAlpha;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
        float core = pow(1.0 - r, 1.8); gl_FragColor = vec4(vTint, core * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
export class CombatEffects {
  readonly root = new THREE.Group();
  private particles: (Particle | undefined)[] = new Array(CAPACITY);
  private next = 0;
  private positions = new THREE.Float32BufferAttribute(new Float32Array(CAPACITY * 3), 3);
  private sparks = new THREE.Float32BufferAttribute(new Float32Array(CAPACITY * 4), 4);
  private tints = new THREE.Float32BufferAttribute(new Float32Array(CAPACITY * 3), 3);
  private geometry = new THREE.BufferGeometry();
  private material = pointMaterial();
  private ambientGeometry = new THREE.BufferGeometry();
  private ambientMaterial = pointMaterial();
  private time = 0;
  constructor() {
    this.positions.setUsage(THREE.DynamicDrawUsage); this.sparks.setUsage(THREE.DynamicDrawUsage); this.tints.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positions); this.geometry.setAttribute('spark', this.sparks); this.geometry.setAttribute('tint', this.tints);
    const points = new THREE.Points(this.geometry, this.material); points.frustumCulled = false; this.root.add(points);
    const positions: number[] = [], sparks: number[] = [], tints: number[] = [];
    for (let i = 0; i < 64; i++) {
      positions.push(Math.sin(i * 127.1) * 29, 0.4 + (i % 7) * 0.22, Math.cos(i * 311.7) * 21);
      sparks.push(0.12 + i % 3 * 0.03, 0.35, 0, 0); tints.push(0.2, 0.62, 0.39);
    }
    this.ambientGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.ambientGeometry.setAttribute('spark', new THREE.Float32BufferAttribute(sparks, 4));
    this.ambientGeometry.setAttribute('tint', new THREE.Float32BufferAttribute(tints, 3));
    const time = { value: 0 }; this.ambientMaterial.uniforms.time = time;
    this.ambientMaterial.vertexShader = `uniform float time;\n${this.ambientMaterial.vertexShader}`
      .replace('vAlpha = spark.y;', 'vAlpha = spark.y * (0.3 + 0.7 * pow(abs(sin(time * 0.8 + position.x)), 2.0));')
      .replace('vec4(position, 1.0)', 'vec4(position + vec3(sin(time * 0.4 + position.z) * 0.6, sin(time + position.x) * 0.22, cos(time * 0.3 + position.x) * 0.6), 1.0)');
    this.root.add(new THREE.Points(this.ambientGeometry, this.ambientMaterial));
  }
  burst(p: Point, color: number, count: number, speed = 2.5, height = 0.3) {
    for (let i = 0; i < Math.min(count, CAPACITY); i++) {
      const angle = i * 2.399963 + this.next * 0.7, power = speed * (0.35 + i % 7 / 10);
      this.particles[this.next] = { x: p.x, y: height, z: p.z, vx: Math.sin(angle) * power, vy: 1 + i % 5 * 0.45, vz: Math.cos(angle) * power,
        age: 0, life: 0.35 + i % 6 * 0.1, size: 0.18 + i % 4 * 0.055, color: new THREE.Color(color) };
      this.next = (this.next + 1) % CAPACITY;
    }
  }
  event(event: GameEvent) {
    if (event.x === undefined || event.z === undefined) return;
    const p = { x: event.x, z: event.z };
    if (event.type === 'blast') this.burst(p, 0xffba58, 40, 5);
    if (event.type === 'sling-impact') this.burst(p, 0x8ef1ed, 26, 3.5);
    if (event.type === 'bite') this.burst(p, 0xfbe3a7, 3, 0.8, 0.7);
  }
  update(dt: number, pixelScale: number) {
    this.time += dt; this.material.uniforms.pixelScale!.value = this.ambientMaterial.uniforms.pixelScale!.value = pixelScale;
    this.ambientMaterial.uniforms.time!.value = this.time;
    this.particles.forEach((p, i) => {
      if (!p) return;
      p.age += dt;
      if (p.age >= p.life) { this.particles[i] = undefined; this.sparks.setY(i, 0); return; }
      p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.vy -= dt * 7;
      this.positions.setXYZ(i, p.x, p.y, p.z); this.tints.setXYZ(i, p.color.r, p.color.g, p.color.b);
      this.sparks.setXY(i, p.size, (1 - p.age / p.life) ** 2);
    });
    this.positions.needsUpdate = this.sparks.needsUpdate = this.tints.needsUpdate = true;
  }
  get activeCount() { return this.particles.filter(Boolean).length; }
  reset() { this.particles.fill(undefined); this.sparks.array.fill(0); this.sparks.needsUpdate = true; this.next = 0; this.time = 0; }
  destroy() { this.root.removeFromParent(); this.geometry.dispose(); this.material.dispose(); this.ambientGeometry.dispose(); this.ambientMaterial.dispose(); }
}
