import * as THREE from 'three';
import type { LocationDefinition } from '../data/campaign';

const smooth = (a: number, b: number, t: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
/** Ambient schedules use their own clock and never consume the encounter's random state. */
export function ambientWeatherAt(time: number, wave: number) {
  const rainTime = (time + (wave - 1) * 17) % 112;
  const rain = smooth(18, 26, rainTime) * (1 - smooth(43, 55, rainTime)) * (wave === 4 ? .5 : .72);
  const flightTime = time + (wave - 1) * 11, cycle = flightTime % 52;
  return { rain, flight: cycle >= 7 && cycle < 23 ? (cycle - 7) / 16 : null,
    kind: (Math.floor(flightTime / 52) + wave) % 2 ? 'bat' as const : 'crow' as const };
}
function wing(bat: boolean) {
  const edge = bat ? [[-.68,.24],[-.54,-.07],[-.4,0],[-.28,-.2],[-.13,-.09],[0,-.3]] : [[-.58,.1],[-.45,-.12],[-.2,-.2],[0,-.3]];
  const points: number[] = [];
  for (let i = 0; i < edge.length - 1; i++) points.push(0,0,0,edge[i]![0]!,0,edge[i]![1]!,edge[i+1]![0]!,0,edge[i+1]![1]!);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); return g;
}
interface Flier { root: THREE.Group; wings: THREE.Mesh[]; kind: 'crow' | 'bat'; index: number }

/** Small silhouettes and intermittent showers. Nothing here participates in combat. */
export class Weather {
  readonly root = new THREE.Group();
  private time = 0;
  private wave = 1;
  private low = false;
  private disposed = false;
  private fliers: Flier[] = [];
  private geometries: THREE.BufferGeometry[] = [wing(false), wing(true), new THREE.ConeGeometry(.09, .55, 3)];
  private birdMaterial = new THREE.MeshBasicMaterial({ color: 0x142028, side: THREE.DoubleSide });
  private rainGeometry = new THREE.BufferGeometry();
  private rainMaterial = new THREE.LineBasicMaterial({ color: 0xc4d9db, transparent: true, opacity: 0, depthWrite: false });
  private rain = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
  private positions = new Float32Array(220 * 6);
  constructor() {
    this.root.name = 'AmbientWeather'; this.root.add(this.rain);
    this.rain.name = 'PassingRain'; this.rain.frustumCulled = false;
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    for (const kind of ['crow', 'bat'] as const) for (let i = 0; i < 4; i++) {
      const root = new THREE.Group(), body = new THREE.Mesh(this.geometries[2], this.birdMaterial);
      body.rotation.x = Math.PI / 2; root.add(body);
      const wings = [-1, 1].map(side => { const mesh = new THREE.Mesh(this.geometries[kind === 'bat' ? 1 : 0], this.birdMaterial); mesh.scale.x = side; root.add(mesh); return mesh; });
      root.scale.setScalar(kind === 'bat' ? .75 : .9); root.visible = false;
      this.root.add(root); this.fliers.push({ root, wings, kind, index: i });
    }
  }
  configure(low: boolean, reducedMotion = false) { this.low = low; this.root.visible = !reducedMotion; this.rainGeometry.setDrawRange(0, (low ? 85 : 220) * 2); }
  setLocation(location: LocationDefinition, wave: number) {
    this.wave = wave; this.rainMaterial.color.setHex(location.palette.moon).lerp(new THREE.Color(0xaecad1), .35);
  }
  update(dt: number, reducedMotion: boolean) {
    if (this.disposed) return;
    this.root.visible = !reducedMotion;
    if (reducedMotion) return;
    if (Number.isFinite(dt) && dt > 0) this.time += Math.min(dt, .1);
    const weather = ambientWeatherAt(this.time, this.wave);
    for (const flier of this.fliers) {
      const { root, kind, index, wings } = flier;
      root.visible = weather.flight !== null && kind === weather.kind && (!this.low || index < 3);
      if (!root.visible) continue;
      const t = weather.flight!;
      root.position.set(-43 + t * 86 - index * 1.5, 9 + Math.sin(this.time * 1.2 + index) * .25 + index * .22, -18 + t * 34 + (index % 2 ? 1 : -1) * index * .65);
      root.rotation.y = Math.atan2(86, 34);
      const flap = Math.sin(this.time * (kind === 'bat' ? 15 : 8) + index * .9) * .65;
      wings[0]!.rotation.z = flap; wings[1]!.rotation.z = -flap;
    }
    this.rain.visible = weather.rain > .001; this.rainMaterial.opacity = weather.rain * .42;
    if (this.rain.visible) {
      const count = this.low ? 85 : 220;
      for (let i = 0; i < count; i++) {
        const phase = (this.time * 1.15 + i * .618034) % 1, y = 13 * (1 - phase);
        const x = ((i * 37.713) % 76) - 38 - phase * 3, z = ((i * 19.317) % 58) - 29 - phase;
        this.positions.set([x,y,z,x+.18,y+.8,z+.07], i * 6);
      }
      this.rainGeometry.attributes.position!.needsUpdate = true;
    }
  }
  destroy() {
    if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.root.clear();
    for (const geometry of this.geometries) geometry.dispose(); this.rainGeometry.dispose(); this.birdMaterial.dispose(); this.rainMaterial.dispose();
  }
}
