import * as THREE from 'three';

/** Small owned mesh kit: shapes and materials are shared only inside one location. */
export class SceneryMeshes {
  readonly root = new THREE.Group();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.Material>();
  private destroyed = false;
  material(color: number, glow = false, opacity = 1) {
    const key = `${color}-${glow}-${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = glow ? new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity === 1 })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
      this.materials.set(key, material);
    }
    return material;
  }
  private geometry(shape: string) {
    let geometry = this.geometries.get(shape);
    if (!geometry) {
      if (shape === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
      else if (shape === 'bell') geometry = new THREE.CylinderGeometry(0.25, 0.5, 1, 10);
      else if (shape === 'cone') geometry = new THREE.ConeGeometry(0.5, 1, 4);
      else if (shape === 'sphere') geometry = new THREE.SphereGeometry(0.5, 6, 4);
      else if (shape === 'leaf') geometry = new THREE.IcosahedronGeometry(0.5, 1);
      else if (shape === 'wheel') geometry = new THREE.TorusGeometry(0.5, 0.08, 4, 10);
      else if (shape === 'arch') geometry = new THREE.TorusGeometry(1, 0.16, 4, 14, Math.PI);
      else if (shape === 'roof') {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5,0,-.5, .5,0,-.5, 0,1,-.5, -.5,0,.5, .5,0,.5, 0,1,.5], 3));
        geometry.setIndex([0,2,1, 3,4,5, 0,3,5, 0,5,2, 1,2,5, 1,5,4, 0,1,4, 0,4,3]); geometry.computeVertexNormals();
      }
      else if (shape === 'banner') {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.35, 0, 0.5, -0.35, 0, 0, -0.5, 0], 3));
        geometry.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3]); geometry.computeVertexNormals();
      } else geometry = new THREE.BoxGeometry(1, 1, 1);
      this.geometries.set(shape, geometry);
    }
    return geometry;
  }
  mesh(parent: THREE.Object3D, shape: string, material: THREE.Material, size: [number, number, number], at: [number, number, number], name = '') {
    const mesh = new THREE.Mesh(this.geometry(shape), material); mesh.name = name;
    mesh.scale.set(...size); mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  group(name: string, x = 0, z = 0) { const group = new THREE.Group(); group.name = name; group.position.set(x, 0, z); this.root.add(group); return group; }
  beam(parent: THREE.Object3D, material: THREE.Material, from: [number, number, number], to: [number, number, number], width: number) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    const mid = a.add(b).multiplyScalar(0.5);
    const mesh = this.mesh(parent, 'cylinder', material, [width, d.length(), width], [mid.x, mid.y, mid.z]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return mesh;
  }
  own(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.geometries.set(`owned-${this.geometries.size}`, geometry); this.materials.set(`owned-${this.materials.size}`, material);
  }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.root.removeFromParent();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.root.clear(); this.geometries.clear(); this.materials.clear();
  }
}
