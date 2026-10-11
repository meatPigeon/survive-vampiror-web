import * as THREE from 'three';
import type { LocationDefinition } from '../data/campaign';

const vertex = `
varying vec2 cloudXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  cloudXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const fragment = `
varying vec2 cloudXZ;
uniform float driftTime, airLayer, detail;
uniform vec3 cloudColor;
float cloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float cloudNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(cloudHash(i),cloudHash(i+vec2(1.,0.)),f.x),
    mix(cloudHash(i+vec2(0.,1.)),cloudHash(i+vec2(1.,1.)),f.x),f.y);
}
float billow(vec2 p) {
  float n = cloudNoise(p)*.60 + cloudNoise(p*2.03+19.7)*.28;
  if (detail > .5) n += cloudNoise(p*4.11-8.2)*.12;
  else n += .06;
  return n;
}
void main() {
  // The same field drives both layers. Sunlight offsets the shadow on the floor.
  vec2 wind = vec2(.42,.16)*driftTime;
  vec2 p = (cloudXZ + mix(vec2(4.,-3.),vec2(0.),airLayer) - wind) * vec2(.075,.095);
  float broad = billow(p + vec2(3.1,7.8));
  float shape = smoothstep(.49,.71,broad);
  float edge = smoothstep(8.,36.,length(cloudXZ*vec2(.91,1.08))+(cloudNoise(cloudXZ*.08)-.5)*5.);
  // Wisps cross the arena; the denser, luminous banks stay around the scenery.
  float opacity = mix(.17, .075 + .31*edge, airLayer) * shape;
  float boundary = 1.-smoothstep(66.,84.,length(cloudXZ));
  float light = smoothstep(.43,.70,billow(p + vec2(3.02,7.68)));
  vec3 tint = mix(vec3(.022,.040,.033),cloudColor*(.76+.24*light),airLayer);
  gl_FragColor = vec4(tint,opacity*boundary);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Two inexpensive procedural layers: translucent cloud banks and their moving ground shade. */
export class Clouds {
  readonly root = new THREE.Group();
  private time = { value: 0 };
  private detail = { value: 1 };
  private color = { value: new THREE.Color(0xe5eddf) };
  private geometry = new THREE.PlaneGeometry(180, 180).rotateX(-Math.PI / 2);
  private materials: THREE.ShaderMaterial[] = [];
  private disposed = false;
  constructor() {
    this.root.name = 'DriftingClouds';
    for (const layer of [0, 1]) {
      const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
        uniforms: { driftTime: this.time, airLayer: { value: layer }, detail: this.detail, cloudColor: this.color },
        transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.materials.push(material);
      const mesh = new THREE.Mesh(this.geometry, material); mesh.name = layer ? 'CloudBanks' : 'CloudShadows';
      mesh.position.y = layer ? 7.5 : 0.018; this.root.add(mesh);
    }
  }
  configure(low: boolean) { this.detail.value = low ? 0 : 1; }
  setLocation(location: LocationDefinition) { this.color.value.setHex(location.palette.moon).lerp(new THREE.Color(0xfff2d8), .2); }
  update(dt: number, reducedMotion: boolean) { if (!this.disposed && !reducedMotion && Number.isFinite(dt) && dt > 0) this.time.value += Math.min(dt, .1); }
  destroy() {
    if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.root.clear();
    this.geometry.dispose(); for (const material of this.materials) material.dispose();
  }
}
