import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, StopIcon, VolumeIcon } from '../../icons';
import { formatTimecode } from '../../lib/media';
import { contrast, fill, fillIcon, ghostIcon, ink, inkHover, muted } from '../../lib/theme';
import type { PlayerState, TransportCommand } from '../../types';

function ImageCountdown({
  duration,
  remaining,
  playing,
}: {
  duration: number;
  remaining: number;
  playing: boolean;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const playingRef = useRef(playing);
  const remainingRef = useRef(remaining);
  const prevRemainingRef = useRef(remaining);
  const [restartKey, setRestartKey] = useState(0);
  playingRef.current = playing;
  remainingRef.current = remaining;
  const remainingLabel = formatTimecode(Math.max(0, Math.ceil(remaining - 1e-6)));

  useLayoutEffect(() => {
    if (remaining > prevRemainingRef.current + 0.25) {
      setRestartKey((key) => key + 1);
    }
    prevRemainingRef.current = remaining;
  }, [remaining]);

  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const elapsed = Math.max(0, duration - remainingRef.current);
    const animation = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: Math.max(10, duration * 1000),
      delay: -elapsed * 1000,
      fill: 'both',
      easing: 'linear',
    });
    animationRef.current = animation;
    if (!playingRef.current) animation.pause();
    return () => {
      animation.cancel();
      animationRef.current = null;
    };
  }, [duration, restartKey]);

  useLayoutEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;
    if (playing) animation.play();
    else animation.pause();
  }, [playing]);

  return (
    <div className="flex min-w-[8rem] flex-1 items-center gap-3">
      <div
        role="progressbar"
        aria-label="Image progress"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, duration)}
        aria-valuenow={Math.max(0, duration - remaining)}
        aria-valuetext={`${remainingLabel} remaining`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"
      >
        <div
          ref={fillRef}
          className="h-full w-full origin-left rounded-full bg-orange-400 dark:bg-orange-600"
        />
      </div>
      <span
        title="Time remaining"
        className={`w-10 shrink-0 text-right font-mono text-xs tabular-nums tracking-tight ${muted}`}
      >
        {remainingLabel}
      </span>
    </div>
  );
}

interface TransportBarProps {
  playerState: PlayerState;
  onCommand: (command: TransportCommand) => void;
}

export function TransportBar({ playerState, onCommand }: TransportBarProps) {
  const { status, playing, currentTime, duration, volume, remaining } = playerState;
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const scrubbingRef = useRef(false);
  const scrubTimeRef = useRef(0);
  const lastScrubAt = useRef(0);

  if (status === 'blank') return null;

  const seekMax = duration > 0 ? duration : 0;
  const displayedTime = scrubbing ? scrubTime : currentTime;
  const showPlay = playing || scrubbing;
  const showCountdown = status === 'image' && remaining !== null;
  const countdownTotal = duration > 0 ? duration : remaining ?? 0;

  function beginScrub(): void {
    if (scrubbingRef.current) return;
    scrubbingRef.current = true;
    setScrubbing(true);
    setScrubTime(currentTime);
    scrubTimeRef.current = currentTime;
    onCommand({ action: 'scrubStart' });
  }

  function moveScrub(time: number): void {
    setScrubTime(time);
    scrubTimeRef.current = time;
    if (!scrubbingRef.current) return;
    const now = performance.now();
    if (now - lastScrubAt.current < 40) return;
    lastScrubAt.current = now;
    onCommand({ action: 'scrub', time });
  }

  function endScrub(): void {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    onCommand({ action: 'scrubEnd', time: scrubTimeRef.current });
    setScrubbing(false);
  }

  function onSeekKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        beginScrub();
        break;
      default:
        break;
    }
  }

  return (
    <div className={`mx-2 mb-2 mt-auto flex shrink-0 flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 ${contrast}`}>
      {status === 'video' ? (
        <>
          <button
            type="button"
            aria-label={showPlay ? 'Pause' : 'Play'}
            onClick={() => onCommand({ action: showPlay ? 'pause' : 'play' })}
            className={`${fillIcon} ${showPlay ? fill.yellow : fill.green}`}
          >
            {showPlay ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
          </button>
          <span className={`w-[5.5rem] shrink-0 text-right font-mono text-xs tabular-nums tracking-tight ${muted}`}>
            {formatTimecode(displayedTime)} / {formatTimecode(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={seekMax}
            step={0.05}
            value={Math.min(displayedTime, seekMax)}
            disabled={seekMax <= 0}
            aria-label="Seek"
            onPointerDown={beginScrub}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onBlur={endScrub}
            onKeyDown={onSeekKeyDown}
            onKeyUp={endScrub}
            onChange={(e) => moveScrub(Number(e.target.value))}
            className={`min-w-[6rem] flex-1 ${ink.green}`}
          />
          <VolumeIcon className={`size-5 shrink-0 ${ink.orange}`} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Volume"
            onChange={(e) => onCommand({ action: 'volume', value: Number(e.target.value) })}
            className={`w-16 ${ink.orange}`}
          />
        </>
      ) : null}

      {showCountdown ? (
        <ImageCountdown
          key={playerState.currentCueId ?? 'image'}
          duration={countdownTotal}
          remaining={remaining ?? 0}
          playing={playing}
        />
      ) : null}

      {status === 'image' && !showCountdown ? <div className="flex-1" /> : null}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous"
          title={status === 'video' && showPlay ? 'Pause to skip' : 'Previous'}
          disabled={status === 'video' && showPlay}
          onClick={() => onCommand({ action: 'previous' })}
          className={`${ghostIcon} ${inkHover.cyan} disabled:pointer-events-none disabled:opacity-35`}
        >
          <PreviousIcon className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next"
          title={status === 'video' && showPlay ? 'Pause to skip' : 'Next'}
          disabled={status === 'video' && showPlay}
          onClick={() => onCommand({ action: 'next' })}
          className={`${ghostIcon} ${inkHover.cyan} disabled:pointer-events-none disabled:opacity-35`}
        >
          <NextIcon className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Stop"
          onClick={() => onCommand({ action: 'stop' })}
          className={`${fillIcon} ${fill.red}`}
        >
          <StopIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
