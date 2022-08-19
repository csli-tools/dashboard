import React, { useRef, useEffect, useState } from "react";
import blessed from "blessed"
import { d } from "../../services/DebugLog";

import Focus from '../../services/Focus'

interface TxHashesProps {
  txHashes: string[]
  selectTransaction: (transactionHash: string) => void
}

export const TxHashes: React.FC<TxHashesProps> = ({txHashes, selectTransaction }) => {
  const [isFocused, setIsFocused] = useState(false)

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

  const ref = useRef<blessed.Widgets.ListElement>(null)
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const focused = Focus.sharedInstance().register(ref.current, 2.0)
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



  useEffect( () => {
    if (!ref.current) {
      return
    }
    ref.current.on("select item", (item: blessed.Widgets.BlessedElement, index: number) => {
      selectTransaction(txHashes[index])
    })
  }, [txHashes])

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus()
    }
  }, [isFocused])

  return (
    <list
      keys={true}
      ref={ref}
      label="Transaction hashes"
      left="50%"
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
      items={txHashes}
    />
  );
};
