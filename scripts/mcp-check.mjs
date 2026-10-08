import { fileURLToPath } from 'node:url';
import { CodexMcp, unwrapMcpResult } from './lib/codex-mcp.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const client = new CodexMcp(cwd);
try {
  await client.start(cwd);
  let ok = true;
  for (const name of ['idos-code', 'idos-data']) {
    const result = await client.status(name);
    const server = result.data.find(entry => entry.name === name);
    const connected = server?.runtimeStatus === 'connected';
    console.log(JSON.stringify({
      server: name, ok: connected, status: server?.runtimeStatus,
      auth: server?.authStatus, tools: Object.keys(server?.tools ?? {}).length,
    }));
    if (!connected) ok = false;
  }
  if (ok) {
    unwrapMcpResult(await client.call('idos-data', 'get_currency', { title_id: 'FYVPZFCO-DEV' }));
    console.log(JSON.stringify({ check: 'DEV configuration read', ok: true, titleID: 'FYVPZFCO-DEV' }));
  }
  if (!ok) {
    console.error('Check codex mcp list. For iDos Data access, run codex mcp login idos-data and grant only FYVPZFCO-DEV.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { client.close(); }
