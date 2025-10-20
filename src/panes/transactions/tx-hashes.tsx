import React, { useCallback, useEffect, useRef, useState } from "react";
import blessed from "blessed"
import Keybind from '../../services/Keybind'

interface TxHashesProps {
  txHashes: string[]
  isFocused: boolean
  selectTxHash: (txHash: string, index: number) => void
  focusedPane: number
}

export const TxHashes: React.FC<TxHashesProps> = ({txHashes, isFocused, selectTxHash, focusedPane }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
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

  const handleArrowKeys = useCallback((key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!isFocused) {
      return
    }
    if (!ref.current) {
      return
    }
    if (txHashes.length === 0) {
      return
    }
    if (key.name !== "up" && key.name !== "down") {
      return
    }

    let index: number
    if (key.name === "up") {
      index = Math.max(0, selectedIndex - 1)
    } else {
      index = Math.min(txHashes.length - 1, selectedIndex + 1)
    }
    setSelectedIndex(index)
    selectTxHash(txHashes[index], index)
    ref.current.select(index)
  }, [selectedIndex, txHashes, isFocused, selectTxHash])

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
    const el = ref.current?.parent as any;
    if (!el) return;
    try {
      el.style.border.bg = isFocused ? 'yellow' : undefined;
      (el.screen as any).render();
    } catch {}
  }, [isFocused]);

  // Adjust selection when txHashes change (only if current selection is out of bounds)
  useEffect(() => {
    if (txHashes.length === 0) {
      return
    }

    // If current selection is still valid, keep it
    if (selectedIndex < txHashes.length) {
      selectTxHash(txHashes[selectedIndex], selectedIndex)
      if (ref.current) {
        ref.current.select(selectedIndex)
      }
      return
    }

    // If out of bounds, reset to last valid index
    const newIndex = txHashes.length - 1
    setSelectedIndex(newIndex)
    selectTxHash(txHashes[newIndex], newIndex)
    if (ref.current) {
      ref.current.select(newIndex)
    }
  }, [txHashes, selectedIndex, selectTxHash])

  const label = focusedPane === 1 ? " Transaction hashes - Press 'c' to copy tx (raw + human) " : "Transaction hashes";

  return (
    <box
      keys={true}
      label={label}
      left="50%"
      width="50%"
      height="30%"
      border={borderConfig}
      padding={padding}
      style={{
        border: {
          fg: '#eb5367',
          bg: isFocused ? 'yellow' : undefined
        }
      }}>
      <list
        ref={ref}
        style={{
          selected: {
            bg: 'blue',
            bold: true
          }
        }}
        keys={false}
        focusable={true}
        scrollable={true}
        items={txHashes}
        selected={selectedIndex}
      />
    </box>
  );
};
