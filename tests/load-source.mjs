import ts from 'typescript';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(join(tmpdir(), 'horde-test-'));
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
for (const name of ['types', 'rules', 'math', 'world', 'combat', 'movement', 'abilities', 'simulation', 'input', 'camera', 'motion-air', 'material-look', 'effects', 'actors']) {
  const source = await readFile(new URL(`../src/modules/horde/game/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/(from\s+["'])(\.\/[^"']+)(["'])/g, '$1$2.mjs$3').replace(/(from\s+["'])(three[^"']*)(["'])/g, (_, prefix, name, suffix) => `${prefix}${import.meta.resolve(name)}${suffix}`);
  await writeFile(join(directory, `${name}.mjs`), compiled);
}
export const simulation = await import(pathToFileURL(join(directory, 'simulation.mjs')));
export const { HordeInput } = await import(pathToFileURL(join(directory, 'input.mjs')));
export const { ArenaCamera } = await import(pathToFileURL(join(directory, 'camera.mjs')));
export const { Actor } = await import(pathToFileURL(join(directory, 'actors.mjs')));
export const { CombatEffects } = await import(pathToFileURL(join(directory, 'effects.mjs')));
