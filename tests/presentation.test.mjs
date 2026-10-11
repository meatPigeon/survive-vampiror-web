import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Actor, ArenaCamera, CombatEffects, campaign, simulation as game } from './load-source.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
const cameraGroundCenter = arena => {
  const ray = new Raycaster(); ray.setFromCamera(new Vector2(), arena.camera);
  const point = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
  assert.ok(point, 'camera center reaches the ground'); return point;
};
test('combat particles stay bounded under bursts, expire, clear on restart and release GPU resources', () => {
  const effects = new CombatEffects();
  effects.burst({ x: 30, z: -22 }, 0xffba58, 1000);
  effects.burst({ x: -30, z: 22 }, 0x8ef1ed, 1000);
  assert.equal(effects.activeCount, 320);
  effects.update(0.1, 25);
  effects.root.traverse(object => {
    if (!object.isPoints) return;
    for (const attribute of Object.values(object.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
  });
  effects.update(2, 25); assert.equal(effects.activeCount, 0);
  effects.event({ type: 'blast', x: 0, z: 0 }); assert.equal(effects.activeCount, 40);
  effects.update(0.01, 25); effects.reset(); assert.equal(effects.activeCount, 0);
  const combat = effects.root.children[0];
  for (let i = 0; i < 320; i++) assert.equal(combat.geometry.attributes.spark.getY(i), 0);
  let released = 0;
  effects.root.traverse(object => {
    if (!object.isPoints) return;
    object.geometry.addEventListener('dispose', () => released++); object.material.addEventListener('dispose', () => released++);
  });
  effects.destroy(); assert.equal(released, 4);
});
test('source camera fits wide/portrait arenas, clamps zoom, excludes locked actors and resets', () => {
  const camera = new ArenaCamera(), world = game.createEncounter();
  camera.resize(1600, 900); near(camera.camera.top * 2, 40.2);
  camera.resize(600, 1000); near(camera.camera.top * 2, 65 / 0.6);
  camera.zoom(100); assert.equal(camera.factor, 0.45);
  for (const a of world.zombies) a.locked = true;
  Object.assign(world.zombies[0], { locked: false, x: 10, z: -5 });
  camera.update(world, 1); near(camera.camera.position.x, 10 * (1 - Math.exp(-8)));
  near(cameraGroundCenter(camera).z, -5 * (1 - Math.exp(-8)));
  const position = camera.camera.position.clone(); world.zombies[0].locked = true;
  camera.update(world, 1); assert.deepEqual(camera.camera.position, position);
  camera.zoom(-100); assert.equal(camera.factor, 1.25); camera.update(world, 10);
  near(cameraGroundCenter(camera).x, 0); near(cameraGroundCenter(camera).z, 0);
  camera.reset(); assert.equal(camera.factor, 1); near(camera.camera.top * 2, 65 / 0.6);
});

test('screen/world aiming round trips through the real tilted orthographic camera', () => {
  const camera = new ArenaCamera(); camera.resize(1600, 900);
  const canvas = { getBoundingClientRect: () => ({ left: 25, top: 40, width: 1600, height: 900, right: 1625, bottom: 940 }) };
  for (const point of [{ x: 0, z: 0 }, { x: -14, z: -8 }, { x: 14, z: 8 }]) {
    const screen = camera.screen(canvas, point), aim = camera.aim(canvas, screen.x, screen.y);
    assert.equal(aim.onGround, true); near(aim.point.x, point.x); near(aim.point.z, point.z);
  }
  assert.equal(camera.aim(canvas, 0, 0).onGround, false);
});

test('temporary recruit bomb presentation lowers the real rig, clears on cancellation and death, and releases its fuse', async () => {
  const bytes = await readFile(new URL('../src/modules/horde/assets/reference/temporary_zombie.glb', import.meta.url));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const world = game.createEncounter(); world.status = 'playing'; game.addZombies(world, 1, { x: 0, z: 0 }); game.grantPerk(world, 'mines');
  const recruit = game.alive(world).find(a => a.kind === 'temporary'), actor = new Actor(asset, true);
  let destroyed = false;
  try {
    actor.updateZombie(recruit, world, 1 / 60); actor.root.updateMatrixWorld(true);
    const rig = actor.model.getObjectByName('CharacterRig'), normalScale = rig.scale.clone();
    const normalHeight = new Box3().setFromObject(rig).getSize(new Vector3()).y;
    assert.ok(game.activateAbility(world)); actor.updateZombie(recruit, world, 1 / 60); actor.root.updateMatrixWorld(true);
    const fuse = actor.root.children.find(object => object.isMesh && object.geometry.type === 'OctahedronGeometry');
    assert.ok(fuse?.visible); assert.ok(rig.scale.y < normalScale.y);
    assert.ok(new Box3().setFromObject(rig).getSize(new Vector3()).y < normalHeight);
    const finite = () => actor.root.traverse(object => {
      for (const value of [...object.position, ...object.quaternion, ...object.scale, ...object.matrixWorld.elements]) assert.ok(Number.isFinite(value), object.name);
    });
    finite();
    game.cancelAbilities(world); actor.updateZombie(recruit, world, 0.25); actor.root.updateMatrixWorld(true);
    assert.equal(fuse.visible, false); assert.equal(recruit.locked, false);
    near(rig.scale.x, normalScale.x); near(rig.scale.y, normalScale.y); near(rig.scale.z, normalScale.z); finite();
    game.tickAbility(world, world.abilities[0], game.RULES.mineCooldown); assert.ok(game.activateAbility(world));
    actor.updateZombie(recruit, world, 1 / 60); assert.equal(fuse.visible, true);
    game.damageZombie(world, recruit, recruit.hp); actor.updateZombie(recruit, world, 0.3); actor.root.updateMatrixWorld(true);
    assert.equal(fuse.visible, false); finite();
    let geometriesReleased = 0, materialsReleased = 0;
    fuse.geometry.addEventListener('dispose', () => geometriesReleased++); fuse.material.addEventListener('dispose', () => materialsReleased++);
    actor.destroy(); destroyed = true; assert.equal(geometriesReleased, 1); assert.equal(materialsReleased, 1);
  } finally { if (!destroyed) actor.destroy(); }
});

test('converted runtime GLBs retain independent rigs, authored attacks and finite geometry', async () => {
  const loader = new GLTFLoader();
  for (const name of ['permanent_zombie', 'temporary_zombie', 'knight_wave1', 'knight_wave2', 'knight_wave3', 'arena_environment', 'menu_diorama', 'recruitment_crater', 'tombstone']) {
    const bytes = await readFile(new URL(`../src/modules/horde/assets/reference/${name}.glb`, import.meta.url));
    const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const errors = [], clips = asset.animations.map(clip => clip.name);
    asset.scene.traverse(object => {
      if (!object.isMesh) return;
      for (const value of object.geometry.attributes.position.array) if (!Number.isFinite(value)) errors.push(object.name);
    });
    assert.deepEqual(errors, [], name);
    if (/zombie|knight/.test(name)) {
      for (const clip of ['idle', 'run']) assert.ok(clips.includes(clip), `${name}: ${clip}`);
      const copy = clone(asset.scene), originals = [];
      asset.scene.traverse(object => { if (object.isSkinnedMesh) originals.push(object); });
      assert.ok(originals.length > 0, `${name}: skinned rig`);
      for (const original of originals) {
        const mesh = copy.getObjectByName(original.name); assert.notEqual(mesh.skeleton, original.skeleton);
        assert.notEqual(mesh.skeleton.bones[0], original.skeleton.bones[0]);
      }
      if (/zombie/.test(name)) assert.ok(clips.includes('combat_bite'), `${name}: bite`);
      else {
        for (const attack of ['sweep', 'charge', 'spin', 'crossbow']) assert.ok(clips.some(c => c.startsWith(`combat_${attack}_`)), `${name}: ${attack}`);
        if (name.endsWith('3')) for (const attack of ['rush', 'mounted_run', 'mounted_idle']) assert.ok(clips.some(c => c.startsWith(`combat_${attack}`)), `${name}: ${attack}`);
      }
    }
    for (const clip of asset.animations) assert.ok(Number.isFinite(clip.duration) && clip.duration > 0, `${name}: ${clip.name}`);
    if (/zombie|knight/.test(name)) {
      const world = game.createEncounter(); world.status = 'playing'; world.wave = /3/.test(name) ? 3 : /2/.test(name) ? 2 : 1;
      const actor = new Actor(asset, name.startsWith('temporary'), name.startsWith('knight'));
      if (name.startsWith('knight')) {
        for (const attack of ['sweep', 'charge', 'spin', 'crossbow', ...(world.wave === 3 ? ['rush'] : [])]) {
          game.beginAttack(world, attack, { x: 0, z: 5 });
          for (const state of ['windup', 'strike', 'recovery']) { world.knight.state = state; world.knight.timer = 0.1; actor.updateKnight(world, 1 / 60); }
        }
        for (const location of campaign.CAMPAIGN.filter(location => name.endsWith(String(location.knightModel)))) {
          world.wave = campaign.CAMPAIGN.indexOf(location) + 1; game.beginAttack(world, location.special, { x: 0, z: 5 });
          for (const state of ['windup', 'strike', 'recovery']) {
            world.knight.state = state; world.knight.timer = 0.1; actor.updateKnight(world, 1 / 60);
            actor.root.traverse(object => { for (const value of [...object.position, ...object.quaternion, ...object.scale]) assert.ok(Number.isFinite(value), `${location.id}: ${state}`); });
          }
        }
        world.knight.hp = 0; actor.updateKnight(world, 0.58);
        near(actor.model.getObjectByName('CharacterRig').rotation.z, 1.4);
        near(actor.model.getObjectByName('CharacterRig').position.y, 0.025);
      } else {
        const zombie = world.zombies[0]; zombie.moving = true; zombie.speed = 7.2;
        actor.updateZombie(zombie, world, 1 / 60); actor.bite(); actor.updateZombie(zombie, world, 0.1);
        zombie.hp = 15; actor.updateZombie(zombie, world, 1 / 60); zombie.hp = 0;
        actor.updateZombie(zombie, world, 0.5);
        const rig = actor.model.getObjectByName('CharacterRig'); assert.ok(Math.abs(rig.rotation.z) > 1.5);
      }
      actor.model.traverse(object => { for (const value of [...object.position, ...object.quaternion, ...object.scale]) assert.ok(Number.isFinite(value), `${name}: ${object.name}`); });
      actor.destroy();
    }
  }
});

test('five locations have distinct recognizable architecture, finite animation and no tall scenery inside the movement arena', async () => {
  const { campaign, loadGame } = await import('./load-source.mjs');
  const { LocationScenery } = await loadGame('location-scenery');
  const landmarks = ['crooked-fences', 'chapel-facade', 'royal-road-sign', 'fortress-palisade', 'castle-iron-gates'];
  const counts = new Set(), geometryOwners = new Set(), materialOwners = new Set();
  for (const [index, location] of campaign.CAMPAIGN.entries()) {
    const scenery = new LocationScenery(location), geometries = new Set(), materials = new Set();
    try {
      assert.equal(scenery.root.name, `location-${location.id}`); assert.ok(scenery.root.getObjectByName(landmarks[index]), location.id);
      let meshes = 0;
      const check = () => {
        scenery.root.updateMatrixWorld(true);
        scenery.root.traverse(object => {
          for (const value of [...object.position, ...object.quaternion, ...object.scale, ...object.matrixWorld.elements]) assert.ok(Number.isFinite(value), `${location.id}: ${object.name}`);
          if (!object.geometry) return;
          geometries.add(object.geometry); for (const material of [object.material].flat()) materials.add(material);
          for (const attribute of Object.values(object.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value), location.id);
          if (!object.isMesh) return;
          meshes++;
          const box = new Box3().setFromObject(object, true);
          if (box.max.y > 0.2) assert.ok(box.max.x <= -30 || box.min.x >= 30 || box.max.z <= -22 || box.min.z >= 22, `${location.id}: tall ${object.name || object.parent.name} enters walkable arena`);
        });
      };
      check(); counts.add(meshes); assert.ok(meshes > 20);
      for (let i = 0; i < 120; i++) scenery.update(1 / 60);
      check(); assert.ok([...materials].some(material => material.color?.getHex() === location.palette.stone), location.id);
      for (const geometry of geometries) { assert.ok(!geometryOwners.has(geometry)); geometryOwners.add(geometry); }
      for (const material of materials) { assert.ok(!materialOwners.has(material)); materialOwners.add(material); }
      const releases = new Map();
      for (const resource of [...geometries, ...materials]) { releases.set(resource, 0); resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource) + 1)); }
      scenery.destroy(); scenery.destroy(); assert.equal(scenery.root.children.length, 0);
      for (const count of releases.values()) assert.equal(count, 1, `${location.id}: owned GPU resource disposed exactly once`);
    } finally { scenery.destroy(); }
  }
  assert.equal(counts.size, 5, 'locations contain different architectural arrangements');
});

