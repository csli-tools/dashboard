// Connected. Proceed to party…
import React, {useState, useEffect, useCallback} from 'react'
import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import { BlockDetails } from './panes/blocks/block-details'
import { decodeTxRaw, DecodedTxRaw, decodePubkey } from '@cosmjs/proto-signing'
import { toHex, toBase64 } from '@cosmjs/encoding'
import { sha256 } from "@cosmjs/crypto";
import { isMsgExecuteEncodeObject, isMsgStoreCodeEncodeObject, isMsgInstantiateContractEncodeObject, isMsgUpdateAdminEncodeObject, isMsgClearAdminEncodeObject, isMsgMigrateEncodeObject, IndexedTx } from "@cosmjs/cosmwasm-stargate";
import {
  MsgClearAdmin,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateAdmin,
} from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { isMsgSendEncodeObject, MsgSendEncodeObject } from "@cosmjs/stargate";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { Debuggah } from "./panes/debug/debug";
import * as jq from 'node-jq'
import * as fs from 'fs'
import { wsCSLIPayload } from './utils/websockets'
import * as util from 'util'

export const Dashboard = ({screen, client, wss }) => {
  // so tired
  let lastTxWebsocketMessage: wsCSLIPayload = {
    type: "tx",
    identifier: '',
    data: null
  }
  const totalPanes = 3 // let's not hardcode this
  const [moveDirection, setMoveDirection] = useState({
    nonce: 0,
    direction: '' // This will update on arrow key presses
  })
  const [focusedPane, setFocusedPane] = useState(0)
  const [selectBlockIdx, setSelectBlockIdx] = useState(0)
  // TODO: we're never setting this yet
  const [selectTxIdx, setSelectTxIdx] = useState(0)
  const [txHashes, setTxHashes] = useState([]);
  const [blockHeights, setBlockHeights] = useState([]);
  const [debugEntries, setDebugEntries] = useState([]);
  const [txData, setTxData] = useState('(Use tab to change panes. Arrow keys to navigate.)');

  const isJSON= (stuff) => {
    let whoops = false
    // if (typeof stuff === 'string') return false
    try {
      JSON.parse(stuff)
    } catch (e) {
      whoops = true
    }
    return !whoops
  }

  // Debugger window
  const d = (message, stuff = null, pleaseWriteToLogs = false) => {
    let messageContent
    if (isJSON(stuff)) {
      setDebugEntries(debugEntries => {
        messageContent = [`${message}${stuff ? ` ${JSON.stringify(stuff)}`: ''}`, ...debugEntries]
        return messageContent
      })
    } else {
      setDebugEntries(debugEntries => {
        messageContent = [`${message}${stuff ? ` ${stuff}` : ''}`, ...debugEntries]
        return messageContent
      })
    }
    // Write to logs if they want
    if (pleaseWriteToLogs) {
      // Thank you for saying please
      // TODO: put this in a home directory
      fs.appendFile('csli-log.txt', `${messageContent}\n`, 'utf8', () => {});
    }
  }

  const checkForNewBlock = async () => {
    const latestHeight = await client.getHeight()
    // Make sure we're not polling so frequently that we get the same height
    if (blockHeights && latestHeight === blockHeights[blockHeights.length - 1]) return
    wss.clients.forEach(function each(client) {
      const blockUpdatePayload: wsCSLIPayload = {
        type: 'block',
        data: latestHeight
      }
      client.send(JSON.stringify(blockUpdatePayload))
    });

    const latestBlockDetails = await client.getBlock(latestHeight)
    const blockHasTransactions = latestBlockDetails.txs.length !== 0
    const blockLabel = blockHasTransactions ? latestHeight.toString() : `${latestHeight} (empty)`

    setBlockHeights(blockHeights => {
      const updatedBlockHeights = [blockLabel, ...blockHeights]
      return updatedBlockHeights
    });
  }

  const checkForTransactionsInBlock = async () => {
    // I don't understand React, so I have this silly guard.
    // Please send halp, anon devs
    let blockIndex = selectBlockIdx;
    let bh = blockHeights;
    if (bh.length === 0 || !bh) {
      d('thought i should return early');
      return
    }

    const blockHeight = bh[blockIndex]
    if (!blockHeight) return // ditto with my React silliness
    if (blockHeight.includes('empty')) {
      setTxData('')
      setTxHashes(txHashes => {
        // boy, is this stupid
        // Let external panes know, too
        wss.clients.forEach(function each(client) {
          const txUpdatePayload: wsCSLIPayload = {
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
    const blockDetails = await client.getBlock(Number(blockHeight))

    const blockHasTransactions = blockDetails.txs.length !== 0

    if (blockHasTransactions) {
      const firstTx: DecodedTxRaw = decodeTxRaw(blockDetails.txs[0])
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
      // hardcoded to just show the first
      const readableTxHash = toHex(txHash)
      let indexedTx: IndexedTx = await client.getTx(readableTxHash)
      indexedTx.tx = deserializedFirstTx
      const stringOfSignature = Buffer.from(indexedTx.tx.signatures[0])
      const base64OfSignature = toBase64(stringOfSignature)
      indexedTx.tx.signatures[0] = base64OfSignature
      indexedTx.tx.authInfo.signerInfos[0].publicKey.value = decodePubkey(indexedTx.tx.authInfo.signerInfos[0].publicKey)
      if (indexedTx.rawLog) {
        // Wasm messages may not have this
        if (isJSON(indexedTx.rawLog)) {
          d('rawlog', indexedTx.rawLog)
          indexedTx.rawLog = JSON.parse(indexedTx.rawLog)
        }
      }

      setTxHashes([readableTxHash])
      // jq with colors
      const txDataColors = await jq.run('.', indexedTx, { input: 'json', color: true})
      // whole shebang, keep the line below for a bit longer, please
      // const fullIndexedTx = util.inspect(indexedTx, false, null, true)
      const fullIndexedTx = indexedTx.tx

      // Fire off a websocket message
      const txUpdatePayload: wsCSLIPayload = {
        type: 'tx',
        identifier: indexedTx.hash,
        data: fullIndexedTx
      }
      wss.clients.forEach(function each(client) {
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

  // React's silly way of saying, "do this once, yo"
  useEffect(() => {
    setInterval(async () => {
      await checkForNewBlock()
    }, 5000)
  }, []);

  const navigatePane = useCallback(key => {
    switch (key) {
      case 'tab':
        // Sets focus to next pane index
        setFocusedPane(focusedPane => (focusedPane + 1) % (totalPanes))
        break;
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        setMoveDirection(num => {
          // We use a nonce so React refreshes, basically
          // Otherwise, hitting the same arrow key twice wouldn't fire off stuff
          return {
            nonce: num.nonce + 1,
            direction: key
          }
        })
        break;
    }
  }, []);

  useEffect(() => {
    screen.key(['tab', 'up', 'down', 'left', 'right', 'space', 'o', 'w'], (_, key) => navigatePane(key.name))
  }, [navigatePane])

  useEffect(() => {
    switch (focusedPane) {
      case 0:
        switch (moveDirection.direction) {
          case 'up':
            // Go up one unless we're at the top
            setSelectBlockIdx(selectBlockIdx => {
              if (selectBlockIdx > 0) {
                if (selectBlockIdx >= blockHeights.length) selectBlockIdx = blockHeights.length - 1
                return (selectBlockIdx - 1)
              } else return selectBlockIdx
            })
            break;
          case 'down':
            // Go down one unless we're at the bottom
            setSelectBlockIdx(selectBlockIdx => {
              if (selectBlockIdx < blockHeights.length - 1) {
                return (selectBlockIdx + 1)
              } else return selectBlockIdx
            })
            break;
          case 'left':
            // Go all the way to the top
            setSelectBlockIdx(0)
            break;
          case 'right':
            // Go down two
            setSelectBlockIdx(selectBlockIdx => {
              if (selectBlockIdx < blockHeights.length - 2) {
                return (selectBlockIdx + 2)
              } else return selectBlockIdx
            })
            break;
        }
        break;
      case 1:
        d('pane 1: pressed ', moveDirection.direction)
        break;
      case 2:
        d('pane 2: pressed ', moveDirection.direction)
    }
  }, [moveDirection])

  // This keeps the selection on the same block, for DevX
  useEffect(async () => {
    setSelectBlockIdx(selectBlockIdx => {
      // d('debugging current selectBlockIdx', selectBlockIdx)
      let newSelectBlockIdx
      if (blockHeights.length === 1) {
        newSelectBlockIdx = 0;
      } else if (selectBlockIdx < blockHeights.length) {
        newSelectBlockIdx = selectBlockIdx + 1
      } else {
        newSelectBlockIdx = selectBlockIdx
      }

      return newSelectBlockIdx
    })
  }, [blockHeights])


  // Fires whenever:
  //  - a new block is added, and selection changes to keep focus
  //  - user pressed arrow keys
  useEffect(() => {
    // TODO: this was helpful
    checkForTransactionsInBlock(selectBlockIdx, blockHeights)
  }, [selectBlockIdx, blockHeights])

  return (
    <>
      <BlockDetails
        blockHeights={blockHeights}
        selectBlockIdx={selectBlockIdx}
        amFocused={focusedPane === 0}
      />
      <TxHashes
        txHashes={txHashes}
        selectTxIdx={selectTxIdx}
        amFocused={focusedPane === 1}
      />
      <TxDetails
        txData={txData}
        amFocused={focusedPane === 2}
      />
      <Debuggah
        debugEntries={debugEntries}
      />
    </>
  );
};
