import type { HordeController } from '../game/controller';
import { Modal } from './Modal';
import { SaveStatus, clock, type Snapshot } from './GameMenu';
import { GameSettings } from './GameSettings';
import { FieldGuide } from './FieldGuide';
import { CAMPAIGN } from '../data/campaign';
import { HordeIcon } from './HordeIcon';
export function GameDialogs({ state, controller }: { state: Snapshot; controller: HordeController }) {
  if (state.error) return <Modal label="Game interrupted"><h1>A little trouble</h1><p>{state.error}</p><SaveStatus state={state} controller={controller} /><button className="horde-primary" onClick={() => controller.reload()}>Reload game</button></Modal>;
  if (state.panel === 'settings') return <GameSettings state={state} controller={controller} />;
  if (state.panel === 'help') return <FieldGuide state={state} controller={controller} />;
  if (state.confirmNew) return <Modal label="Start a new march?" onClose={() => controller.cancelNew()}><span className="horde-kicker">A FRESH BEGINNING</span><h1>Raise a new horde?</h1><p>This replaces your current checkpoint. Your settings and personal records will stay.</p><div className="horde-modal-actions"><button data-autofocus onClick={() => controller.cancelNew()}>Keep my march</button><button className="horde-primary" onClick={() => controller.start(true)}>Start new march</button></div></Modal>;
  if (state.menu) return null;
  if (state.paused) return <Modal label="Encounter paused" onClose={() => controller.togglePause()}><span className="horde-kicker">{state.location.name.toUpperCase()}</span><h1>The horde can wait</h1><p>Wave {state.wave} of {state.totalWaves} · {clock(state.elapsed)} · {state.mode}</p><div className="horde-pause-population"><HordeIcon name="permanent" /><b>{state.permanent}</b> permanent survivors</div>
    <SaveStatus state={state} controller={controller} />
    <div className="horde-modal-actions"><button className="horde-primary" data-autofocus onClick={() => controller.togglePause()}>Resume march</button><button onClick={() => controller.openPanel('help')}>How to play</button><button onClick={() => controller.openPanel('settings')}>Settings</button><button onClick={() => controller.restart()}>New march</button><button onClick={() => controller.returnToMenu()}>Main menu</button></div>
  </Modal>;
  if (state.status !== 'won' && state.status !== 'lost') return null;
  const won = state.status === 'won', conquered = won ? state.totalWaves : state.wave - 1;
  return <Modal label="Encounter result" className="horde-results"><span className="horde-kicker">{won ? 'THE LAST BANNER FALLS' : 'EVERY LEGEND STARTS SOMEWHERE'}</span><HordeIcon name={won ? 'crown' : 'permanent'} className="horde-result-emblem" /><h1>{won ? 'The kingdom is yours' : 'The march ends here'}</h1><p>{won ? 'From forgotten graves to the castle gates. The living will remember this night.' : `Your permanent horde fell at ${state.location.name}. Rally at ${state.retryLocation ? 'the start of this location' : 'your last checkpoint'} and try another approach.`}</p>
    <div className="horde-result-route" aria-label={`${conquered} of ${state.totalWaves} locations conquered`}>{CAMPAIGN.map((location, i) => <span key={location.id} className={i < conquered ? 'is-conquered' : ''} title={location.name}><HordeIcon name={location.id} /><small>{i < conquered ? '✓' : i + 1}</small></span>)}</div>
    <div className="horde-result-grid"><span><b>{clock(state.elapsed)}</b>March time</span><span><b>{state.permanent}</b>Survivors</span><span><b>{state.recruited}</b>Recruited</span><span><b>{conquered} / {state.totalWaves}</b>Conquered</span></div>
    <SaveStatus state={state} controller={controller} />
    <div className="horde-modal-actions">{!won && state.savedRun && <button data-autofocus className="horde-primary" onClick={() => controller.continueRun(true)}>{state.retryLocation ? 'Retry location' : 'Retry checkpoint'}</button>}<button className={won ? 'horde-primary' : ''} onClick={() => controller.start()}>New march</button><button onClick={() => controller.returnToMenu()}>Main menu</button></div>
  </Modal>;
}
