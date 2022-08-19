import React, { useState, useCallback, useEffect, useRef } from 'react'
import blessed from 'blessed'
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { Server } from 'ws'

import Dashboard from './battle-station'
import Contracts from './contracts'
import Keybind from './services/Keybind'
import Focus from './services/Focus'
import { d } from './services/DebugLog'

interface DashboardProps {
  screen: blessed.Widgets.Screen
  client: CosmWasmClient
  wss: Server
}

enum Tab {
  TransactionDashboard,
  ContractDashboard
}

interface TabDetails {
  tab: Tab
  title: string
}

const ALL_TABS: TabDetails[] = [
  {
    tab: Tab.TransactionDashboard,
    title: "Transactions"
  },
  {
    tab: Tab.ContractDashboard,
    title: "Contracts"
  },
]
// this feels like exceptionally bad design, but blessed doesn't seem to have any way to bind keys via keycode, 
// so this is mega fragile. Will likely not work as expected in non english/non qwerty keyboard layouts.
const SHIFT_NUMBER_KEYS = ["!", "@", "#", "$", "%", "^", "&", "8", "9", "0"]

export const TabView: React.FC<DashboardProps> = ({screen, client, wss }) => {
  const [selectedTab, setSelectedTab] = useState<Tab>(Tab.TransactionDashboard)
  
  const handleArrowKeys = useCallback((key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name && key.name === "tab") {
      if (key.shift) {
        Focus.sharedInstance().focusPrevious()
      } else {
        Focus.sharedInstance().focusNext()
      }
      return
    }
    //a blessed bug causes an incorrect return type for number keys
    if (!SHIFT_NUMBER_KEYS.includes((key as any).ch)) {
      return
    }
    
    const keyNum = SHIFT_NUMBER_KEYS.indexOf((key as any).ch)
    setSelectedTab(keyNum)
  }, [selectedTab])
  
  
  const handleArrowKeysRef = useRef(handleArrowKeys)
  useEffect(() => {
    handleArrowKeysRef.current = handleArrowKeys
  }, [handleArrowKeys])
  
  useEffect(() => {
    screen.key(["tab", "S-tab"].concat(ALL_TABS.map((_, index) => SHIFT_NUMBER_KEYS[index])), (_, key) => {Keybind.sharedInstance().keyPressed(key)})
  }, [])
  
  useEffect(() => {
    const listener = (key: blessed.Widgets.Events.IKeyEventArg) => {
      handleArrowKeysRef.current(key)
    }
    Keybind.sharedInstance().emitter.on("key", listener)
    return () => {
      Keybind.sharedInstance().emitter.removeListener('key', listener)
    }
  }, [])
  
  return (
    <React.Fragment>
      <box
        width="100%"
        height="0%+2"
      >
        {ALL_TABS.map((key, index) => {
          return (
            <box
              key={key.title}
              width={`0%+${Math.max(10, key.title.length)}`}
              height="0%+2"
              left={`0%+${ALL_TABS.slice(0, index).reduce((prev, current) => prev + Math.max(10, current.title.length) + 2, 2)}`}
            >
              {key.title + ` (shift-${index + 1})`}
            </box>
          )
        })}
      </box>
      <box
        width="100%"
        height="0%+1"
        top="0%+2"
        bg="magenta"
      />
      <box 
        width="100%"
        height="100%-3"
        top="0%+3"
      > 
        {selectedTab === Tab.TransactionDashboard &&
          <Dashboard
            screen={screen}
            client={client}
            wss={wss}
          />
        }
        {selectedTab === Tab.ContractDashboard &&
          <Contracts
            screen={screen}
            client={client}
            wss={wss}
          />
        }
      </box>
    </React.Fragment>
  )
}

export default TabView