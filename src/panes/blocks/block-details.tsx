import React from "react";

interface BlockDetailsProps {
  blockHeights: any
  selectBlockIdx: any
  isFocused: boolean
}

export const BlockDetails: React.FC<BlockDetailsProps> = ({blockHeights, selectBlockIdx, isFocused }) => {
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
      label="Blocks"
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
        items={blockHeights}
        selected={selectBlockIdx}
      />
    </box>
  );
};
