import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class CodexMcp {
  constructor(cwd) {
    this.nextID = 1;
    this.pending = new Map();
    this.child = spawn('codex', [
      'app-server', '--stdio',
    ], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    // stderr can contain diagnostic data from MCP servers; don't print credentials.
    this.child.stderr.resume();
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', code => this.fail(new Error(`Codex transport exited (${code}).`)));
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.method && message.id != null) {
        this.child.stdin.write(JSON.stringify({ id: message.id, error: {
          code: -32601, message: 'Interactive request requires the user in Codex.',
        } }) + '\n');
        this.fail(new Error(`User interaction required: ${message.method}`));
      } else if (message.id != null) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
    });
  }
  fail(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
  request(method, params) {
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out: ${method}`));
      }, 180000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async start(cwd) {
    await this.request('initialize', { clientInfo: {
      name: 'survive-vampiror-mcp', title: 'Survive Vampiror MCP tools', version: '0.1.0',
    }, capabilities: { experimentalApi: true } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const result = await this.request('thread/start', { cwd, ephemeral: true });
    this.threadID = result.thread.id;
    return this;
  }
  status(serverName) {
    return this.request('mcpServerStatus/list', {
      serverName, threadId: this.threadID, detail: 'toolsAndAuthOnly',
    });
  }
  call(server, tool, args) {
    return this.request('mcpServer/tool/call', {
      threadId: this.threadID, server, tool, arguments: args,
    });
  }
  close() { this.child.kill(); }
}

export function unwrapMcpResult(result) {
  if (result.isError) throw new Error('iDos MCP rejected the operation.');
  const text = result.content?.find(item => item.type === 'text')?.text;
  const value = result.structuredContent ?? (text ? JSON.parse(text) : null);
  if (!value || value.Success === false) throw new Error('iDos operation failed.');
  return value.Data ?? value;
}
