import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, simulation } from './load-source.mjs';
const { GuideLesson } = await loadGame('guide-lesson');
function advance(lesson, seconds) { for (let i = 0; i < seconds * 60; i++) lesson.tick(1 / 60); }

test('practice waits for a command, uses automatic bites, and cannot change the real encounter', () => {
  const real = simulation.createEncounter(), before = structuredClone(real);
  const lesson = new GuideLesson('move'); advance(lesson, 10);
  assert.equal(lesson.world.elapsed, 0); assert.equal(lesson.stage, 'waiting');
  lesson.command(lesson.goal); advance(lesson, 10);
  assert.equal(lesson.stage, 'complete'); assert.ok(lesson.world.knight.hp < lesson.world.knight.maxHp);
  assert.deepEqual(real, before); const elapsed = lesson.world.elapsed; advance(lesson, 10); assert.equal(lesson.world.elapsed, elapsed);
});
test('the dodge exercise distinguishes a real hit from leaving the sweep, then teaches a counterattack', () => {
  const caught = new GuideLesson('dodge'); caught.command(caught.center); advance(caught, 3);
  assert.equal(caught.stage, 'retry'); assert.ok(caught.world.zombies.some(z => z.hp < z.maxHp));
  const safe = new GuideLesson('dodge'); safe.command(safe.goal); advance(safe, 3);
  assert.equal(safe.stage, 'punish'); assert.ok(safe.world.zombies.every(z => z.hp === z.maxHp));
  safe.command(safe.goal); advance(safe, 6); assert.equal(safe.stage, 'complete');
});
test('recruitment needs actual ring occupancy, grants twelve temporary allies and leaves permanent count intact', () => {
  const lesson = new GuideLesson('recruit'); lesson.command(lesson.center); advance(lesson, 4);
  assert.equal(lesson.world.recruited, 0);
  lesson.command(lesson.goal); advance(lesson, 8);
  assert.equal(lesson.stage, 'complete'); assert.equal(lesson.world.recruited, 12);
  assert.equal(lesson.world.zombies.filter(z => z.kind === 'permanent').length, 6);
  assert.ok(lesson.world.zombies.filter(z => z.kind === 'temporary').every(z => z.lifetime === simulation.RULES.lifetime));
});
test('every Show me example completes, and keyboard commands take over an example', () => {
  for (const chapter of ['move', 'dodge', 'recruit']) {
    const lesson = new GuideLesson(chapter); lesson.showExample(); advance(lesson, 20); assert.equal(lesson.stage, 'complete', chapter);
  }
  const lesson = new GuideLesson('move'); lesson.showExample(); lesson.tick(1 / 60, {x:-1,z:0});
  assert.equal(lesson.example, false); assert.equal(lesson.destination, null);
  lesson.command({x:NaN,z:0}); assert.equal(lesson.destination, null);
});
