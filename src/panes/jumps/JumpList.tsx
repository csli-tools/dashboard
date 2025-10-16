import React, { useEffect, useRef, useState } from 'react';
import { Mark } from '../../services/jump-marks';

type Props = {
  open: boolean;
  marks: Mark[];
  onClose: () => void;
  onJump: (label: string) => Promise<void>;
  onRemove: (label: string) => Promise<void>;
  onTogglePin: (label: string) => Promise<void>;
};

export const JumpList: React.FC<Props> = ({ open, marks, onClose, onJump, onRemove, onTogglePin }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = async (_ch: any, key: any) => {
      if (!open) return;

      if (key.name === 'up') {
        setSelectedIndex(i => Math.max(0, i - 1));
      } else if (key.name === 'down') {
        setSelectedIndex(i => Math.min(marks.length - 1, i + 1));
      } else if (key.name === 'enter') {
        const mark = marks[selectedIndex];
        if (mark) await onJump(mark.label);
      } else if (key.name === 'd') {
        const mark = marks[selectedIndex];
        if (mark) await onRemove(mark.label);
      } else if (key.name === 'p') {
        const mark = marks[selectedIndex];
        if (mark) await onTogglePin(mark.label);
      } else if (key.name === 'escape' || key.full === 'q') {
        onClose();
      }

      try { (el.screen as any).render(); } catch {}
    };

    try { el.key(['up', 'down', 'enter', 'd', 'p', 'escape', 'q'], handler); } catch {}
    return () => { try { el.removeKey(['up', 'down', 'enter', 'd', 'p', 'escape', 'q'], handler); } catch {} };
  }, [open, marks, selectedIndex, onJump, onRemove, onTogglePin, onClose]);

  if (!open) return null as any;

  const items = marks.map((m, i) => {
    const prefix = i === selectedIndex ? '> ' : '  ';
    const pin = m.pinned ? '★ ' : '  ';
    const blockInfo = m.blockHeight ? `#${m.blockHeight}` : '';
    const txInfo = m.txHash ? ` tx:${m.txHash.slice(0, 8)}…` : '';
    return `${prefix}${pin}[${m.label}] ${blockInfo}${txInfo}`;
  });

  // @ts-ignore
  return (
    <list
      ref={ref}
      label=" Marks (Enter: jump · p: pin · d: delete · Esc: close) "
      top="center"
      left="center"
      width="80%"
      height="80%"
      border={{ type: 'line' }}
      style={{ border: { fg: 'yellow' }, selected: { bg: 'blue' } }}
      keys={true}
      mouse={true}
      vi={true}
      scrollable={true}
      items={items}
      selected={selectedIndex}
    />
  );
};