test('signature warnings match target positions and lane/disk/ring dimensions, remain finite, and reset their owned resources', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { Previews } = await loadGame('previews');
  const { SPECIALS } = await loadGame('knight-specials');
  const previews = new Previews(), world = game.createEncounter(); world.status = 'playing';
  const warnings = [];
  let destroyed = false;
  try {
    for (const attack of ['sweep', 'charge', 'spin', 'crossbow', 'rush', ...Object.keys(SPECIALS)]) {
      world.wave = 3; Object.assign(world.knight, { x: 3, z: -2 }); game.beginAttack(world, attack, { x: 3, z: 5 });
      previews.update(world, 1 / 60); const warning = previews.warning;
      assert.ok(warning?.visible, attack);
      const owned = new Set(), releases = new Map();
      for (const root of [warning, previews.border]) root?.traverse(object => { if (object.geometry) owned.add(object.geometry); if (object.material) owned.add(object.material); });
      for (const resource of owned) { releases.set(resource, 0); resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource) + 1)); }
      warnings.push(releases);
      const target = attack === 'consecration' || attack === 'firebomb' ? world.knight.target : world.knight.origin;
      near(warning.position.x, target.x); near(warning.position.z, target.z);
      warning.geometry.computeBoundingBox(); const bounds = warning.geometry.boundingBox;
      if (attack === 'lance') { near(bounds.max.z, 7.5); near(bounds.min.z, 0); near(bounds.max.x, 0.75); near(bounds.min.x, -0.75); }
      if (attack === 'consecration' || attack === 'firebomb') {
        near(bounds.max.z, SPECIALS[attack].radius); near(bounds.min.z, -SPECIALS[attack].radius);
        previews.border.traverse(object => {
          if (!object.isMesh) return;
          const points = object.geometry.getAttribute('position'); let outer = 0;
          for (let index = 0; index < points.count; index++) outer = Math.max(outer, Math.hypot(points.getX(index), points.getZ(index)));
          near(outer, SPECIALS[attack].radius);
        });
      }
      if (attack === 'shockwave') {
        near(bounds.max.z, 9.275); world.knight.state = 'strike'; world.knight.timer = 0.9; previews.update(world, 0.9);
        const position = warning.geometry.getAttribute('position'), radii = new Set();
        for (let i = 0; i < position.count; i++) radii.add(Math.round(Math.hypot(position.getX(i), position.getZ(i)) * 1000));
        assert.deepEqual([...radii].sort((a, b) => a - b), [4225, 4775]);
      }
      for (const state of ['windup', 'strike', 'recovery']) {
        world.knight.state = state; world.knight.timer = 0.1; previews.update(world, 1 / 60); previews.root.updateMatrixWorld(true);
        assert.equal(warning.visible, state !== 'recovery');
        previews.root.traverse(object => { for (const value of [...object.position, ...object.quaternion, ...object.scale]) assert.ok(Number.isFinite(value), attack); if (object.geometry) for (const attribute of Object.values(object.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value), attack); });
      }
    }
    previews.pulse({ x: 0, z: 0 }, 3, 0xff632e, 1);
    const resources = new Set(); previews.root.traverse(object => { if (object.geometry) resources.add(object.geometry); if (object.material) resources.add(object.material); });
    // Aim meshes remain reusable after reset; warnings, borders and pulses are destroyed.
    const aimResources = new Set(); previews.aim.traverse(object => { if (object.geometry) aimResources.add(object.geometry); if (object.material) aimResources.add(object.material); });
    const releases = new Map(); for (const resource of resources) if (!aimResources.has(resource)) { releases.set(resource, 0); resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource) + 1)); }
    previews.reset(); previews.reset(); assert.equal(previews.warning, null); assert.equal(previews.aim.visible, false);
    for (const count of releases.values()) assert.equal(count, 1); destroyed = true;
    for (const warning of warnings) for (const count of warning.values()) assert.equal(count, 1, 'each warning and border resource releases once across attack changes and reset');
  } finally { if (!destroyed) previews.reset(); }
});

