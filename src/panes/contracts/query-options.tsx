import React, { useEffect, useState, useRef, useCallback } from 'react'
import { isDeepStrictEqual } from 'util'
import blessed from 'blessed'

import Config from '../../services/Config'
import Keybind from '../../services/Keybind'
import Focus from '../../services/Focus'
import { d } from '../../services/DebugLog'
import { usePrevious } from '../../utils/react'

interface QueryOptionsProps {
  query: any
}

const QueryOptions: React.FC<QueryOptionsProps> = ({query}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [inputElementFocusRefs, setInputElementFocusRefs] = useState<string[]>([])

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
  const previousQuery = usePrevious(query)
  const ref = useRef<blessed.Widgets.BoxElement>(null)  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    if (isDeepStrictEqual(query, previousQuery)) {
      return
    }
    
    // our query has changed, clean up after the old form
    if (ref.current.children.length > 1) {
      const children = [...ref.current.children.slice(1)]
      children.forEach(child => {
        ref.current!.remove(child)
      })
      inputElementFocusRefs.map(element => Focus.sharedInstance().unregister(element))
    }
    
    const form = blessed.form({
      parent: ref.current,
      focusable: true,
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
    })
    let offset = 0
    let elementFocusRefs: string[] = []
    const tabIndexOffset = 1.0 / (1.0 + (query.mandatory?.length ?? 0) + (query.optional?.length ?? 0))
    let tabIndex = 3.0
    if (query.mandatory) {
      
    }
    if (query.optional) {
      offset += query.mandatory && query.mandatory.length > 0 ? 1 + 2 * query.mandatory.length : 0
      blessed.text({
        parent: form,
        top: "0%+" + offset,
        content: "Optional Parameters:"
      })
      offset++
      query.optional.forEach((parameter: any, index: number) => {
        blessed.text({
          parent: form,
          top: "0%+" + offset,
          content: parameter.key
        })
        offset++
        const textbox = blessed.textbox({
          parent: form,
          top: "0%+" + offset,
          inputOnFocus: true,
          keys: true,
          focusable: true
        })
        tabIndex += tabIndexOffset
        elementFocusRefs.push(Focus.sharedInstance().register(textbox, tabIndex))
        textbox.on("keypress", (ch: any, key: blessed.Widgets.Events.IKeyEventArg) => {
          if (key.name === "tab") {
            // Workaround, since we can't stop the tab from being added.
            textbox.emit('keypress', null, { name: 'backspace' });
            textbox.emit('keypress', '\x1b', { name: 'escape' });
            if (key.shift) {
              Focus.sharedInstance().focusPrevious()
            } else {
              Focus.sharedInstance().focusNext()
            }
          }
        })
        textbox.on("focus", () => {
          setIsFocused(true)
        })
        offset++
      })
    }
    setInputElementFocusRefs(elementFocusRefs)
  }, [query, previousQuery, inputElementFocusRefs])
  
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const focused = Focus.sharedInstance().register(ref.current, 3.0)
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
    return () => {
      d("destroy")
      inputElementFocusRefs.map(element => Focus.sharedInstance().unregister(element))
    }
  }, [inputElementFocusRefs])

  

  return (
    <box
      ref={ref}
      label="Query Options"
      width="34%"
      height="30%"
      left="66%"
      scrollable={true}
      focusable={true}
      class={styles}
    />
  )

}

export default QueryOptions