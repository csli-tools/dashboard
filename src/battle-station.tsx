// Connected. Proceed to party…
import React, {useState, useEffect, useCallback, useRef} from 'react'
import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import BlockDetailsPane from './panes/blocks/block-details'
import { decodeTxRaw, DecodedTxRaw, decodePubkey } from '@cosmjs/proto-signing'
import { toHex, toBase64 } from '@cosmjs/encoding'
import { sha256 } from "@cosmjs/crypto";
import blessed from 'blessed'
import { CosmWasmClient, isMsgExecuteEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { isMsgSendEncodeObject } from '@cosmjs/stargate'
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { Server } from 'ws'
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { Debuggah } from "./panes/debug/debug";
import * as jq from 'node-jq'
import * as fs from 'fs'

import WSCSLIPayload from './utils/websockets'
import DecodedTransaction from './model/DecodedTransaction'
import Keybind from './services/Keybind'
import BlockDetails from './model/BlockDetails'

interface DashboardProps {
  screen: blessed.Widgets.Screen
  client: CosmWasmClient
  wss: Server
}

export const Dashboard: React.FC<DashboardProps> = ({screen, client, wss }) => {
  // so tired
  let lastTxWebsocketMessage: WSCSLIPayload = {
    type: "tx",
    data: null
  }
  const totalPanes = 4 // let's not hardcode this
  const [focusedPane, setFocusedPane] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined)
  const [selectedTransaction, setSelectedTransaction] = useState<undefined>(undefined)
  // TODO: we're never setting this yet
  const [selectTxIdx, setSelectTxIdx] = useState(0)
  const [txHashes, setTxHashes] = useState<any[]>([]);
  const [blockHeights, setBlockHeights] = useState<BlockDetails[]>([]);
  const [debugEntries, setDebugEntries] = useState<string[]>([]);
  const [txData, setTxData] = useState<any>('(Use tab to change panes. Arrow keys to navigate.)');

  const isJSON= (stuff: any) => {
    let whoops = false
    // if (typeof stuff === 'string') return false
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
  
  // Debugger window
  const d = useCallback((message: any, stuff: any | null = null, pleaseWriteToLogs = false) => {
    if (!debugEntriesRef.current) {
      return
    }
    let messageContent
    if (stuff && isJSON(stuff)) {
      messageContent = JSON.stringify(stuff)
    } else {
      messageContent = stuff
    }
    setDebugEntries([...debugEntriesRef.current, `${message} ${messageContent}`])

    // Write to logs if they want
    if (pleaseWriteToLogs) {
      // Thank you for saying please
      // TODO: put this in a home directory
      fs.appendFile('csli-log.txt', `${messageContent}\n`, 'utf8', () => {});
    }
  }, [])

  const checkForNewBlock = async () => {
    d('check for new block')
    try {
      const latestHeight = await client.getHeight()
      d('latestHeight', latestHeight)
      // Make sure we're not polling so frequently that we get the same height
      if (blockHeights.length > 0 && latestHeight === blockHeights[0].height) return
      wss.clients.forEach(function each(client: any) {
        const blockUpdatePayload: WSCSLIPayload = {
          type: 'block',
          data: latestHeight
        }
        client.send(JSON.stringify(blockUpdatePayload))
      });
  
      const latestBlockDetails = await client.getBlock(latestHeight)
  
      setBlockHeights(blockHeights => {
        const updatedBlockHeights = [{height: latestHeight, transactions: [...latestBlockDetails.txs]}, ...blockHeights]
        return updatedBlockHeights
      });
    } catch (error) {
      d("failed to check for new block", error)
    }
  }

  const checkForTransactionsInBlock = useCallback(async (block?: BlockDetails) => {
    d(block)
    const blockInfo = block
    if (!blockInfo) {
      d('No blocks found yet')
      return
    }
    
    if (blockInfo.transactions.length === 0) {
      setTxData('')
      setTxHashes(txHashes => {
        // boy, is this stupid
        // Let external panes know, too
        wss.clients.forEach(function each(client: any) {
          const txUpdatePayload: WSCSLIPayload = {
            type: 'tx',
            identifier: 'nada',
            data: null
          }
          client.send(JSON.stringify(txUpdatePayload))
        });
        return []
      })
      return
    }
    const blockDetails = await client.getBlock(blockInfo.height)

    const blockHasTransactions = blockDetails.txs.length !== 0
    if (blockHasTransactions) {
      d("block has transactions")
      const firstTx: DecodedTxRaw = decodeTxRaw(blockDetails.txs[0])
      d("block decoded")
      let deserializedFirstTx = firstTx
      const txHash = sha256(blockDetails.txs[0])
      const firstMessage = firstTx.body.messages[0]
      let msg: any
      if (isMsgSendEncodeObject(firstMessage)) {
        msg = MsgSend.decode(firstMessage.value)
        deserializedFirstTx.body.messages[0].value = msg
      } else if (isMsgExecuteEncodeObject(firstMessage)) {
        msg = MsgExecuteContract.decode(firstMessage.value)
        msg.msg = JSON.parse(Buffer.from(msg.msg).toString())
        deserializedFirstTx.body.messages[0].value = msg
      }
      d("message decoded", txHash)
      // hardcoded to just show the first
      const readableTxHash = toHex(txHash)
      const indexedTx = await client.getTx(readableTxHash)
      d("got tx")
      if (indexedTx) {
        let decodedTransaction: DecodedTransaction = {
          ...indexedTx,
          tx: {
            ...deserializedFirstTx,
            signatures: deserializedFirstTx.signatures.map(signatureBytes => toBase64(Buffer.from(signatureBytes))),
            authInfo: {
              ...deserializedFirstTx.authInfo,
              signerInfos: deserializedFirstTx.authInfo.signerInfos.map(info => {
                return {
                  ...info,
                  publicKey: info.publicKey ? {...info.publicKey, value: decodePubkey(info.publicKey) } : undefined
                }
              })
            }
          }
        }
        if (indexedTx.rawLog) {
          // Wasm messages may not have this
          if (isJSON(indexedTx.rawLog)) {
            d('rawlog', indexedTx.rawLog)
            decodedTransaction.rawLog = JSON.parse(indexedTx.rawLog)
          }
        }
        d("massaged tx")
  
        setTxHashes([readableTxHash])
        // jq with colors
        const txDataColors = await jq.run('.', indexedTx, { input: 'json', color: true})
        // whole shebang, keep the line below for a bit longer, please
        // const fullIndexedTx = util.inspect(indexedTx, false, null, true)
        const fullIndexedTx = decodedTransaction.tx
  
        // Fire off a websocket message
        const txUpdatePayload: WSCSLIPayload = {
          type: 'tx',
          identifier: indexedTx.hash,
          data: fullIndexedTx
        }
        wss.clients.forEach(function each(client: any) {
          if (lastTxWebsocketMessage.identifier !== txUpdatePayload.identifier) {
            // this is a bad way to do it, my brain hurts tho
            client.send(JSON.stringify(txUpdatePayload))
          }
        });
        lastTxWebsocketMessage = {
          type: 'tx',
          identifier: indexedTx.hash,
          data: null
        }
  
        setTxData(txDataColors)
      }
    }
  }, [])
  
  const intervalRef = useRef(checkForNewBlock)
  useEffect(() => {
    intervalRef.current = checkForNewBlock
  }, [checkForNewBlock])
  // React's silly way of saying, "do this once, yo"
  useEffect(() => {
    setInterval(async () => {
      await intervalRef.current()
    }, 5000)
  }, []);

  const navigatePane = useCallback((key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name !== "tab") {
      return
    }
    setFocusedPane(focusedPane => (focusedPane + 1) % (totalPanes))
  }, [focusedPane]);
  
  const navigatePaneRef = useRef(navigatePane)
  useEffect(() => {
    navigatePaneRef.current = navigatePane
  }, [navigatePane])
  
  useEffect(() => {
    Keybind.sharedInstance().emitter.on("key", (key: blessed.Widgets.Events.IKeyEventArg) => {
      navigatePaneRef.current(key)
    })
  }, [])

  useEffect(() => {
    screen.key(['tab', 'up', 'down', 'left', 'right', 'space', 'o', 'w'], (_, key) => Keybind.sharedInstance().keyPressed(key))
  }, [])

  // Fires whenever:
  //  - a new block is added, and selection changes to keep focus
  //  - user pressed arrow keys
  useEffect(() => {
    // TODO: this was helpful
    checkForTransactionsInBlock(selectedBlock)
  }, [checkForTransactionsInBlock, selectedBlock])

  return (
    <>
      <BlockDetailsPane
        blockHeights={blockHeights}
        isFocused={focusedPane === 0}
        selectBlock={(block) => {
          setSelectedBlock(block)
        }}
      />
      <TxHashes
        txHashes={txHashes}
        selectTxIdx={selectTxIdx}
        isFocused={focusedPane === 1}
      />
      <TxDetails
        txData={txData}
        isFocused={focusedPane === 2}
      />
      <Debuggah
        debugEntries={debugEntries}
        isFocused={focusedPane === 3}
      />
    </>
  );
};
