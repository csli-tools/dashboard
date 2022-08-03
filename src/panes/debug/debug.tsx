import React from "react";

interface DebuggahProps {
  debugEntries: any[]
}

export const Debuggah: React.FC<DebuggahProps> = ({ debugEntries }) => {
  const styles: any = {
    border: {
      type: 'line',
      bottom: null,
      right: null,
    },
    style: {
      border: {
        fg: 'blue',
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
      class={styles}>
      <list
        items={debugEntries}
        selected={0}
      />
    </box>
  );
};
