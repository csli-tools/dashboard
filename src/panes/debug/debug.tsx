import React, { useCallback, useEffect, useRef, useState } from "react"
import blessed from "blessed"

import Keybind from '../../services/Keybind'

interface DebuggahProps {
  debugEntries: any[]
  isFocused: boolean
}

export const Debuggah: React.FC<DebuggahProps> = ({ debugEntries, isFocused }) => {
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
    if (ref.current) {
      ref.current.setContent(debugEntries.join("\n"))
    }
  }, [debugEntries])
  
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
