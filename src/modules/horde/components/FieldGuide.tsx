import { useEffect, useRef, useState } from 'react';
import type { HordeController } from '../game/controller';
import { HordeIcon } from './HordeIcon';
import { Modal } from './Modal';
import { GuidePractice } from './GuidePractice';
import { GuideReference } from './GuideReference';
import { GuideConquest } from './GuideConquest';
import type { Snapshot } from './GameMenu';
const chapters = [
  { id: 'move', name: 'Move as one', caption: 'You lead. They bite.', icon: 'permanent' },
  { id: 'dodge', name: 'Dodge & bite', caption: 'Find your opening.', icon: 'attack' },
  { id: 'recruit', name: 'Raise recruits', caption: 'Borrow a little muscle.', icon: 'recruit' },
  { id: 'conquest', name: 'Claim the land', caption: 'Build your kind of horde.', icon: 'crown' },
] as const;
export function FieldGuide({ state, controller }: { state: Snapshot; controller: HordeController }) {
  const [chapter, setChapter] = useState(0), [done, setDone] = useState<number[]>([]), [reference, setReference] = useState<'controls' | 'credits' | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [chapter, reference]);
  const current = chapters[chapter]!;
  const select = (i: number) => { setChapter(i); setReference(null); };
  return <Modal label="How to play" onClose={() => controller.closePanel()} className="horde-guide">
    <header className="guide-header"><div className="guide-brand"><HordeIcon name="permanent" /><div><span className="horde-kicker">SURVIVE VAMPIROR</span><h1>A little practice. A lot of teeth.</h1></div></div><button data-autofocus onClick={() => controller.closePanel()} aria-label="Close tutorial">✕</button></header>
    <div className="guide-layout" ref={content}>
      <nav className="guide-chapters" aria-label="Tutorial chapters">{chapters.map((item, i) => <button key={item.id} aria-current={!reference && chapter === i ? 'step' : undefined} onClick={() => select(i)}><span className="guide-chapter-icon"><HordeIcon name={done.includes(i) ? 'check' : item.icon} /></span><span><small>0{i + 1}</small><b>{item.name}</b><em>{item.caption}</em></span></button>)}<p>Learn at your pace.<br />Your saved march stays safe.</p></nav>
      <div className="guide-content">
        {reference ? <GuideReference page={reference} state={state} /> : current.id === 'conquest' ? <GuideConquest onChoose={() => setDone(d => d.includes(3) ? d : [...d, 3])} /> : <GuidePractice key={current.id} chapter={current.id} state={state} onComplete={() => setDone(d => d.includes(chapter) ? d : [...d, chapter])} />}
      </div>
    </div>
    <footer className="guide-footer"><div className="guide-reference-links"><button aria-pressed={reference === 'controls'} onClick={() => setReference(r => r === 'controls' ? null : 'controls')}>Controls & saves</button><button aria-pressed={reference === 'credits'} onClick={() => setReference(r => r === 'credits' ? null : 'credits')}>Credits</button></div><div className="guide-next"><span>{reference ? 'QUICK REFERENCE' : `${chapter + 1} / ${chapters.length}`}</span>{reference ? <button className="horde-primary" onClick={() => setReference(null)}>Back to lesson</button> : chapter < chapters.length - 1 ? <button className="horde-primary" onClick={() => select(chapter + 1)}>Next: {chapters[chapter + 1]!.name}<HordeIcon name="arrow" /></button> : <button className="horde-primary" onClick={() => controller.closePanel()}>Back to the game<HordeIcon name="arrow" /></button>}</div></footer>
  </Modal>;
}
