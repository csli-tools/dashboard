import React from "react";

export const TxHashes = ({txHashes, selectTxIdx, amFocused }) => {
  const styles = {
    border: {
      type: 'line',
      bottom: null,
      right: null,
    },
    style: {
      border: {
        fg: '#eb5367',
        bg: amFocused ? 'yellow' : null
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
      autoPadding={true}
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
