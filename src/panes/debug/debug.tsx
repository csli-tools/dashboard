import React, { useEffect, useRef } from "react"
import blessed from "blessed"

import DebugLog from "../../services/DebugLog"

interface DebuggahProps {
  isFocused: boolean
}

export const Debuggah: React.FC<DebuggahProps> = ({ isFocused }) => {
  const styles: any = {
    border: {
      type: 'line',
      bottom: null,
      right: null,
    },
    style: {
      border: {
        fg: 'blue',
        bg: isFocused ? 'yellow' : null
      },

    },
    scrollbar: {
      bg: 'blue',
    },
    padding: {
      left: 1,
      right: 1,
      top: 0,
      bottom: 0
    }
  }

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus()
    }
  }, [isFocused])

  useEffect(() => {
    const listener = (log: string, messages: string[]) => {
      if (ref.current) {
        ref.current.setContent(messages.join("\n"))
      }
    }
    DebugLog.sharedInstance().emitter.on("log", listener)
    if (ref.current) {
      ref.current.setContent(DebugLog.sharedInstance().debugEntries.join("\n"))
    }
    return () => {
      DebugLog.sharedInstance().emitter.removeListener("log", listener)
    }
  }, [])
  
  const ref = useRef<blessed.Widgets.Log>(null)
    
  return (
    <log
      label="Debugger"
      ref={ref}
      top="75%"
      width="100%"
      height="25%"
      scrollOnInput={true}
      focusable={true}
      keys={true}
      class={styles}>
        
    </log>
  );
};
