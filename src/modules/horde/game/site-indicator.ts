import * as THREE from 'three';
const color = new THREE.Color(0xb7e4d5), trackColor = new THREE.Color(0x354b43);
function ring(fraction: number, base: THREE.Color) {
  const vertices: number[] = [], colors: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, shade = 1) => {
    for (const p of [a, b, c, a, c, d]) { vertices.push(p.x, p.y, p.z); colors.push(base.r * shade, base.g * shade, base.b * shade); }
  };
  const top = new THREE.Vector3(0, 0.1, 0), n = Math.ceil(72 * fraction);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / 72, b = Math.min(Math.PI * 2 * fraction, Math.PI * 2 * (i + 1) / 72);
    const from = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), to = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
    const ia = from.clone().multiplyScalar(2.55), oa = from.clone().multiplyScalar(2.83), ib = to.clone().multiplyScalar(2.55), ob = to.clone().multiplyScalar(2.83);
    quad(ia.clone().add(top), oa.clone().add(top), ob.clone().add(top), ib.clone().add(top));
    quad(oa, ob, ob.clone().add(top), oa.clone().add(top), 0.7); quad(ib, ia, ia.clone().add(top), ib.clone().add(top), 0.58);
    if (i === 0) quad(ia, oa, oa.clone().add(top), ia.clone().add(top), 0.8);
    if (i === n - 1) quad(ob, ib, ib.clone().add(top), ob.clone().add(top), 0.8);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return geometry;
}
export function siteIndicator() {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const track = new THREE.Mesh(ring(1, trackColor), material), fill = new THREE.Mesh(ring(1, color), material.clone());
  const center = new THREE.Vector3(0, 0.1, -3.38), points = [[0, 0, -0.45], [0.32, 0, 0], [0, 0, 0.45], [-0.32, 0, 0]].map(p => new THREE.Vector3(...p as [number, number, number]));
  const vertices: number[] = [];
  for (let i = 0; i < 4; i++) { const a = points[i]!, b = points[(i + 1) % 4]!, c = b.clone().multiplyScalar(0.5), d = a.clone().multiplyScalar(0.5); for (const p of [a, b, c, a, c, d]) vertices.push(p.x + center.x, p.y + center.y, p.z + center.z); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  for (const [i, mesh] of [track, fill, marker].entries()) { mesh.position.y = 0.07 + (i === 1 ? 0.006 : 0); mesh.renderOrder = i + 11; mesh.visible = false; }
  return { track, fill, marker, geometry: (fraction: number) => ring(fraction, color) };
}
