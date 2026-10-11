import { createEncounter, spawnZombie, centerOf, beginAttack, stepEncounter, RULES, SITES } from './simulation';
import { destinationDirection } from './navigation';
import type { Point } from './types';

export type GuideChapter = 'move' | 'dodge' | 'recruit';
export type GuideStage = 'waiting' | 'trying' | 'punish' | 'complete' | 'retry';

/** A disposable teaching encounter. It never receives a player's world or save store. */
export class GuideLesson {
  readonly world = createEncounter(false, 12345);
  readonly origin: Point;
  stage: GuideStage = 'waiting';
  destination: Point | null = null;
  example = false;
  private recoveryHp = 0;
  constructor(readonly chapter: GuideChapter) {
    const w = this.world;
    this.origin = chapter === 'recruit' ? { x: SITES[0]!.x - 2, z: SITES[0]!.z } : { x: 0, z: 0 };
    w.status = 'playing'; w.zombies = []; w.nextId = 0; w.nextSiteAt = Infinity;
    const start = chapter === 'dodge' ? { x: 0, z: 0.4 } : { x: -3.2, z: 0.7 };
    for (let i = 0; i < 6; i++) spawnZombie(w, this.absolute({ x: start.x + (i % 3 - 1) * 0.65, z: start.z + Math.floor(i / 3) * 0.65 }));
    Object.assign(w.knight, this.absolute(chapter === 'dodge' ? { x: 0, z: -1.2 } : { x: 2.5, z: 0 }), { state: 'stopped', facing: -Math.PI / 2 });
    if (chapter === 'dodge') beginAttack(w, 'sweep', this.absolute({ x: 0, z: 3 }));
    if (chapter === 'recruit') { w.activeSite = 0; w.lastSite = 0; w.knight.x = 26; w.knight.z = 18; }
    w.events = [];
  }
  absolute(p: Point): Point { return { x: p.x + this.origin.x, z: p.z + this.origin.z }; }
  get goal(): Point {
    if (this.chapter === 'recruit') return { ...SITES[0]! };
    if (this.chapter === 'dodge' && this.stage !== 'punish') return this.absolute({ x: -4.3, z: 0.5 });
    return { x: this.world.knight.x, z: this.world.knight.z };
  }
  get progress() {
    if (this.stage === 'complete') return 1;
    if (this.chapter === 'recruit') return Math.min(1, this.world.siteProgress / RULES.summonTime);
    if (this.chapter === 'dodge') return this.stage === 'punish' ? 0.65 : this.stage === 'waiting' ? 0 : 0.25;
    return Math.min(1, (this.world.knight.maxHp - this.world.knight.hp) / 12);
  }
  command(p: Point) {
    if (this.stage === 'complete' || this.stage === 'retry' || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
    this.destination = { x: Math.max(this.origin.x - 5.5, Math.min(this.origin.x + 5.5, p.x)), z: Math.max(this.origin.z - 3, Math.min(this.origin.z + 3, p.z)) };
    if (this.stage === 'waiting') this.stage = 'trying';
  }
  stop() { this.destination = null; }
  showExample() { this.example = true; this.command(this.goal); }
  tick(dt: number, direction = { x: 0, z: 0 }) {
    if (this.stage === 'complete' || this.stage === 'retry') return;
    const hasKeys = Math.hypot(direction.x, direction.z) > 0;
    if (hasKeys) { if (this.stage === 'waiting') this.stage = 'trying'; this.destination = null; this.example = false; }
    if (this.stage === 'waiting') return;
    const w = this.world;
    if (this.stage === 'punish') {
      // Let the learner choose when to counterattack, without a second surprise attack.
      w.knight.state = 'stopped';
      if (this.example && !this.destination) this.command(this.goal);
    }
    if (!hasKeys && this.destination) {
      const next = destinationDirection(w, this.destination); direction = next;
      if (next.arrived) this.destination = null;
    }
    stepEncounter(w, Math.min(dt, 1 / 30), direction.x, direction.z);
    // Keep the lesson's small training ground within its close-up camera.
    for (const z of w.zombies) { z.x = Math.max(this.origin.x - 5.5, Math.min(this.origin.x + 5.5, z.x)); z.z = Math.max(this.origin.z - 3, Math.min(this.origin.z + 3, z.z)); }
    if (this.chapter === 'move' && w.knight.hp <= w.knight.maxHp - 12) this.stage = 'complete';
    if (this.chapter === 'recruit' && w.recruited >= RULES.reserves) this.stage = 'complete';
    if (this.chapter === 'dodge') {
      if (this.stage === 'trying' && w.knight.state === 'recovery') {
        this.stage = w.zombies.every(z => z.hp === z.maxHp) ? 'punish' : 'retry';
        this.recoveryHp = w.knight.hp; this.destination = null;
      } else if (this.stage === 'punish' && w.knight.hp <= this.recoveryHp - 12) this.stage = 'complete';
    }
    if (this.stage === 'complete' || this.stage === 'retry') { this.destination = null; for (const z of w.zombies) z.moving = false; }
  }
  get center() { return centerOf(this.world.zombies); }
}
