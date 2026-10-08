import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { HordeController } from '../game/controller';
import { PERK_TITLES, type Perk } from '../game/simulation';
import type { createControllerBox } from '../react/controller-box';
import './horde.css';
const icons = {
  permanent: new URL('../assets/reference/ui/permanent_ring.svg', import.meta.url).href,
  temporary: new URL('../assets/reference/ui/temporary_ring.svg', import.meta.url).href,
};
const art = {
  mines: new URL('../assets/reference/ui/upgrades/mines.png', import.meta.url).href,
  sling: new URL('../assets/reference/ui/upgrades/sling.png', import.meta.url).href,
  feast: new URL('../assets/reference/ui/upgrades/feast.png', import.meta.url).href,
  sprint: new URL('../assets/reference/ui/upgrades/sprint.png', import.meta.url).href,
};
const perks = {
  mines: { role: 'SACRIFICE', cost: 'Spends half your horde', color: '#e4ad72', text: 'Q leaves half the horde behind. After 2 seconds they explode and die. Permanent zombies are spent too.' },
  sling: { role: 'ARTILLERY', cost: 'Uses temporary zombies', color: '#95ccd1', text: 'Q aims the sling. Move the mouse, then left-click to launch a temporary zombie into the scatter circle. Right-click cancels.' },
  feast: { role: 'SUSTAIN', cost: 'Bite to recover health', color: '#c8a4d8', text: 'Q grants 5 seconds of faster bites that heal the biting zombie. Get close and feed to recover.' },
  sprint: { role: 'MOBILITY', cost: 'Keeps Q / E slots free', color: '#c5cf91', text: 'Space doubles movement speed for 1.4 seconds. Recharges in 7 seconds. Keeps Q/E free for other abilities.' },
};
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function makeHordeHud(box: ReturnType<typeof createControllerBox<HordeController>>) {
  return function HordeHud() { const controller = useSyncExternalStore(box.subscribe, box.get, box.get); return controller ? <Hud controller={controller} /> : null; };
}
function AudioControls({ controller }: { controller: HordeController }) {
  const { audio } = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <div className="horde-audio">{(['music', 'effects'] as const).map(bus => <label key={bus}>
    <span>{bus === 'music' ? 'Music' : 'Effects'}<b>{audio[bus]}%</b></span>
    <input type="range" aria-label={`${bus === 'music' ? 'Music' : 'Effects'} volume`} min="0" max="100" step="1" value={audio[bus]} onChange={e => controller.setVolume(bus, Number(e.target.value))} />
  </label>)}</div>;
}
function Hud({ controller }: { controller: HordeController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [audioOpen, setAudioOpen] = useState(false), [choice, setChoice] = useState<number | null>(null);
  useEffect(() => { setChoice(null); }, [state.wave]);
  useEffect(() => { if (state.menu) setAudioOpen(false); }, [state.menu]);
  const finished = state.status === 'won' || state.status === 'lost', k = state.knight;
  const threat = { sweep: 'Sweep — move sideways', charge: 'Charge — clear the lane', spin: 'Spin — get out of the circle', crossbow: 'Crossbow — leave the blue line', rush: 'Stampede — bait the turn' }[k.attack];
  const key = state.abilities[0]?.upgrade ? 'E' : 'Q';
  return <div className="horde-hud">
    {state.menu && !state.error ? <div className="horde-menu">
      <div className="horde-menu-shade" /><section className="horde-menu-content" aria-label="Main menu">
        <span className="horde-kicker">THE DEAD MARCH AGAIN</span><h1>SURVIVE<br />VAMPIROR</h1>
        <p>One knight. Your entire horde.<br />Bring him down before the last of you falls.</p>
        <div className="horde-mode" aria-label="Difficulty">
          <button aria-pressed={!state.normal} onClick={() => controller.setNormal(false)}>Newbie</button>
          <button aria-pressed={state.normal} onClick={() => controller.setNormal(true)}>Normal</button>
        </div>
        <small>{state.normal ? 'Every knight hit kills a zombie.' : 'Reduced damage. Crossbow bolts still kill.'}</small>
        <button className="horde-raise" autoFocus disabled={!state.loaded} onClick={() => controller.start()}>Raise the horde →</button>
        <button className="horde-text-button" aria-expanded={audioOpen} onClick={() => { controller.audio.unlock(); setAudioOpen(!audioOpen); }}>{audioOpen ? 'Close audio' : 'Audio'}</button>
        {audioOpen && <AudioControls controller={controller} />}
      </section><span className="horde-menu-footer">COMMAND THE HORDE · BREAK THE HERO</span>
    </div> : <>
      <div className="horde-knight-status">
        <div><span>KNIGHT</span><span>{k.hp} / {k.maxHp}</span></div>
        <div className="horde-health" role="progressbar" aria-label="Knight health" aria-valuenow={k.hp} aria-valuemin={0} aria-valuemax={k.maxHp}>
          <i style={{ width: `${state.healthTrail / k.maxHp * 100}%` }} /><b style={{ width: `${k.hp / k.maxHp * 100}%` }} />
        </div>
        <small>{state.mode} · Wave {state.wave} / 3 · Phase {['I', 'II', 'III'][k.phase - 1]}</small>
      </div>
      <div className="horde-top-right"><time>{clock(state.elapsed)}</time><button onClick={() => controller.togglePause()} disabled={finished}>Pause</button></div>
      <div className={`horde-numbers ${state.permanent <= 8 ? 'horde-critical' : ''}`}>
        <div><img src={icons.permanent} alt="" /><strong>{state.permanent}</strong><span>{state.permanent <= 8 ? 'Keep them alive' : 'permanent'}</span></div>
        {state.temporary > 0 && <div className="horde-temporary"><img src={icons.temporary} alt="" /><strong>+{state.temporary}</strong><span className={(state.nextExpiration ?? 0) <= 10 ? 'horde-expiring' : ''}>temporary · {Math.ceil(state.nextExpiration ?? 0)}s</span></div>}
      </div>
      {state.status === 'playing' && k.state !== 'stopped' && <div className="horde-rally"><b>◇ {state.site ? `+${state.site.stock}` : '—'}</b><small>{!state.site ? `Next site in ${Math.ceil(state.siteTimeLeft)}s` : `${state.alive >= 60 ? 'Horde full' : state.site.progress > 0 ? 'Summoning' : 'Hold the ring'} · moves in ${Math.ceil(state.siteTimeLeft)}s`}</small></div>}
      {!state.betweenWaves && !finished && (state.status === 'ready' || k.state !== 'hunt') && <div className={`horde-threat ${k.state === 'recovery' ? 'horde-exposed' : ''}`}>{state.status === 'ready' ? 'WASD to lead your horde' : k.state === 'recovery' ? 'Exposed — attack!' : threat}</div>}
      {!state.paused && !finished && !state.betweenWaves && <>
        <div className="horde-abilities">{state.abilities.map((a, slot) => a.upgrade && <button key={slot} disabled={!state.abilityReady[slot]} title={perks[a.upgrade].text.replace('Q ', `${slot === 0 ? 'Q' : 'E'} `)} onClick={() => controller.ability(slot)}>{state.abilityLabels[slot]}</button>)}</div>
        {state.sprint.unlocked && state.status === 'playing' && <button className="horde-sprint" disabled={state.sprint.cooldown > 0} onClick={() => controller.sprint()}>{state.sprint.remaining > 0 ? 'Sprinting' : state.sprint.cooldown > 0 ? `Sprint   ${state.sprint.cooldown.toFixed(1)}s` : 'Sprint   Space'}{state.sprint.cooldown > 0 && <progress value={7 - state.sprint.cooldown} max="7" />}</button>}
        <div className="horde-dpad" aria-label="Horde direction controls">{['up', 'left', 'down', 'right'].map((dir, i) => <button key={dir} className={`horde-${dir}`} aria-label={`Move horde ${dir}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); controller.input.holdTouch(e.pointerId, dir); }} onPointerUp={e => controller.input.releaseTouch(e.pointerId)} onPointerCancel={e => controller.input.releaseTouch(e.pointerId)} onLostPointerCapture={e => controller.input.releaseTouch(e.pointerId)}>{['↑', '←', '↓', '→'][i]}</button>)}</div>
      </>}
      {state.betweenWaves && !state.awaitingReward && !state.paused && <div className="horde-countdown"><span>Wave {state.wave + 1} begins in</span><strong key={Math.ceil(state.waveTimeLeft)}>{Math.ceil(state.waveTimeLeft)}</strong><small>{state.wave === 1 ? 'Crossbow' : 'Mounted knight'}</small></div>}
      {state.awaitingReward && !state.paused && <div className="horde-rewards" role="dialog" aria-label="Choose an upgrade"><section>
        <span className="horde-kicker">WAVE {state.wave} / NEXT: WAVE {state.wave + 1}</span><h1>Wave cleared</h1><p>Choose one upgrade. Keep it for the rest of this run.</p>
        <div className="horde-cards">{state.rewards.map((perk: Perk, index: number) => <button key={perk} className="horde-card" style={{ '--accent': perks[perk].color, animationDelay: `${index * 0.08}s` } as CSSProperties} aria-pressed={choice === index} autoFocus={choice === index || choice === null && index === 0} onClick={() => setChoice(index)}>
          <div className="horde-card-art"><img src={art[perk]} alt="" /><span>{perks[perk].role}</span><b>{perk === 'sprint' ? 'Space' : key}</b></div>
          <h2>{PERK_TITLES[perk]}</h2><p>{perks[perk].text.replace('Q ', `${key} `)}</p><footer><span>{perks[perk].cost}</span><b>{choice === index ? '✓ SELECTED' : 'SELECT'}</b></footer>
        </button>)}</div>
        <div className="horde-confirm"><span>{choice === null ? 'Select your upgrade' : `${PERK_TITLES[state.rewards[choice]!]} selected`}</span><button disabled={choice === null} onClick={() => choice !== null && controller.reward(choice)}>Take upgrade →</button></div>
        <div className="horde-or">OR GROW YOUR NUMBERS</div><button className="horde-skip" onClick={() => controller.reward('skip')}><img src={icons.permanent} alt="" />Skip upgrade · +10 permanent zombies</button>
      </section></div>}
    </>}
    {(state.paused || finished || state.error) && <div className="horde-modal"><section role="dialog" aria-label={state.error ? 'Loading error' : state.paused ? 'Encounter paused' : 'Encounter result'}>
      <h1 className={state.status === 'lost' ? 'horde-critical' : ''}>{state.error ? 'Unable to load' : state.paused ? 'Paused' : state.status === 'won' ? 'Victory' : 'Defeat'}</h1>
      <p>{state.error ?? (state.paused ? 'The horde can wait.' : state.status === 'won' ? 'The last knight has fallen.' : 'Your permanent horde is gone.')}</p>
      {!state.error && <><div className="horde-result-stats">{state.paused ? <>WASD to move{state.sprint.unlocked && ' · Space to sprint'}{state.abilities[0]?.upgrade && ' · Q ability'}{state.abilities[1]?.upgrade && ' · E ability'}<br />Keep at least one permanent zombie alive.</> : <>{clock(state.elapsed)} · {state.permanent} permanent survivors<br />{state.casualties} killed · {state.expired} expired · {state.recruited} recruited</>}</div>
        {state.paused && <AudioControls controller={controller} />}
        <div className="horde-modal-actions">{state.paused && <button className="horde-primary" autoFocus onClick={() => controller.togglePause()}>Resume</button>}<button className={finished ? 'horde-primary' : ''} onClick={() => controller.restart()}>{finished ? 'Play again   R' : 'Restart   R'}</button><button onClick={() => controller.returnToMenu()}>Main menu</button></div></>}
    </section></div>}
  </div>;
}
