import React, { useCallback, useEffect, useRef, useState } from "react"
import blessed from "blessed"

import BlockDetails from "../../model/BlockDetails"
import Keybind from '../../services/Keybind'
import Focus from '../../services/Focus'
import { d } from '../../services/DebugLog'

interface BlockDetailsPaneProps {
  blockHeights: BlockDetails[]
  selectBlock: (block: BlockDetails) => void
}

const BlockDetailsPane: React.FC<BlockDetailsPaneProps> = ({blockHeights, selectBlock }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [selectedBlock, setSelectedBlock] = useState<BlockDetails | undefined>(undefined)
  const styles: any = {
    border: {
      type: 'line',
      bottom: null,
      right: null,
    },
    style: {
      border: {
        fg: '#eb5367',
        bg: isFocused ? 'yellow' : null
      }
    },
    padding: {
      left: 1,
      right: 1,
      top: 0,
      bottom: 0
    }
  }
  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const focused = Focus.sharedInstance().register(ref.current, 1.0)
    ref.current.on("focus", () => {
      setIsFocused(true)
    })
    ref.current.on("blur", () => {
      setIsFocused(false)
    })
    return () => {
      Focus.sharedInstance().unregister(focused)
    }
  }, [])
  
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
      index = Math.min(blockHeights.length, selectedBlockIndex + 1)
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
  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    if (!blockRef.current) {
      setSelectedIndex(0)
      setSelectedBlock(blockHeights[0])
      selectBlock(blockHeights[0])
      return
    }
    const index = blockIndex(blockRef.current) // use a reference here so we don't end up in an infinite loop with selectedBlock and selectedIndex updating eachother indefinitely
    if (index === undefined) {
      return
    }
    setSelectedIndex(index)
    ref.current.select(index)
  }, [blockHeights, blockIndex])
  
  const handleArrowKeysRef = useRef(handleArrowKeys)
  useEffect(() => {
    handleArrowKeysRef.current = handleArrowKeys
  }, [handleArrowKeys])
  
  useEffect(() => {
    const listener = (key: blessed.Widgets.Events.IKeyEventArg) => {
      handleArrowKeysRef.current(key)
    }
    Keybind.sharedInstance().emitter.on("key", listener)
    return () => {
      Keybind.sharedInstance().emitter.removeListener("key", listener)
    }
  }, [])
  
  const ref = useRef<blessed.Widgets.ListElement>(null)

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus()
    }
  }, [isFocused])
  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    ref.current.on("select item", (item: blessed.Widgets.BlessedElement, index: number) => {
      setSelectedBlock(blockHeights[index])
      selectBlock(blockHeights[index])
    })
  }, [selectBlock])
  
  if (!blockHeights) {
    return null
  }
  return (
    <list
      label="Blocks"
      keys={true}
      width="50%"
      height="30%"
      class={styles}
      style={
        {
          selected: {
            bg: 'blue',
            bold: true
          }
        }
      }
      scrollable={true}
      ref={ref}
      focusable={true}
      items={blockHeights.map(details => `${details.height} ${details.transactions.length === 0 ? '(empty)' : ''}`)}
    />
  );
};

export default BlockDetailsPane