test('location terrain and lighting change palettes without rebuilding shader programs or losing any recruitment glow', async () => {
  const { Scene, ShaderLib, Color } = await import('three');
  const { loadGame, campaign } = await import('./load-source.mjs');
  const { terrainMaterial, moonlight } = await loadGame('material-look');
  const terrain = terrainMaterial(), scene = new Scene(), lighting = moonlight(scene);
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} };
  terrain.material.onBeforeCompile(shader, null);
  const program = terrain.material.customProgramCacheKey(), version = terrain.material.version;
  assert.equal(shader.uniforms.hordeSite.value.length, 5); assert.equal(shader.uniforms.hordeSites.value.length, 5);
  terrain.active.value[4] = 1;
  for (const [index, location] of campaign.CAMPAIGN.entries()) {
    terrain.setLocation(location); lighting.setLocation(location);
    assert.equal(shader.uniforms.hordeTheme.value, index); assert.equal(shader.uniforms.hordeSite.value[4], 1);
    assert.equal(shader.uniforms.hordeSoil.value.getHex(), location.palette.soil);
    assert.equal(shader.uniforms.hordeStone.value.getHex(), location.palette.stone);
    assert.equal(shader.uniforms.hordeAccent.value.getHex(), location.palette.accent);
    assert.ok(scene.background.equals(new Color(location.palette.sky)));
    assert.equal(scene.children.find(object => object.isHemisphereLight).groundColor.getHex(), location.palette.low);
    assert.equal(terrain.material.customProgramCacheKey(), program); assert.equal(terrain.material.version, version);
  }
  terrain.setLocation(campaign.CAMPAIGN[0]); assert.equal(shader.uniforms.hordeTheme.value, 0); terrain.material.dispose();
});

