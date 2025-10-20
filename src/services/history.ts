import { Worker } from 'node:worker_threads';

type BlockPersist = {
  height: number;
  hash: string;
  ts_ms: number;
  txs: Array<{ hash: string; signer?: string; receiver?: string; actions?: any[]; raw?: any }>;
};

let w: Worker | null = null;
let ready = false;

export function startHistory(dbPath: string): void {
  if (w) return;
  const workerPath = require.resolve('./history-worker.ts');
  w = new Worker(workerPath, { execArgv: ['-r', 'ts-node/register/transpile-only'] });
  w.on('message', (msg: any) => { if (msg?.type === 'init' && msg.ok) ready = true; });
  w.on('error', () => { ready = false; });
  w.on('exit', () => { ready = false; w = null; });
  w.postMessage({ type: 'init', dbPath });
}

export function persistBlock(block: BlockPersist): void {
  if (!w || !ready) return;
  w.postMessage({ type: 'putBlock', block });
}

export type HistoryHit = {
  hash: string;
  height: number;
  ts_ms: number;
  signer?: string;
  receiver?: string;
  methods?: string;
};

function once<T = any>(pred: (m:any)=>boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!w || !ready) return resolve(undefined as unknown as T);
    const onMsg = (msg: any) => { if (pred(msg)) { cleanup(); resolve(msg as T); } };
    const onErr = (err: any) => { cleanup(); reject(err); };
    const cleanup = () => { w?.off('message', onMsg); w?.off('error', onErr); };
    w.on('message', onMsg);
    w.on('error', onErr);
  });
}

export function searchHistory(query: string, limit = 200, order: 'asc'|'desc' = 'desc'): Promise<HistoryHit[]> {
  if (!w || !ready) return Promise.resolve([]);
  const p = once<any>(m => m?.type === 'search');
  w.postMessage({ type: 'search', query, limit, order });
  return p.then(m => m.rows as HistoryHit[]);
}

export function getTxByHash(hash: string): Promise<any | null> {
  if (!w || !ready) return Promise.resolve(null);
  const p = once<any>(m => m?.type === 'getTx');
  w.postMessage({ type: 'getTx', hash });
  return p.then(m => m.tx ?? null);
}

// marks
export type PersistedMark = { label: string; pane: number; height?: number; tx?: string; when_ms: number; pinned: number; created_at?: number };
export function listMarks(): Promise<PersistedMark[]> {
  if (!w || !ready) return Promise.resolve([]);
  const p = once<any>(m => m?.type === 'listMarks');
  w.postMessage({ type: 'listMarks' });
  return p.then(m => (m.rows as PersistedMark[]) || []);
}
export function putMark(mark: { label: string; pane: number; height?: number; tx?: string; when_ms?: number; pinned?: boolean }): Promise<void> {
  if (!w || !ready) return Promise.resolve();
  const p = once<any>(m => m?.type === 'putMark');
  w.postMessage({ type: 'putMark', mark });
  return p.then(() => {});
}
export function delMark(label: string): Promise<void> {
  if (!w || !ready) return Promise.resolve();
  const p = once<any>(m => m?.type === 'delMark');
  w.postMessage({ type: 'delMark', label });
  return p.then(() => {});
}
export function setMarkPinned(label: string, pinned: boolean): Promise<void> {
  if (!w || !ready) return Promise.resolve();
  const p = once<any>(m => m?.type === 'setMarkPinned');
  w.postMessage({ type: 'setMarkPinned', label, pinned });
  return p.then(() => {});
}

// settings
export async function getSetting<T=any>(key: string, fallback?: T): Promise<T|undefined> {
  if (!w || !ready) return fallback;
  const p = once<any>(m => m?.type === 'getSetting' && m.key === key);
  w.postMessage({ type: 'getSetting', key });
  const res = await p;
  return (res?.value ?? fallback) as T;
}
export function setSetting(key: string, value: any): Promise<void> {
  if (!w || !ready) return Promise.resolve();
  const p = once<any>(m => m?.type === 'setSetting' && m.key === key);
  w.postMessage({ type: 'setSetting', key, value });
  return p.then(() => {});
}
