import type { HordeController } from '../game/controller';
import { CAMPAIGN } from '../data/campaign';
import { HordeIcon } from './HordeIcon';
export type Snapshot = ReturnType<HordeController['getSnapshot']>;
export const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function SaveStatus({ state, controller }: { state: Snapshot; controller: HordeController }) {
  return <div className={`horde-save horde-save-${state.saveStatus}`}>
    <span role="status">{state.saveStatus === 'loading' ? 'Loading your saved game…' : state.saveStatus === 'saving' ? 'Saving to your account…' : state.saveStatus === 'error' ? state.saveError : state.hasSynced ? 'Saved to your account' : 'Cloud save connected'}</span>
    {state.saveStatus === 'error' && <button onClick={() => void controller.retrySave()}>Retry save connection</button>}
  </div>;
}
export function GameMenu({ state, controller }: { state: Snapshot; controller: HordeController }) {
  return <div className="horde-menu"><div className="horde-menu-shade" /><section className="horde-menu-content" aria-label="Main menu">
    <span className="horde-kicker">YOU ARE THE HORDE</span><h1>SURVIVE<br />VAMPIROR</h1>
    <p>Forty restless souls. Five defenders.<br />Lead the dead from village to kingdom.</p>
    {state.savedRun && <div className="horde-continue">
      <span>YOUR MARCH AWAITS</span><b>{state.savedRun.location}</b><small>Wave {state.savedRun.wave} of {state.totalWaves} · {clock(state.savedRun.elapsed)} · {state.savedRun.normal ? 'Relentless' : 'Adventure'}</small>
      <button className="horde-raise" disabled={!state.loaded} onClick={() => controller.continueRun()}>Continue march <HordeIcon name="arrow" /></button>
    </div>}
    <div className="horde-mode" aria-label="New march difficulty">
      <button disabled={!state.loaded} aria-pressed={!state.normal} onClick={() => controller.setNormal(false)}>Adventure</button>
      <button disabled={!state.loaded} aria-pressed={state.normal} onClick={() => controller.setNormal(true)}>Relentless</button>
    </div>
    <small>{state.normal ? 'A demanding march. Every knight hit is lethal.' : 'Start here. Your zombies can withstand several hits.'} <span className="horde-mode-note">Crossbow bolts are always lethal.</span></small>
    <button className={state.savedRun ? 'horde-new-march' : 'horde-raise'} disabled={!state.loaded} onClick={() => controller.start()}>{!state.loaded ? 'Preparing the horde…' : state.savedRun ? 'Start a new march' : 'Raise the horde →'}</button>
    <div className="horde-menu-links"><button onClick={() => controller.openPanel('help')}>How to play</button><button disabled={!state.loaded} onClick={() => controller.openPanel('settings')}>Settings</button></div>
    <SaveStatus state={state} controller={controller} />
    {state.saveNotice && <small role="status">{state.saveNotice}</small>}
    {state.records.completed > 0 && <div className="horde-record"><HordeIcon name="crown" /><span><b>{state.records.wins} {state.records.wins === 1 ? 'kingdom' : 'kingdoms'} conquered</b><small>{state.records.bestTime !== null ? `Fastest victory ${clock(state.records.bestTime)} · Most survivors ${state.records.bestSurvivors}` : `Farthest march: ${state.records.bestWave} of ${state.totalWaves} locations`}</small></span></div>}
    {state.records.history.length > 0 && <details className="horde-history"><summary>Recent marches</summary><ol>{state.records.history.map(run => <li key={run.id}><span>{run.won ? 'Kingdom conquered' : `${run.conquered} of ${state.totalWaves} conquered`}<small>{run.normal ? 'Relentless' : 'Adventure'} · {run.survivors} survivors</small></span><time>{clock(run.elapsed)}</time></li>)}</ol></details>}
  </section><div className="horde-menu-route" aria-label="Conquest route">{CAMPAIGN.map((location, i) => <span key={location.id}><HordeIcon name={location.id} /><b>{i + 1}</b><small>{location.name}</small></span>)}</div></div>;
}
