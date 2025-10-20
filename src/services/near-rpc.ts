import { cfg } from '../shared/config';
import { debugError } from '../utils/debug-logger';

// ---- Network config ----
export interface NEARConfig {
  networkId: string;
  nodeUrl: string;
}

export const NEAR_NETWORKS: Record<string, NEARConfig> = {
  mainnet: {
    networkId: 'mainnet',
    nodeUrl: 'https://rpc.mainnet.fastnear.com/',
  },
  testnet: {
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.fastnear.com/',
  },
  localnet: {
    networkId: 'localnet',
    nodeUrl: 'http://127.0.0.1:3030',
  },
};

let currentConfig: NEARConfig | null = null;

export function setNEARConfig(network: string) {
  const found = NEAR_NETWORKS[network];
  if (!found) throw new Error(`Unknown NEAR network: ${network}`);
  currentConfig = found;
}

export function getNEARConfig(): NEARConfig {
  if (!currentConfig) setNEARConfig(cfg().NEAR_NETWORK);
  return currentConfig!;
}

// ---- Helpers ----
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const jitter = (base: number) => Math.min(base + Math.random() * 200, base * 1.5);

// ---- Circuit Breaker ----
class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  shouldBlock(): boolean {
    const { CB_FAILURE_THRESHOLD, CB_RESET_AFTER_MS } = cfg();
    if (this.failures < CB_FAILURE_THRESHOLD) return false;
    const now = Date.now();
    const elapsed = now - this.openedAt;
    // Half-open after reset window
    return elapsed < CB_RESET_AFTER_MS;
  }

  onSuccess() {
    this.failures = 0;
    this.openedAt = 0;
  }

  onFailure() {
    this.failures++;
    if (this.failures === cfg().CB_FAILURE_THRESHOLD) {
      this.openedAt = Date.now();
    }
  }
}

const breaker = new CircuitBreaker();

// ---- Core RPC ----
type RpcOptions = { timeoutMs?: number; retries?: number };

export async function sendRpc(method: string, params: any, opts: RpcOptions = {}): Promise<any> {
  const conf = getNEARConfig();
  const { FASTNEAR_AUTH_TOKEN } = cfg();
  const timeoutMs = opts.timeoutMs ?? cfg().RPC_TIMEOUT_MS;
  const retries = opts.retries ?? cfg().RPC_RETRIES;

  if (breaker.shouldBlock()) {
    throw new Error('RPC circuit open; backing off');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'accept': '*/*',
  };
  if (FASTNEAR_AUTH_TOKEN) headers['authorization'] = `Bearer ${FASTNEAR_AUTH_TOKEN}`;

  const body = JSON.stringify({ jsonrpc: '2.0', id: `csli-${Date.now()}`, method, params });

  let attempt = 0;
  // Simple retry with exponential backoff + jitter on network/server errors
  while (true) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(conf.nodeUrl, { method: 'POST', headers, body, signal: controller.signal });
      clearTimeout(to);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = await res.json();
      if (json.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);

      breaker.onSuccess();
      return json;
    } catch (err) {
      clearTimeout(to);
      breaker.onFailure();
      if (attempt >= retries) throw err;
      const delay = jitter(400 * Math.pow(2, attempt));
      await sleep(Math.min(delay, 2000));
      attempt++;
    }
  }
}

// ---- RPC convenience ----
export async function getNetworkStatus() { return sendRpc('status', {}); }
export async function getBlock(params: { finality?: 'final' | 'optimistic'; block_id?: number | string }) {
  return sendRpc('block', params);
}
export async function getChunk(params: { chunk_id?: string; block_id?: number; shard_id?: number }) {
  return sendRpc('chunk', params);
}
export async function getTransaction(params: { tx_hash: string; sender_account_id: string; wait_until?: string; }) {
  return sendRpc('tx', params);
}

// ---- Limited-concurrency map ----
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---- Fetch all transactions for a block ----
export async function getBlockTransactions(block: any) {
  const limit = cfg().POLL_CHUNK_CONCURRENCY;
  const chunkHashes = (block.chunks || []).map((c: any) => c.chunk_hash);
  const chunks = await mapWithLimit(chunkHashes, limit, async (h: string) => getChunk({ chunk_id: h }));
  const txs: any[] = [];
  for (const ch of chunks) {
    const arr = ch?.result?.transactions;
    if (Array.isArray(arr) && arr.length) txs.push(...arr);
  }
  return txs;
}

// ---- Non-overlapping poller with adaptive catch-up ----
export class BlockPoller {
  private running = false;
  private stopped = true;
  private lastHeight = 0;
  private intervalMs = cfg().POLL_INTERVAL_MS;

  start(onNewBlock: (block: any) => void, intervalMs?: number) {
    this.intervalMs = intervalMs ?? cfg().POLL_INTERVAL_MS;
    this.stopped = false;
    this.loop(onNewBlock);
  }

  stop() { this.stopped = true; }
  getCurrentHeight() { return this.lastHeight; }

  private async loop(onNewBlock: (block: any) => void) {
    if (this.stopped) return;
    if (this.running) {
      setTimeout(() => this.loop(onNewBlock), Math.max(50, Math.floor(this.intervalMs / 4)));
      return;
    }

    this.running = true;
    try {
      const latest = await getBlock({ finality: 'final' });
      const latestBlock = latest.result;
      const latestHeight = latestBlock.header.height;

      const maxCatchup = cfg().POLL_MAX_CATCHUP;
      if (this.lastHeight === 0) this.lastHeight = latestHeight;

      if (latestHeight > this.lastHeight) {
        const start = this.lastHeight + 1;
        const end = Math.min(latestHeight, start + maxCatchup - 1);

        // Track successfully processed blocks to avoid gaps on failure
        let lastSuccessfulHeight = this.lastHeight;

        for (let h = start; h <= end; h++) {
          try {
            const br = await getBlock({ block_id: h });
            const block = br.result;
            const transactions = await getBlockTransactions(block);
            onNewBlock({ ...block, transactions });
            lastSuccessfulHeight = h;
          } catch (e) {
            // Stop processing on first failure to avoid gaps in block sequence
            // The failed block will be retried on the next polling cycle
            debugError('BlockPoller', `Failed to fetch/process block ${h}, stopping batch`, e);
            break;
          }
        }

        // Update lastHeight only with the last successfully processed block
        this.lastHeight = lastSuccessfulHeight;
      }
    } catch (e) {
      // Circuit breaker/open state is handled in sendRpc
      debugError('BlockPoller', 'Failed to fetch latest block', e);
    } finally {
      this.running = false;
      if (!this.stopped) setTimeout(() => this.loop(onNewBlock), this.intervalMs);
    }
  }
}

// Keep queryAccount and viewContract from original
export async function queryAccount(accountId: string, blockId?: string) {
  const params: any = {
    request_type: 'view_account',
    account_id: accountId,
  };

  if (blockId) {
    params.block_id = blockId;
  } else {
    params.finality = 'final';
  }

  return sendRpc('query', params);
}

export async function viewContract(params: {
  contractId: string;
  methodName: string;
  args?: any;
  blockId?: string;
}) {
  const argsBase64 = params.args
    ? Buffer.from(JSON.stringify(params.args)).toString('base64')
    : '';

  const queryParams: any = {
    request_type: 'call_function',
    account_id: params.contractId,
    method_name: params.methodName,
    args_base64: argsBase64,
  };

  if (params.blockId) {
    queryParams.block_id = params.blockId;
  } else {
    queryParams.finality = 'final';
  }

  return sendRpc('query', queryParams);
}