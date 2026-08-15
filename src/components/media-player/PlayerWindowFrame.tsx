import { useEffect, useRef, type PointerEvent } from 'react';

export type PlayerResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: { edge: PlayerResizeEdge; className: string }[] = [
  { edge: 'n', className: 'absolute top-0 right-3 left-3 h-3 cursor-ns-resize' },
  { edge: 's', className: 'absolute right-3 bottom-0 left-3 h-3 cursor-ns-resize' },
  { edge: 'e', className: 'absolute top-3 right-0 bottom-3 w-3 cursor-ew-resize' },
  { edge: 'w', className: 'absolute top-3 bottom-3 left-0 w-3 cursor-ew-resize' },
  { edge: 'ne', className: 'absolute top-0 right-0 size-3 cursor-nesw-resize' },
  { edge: 'nw', className: 'absolute top-0 left-0 size-3 cursor-nwse-resize' },
  { edge: 'se', className: 'absolute right-0 bottom-0 size-3 cursor-nwse-resize' },
  { edge: 'sw', className: 'absolute bottom-0 left-0 size-3 cursor-nesw-resize' },
];

const DRAG_ZONES: { key: string; className: string }[] = [
  { key: 'n', className: 'absolute inset-x-0 top-0 h-8' },
  { key: 's', className: 'absolute inset-x-0 bottom-0 h-8' },
  { key: 'e', className: 'absolute top-8 right-0 bottom-8 w-8' },
  { key: 'w', className: 'absolute top-8 bottom-8 left-0 w-8' },
];

export function PlayerWindowFrame() {
  const activeEdge = useRef<PlayerResizeEdge | null>(null);

  useEffect(() => {
    function finish(): void {
      if (activeEdge.current === null) return;
      activeEdge.current = null;
      window.mediaShare.endPlayerResize();
    }
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  function beginResize(event: PointerEvent<HTMLDivElement>, edge: PlayerResizeEdge): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activeEdge.current = edge;
    event.currentTarget.setPointerCapture(event.pointerId);
    window.mediaShare.startPlayerResize(edge);
  }

  function endResize(event: PointerEvent<HTMLDivElement>): void {
    if (activeEdge.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeEdge.current = null;
    window.mediaShare.endPlayerResize();
  }

  return (
    <>
      {DRAG_ZONES.map(({ key, className }) => (
        <div
          key={key}
          aria-hidden="true"
          className={`z-30 cursor-grab [-webkit-app-region:drag] active:cursor-grabbing ${className}`}
        />
      ))}
      {HANDLES.map(({ edge, className }) => (
        <div
          key={edge}
          role="separator"
          aria-label={`Resize ${edge}`}
          onPointerDown={(event) => beginResize(event, edge)}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className={`z-40 [-webkit-app-region:no-drag] ${className}`}
        />
      ))}
    </>
  );
}
