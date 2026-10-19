import ts from 'typescript';
import { readFile, writeFile, mkdtemp, mkdir, readdir } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(join(tmpdir(), 'horde-test-'));
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
for (const folder of ['shared', 'game', 'data']) {
  await mkdir(join(directory, folder));
  const root = new URL(folder === 'shared' ? '../src/shared/' : `../src/modules/horde/${folder}/`, import.meta.url);
  const names = await readdir(root);
  for (const name of names.filter(name => name.endsWith('.ts'))) {
    const source = await readFile(new URL(name, root), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('../../../shared/', '../shared/').replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, '$1$2.mjs$3').replace(/(from\s+["'])(three[^"']*)(["'])/g, (_, prefix, name, suffix) => `${prefix}${import.meta.resolve(name)}${suffix}`);
    await writeFile(join(directory, folder, name.replace(/\.ts$/, '.mjs')), compiled);
  }
}
export const simulation = await import(pathToFileURL(join(directory, 'game/simulation.mjs')));
export const campaign = await import(pathToFileURL(join(directory, 'data/campaign.mjs')));
export const { HordeInput } = await import(pathToFileURL(join(directory, 'game/input.mjs')));
export const { ArenaCamera } = await import(pathToFileURL(join(directory, 'game/camera.mjs')));
export const { Actor } = await import(pathToFileURL(join(directory, 'game/actors.mjs')));
export const { CombatEffects } = await import(pathToFileURL(join(directory, 'game/effects.mjs')));
export const loadGame = name => import(pathToFileURL(join(directory, `game/${name}.mjs`)));
// Exercise the real controller and save lifecycle without a GPU or browser audio.
export async function loadController() {
  let source = await readFile(join(directory, 'game/controller.mjs'), 'utf8');
  source = source.replace("from './view.mjs'", "from './fake-view.mjs'").replace("from './audio.mjs'", "from './fake-audio.mjs'").replaceAll('import.meta.env.DEV', 'true');
  await writeFile(join(directory, 'game/fake-view.mjs'), `
    export class HordeView {
      renderer = {domElement: new EventTarget()}; ready = Promise.resolve();
      camera = {factor:1, zoom(){}, update(){}, screen(_canvas,p){return {x:p.x,y:p.z}}, aim(_canvas,x,z){return {point:{x,z},onGround:true}}};
      configure() {} update() {} render() {} reset() {} handleEvents() {} destroy() {}
      setDestination(point) {this.destination = point;}
    }`);
  await writeFile(join(directory, 'game/fake-audio.mjs'), `
    export class HordeAudio {
      settings = {music:65,effects:80}; paused = false;
      setVolume(bus,value) {this.settings[bus] = value;} pause(value) {this.paused = value;}
      stopAll() {} menu() {} beginBattle() {} unlock() {} events() {} tick() {} command() {} destroy() {}
    }`);
  await writeFile(join(directory, 'game/test-controller.mjs'), source);
  return import(pathToFileURL(join(directory, 'game/test-controller.mjs')));
}

export const loadShared = name => import(pathToFileURL(join(directory, `shared/${name}.mjs`)));
