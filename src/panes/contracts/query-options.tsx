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
  sendQuery: (json: any) => void
}

const QueryOptions: React.FC<QueryOptionsProps> = ({query, sendQuery}) => {
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
      ref.current.scrollTo(0)
    }
    if (!query) {
      return
    }
    try {
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
      const tabIndexOffset = 1.0 / (2.0 + (query.mandatory?.length ?? 0) + (query.optional?.length ?? 0))
      let tabIndex = 3.0
  
      const buildInputUI = (parameter: any, index: number): {parameter: any, textbox: blessed.Widgets.TextboxElement} => {
        let inputs: {parameter: any, textbox: blessed.Widgets.TextboxElement}[] = []
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
        textbox.on("keypress", (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
          if (key.name === "tab") {
            (textbox as any)._done(null, textbox.value) // gotta call this undocument/private method in blessed to actually commit the typed characters
            textbox.emit('keypress', '\x1b', { name: 'escape' }); //simulate esc press to release focus
            if (key.shift) {
              Focus.sharedInstance().focusPrevious()
            } else {
              Focus.sharedInstance().focusNext()
            }
          }
        })
        const capturedOffset = offset
        textbox.on("focus", () => {
          setIsFocused(true)
          ref.current?.scrollTo(capturedOffset - 1) // subtract 1 so we always see the label too
        })

        offset++
        return {parameter, textbox}
      }
      let allInputs: {parameter: any, textbox: blessed.Widgets.TextboxElement}[] = []
      if (query.mandatory) {
        blessed.text({
          parent: form,
          top: "0%+" + offset,
          content: "Mandatory Parameters:"
        })
        offset++
        const mandatoryInputs = query.mandatory.map(buildInputUI)
        allInputs = [...allInputs, ...mandatoryInputs]
      }
      if (query.optional) {
        blessed.text({
          parent: form,
          top: "0%+" + offset,
          content: "Optional Parameters:"
        })
        offset++
        const optionalInputs = query.optional.map(buildInputUI)
        allInputs = [...allInputs, ...optionalInputs]
      }
      if (query.mandatory || query.optional) {
        const button = blessed.button({
          parent: form,
          top: "0%+" + offset,
          content: "Search",
          border: {
            type: 'line'
          },
          width: "shrink",
          style: {
            focus: {
              border: {
                fg: "magenta"
              }
            }
          }
        })
        button.on("focus", () => {
          setIsFocused(true)
          ref.current?.scrollTo(offset + 3)
        })
        button.on("blur", () => {
          setIsFocused(false)
        })
        button.on("press", () => {
          if (!ref.current) {
            return
          }
          let json: any = {}
          json[query.key] = {}
          allInputs.forEach(input => {
            let stringValue = input.textbox.getValue()
            let value: any
            if (input.parameter.valueType === "number") {
              value = parseFloat(stringValue)
            } else {
              value = stringValue
            }
            json[query.key][input.parameter.key] = value
            sendQuery(json)
          })
          
        })
        tabIndex += tabIndexOffset
        elementFocusRefs.push(Focus.sharedInstance().register(button, tabIndex))
        offset += 3
        blessed.text({
          parent: form,
          top: "0%+" + offset,
          content: " "
        })
      }
      setInputElementFocusRefs(elementFocusRefs)
    } catch (error) {
      d(error)
    }
  }, [query, previousQuery, inputElementFocusRefs, sendQuery])
  
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
      inputElementFocusRefs.map(element => Focus.sharedInstance().unregister(element))
    }
  }, [inputElementFocusRefs])

  

  return (
    <box
      ref={ref}
      keys={true}
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