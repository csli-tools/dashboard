import React from "react";

interface TxDetailsProps {
  txData: any
  isFocused: boolean
}
export const TxDetails: React.FC<TxDetailsProps> = ({ txData, isFocused }) => {
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
