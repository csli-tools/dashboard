import React, { useCallback, useEffect, useRef, useState } from "react"
import blessed from "blessed"

import BlockDetails from "../../model/BlockDetails"
import Keybind from '../../services/Keybind'

interface BlockDetailsPaneProps {
  blockHeights: BlockDetails[]
  isFocused: boolean
  selectBlock: (block: BlockDetails) => void
  ownedCounts?: Map<number, number>
  focusedPane: number
}

const BlockDetailsPane: React.FC<BlockDetailsPaneProps> = ({blockHeights, isFocused, selectBlock, ownedCounts, focusedPane }) => {
  
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined)
  const borderConfig: any = {
    type: 'line',
    bottom: false,
    right: null,
  }

  const padding = {
    left: 1,
    right: 1,
    top: 0,
    bottom: 0
  }
  
  const blockIndex = useCallback((block: BlockDetails): number | undefined => {
    const index = blockHeights.indexOf(block)
    return index >= 0 ? index : undefined
  }, [blockHeights])
  
  const handleArrowKeys = useCallback((key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!isFocused) {
      return
    }
    if (!ref.current) {
      return
    }
    if (blockHeights.length === 0) {
      return
    }
    if (key.name !== "up" && key.name !== "down") {
      return
    }
    
    if (!blockRef.current) {
      return
    }
    
    let index: number
    const selectedBlockIndex = blockIndex(blockRef.current) // use a reference here so we don't end up in an infinite loop with selectedBlock and selectedIndex updating eachother indefinitely
    if (selectedBlockIndex === undefined) {
      return
    }
    if (key.name === "up") {
      index = Math.max(0, selectedBlockIndex - 1)
    } else {
      index = Math.min(blockHeights.length - 1, selectedBlockIndex + 1)
    }
    setSelectedIndex(index)
    setSelectedBlock(blockHeights[index])
    selectBlock(blockHeights[index])
    ref.current.select(index)    
  }, [selectedIndex, blockHeights, isFocused]);
  
  const blockRef = useRef(selectedBlock)
  useEffect(() => {
    blockRef.current = selectedBlock
  }, [selectedBlock])
  
  // Track the previous blockHeights length to detect new blocks
  const prevBlockHeightsLength = useRef(blockHeights.length)

  useEffect(() => {
    if (!ref.current || blockHeights.length === 0) {
      return
    }

    // Only auto-select on first load (when we don't have a selected block yet)
    if (!blockRef.current) {
      setSelectedIndex(0)
      setSelectedBlock(blockHeights[0])
      selectBlock(blockHeights[0])
      prevBlockHeightsLength.current = blockHeights.length
      return
    }

    // Only run this logic when NEW blocks arrive (array grows)
    // Don't run when selectedIndex changes due to arrow keys
    const newBlocksArrived = blockHeights.length > prevBlockHeightsLength.current
    if (!newBlocksArrived) {
      prevBlockHeightsLength.current = blockHeights.length
      return
    }
    prevBlockHeightsLength.current = blockHeights.length

    // Check if user is viewing the latest block (index 0)
    const currentIndex = blockIndex(blockRef.current)
    const isViewingLatest = currentIndex === 0

    if (isViewingLatest) {
      // "Live mode" - always show the newest block
      // When new blocks arrive, keep selection at index 0
      setSelectedBlock(blockHeights[0])
      selectBlock(blockHeights[0])
      ref.current.select(0)
    } else {
      // "History browsing mode" - maintain selection on the same block object
      // When new blocks arrive, find where our selected block moved to
      const index = blockIndex(blockRef.current)
      if (index !== undefined) {
        // Block is still in the list, update the index position
        setSelectedIndex(index)
        ref.current.select(index)
      } else {
        // Block was dropped from the list (fell off the 100-block limit)
        // Move selection to the oldest available block
        const oldestIndex = blockHeights.length - 1
        setSelectedIndex(oldestIndex)
        setSelectedBlock(blockHeights[oldestIndex])
        selectBlock(blockHeights[oldestIndex])
        ref.current.select(oldestIndex)
      }
    }
  }, [blockHeights, blockIndex, selectBlock])
  
  const handleArrowKeysRef = useRef(handleArrowKeys)
  useEffect(() => {
    handleArrowKeysRef.current = handleArrowKeys
  }, [handleArrowKeys])
  
  useEffect(() => {
    const handler = (key: blessed.Widgets.Events.IKeyEventArg) => {
      handleArrowKeysRef.current(key)
    }

    Keybind.sharedInstance().emitter.on("key", handler)

    // Cleanup: remove event listener on unmount
    return () => {
      Keybind.sharedInstance().emitter.off("key", handler)
    }
  }, [])
  
  const ref = useRef<blessed.Widgets.ListElement>(null)

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus()
    }
  }, [isFocused])

  // Update border style imperatively when focus changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.style.border.bg = isFocused ? 'yellow' : undefined;
      // Restore selection after render to prevent losing the selected index
      el.select(selectedIndex);
      (el.screen as any).render();
    } catch {}
  }, [isFocused, selectedIndex]);

  const label = focusedPane === 0 ? " Blocks - Press 'c' to copy block txs " : "Blocks";

  return (
      <list
        label={label}
        width="50%"
        height="30%"
        border={borderConfig}
        padding={padding}
        style={{
          border: {
            fg: '#eb5367',
            bg: isFocused ? 'yellow' : undefined
          },
          selected: {
            bg: 'blue',
            bold: true
          }
        }}
        scrollable={true}
        ref={ref}
        focusable={true}
        items={blockHeights.map(details => {
          const date = details.timestamp ? new Date(details.timestamp).toLocaleTimeString() : ''
          const txCount = details.transactions.length
          const owned = ownedCounts?.get(details.height) || 0
          const ownedBadge = owned > 0 ? ` ★${owned}` : ''
          return `${details.height} | ${date} | ${txCount} txs${ownedBadge}`
        })}
      />

  );
};

export default React.memo(BlockDetailsPane)