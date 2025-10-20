import React, { useMemo } from 'react';

type Props = {
  visible: boolean;
  rawLen: number;
  txLen: number;
  seq: number;
  clipboardyOk: boolean;
  focusedPane: number;
};

export const DebugBox: React.FC<Props> = ({
  visible,
  rawLen,
  txLen,
  seq,
  clipboardyOk,
  focusedPane
}) => {
  const hasAnomaly = useMemo(() => {
    return rawLen === 0 && txLen > 0;
  }, [rawLen, txLen]);

  const copyStatus = useMemo(() => {
    if (rawLen === 0) return '{red-fg}EMPTY{/}';
    return '{green-fg}OK{/}';
  }, [rawLen]);

  const clipStatus = useMemo(() => {
    return clipboardyOk ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
  }, [clipboardyOk]);

  if (!visible) return null as any;

  const borderColor = hasAnomaly ? 'red' : 'gray';

  // @ts-ignore blessed element
  return (
    <box
      top={1}
      right={1}
      width={20}
      height={8}
      border={{ type: 'line' }}
      label=" DEBUG "
      style={{
        border: { fg: borderColor },
        bg: 'black'
      }}
      tags={true}
    >
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={0}
        left={1}
        tags={true}
        content={`rawLen: ${rawLen}${hasAnomaly ? ' {red-fg}⚠{/}' : ''}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={1}
        left={1}
        content={`txLen: ${txLen}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={2}
        left={1}
        content={`seq: ${seq}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={3}
        left={1}
        tags={true}
        content={`copy: ${copyStatus}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={4}
        left={1}
        content={`pane: ${focusedPane}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={5}
        left={1}
        tags={true}
        content={`clip: ${clipStatus}`}
      />
      {/* @ts-ignore blessed element */}
      <text
        // @ts-ignore
        top={6}
        left={1}
        tags={true}
        content={`{gray-fg}[d] hide{/}`}
      />
    </box>
  );
};