test('location framing fits real architecture on wide and portrait screens, preserves aiming, zoom following and restart', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { LocationScenery } = await loadGame('location-scenery');
  const world = game.createEncounter();
  for (const location of campaign.CAMPAIGN) {
    const scenery = new LocationScenery(location), camera = new ArenaCamera();
    try {
      camera.resize(1600, 900); camera.frameScenery(location.id === 'graveyard' ? null : scenery.root);
      scenery.update(2); scenery.root.updateMatrixWorld(true);
      for (const [width, height] of location.id === 'graveyard' ? [[1600, 900]] : [[1600, 900], [600, 1000]]) {
        // A restored checkpoint is paused, so framing must fit before any time advances.
        camera.resize(width, height); camera.update(world, 0, true);
        scenery.root.traverse(object => {
          if (!object.isMesh) return;
          const vertices = object.geometry.getAttribute('position'), projected = new Vector3();
          for (let i = 0; i < vertices.count; i++) {
            projected.fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld).project(camera.camera);
            assert.ok(Math.abs(projected.x) <= 1.00001 && Math.abs(projected.y) <= 1.00001, `${location.id}: ${width}x${height} landmark vertex ${projected.toArray()}`);
            if (location.id !== 'graveyard') assert.ok(projected.y <= 0.76001, `${location.id}: landmark enters the top HUD reserve at ${width}x${height}`);
          }
        });
        const canvas = { getBoundingClientRect: () => ({ left: 25, top: 40, width, height, right: width + 25, bottom: height + 40 }) };
        for (const point of game.SITES) {
          const screen = camera.screen(canvas, point), aim = camera.aim(canvas, screen.x, screen.y);
          assert.ok(aim.onGround); near(aim.point.x, point.x); near(aim.point.z, point.z);
        }
      }
      world.zombies.forEach(zombie => { zombie.locked = true; }); Object.assign(world.zombies[0], { locked: false, x: 10, z: -5 });
      camera.zoom(100); camera.update(world, 10); near(cameraGroundCenter(camera).x, 10); near(cameraGroundCenter(camera).z, -5);
      camera.resize(1600, 900); camera.reset(); near(camera.camera.top * 2, 40.2); near(cameraGroundCenter(camera).x, 0); near(cameraGroundCenter(camera).z, 0); assert.equal(camera.factor, 1);
    } finally { scenery.destroy(); }
  }
});

