import React, { useEffect, useState, useRef } from 'react'
import blessed from 'blessed'

import Config from '../../services/Config'
import Focus from '../../services/Focus'

interface ContractPickerProps {

}

const ContractPicker: React.FC<ContractPickerProps> = () => {
  const [isFocused, setIsFocused] = useState(false)
  const [contracts, setContracts] = useState<string[]>(Config.sharedInstance().config?.contracts ? Object.keys(Config.sharedInstance().config.contracts) : [])

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

  
  return (
    <list
      label="Contracts"
      ref={ref}
      width="33%"
      height="30%"
      style={
        {
          selected: {
            bg: 'blue',
            bold: true
          }
        }
      }
      scrollable={true}
      focusable={true}
      class={styles}
      items={contracts}
    />
  )

}

export default ContractPicker