// Connected. Proceed to party… (non-blocking edition)
import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react'
import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import BlockDetailsPane from './panes/blocks/block-details'
import blessed from 'blessed'
import { Server } from 'ws'
import { Debuggah } from "./panes/debug/debug";
import * as fs from 'fs'

import WSCSLIPayload from './utils/websockets'
import Keybind from './services/Keybind'
import BlockDetails from './model/BlockDetails'
import { BlockPoller } from './services/near-rpc'
import { getActionDescription, getActionType, decodeTransactionArgs } from './model/NEARTypes'
import { ansiJson } from './utils/pretty'
import { cfg } from './shared/config'

// New UX components
import { StatusBar } from './ui/StatusBar'
import { Toasts, Toast } from './ui/Toast'
import { HelpOverlay } from './ui/HelpOverlay'
import { CommandPalette, PaletteAction } from './ui/CommandPalette'

interface DashboardProps {
  screen: blessed.Widgets.Screen
  wss: Server
}

const WS_HWM_BYTES = Number(process.env.WS_HIGH_WATER_MARK ?? 1_000_000); // 1MB
const DEBUG_UI = false; // flip on when Debuggah is enabled

export const Dashboard: React.FC<DashboardProps> = ({screen, wss }) => {
  const totalPanes = 3 // Blocks, TxHashes, TxDetails (Debuggah is commented out)
  const [focusedPane, setFocusedPane] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined)
  const [selectedTxHash, setSelectedTxHash] = useState<string | undefined>(undefined)
  const [selectedTxIndex, setSelectedTxIndex] = useState<number>(0)
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [blockHeights, setBlockHeights] = useState<BlockDetails[]>([]);
  const [debugEntries, setDebugEntries] = useState<string[]>([]);
  const [txData, setTxData] = useState<any>('');
  const [rawTxData, setRawTxData] = useState<string>('');

  // New UX state
  const [helpOpen, setHelpOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [followLatest, setFollowLatest] = useState(true)

  // Toast system
  const toastId = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((text: string, level: Toast['level']='info') => {
    const id = toastId.current++;
    setToasts(t => [...t, { id, text, level }]);
    setTimeout(() => { setToasts(t => t.filter(x => x.id !== id)); }, 2500);
  }, []);

  const lastTxWSRef = useRef<WSCSLIPayload>({ type: 'tx', data: null });
  const pollerRef = useRef<BlockPoller | null>(null);

  const isJSON= (stuff: any) => {
    let whoops = false
    try {
      JSON.parse(stuff)
    } catch (e) {
      whoops = true
    }
    return !whoops
  }

  const debugEntriesRef = useRef(debugEntries)
  useEffect(() => {
    debugEntriesRef.current = debugEntries
  }, [debugEntries])

  // Debugger window (avoid spamming React state unless Debug UI is on)
  const d = useCallback((message: any, stuff: any | null = null, pleaseWriteToLogs = false) => {
    let messageContent: string = ''
    if (stuff && isJSON(stuff)) {
      messageContent = JSON.stringify(stuff)
    } else if (typeof stuff !== 'undefined' && stuff !== null) {
      messageContent = String(stuff)
    }
    const line = `${message} ${messageContent}`

    if (DEBUG_UI) {
      setDebugEntries(prev => [...prev, line].slice(-500))
    }
    // Suppress console.log to avoid interfering with blessed UI

    if (pleaseWriteToLogs) {
      // TODO: put this in a home directory
      fs.appendFile('csli-log.txt', `${line}\n`, 'utf8', () => {});
    }
  }, [])

  // Backpressure-aware websocket broadcast
  const broadcast = useCallback((payload: WSCSLIPayload) => {
    const serialized = JSON.stringify(payload)
    wss.clients.forEach(function each(client: any) {
      if (client.readyState !== 1 /* OPEN */) return
      // `bufferedAmount` is supported by `ws` to indicate unsent bytes
      const buffered = (client as any).bufferedAmount ?? 0
      if (buffered > WS_HWM_BYTES) {
        // Drop non-critical messages when the socket is backed up
        if (payload.type !== 'block' && payload.type !== 'tx') return
      }
      client.send(serialized)
    });
  }, [wss])

  const onNewBlock = useCallback((nearBlock: any) => {
    d('new block received', nearBlock.header.height)
    try {
      const latestHeight = nearBlock.header.height

      // Broadcast to breakout panes
      broadcast({ type: 'block', data: latestHeight })

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
        transactions: nearBlock.transactions || [],
        chunks: nearBlock.chunks.map((chunk: any) => ({
          chunk_hash: chunk.chunk_hash,
          shard_id: chunk.shard_id,
          gas_used: chunk.gas_used,
          gas_limit: chunk.gas_limit,
        }))
      }

      setBlockHeights(blockHeights => {
        const updatedBlockHeights = [blockDetails, ...blockHeights]
        // Auto-select latest block if following
        if (followLatest) {
          setSelectedBlock(blockDetails)
        }
        // Limit to last 100 blocks to prevent memory growth
        return updatedBlockHeights.slice(0, 100)
      });
    } catch (error) {
      d("failed to process new block", error as any)
    }
  }, [broadcast, d, followLatest])

  // Only keep last selection's render; discard earlier work if user scrolls fast
  const txRenderSeqRef = useRef(0)

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
    const decoded = decodeTransactionArgs(tx);
    const showBase64 = cfg().SHOW_ARGS_BASE64;

    // Deep clone and clean up actions - conditionally remove args_base64 (recursively)
    const prettyActions = decoded.actions.map((action: any) => cleanAction(action, showBase64));

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
    const decoded = decodeTransactionArgs(tx);
    const showBase64 = cfg().SHOW_ARGS_BASE64;

    // Deep clone and clean up actions - conditionally remove args_base64 (recursively)
    const prettyActions = decoded.actions.map((action: any) => cleanAction(action, showBase64));

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

  // Render current tx in pretty mode
  const displayTransaction = useCallback(async (tx: any) => {
    const seq = ++txRenderSeqRef.current
    d("displaying transaction", tx.hash)

    // Prepare two versions: truncated for display, full for clipboard
    const txSummaryDisplay = prepareTxForDisplay(tx);
    const txSummaryCopy = prepareTxForCopy(tx);
    setImmediate(() => {
      const pretty = ansiJson(txSummaryDisplay)  // Display uses truncated version
      const raw = JSON.stringify(txSummaryCopy, null, 2)  // Clipboard uses full version
      if (seq === txRenderSeqRef.current) {
        setTxData(pretty)
        setRawTxData(raw)
      }
    })

    // Fire off websocket message to breakout panes (send compact summary to avoid huge payloads)
    try {
      const identifier = (tx && tx.hash) || '';
      const txUpdatePayload: WSCSLIPayload = {
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
      if (lastTxWSRef.current.identifier !== txUpdatePayload.identifier) {
        broadcast(txUpdatePayload)
        lastTxWSRef.current = { ...txUpdatePayload }
      }
    } catch { /* no-op */ }
  }, [broadcast, d])

  const selectBlock = useCallback((block: BlockDetails) => {
    setSelectedBlock(block)
    setFollowLatest(false) // User browsed history, stop following
  }, [])

  const selectTxHash = useCallback(async (txHash: string, index: number) => {
    setSelectedTxHash(txHash)
    setSelectedTxIndex(index)

    const blockInfo = selectedBlock
    if (!blockInfo) {
      d('No blocks found yet')
      return
    }

    const tx = blockInfo.transactions.find((t: any) => t.hash === txHash)
    if (tx) {
      await displayTransaction(tx)
    }
  }, [selectedBlock, displayTransaction, d])

  const checkForTransactionsInBlock = useCallback(async (blockInfo?: BlockDetails) => {
    if (!blockInfo) {
      d('No blocks found yet')
      return
    }

    if (blockInfo.transactions.length === 0) {
      setTxData('')
      setRawTxData('')
      setTxHashes([])
      setSelectedTxHash(undefined)
      setSelectedTxIndex(0)
      // Let external panes know
      broadcast({ type: 'tx', identifier: 'nada', data: null })
      return
    }

    // Set all transaction hashes from the block
    setTxHashes(blockInfo.transactions.map(tx => tx.hash))

    // Display the first transaction by default
    const firstTx = blockInfo.transactions[0]
    setSelectedTxHash(firstTx.hash)
    setSelectedTxIndex(0)
    await displayTransaction(firstTx)
  }, [broadcast, d, displayTransaction])

  // Start BlockPoller on mount
  useEffect(() => {
    d('Starting BlockPoller...')
    pollerRef.current = new BlockPoller()
    pollerRef.current.start(onNewBlock, 1000) // Poll every 1 second

    // Cleanup: stop poller on unmount
    return () => {
      d('Stopping BlockPoller')
      if (pollerRef.current) {
        pollerRef.current.stop()
      }
    }
  }, [onNewBlock, d]);

  // Global key handling with toast feedback
  const handleGlobalKey = useCallback((key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name === 'tab') {
      setFocusedPane(prev => (prev + 1) % totalPanes)
    } else if (key.name === '?' || key.name === 'h') {
      setHelpOpen(true)
    } else if (key.full === 'C-k') {
      setPaletteOpen(true)
    } else if (key.full === 'C-l') {
      setFollowLatest(f => !f)
      pushToast(`Follow ${!followLatest ? 'ON' : 'OFF'}`)
    } else if (key.name === 'escape') {
      setHelpOpen(false)
      setPaletteOpen(false)
    } else if (key.name === 'c') {
      // Copy transaction details to clipboard (raw JSON without ANSI codes)
      if (!rawTxData || typeof rawTxData !== 'string') return
      const { spawn } = require('child_process')
      const platform = process.platform
      let clipboardCmd: string
      let clipboardArgs: string[] = []

      if (platform === 'darwin') {
        clipboardCmd = 'pbcopy'
      } else if (platform === 'win32') {
        clipboardCmd = 'clip'
      } else {
        clipboardCmd = 'xclip'
        clipboardArgs = ['-selection', 'clipboard']
      }

      try {
        const proc = spawn(clipboardCmd, clipboardArgs)
        proc.stdin.write(rawTxData)
        proc.stdin.end()
        proc.on('close', (code: number | null) => {
          if (code === 0) {
            pushToast('Copied to clipboard')
          } else {
            pushToast('Copy failed', 'warn')
          }
        })
      } catch (err) {
        d('Failed to copy to clipboard', err)
        pushToast('Copy failed', 'warn')
      }
    }
  }, [rawTxData, d, followLatest, pushToast])

  const handleGlobalKeyRef = useRef(handleGlobalKey)
  useEffect(() => {
    handleGlobalKeyRef.current = handleGlobalKey
  }, [handleGlobalKey])

  useEffect(() => {
    const handler = (key: blessed.Widgets.Events.IKeyEventArg) => {
      handleGlobalKeyRef.current(key)
    }

    Keybind.sharedInstance().emitter.on("key", handler)

    // Cleanup: remove event listener on unmount
    return () => {
      Keybind.sharedInstance().emitter.off("key", handler)
    }
  }, [])

  useEffect(() => {
    // Wire screen keys to Keybind emitter; register all shortcuts
    screen.key(['tab', 'up', 'down', 'left', 'right', 'space', 'pageup', 'pagedown', 'home', 'end', 'c', 'o', 'w', '?', 'h', 'C-k', 'C-l', 'escape', 'enter'], (_, key) => Keybind.sharedInstance().keyPressed(key))
  }, [screen])

  // Fires whenever:
  //  - a new block is added, and selection changes to keep focus
  //  - user pressed arrow keys
  useEffect(() => {
    checkForTransactionsInBlock(selectedBlock)
  }, [checkForTransactionsInBlock, selectedBlock])

  // Command palette actions
  const actions: PaletteAction[] = useMemo(() => ([
    { id: 'toggle-follow', name: 'Toggle Follow Latest', hint: 'Ctrl+L', run: () => { setFollowLatest(f => !f); pushToast(`Follow ${!followLatest ? 'ON' : 'OFF'}`); } },
    { id: 'help', name: 'Help', hint: '?', run: () => setHelpOpen(true) },
    { id: 'copy', name: 'Copy Details', hint: 'c', run: () => pushToast('Press \'c\' on keyboard') },
  ]), [followLatest, pushToast]);

  // Status bar data
  const network = cfg().NEAR_NETWORK;
  const height = blockHeights[0]?.height;

  return (
    <>
      <BlockDetailsPane
        blockHeights={blockHeights}
        isFocused={focusedPane === 0}
        selectBlock={selectBlock}
      />
      <TxHashes
        txHashes={txHashes}
        selectTxHash={selectTxHash}
        isFocused={focusedPane === 1}
      />
      <TxDetails
        txData={txData}
        isFocused={focusedPane === 2}
      />

      {/* New UX components */}
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
      <Toasts toasts={toasts} />
      <StatusBar
        network={network}
        height={height}
        follow={followLatest}
        fps={cfg().RENDER_FPS}
        filterActive={false}
      />
    </>
  );
};
