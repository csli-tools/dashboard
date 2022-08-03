import React from "react";

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
      label="Debugger"
      top="75%"
      width="100%"
      height="25%"
      scrollable={true}
      class={styles}>
      <list
        items={debugEntries}
        selected={0}
      />
    </box>
  );
};
