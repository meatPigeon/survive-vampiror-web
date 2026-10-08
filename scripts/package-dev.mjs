import { spawnSync } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const artifact = join(cwd, '.idos', 'dev-build.zip');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}
try {
  run('npm', ['run', 'build'], { env: { ...process.env, VITE_IDOS_ENV: 'dev' } });
  await mkdir(join(cwd, '.idos'), { recursive: true });
  // Only replaces this script's generated archive, never source files.
  await rm(artifact, { force: true });
  run('zip', ['-q', '-r', artifact, '.'], { cwd: join(cwd, 'dist') });
  run('unzip', ['-tqq', artifact]);
  console.log(JSON.stringify({ artifact, bytes: (await stat(artifact)).size, environment: 'FYVPZFCO-DEV' }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
