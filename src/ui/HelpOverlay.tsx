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
  Tab / Shift+Tab .......... Switch panes
  ↑/↓ / PgUp/PgDn .......... Move/Scroll in pane
  ←/→ ...................... Scroll 6 lines in tx details
  Home/End .................. Jump to top/bottom

Actions
  Esc ...................... Close overlays
  Ctrl+K ................... Command Palette
  c ........................ Copy details
  Ctrl+L ................... Toggle Follow Latest
  q or Ctrl+C .............. Quit

Notes
  • Copy is whole-details by design (no partial mouse select in TUIs).
  • Press any key to close this help.` } />
    </box>
  );
};
