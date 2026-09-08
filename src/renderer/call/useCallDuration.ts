import { useEffect, useState } from 'react';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function useCallDuration(connectedAt: number | null, active: boolean): string {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || connectedAt == null) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, connectedAt]);

  if (!active || connectedAt == null) {
    return '';
  }

  return formatDuration(elapsed);
}
