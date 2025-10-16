import React, { useMemo } from 'react';

type Props = {
  network: string;
  height?: number;
  follow: boolean;
  fps?: number;
  viewMode: 'pretty' | 'raw';
  filterActive: boolean;
  pinnedLabels?: string[];
  pinnedTotal?: number;
};

export const StatusBar: React.FC<Props> = ({
  network,
  height,
  follow,
  fps,
  viewMode,
  filterActive,
  pinnedLabels,
  pinnedTotal
}) => {
  const left = useMemo(() => {
    const h = typeof height === 'number' ? `#${height}` : '-';
    const labels = (pinnedLabels || []).slice(0, 3);
    const extra = (pinnedTotal && pinnedTotal > 3) ? ` (+${pinnedTotal - 3})` : '';
    const marksChip = labels.length ? ` • ★[${labels.join(' ')}]${extra}` : '';
    return ` ${network} • ${h}${follow ? ' • FOLLOW' : ''}${marksChip} `;
  }, [network, height, follow, pinnedLabels, pinnedTotal]);

  const right = useMemo(() => {
    const parts: string[] = [];
    parts.push(`MODE:${viewMode.toUpperCase()}`);
    if (typeof fps === 'number') parts.push(`${fps}FPS`);
    if (filterActive) parts.push('FILTER');
    const time = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
    parts.push(`${time} UTC`);
    return ` ${parts.join(' • ')} `;
  }, [viewMode, fps, filterActive]);

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
