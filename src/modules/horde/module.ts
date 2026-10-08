import { defineModule } from "@idosgames/module-sdk";
import { HordeController } from "./game/controller";
import { createControllerBox } from "./react/controller-box";
import { createHordeScene } from "./scene";
import { makeHordeHud } from "./components/HordeHud";

export const hordeModule = defineModule({
  id: "horde",
  meta: { name: "Survive Vampiror", type: "game", genre: "survival", engine: "three" },
  setup(ctx) {
    const box = createControllerBox<HordeController>();
    ctx.registerRoute({ id: "horde", label: "Horde encounter", icon: "⚔️" });
    ctx.registerScene(createHordeScene(box));
    ctx.registerPanel({ id: "hud", slot: "overlay", component: makeHordeHud(box) });
    ctx.exposeToAgent({
      state: () => box.get()?.describe() ?? { mounted: false, playing: false },
      actions: { move: args => {
        const controller = box.get();
        if (!controller) throw new Error("Open Horde encounter from the lobby first.");
        return controller.move(args);
      } },
      describeActions: { move: "Hold the real horde movement input: {dir: up|down|left|right|up-left|up-right|down-left|down-right, ms?: 50..3000}. World X is right, Z is down." },
    });
  },
});
