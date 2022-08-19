import React, { useState, useRef, useEffect } from "react"
import blessed from "blessed"

import Focus from '../../services/Focus'

interface ContractStateProps {
  stateData: any
}

const ContractState: React.FC<ContractStateProps> = ({ stateData }) => {
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
  }

  const ref = useRef<blessed.Widgets.BoxElement>(null)
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const focused = Focus.sharedInstance().register(ref.current, 4.0)
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

  return (
    <box
      label="Contract State"
      ref={ref}
      top="30%"
      width="100%"
      height="45%"
      keys={true}
      scrollable={true}
      class={styles}>
      {stateData}
    </box>
  )
}

export default ContractState
