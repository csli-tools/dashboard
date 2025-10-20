// + settings kv store (SQLite) alongside blocks/txs/marks.
// Runs off UI thread; uses better-sqlite3.

import { parentPort } from 'node:worker_threads';
import Database from 'better-sqlite3';

type PutBlockMsg = {
  type: 'putBlock';
  block: {
    height: number;
    hash: string;
    ts_ms: number;
    txs: Array<{ hash: string; signer?: string; receiver?: string; actions?: any[]; raw?: any }>;
  };
};
type InitMsg = { type: 'init'; dbPath: string };
type SearchMsg = { type: 'search'; query: string; limit?: number; order?: 'asc'|'desc' };
type GetTxMsg = { type: 'getTx'; hash: string };

type ListMarks = { type: 'listMarks' };
type PutMark = { type: 'putMark'; mark: { label: string; pane: number; height?: number; tx?: string; when_ms?: number; pinned?: boolean } };
type DelMark = { type: 'delMark'; label: string };
type ClearMarks = { type: 'clearMarks' };
type SetMarkPinned = { type: 'setMarkPinned'; label: string; pinned: boolean };

// settings
type GetSetting = { type: 'getSetting'; key: string };
type SetSetting = { type: 'setSetting'; key: string; value: any };
type GetSettings = { type: 'getSettings' };

type Msg =
  | InitMsg | PutBlockMsg | SearchMsg | GetTxMsg
  | ListMarks | PutMark | DelMark | ClearMarks | SetMarkPinned
  | GetSetting | SetSetting | GetSettings;

if (!parentPort) process.exit(1);

let db: Database.Database | null = null;
let hasFTS = false;

let stmtBlock: Database.Statement | null = null;
let stmtTx: Database.Statement | null = null;
let stmtFTSInsert: Database.Statement | null = null;

// marks
let stmtMarkUpsert: Database.Statement | null = null;
let stmtMarkDelete: Database.Statement | null = null;
let stmtMarkList: Database.Statement | null = null;
let stmtMarkClear: Database.Statement | null = null;
let stmtMarkSetPinned: Database.Statement | null = null;

// settings
let stmtSet: Database.Statement | null = null;
let stmtGet: Database.Statement | null = null;
let stmtList: Database.Statement | null = null;

