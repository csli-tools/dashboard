import React, { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenTx: (hash: string) => Promise<void>;
  search: (query: string) => Array<{ hash: string; signer?: string; receiver?: string; block_height: number; ts_ms: number }>;
};

export const HistorySearch: React.FC<Props> = ({ open, onClose, onOpenTx, search }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);
  const listRef = useRef<any>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      try {
        inputRef.current.focus();
        inputRef.current.screen.render();
      } catch {}
    }
  }, [open]);

  useEffect(() => {
    if (query.length >= 2) {
      const found = search(query);
      setResults(found);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query, search]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handler = (_ch: any, key: any) => {
      if (!open) return;

      if (key.name === 'up') {
        setSelectedIndex(i => Math.max(0, i - 1));
      } else if (key.name === 'down') {
        setSelectedIndex(i => Math.min(results.length - 1, i + 1));
      } else if (key.name === 'enter') {
        const selected = results[selectedIndex];
        if (selected) {
          onOpenTx(selected.hash);
          onClose();
        }
      } else if (key.name === 'escape') {
        onClose();
      }

      try { (el.screen as any).render(); } catch {}
    };

    try { el.key(['up', 'down', 'enter', 'escape'], handler); } catch {}
    return () => { try { el.removeKey(['up', 'down', 'enter', 'escape'], handler); } catch {} };
  }, [open, results, selectedIndex, onOpenTx, onClose]);

  if (!open) return null as any;

  const items = results.map((r, i) => {
    const prefix = i === selectedIndex ? '> ' : '  ';
    const date = new Date(r.ts_ms).toISOString().split('T')[0];
    return `${prefix}${r.hash.slice(0, 12)}… ${r.signer || '?'} → ${r.receiver || '?'} [${date}]`;
  });

  // @ts-ignore
  return (
    <>
      {/* @ts-ignore */}
      <textbox
        ref={inputRef}
        label=" Search History (2+ chars) "
        top="center"
        left="center"
        width="80%"
        height={3}
        border={{ type: 'line' }}
        style={{ border: { fg: 'cyan' } }}
        inputOnFocus={true}
        keys={true}
        mouse={true}
        value={query}
        onSubmit={(v: string) => setQuery(v)}
      />

      {/* @ts-ignore */}
      <list
        ref={listRef}
        label={` Results (${results.length}) `}
        top="center"
        left="center"
        width="80%"
        height="50%"
        style={{ border: { fg: 'cyan' }, selected: { bg: 'blue' } }}
        border={{ type: 'line' }}
        keys={true}
        mouse={true}
        vi={true}
        scrollable={true}
        items={items}
        selected={selectedIndex}
      />
    </>
  );
};
