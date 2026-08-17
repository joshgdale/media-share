import { useEffect, useRef, useState, type PointerEvent } from 'react';

export type PlayerResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MOVE_THRESHOLD_PX = 4;

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

interface MoveGesture {
  x: number;
  y: number;
  started: boolean;
}

export function PlayerWindowFrame() {
  // Custom move instead of `-webkit-app-region: drag`, so double-click
  // still reaches the renderer and can toggle native fullscreen.
  const activeEdge = useRef<PlayerResizeEdge | null>(null);
  const moveGesture = useRef<MoveGesture | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    return window.mediaShare.onPlayerFullscreen(setFullscreen);
  }, []);

  useEffect(() => {
    function finish(): void {
      if (activeEdge.current !== null) {
        activeEdge.current = null;
        window.mediaShare.endPlayerResize();
      }
      if (moveGesture.current?.started) {
        window.mediaShare.endPlayerMove();
      }
      moveGesture.current = null;
    }
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  function beginResize(event: PointerEvent<HTMLDivElement>, edge: PlayerResizeEdge): void {
    if (event.button !== 0 || fullscreen) return;
    event.preventDefault();
    event.stopPropagation();
    if (moveGesture.current?.started) {
      window.mediaShare.endPlayerMove();
    }
    moveGesture.current = null;
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

  function beginMove(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || fullscreen || event.detail >= 2) return;
    moveGesture.current = { x: event.clientX, y: event.clientY, started: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateMove(event: PointerEvent<HTMLDivElement>): void {
    const gesture = moveGesture.current;
    if (!gesture || gesture.started || fullscreen) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (dx * dx + dy * dy < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) return;
    gesture.started = true;
    window.mediaShare.startPlayerMove();
  }

  function endMove(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (moveGesture.current?.started) {
      window.mediaShare.endPlayerMove();
    }
    moveGesture.current = null;
  }

  function toggleFullscreen(): void {
    if (moveGesture.current?.started) {
      window.mediaShare.endPlayerMove();
    }
    moveGesture.current = null;
    window.mediaShare.togglePlayerFullscreen();
  }

  return (
    <>
      <div
        aria-hidden="true"
        onPointerDown={beginMove}
        onPointerMove={updateMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
        onDoubleClick={toggleFullscreen}
        className={`absolute inset-0 z-30 touch-none [-webkit-app-region:no-drag] ${
          fullscreen ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
      />
      {fullscreen
        ? null
        : HANDLES.map(({ edge, className }) => (
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
