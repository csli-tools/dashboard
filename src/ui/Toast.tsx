import React from 'react';

export type ToastLevel = 'info' | 'warn' | 'error';
export type Toast = { id: number; text: string; level: ToastLevel };

type Props = { toasts: Toast[] };

export const Toasts: React.FC<Props> = ({ toasts }) => {
  if (!toasts.length) return null as any;
  // stack up to 3 recent toasts at center
  const recent = toasts.slice(-3);
  // @ts-ignore
  return (
    <box
      top="center"
      left="center"
      width="30%"
      height={recent.length + 2}
      border={{ type: 'line' }}
      style={{
        bg: 'black',
        border: { fg: 'green' }
      }}
    >
      {recent.map((t, i) => {
        const color = t.level === 'error' ? 'red' : t.level === 'warn' ? 'yellow' : 'green';
        // @ts-ignore
        return <text key={t.id} top={i} left="center" style={{ fg: color }} content={` ${t.text} `} />;
      })}
    </box>
  );
};
