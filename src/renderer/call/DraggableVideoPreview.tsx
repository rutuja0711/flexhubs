import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FiMove } from 'react-icons/fi';

type Point = { x: number; y: number };

type DraggableVideoPreviewProps = {
  children: ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
};

export function DraggableVideoPreview({ children, containerRef }: DraggableVideoPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);

  const clampPosition = useCallback((nextX: number, nextY: number): Point => {
    const container = containerRef.current;
    const preview = previewRef.current;

    if (!container || !preview) {
      return { x: nextX, y: nextY };
    }

    const containerRect = container.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const maxX = Math.max(0, containerRect.width - previewRect.width);
    const maxY = Math.max(0, containerRect.height - previewRect.height);

    return {
      x: Math.min(Math.max(0, nextX), maxX),
      y: Math.min(Math.max(0, nextY), maxY),
    };
  }, [containerRef]);

  const ensureInitialPosition = useCallback(() => {
    const container = containerRef.current;
    const preview = previewRef.current;

    if (!container || !preview || position) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    setPosition(
      clampPosition(
        containerRect.width - previewRect.width - 20,
        containerRect.height - previewRect.height - 20,
      ),
    );
  }, [clampPosition, containerRef, position]);

  useEffect(() => {
    ensureInitialPosition();

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setPosition((current) => {
        if (!current) {
          ensureInitialPosition();
          return current;
        }

        return clampPosition(current.x, current.y);
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [clampPosition, containerRef, ensureInitialPosition]);

  return (
    <div
      ref={previewRef}
      className="absolute z-20 w-44 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:w-52"
      style={
        position
          ? {
              left: position.x,
              top: position.y,
            }
          : {
              right: 20,
              bottom: 20,
            }
      }
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-black/60 px-2 py-1 text-[11px] text-white/80 active:cursor-grabbing"
        onPointerDown={(event) => {
          const preview = previewRef.current;
          const container = containerRef.current;

          if (!preview || !container) {
            return;
          }

          const previewRect = preview.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const current = position ?? {
            x: previewRect.left - containerRect.left,
            y: previewRect.top - containerRect.top,
          };

          dragStateRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - containerRect.left - current.x,
            offsetY: event.clientY - containerRect.top - current.y,
          };

          preview.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const dragState = dragStateRef.current;
          const container = containerRef.current;

          if (!dragState || dragState.pointerId !== event.pointerId || !container) {
            return;
          }

          const containerRect = container.getBoundingClientRect();
          const next = clampPosition(
            event.clientX - containerRect.left - dragState.offsetX,
            event.clientY - containerRect.top - dragState.offsetY,
          );
          setPosition(next);
        }}
        onPointerUp={(event) => {
          const dragState = dragStateRef.current;

          if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
          }

          dragStateRef.current = null;
          previewRef.current?.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (dragStateRef.current?.pointerId === event.pointerId) {
            dragStateRef.current = null;
          }
        }}
      >
        <span>Your preview</span>
        <FiMove aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}
