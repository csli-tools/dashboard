import React, { useEffect, useState, useRef } from 'react'
import blessed from 'blessed'

import Config from '../../services/Config'
import Focus from '../../services/Focus'
import { d } from '../../services/DebugLog'

interface QueryPickerProps {
  selectedContractAddress?: string
  selectQuery: (query: string) => void
}

const QueryPicker: React.FC<QueryPickerProps> = ({selectedContractAddress, selectQuery}) => {
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
  
  const [queries, setQueries] = useState<string[]>([])
  
  useEffect(() => {
    if (selectedContractAddress === undefined) {
      return
    }
    const contracts = Config.sharedInstance().config?.contracts
    if (!contracts) {
      return
    }
    const selectedContract = contracts[selectedContractAddress]
    if (!selectedContract) {
      return
    }
    setQueries(selectedContract.queries.map((query: any) => query.name))
  }, [selectedContractAddress])
  
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
  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    ref.current.on("select item", (item: blessed.Widgets.BlessedElement, index: number) => {
      selectQuery(queries[index])
    })
    if (queries && queries.length) {
      selectQuery(queries[0])
    }
  }, [queries, selectQuery])

  
  return (
    <list
      label="Queries"
      ref={ref}
      width="33%"
      height="30%"
      left="33%"
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
      items={queries}
    />
  )

}

export default QueryPicker