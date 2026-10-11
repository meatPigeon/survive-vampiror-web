import * as THREE from 'three';
import type { LocationDefinition } from '../data/campaign';
import { SceneryMeshes } from './scenery-meshes';

/** Architecture stays beyond the playable rectangle; only flat markings occupy the arena. */
export class LocationScenery {
  private kit = new SceneryMeshes();
  readonly root = this.kit.root;
  private flags: THREE.Object3D[] = [];
  private flames: THREE.Object3D[] = [];
  private smoke: THREE.ShaderMaterial | null = null;
  private time = 0;
  constructor(readonly location: LocationDefinition) {
    this.root.name = `location-${location.id}`;
    if (location.id === 'graveyard') this.graveyard();
    if (location.id === 'chapel') this.chapel();
    if (location.id === 'road') this.road();
    if (location.id === 'outskirts') this.outskirts();
    if (location.id === 'castle') this.castle();
  }
  private materials() {
    const slate = new THREE.Color(this.location.palette.stone).multiplyScalar(0.34).getHex();
    return { stone: this.kit.material(this.location.palette.stone), dark: this.kit.material(slate),
      wood: this.kit.material(0x74614c), gold: this.kit.material(0xb79a64), accent: this.kit.material(this.location.palette.accent),
      light: this.kit.material(0xffd494, true), black: this.kit.material(0x263831) };
  }
  private torch(parent: THREE.Object3D, x: number, y: number, z: number) {
    const { dark, light } = this.materials();
    this.kit.mesh(parent, 'cylinder', dark, [0.18, 1.6, 0.18], [x, y + 0.8, z]);
    this.kit.mesh(parent, 'cone', dark, [0.5, 0.35, 0.5], [x, y + 1.65, z]).rotation.z = Math.PI;
    const flame = this.kit.mesh(parent, 'sphere', light, [0.21, 0.52, 0.21], [x, y + 1.9, z], 'torch-flame'); this.flames.push(flame);
  }
  private fence(name: string, x: number, z: number, width: number, burned = false) {
    const group = this.kit.group(name, x, z), material = this.kit.material(burned ? 0x322d29 : 0x5b6250);
    const count = Math.max(3, Math.round(width / 1.25)), phase = x * 0.17 + z * 0.13;
    const posts: [number, number, number][] = [];
    for (let i = 0; i <= count; i++) {
      const height = (burned ? 1.85 : 1.05) + Math.sin(i * 2.4 + phase) * (burned ? 0.38 : 0.18);
      const at: [number, number, number] = [-width / 2 + i * width / count + Math.sin(i * 1.7 + phase) * 0.14, height, Math.sin(i * 1.1 + phase) * 0.23];
      posts.push(at);
      // Missing posts and separate sagging rails make a fragment, rather than an arena rail.
      if (i === count - 1) continue;
      const post = this.kit.mesh(group, burned ? 'cone' : 'box', material, [burned ? 0.48 : 0.26, height, burned ? 0.36 : 0.22], [at[0], height / 2, at[2]]);
      post.rotation.z = Math.sin(i * 4.3 + phase) * (burned ? 0.23 : 0.15);
    }
    for (let i = 0; i < count; i++) {
      if (i === count - 2) continue;
      const a = posts[i]!, b = posts[i + 1]!;
      for (const y of [0.43, 0.83]) this.kit.beam(group, material,
        [a[0], y + Math.sin(i + phase) * 0.08, a[2]], [b[0], y + Math.sin(i + 1 + phase) * 0.08, b[2]], 0.13);
    }
    return group;
  }
  private shrub(parent: THREE.Object3D, x: number, z: number, size: number, color: number, flowers = false) {
    const leaf = this.kit.material(color);
    for (let i = 0; i < 3; i++) this.kit.mesh(parent, 'leaf', leaf, [size * 0.8, size * 0.55, size * 0.75], [x + (i - 1) * size * 0.27, size * 0.28 + i % 2 * 0.12, z + (i % 2 ? -0.14 : 0.1)], 'clustered-foliage');
    if (flowers) for (let i = 0; i < 4; i++) this.kit.mesh(parent, 'sphere', this.kit.material(i % 2 ? 0xbfac82 : 0xd4c9ac), [0.13, 0.11, 0.13], [x + Math.sin(i * 2.3) * size * 0.4, size * 0.57, z + Math.cos(i * 2.3) * size * 0.26], 'small-flowers');
  }
  private garden(name: string, x: number, z: number, width: number, color = 0x69866b) {
    const group = this.kit.group(name, x, z), { stone } = this.materials();
    for (const [at, depth, size] of [[-0.31, -0.24, 1.3], [-0.04, 0.36, 0.95], [0.25, -0.12, 1.05], [0.39, 0.43, 0.7]] as const)
      this.shrub(group, at * width, depth, size, color, at < 0.3);
    // A few loose stones suggest an old planting bed without drawing a rectangular outline.
    for (let i = 0; i < 5; i++) {
      const stonelet = this.kit.mesh(group, 'sphere', stone, [0.6 + i % 2 * 0.2, 0.28, 0.46],
        [-width * 0.47 + i * width * 0.21, 0.11, -0.75 + Math.sin(i * 2.2) * 0.33], 'garden-edging');
      stonelet.rotation.y = i * 0.9;
    }
    return group;
  }
  private lowWall(x: number, z: number, length: number, yaw: number) {
    const group = this.kit.group('courtyard-low-wall', x, z), { stone, dark } = this.materials(); group.rotation.y = yaw;
    const count = Math.round(length / 1.6);
    for (let i = 0; i < count; i++) {
      if (i === count - 2) continue;
      const height = 0.48 + (i % 3) * 0.17, at = -length / 2 + (i + 0.5) * length / count;
      const block = this.kit.mesh(group, 'box', i % 3 === 1 ? dark : stone, [length / count - 0.12, height, 0.8],
        [at, height / 2, Math.sin(i * 1.8) * 0.18], 'broken-courtyard-stone'); block.rotation.y = Math.sin(i * 2.7) * 0.1;
      if (i === 1) this.kit.mesh(group, 'box', stone, [1.1, 0.24, 0.7], [at - 0.16, height + 0.1, 0.04]).rotation.y = -0.16;
    }
    return group;
  }
  private graveyard() {
    const { stone, dark } = this.materials();
    for (const [x, z, width, yaw] of [[-21, -23.55, 7, 0.08], [14, -23.45, 4.8, -0.12], [-15, 23.9, 8, -0.17], [25, 23.9, 4.5, 0.28], [-32.9, 9, 6, 1.37]] as const)
      this.fence('crooked-fences', x, z, width).rotation.y = yaw;
    for (const [x, z, yaw] of [[-33.7, -11, 0.22], [33.6, -16.5, -0.34]] as const) {
      const tomb = this.kit.group('mossy-boundary-tomb', x, z); tomb.rotation.y = yaw;
      this.kit.mesh(tomb, 'box', stone, [2.1, 0.65, 3.4], [0, 0.325, 0]);
      this.kit.mesh(tomb, 'box', dark, [2.3, 0.18, 3.6], [0, 0.74, 0]);
      this.kit.mesh(tomb, 'box', this.kit.material(0x526947), [1.6, 0.03, 1.5], [0.2, 0.845, -0.2]);
    }
    for (const [x, z, size] of [[-27, -23.3, 1.35], [-23.5, -23.7, 0.85], [13, -23.6, 1.1], [28.3, 23.8, 0.9], [-11, 24.1, 1.2]] as const)
      this.shrub(this.root, x, z, size, 0x68815f, true);
  }
  private chapel() {
    const { stone, dark, gold, accent, black } = this.materials();
    const facade = this.kit.group('chapel-facade', -5.5, -29); facade.rotation.y = -0.12;
    // The tall back wall and buttresses read as a destination, beyond the walkable paving.
    this.kit.mesh(facade, 'box', stone, [14, 4.8, 1.2], [0, 2.4, -1.2]);
    this.kit.mesh(facade, 'box', this.kit.material(0x5e6150), [4.3, 3.5, 0.08], [0, 1.75, -0.55]);
    for (let i = 0; i < 7; i++) this.kit.mesh(facade, 'box', this.kit.material(i % 2 ? 0x7a7057 : 0x6b634f), [0.54, 3.25, 0.1], [-1.8 + i * 0.6, 1.66, -0.46], 'chapel-door-planks');
    for (const y of [0.8, 2.4]) this.kit.mesh(facade, 'box', dark, [4, 0.13, 0.13], [0, y, -0.37]);
    this.kit.mesh(facade, 'arch', accent, [2.8, 2.8, 0.6], [0, 2.4, -0.35]);
    for (const x of [-2.8, 2.8]) this.kit.mesh(facade, 'box', accent, [0.75, 2.4, 0.8], [x, 1.2, -0.35]);
    const roof = this.kit.material(0x456e70), trim = this.kit.material(0x6a9290);
    this.kit.mesh(facade, 'roof', roof, [17, 3.6, 5], [0, 4.55, -2], 'chapel-gabled-roof');
    this.kit.mesh(facade, 'roof', stone, [16.1, 3.1, 0.13], [0, 4.75, 0.56], 'chapel-stone-gable');
    for (const side of [-1, 1]) this.kit.beam(facade, trim, [side * 8.1, 4.68, 0.7], [0, 8.08, 0.7], 0.17);
    this.kit.mesh(facade, 'box', trim, [0.25, 0.22, 5.3], [0, 8.18, -2], 'chapel-roof-ridge');
    for (const x of [-8.35, 8.35]) this.kit.mesh(facade, 'box', trim, [0.3, 0.24, 5.3], [x, 4.55, -2]);
    const glass = this.kit.material(0x537b7c);
    this.kit.mesh(facade, 'sphere', glass, [2, 2, 0.09], [0, 6.15, 0.72], 'chapel-rose-window');
    this.kit.mesh(facade, 'wheel', gold, [2, 2, 0.25], [0, 6.15, 0.77]);
    this.kit.mesh(facade, 'box', gold, [1.8, 0.1, 0.07], [0, 6.15, 0.8]);
    this.kit.mesh(facade, 'box', gold, [0.1, 1.8, 0.07], [0, 6.15, 0.8]);
    for (const x of [-7.2, 7.2]) this.kit.mesh(facade, 'box', stone, [1.1, 5.6, 2.5], [x, 2.8, -0.3]);
    this.kit.mesh(facade, 'box', gold, [0.28, 2, 0.28], [0, 8.95, -2]);
    this.kit.mesh(facade, 'box', gold, [1.25, 0.28, 0.28], [0, 9.25, -2]);
    for (const x of [-5, 5]) { this.torch(facade, x, 0.2, 0.45); this.kit.mesh(facade, 'banner', accent, [1, 2, 1], [x, 3.45, -0.48]); }
    for (const x of [-4.8, 4.8]) {
      this.kit.mesh(facade, 'box', dark, [1.35, 1.6, 0.12], [x, 2.75, -0.46], 'chapel-stained-window');
      this.kit.mesh(facade, 'box', glass, [1.08, 1.32, 0.1], [x, 2.75, -0.37]);
      this.kit.mesh(facade, 'box', gold, [0.12, 1.45, 0.11], [x, 2.75, -0.3]);
    }
    const bell = this.kit.group('chapel-bell', 20.5, -27.8); bell.rotation.y = 0.19;
    for (const x of [-1.5, 1.5]) this.kit.mesh(bell, 'box', stone, [0.9, 6.8, 1.7], [x, 3.4, 0]);
    this.kit.mesh(bell, 'box', stone, [4, 0.8, 2], [0, 7.05, 0]);
    this.kit.mesh(bell, 'roof', roof, [5, 2, 3], [0, 7.4, 0], 'bell-tower-roof');
    this.kit.mesh(bell, 'bell', gold, [2.3, 1.45, 2.3], [0, 5.7, 0], 'flared-chapel-bell');
    this.kit.mesh(bell, 'cylinder', gold, [2.35, 0.15, 2.35], [0, 5.06, 0], 'chapel-bell-rim');
    this.kit.mesh(bell, 'sphere', dark, [0.4, 0.6, 0.4], [0, 4.94, 0]);
    this.garden('chapel-herb-garden', -21, -25.8, 5.5, 0x6e8975).rotation.y = 0.3;
    this.garden('chapel-herb-garden', 10.5, -25.1, 3.7, 0x6e8975).rotation.y = -0.48;
    this.tree(-27, -26.6, 3); this.tree(-31.5, -29.3, 7); this.tree(29, -26.1, 4);
    for (const [x, z, yaw] of [[-34, -3.5, 1.28], [34.8, 10, 1.68]] as const) {
      const arch = this.kit.group('broken-chapel-arch', x, z); arch.rotation.y = yaw;
      for (const side of [-1, 1]) this.kit.mesh(arch, 'box', stone, [0.85, side < 0 ? 3.8 : 2.3, 1], [side * 2.5, side < 0 ? 1.9 : 1.15, 0]);
      this.kit.mesh(arch, 'arch', stone, [2.5, 2.5, 0.8], [0, 3.7, 0]).rotation.z = 0.13;
    }
    // Flat broken paving fragments are decoration, not pretend obstacles.
    for (const [i, [x, z]] of [[-24, 17.5], [-19.5, 19.8], [-18.2, 17.7], [-7, 20.2], [8.7, 18.2], [10.1, 19.4], [23, 16.1]].entries()) {
      const shard = this.kit.mesh(this.root, 'box', stone, [0.8 + i % 3 * 0.2, 0.045, 0.6], [x!, 0.025, z!]); shard.rotation.y = i * 1.2;
    }
  }
  private tree(x: number, z: number, index: number, burned = false) {
    const group = this.kit.group(burned ? 'charred-orchard-tree' : 'road-dead-tree', x, z), wood = this.kit.material(burned ? 0x2d2927 : 0x4b4347);
    const height = 3.7 + index % 3 * 0.8;
    this.kit.beam(group, wood, [0, 0, 0], [0.15, height, -0.15], 0.5);
    this.kit.beam(group, wood, [0, height * 0.55, 0], [-1.15, height * 0.86, 0.42], 0.23);
    this.kit.beam(group, wood, [0.06, height * 0.7, 0], [1.45, height * 0.97, -0.25], 0.2);
    this.kit.beam(group, wood, [-0.8, height * 0.77, 0.3], [-1.65, height * 1.02, 0.55], 0.12);
    group.rotation.y = index * 1.41;
    if (!burned || index % 3 === 0) {
      const colors = burned ? [0x827759, 0x7f7e60] : [0x668265, 0x789364, 0x9a9361];
      const color = this.kit.material(colors[index % colors.length]!);
      const canopy = burned ? 2.65 : 4.1;
      this.kit.mesh(group, 'leaf', color, [canopy, canopy * 0.67, canopy * 0.9], [0, height * 0.78, -0.15], burned ? 'surviving-orchard-leaves' : 'soft-tree-canopy');
      this.kit.mesh(group, 'leaf', color, [canopy * 0.72, canopy * 0.49, canopy * 0.74], [0.8, height * 1.01, -0.22]);
    }
    return group;
  }
  private cart(x: number, z: number, yaw: number, burned = false) {
    const group = this.kit.group(burned ? 'burned-supply-cart' : 'royal-road-wagon', x, z); group.rotation.y = yaw;
    const { wood, dark } = this.materials(), body = burned ? this.kit.material(0x352e29) : wood;
    this.kit.mesh(group, 'box', body, [2.6, 0.35, 1.8], [0, 0.85, 0]);
    for (const z of [-0.86, 0.86]) this.kit.mesh(group, 'box', body, [2.6, 0.6, 0.13], [0, 1.3, z]);
    this.kit.mesh(group, 'box', body, [0.15, 0.6, 1.8], [-1.25, 1.3, 0]);
    for (const x of [-0.85, 0.85]) for (const z of [-1, 1]) {
      const wheel = this.kit.mesh(group, 'wheel', dark, [1, 1, 1], [x, 0.53, z]); wheel.rotation.y = 0;
      this.kit.mesh(group, 'box', body, [0.1, 0.85, 0.1], [x, 0.53, z]);
    }
    this.kit.beam(group, body, [1.2, 0.65, 0], [3, 0.1, 0], 0.15);
    return group;
  }
  private road() {
    const { stone, gold, accent } = this.materials();
    for (const [i, [x, z]] of [[-34, -18], [-37, -12.5], [-34.5, -7.7], [-35.8, 13], [-33.9, 19.6], [34.9, -14.5], [37.4, -19.2], [34.1, 3.2], [35.8, 7.7], [25.2, 27.8], [20.1, 26.1]].entries())
      this.tree(x!, z!, i);
    for (const [x, z, size] of [[-33.2, -10, 1.6], [-35, 16.5, 1.1], [34, 6.3, 1.4], [21.7, 26, 1.15]] as const)
      this.shrub(this.root, x, z, size, 0x718367);
    this.cart(-22, -27.2, -0.48); this.cart(14, 25.8, 0.73);
    for (const [x, z, yaw] of [[-9.5, -25.5, 0.23], [4.2, 24.6, -0.4]] as const) {
      const marker = this.kit.group('royal-mile-stone', x, z);
      marker.rotation.y = yaw;
      this.kit.mesh(marker, 'box', stone, [1.2, 1.8, 0.6], [0, 0.9, 0]);
      this.kit.mesh(marker, 'box', gold, [0.65, 0.12, 0.05], [0, 1.2, 0.325]);
      this.kit.mesh(marker, 'box', gold, [0.12, 0.65, 0.05], [0, 1.2, 0.325]);
    }
    const gate = this.kit.group('royal-road-sign', 4, -28.5); gate.rotation.y = -0.16;
    for (const x of [-5.8, 5.8]) this.kit.mesh(gate, 'box', stone, [0.8, 5, 0.8], [x, 2.5, 0]);
    this.kit.mesh(gate, 'box', gold, [12.6, 0.3, 0.5], [0, 5.1, 0]);
    for (const x of [-4, 4]) { const flag = this.kit.mesh(gate, 'banner', accent, [1.3, 2.6, 1], [x, 3.8, 0.05]); this.flags.push(flag); }
    const camp = this.kit.group('road-guard-shelter', -16, -26.7); camp.rotation.y = 0.26;
    for (const x of [-1.8, 1.8]) this.kit.mesh(camp, 'box', this.materials().wood, [0.22, 2.7, 0.22], [x, 1.35, 0]);
    this.kit.mesh(camp, 'roof', this.kit.material(0x5f7765), [4.4, 1.8, 3.8], [0, 2.7, -0.5]);
    this.kit.mesh(camp, 'box', this.materials().wood, [3.6, 0.45, 1], [0, 0.45, -0.6]);
    this.garden('roadside-wildflowers', 16, -25.1, 4.2, 0x8a956a).rotation.y = -0.35;
  }
  private outskirts() {
    const { stone, dark, light } = this.materials();
    for (const [i, [x, z]] of [[-34, -19], [-36.4, -11.2], [-34.5, -5.8], [-35.8, 17.3], [34, -13.8], [36.2, -18.3], [34.3, 8.5], [24.6, 27.8]].entries())
      this.tree(x!, z!, i, true);
    for (const [x, z, width, yaw] of [[-22, -26.7, 9.8, 0.2], [-10.7, -25.8, 5.6, -0.29], [20.5, -27.6, 11, -0.24]] as const)
      this.fence('fortress-palisade', x, z, width, true).rotation.y = yaw;
    const collapsed = this.fence('collapsed-palisade', 9, 26.4, 8.8, true); collapsed.rotation.set(0.08, 0.42, 0.12);
    this.cart(-23, 26.5, 0.42, true);
    const watch = this.kit.group('burned-watchtower', 1.5, -29.5); watch.rotation.y = -0.18;
    for (const x of [-2.5, 2.5]) for (const z of [-1.5, 1.5]) this.kit.mesh(watch, 'box', dark, [0.55, 6, 0.55], [x, 3, z]).rotation.z = x * 0.02;
    this.kit.mesh(watch, 'box', dark, [6, 0.5, 4], [0, 5.6, 0]);
    this.kit.mesh(watch, 'box', stone, [5.5, 0.9, 0.25], [0, 6.2, 1.7]);
    for (const x of [-2.8, 2.8]) this.kit.beam(watch, dark, [x, 0.6, 1.5], [-x, 5.4, 1.5], 0.22);
    for (const [x, z] of [[-15, -25], [22, -25], [-21, 25]] as const) {
      const fire = this.kit.group('smoldering-palisade', x, z);
      this.kit.mesh(fire, 'sphere', light, [1.1, 0.16, 0.65], [0, 0.08, 0]);
      this.kit.mesh(fire, 'box', dark, [2.2, 0.2, 0.3], [0, 0.2, 0]).rotation.y = 0.6;
    }
    for (const [x, z] of [[-28.7, -25.3], [-25.5, -24.7], [26.6, -26.4]] as const) this.shrub(this.root, x, z, 1.4, 0x827b5b);
    for (const [x, z, yaw] of [[-15.8, -26.3, -0.32], [28.2, -25.8, 0.41]] as const) {
      const supplies = this.kit.group('fortress-supply-stacks', x, z); supplies.rotation.y = yaw;
      for (let i = 0; i < 3; i++) this.kit.mesh(supplies, 'box', this.kit.material(0x89755b), [1.1, 0.8, 0.9], [(i - 1) * 0.91, 0.4 + i % 2 * 0.5, i % 2 * 0.37]).rotation.y = i * 0.17;
    }
    this.kit.mesh(watch, 'roof', this.kit.material(0x5a655c), [6.7, 1.5, 4.4], [0, 6.8, 0], 'watchtower-broken-roof');
    this.kit.mesh(watch, 'banner', this.kit.material(0xa59d84), [1.2, 1.7, 1], [1.8, 5.7, 1.85]);
    this.smokePlumes();
  }
  private smokePlumes() {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], phase: number[] = [];
    for (let i = 0; i < 30; i++) { const source = [[-15, -25], [22, -25], [-21, 25]][i % 3]!; positions.push(source[0]!, 0, source[1]!); phase.push(i * 0.137); }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 } },
      vertexShader: `attribute float phase; uniform float time; varying float age;
        void main() { age = fract(phase + time * .09); vec3 p = position + vec3(age * 2.5 + sin(phase*19.)*.8, age * 5. + .3, sin(phase*11.)*age);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); gl_PointSize = 18. + age * 38.; }`,
      fragmentShader: `varying float age; void main() { float d = length(gl_PointCoord-.5)*2.; if(d>1.) discard;
        gl_FragColor=vec4(vec3(.27,.24,.23), pow(1.-d,1.4)*(1.-age)*.28); #include <colorspace_fragment> }`.replace('#include <colorspace_fragment>', '\n#include <colorspace_fragment>\n'),
    });
    this.kit.own(geometry, material); this.smoke = material;
    const smoke = new THREE.Points(geometry, material); smoke.name = 'bounded-ash-smoke'; smoke.frustumCulled = false; this.root.add(smoke);
  }
  private banner(parent: THREE.Object3D, x: number, z: number) {
    const { gold, accent } = this.materials();
    this.kit.mesh(parent, 'box', gold, [0.16, 2.4, 0.16], [x, 5.3, z]);
    const flag = this.kit.mesh(parent, 'banner', accent, [1.6, 2.5, 1], [x + 0.72, 5.1, z]); this.flags.push(flag);
    this.kit.mesh(parent, 'cone', gold, [0.5, 0.7, 0.2], [x + 0.72, 5.15, z + 0.04]).rotation.z = Math.PI;
  }
  private castle() {
    const { stone, dark, gold, black } = this.materials();
    const wall = this.kit.group('castle-curtain-wall');
    for (const [x, z, width, yaw] of [[-19.5, -30.2, 20, 0.16], [23, -31.4, 15, -0.22]] as const) {
      const wing = this.kit.group('castle-wall-wing', x, z); wall.add(wing); wing.rotation.y = yaw;
      this.kit.mesh(wing, 'box', stone, [width, 5.5, 1.8], [0, 2.75, -0.7]);
      const merlons = Math.round(width / 2.7);
      for (let i = 0; i < merlons; i++) this.kit.mesh(wing, 'box', stone, [1.5, 0.9, 1.8], [-width / 2 + 1.2 + i * (width - 2.4) / (merlons - 1), 5.95, -0.7]);
      this.kit.mesh(wing, 'box', dark, [width, 0.23, 2.1], [0, 0.8, -0.7], 'castle-stone-course');
      for (const offset of [-width * 0.36, width * 0.08, width * 0.38]) {
        this.kit.mesh(wing, 'box', stone, [0.8, 5.5, 2.4], [offset, 2.75, -0.35], 'castle-buttress');
        this.kit.mesh(wing, 'box', dark, [0.48, 1.3, 0.1], [offset + 1.9, 3.1, 0.25], 'castle-arrow-window');
      }
    }
    const gate = this.kit.group('castle-iron-gates', 4, -28.8); gate.rotation.y = -0.065;
    this.kit.mesh(gate, 'box', black, [14, 5.7, 0.2], [0, 2.85, -1]);
    for (const x of [-7.5, 7.5]) this.kit.mesh(gate, 'box', stone, [1.2, 6.4, 2], [x, 3.2, 0]);
    this.kit.mesh(gate, 'arch', stone, [7.3, 3.5, 1.1], [0, 4.1, 0]);
    for (let i = -6; i <= 6; i++) this.kit.mesh(gate, 'box', dark, [0.12, 5.7, 0.18], [i, 2.85, 0.3]);
    for (const y of [1.6, 3.5]) this.kit.mesh(gate, 'box', gold, [13, 0.12, 0.18], [0, y, 0.35]);
    const towers = this.kit.group('castle-towers');
    for (const [x, z, height] of [[-29, -30, 7], [29.6, -33.4, 8.2]] as const) {
      this.kit.mesh(towers, 'cylinder', stone, [4.8, height, 4.8], [x, height / 2, z]);
      this.kit.mesh(towers, 'cylinder', dark, [5.1, 0.7, 5.1], [x, height - 0.15, z]);
      for (let i = 0; i < 6; i++) this.kit.mesh(towers, 'box', stone, [0.9, 1, 0.9], [x + Math.cos(i * Math.PI / 3) * 2, height + 0.5, z + Math.sin(i * Math.PI / 3) * 2]);
      this.banner(towers, x, z + 2.8);
      this.kit.mesh(towers, 'cone', this.kit.material(0x657d83), [4.7, 2.6, 4.7], [x, height + 2.1, z], 'castle-slate-spire').rotation.y = Math.PI / 4;
      this.kit.mesh(towers, 'box', black, [0.45, 1.4, 0.12], [x, height - 2.4, z + 2.45]);
    }
    const flags = this.kit.group('castle-banners'); this.banner(flags, -18, -27.7); this.banner(flags, 23.3, -28.9);
    const throne = this.kit.group('castle-throne', 3.4, -25.1); throne.rotation.y = -0.12;
    this.kit.mesh(throne, 'box', dark, [4.2, 0.2, 2.4], [0, 0.1, 0]);
    this.kit.mesh(throne, 'box', stone, [1.8, 1.1, 1.4], [0, 0.75, 0]);
    this.kit.mesh(throne, 'box', gold, [2.2, 2.8, 0.3], [0, 1.9, -0.65]);
    for (const x of [-0.75, 0, 0.75]) this.kit.mesh(throne, 'cone', gold, [0.6, x === 0 ? 1.1 : 0.7, 0.35], [x, 3.5, -0.65]);
    for (const [x, z] of [[-25.8, -25.2], [25.7, -26.8], [23.4, 25.6]] as const) this.torch(this.root, x, 0, z);
    const tombs = this.kit.group('royal-boundary-tombs');
    for (const [x, z, yaw] of [[-34.3, -8.5, 0.26], [-35.1, 8.8, -0.21], [34.1, 4.8, -0.35]] as const) {
      const tomb = this.kit.group('royal-tomb', x, z); tombs.add(tomb); tomb.rotation.y = yaw;
      this.kit.mesh(tomb, 'box', stone, [2.4, 0.9, 3.1], [0, 0.45, 0]);
      this.kit.mesh(tomb, 'box', stone, [2.5, 0.16, 3.2], [0, 0.98, 0]);
      this.kit.mesh(tomb, 'box', gold, [0.28, 0.03, 2.4], [0, 1.07, 0]);
      this.shrub(this.root, x + (x < 0 ? -0.5 : 0.5), z + 2.8, 1.5, 0x6d8a75);
    }
    for (const [x, z, width, yaw] of [[-20, 25.7, 6.3, -0.28], [-13.8, 26.9, 3.8, 0.43], [21.5, -25.7, 4.5, 0.2]] as const)
      this.garden('formal-courtyard-gardens', x, z, width, 0x627e6d).rotation.y = yaw;
    for (const [x, z, length, yaw] of [[-34.4, -15.6, 8.3, 1.32], [-35.3, 16.4, 6.2, 1.83], [34.7, -8.5, 9.2, 1.77], [33.4, 14.8, 5.7, 1.23]] as const)
      this.lowWall(x, z, length, yaw);
  }
  update(dt: number) {
    this.time += dt;
    for (const [i, flag] of this.flags.entries()) flag.rotation.y = Math.sin(this.time * 1.8 + i * 1.4) * 0.14;
    for (const [i, flame] of this.flames.entries()) flame.scale.y = 0.52 + Math.sin(this.time * 9 + i * 2.7) * 0.05;
    if (this.smoke) this.smoke.uniforms.time!.value = this.time;
  }
  destroy() { this.kit.destroy(); this.flags.length = this.flames.length = 0; this.smoke = null; }
}
