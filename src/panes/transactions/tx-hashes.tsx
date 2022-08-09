import React from "react";
import blessed from "blessed"

interface TxHashesProps {
  txHashes: any
  selectTxIdx: any
  isFocused: boolean
}

export const TxHashes: React.FC<TxHashesProps> = ({txHashes, selectTxIdx, isFocused }) => {
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

  return (
    <box
      keys={true}
      label="Transaction hashes"
      left="50%"
      width="50%"
      height="30%"
      class={styles}>
      <list
        style={
          {
            selected: {
              bg: 'blue',
              bold: true
            }
          }
        }
        keys={true}
        items={txHashes}
        selected={selectTxIdx}
      />
    </box>
  );
};
