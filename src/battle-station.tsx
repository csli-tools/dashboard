import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react'
import { Server } from 'ws'
import * as os from 'node:os'
import * as path from 'node:path'

import BlockDetailsPane from './panes/blocks/block-details'
import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import { FilterBar } from './panes/filter/FilterBar'
import { HistorySearch } from './panes/history/HistorySearch'
import { JumpList } from './panes/jumps/JumpList'
import { SlashModal } from './ui/SlashModal'

import { StatusBar } from './ui/StatusBar'
import { Toasts, Toast } from './ui/Toast'
import { HelpOverlay } from './ui/HelpOverlay'
import { CommandPalette, PaletteAction } from './ui/CommandPalette'

import WSCSLIPayload from './utils/websockets'
import Keybind from './services/Keybind'
import BlockDetails from './model/BlockDetails'
import { BlockPoller } from './services/near-rpc'
import { getActionDescription, getActionType, decodeTransactionArgs } from './model/NEARTypes'
import { decorateFunctionCallArgs } from './model/near-args-decoder'
import { compileFilter, txMatchesFilter } from './services/filters'
import { startHistory, persistBlock, searchHistory, getTxByHash, listMarks, putMark, delMark, setMarkPinned, getSetting, setSetting } from './services/history'
import { JumpMarks, Mark as JMark } from './services/jump-marks'
import { startCredentials, onOwnedAccounts, getSnapshot as getOwnedSnapshot } from './services/credentials'
import { cfg } from './shared/config'
import { ansiJson } from './utils/pretty'
import { autoParseNestedJson } from './utils/json-auto-parse'

const JSON_FORMATTER = cfg().JSON_FORMATTER;
const { formatJson: formatJsonWorker } = require('./utils/json-formatter-worker');
const { formatJsonWasm } = require('./utils/json-formatter-wasm');
const formatJson: (v: any, s?: number) => Promise<string> =
  JSON_FORMATTER === 'wasm' ? formatJsonWasm : formatJsonWorker;

interface DashboardProps { screen: any; wss: Server }
const WS_HWM_BYTES = cfg().WS_HIGH_WATER_MARK;

let clipboardy: any = null; try { clipboardy = require('clipboardy').default; } catch {}

