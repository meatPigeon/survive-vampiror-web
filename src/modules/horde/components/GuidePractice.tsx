import { useEffect, useRef, useState } from 'react';
import { GuideLesson, type GuideChapter, type GuideStage } from '../game/guide-lesson';
import { GuideView } from '../game/guide-view';
import type { Bindings } from '../data/controls';
import type { Snapshot } from './GameMenu';
import { HordeIcon } from './HordeIcon';

const lessons = {
  move: { title: 'One command. An entire horde.', body: 'Move close to the knight. Your zombies do the biting.', instruction: 'Tap the ground beside the knight.', tip: 'Every zombie follows the same command. Keep one permanent zombie alive to keep marching.', action: 'Move to the knight', icon: 'permanent' },
  dodge: { title: 'Out of the orange. Into the opening.', body: 'Leave the warning shape, then bite while the knight recovers.', instruction: 'Move sideways, out of the orange fan.', tip: 'The shape is where the hit will land. Crossbow bolts are always lethal—even in Adventure.', action: 'Dodge left', icon: 'attack' },
  recruit: { title: 'More hands. More teeth.', body: 'Stop inside a glowing crater. Fill its ring to raise 12 allies.', instruction: 'Move into the glowing ring and stay there.', tip: 'Blue rings mean temporary allies: 45 seconds of extra muscle. Your permanent horde is your lifeline.', action: 'Enter the ring', icon: 'recruit' },
} as const;
const result = (chapter: GuideChapter, stage: GuideStage, example: boolean) => {
  if (stage === 'retry') return 'The sweep caught someone. Reset, then move sideways as soon as the warning begins.';
  if (stage === 'punish') return 'Clear of the sweep! Now move back to the knight and bite.';
  if (stage !== 'complete') return null;
  if (chapter === 'recruit') return `${example ? 'See those blue rings?' : '+12 temporary allies!'} They fight with you, but only for a little while.`;
  if (chapter === 'dodge') return 'Dodge → recover → bite. That is the rhythm of the fight.';
  return 'They bite automatically. You choose where the horde goes.';
};

export function GuidePractice({ chapter, state, onComplete }: { chapter: GuideChapter; state: Snapshot; onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null), demo = useRef<GuideLesson | null>(null), view = useRef<GuideView | null>(null);
  const held = useRef(new Set<string>()), completion = useRef(onComplete); completion.current = onComplete;
  const [revision, setRevision] = useState(0);
  const [ui, setUi] = useState({ stage: 'waiting' as GuideStage, progress: 0, recruits: 0, example: false, loaded: false, error: false });
  const lesson = lessons[chapter], bindings = state.settings.bindings;
  useEffect(() => {
    let disposed = false, frame = 0, notified = 0, last = performance.now(), completed = false;
    const world = new GuideLesson(chapter); demo.current = world; held.current.clear();
    setUi({ stage: 'waiting', progress: 0, recruits: 0, example: false, loaded: false, error: false });
    let scene: GuideView;
    try { scene = new GuideView(host.current!, world); view.current = scene; }
    catch { setUi(p => ({ ...p, error: true })); return () => { demo.current = null; }; }
    const update = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
      if (!document.hidden) {
        const down = (action: keyof Bindings, arrow: string) => held.current.has(bindings[action]) || !Object.values(bindings).includes(arrow) && held.current.has(arrow);
        world.tick(dt, { x: Number(down('right', 'ArrowRight')) - Number(down('left', 'ArrowLeft')), z: Number(down('down', 'ArrowDown')) - Number(down('up', 'ArrowUp')) });
        scene.update(dt, state.reducedMotion);
        if (now - notified > 100) { notified = now; setUi({ stage: world.stage, progress: world.progress, recruits: world.world.recruited, example: world.example, loaded: true, error: false }); }
        if (world.stage === 'complete' && !completed) { completed = true; completion.current(); }
      }
      frame = requestAnimationFrame(update);
    };
    const clear = () => held.current.clear();
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    void scene.ready.then(() => { if (!disposed) { last = performance.now(); frame = requestAnimationFrame(update); } }).catch(() => { if (!disposed) setUi(p => ({ ...p, error: true })); });
    return () => { disposed = true; cancelAnimationFrame(frame); clear(); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); scene.destroy(); demo.current = null; view.current = null; };
  }, [chapter, revision, bindings, state.reducedMotion]);
  const feedback = result(chapter, ui.stage, ui.example);
  const command = () => { const w = demo.current; if (w) { w.example = false; w.command(w.goal); } };
  const key = (code: string) => [...Object.values(bindings).slice(0, 4), 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', bindings.stop].includes(code);
  return <>
    <div className="guide-scene-wrap">
      <div className="guide-scene-heading"><span><i />{ui.example ? 'WATCH THE EXAMPLE' : 'TRY IT HERE'}</span><span>{chapter === 'recruit' ? `6 + ${ui.recruits} zombies` : '6 practice zombies'}</span></div>
      <div ref={host} className="guide-scene" role="group" aria-label="Practice arena" aria-describedby="guide-instruction" tabIndex={0}
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); const point = view.current?.point(event.clientX, event.clientY); if (point && demo.current) { demo.current.example = false; demo.current.command(point); } }}
        onContextMenu={event => { event.preventDefault(); demo.current?.stop(); }}
        onKeyDown={event => { if (event.ctrlKey || event.metaKey || event.altKey || !key(event.code)) return; event.preventDefault(); event.stopPropagation(); if (event.code === bindings.stop) { held.current.clear(); demo.current?.stop(); } else held.current.add(event.code); }}
        onKeyUp={event => { held.current.delete(event.code); }} onBlur={() => held.current.clear()} />
      {!ui.loaded && <div className="guide-scene-loading">{ui.error ? 'The practice scene could not load. You can still browse the lessons.' : 'Waking the practice horde…'}</div>}
      <div className={`guide-scene-caption ${ui.stage === 'complete' ? 'is-complete' : ''}`}><HordeIcon name={ui.stage === 'complete' ? 'check' : lesson.icon} /><span>{ui.stage === 'complete' ? 'You have got this' : chapter === 'recruit' && ui.progress > 0 ? 'Hold here… raising allies' : ui.stage === 'punish' ? 'The knight is exposed' : lesson.instruction}</span></div>
      <div className="guide-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ui.progress * 100)}><i style={{ width: `${ui.progress * 100}%` }} /></div>
    </div>
    <div className="guide-lesson-copy"><div><span className="horde-kicker">{chapter === 'move' ? '01 / COMMAND' : chapter === 'dodge' ? '02 / TIMING' : '03 / REINFORCEMENTS'}</span><h2>{lesson.title}</h2><p id="guide-instruction">{lesson.body}</p></div>
      <div className="guide-practice-actions">
        <button className="guide-do" disabled={!ui.loaded || ui.stage === 'complete' || ui.stage === 'retry'} onClick={command}>{ui.stage === 'punish' ? 'Bite the knight' : lesson.action}<HordeIcon name="arrow" /></button>
        <div><button disabled={!ui.loaded || ui.stage !== 'waiting'} onClick={() => demo.current?.showExample()}>Show me</button><button onClick={() => setRevision(r => r + 1)}>Reset lesson</button></div>
      </div>
    </div>
    <div className={`guide-feedback ${ui.stage === 'retry' ? 'is-retry' : ''}`} role="status"><HordeIcon name={ui.stage === 'complete' ? 'check' : lesson.icon} /><p>{feedback ?? lesson.tip}</p></div>
  </>;
}
