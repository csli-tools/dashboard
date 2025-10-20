import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: string) => void;
  autopin: boolean;
  onToggleAutopin: () => void;
};

function classify(input: string): { kind: 'tx'|'block'|'account'|'unknown'; payload?: string|number } {
  const s = input.trim();
  if (!s) return { kind: 'unknown' };
  // block: "b 12345" or "block 12345"
  const m = s.match(/^(?:b|block)\s+(\d{1,12})$/i);
  if (m) return { kind: 'block', payload: Number(m[1]) };
  // account heuristic: has dot and not starting with ed25519:
  if (/\./.test(s) && !/^ed25519:/.test(s)) return { kind: 'account', payload: s };
  // tx hash (NEAR base58-ish, pragmatic check 32-64 length, no spaces)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(s)) return { kind: 'tx', payload: s };
  return { kind: 'unknown' };
}

export const SlashModal: React.FC<Props> = ({ open, onClose, onSubmit, autopin, onToggleAutopin }) => {
  const boxRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const [val, setVal] = useState('');

  useEffect(() => {
    if (!open) return;
    setVal('');
    const el = inputRef.current;
    try {
      el?.focus();
      el?.setValue('');
    } catch {}
  }, [open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || !open) return;

    const keypressHandler = (_ch: any, key: any) => {
      if (key.name === 'escape') onClose();
      if (key.name === 'enter') { onSubmit(val.trim()); }
      if (key.full === 'C-a') onToggleAutopin();
    };

    const changeHandler = (v: string) => {
      setVal(v);
    };

    try {
      el.key(['escape', 'enter', 'C-a'], keypressHandler);
      el.on('submit', changeHandler);
    } catch {}

    return () => {
      try {
        el.removeKey(['escape', 'enter', 'C-a'], keypressHandler);
        el.removeListener('submit', changeHandler);
      } catch {}
    };
  }, [open, val, onClose, onSubmit, onToggleAutopin]);

  const hint = useMemo(() => {
    const c = classify(val);
    switch (c.kind) {
      case 'tx': return `Enter: open tx  •  ${autopin ? 'will pin ★' : 'no pin'}`;
      case 'block': return `Enter: jump to block #${c.payload}`;
      case 'account': return `Enter: filter acct:${c.payload}`;
      default: return `Paste tx hash • Try: "b 123456" • "mike.near"`;
    }
  }, [val, autopin]);

  if (!open) return null as any;

  // @ts-ignore blessed element
  return (
    <box
      ref={boxRef}
      top="center" left="center" width="60%" height={7}
      border={{ type: 'line' }} label=" / Quick Command "
      style={{ border: { fg: 'yellow' }, bg: 'black' }}
      keys={true} mouse={true} vi={true}
    >
      {/* @ts-ignore */}
      <textbox
        ref={inputRef}
        top={1} left={1} right={1} height={3}
        inputOnFocus={true}
        keys={true} mouse={true}
        style={{ bg: 'black', fg: 'white' }}
      />
      {/* @ts-ignore */}
      <box bottom={1} left={1} right={1} height={1}>
        {/* @ts-ignore */}
        <text tags={true} content={
          `{gray-fg}${hint}{/}   •   Ctrl+A: toggle autopin ${autopin ? '{yellow-fg}ON{/}' : '{gray-fg}OFF{/}'}   •   Esc: close`
        } />
      </box>
    </box>
  );
};
