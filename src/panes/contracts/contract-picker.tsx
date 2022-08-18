import React, { useEffect, useState, useRef } from 'react'
import blessed from 'blessed'

import Config from '../../services/Config'
import Focus from '../../services/Focus'

interface ContractPickerProps {
  setSelectedContractAddress: (address: string | undefined) => void
}

const ContractPicker: React.FC<ContractPickerProps> = ({setSelectedContractAddress}) => {
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
    ref.current.on("select item", (item: blessed.Widgets.BlessedElement, index: number) => {
      if (!Config.sharedInstance().config?.contracts) {
        return
      }
      let contracts = Object.keys(Config.sharedInstance().config.contracts)
      if (!contracts.length) {
        return
      }
      setSelectedContractAddress(contracts[index])
    })
    return () => {
      Focus.sharedInstance().unregister(focused)
    }
  }, [])
  
  // since there's seemingly no way to have a `list` have an undefined selection state prior to user interaction
  useEffect(() => {
    if (!Config.sharedInstance().config?.contracts) {
      return
    }
    let contracts = Object.keys(Config.sharedInstance().config.contracts)
    if (!contracts.length) {
      return
    }
    setSelectedContractAddress(contracts[0])
  }, [])

  
  return (
    <list
      label="Contracts"
      ref={ref}
      width="33%"
      height="30%"
      keys={true}
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