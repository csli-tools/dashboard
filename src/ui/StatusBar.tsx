import React, { useMemo } from 'react';

type Props = {
  network: string;
  height?: number;
  follow: boolean;
  fps?: number;
  filterActive: boolean;
};

export const StatusBar: React.FC<Props> = ({ network, height, follow, fps, filterActive }) => {
  const left = useMemo(() => {
    const h = height ? `#${height}` : '-';
    return ` ${network} • ${h} ${follow ? '• FOLLOW' : ''} `;
  }, [network, height, follow]);

  const right = useMemo(() => {
    const parts = [];
    if (typeof fps === 'number') parts.push(`${fps}FPS`);
    if (filterActive) parts.push('FILTER');
    const time = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
    parts.push(`${time} UTC`);
    return ` ${parts.join(' • ')} `;
  }, [fps, filterActive]);

  // @ts-ignore blessed element
  return (
    <box
      height={1}
      top="100%-1"
      left={0}
      right={0}
      style={{ bg: 'black', fg: 'white' }}
    >
      {/* @ts-ignore */}
      <text left={0} content={left} />
      {/* @ts-ignore */}
      <text right={0} content={right} />
    </box>
  );
};