test('portrait framing keeps the ground in front of the near plane and inside the floor through paused resize and zoom-out', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { LocationScenery } = await loadGame('location-scenery');
  const world = game.createEncounter(), ground = new Plane(new Vector3(0, 1, 0), 0);
  for (const location of campaign.CAMPAIGN) {
    const scenery = new LocationScenery(location);
    try {
      for (const [width, height] of [[390, 844], [320, 900]]) {
        const camera = new ArenaCamera(), tilt = camera.camera.quaternion.clone();
        camera.resize(1600, 900); camera.frameScenery(location.id === 'graveyard' ? null : scenery.root);
        camera.update(world, 0, true);
        const check = state => {
          assert.ok(camera.camera.near > 0); assert.ok(camera.camera.quaternion.equals(tilt));
          for (const x of [-1, 1]) for (const y of [-1, 1]) {
            const ray = new Raycaster(); ray.setFromCamera(new Vector2(x, y), camera.camera);
            const point = ray.ray.intersectPlane(ground, new Vector3());
            const label = `${location.id}: ${width}x${height} ${state} corner ${x},${y}`;
            assert.ok(point, `${label} has forward ground intersection`);
            assert.ok(point.toArray().every(Number.isFinite), label);
            assert.ok(Math.abs(point.x) <= 200 && Math.abs(point.z) <= 200, `${label} stays on the 400x400 floor`);
            const projected = point.clone().project(camera.camera);
            near(projected.x, x); near(projected.y, y);
            assert.ok(projected.z >= -1 && projected.z <= 1, `${label} lies between the clipping planes`);
          }
        };
        camera.resize(width, height); check('paused resize');
        camera.update(world, 0, true); check('restored overview');
        camera.zoom(-100); camera.update(world, 0, true); assert.equal(camera.factor, 1.25); check('zoom-out');
        camera.resize(1600, 900); camera.resize(width, height); check('paused zoom-out resize');
        camera.reset(); check('reset');
      }
    } finally { scenery.destroy(); }
  }
});

