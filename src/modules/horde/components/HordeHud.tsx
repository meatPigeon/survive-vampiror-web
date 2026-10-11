import { useSyncExternalStore, type CSSProperties } from 'react';
import type { HordeController } from '../game/controller';
import type { createControllerBox } from '../react/controller-box';
import { CAMPAIGN } from '../data/campaign';
import { CampaignHud } from './CampaignHud';
import { HordeIcon } from './HordeIcon';
import { ActionHud } from './ActionHud';
import { GameMenu, clock, SaveStatus } from './GameMenu';
import { GameDialogs } from './GameDialogs';
import { RewardDialog } from './RewardDialog';
import { MovementControls } from './MovementControls';
import './horde.css';
export function makeHordeHud(box: ReturnType<typeof createControllerBox<HordeController>>) {
  return function HordeHud() { const controller = useSyncExternalStore(box.subscribe, box.get, box.get); return controller ? <Hud controller={controller} /> : null; };
}
function Hud({ controller }: { controller: HordeController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const finished = state.status === 'won' || state.status === 'lost', k = state.knight;
  const dialog = !!(state.panel || state.confirmNew || state.error || !state.menu && (state.paused || finished || state.awaitingReward));
  const aiming = state.abilities.some(a => a.aiming);
  const threat = { sweep: 'Sweep — move sideways', charge: 'Charge — clear the lane', spin: 'Spin — get out of the circle', crossbow: 'Crossbow — leave the blue line', rush: 'Stampede — bait the turn', bash: 'Shield bash — step out of the cone', consecration: 'Consecration — leave the marked circle', lance: 'Lance thrust — clear the narrow lane', firebomb: 'Firebomb — leave the burning ground', shockwave: 'Royal shockwave — stay beyond the ring or follow behind it' }[k.attack];
  return <div className={`horde-hud ${state.reducedMotion ? 'horde-reduced-motion' : ''}`} data-touch={state.settings.touch} style={{ '--location-accent': `#${state.location.palette.accent.toString(16).padStart(6, '0')}` } as CSSProperties}>
    <div className="horde-ui-layer" inert={dialog}>
    {state.menu ? <GameMenu state={state} controller={controller} /> : <>
      <div className="horde-knight-status">
        <div><span>{state.location.defender.toUpperCase()}</span><span>{k.hp} / {k.maxHp}</span></div>
        <div className="horde-health" role="progressbar" aria-label="Knight health" aria-valuenow={k.hp} aria-valuemin={0} aria-valuemax={k.maxHp}><i style={{ width: `${state.healthTrail / k.maxHp * 100}%` }} /><b style={{ width: `${k.hp / k.maxHp * 100}%` }} /></div>
        <small>{state.mode} · Wave {state.wave} / {state.totalWaves} · Phase {['I', 'II', 'III'][k.phase - 1]}</small><strong className="horde-location-label">{state.location.name}</strong>
      </div>
      <div className="horde-top-right"><time><HordeIcon name="clock" />{clock(state.elapsed)}</time><button onClick={() => controller.togglePause()} disabled={finished}><HordeIcon name="pause" />Pause</button></div>
      {import.meta.env.DEV && state.loaded && !dialog && !state.betweenWaves && k.hp > 0 && <button className="horde-debug-kill" title="Temporary test control. Starts a practice run; saved progress and personal records are preserved." onClick={() => controller.debugKillKnight()}>Insta-kill knight</button>}
      <div className={`horde-numbers ${state.permanent <= 8 ? 'horde-critical' : ''}`}>
        <div><HordeIcon name="permanent" /><strong>{state.permanent}</strong><span>{state.permanent <= 8 ? 'Keep them alive' : 'permanent'}</span></div>
        {state.temporary > 0 && <div className="horde-temporary"><HordeIcon name="temporary" /><strong>+{state.temporary}</strong><span className={(state.nextExpiration ?? 0) <= 10 ? 'horde-expiring' : ''}>temporary · {Math.ceil(state.nextExpiration ?? 0)}s</span></div>}
      </div>
      {state.status === 'playing' && k.state !== 'stopped' && <div className="horde-rally"><HordeIcon name="recruit" /><div><b>{state.site ? `+${state.site.stock} recruits` : 'Next recruits'}</b><small>{!state.site ? `New site in ${Math.ceil(state.siteTimeLeft)}s` : `${state.alive >= 60 ? 'Horde full' : state.site.progress > 0 ? 'Summoning' : 'Hold the glowing ring'} · ${Math.ceil(state.siteTimeLeft)}s`}</small></div>{state.site && <span className="horde-rally-meter" aria-hidden="true"><i style={{ width: `${state.site.progress * 100}%` }} /></span>}</div>}
      <CampaignHud state={state} />
      {!state.betweenWaves && !finished && k.state !== 'hunt' && state.status !== 'ready' && <div className={`horde-threat ${k.state === 'recovery' ? 'horde-exposed' : ''}`}><HordeIcon name="attack" /><span>{k.state === 'recovery' ? 'Exposed — attack!' : threat}</span></div>}
      {!dialog && !state.betweenWaves && <>
        {state.status === 'ready' && state.settings.hints && <div className="horde-first-steps"><HordeIcon name="permanent" /><b>Your march begins here</b><span>Tap the ground or use {state.keys.up}/{state.keys.left}/{state.keys.down}/{state.keys.right} to move.<br />Surround the knight to bite. Keep your permanent horde alive.</span><button onClick={() => controller.openPanel('help')}>Read the field guide</button></div>}
        {state.status === 'playing' && state.elapsed < 25 && state.settings.hints && !state.destination && !aiming && <div className="horde-movement-hint">Hold the glowing ring to recruit · Escape to pause</div>}
        <div className="horde-zoom" role="group" aria-label="Camera zoom"><button aria-label="Zoom out" title="Zoom out" onClick={() => controller.zoom(-1)}><HordeIcon name="zoom-out" /></button><button aria-label="Zoom in" title="Zoom in" onClick={() => controller.zoom(1)}><HordeIcon name="zoom-in" /></button></div>
        <ActionHud state={state} controller={controller} />
        {(state.destination || aiming) && <div className="horde-command-bar"><span>{aiming ? 'Tap a landing spot to fire' : 'Marching to your marker'}</span><button onClick={() => controller.stop()}>{aiming ? 'Cancel aim' : 'Stop'}</button></div>}
        <MovementControls controller={controller} />
      </>}
      {state.saveStatus === 'error' && !dialog && <div className="horde-save-warning"><SaveStatus state={state} controller={controller} /></div>}
      {state.betweenWaves && !state.awaitingReward && !state.paused && <div className="horde-countdown"><span>Marching to {CAMPAIGN[state.wave]?.name}</span><strong key={Math.ceil(state.waveTimeLeft)}>{Math.ceil(state.waveTimeLeft)}</strong><small>{CAMPAIGN[state.wave]?.subtitle}</small></div>}
    </>}
    </div>
    {state.awaitingReward && !state.menu && !state.paused && !state.panel && !state.confirmNew && !state.error && <RewardDialog key={state.wave} state={state} controller={controller} />}
    <GameDialogs state={state} controller={controller} />
  </div>;
}
