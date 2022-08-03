import React from "react";

export const TxDetails = ({ txData, amFocused }) => {
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
    }
  }

  return (
    <box
      label="Transaction details"
      top="30%"
      width="100%"
      height="45%"
      keys={true}
      mouse={true}
      scrollable={true}
      class={styles}>
      {txData}
    </box>
  );
};
