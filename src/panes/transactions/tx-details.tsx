import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { softWrapLongTokensAnsiAware, ensureTrailingNewline } from '../../utils/terminal-wrap';

type Props = {
  txData: string;
  isFocused: boolean;
};

export const TxDetails: React.FC<Props> = React.memo(({ txData, isFocused }) => {
  const boxRef = useRef<any>(null);

  // Border config with only top border visible
  const borderConfig: any = {
    type: 'line',
    left: null,
    right: null,
    bottom: null
  };

  const prepared = useMemo(() => {
    // Blessed can't wrap long base64/base58; give it breakpoints.
    const withBreaks = softWrapLongTokensAnsiAware(typeof txData === 'string' ? txData : String(txData), 64);
    return ensureTrailingNewline(withBreaks);
  }, [txData]);

  // Update content and reset to top for new transactions
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.setContent(prepared);
    el.setScroll(0); // Always start at top for new content
  }, [prepared]);

  // Focus handling so arrow keys go to this pane when selected
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (isFocused) {
      try { el.focus(); } catch {}
    }
  }, [isFocused]);

  // Update border style imperatively when focus changes
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    try {
      el.style.border.bg = isFocused ? 'yellow' : undefined;
      (el.screen as any).render();
    } catch {}
  }, [isFocused]);

  // Arrow/PageUp/PageDown/Home/End scroll inside the box
  // Left/Right arrows paginate by 6 lines
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const handler = (_ch: any, key: any) => {
      if (!isFocused) return;
      const page = Math.max(1, (el.height || 0) - 2);
      switch (key.name) {
        case 'up':       el.scroll(-1); break;
        case 'down':     el.scroll(1); break;
        case 'left':     el.scroll(-6); break;  // 6 lines up
        case 'right':    el.scroll(6); break;   // 6 lines down
        case 'pageup':   el.scroll(-page); break;
        case 'pagedown': el.scroll(page); break;
        case 'home':     el.setScroll(0); break;
        case 'end':      el.setScroll(el.getScrollHeight()); break;
        default: return;
      }
      // request a render; blessed will coalesce if scheduler is installed
      try { (el.screen as any).render(); } catch {}
    };

    try { el.key(['up','down','left','right','pageup','pagedown','home','end'], handler); } catch {}
    return () => { try { el.removeKey(['up','down','left','right','pageup','pagedown','home','end'], handler); } catch {} };
  }, [isFocused]);

  // @ts-ignore blessed element
  return (
    <box
      ref={boxRef}
      label={` Transaction details - Press 'c' to copy `}
      top="30%"
      height="70%"
      width="100%"
      border={borderConfig}
      keys={true}
      mouse={true}
      vi={true}
      scrollable={true}
      alwaysScroll={true}
      tags={false}                // raw ANSI, not blessed tag parser
      scrollbar={{ ch: ' ' }}
      style={{
        border: {
          fg: '#eb5367',
          bg: isFocused ? 'yellow' : undefined
        }
      }}
    />
  );
});