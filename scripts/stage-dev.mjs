import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CodexMcp, unwrapMcpResult } from './lib/codex-mcp.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
let client;
const args = process.argv.slice(2);
const statusOnly = args[0] === '--status';
function run(command, argv) {
  const result = spawnSync(command, argv, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}
async function call(tool, arguments_) {
  return unwrapMcpResult(await client.call('idos-data', tool, arguments_));
}
try {
  const identity = await readFile(join(cwd, 'src/idos.title.ts'), 'utf8');
  const titleID = identity.match(/^export const IDOS_TITLE_ID\s*=\s*["']([A-Z0-9]{8})["'];/m)?.[1];
  if (!titleID) throw new Error('Expected a canonical title ID in src/idos.title.ts.');
  let buildID = statusOnly ? args[1] : undefined;
  if (statusOnly && !/^bld[a-z0-9]+$/i.test(buildID ?? '')) throw new Error('Use --status <build_id>.');
  if (!statusOnly) {
    run('npm', ['run', 'typecheck']);
    run('npm', ['test']);
    run('npm', ['run', 'verify']);
    run('npm', ['run', 'verify:solana']);
    run('npm', ['run', 'package:dev']);
  }
  client = new CodexMcp(cwd);
  await client.start(cwd);
  let build;
  if (statusOnly) {
    build = await call('get_build', { title_id: titleID, build_id: buildID });
  } else {
    const slot = await call('begin_build_upload', { title_id: titleID });
    if (typeof slot.BuildId !== 'string' || typeof slot.UploadUrl !== 'string') {
      throw new Error('Unexpected iDos upload-slot response.');
    }
    buildID = slot.BuildId;
    const url = new URL(slot.UploadUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.r2.cloudflarestorage.com')) {
      throw new Error('Unexpected upload destination; review it before sending the archive.');
    }
    const body = await readFile(join(cwd, '.idos/dev-build.zip'));
    if (body.length > slot.MaxZipBytes) throw new Error('Archive exceeds the iDos upload limit.');
    const upload = await fetch(url, { method: 'PUT', body, redirect: 'error' });
    if (!upload.ok) throw new Error(`Upload failed (HTTP ${upload.status}).`);
    console.log(JSON.stringify({ uploaded: true, buildID, bytes: body.length }));
    build = await call('finish_build_upload', {
      title_id: titleID, build_id: buildID, deploy: false,
      label: args[0] ?? 'DEV development build',
    });
  }
  for (let attempt = 0; ['Queued', 'Building'].includes(build.Status) && attempt < 60; attempt++) {
    console.log(JSON.stringify({ buildID, status: build.Status }));
    await new Promise(resolve => setTimeout(resolve, 3000));
    build = await call('get_build', { title_id: titleID, build_id: buildID });
  }
  if (build.Status !== 'Staged') throw new Error(`Expected a staged version; received ${build.Status}.`);
  if (build.DeployRequested) throw new Error('This version has a live deployment request.');
  const testURL = new URL(build.TestUrl);
  if (testURL.protocol !== 'https:' || testURL.hostname !== `${titleID.toLowerCase()}-dev.idos.games`) {
    throw new Error('Expected an iDos DEV test URL.');
  }
  const receipt = {
    titleID, environment: `${titleID}-DEV`, buildID: build.BuildId,
    version: build.Version, status: build.Status, testURL: build.TestUrl,
    livePromotion: false,
  };
  await mkdir(join(cwd, '.idos'), { recursive: true });
  await writeFile(join(cwd, '.idos/last-stage.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { client?.close(); }
