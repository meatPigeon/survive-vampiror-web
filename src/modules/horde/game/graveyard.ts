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
    // Old stone runs survive in short, bowed fragments with long gaps between them.
    const edges: [number, number, number][] = [];
    const fragments = [[-21,-23.8,10,.17], [19,-25.6,7,-.26], [-16,25,8,-.19],
      [21,24.5,5,.31], [-32.8,-7,8,1.4], [33.2,6,7,1.75]] as const;
    for (const [cx,cz,count,yaw] of fragments) for (let i=0;i<count;i++) {
      if (i % 5 === 2) continue;
      const along=(i-(count-1)/2)*1.55 + Math.sin(i*2.7)*.18;
      const bend=Math.sin(along*.38+cx)*.5;
      edges.push([cx+along*Math.cos(yaw)-bend*Math.sin(yaw),cz+along*Math.sin(yaw)+bend*Math.cos(yaw),yaw]);
    }
    const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5,0), stone, edges.length);
    stones.name = 'broken-graveyard-stone-runs';
    const dummy = new THREE.Object3D();
    edges.forEach(([x, z, yaw], i) => {
      dummy.position.set(x, 0.065, z); dummy.rotation.set(0, yaw + Math.sin(i * 12.3) * .4, 0);
      dummy.scale.set(.86+(i%5)*.08, .14, .55+(i%3)*.09); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
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
