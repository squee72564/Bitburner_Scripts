require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const chokidar = require('chokidar');
const fg = require('fast-glob');
const WebSocket = require('ws');
const { dist, allowedFiletypes } = require('./config');

const rpcUrl = process.env.BITBURNER_RPC_URL;
if (!rpcUrl) {
  throw new Error('BITBURNER_RPC_URL is required');
}

const server = process.env.BITBURNER_SERVER || 'home';
const timeoutMs = Number.parseInt(process.env.RPC_TIMEOUT_MS || '5000', 10);

function normalize(p) {
  return p.replace(/\\/g, '/');
}

class RpcClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.nextId = 1;
    this.pending = new Map();
    this.reconnectTimer = null;
  }

  start() {
    this.connect();
  }

  connect() {
    if (this.connected || this.ws) return;
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.connected = true;
      console.log(`Remote sync connected (${this.url})`);
      flushQueue();
    });

    this.ws.on('message', (data) => this.handleMessage(data.toString()));

    this.ws.on('close', () => {
      this.connected = false;
      this.ws = null;
      this.rejectPending(new Error('Remote API disconnected'));
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      this.connected = false;
      this.ws = null;
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 500);
  }

  call(method, params) {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error('Remote API disconnected'));
    }

    const id = this.nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Remote API timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(payload), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  handleMessage(payload) {
    let message;
    try {
      message = JSON.parse(payload);
    } catch {
      return;
    }

    if (!message || typeof message !== 'object' || typeof message.id !== 'number') {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message || 'Remote API error'));
      return;
    }

    pending.resolve(message.result);
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

const client = new RpcClient(rpcUrl);

const queue = new Map();
let flushInProgress = false;

async function pushFile(filename, content) {
  await client.call('pushFile', { filename, content, server });
}

async function deleteFile(filename) {
  await client.call('deleteFile', { filename, server });
}

async function flushQueue() {
  if (!client.connected || flushInProgress) return;
  flushInProgress = true;

  for (const [filename, op] of queue) {
    try {
      if (op.type === 'delete') {
        await deleteFile(filename);
        console.log(`${filename} deleted`);
      } else {
        await pushFile(filename, op.content);
        console.log(`${filename} changed`);
      }
      queue.delete(filename);
    } catch (err) {
      console.warn(`Remote sync failed for ${filename}: ${err.message}`);
      break;
    }
  }

  flushInProgress = false;
}

function enqueue(filename, op) {
  queue.set(filename, op);
  flushQueue();
}

function isAllowed(filename) {
  const ext = path.extname(filename);
  return !ext || allowedFiletypes.includes(ext);
}

async function initialSync() {
  const entries = await fg(`${dist}/**/*`, { onlyFiles: true });
  for (const file of entries) {
    if (!isAllowed(file)) continue;
    const relative = normalize(path.relative(dist, file));
    const content = await fs.promises.readFile(file, 'utf8');
    enqueue(relative, { type: 'push', content });
  }
}

console.log('Start remote sync...');
client.start();
initialSync().catch((err) => console.warn(`Initial sync failed: ${err.message}`));

chokidar.watch(`${dist}/**/*`, { ignoreInitial: true }).on('all', async (event, file) => {
  if (!isAllowed(file)) return;

  const relative = normalize(path.relative(dist, file));
  if (event === 'unlink') {
    enqueue(relative, { type: 'delete' });
    return;
  }

  if (event === 'add' || event === 'change') {
    const content = await fs.promises.readFile(file, 'utf8');
    enqueue(relative, { type: 'push', content });
  }
});
