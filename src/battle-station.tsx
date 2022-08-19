// Connected. Proceed to party…
import React, {useState, useEffect, useCallback, useRef} from 'react'
import { decodeTxRaw, DecodedTxRaw, decodePubkey } from '@cosmjs/proto-signing'
import { toHex, toBase64 } from '@cosmjs/encoding'
import { sha256 } from "@cosmjs/crypto"
import blessed from 'blessed'
import { CosmWasmClient, isMsgExecuteEncodeObject } from "@cosmjs/cosmwasm-stargate"
import { isMsgSendEncodeObject } from '@cosmjs/stargate'
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx"
import { Server, WebSocket } from 'ws'
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx"
import * as jq from 'node-jq'

import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import BlockDetailsPane from './panes/blocks/block-details'
import Debuggah from "./panes/debug/debug"
import { d } from './services/DebugLog'
import { getJSON } from './utils/json'
import WSCSLIPayload from './utils/websockets'
import DecodedTransaction from './model/DecodedTransaction'
import Keybind from './services/Keybind'
import BlockDetails from './model/BlockDetails'

interface DashboardProps {
  screen: blessed.Widgets.Screen
  client: CosmWasmClient
  wss: Server
}

const Dashboard: React.FC<DashboardProps> = ({screen, client, wss }) => {
  // so tired
  let lastTxWebsocketMessage: WSCSLIPayload = {
    type: "tx",
    data: null
  }
  const totalPanes = 4 // let's not hardcode this
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined)
  const [selectedTransaction, setSelectedTransaction] = useState<string | undefined>(undefined)
  // TODO: we're never setting this yet
  const [selectTxIdx, setSelectTxIdx] = useState(0)
  const [txHashes, setTxHashes] = useState<any[]>([])
  const [blockHeights, setBlockHeights] = useState<BlockDetails[]>([])
  const [txData, setTxData] = useState<any>('(Use tab to change panes. Arrow keys to navigate.)')

  const checkForNewBlock = async () => {
    try {
      const latestHeight = await client.getHeight()
      // Make sure we're not polling so frequently that we get the same height
      if (blockHeights.length > 0 && latestHeight === blockHeights[0].height) return
      //wss.clients.forEach(function each(client: any) {
      //  const blockUpdatePayload: WSCSLIPayload = {
      //    type: 'block',
      //    data: latestHeight
      //  }
      //  client.send(JSON.stringify(blockUpdatePayload))
      //})
  
      const latestBlockDetails = await client.getBlock(latestHeight)
  
      setBlockHeights(blockHeights => {
        const updatedBlockHeights = [{height: latestHeight, transactions: [...latestBlockDetails.txs]}, ...blockHeights]
        return updatedBlockHeights
      })
    } catch (error) {
      d("failed to check for new block", error)
    }
  }

  const decodeBlockTransaction = useCallback(async (txHash: string, blockInfo: BlockDetails) => {
    const blockDetails = await client.getBlock(blockInfo.height)
    const transaction = blockDetails.txs.find(tx => {
      const sha = sha256(tx)
      const readableTxHash = toHex(sha)
      return readableTxHash === txHash
    })

    if (!transaction) {
      return
    }

    const deserializedTx: DecodedTxRaw = decodeTxRaw(transaction)

    deserializedTx.body.messages.forEach( (message, index) => {
      let msg: any
      if (isMsgSendEncodeObject(message)) {
        msg = MsgSend.decode(message.value)
        deserializedTx.body.messages[index].value = msg
      } else if (isMsgExecuteEncodeObject(message)) {
        msg = MsgExecuteContract.decode(message.value)
        msg.msg = JSON.parse(Buffer.from(msg.msg).toString())
        deserializedTx.body.messages[index].value = msg
      }
      d("message decoded", txHash)
    })
    
    const indexedTx = await client.getTx(txHash)

    if (indexedTx) {
      let decodedTransaction: DecodedTransaction = {
        ...indexedTx,
        tx: {
          ...deserializedTx,
          signatures: deserializedTx.signatures.map(signatureBytes => toBase64(Buffer.from(signatureBytes))),
          authInfo: {
            ...deserializedTx.authInfo,
            signerInfos: deserializedTx.authInfo.signerInfos.map(info => {
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
        const json = getJSON(indexedTx.rawLog)
        if (!!json) {
          d('rawlog', indexedTx.rawLog)
          decodedTransaction.rawLog = json
        }
      }
      d("massaged tx")

      // jq with colors
      const txDataColors = await jq.run('.', decodedTransaction, { input: 'json', color: true })
      // whole shebang, keep the line below for a bit longer, please
      // const fullIndexedTx = util.inspect(indexedTx, false, null, true)
      const fullIndexedTx = decodedTransaction.tx

      // Fire off a websocket message
      const txUpdatePayload: WSCSLIPayload = {
        type: 'tx',
        identifier: indexedTx.hash,
        data: fullIndexedTx
      }
      wss.clients.forEach(function each(client: WebSocket) {
        if (lastTxWebsocketMessage.identifier !== txUpdatePayload.identifier) {
          // this is a bad way to do it, my brain hurts tho
          client.send(JSON.stringify(txUpdatePayload))
        }
      })
      lastTxWebsocketMessage = {
        type: 'tx',
        identifier: indexedTx.hash,
        data: null
      }
      setTxData(txDataColors)
    }
  }, [])

  const checkForTransactionsInBlock = useCallback(async (block?: BlockDetails) => {
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
        wss.clients.forEach(function each(client: WebSocket) {
          const txUpdatePayload: WSCSLIPayload = {
            type: 'tx',
            identifier: 'nada',
            data: null
          }
          client.send(JSON.stringify(txUpdatePayload))
        })
        return []
      })
      return
    }
    const blockDetails = await client.getBlock(blockInfo.height)

    const blockHasTransactions = blockDetails.txs.length !== 0
    d(JSON.stringify(blockInfo))
    if (blockHasTransactions) {
      const readableHashes = blockDetails.txs.map(tx => {
        const txHash = sha256(tx)
        const readableTxHash = toHex(txHash)
        return readableTxHash
      })
      setTxHashes(readableHashes)
      setSelectedTransaction(readableHashes[0])
    }
  }, [wss, client, decodeBlockTransaction])
  
  const intervalRef = useRef(checkForNewBlock)
  useEffect(() => {
    intervalRef.current = checkForNewBlock
  }, [checkForNewBlock])
  // React's silly way of saying, "do this once, yo"
  useEffect(() => {
    const timer = setInterval(async () => {
      await intervalRef.current()
    }, 5000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    screen.key(['left', 'right', 'space', 'o', 'w'], (_, key) => Keybind.sharedInstance().keyPressed(key))
  }, [])

  // Fires whenever:
  //  - a new block is added, and selection changes to keep focus
  //  - user pressed arrow keys
  useEffect(() => {
    // TODO: this was helpful
    checkForTransactionsInBlock(selectedBlock)
  }, [checkForTransactionsInBlock, selectedBlock])

  useEffect(() => {
    if (!selectedTransaction || !selectedBlock) {
      return
    }
    decodeBlockTransaction(selectedTransaction, selectedBlock)
  }, [decodeBlockTransaction, selectedTransaction, selectedBlock])

  return (
    <>
      <BlockDetailsPane
        blockHeights={blockHeights}
        selectBlock={(block) => {
          setSelectedBlock(block)
        }}
      />
      <TxHashes
        txHashes={txHashes}
        selectTransaction={(transaction) => {
          setSelectedTransaction(transaction)
        }}
      />
      <TxDetails
        txData={txData}
      />
      <Debuggah
        tabIndex={4.0}
      />
    </>
  )
}

export default Dashboard