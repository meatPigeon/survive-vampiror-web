import type { EngineScene } from "@idosgames/module-sdk";
import { HordeController } from "./game/controller";
import type { createControllerBox } from "./react/controller-box";

export function createHordeScene(box: ReturnType<typeof createControllerBox<HordeController>>): EngineScene {
  let controller: HordeController | null = null;
  return {
    surface: "fullbleed-canvas",
    mount({ host }) { controller = new HordeController(host); box.set(controller); },
    ready: () => controller?.ready ?? Promise.resolve(),
    activate: () => controller?.setRunning(true),
    suspend: () => controller?.setRunning(false),
    capture: () => controller?.view.capture() ?? Promise.resolve(null),
    destroy() { box.set(null); controller?.destroy(); controller = null; },
  };
}