test('cloud layers share their drifting field, stop for reduced motion, and release each GPU resource once', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { Clouds } = await loadGame('clouds');
  const clouds = new Clouds(), [shadow, air] = clouds.root.children;
  const time = air.material.uniforms.driftTime;
  assert.equal(time, shadow.material.uniforms.driftTime);
  clouds.update(.1, false); assert.equal(time.value, .1);
  clouds.update(1, true); clouds.update(NaN, false); assert.equal(time.value, .1);
  clouds.configure(true); assert.equal(air.material.uniforms.detail.value, 0);
  for (const location of campaign.CAMPAIGN) { clouds.setLocation(location); assert.ok(air.material.uniforms.cloudColor.value.toArray().every(Number.isFinite)); }
  assert.equal(air.material.depthWrite, false); assert.ok(shadow.position.y < .05);
  const resources = new Set([air.geometry, shadow.geometry, air.material, shadow.material]), releases = new Map();
  for (const r of resources) { releases.set(r,0); r.addEventListener('dispose', () => releases.set(r,releases.get(r)+1)); }
  clouds.destroy(); clouds.destroy(); for (const n of releases.values()) assert.equal(n,1);
});

test('weather has dry intervals, smooth showers and occasional flocks, stays bounded and respects quality/motion settings', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { Weather, ambientWeatherAt } = await loadGame('weather');
  assert.equal(ambientWeatherAt(0,1).rain,0); assert.ok(ambientWeatherAt(30,1).rain > .5); assert.equal(ambientWeatherAt(70,1).rain,0);
  assert.equal(ambientWeatherAt(0,1).flight,null); assert.notEqual(ambientWeatherAt(12,1).flight,null);
  assert.notEqual(ambientWeatherAt(12,1).kind,ambientWeatherAt(64,1).kind);
  for (let t=0;t<224;t+=.1) { const a=ambientWeatherAt(t,1),b=ambientWeatherAt(t+.1,1); assert.ok(Math.abs(a.rain-b.rain)<.025); }
  const weather = new Weather(), rain = weather.root.getObjectByName('PassingRain'), resources = new Set(), releases = new Map();
  weather.root.traverse(o => { if(o.geometry) resources.add(o.geometry); if(o.material) resources.add(o.material); });
  const originalGeometry = rain.geometry;
  for (const location of campaign.CAMPAIGN) {
    weather.setLocation(location,campaign.CAMPAIGN.indexOf(location)+1);
    for(let i=0;i<700;i++) weather.update(.1,false);
    assert.equal(rain.geometry,originalGeometry); assert.ok([...rain.geometry.attributes.position.array].every(Number.isFinite));
  }
  weather.configure(true); assert.equal(rain.geometry.drawRange.count,170);
  weather.configure(false,true); assert.equal(weather.root.visible,false);
  const positions=rain.geometry.attributes.position.array.slice(); weather.update(10,true); assert.deepEqual(rain.geometry.attributes.position.array,positions);
  for (const r of resources) { releases.set(r,0); r.addEventListener('dispose',()=>releases.set(r,releases.get(r)+1)); }
  weather.destroy(); weather.destroy(); for (const n of releases.values()) assert.equal(n,1);
});

