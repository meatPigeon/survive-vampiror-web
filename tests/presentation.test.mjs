import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Actor, ArenaCamera, CombatEffects, simulation as game } from './load-source.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
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
  near(camera.camera.position.z, 24 - 5 * (1 - Math.exp(-8)));
  const position = camera.camera.position.clone(); world.zombies[0].locked = true;
  camera.update(world, 1); assert.deepEqual(camera.camera.position, position);
  camera.zoom(-100); assert.equal(camera.factor, 1.25); camera.update(world, 10);
  near(camera.camera.position.x, 0); near(camera.camera.position.z, 24);
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
