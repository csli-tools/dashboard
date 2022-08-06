import React, { useCallback, useEffect, useRef, useState } from "react"
import blessed from "blessed"

import BlockDetails from "../../model/BlockDetails"
import Keybind from '../../services/Keybind'

interface BlockDetailsPaneProps {
  blockHeights: BlockDetails[]
  isFocused: boolean
}

const BlockDetailsPane: React.FC<BlockDetailsPaneProps> = ({blockHeights, isFocused }) => {
  
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
    if (selectedIndex === undefined) {
      setSelectedIndex(0)
      setSelectedBlock(blockHeights[0])
      return
    }
    let index: number
    if (key.name === "up") {
      index = Math.max(0, selectedIndex - 1)
    } else {
      index = Math.min(blockHeights.length, selectedIndex + 1)
    }
    setSelectedIndex(index)
    setSelectedBlock(blockHeights[index])
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
    Keybind.sharedInstance().emitter.on("key", (key: blessed.Widgets.Events.IKeyEventArg) => {
      handleArrowKeysRef.current(key)
    })
  }, [])
  
  const ref = useRef<blessed.Widgets.ListElement>(null)

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus()
    }
  }, [isFocused])
  
  return (
      <list
        label="Blocks"
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
        keys={true}
        items={blockHeights.map(details => `${details.height} ${details.transactions.length === 0 ? '(empty)' : ''}`)}
      />
    
  );
};

export default BlockDetailsPane