import React from "react";

export const BlockDetails = ({blockHeights, selectBlockIdx, amFocused }) => {
  const styles = {
    border: {
      type: 'line'
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
      label="Blocks"
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
        items={blockHeights}
        selected={selectBlockIdx}
        scroll={selectBlockIdx}
      />
    </box>
  );
};
