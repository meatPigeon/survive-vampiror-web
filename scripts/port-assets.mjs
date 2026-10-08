import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(project, '../survive-vampiror');
const destination = join(project, 'src/modules/horde/assets/reference');
function run(command, args, cwd = source) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
  return result.stdout.trim();
}
async function walk(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, path)); else files.push(path);
  }
  return files.sort();
}
await mkdir(destination, { recursive: true });
if (!process.argv.includes('--manifest-only')) {
  console.log(run('godot', ['--headless', '--path', source, '--script', join(project, 'scripts/port-assets.gd'), '--', destination]));
  for (const folder of ['audio', 'fonts', 'ui']) {
    const root = join(source, 'assets', folder);
    for (const file of await walk(root)) {
      if (!/\.(wav|ogg|ttf|txt|svg|png)$/i.test(file)) continue;
      const target = join(destination, folder, file); await mkdir(dirname(target), { recursive: true });
      await copyFile(join(root, file), target);
    }
  }
}
const files = {};
for (const file of await walk(destination)) {
  if (!/\.(glb|wav|ogg|ttf|txt|svg|png)$/i.test(file)) continue;
  const bytes = await readFile(join(destination, file));
  files[file] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const manifest = { source: '../survive-vampiror', revision: run('git', ['rev-parse', 'HEAD']), engine: run('godot', ['--version']), files };
await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Recorded ${Object.keys(files).length} assets from ${manifest.revision}.`);
