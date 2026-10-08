import { useSyncExternalStore } from "react";
import { Button } from "@idosgames/react/ui";
import type { HordeController } from "../game/controller";
import { RULES } from "../game/simulation";
import type { createControllerBox } from "../react/controller-box";
import "./horde.css";

export function makeHordeHud(box: ReturnType<typeof createControllerBox<HordeController>>) {
  return function HordeHud() {
    const controller = useSyncExternalStore(box.subscribe, box.get, box.get);
    return controller ? <Hud controller={controller} /> : null;
  };
}
function Hud({ controller }: { controller: HordeController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const finished = state.status === "won" || state.status === "lost";
  return <div className="horde-hud">
    <header className="horde-title"><strong>SURVIVE VAMPIROR</strong><span>Horde encounter · 01</span></header>
    <div className="horde-controls"><Button tone="grey" size="sm" onClick={() => controller.togglePause()} disabled={finished || !state.loaded}>
      {state.paused ? "Resume" : "Pause"}
    </Button></div>
    <div className="horde-status">
      <div className="horde-count"><b>{state.alive}</b><span>/ 40 zombies</span></div>
      <div className="horde-knight"><div><span>THE KNIGHT</span><span>{state.knightHp} / {RULES.knightHealth}</span></div>
        <progress aria-label="Knight health" value={state.knightHp} max={RULES.knightHealth} />
        <small>{state.status === "ready" ? "Waiting for your first move" : state.phase === "windup" ? "SWEEP INCOMING — leave the orange arc" : state.phase === "recovery" ? "RECOVERING — close in and bite" : "HUNTING THE HORDE"}</small>
      </div>
    </div>
    {state.loaded && !finished && !state.paused && <>
      <div className="horde-hint">{state.status === "ready" ? "Move your horde to begin. Surround the knight to bite." : "Bites are automatic. Dodge the orange sweep."}<span>WASD / arrows · Esc pause · R restart</span></div>
      <div className="horde-dpad" aria-label="Horde direction controls">
        {[{ dir: "up", icon: "↑" }, { dir: "left", icon: "←" }, { dir: "down", icon: "↓" }, { dir: "right", icon: "→" }].map(({ dir, icon }) =>
          <button key={dir} className={`horde-${dir}`} type="button" aria-label={`Move horde ${dir}`}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); controller.input.holdTouch(event.pointerId, dir); }}
            onPointerUp={event => controller.input.releaseTouch(event.pointerId)}
            onPointerCancel={event => controller.input.releaseTouch(event.pointerId)}
            onLostPointerCapture={event => controller.input.releaseTouch(event.pointerId)}>{icon}</button>)}
      </div>
    </>}
    {(state.paused || finished || state.error) && <div className="horde-modal"><section role="dialog" aria-label={state.error ? "Loading error" : state.paused ? "Encounter paused" : "Encounter result"}>
      <span className="horde-eyebrow">{state.error ? "ASSET ERROR" : state.paused ? "TAKE A BREATH" : "ENCOUNTER COMPLETE"}</span>
      <h1>{state.error ? "Unable to load" : state.paused ? "Paused" : state.status === "won" ? "The knight has fallen" : "Your horde has fallen"}</h1>
      <p>{state.error ?? (state.paused ? "Bring the horde in during recovery. Retreat before the sweep lands." : `${state.alive} survived · ${RULES.count - state.alive} casualties · ${Math.floor(state.elapsed)} seconds`)}</p>
      <div>{state.paused && <Button tone="green" onClick={() => controller.togglePause()}>Resume encounter</Button>}
        {!state.error && <Button tone={finished ? "green" : "grey"} onClick={() => controller.restart()}>Restart encounter</Button>}</div>
    </section></div>}
  </div>;
}
