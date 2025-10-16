import React, { useEffect, useMemo, useRef, useState } from 'react';

export type PaletteAction = {
  id: string;
  name: string;
  hint?: string;
  run: (input?: string) => Promise<void> | void;
  needsInput?: boolean; // when true, use input value as argument
};

type Props = {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
};

export const CommandPalette: React.FC<Props> = ({ open, onClose, actions }) => {
  const [sel, setSel] = useState(0);
  const listRef = useRef<any>(null);
  const boxRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setSel(0);
    const el = listRef.current;
    try { el?.focus(); } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;

    const handler = (_ch: any, key: any) => {
      if (key.name === 'escape' || key.full === 'q') {
        onClose();
      } else if (key.name === 'enter' || key.name === 'return') {
        const act = actions[sel];
        if (act) {
          act.run();
          onClose();
        }
      }
      try { (el.screen as any).render(); } catch {}
    };

    try { el.key(['escape','enter','return','q'], handler); } catch {}
    return () => { try { el.removeKey(['escape','enter','return','q'], handler); } catch {} };
  }, [open, sel, actions, onClose]);

  if (!open) return null as any;

  // @ts-ignore
  return (
    <box
      ref={boxRef}
      top="center" left="center" width="70%" height="60%"
      border={{ type: 'line' }} label=" Command Palette (Ctrl+K) - Use arrows, Enter to select "
      keys={true} mouse={true} vi={true}
      style={{ border: { fg: 'magenta' }, bg: 'black' }}
    >
      {/* @ts-ignore blessed element */}
      <list
        ref={listRef}
        top={1} left={1} right={1} bottom={1}
        keys={true} mouse={true} vi={true}
        items={actions.map(a => `${a.name}${a.hint ? ` — ${a.hint}` : ''}`)}
        style={{ selected: { inverse: true }, item: { bg: 'black' } }}
      />
    </box>
  );
};
