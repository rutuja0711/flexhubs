import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { moveCallWindowBy } from '../callWindowApi';

type Point = { x: number; y: number };

export function useViewportDraggable(enabled: boolean, nativeWindowDrag = false) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; lastX: number; lastY: number } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampToViewport = useCallback((nextX: number, nextY: number): Point => {
    const panel = panelRef.current;

    if (!panel) {
      return { x: nextX, y: nextY };
    }

    const rect = panel.getBoundingClientRect();
    const margin = 12;

    return {
      x: Math.min(Math.max(margin, nextX), Math.max(margin, window.innerWidth - rect.width - margin)),
      y: Math.min(Math.max(margin, nextY), Math.max(margin, window.innerHeight - rect.height - margin)),
    };
  }, []);

  const ensureDefaultPosition = useCallback(() => {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();

    setPosition((current) => {
      if (!current) {
        return clampToViewport(
          window.innerWidth - rect.width - 16,
          window.innerHeight - rect.height - 16,
        );
      }

      return clampToViewport(current.x, current.y);
    });
  }, [clampToViewport]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    ensureDefaultPosition();

    const handleResize = () => {
      setPosition((current) => (current ? clampToViewport(current.x, current.y) : current));
    };

    window.addEventListener('resize', handleResize);

    const panel = panelRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (panel && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setPosition((current) => {
          if (!current) {
            return current;
          }

          return clampToViewport(current.x, current.y);
        });
      });
      resizeObserver.observe(panel);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [clampToViewport, enabled, ensureDefaultPosition]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      const current = position ?? {
        x: rect.left,
        y: rect.top,
      };

      dragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - current.x,
        offsetY: event.clientY - current.y,
        lastX: event.clientX,
        lastY: event.clientY,
      };

      setPosition(current);
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [enabled, position],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if (nativeWindowDrag) {
        moveCallWindowBy(event.clientX - dragState.lastX, event.clientY - dragState.lastY);
        dragStateRef.current = {
          ...dragState,
          lastX: event.clientX,
          lastY: event.clientY,
        };
        return;
      }

      setPosition(
        clampToViewport(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY),
      );
    },
    [clampToViewport, nativeWindowDrag],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const panelStyle: CSSProperties | undefined = enabled
    ? position
      ? {
          left: position.x,
          top: position.y,
          right: 'auto',
          bottom: 'auto',
        }
      : {
          right: 16,
          bottom: 16,
          left: 'auto',
          top: 'auto',
        }
    : undefined;

  return {
    panelRef,
    panelStyle,
    isDragging,
    startDrag,
    moveDrag,
    endDrag,
    ensureDefaultPosition,
  };
}
