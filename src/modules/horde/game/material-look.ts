import * as THREE from 'three';
import { SITES } from './rules';
import { locationForWave, type LocationDefinition } from '../data/campaign';

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
  [-24.4, -24.5], [-9.8, -23.8], [15.2, -26.2], [27.2, -24.1],
  [-26.2, 25.2], [-13.5, 23.7], [7.4, 26.8], [25.8, 24.4],
] as const;

export function terrainMaterial() {
  const active = { value: new Float32Array(SITES.length) };
  const theme = { value: 0 }, soilColor = { value: new THREE.Color() }, stoneColor = { value: new THREE.Color() }, accentColor = { value: new THREE.Color() };
  const themes = ['graveyard', 'chapel', 'road', 'outskirts', 'castle'];
  const setLocation = (location: LocationDefinition) => {
    theme.value = themes.indexOf(location.id); soilColor.value.setHex(location.palette.soil);
    stoneColor.value.setHex(location.palette.stone); accentColor.value.setHex(location.palette.accent);
  };
  setLocation(locationForWave(1));
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.uniforms.hordeSite = active;
    shader.uniforms.hordeTheme = theme; shader.uniforms.hordeSoil = soilColor;
    shader.uniforms.hordeStone = stoneColor; shader.uniforms.hordeAccent = accentColor;
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
      uniform float hordeTheme;
      uniform vec3 hordeSoil, hordeStone, hordeAccent;
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
      // Keep the battlefield quiet: scenery owns silhouettes, warnings own saturated colors.
      vec3 soil = hordeSoil * (0.86 + broad * 0.25);
      float path = 1e10;
      for (int i = 0; i < ${SITES.length - 1}; i++) {
        vec2 wornXZ = arenaXZ + vec2(sin(arenaXZ.y*.19+float(i))*1.3, sin(arenaXZ.x*.16-float(i))*1.1) + (drift-.5)*1.2;
        path = min(path, pathDistance(wornXZ, hordeSites[i], hordeSites[i + 1]));
      }
      float worn = 1.0 - smoothstep(0.8, 2.8, path + (broad - 0.5) * 1.8);
      if (hordeTheme < 0.5) soil = mix(soil, vec3(0.093, 0.084, 0.058), worn * 0.32);
      if (hordeTheme > 0.5 && hordeTheme < 1.5) {
        vec2 courtXZ = mat2(.985,-.174,.174,.985) * (arenaXZ-vec2(-3.,-1.5));
        vec2 laid = courtXZ + (drift-.5)*.55;
        vec2 cells = (laid + vec2(mod(floor(laid.y / 3.1), 2.) * 2., 0.)) / vec2(4., 3.1);
        vec2 tile = fract(cells);
        float seam = min(min(tile.x, 1.-tile.x), min(tile.y, 1.-tile.y));
        float joint = 1. - smoothstep(.008, .018 + max(fwidth(tile.x), fwidth(tile.y)) * .35, seam);
        float variation = groundHash(floor(cells));
        vec3 paving = hordeStone * (.56 + variation * .06 + broad * .05);
        paving *= 1. - joint * .13;
        float edge = length(courtXZ / vec2(24.,18.)) + (broad-.5)*.21 + sin(courtXZ.y*.23)*.045;
        float court = 1. - smoothstep(.83,1.07,edge);
        float approachX = -3. + sin(arenaXZ.y*.13)*1.7;
        float approach = (1.-smoothstep(2.8,4.8,abs(arenaXZ.x-approachX)+(broad-.5)*1.6)) * smoothstep(10.,18.,-arenaXZ.y);
        float lostStone = smoothstep(.59,.74,groundNoise(arenaXZ*.22+8.7)) * smoothstep(.4,.92,edge);
        court *= 1.-lostStone*.55;
        soil = mix(soil, paving, max(court, approach));
        // A little moss softens the paving edges without obscuring enemies.
        soil = mix(soil, hordeSoil * .92, (1.-smoothstep(.1,.65,court)) * court * .28);
      }
      if (hordeTheme > 1.5 && hordeTheme < 2.5) {
        float centerline = sin(arenaXZ.y*.066+.7)*3.2 + sin(arenaXZ.y*.17)*1.15 - 1.8;
        float across = abs(arenaXZ.x - centerline);
        float shoulder = across + sin(arenaXZ.y*.18+.5)*.6 + (broad-.5)*2.2;
        float road = 1. - smoothstep(4.1,6.7,shoulder);
        float rutLine = 2.6 + sin(arenaXZ.y*.21)*.25;
        float ruts = (1.-smoothstep(.12,.45,abs(across-rutLine))) * smoothstep(.25,.65,broad);
        vec3 dirt = hordeStone * (.66 + broad * .14);
        dirt *= 1. - ruts * .13;
        soil = mix(soil, dirt, road);
      }
      if (hordeTheme > 2.5 && hordeTheme < 3.5) {
        float ash = .3 + broad * .35;
        soil = mix(hordeSoil * .81, hordeStone * .62, ash);
        float scorched = smoothstep(.45, .75, groundNoise(arenaXZ * .28 + drift));
        soil *= 1. - scorched * .14;
        float road = 1.-smoothstep(3.,6.2,abs(arenaXZ.x-sin(arenaXZ.y*.09+.6)*3.4)+(broad-.5)*2.);
        soil = mix(soil, hordeStone * .59, road * .32);
        // Localized embers stay on the burned perimeter, never across the combat floor.
        soil += vec3(.016,.006,.001) * pow(grain, 28.) * smoothstep(21.,26.,abs(arenaXZ.y));
      }
      if (hordeTheme > 3.5) {
        vec2 courtXZ = mat2(.996,.087,-.087,.996) * (arenaXZ-vec2(2.5,-2.));
        vec2 cells = (courtXZ+(drift-.5)*.38) / vec2(4.5,3.8), tile = fract(cells);
        float seam = min(min(tile.x,1.-tile.x),min(tile.y,1.-tile.y));
        float joint = 1. - smoothstep(.007, .016 + max(fwidth(tile.x),fwidth(tile.y))*.35, seam);
        float variation = groundHash(floor(cells));
        vec3 paving = hordeStone * (.56 + broad * .065 + variation * .025);
        paving *= 1. - joint * .12;
        float edge = length(courtXZ/vec2(28.,21.5)) + (broad-.5)*.19 + sin(courtXZ.x*.19+courtXZ.y*.13)*.04;
        float court = 1.-smoothstep(.84,1.09,edge);
        float overgrown = smoothstep(.6,.8,groundNoise(arenaXZ*.24-7.3)) * smoothstep(.47,.96,edge);
        court *= 1.-overgrown*.62;
        soil = mix(soil, paving, court);
      }
      soil *= 0.98 + grain * 0.04;
      // A broad, weathered falloff surrounds the land without drawing the movement rectangle.
      vec2 outskirts = arenaXZ + (drift-.5)*3.5 + vec2(sin(arenaXZ.y*.11)*1.7,sin(arenaXZ.x*.09)*1.3);
      float border = smoothstep(1.08,1.58,length(outskirts/vec2(39.,30.))+(broad-.5)*.09);
      diffuseColor.rgb = soil * (1.0 - border * 0.65);
      `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      for (int i = 0; i < ${LAMPS.length}; i++) {
        vec2 delta = arenaXZ - hordeLamps[i];
        totalEmissiveRadiance += vec3(0.19, 0.077, 0.020) * exp(-dot(delta, delta) * 0.22) * (hordeTheme < .5 ? 1. : .1);
      }
      for (int i = 0; i < ${SITES.length}; i++) {
        float d = length(arenaXZ - hordeSites[i]);
        totalEmissiveRadiance += vec3(0.025, 0.19, 0.14) * exp(-d*d*0.16) * hordeSite[i];
      }`);
  };
  material.customProgramCacheKey = () => `horde-campaign-ground-v3-${SITES.length}-${LAMPS.length}`;
  return { material, active, setLocation };
}

export function moonlight(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x152b30);
  const hemisphere = new THREE.HemisphereLight(0xb3d8ee, 0x59694a, 1.6); scene.add(hemisphere);
  const moon = new THREE.DirectionalLight(0xd3e6ff, 2.8);
  moon.position.set(-18, 35, -12); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -39, right: 39, top: 34, bottom: -34, near: 1, far: 100 });
  moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.03;
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0xffd1a2, 0.8); fill.position.set(12, 14, 22); scene.add(fill);
  return { setLocation(location: LocationDefinition) {
    scene.background = new THREE.Color(location.palette.sky);
    hemisphere.color.setHex(location.palette.moon); hemisphere.groundColor.setHex(location.palette.low);
    moon.color.setHex(location.palette.moon); fill.color.setHex(location.palette.fill);
  } };
}
