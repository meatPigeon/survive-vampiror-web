import * as THREE from 'three';
import { LAMPS } from './material-look';

/** Decorative props sit outside the movement rectangle; they never affect collision. */
export class Graveyard {
  readonly root = new THREE.Group();
  private flames: THREE.Mesh[] = [];
  private time = 0;
  constructor(grave: THREE.Object3D) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x667e78, roughness: 1 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x725a3b, metalness: 0.35, roughness: 0.65 });
    const wax = new THREE.MeshStandardMaterial({ color: 0xe3c98e, roughness: 0.9 });
    const ember = new THREE.MeshBasicMaterial({ color: 0xffc56b, toneMapped: false });
    const fire = new THREE.SphereGeometry(0.085, 5, 4);
    const candle = new THREE.CylinderGeometry(0.08, 0.09, 0.34, 6);
    const cup = new THREE.CylinderGeometry(0.2, 0.18, 0.1, 6);
    const pillar = new THREE.BoxGeometry(0.6, 0.45, 0.6);
    for (const [i, [x, z]] of LAMPS.entries()) {
      const group = new THREE.Group(); group.position.set(x, 0, z); this.root.add(group);
      const base = new THREE.Mesh(pillar, stone); base.position.y = 0.225; base.castShadow = true; group.add(base);
      const tray = new THREE.Mesh(cup, brass); tray.position.y = 0.5; group.add(tray);
      for (let j = 0; j < 3; j++) {
        const dx = (j - 1) * 0.17, dz = j === 1 ? -0.09 : 0.03;
        const body = new THREE.Mesh(candle, wax); body.position.set(dx, 0.71 + j * 0.035, dz); group.add(body);
        const flame = new THREE.Mesh(fire, ember); flame.position.set(dx, 0.94 + j * 0.035, dz); flame.scale.y = 1.8; group.add(flame); this.flames.push(flame);
      }
      const marker = grave.clone(true); marker.position.set(x + (i % 2 ? 1.6 : -1.6), 0, z + (z < 0 ? -0.2 : 0.2));
      marker.rotation.set(0, (i % 3 - 1) * 0.22 + (z > 0 ? Math.PI : 0), (i % 2 - 0.5) * 0.09);
      marker.scale.setScalar(0.9 + (i % 3) * 0.12); this.root.add(marker);
    }
    // One instanced draw for worn boundary stones, leaving the interior clear.
    const edges: [number, number, number][] = [];
    for (let x = -29; x <= 29; x += 1.25) for (const z of [-22.6, 22.6]) edges.push([x, z, 0]);
    for (let z = -21; z <= 21; z += 1.25) for (const x of [-30.6, 30.6]) edges.push([x, z, Math.PI / 2]);
    const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1.08, 0.11, 0.48), stone, edges.length);
    const dummy = new THREE.Object3D();
    edges.forEach(([x, z, yaw], i) => {
      dummy.position.set(x, 0.045, z); dummy.rotation.set(0, yaw + Math.sin(i * 12.3) * 0.08, 0);
      dummy.scale.set(0.9 + (i % 5) * 0.025, 1, 0.9 + (i % 3) * 0.05); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
      stones.setColorAt(i, new THREE.Color().setHSL(0.43, 0.1, 0.58 + (i % 4) * 0.025));
    });
    stones.receiveShadow = true; this.root.add(stones);
  }
  update(dt: number) {
    this.time += dt;
    this.flames.forEach((flame, i) => {
      const pulse = Math.sin(this.time * 9 + i * 2.7) * 0.12 + Math.sin(this.time * 15 + i) * 0.06;
      flame.scale.set(1 - pulse * 0.4, 1.8 + pulse, 1 - pulse * 0.4);
      flame.rotation.z = Math.sin(this.time * 5 + i) * 0.12;
    });
  }
}
