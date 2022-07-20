// Connected. Proceed to party…
import React, {useState, useEffect, useCallback} from 'react'
import { TxHashes } from './panes/transactions/tx-hashes'
import { TxDetails } from './panes/transactions/tx-details'
import { BlockDetails } from './panes/blocks/block-details'
import { decodeTxRaw, DecodedTxRaw, decodePubkey } from '@cosmjs/proto-signing'
import { toHex, toBase64 } from '@cosmjs/encoding'
import { sha256 } from "@cosmjs/crypto";
import { decodeSignature, StdSignature } from "@cosmjs/amino"
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

export const Dashboard = ({screen, client}) => {
  const totalPanes = 3 // let's not hardcode this
  const [moveDirection, setMoveDirection] = useState({
    nonce: 0,
    direction: '' // This will update on arrow key presses
  })
  const [focusedPane, setFocusedPane] = useState(0)
  const [selectBlockIdx, setSelectBlockIdx] = useState(0)
  const [validSelectedBlockHeight: Number | null, setValidSelectedBlockHeight] = useState(null)
  const [selectTxIdx, setSelectTxIdx] = useState(0)
  // const [lastHash, setLastHash] = useState('genesis')
  const [txHashes, setTxHashes] = useState([]);
  const [txDetails, setTxDetails] = useState('(Use tab to change panes. Arrow keys to navigate.)');
  const [blockHeights, setBlockHeights] = useState([]);
  const [debugEntries, setDebugEntries] = useState([]);
  const [txData, setTxData] = useState('hi');

  const isJSON= (stuff) => {
    let whoops = false
    try {
      JSON.stringify(stuff)
    } catch (e) {
      console.log('aloha error', e)
      whoops = true
    }
    return !whoops
  }

  const d = (message, stuff) => {
    if (isJSON(stuff)) {
      setDebugEntries(debugEntries => [`${message} ${JSON.stringify(stuff)}`, ...debugEntries])
    } else {
      setDebugEntries(debugEntries => [`${message} ${stuff}`, ...debugEntries])
    }
  }

  const checkForNewBlock = async () => {
    const latestHeight = await client.getHeight()
    // Make sure we're not polling so frequently that we get the same height
    if (blockHeights && latestHeight === blockHeights[blockHeights.length - 1]) return
    d('New block', latestHeight)
    const latestBlockDetails = await client.getBlock(latestHeight)
    // console.log(`\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n`)
    // console.log('aloha latestBlockDetails', latestBlockDetails)
    const blockHasTransactions = latestBlockDetails.txs.length !== 0
    const blockLabel = blockHasTransactions ? latestHeight.toString() : `${latestHeight} (empty)`

    setBlockHeights(blockHeights => {
      const updatedBlockHeights = [blockLabel, ...blockHeights]
      return updatedBlockHeights
    });
    // if (blockHasTransactions) {
    //   d('checking for selectBlockIdx', selectBlockIdx)
    //   d('checking for Number(blockLabel)', Number(blockLabel))
    //   checkForTransactionsInBlock(selectBlockIdx, blockHeights)
    // }

    // if (blockHasTransactions) {
    //   const firstTx: DecodedTxRaw = decodeTxRaw(latestBlockDetails.txs[0])
    //   const txHash = sha256(latestBlockDetails.txs[0])
    //   const firstMessage = firstTx.body.messages[0]
    //   // console.log('aloha firstMessage', firstMessage)
    //   if (isMsgSendEncodeObject(firstMessage)) {
    //     const msg: MsgSend = MsgSend.decode(firstMessage.value)
    //     // console.log('aloha msg', msg)
    //   }
    //   if (isMsgExecuteEncodeObject) {
    //     let msg: MsgExecuteContract = MsgExecuteContract.decode(firstMessage.value)
    //     msg.msg = JSON.parse(Buffer.from(msg.msg).toString())
    //     // console.log('aloha msg', msg)
    //
    //   }
    //   // console.log('aloha txHash', txHash)
    //   // console.log('tx hash', toHex(sha256(firstTx)))
    //
    //   // console.log('aloha latestBlockDetails (has txs)', latestBlockDetails)
    //   // hardcoded to just show the first
    //   // setTxHashes(txHashes => [toHex(txHash), ...txHashes])
    // }
  }

  const checkForTransactionsInBlock = async () => {
    // I don't understand React, so I have this silly guard.
    // Please send halp, anon devs
    let blockIndex = selectBlockIdx;
    let bh = blockHeights;
    d('my selected index is', blockIndex);
    d('blockHeights length is ', bh?.length);
    if (bh.length === 0 || !bh) {
      d('thought i should return early');
      return
    }
    d('top of check for tx in block blockIndex', blockIndex)

    const blockHeight = bh[blockIndex]
    d('top of check for tx in block blockHeight', blockHeight)
    if (!blockHeight) return // ditto with my React silliness
    if (blockHeight.includes('empty')) {
      setTxData('')
      setTxHashes([])
      return
    }
    const blockDetails = await client.getBlock(Number(blockHeight))
    d('blockDetails', blockDetails)

    const blockHasTransactions = blockDetails.txs.length !== 0

    if (blockHasTransactions) {
      const firstTx: DecodedTxRaw = decodeTxRaw(blockDetails.txs[0])
      let deserializedFirstTx = firstTx
      const txHash = sha256(blockDetails.txs[0])
      const firstMessage = firstTx.body.messages[0]
      d('aloha firstMessage', firstMessage)
      let msg: any
      if (isMsgSendEncodeObject(firstMessage)) {
        msg = MsgSend.decode(firstMessage.value)
        // console.log('aloha msg', msg)
        d('aloha MsgSend', msg)
        deserializedFirstTx.body.messages[0].value = msg
      } else if (isMsgExecuteEncodeObject(firstMessage)) {
        msg = MsgExecuteContract.decode(firstMessage.value)
        msg.msg = JSON.parse(Buffer.from(msg.msg).toString())
        deserializedFirstTx.body.messages[0].value = msg
        // console.log('aloha msg', msg)
        d('aloha MsgExecuteContract', msg)
      }
      // hardcoded to just show the first
      const readableTxHash = toHex(txHash)
      let indexedTx: IndexedTx = await client.getTx(readableTxHash)
      indexedTx.tx = deserializedFirstTx
      const stringOfSignature = Buffer.from(indexedTx.tx.signatures[0])
      d('stringOfSignature', stringOfSignature)
      const base64OfSignature = toBase64(stringOfSignature)
      d('base64OfSignature', base64OfSignature)
      // const whatIsThisThing = decodeSignature(base64OfSignature)
      // d('whatIsThisThing', whatIsThisThing)
      // const firstSignature: StdSignature = {
      //   pub_key: decodePubkey(indexedTx.tx.authInfo.signerInfos[0].publicKey),
      //   signature: whatIsThisThing
      // }
      // d('firstSignature type', firstSignature.pub_key.type)
      // // good stuff below
      indexedTx.tx.signatures[0] = base64OfSignature
      indexedTx.tx.authInfo.signerInfos[0].publicKey.value = decodePubkey(indexedTx.tx.authInfo.signerInfos[0].publicKey)
      indexedTx.rawLog = JSON.parse(indexedTx.rawLog)

      // d('aloha', indexedTx.tx.signatures)

      setTxHashes([readableTxHash])
      // // jq with colors
      // const txDataColors = await jq.run('.', msg, { input: 'json', color: true})
      const txDataColors = await jq.run('.', indexedTx, { input: 'json', color: true})
      // const txDataColors = await jq.run('.', deserializedFirstTx, { input: 'json', color: true})
      // d('aloha txDataColors', txDataColors)
      setTxData(txDataColors)

      // setTxData(JSON.stringify(txDataColors, null, 2))
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
    screen.key(['tab', 'up', 'down', 'left', 'right'], (_, key) => navigatePane(key.name))
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
                d('aloha subtracting 1 from ', selectBlockIdx)
                return (selectBlockIdx - 1)
              } else return selectBlockIdx
            })
            break;
          case 'down':
            // Go down one unless we're at the bottom
            setSelectBlockIdx(selectBlockIdx => {
              if (selectBlockIdx < blockHeights.length - 1) {
                d('aloha adding 1 from ', selectBlockIdx)
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
                d('aloha adding 2 from ', selectBlockIdx)
                return (selectBlockIdx + 2)
              } else return selectBlockIdx
            })
            break;
        }
        break;
      case 1:
        d('pane 1: pressed ', moveDirection.direction)
        break;
    }
  }, [moveDirection])

  // This keeps the selection on the same block, for DevX
  useEffect(async () => {
    setSelectBlockIdx(selectBlockIdx => {
      // d('debugging current selectBlockIdx', selectBlockIdx)
      // d('debugging current selectBlockIdx height val', blockHeights[selectBlockIdx])
      // React sucks, or I suck, so gotta do a couple weird things
      // checkForTransactionsInBlock
      // if (blockHeights[selectBlockIdx]) await checkForTransactionsInBlock(blockHeights[selectBlockIdx])
      // if (blockHeights.length === 1) return 0
      // if (selectBlockIdx < blockHeights.length) {
      //   return (selectBlockIdx + 1)
      // } else return selectBlockIdx
      let newSelectBlockIdx
      if (blockHeights.length === 1) {
        newSelectBlockIdx = 0;
      } else if (selectBlockIdx < blockHeights.length) {
        newSelectBlockIdx = selectBlockIdx + 1
      } else {
        newSelectBlockIdx = selectBlockIdx
      }
      // setValidSelectedBlockHeight(validSelectedBlockHeight => {
      //   // const blockLabel = blockHeights[validSelectedBlockHeight]
      //   // if (!blockLabel.includes('empty')) {
      //   //   return Number(blockLabel)
      //   // }
      //   d('aloha checking', newSelectBlockIdx)
      //   return validSelectedBlockHeight
      // })

      return newSelectBlockIdx
    })
    // await checkForTransactionsInBlock(selectBlockIdx, blockHeights)
  }, [blockHeights])


  // Fires whenever:
  //  - a new block is added, and selection changes to keep focus
  //  - user pressed arrow keys
  useEffect(() => {
    // d('top of selectBlockIdx useEffect', selectBlockIdx)
    // TODO: this was helpful
    checkForTransactionsInBlock(selectBlockIdx, blockHeights)
    // setTxHashes(async txHashes => {
    //   return txHashes
    // })
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
