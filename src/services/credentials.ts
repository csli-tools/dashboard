import { watch } from 'chokidar';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { debugError } from '../utils/debug-logger';

let ownedAccounts = new Set<string>();
const listeners: Array<(ids: Set<string>) => void> = [];
let watcher: any = null;

export function startCredentials(dir: string, network: string) {
  if (watcher) return;

  const targetDir = join(dir, network);

  // Initial scan
  scanCredentials(targetDir);

  // Watch for changes
  if (existsSync(targetDir)) {
    watcher = watch(targetDir, {
      persistent: true,
      ignoreInitial: false,
      depth: 0,
    });

    watcher.on('add', () => scanCredentials(targetDir));
    watcher.on('change', () => scanCredentials(targetDir));
    watcher.on('unlink', () => scanCredentials(targetDir));
  }
}

function scanCredentials(targetDir: string) {
  ownedAccounts.clear();

  if (!existsSync(targetDir)) {
    notifyListeners();
    return;
  }

  try {
    const files = readdirSync(targetDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const path = join(targetDir, file);
        const content = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.account_id && typeof parsed.account_id === 'string') {
          ownedAccounts.add(parsed.account_id);
        }
      } catch (e) {
        debugError('credentials', `Failed to parse credential file: ${file}`, e);
      }
    }
  } catch (e) {
    debugError('credentials', `Failed to scan credentials directory: ${targetDir}`, e);
  }

  notifyListeners();
}

function notifyListeners() {
  listeners.forEach(cb => cb(ownedAccounts));
}

export function onOwnedAccounts(cb: (ids: Set<string>) => void): () => void {
  listeners.push(cb);
  // Immediately call with current snapshot
  cb(ownedAccounts);
  // Return unsubscribe function
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function rescanCredentials(dir: string, network: string) {
  const targetDir = join(dir, network);
  scanCredentials(targetDir);
}

export function getSnapshot(): Set<string> {
  return new Set(ownedAccounts);
}
