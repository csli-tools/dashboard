import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function startHistory(dbPath: string) {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      height INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      ts_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      hash TEXT PRIMARY KEY,
      block_height INTEGER NOT NULL,
      signer TEXT,
      receiver TEXT,
      actions TEXT,
      raw TEXT,
      FOREIGN KEY (block_height) REFERENCES blocks(height)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_signer ON transactions(signer);
    CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver);
    CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_height);

    CREATE TABLE IF NOT EXISTS marks (
      label TEXT PRIMARY KEY,
      pane INTEGER NOT NULL,
      block_height INTEGER,
      tx_hash TEXT,
      pinned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
}

export function persistBlock(block: {
  height: number;
  hash: string;
  ts_ms: number;
  txs: Array<{
    hash: string;
    signer?: string;
    receiver?: string;
    actions?: any[];
    raw: any;
  }>;
}) {
  if (!db) return;

  const insertBlock = db.prepare('INSERT OR REPLACE INTO blocks (height, hash, ts_ms) VALUES (?, ?, ?)');
  const insertTx = db.prepare('INSERT OR REPLACE INTO transactions (hash, block_height, signer, receiver, actions, raw) VALUES (?, ?, ?, ?, ?, ?)');

  const insertMany = db.transaction((block: any) => {
    insertBlock.run(block.height, block.hash, block.ts_ms);
    for (const tx of block.txs) {
      insertTx.run(
        tx.hash,
        block.height,
        tx.signer || null,
        tx.receiver || null,
        JSON.stringify(tx.actions || []),
        JSON.stringify(tx.raw)
      );
    }
  });

  insertMany(block);
}

export function searchHistory(
  query: string,
  limit: number = 100,
  order: 'asc' | 'desc' = 'desc'
): Array<{ hash: string; signer?: string; receiver?: string; block_height: number; ts_ms: number }> {
  if (!db) return [];

  const q = `%${query}%`;
  const stmt = db.prepare(`
    SELECT t.hash, t.signer, t.receiver, t.block_height, b.ts_ms
    FROM transactions t
    JOIN blocks b ON t.block_height = b.height
    WHERE t.hash LIKE ? OR t.signer LIKE ? OR t.receiver LIKE ?
    ORDER BY b.ts_ms ${order === 'desc' ? 'DESC' : 'ASC'}
    LIMIT ?
  `);

  return stmt.all(q, q, q, limit) as any[];
}

export function getTxByHash(hash: string): any | null {
  if (!db) return null;

  const stmt = db.prepare('SELECT raw FROM transactions WHERE hash = ?');
  const row = stmt.get(hash) as any;

  if (!row) return null;

  try {
    return JSON.parse(row.raw);
  } catch {
    return null;
  }
}

export function listMarks(): Array<{
  label: string;
  pane: number;
  block_height?: number;
  tx_hash?: string;
  pinned: boolean;
  created_at: number;
}> {
  if (!db) return [];

  const stmt = db.prepare('SELECT * FROM marks ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(r => ({
    label: r.label,
    pane: r.pane,
    block_height: r.block_height || undefined,
    tx_hash: r.tx_hash || undefined,
    pinned: r.pinned === 1,
    created_at: r.created_at
  }));
}

export function putMark(mark: {
  label: string;
  pane: number;
  block_height?: number;
  tx_hash?: string;
  pinned?: boolean;
}) {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO marks (label, pane, block_height, tx_hash, pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const existing = db.prepare('SELECT created_at FROM marks WHERE label = ?').get(mark.label) as any;
  const created_at = existing?.created_at || Date.now();

  stmt.run(
    mark.label,
    mark.pane,
    mark.block_height || null,
    mark.tx_hash || null,
    mark.pinned ? 1 : 0,
    created_at
  );
}

export function delMark(label: string) {
  if (!db) return;

  const stmt = db.prepare('DELETE FROM marks WHERE label = ?');
  stmt.run(label);
}

export function setMarkPinned(label: string, pinned: boolean) {
  if (!db) return;

  const stmt = db.prepare('UPDATE marks SET pinned = ? WHERE label = ?');
  stmt.run(pinned ? 1 : 0, label);
}
