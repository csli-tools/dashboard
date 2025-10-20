import React, { useMemo } from 'react';

type Props = {
  network: string;
  height?: number;
  follow: boolean;
  fps?: number;
  filterActive: boolean;
  pinnedLabels?: string[];
  pinnedTotal?: number;
  connecting?: boolean;
};

export const StatusBar: React.FC<Props> = ({
  network,
  height,
  follow,
  fps,
  filterActive,
  pinnedLabels,
  pinnedTotal,
  connecting
}) => {
  const left = useMemo(() => {
    const h = typeof height === 'number' ? `#${height}` : (connecting ? 'Connecting...' : '-');
    const labels = (pinnedLabels || []).slice(0, 3);
    const extra = (pinnedTotal && pinnedTotal > 3) ? ` (+${pinnedTotal - 3})` : '';
    // Color the star based on FOLLOW state
    const star = follow ? '{yellow-fg}★{/}' : '{gray-fg}★{/}';
    const marksChip = labels.length ? ` • ${star}[${labels.join(' ')}]${extra}` : '';
    return ` ${network} • ${h}${follow ? ' • FOLLOW' : ''}${marksChip} `;
  }, [network, height, follow, pinnedLabels, pinnedTotal, connecting]);

  const right = useMemo(() => {
    const parts: string[] = [];
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
      <text left={0} content={left} tags={true} />
      {/* @ts-ignore */}
      <text right={0} content={right} />
    </box>
  );
};
