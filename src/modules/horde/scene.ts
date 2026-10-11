import type { EngineScene } from "@idosgames/module-sdk";
import type { IDosGamesClient } from '@idosgames/core';
import { HordeController } from "./game/controller";
import type { createControllerBox } from "./react/controller-box";

export function createHordeScene(box: ReturnType<typeof createControllerBox<HordeController>>, client: IDosGamesClient): EngineScene {
  let controller: HordeController | null = null;
  let fallback: HTMLElement | null = null;
  return {
    surface: "fullbleed-canvas",
    mount({ host }) {
      try { controller = new HordeController(host, client); box.set(controller); }
      catch (error) {
        console.error('[horde] graphics startup failed', error);
        fallback = document.createElement('section'); fallback.className = 'horde-boot-error'; fallback.setAttribute('role', 'alert');
        const heading = document.createElement('h1'); heading.textContent = 'The horde needs a little help';
        const copy = document.createElement('p'); copy.textContent = 'This browser could not start the game graphics. Enable WebGL or try another browser, then reload.';
        const retry = document.createElement('button'); retry.textContent = 'Reload game'; retry.onclick = () => window.location.reload();
        fallback.append(heading, copy, retry); host.appendChild(fallback);
      }
    },
    ready: () => controller?.ready ?? Promise.resolve(),
    activate: () => controller?.setRunning(true),
    suspend: () => controller?.setRunning(false),
    capture: () => controller?.view.capture() ?? Promise.resolve(null),
    destroy() { box.set(null); controller?.destroy(); controller = null; fallback?.remove(); fallback = null; },
  };
}
