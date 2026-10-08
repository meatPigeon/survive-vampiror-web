import * as THREE from 'three';
import { SITES } from './rules';

// Keep Three's skinning, shadows and color pipeline; add only a soft silhouette light.
// Material.clone() does not copy onBeforeCompile, so Actor reapplies this to its owned copies.
export function characterLight(material: THREE.MeshStandardMaterial, knight: boolean) {
  const tint = new THREE.Color(knight ? 0xffd89b : 0x9ee9d3);
  material.onBeforeCompile = shader => {
    shader.uniforms.hordeRim = { value: tint };
    shader.fragmentShader = `uniform vec3 hordeRim;\n${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
      float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
      outgoingLight += hordeRim * rim * 0.24;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `horde-rim-v1-${knight ? 'gold' : 'mint'}`;
}

export const LAMPS = [
  [-25, -23.4], [-8, -23.4], [12, -23.4], [27, -23.4],
  [-25, 23.4], [-7, 23.4], [13, 23.4], [27, 23.4],
] as const;

export function terrainMaterial() {
  const active = { value: new Float32Array(SITES.length) };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.uniforms.hordeSite = active;
    shader.uniforms.hordeSites = { value: SITES.map(p => new THREE.Vector2(p.x, p.z)) };
    shader.uniforms.hordeLamps = { value: LAMPS.map(([x, z]) => new THREE.Vector2(x, z)) };
    shader.vertexShader = `varying vec2 arenaXZ;\n${shader.vertexShader}`.replace('#include <project_vertex>', `
      arenaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
      #include <project_vertex>`);
    shader.fragmentShader = `
      varying vec2 arenaXZ;
      uniform float hordeSite[${SITES.length}];
      uniform vec2 hordeSites[${SITES.length}];
      uniform vec2 hordeLamps[${LAMPS.length}];
      float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float groundNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(groundHash(i), groundHash(i + vec2(1.,0.)), f.x),
                   mix(groundHash(i + vec2(0.,1.)), groundHash(i + vec2(1.,1.)), f.x), f.y);
      }
      float pathDistance(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a; return length(p - a - ab * clamp(dot(p-a,ab) / dot(ab,ab), 0.,1.));
      }
      ${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 drift = vec2(groundNoise(arenaXZ * 0.31), groundNoise(arenaXZ * 0.31 + 19.0));
      float broad = groundNoise(arenaXZ * 0.14 + drift * 1.6);
      float grain = groundNoise(arenaXZ * 3.7);
      vec3 soil = mix(vec3(0.037, 0.061, 0.056), vec3(0.065, 0.096, 0.060), broad);
      float path = 1e10;
      for (int i = 0; i < ${SITES.length - 1}; i++) {
        path = min(path, pathDistance(arenaXZ, hordeSites[i], hordeSites[i + 1]));
      }
      float worn = 1.0 - smoothstep(0.8, 2.8, path + (broad - 0.5) * 1.8);
      soil = mix(soil, vec3(0.093, 0.084, 0.058), worn * 0.65);
      soil *= 0.96 + grain * 0.08;
      float border = smoothstep(28.0, 36.0, max(abs(arenaXZ.x), abs(arenaXZ.y) * 1.35));
      diffuseColor.rgb = soil * (1.0 - border * 0.65);
      `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      for (int i = 0; i < ${LAMPS.length}; i++) {
        vec2 delta = arenaXZ - hordeLamps[i];
        totalEmissiveRadiance += vec3(0.19, 0.077, 0.020) * exp(-dot(delta, delta) * 0.22);
      }
      for (int i = 0; i < ${SITES.length}; i++) {
        float d = length(arenaXZ - hordeSites[i]);
        totalEmissiveRadiance += vec3(0.025, 0.19, 0.14) * exp(-d*d*0.16) * hordeSite[i];
      }`);
  };
  material.customProgramCacheKey = () => `horde-ground-v2-${SITES.length}-${LAMPS.length}`;
  return { material, active };
}

export function moonlight(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x152b30);
  scene.add(new THREE.HemisphereLight(0xb3d8ee, 0x59694a, 1.6));
  const moon = new THREE.DirectionalLight(0xd3e6ff, 2.8);
  moon.position.set(-18, 35, -12); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -39, right: 39, top: 34, bottom: -34, near: 1, far: 100 });
  moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.03;
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0xffd1a2, 0.8); fill.position.set(12, 14, 22); scene.add(fill);
}
