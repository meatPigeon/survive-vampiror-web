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
    ctx.registerRoute({ id: "horde", label: "Survive Vampiror", icon: "⚔️" });
    ctx.registerScene(createHordeScene(box, ctx.client));
    ctx.registerPanel({ id: "hud", slot: "overlay", component: makeHordeHud(box) });
    ctx.exposeToAgent({
      state: () => box.get()?.describe() ?? { mounted: false, playing: false },
      actions: {
        move: args => get().move(args),
        sprint: () => { get().sprint(); return get().describe(); },
        ability: args => { const slot = Number(args?.slot ?? 0); if (slot !== 0 && slot !== 1) throw new Error("slot must be 0 (Q) or 1 (E)."); get().ability(slot); return get().describe(); },
        aim: args => { const x = Number(args?.x), z = Number(args?.z); if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("aim needs finite world x and z."); get().aim(x, z); return get().describe(); },
        fire: () => { get().fire(); return get().describe(); },
        cancelAim: () => { get().cancelAim(); return get().describe(); },
        zoom: args => { const steps = Number(args?.steps); if (!Number.isFinite(steps)) throw new Error("zoom needs finite steps."); get().zoom(Math.max(-10, Math.min(10, steps))); return get().describe(); },
      },
      describeActions: {
        move: "Hold real movement input: {dir: up|down|left|right|up-left|up-right|down-left|down-right, ms?: 50..3000}. X is right, Z is down.",
        sprint: "Use the unlocked Space sprint, subject to the same gameplay gates and cooldown.",
        ability: "Activate the real unlocked Q/E ability: {slot?: 0|1}.",
        aim: "Aim an active sling at a ground point: {x:number,z:number}; validates recruit range and full scatter disk.",
        fire: "Fire the active sling at its valid aim point; spends a temporary zombie.",
        cancelAim: "Cancel sling aiming without spending ammo or cooldown.",
        zoom: "Adjust the real camera zoom: {steps:number}; positive zooms in, bounded to the game's range.",
      },
    });
    function get() { const controller = box.get(); if (!controller) throw new Error("Open Horde encounter from the lobby first."); return controller; }
  },
});
