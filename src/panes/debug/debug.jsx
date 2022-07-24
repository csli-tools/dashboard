import React from "react";

export const Debuggah = ({ debugEntries }) => {
  const styles = {
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
      autoPadding={true}
      class={styles}>
      <list
        items={debugEntries}
        selected={0}
      />
    </box>
  );
};
