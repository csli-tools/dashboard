import React, { useEffect, useRef } from 'react';

type Props = { open: boolean; onClose: () => void };

export const HelpOverlay: React.FC<Props> = ({ open, onClose }) => {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const handler = (_ch: any, key: any) => {
      if (key.name === 'escape' || key.name === 'enter' || key.full === 'q') onClose();
      try { (el.screen as any).render(); } catch {}
    };
    try { el.key(['escape','enter','q'], handler); } catch {}
    return () => { try { el.removeKey(['escape','enter','q'], handler); } catch {} };
  }, [open, onClose]);

  if (!open) return null as any;

  // @ts-ignore blessed element
  return (
    <box
      ref={ref}
      top="center" left="center" width="80%" height="80%"
      border={{ type: 'line' }} label=" Help "
      style={{ border: { fg: 'yellow' }, bg: 'black' }}
      keys={true} mouse={true} vi={true}
      scrollable={true} alwaysScroll={true}
    >
      {/* @ts-ignore */}
      <text top={1} left={2} content={
`Navigation
  Tab / Shift+Tab ........... Switch panes
  ↑/↓ / PgUp/PgDn ........... Move/Scroll in pane
  ←/→ ....................... Page up/down (6 lines)
  Home/End .................. Jump to top/bottom

Viewing
  v ......................... Toggle Pretty / Raw
  c ......................... Copy transaction details
  / or f .................... Focus Filter bar
  Ctrl+F .................... History Search
  Ctrl+K .................... Command Palette
  ? or h .................... Help (this screen)

Marks & Navigation
  m ......................... Set auto mark
  M ......................... Marks overlay (p: pin/unpin, d: delete)
  Ctrl+P .................... Pin/Unpin current context
  ' + label ................. Jump to mark by label
  [ / ] ..................... Prev/Next mark

Filtering
  signer:alice.near ......... Filter by signer
  receiver:game.hot.tg ...... Filter by receiver
  method:transfer ........... Filter by method name
  action:FunctionCall ....... Filter by action type

Other
  Esc ....................... Clear/close input/overlay
  Ctrl+L .................... Toggle Follow Latest
  q or Ctrl+C ............... Quit` } />
    </box>
  );
};