parentPort.on('message', (m: Msg) => {
  try {
    if (m.type === 'init') {
      db = new Database(m.dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec(`
        CREATE TABLE IF NOT EXISTS blocks(
          height INTEGER PRIMARY KEY,
          hash   TEXT NOT NULL,
          ts_ms  INTEGER NOT NULL,
          tx_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS txs(
          hash     TEXT PRIMARY KEY,
          height   INTEGER NOT NULL,
          signer   TEXT,
          receiver TEXT,
          actions_json TEXT,
          raw_json TEXT,
          FOREIGN KEY(height) REFERENCES blocks(height) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_txs_signer   ON txs(signer);
        CREATE INDEX IF NOT EXISTS idx_txs_receiver ON txs(receiver);
        CREATE INDEX IF NOT EXISTS idx_txs_height   ON txs(height);

        CREATE TABLE IF NOT EXISTS marks(
          label    TEXT PRIMARY KEY,
          pane     INTEGER NOT NULL,
          height   INTEGER,
          tx       TEXT,
          when_ms  INTEGER NOT NULL,
          pinned   INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings(
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL
        );
      `);
      try {
        db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS txs_fts USING fts5(hash, signer, receiver, methods, raw);`);
        hasFTS = true;
      } catch { hasFTS = false; }

      stmtBlock = db.prepare(`INSERT OR REPLACE INTO blocks(height,hash,ts_ms,tx_count) VALUES (?,?,?,?)`);
      stmtTx = db.prepare(`INSERT OR REPLACE INTO txs(hash,height,signer,receiver,actions_json,raw_json) VALUES (?,?,?,?,?,?)`);
      if (hasFTS) stmtFTSInsert = db.prepare(`INSERT INTO txs_fts(hash, signer, receiver, methods, raw) VALUES (?,?,?,?,?)`);

      stmtMarkUpsert = db.prepare(`
        INSERT INTO marks(label,pane,height,tx,when_ms,pinned) VALUES (?,?,?,?,?,?)
        ON CONFLICT(label) DO UPDATE SET pane=excluded.pane,height=excluded.height,tx=excluded.tx,when_ms=excluded.when_ms,pinned=excluded.pinned
      `);
      stmtMarkDelete   = db.prepare(`DELETE FROM marks WHERE label=?`);
      stmtMarkList     = db.prepare(`SELECT label,pane,height,tx,when_ms,pinned FROM marks ORDER BY pinned DESC, when_ms DESC`);
      stmtMarkClear    = db.prepare(`DELETE FROM marks`);
      stmtMarkSetPinned= db.prepare(`UPDATE marks SET pinned=? WHERE label=?`);

      stmtSet = db.prepare(`INSERT INTO settings(key,value_json) VALUES(?,?)
                            ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`);
      stmtGet = db.prepare(`SELECT value_json FROM settings WHERE key=?`);
      stmtList= db.prepare(`SELECT key,value_json FROM settings`);

      parentPort!.postMessage({ ok: true, type: 'init', fts: hasFTS });
      return;
    }

    if (m.type === 'putBlock') {
      if (!db || !stmtBlock || !stmtTx) return;
      const trx = db.transaction((blk: typeof m.block) => {
        stmtBlock!.run(blk.height, blk.hash, blk.ts_ms, blk.txs.length);
        for (const t of blk.txs) {
          const actions_json = t.actions ? JSON.stringify(t.actions) : null;
          const raw_json = t.raw ? JSON.stringify(t.raw) : null;
          stmtTx!.run(t.hash, blk.height, t.signer || null, t.receiver || null, actions_json, raw_json);
          if (hasFTS && stmtFTSInsert) {
            const methods = summarizeMethods(actions_json);
            stmtFTSInsert.run(t.hash, (t.signer||''), (t.receiver||''), methods, raw_json ?? '');
          }
        }
      });
      trx(m.block);
      parentPort!.postMessage({ ok: true, type: 'putBlock', height: m.block.height });
      return;
    }

    if (m.type === 'search') {
      if (!db) return;
      const { sql, params } = buildSearchSQL(m.query, !!hasFTS, m.order ?? 'desc', m.limit ?? 200);
      const rows = db.prepare(sql).all(...params) as any[];
      for (const r of rows) {
        if (!r.methods && r.actions_json) r.methods = summarizeMethods(r.actions_json);
        delete (r as any).actions_json;
      }
      parentPort!.postMessage({ ok: true, type: 'search', rows });
      return;
    }

    if (m.type === 'getTx') {
      if (!db) return;
      const row = db.prepare(`SELECT raw_json FROM txs WHERE hash = ?`).get(m.hash) as any;
      let tx: any = null;
      if (row && row.raw_json) { try { tx = JSON.parse(row.raw_json); } catch {} }
      parentPort!.postMessage({ ok: true, type: 'getTx', tx });
      return;
    }

    // marks
    if (m.type === 'listMarks') {
      const rows = stmtMarkList!.all() as any[];
      parentPort!.postMessage({ ok: true, type: 'listMarks', rows });
      return;
    }
    if (m.type === 'putMark') {
      const mk = m.mark;
      const when = typeof mk.when_ms === 'number' ? mk.when_ms : Date.now();
      const pinned = mk.pinned ? 1 : 0;
      stmtMarkUpsert!.run(mk.label, mk.pane|0, mk.height ?? null, mk.tx ?? null, when, pinned);
      parentPort!.postMessage({ ok: true, type: 'putMark' });
      return;
    }
    if (m.type === 'delMark') {
      stmtMarkDelete!.run(m.label);
      parentPort!.postMessage({ ok: true, type: 'delMark' });
      return;
    }
    if (m.type === 'clearMarks') {
      stmtMarkClear!.run();
      parentPort!.postMessage({ ok: true, type: 'clearMarks' });
      return;
    }
    if (m.type === 'setMarkPinned') {
      stmtMarkSetPinned!.run(m.pinned ? 1 : 0, m.label);
      parentPort!.postMessage({ ok: true, type: 'setMarkPinned' });
      return;
    }

    // settings
    if (m.type === 'setSetting') {
      stmtSet!.run(m.key, JSON.stringify(m.value ?? null));
      parentPort!.postMessage({ ok: true, type: 'setSetting', key: m.key });
      return;
    }
    if (m.type === 'getSetting') {
      const row = stmtGet!.get(m.key) as any;
      let value: any = null;
      if (row?.value_json) { try { value = JSON.parse(row.value_json); } catch {} }
      parentPort!.postMessage({ ok: true, type: 'getSetting', key: m.key, value });
      return;
    }
    if (m.type === 'getSettings') {
      const rows = stmtList!.all() as Array<{key:string; value_json:string}>;
      const map: Record<string, any> = {};
      for (const r of rows) { try { map[r.key] = JSON.parse(r.value_json); } catch { map[r.key] = null; } }
      parentPort!.postMessage({ ok: true, type: 'getSettings', settings: map });
      return;
    }
  } catch (e: any) {
    parentPort!.postMessage({ ok: false, error: String(e?.stack || e) });
  }
});

function summarizeMethods(actions_json?: string | null): string {
  if (!actions_json) return '';
  try {
    const arr = JSON.parse(actions_json);
    const methods = new Set<string>();
    for (const a of arr || []) {
      if (a && a.FunctionCall && typeof a.FunctionCall.method_name === 'string') {
        methods.add(a.FunctionCall.method_name);
      } else if (a && typeof a === 'object') {
        const k = Object.keys(a)[0];
        if (k) methods.add(k);
      }
    }
    return Array.from(methods).join(' ');
  } catch { return ''; }
}

function buildSearchSQL(query: string, useFTS: boolean, order: 'asc'|'desc', limit: number) {
  const toks = (query || '').trim().split(/\s+/);
  const params: any[] = [];
  const where: string[] = [];

  let free: string[] = [];
  let ftsQ: string[] = [];
  let signer: string[] = [];
  let receiver: string[] = [];
  let acct: string[] = [];
  let method: string[] = [];
  let action: string[] = [];
  let hash: string[] = [];
  let fromH: number | undefined;
  let toH: number | undefined;

  for (const t of toks) {
    const m = t.match(/^([a-z]+):(.*)$/i);
    if (m) {
      const [, k, vRaw] = m;
      const v = vRaw.replace(/^"|"$/g, '');
      switch (k.toLowerCase()) {
        case 'signer': signer.push(v); break;
        case 'receiver': case 'rcv': receiver.push(v); break;
        case 'acct': case 'account': acct.push(v); break;
        case 'method': method.push(v); break;
        case 'action': action.push(v); break;
        case 'hash': hash.push(v); break;
        case 'from': { const n = Number(v); if (Number.isFinite(n)) fromH = Math.trunc(n); break; }
        case 'to': { const n = Number(v); if (Number.isFinite(n)) toH = Math.trunc(n); break; }
        case 'q': ftsQ.push(v); break;
        default: free.push(t);
      }
    } else if (t) {
      free.push(t);
    }
  }

  let select = `SELECT t.hash, t.height, b.ts_ms, t.signer, t.receiver, t.actions_json`;
  let from = ` FROM txs t JOIN blocks b ON b.height = t.height `;
  if (useFTS && ftsQ.length) {
    from += ` JOIN txs_fts f ON f.hash = t.hash `;
  }

  const addLike = (col: string, vals: string[]) => {
    if (!vals.length) return;
    where.push(`(${vals.map(() => `${col} LIKE ?`).join(' OR ')})`);
    for (const v of vals) params.push(`%${v.toLowerCase()}%`);
  };
  const addEq = (col: string, vals: string[]) => {
    if (!vals.length) return;
    where.push(`(${vals.map(() => `${col} = ?`).join(' OR ')})`);
    for (const v of vals) params.push(v.toLowerCase());
  };

  if (acct.length) {
    where.push(`((LOWER(t.signer) LIKE ?) OR (LOWER(t.receiver) LIKE ?))`);
    for (const v of acct) { params.push(`%${v.toLowerCase()}%`, `%${v.toLowerCase()}%`); }
  }
  addLike(`LOWER(t.signer)`, signer);
  addLike(`LOWER(t.receiver)`, receiver);
  addEq(`LOWER(t.hash)`, hash);

  if (fromH !== undefined) { where.push(`t.height >= ?`); params.push(fromH); }
  if (toH !== undefined) { where.push(`t.height <= ?`); params.push(toH); }

  if (useFTS) {
    if (method.length) {
      where.push(`(${method.map(() => `f.methods MATCH ?`).join(' AND ')})`);
      for (const v of method) params.push(ftsEsc(v));
    }
    if (action.length) {
      where.push(`(${action.map(() => `f.methods MATCH ?`).join(' AND ')})`);
      for (const v of action) params.push(ftsEsc(v));
    }
  } else {
    addLike(`LOWER(t.actions_json)`, method);
    addLike(`LOWER(t.actions_json)`, action);
  }

  if (free.length) {
    const cols = useFTS ? `LOWER(t.signer)||' '||LOWER(t.receiver)||' '||LOWER(t.hash)||' '||LOWER(f.methods)` :
      `LOWER(t.signer)||' '||LOWER(t.receiver)||' '||LOWER(t.hash)||' '||LOWER(t.actions_json)`;
    where.push(`(${free.map(() => `${cols} LIKE ?`).join(' AND ')})`);
    for (const v of free) params.push(`%${v.toLowerCase()}%`);
  }

  if (ftsQ.length) {
    if (useFTS) {
      where.push(`(${ftsQ.map(() => `f.raw MATCH ?`).join(' AND ')})`);
      for (const v of ftsQ) params.push(ftsEsc(v));
    } else {
      addLike(`LOWER(t.raw_json)`, ftsQ.map(x => x.toLowerCase()));
    }
  }

  const sql = [
    select,
    from,
    where.length ? ` WHERE ${where.join(' AND ')} ` : '',
    ` ORDER BY t.height ${order.toLowerCase()==='asc'?'ASC':'DESC'}, t.hash `,
    ` LIMIT ${Math.max(1, Math.min(5000, limit))} `
  ].join('');

  return { sql, params };
}

function ftsEsc(s: string) { return s.split(/\s+/).map(t => `"${t.replace(/"/g, '""')}"`).join(' AND '); }
