import React, { useEffect, useRef } from 'react';

type Props = {
  value: string;
  focused: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

export const FilterBar: React.FC<Props> = ({ value, focused, onChange, onCommit, onCancel }) => {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (focused) {
      try {
        el.focus();
        el.setValue(value);
        el.screen.render();
      } catch {}
    }
  }, [focused, value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const submitHandler = (v: string) => {
      if (!focused) return;
      onChange(v);
      onCommit();
    };

    const cancelHandler = (_ch: any, key: any) => {
      if (!focused) return;
      if (key.name === 'escape') {
        onCancel();
      }
    };

    try {
      el.on('submit', submitHandler);
      el.key(['escape'], cancelHandler);
    } catch {}

    return () => {
      try {
        el.removeListener('submit', submitHandler);
        el.removeKey(['escape'], cancelHandler);
      } catch {}
    };
  }, [focused, onChange, onCommit, onCancel]);

  if (!focused) return null as any;

  // @ts-ignore blessed element
  return (
    <textbox
      ref={ref}
      label=" Filter (signer:, receiver:, method:, action:) "
      top={0}
      left={0}
      height={3}
      width="100%"
      border={{ type: 'line' }}
      style={{ border: { fg: 'yellow' } }}
      inputOnFocus={true}
      keys={true}
      mouse={true}
    />
  );
};