export const Dashboard: React.FC<DashboardProps> = ({screen, wss }) => {
  const [focusedPane, setFocusedPane] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined);
  const [selectedTxHash, setSelectedTxHash] = useState<string | undefined>(undefined);
  const [selectedTxIndex, setSelectedTxIndex] = useState<number>(0);
  const [blockHeights, setBlockHeights] = useState<BlockDetails[]>([]);
  const [txData, setTxData] = useState<string>('(No transaction selected)');
  const [rawTxData, setRawTxData] = useState<string>('');

  const [filterFocused, setFilterFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [jumpsOpen, setJumpsOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);

  const [filterQuery, setFilterQuery] = useState('');
  const compiled = useMemo(() => compileFilter(filterQuery), [filterQuery]);

  const txHashes = useMemo(() => {
    const txs = selectedBlock?.transactions || [];
    const filtered = txs.filter(tx => txMatchesFilter(tx, compiled));
    return filtered.map(t => t.hash);
  }, [selectedBlock, compiled]);

  const [followLatest, setFollowLatest] = useState(true);

  const toastId = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((text: string, level: Toast['level']='info') => {
    const id = toastId.current++;
    const createdAt = Date.now();
    setToasts(t => [...t, { id, text, level, createdAt }]);
    setTimeout(() => { setToasts(t => t.filter(x => x.id !== id)); }, 2300);
  }, []);

  const lastTxWSRef = useRef<WSCSLIPayload>({ type: 'tx', data: null });
  const pollerRef = useRef<BlockPoller | null>(null);
  const txRenderSeqRef = useRef(0);

  const jmRef = useRef(new JumpMarks());
  const [marks, setMarks] = useState<JMark[]>([]);
  const pendingJumpKeyRef = useRef(false);

  const [ownedAccounts, setOwnedAccounts] = useState<Set<string>>(new Set());
  const [ownedCounts, setOwnedCounts] = useState<Map<number, number>>(new Map());

  const [autoPinSlash, setAutoPinSlash] = useState<boolean>(false);
  const [debugVisible, setDebugVisible] = useState<boolean>(process.env.CSLI_DEBUG === '1');
  const [connectionEstablished, setConnectionEstablished] = useState(false);

  const network = cfg().NEAR_NETWORK;

  useEffect(() => {
    const dbPath = process.env.SQLITE_DB_PATH || './csli_history.db';
    startHistory(dbPath);
  }, []);

  // Connection grace period: wait 3 seconds before showing "no connection" indicators
  useEffect(() => {
    const timer = setTimeout(() => setConnectionEstablished(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const v = await getSetting<boolean>('autopin_slash_tx', false);
      setAutoPinSlash(!!v);
    })();
  }, []);

  useEffect(() => { setSetting('autopin_slash_tx', !!autoPinSlash); }, [autoPinSlash]);

  useEffect(() => {
    const dir = process.env.NEAR_CREDENTIALS_DIR || path.join(os.homedir(), '.near-credentials');
    startCredentials(dir, network);
    const off = onOwnedAccounts((ids) => { setOwnedAccounts(new Set(ids)); });
    return off;
  }, [network]);

  const recomputeOwnedCounts = useCallback((blocks: BlockDetails[], owned: Set<string>) => {
    const m = new Map<number, number>();
    const toL = (s?: string) => (s || '').toLowerCase();
    for (const b of blocks) {
      let c = 0;
      for (const tx of (b.transactions || [])) {
        const signer = toL((tx as any).signer_id);
        const recv = toL((tx as any).receiver_id);
        if (owned.has(signer) || owned.has(recv)) c++;
      }
      m.set(b.height, c);
    }
    return m;
  }, []);

  useEffect(() => {
    setOwnedCounts(recomputeOwnedCounts(blockHeights, ownedAccounts));
  }, [ownedAccounts, blockHeights, recomputeOwnedCounts]);

  useEffect(() => {
    jmRef.current.attachPersistence({
      list: async () => listMarks(),
      put: async (m) => { await putMark(m); },
      del: async (label) => { await delMark(label); },
      setPinned: async (label, pinned) => { await setMarkPinned(label, pinned); }
    });
    (async () => {
      await jmRef.current.loadFromPersistence();
      setMarks(jmRef.current.list());
    })();
  }, []);

  const broadcast = useCallback((payload: WSCSLIPayload) => {
    const serialized = JSON.stringify(payload)
    wss.clients.forEach(function each(client: any) {
      if (client.readyState !== 1) return
      const buffered = (client as any).bufferedAmount ?? 0
      if (buffered > WS_HWM_BYTES) {
        if (payload.type !== 'block' && payload.type !== 'tx') return
      }
      client.send(serialized)
    });
  }, [wss])

  const onNewBlock = useCallback((nearBlock: any) => {
    // Mark connection as established when first block arrives
    setConnectionEstablished(true);

    try {
      const blockDetails: BlockDetails = {
        height: nearBlock.header.height,
        hash: nearBlock.header.hash,
        timestamp: Number(BigInt(nearBlock.header.timestamp_nanosec) / BigInt(1000000)),
        timestamp_nanosec: nearBlock.header.timestamp_nanosec,
        prev_hash: nearBlock.header.prev_hash,
        epoch_id: nearBlock.header.epoch_id,
        gas_price: nearBlock.header.gas_price,
        total_supply: nearBlock.header.total_supply,
        chunks_included: nearBlock.header.chunks_included,
        transactions: (nearBlock.transactions || []).map((tx: any) => ({
          ...tx,
          actions: (tx.actions || []).map((a: any) => a.FunctionCall ? decorateFunctionCallArgs(a) : a)
        })),
        chunks: nearBlock.chunks.map((chunk: any) => ({
          chunk_hash: chunk.chunk_hash,
          shard_id: chunk.shard_id,
          gas_used: chunk.gas_used,
          gas_limit: chunk.gas_limit,
        }))
      };

      try {
        persistBlock({
          height: blockDetails.height,
          hash: blockDetails.hash,
          ts_ms: blockDetails.timestamp,
          txs: (blockDetails.transactions || []).map((t: any) => ({
            hash: t.hash, signer: t.signer_id, receiver: t.receiver_id, actions: t.actions, raw: t
          }))
        });
      } catch {}

      broadcast({ type: 'block', data: blockDetails.height })

      setBlockHeights(prev => {
        const next = [blockDetails, ...prev].slice(0, 100);
        // owned badge
        setOwnedCounts(m => {
          const mm = new Map(m);
          let c = 0;
          const snapshot = ownedAccounts.size ? ownedAccounts : getOwnedSnapshot();
          const toL = (s?: string) => (s || '').toLowerCase();
          for (const tx of (blockDetails.transactions || [])) {
            const signer = toL((tx as any).signer_id);
            const recv = toL((tx as any).receiver_id);
            if (snapshot.has(signer) || snapshot.has(recv)) c++;
          }
          mm.set(blockDetails.height, c);
          if (next.length < prev.length) {
            const keep = new Set(next.map(b => b.height));
            for (const k of mm.keys()) if (!keep.has(k)) mm.delete(k);
          }
          return mm;
        });

        if (followLatest) setSelectedBlock(next[0]);
        return next;
      });
    } catch {}
  }, [broadcast, followLatest, ownedAccounts])

  // Helper function to shorten long strings (public keys, signatures, etc)
  const shortMiddle = (s: string | undefined, keepEachSide: number): string | undefined => {
    if (!s || typeof s !== 'string') return s;
    if (s.length <= keepEachSide * 2 + 3) return s;
    return `${s.slice(0, keepEachSide)}…${s.slice(-keepEachSide)}`;
  }

  // Recursively clean args_base64 from actions (including nested delegate_action)
  const cleanAction = (action: any, showBase64: boolean): any => {
    if (action.FunctionCall) {
      const fc: any = {
        method_name: action.FunctionCall.method_name,
        args: action.FunctionCall.args,
        gas: action.FunctionCall.gas,
        deposit: action.FunctionCall.deposit,
      };
      if (showBase64 && action.FunctionCall.args_base64) {
        fc.args_base64 = action.FunctionCall.args_base64;
      }
      // Preserve args_bytes for binary data (always include for clipboard)
      if (action.FunctionCall.args_bytes) {
        fc.args_bytes = action.FunctionCall.args_bytes;
      }
      return { FunctionCall: fc };
    }

    if (action.Delegate) {
      const delegate = { ...action.Delegate };
      if (delegate.delegate_action?.actions) {
        delegate.delegate_action.actions = delegate.delegate_action.actions.map((a: any) => cleanAction(a, showBase64));
      }
      return { Delegate: delegate };
    }

    // Return clean copy for other action types
    return JSON.parse(JSON.stringify(action));
  };

  // Normalize one tx for display: decode args, optionally drop args_base64, compact huge fields
  const prepareTxForDisplay = (tx: any) => {
    const decoded = tx; // Transaction already decorated by decorateFunctionCallArgs
    const showBase64 = cfg().SHOW_ARGS_BASE64;
    const autoParse = cfg().AUTO_PARSE_JSON_STRINGS;

    // Deep clone and clean up actions - conditionally remove args_base64 (recursively)
    let prettyActions = decoded.actions.map((action: any) => cleanAction(action, showBase64));

    // Auto-parse JSON-serialized strings if enabled
    if (autoParse) {
      prettyActions = autoParseNestedJson(prettyActions);
    }

    // Apply middle-truncation to binary args (args_bytes present)
    prettyActions = prettyActions.map((action: any) => {
      if (action.FunctionCall?.args_bytes) {
        const base64 = action.FunctionCall.args_bytes;
        const keepEachSide = 40;
        let truncatedArgs: string;
        if (base64.length <= keepEachSide * 2 + 3) {
          truncatedArgs = base64;
        } else {
          truncatedArgs = `${base64.slice(0, keepEachSide)}...${base64.slice(-keepEachSide)}`;
        }
        return {
          FunctionCall: {
            ...action.FunctionCall,
            args: `${truncatedArgs} [binary]`
          }
        };
      }
      return action;
    });

    // Compact, human-readable transaction summary
    const pruned = {
      hash: decoded.hash,
      signer: decoded.signer_id,
      receiver: decoded.receiver_id,
      nonce: decoded.nonce,
      public_key: shortMiddle(decoded.public_key, 20),
      signature: shortMiddle(decoded.signature, 20),
      actions: prettyActions,
    };

    return pruned;
  }

  // Full transaction data for clipboard (no truncation)
  const prepareTxForCopy = (tx: any) => {
    const decoded = tx; // Transaction already decorated by decorateFunctionCallArgs
    const showBase64 = cfg().SHOW_ARGS_BASE64;
    const autoParse = cfg().AUTO_PARSE_JSON_STRINGS;

    // Deep clone and clean up actions - conditionally remove args_base64 (recursively)
    let prettyActions = decoded.actions.map((action: any) => cleanAction(action, showBase64));

    // Auto-parse JSON-serialized strings if enabled
    if (autoParse) {
      prettyActions = autoParseNestedJson(prettyActions);
    }

    // For binary args, include full base64 (not truncated)
    prettyActions = prettyActions.map((action: any) => {
      if (action.FunctionCall?.args_bytes) {
        return {
          FunctionCall: {
            ...action.FunctionCall,
            args: action.FunctionCall.args_bytes  // Full base64 for clipboard
          }
        };
      }
      return action;
    });

    // Full transaction data with no truncation
    const full = {
      hash: decoded.hash,
      signer: decoded.signer_id,
      receiver: decoded.receiver_id,
      nonce: decoded.nonce,
      public_key: decoded.public_key,      // Full, not truncated
      signature: decoded.signature,        // Full, not truncated
      actions: prettyActions,
    };

    return full;
  }

  const displayTransaction = useCallback(async (tx: any) => {
    const seq = ++txRenderSeqRef.current

    // Prepare two versions: truncated for display, full for clipboard
    const txSummaryDisplay = prepareTxForDisplay(tx);
    const txSummaryCopy = prepareTxForCopy(tx);

    setImmediate(() => {
      const pretty = ansiJson(txSummaryDisplay);  // Display uses truncated version
      const raw = JSON.stringify(txSummaryCopy, null, 2);  // Clipboard uses full version
      if (seq === txRenderSeqRef.current) {
        setTxData(pretty);
        setRawTxData(raw);
      }
    });

    // Fire off websocket message to breakout panes (send compact summary to avoid huge payloads)
    try {
      const identifier = tx?.hash || '';
      const payload: WSCSLIPayload = {
        type: 'tx',
        identifier,
        data: {
          hash: identifier,
          signer: tx?.signer_id,
          receiver: tx?.receiver_id,
          actions: (tx?.actions || []).map((a: any) =>
            a.FunctionCall ? { type: 'FunctionCall', method: a.FunctionCall.method_name } :
            { type: getActionType(a) }
          )
        }
      }
      if (lastTxWSRef.current.identifier !== payload.identifier) {
        broadcast(payload)
        lastTxWSRef.current = { ...payload }
      }
    } catch { /* no-op */ }
  }, [broadcast])

  const openTxFromHash = useCallback(async (hash: string) => {
    const txLocal = selectedBlock?.transactions?.find((t: any) => t.hash === hash);
    const tx = txLocal ?? await getTxByHash(hash);
    if (!tx) { pushToast('Tx not found', 'warn'); return; }
    const txDecorated = {
      ...tx,
      actions: (tx.actions || []).map((a: any) => a.FunctionCall ? decorateFunctionCallArgs(a) : a)
    };
    await displayTransaction(txDecorated);
    setSelectedTxHash(hash);
  }, [selectedBlock, displayTransaction, pushToast]);

  const selectBlock = useCallback((block: BlockDetails) => {
    setSelectedBlock(block)
    setFollowLatest(false)
  }, [])

  const selectTxHash = useCallback(async (txHash: string, index: number) => {
    setSelectedTxHash(txHash)
    setSelectedTxIndex(index)
    const blockInfo = selectedBlock
    if (!blockInfo) return
    const tx = (blockInfo.transactions || []).filter((t: any) => txMatchesFilter(t, compiled)).find((t: any) => t.hash === selectedTxHash)
    if (tx) await displayTransaction(tx)
  }, [selectedBlock, compiled, selectedTxHash, displayTransaction])

  useEffect(() => {
    if (!selectedBlock || !selectedTxHash) return
    const tx = (selectedBlock.transactions || []).filter((t: any) => txMatchesFilter(t, compiled)).find((t: any) => t.hash === selectedTxHash)
    if (tx) displayTransaction(tx)
  }, [compiled, selectedBlock, selectedTxHash, displayTransaction])

  const checkForTransactionsInBlock = useCallback(async (blockInfo?: BlockDetails) => {
    if (!blockInfo) return
    const txs = blockInfo.transactions || [];
    const filtered = txs.filter(tx => txMatchesFilter(tx, compiled))
    if (filtered.length === 0) {
      setTxData('(No transactions match current filter)');
      setSelectedTxHash(undefined);
      setSelectedTxIndex(0);
      return;
    }
    const firstTx = filtered[0]
    setSelectedTxHash(firstTx.hash)
    setSelectedTxIndex(0)
    await displayTransaction(firstTx)
  }, [compiled, displayTransaction])

  useEffect(() => {
    pollerRef.current = new BlockPoller();
    pollerRef.current.start(onNewBlock, 1000);
    return () => { pollerRef.current?.stop(); }
  }, [onNewBlock]);

  async function setAutoMark() {
    const pane = (focusedPane as 0|1|2);
    const height = selectedBlock?.height;
    const hash = selectedTxHash;
    const label = jmRef.current.nextAutoLabel();
    await jmRef.current.addOrReplace(label, pane, height, hash);
    setMarks(jmRef.current.list());
    pushToast(`Set mark '${label}'`);
  }

  async function jumpTo(label: string) {
    const m = jmRef.current.getByLabel(label);
    if (!m) { pushToast(`No mark '${label}'`, 'warn'); return; }
    if (m.blockHeight) {
      const blk = blockHeights.find(b => b.height === m.blockHeight);
      if (blk) setSelectedBlock(blk);
    }
    if (m.txHash) {
      await openTxFromHash(m.txHash);
      setFocusedPane(2);
    } else if (m.blockHeight) {
      setFocusedPane(0);
    } else {
      setFocusedPane(m.pane);
    }
    pushToast(`Jumped '${label}'`);
  }

  async function jumpNext() { const m = jmRef.current.next(); if (!m) { pushToast('No marks','warn'); return; } await jumpTo(m.label); }
  async function jumpPrev() { const m = jmRef.current.prev(); if (!m) { pushToast('No marks','warn'); return; } await jumpTo(m.label); }

  // --- Slash modal logic ---
  function looksLikeTxHash(s: string){ return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(s); }
  function looksLikeAccount(s: string){ return /\./.test(s) && !/^ed25519:/.test(s); }
  async function handleSlashSubmit(text: string) {
    const t = text.trim();
    if (!t) { setSlashOpen(false); return; }
    const m = t.match(/^(?:b|block)\s+(\d{1,12})$/i);
    if (m) {
      const h = Number(m[1]);
      const blk = blockHeights.find(b => b.height === h);
      if (blk) { selectBlock(blk); setFocusedPane(0); pushToast(`Jumped to block #${h}`); }
      else pushToast(`Block #${h} not in buffer`, 'warn');
      setSlashOpen(false);
      return;
    }
    if (looksLikeAccount(t)) {
      setFilterQuery(`acct:${t}`);
      setFilterFocused(false);
      await checkForTransactionsInBlock(selectedBlock);
      setSlashOpen(false);
      pushToast(`Filter acct:${t}`);
      return;
    }
    if (looksLikeTxHash(t)) {
      await openTxFromHash(t);
      setFocusedPane(2);
      if (autoPinSlash) {
        const label = jmRef.current.nextAutoLabel();
        await jmRef.current.addOrReplace(label, 2, selectedBlock?.height, t);
        await jmRef.current.setPinned(label, true);
        setMarks(jmRef.current.list());
        pushToast(`Pinned ★ '${label}'`);
      } else {
        pushToast('Opened tx');
      }
      setSlashOpen(false);
      return;
    }
    pushToast('Unrecognized input', 'warn');
  }

  useEffect(() => {
    const handler = async (key: any) => {
      if (pendingJumpKeyRef.current) {
        pendingJumpKeyRef.current = false;
        const label = (key.sequence && key.sequence.length===1) ? key.sequence : (key.name?.length===1 ? key.name : '');
        if (label) await jumpTo(label);
        return;
      }

      if (key.name === 'tab' || key.full === 'S-tab') {
        if (key.shift || key.name === 'S-tab' || key.full === 'S-tab') {
          setFocusedPane(p => (p - 1 + 3) % 3);  // Shift+Tab: backwards
        } else {
          setFocusedPane(p => (p + 1) % 3);       // Tab: forward
        }
      }
      if (key.full === 'C-f') setHistoryOpen(true);
      if (key.full === 'C-k') setPaletteOpen(true);
      if (key.name === '?') setHelpOpen(true);
      if (key.name === 'f') setFilterFocused(true);         // keep 'f' for filter
      if (key.name === '/') setSlashOpen(true);             // '/' opens docs-style modal
      if (key.name === 'escape') { setFilterQuery(''); setFilterFocused(false); setHelpOpen(false); setPaletteOpen(false); setJumpsOpen(false); setSlashOpen(false); }
      if (key.name === 'c') {
        try {
          if (focusedPane === 0) {
            // Blocks pane - copy all transactions for the selected block
            if (!selectedBlock) {
              pushToast('No block selected', 'warn');
            } else {
              const filtered = (selectedBlock.transactions || []).filter(tx => txMatchesFilter(tx, compiled));
              const blockCopy = {
                network: network,
                block_height: selectedBlock.height,
                block_hash: selectedBlock.hash,
                timestamp: selectedBlock.timestamp ? new Date(selectedBlock.timestamp).toISOString() : undefined,
                tx_count: filtered.length,
                txs: filtered.map((tx: any) => prepareTxForCopy(tx))
              };
              await clipboardy?.write?.(JSON.stringify(blockCopy, null, 2));
              pushToast(`Copied ${filtered.length} tx${filtered.length !== 1 ? 's' : ''} from block`);
            }
          } else if (focusedPane === 1) {
            // Transactions pane - copy selected transaction (raw + human)
            if (!selectedBlock || !selectedTxHash) {
              pushToast('No transaction selected', 'warn');
            } else {
              const filtered = (selectedBlock.transactions || []).filter(tx => txMatchesFilter(tx, compiled));
              const rawTx = filtered.find((t: any) => t.hash === selectedTxHash);
              if (!rawTx) {
                pushToast('Transaction not found', 'warn');
              } else {
                const txCopy = {
                  network: network,
                  block_height: selectedBlock.height,
                  block_timestamp: selectedBlock.timestamp ? new Date(selectedBlock.timestamp).toISOString() : undefined,
                  tx_hash: selectedTxHash,
                  chain: rawTx,
                  human: prepareTxForCopy(rawTx)
                };
                await clipboardy?.write?.(JSON.stringify(txCopy, null, 2));
                pushToast('Copied tx data');
              }
            }
          } else {
            // Transaction details pane - copy human-readable transaction
            await clipboardy?.write?.(rawTxData);
            pushToast('Copied details');
          }
        } catch (err) {
          pushToast('Copy failed', 'warn');
        }
      }
      if (key.name === 'd') { setDebugVisible(v => !v); pushToast(debugVisible ? 'Debug hidden' : 'Debug visible'); }
      if (key.full === 'C-l') { setFollowLatest(f => !f); pushToast('Follow toggled'); }

      if (key.name === 'm' && !key.shift) await setAutoMark();
      if ((key.name === 'm' && key.shift) || key.name === 'M') setJumpsOpen(true);
      if (key.name === ']' ) await jumpNext();
      if (key.name === '[' ) await jumpPrev();
      if (key.sequence === "'" || key.name === 'quote' ) { pendingJumpKeyRef.current = true; pushToast("Jump: type label"); }
    };
    Keybind.sharedInstance().emitter.on("key", handler);
    return () => { Keybind.sharedInstance().emitter.off("key", handler); };
  }, [txData, rawTxData, blockHeights, selectedBlock, selectedTxHash, focusedPane, network, compiled, openTxFromHash, autoPinSlash]);

  useEffect(() => { screen.key(
    ['tab','S-tab','up','down','left','right','pageup','pagedown','home','end','v','/','f','escape','enter','C-f','C-k','?','h','c','d','C-l','m','M','[',']',"'"],
    (_: any, key: any) => Keybind.sharedInstance().keyPressed(key)
  )}, [screen])

  useEffect(() => { checkForTransactionsInBlock(selectedBlock) }, [checkForTransactionsInBlock, selectedBlock])

  const actions: PaletteAction[] = useMemo(() => ([
    { id: 'focus-filter', name: 'Focus Filter', hint: 'f', run: () => setFilterFocused(true) },
    { id: 'open-history', name: 'Open History Search', hint: 'Ctrl+F', run: () => setHistoryOpen(true) },
    { id: 'toggle-follow', name: 'Toggle Follow Latest', hint: 'Ctrl+L', run: () => setFollowLatest(f => !f) },
    { id: 'set-mark', name: 'Set Mark', hint: 'm', run: async () => { await setAutoMark(); } },
    { id: 'open-marks', name: 'Open Marks Overlay', hint: 'M', run: () => setJumpsOpen(true) },
    { id: 'open-slash', name: 'Open Quick Command', hint: '/', run: () => setSlashOpen(true) },
    { id: 'toggle-autopin-slash', name: `Auto-Pin (Slash TX): ${autoPinSlash ? 'ON' : 'OFF'}`, hint: 'Ctrl+A in /', run: () => setAutoPinSlash(v => !v) },
    { id: 'clear-pinned', name: 'Clear All Pinned Marks', hint: '', run: async () => {
        const pins = jmRef.current.list().filter(m => m.pinned).map(m => m.label);
        for (const l of pins) await jmRef.current.setPinned(l, false);
        setMarks(jmRef.current.list()); pushToast('Cleared all pinned');
      } },
    {
      id: 'open-hash',
      name: 'Open Tx by Hash',
      hint: 'Type hash then Enter',
      needsInput: true,
      run: async (input?: string) => { if (input) { setSlashOpen(false); await handleSlashSubmit(input.trim()); } }
    },
    { id: 'help', name: 'Help', hint: '?', run: () => setHelpOpen(true) },
    { id: 'copy', name: 'Copy Details', hint: 'c', run: async () => {
        try { await clipboardy?.write?.(rawTxData); pushToast('Copied details'); } catch { pushToast('Copy failed', 'warn'); }
      } },
  ]), [openTxFromHash, txData, rawTxData, autoPinSlash]);

  const height = blockHeights[0]?.height;
  const pinnedLabels = useMemo(() => marks.filter(m => m.pinned).slice(0, 3).map(m => m.label), [marks]);
  const pinnedTotal  = useMemo(() => marks.filter(m => m.pinned).length, [marks]);

  return (
    <>
      <FilterBar
        value={filterQuery}
        focused={filterFocused}
        onChange={setFilterQuery}
        onCommit={() => { setFilterFocused(false); checkForTransactionsInBlock(selectedBlock); pushToast('Filter applied'); }}
        onCancel={() => { setFilterFocused(false); }}
      />

      <BlockDetailsPane
        blockHeights={blockHeights}
        isFocused={focusedPane === 0}
        selectBlock={selectBlock}
        ownedCounts={ownedCounts}
        focusedPane={focusedPane}
      />
      <TxHashes
        txHashes={txHashes}
        selectTxHash={selectTxHash}
        isFocused={focusedPane === 1}
        focusedPane={focusedPane}
      />
      <TxDetails
        txData={txData}
        isFocused={focusedPane === 2}
        debugVisible={debugVisible}
        rawLen={rawTxData.length}
        txLen={txData.length}
        seq={txRenderSeqRef.current}
        clipboardyOk={!!clipboardy}
        focusedPane={focusedPane}
      />

      <HistorySearch
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpenTx={openTxFromHash}
        search={(q) => searchHistory(q, 500, 'desc')}
      />

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
      <JumpList
        open={jumpsOpen}
        marks={marks}
        onClose={() => setJumpsOpen(false)}
        onJump={async (label) => { await jumpTo(label); setJumpsOpen(false); }}
        onRemove={async (label) => { await jmRef.current.removeByLabel(label); setMarks(jmRef.current.list()); }}
        onTogglePin={async (label) => { await jmRef.current.togglePin(label); setMarks(jmRef.current.list()); }}
      />
      <SlashModal
        open={slashOpen}
        onClose={() => setSlashOpen(false)}
        onSubmit={handleSlashSubmit}
        autopin={autoPinSlash}
        onToggleAutopin={() => setAutoPinSlash(v => !v)}
      />

      <Toasts toasts={toasts} />
      <StatusBar
        network={network}
        height={height}
        follow={followLatest}
        fps={cfg().RENDER_FPS}
        filterActive={!!filterQuery}
        pinnedLabels={pinnedLabels}
        pinnedTotal={pinnedTotal}
        connecting={!connectionEstablished}
      />
    </>
  );
};
