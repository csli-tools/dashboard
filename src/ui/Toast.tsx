import React, { useState, useEffect } from 'react';

export type ToastLevel = 'info' | 'warn' | 'error';
export type Toast = { id: number; text: string; level: ToastLevel; createdAt: number };

type Props = { toasts: Toast[] };

export const Toasts: React.FC<Props> = ({ toasts }) => {
  const [, setTick] = useState(0);

  // Re-render every 100ms to update fade effects
  // This is acceptable overhead for 1-3 active toasts
  // Total render cost: ~23 renders per toast lifetime (2.3s ÷ 0.1s)
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(timer);
  }, [toasts.length]);

  if (!toasts.length) return null as any;

  const now = Date.now();
  const recent = toasts.slice(-3);

  // @ts-ignore
  return (
    <box
      top="center"
      left="center"
      width="50%"
      height={recent.length + 2}
      border={{ type: 'line' }}
      style={{
        bg: 'black',
        border: { fg: 'green' }
      }}
    >
      {recent.map((t, i) => {
        const age = now - t.createdAt;
        const lifetime = 2300; // matches setTimeout in pushToast

        // Fade in: first 200ms (0-200ms) use bright colors
        // Steady: middle period (200-2000ms) use normal colors
        // Fade out: last 300ms (2000-2300ms) use dim colors
        let colorPrefix = '';
        if (age < 200) {
          colorPrefix = 'bright'; // fade in with bright colors
        } else if (age > 2000) {
          colorPrefix = 'light'; // fade out with light/dim colors
        }

        const baseColor = t.level === 'error' ? 'red' : t.level === 'warn' ? 'yellow' : 'green';
        const color = colorPrefix ? `${colorPrefix}${baseColor}` : baseColor;

        // @ts-ignore
        return <text key={t.id} top={i} left={0} right={0} align="center" style={{ fg: color }} content={` ${t.text} `} />;
      })}
    </box>
  );
};