test('recomposed authored environment is finite, repeatable and keeps tall rocks clear without changing their geometry', async () => {
  const { loadGame } = await import('./load-source.mjs');
  const { loosenEnvironment } = await loadGame('arena-dressing');
  const bytes = await readFile(new URL('../src/modules/horde/assets/reference/arena_environment.glb', import.meta.url));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const authored = new Map(), resources = new Set();
  asset.scene.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    authored.set(object, { geometry, material: object.material,
      attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, attribute.array.slice()])),
      index: geometry.index?.array.slice() });
    resources.add(geometry); for (const material of [object.material].flat()) resources.add(material);
  });
  try {
    const rocks = asset.scene.getObjectByName('Rocks'); assert.ok(rocks);
    loosenEnvironment(asset.scene); asset.scene.updateMatrixWorld(true);
    const transforms = new Map();
    asset.scene.traverse(object => {
      const values = [...object.position, ...object.quaternion, ...object.scale, ...object.matrixWorld.elements];
      assert.ok(values.every(Number.isFinite), object.name); transforms.set(object, values);
    });
    let tallRocks = 0;
    rocks.traverse(object => {
      if (!object.isMesh) return;
      const box = new Box3().setFromObject(object, true);
      if (box.max.y <= .2) return;
      tallRocks++;
      assert.ok(box.max.x <= -30 || box.min.x >= 30 || box.max.z <= -22 || box.min.z >= 22,
        `${object.parent.name}: tall rock enters the walkable arena`);
    });
    assert.ok(tallRocks > 0, 'clearance check uses the authored tall rock meshes');
    loosenEnvironment(asset.scene); asset.scene.updateMatrixWorld(true);
    asset.scene.traverse(object => {
      assert.deepEqual([...object.position, ...object.quaternion, ...object.scale, ...object.matrixWorld.elements], transforms.get(object),
        `${object.name}: dressing does not accumulate transform changes`);
    });
    for (const [object, original] of authored) {
      assert.equal(object.geometry, original.geometry); assert.equal(object.material, original.material);
      assert.deepEqual(Object.keys(object.geometry.attributes), Object.keys(original.attributes));
      for (const [name, values] of Object.entries(original.attributes)) assert.deepEqual(object.geometry.attributes[name].array, values,
        `${object.name}: authored ${name} stays intact`);
      assert.deepEqual(object.geometry.index?.array, original.index, `${object.name}: authored topology stays intact`);
    }
  } finally { for (const resource of resources) resource.dispose(); }
});
