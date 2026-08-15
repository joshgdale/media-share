import { useEffect, useRef, useState } from 'react';
import { useBroadcastChannel } from '../../hooks/useBroadcastChannel';
import { PlayerWindowFrame } from './PlayerWindowFrame';
import { normalizeCues } from '../../lib/cues';
import { toMediaUrl } from '../../lib/media';
import {
  DEFAULT_BLANK_TEXT_SIZE,
  DEFAULT_IMAGE_DURATION,
  DEFAULT_PLAYER_STATE,
  DEFAULT_PLAYLIST,
  DEFAULT_SETTINGS,
  type AppSettings,
  type CueItem,
  type EndAction,
  type PlaylistData,
  type PlayerState,
  type SyncMessage,
  type TransportCommand,
} from '../../types';

type DeckId = 'A' | 'B';

const TICK_MS = 100;
const CROSSFADE_MS = 450;
const READY_STATE = HTMLMediaElement.HAVE_FUTURE_DATA;
const SEEK_READY_STATE = HTMLMediaElement.HAVE_CURRENT_DATA;
const PLAYABLE_TIMEOUT_MS = 8000;
const SEEK_TIMEOUT_MS = 2000;

const VIDEO_BASE_CLASS =
  'pointer-events-none absolute inset-0 h-full w-full bg-[#000] object-contain transition-opacity duration-[450ms] ease-in-out';

type ImageLayer = {
  id: number;
  url: string;
  shown: boolean;
};

function oppositeDeck(deck: DeckId): DeckId {
  return deck === 'A' ? 'B' : 'A';
}

function mediaDuration(video: HTMLVideoElement): number {
  return Number.isFinite(video.duration) ? video.duration : 0;
}

function isPlayable(video: HTMLVideoElement): boolean {
  return video.readyState >= READY_STATE;
}

function pauseAtStart(video: HTMLVideoElement): void {
  video.pause();
  try {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = 0;
    }
  } catch {
    // Ignore seek errors before metadata is ready.
  }
}

export function MediaPlayer() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const playlistRef = useRef<PlaylistData>(DEFAULT_PLAYLIST);
  const stateRef = useRef<PlayerState>({ ...DEFAULT_PLAYER_STATE });
  const activeDeckRef = useRef<DeckId>('A');
  const currentIndexRef = useRef(-1);
  const playGenRef = useRef(0);
  const seekGenRef = useRef(0);
  const seekingRef = useRef(false);
  const scrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const imageTimerRef = useRef<number | null>(null);
  const imageDeadlineRef = useRef<number | null>(null);
  const imageRemainingRef = useRef<number | null>(null);
  const postRef = useRef<(message: SyncMessage) => void>(() => {});

  const [status, setStatus] = useState<PlayerState['status']>('blank');
  const [visibleDeck, setVisibleDeck] = useState<DeckId | null>(null);
  const [imageLayers, setImageLayers] = useState<ImageLayer[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const imageLayerIdRef = useRef(0);
  const imageFadeTimerRef = useRef<number | null>(null);
  const videoHideTimerRef = useRef<number | null>(null);
  const visibleDeckRef = useRef<DeckId | null>(null);

  const engineRef = useRef<{
    goBlank: () => void;
    handleEndAction: (action: EndAction) => void;
  }>({
    goBlank: () => {},
    handleEndAction: () => {},
  });

  function getDeck(id: DeckId): HTMLVideoElement | null {
    return id === 'A' ? videoARef.current : videoBRef.current;
  }

  function waitUntilPlayable(
    video: HTMLVideoElement,
    gen: number,
    minReadyState: number = READY_STATE,
    timeoutMs = PLAYABLE_TIMEOUT_MS,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (gen !== playGenRef.current) {
        resolve(false);
        return;
      }
      if (video.error) {
        resolve(false);
        return;
      }
      if (video.readyState >= minReadyState) {
        resolve(true);
        return;
      }

      let settled = false;
      let poll = 0;
      let timeout = 0;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('canplaythrough', onReady);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        window.clearInterval(poll);
        window.clearTimeout(timeout);
        resolve(ok && gen === playGenRef.current);
      };
      const onReady = () => {
        if (video.readyState >= minReadyState) finish(true);
      };
      const onError = () => finish(false);

      video.addEventListener('canplay', onReady);
      video.addEventListener('canplaythrough', onReady);
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onError);

      poll = window.setInterval(() => {
        if (gen !== playGenRef.current) {
          finish(false);
          return;
        }
        if (video.error) {
          finish(false);
          return;
        }
        if (video.readyState >= minReadyState) finish(true);
      }, 40);
      timeout = window.setTimeout(() => {
        finish(video.readyState >= SEEK_READY_STATE && !video.error);
      }, timeoutMs);
    });
  }

  function waitForSeeked(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      if (!video.seeking) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', finish);
        video.removeEventListener('error', finish);
        window.clearTimeout(timeout);
        resolve();
      };
      const timeout = window.setTimeout(finish, SEEK_TIMEOUT_MS);
      video.addEventListener('seeked', finish);
      video.addEventListener('error', finish);
    });
  }

  async function ensureReady(
    video: HTMLVideoElement,
    url: string,
    gen: number,
  ): Promise<boolean> {
    if (gen !== playGenRef.current) return false;
    if (video.getAttribute('src') !== url || video.error) {
      video.src = url;
      video.load();
    }
    const ready = await waitUntilPlayable(video, gen);
    if (!ready) return false;
    pauseAtStart(video);
    return gen === playGenRef.current;
  }

  function clearImageFadeTimer(): void {
    if (imageFadeTimerRef.current != null) {
      window.clearTimeout(imageFadeTimerRef.current);
      imageFadeTimerRef.current = null;
    }
  }

  function fadeInImage(url: string): void {
    clearImageFadeTimer();
    const id = ++imageLayerIdRef.current;
    setImageLayers((prev) => [...prev, { id, url, shown: false }]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setImageLayers((prev) =>
          prev.map((layer) =>
            layer.id === id ? { ...layer, shown: true } : { ...layer, shown: false },
          ),
        );
      });
    });
    imageFadeTimerRef.current = window.setTimeout(() => {
      setImageLayers((prev) => prev.filter((layer) => layer.id === id));
    }, CROSSFADE_MS);
  }

  function fadeOutImages(): void {
    clearImageFadeTimer();
    setImageLayers((prev) => prev.map((layer) => ({ ...layer, shown: false })));
    imageFadeTimerRef.current = window.setTimeout(() => {
      setImageLayers([]);
    }, CROSSFADE_MS);
  }

  function clearVideoHideTimer(): void {
    if (videoHideTimerRef.current != null) {
      window.clearTimeout(videoHideTimerRef.current);
      videoHideTimerRef.current = null;
    }
  }

  function showDeck(deck: DeckId | null): void {
    visibleDeckRef.current = deck;
    setVisibleDeck(deck);
  }

  function scheduleHideVideos(): void {
    clearVideoHideTimer();
    videoHideTimerRef.current = window.setTimeout(() => {
      showDeck(null);
      videoARef.current?.pause();
      videoBRef.current?.pause();
      videoHideTimerRef.current = null;
    }, CROSSFADE_MS);
  }

  function publish(partial: Partial<PlayerState>): void {
    const next: PlayerState = { ...stateRef.current, ...partial };
    stateRef.current = next;
    postRef.current({ type: 'playerState', state: next });
  }

  function stopProgress(): void {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startProgress(): void {
    stopProgress();
    progressTimerRef.current = window.setInterval(() => {
      if (stateRef.current.status !== 'video' || !stateRef.current.playing) {
        return;
      }
      if (seekingRef.current) return;
      const video = getDeck(activeDeckRef.current);
      if (!video) return;
      publish({
        currentTime: video.currentTime,
        duration: mediaDuration(video),
      });
    }, TICK_MS);
  }

  function stopImageTimer(): void {
    if (imageTimerRef.current != null) {
      window.clearInterval(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    imageDeadlineRef.current = null;
  }

  function startImageTimer(): void {
    stopImageTimer();
    const remaining = imageRemainingRef.current ?? 0;
    imageDeadlineRef.current = performance.now() + remaining * 1000;

    imageTimerRef.current = window.setInterval(() => {
      const deadline = imageDeadlineRef.current;
      if (deadline == null) return;
      const left = Math.max(0, (deadline - performance.now()) / 1000);
      imageRemainingRef.current = left;
      const duration = stateRef.current.duration;
      publish({
        remaining: left,
        currentTime: Math.max(0, duration - left),
        playing: true,
      });
      if (left <= 0) {
        stopImageTimer();
        const cue = playlistRef.current.cues[currentIndexRef.current];
        if (!cue) {
          engineRef.current.goBlank();
          return;
        }
        engineRef.current.handleEndAction(cue.endAction);
      }
    }, TICK_MS);
  }

  function preloadFollowing(index: number): void {
    const next = playlistRef.current.cues[index + 1];
    const inactive = getDeck(oppositeDeck(activeDeckRef.current));
    if (!inactive) return;
    if (!next || next.type !== 'video') return;

    const url = toMediaUrl(next.src);
    if (inactive.getAttribute('src') === url) {
      pauseAtStart(inactive);
      return;
    }

    const onReady = () => {
      inactive.removeEventListener('canplay', onReady);
      pauseAtStart(inactive);
    };
    inactive.addEventListener('canplay', onReady);
    inactive.src = url;
    inactive.load();
  }

  function applyVolumeToDecks(value: number): void {
    if (videoARef.current) videoARef.current.volume = value;
    if (videoBRef.current) videoBRef.current.volume = value;
  }

  function goBlank(): void {
    playGenRef.current += 1;
    seekGenRef.current += 1;
    seekingRef.current = false;
    scrubbingRef.current = false;
    wasPlayingRef.current = false;
    pendingSeekRef.current = null;
    stopProgress();
    stopImageTimer();
    imageRemainingRef.current = null;
    currentIndexRef.current = -1;

    videoARef.current?.pause();
    videoBRef.current?.pause();

    clearVideoHideTimer();
    fadeOutImages();
    showDeck(null);
    setStatus('blank');
    publish({
      status: 'blank',
      currentCueId: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      remaining: null,
    });
  }

  function playImage(cue: CueItem): void {
    videoARef.current?.pause();
    videoBRef.current?.pause();
    stopProgress();

    const url = toMediaUrl(cue.src);
    fadeInImage(url);
    setStatus('image');
    scheduleHideVideos();

    if (cue.endAction === 'freeze') {
      imageRemainingRef.current = null;
      stopImageTimer();
      publish({
        status: 'image',
        currentCueId: cue.id,
        playing: false,
        currentTime: 0,
        duration: 0,
        remaining: null,
      });
      return;
    }

    const duration = cue.duration ?? DEFAULT_IMAGE_DURATION;
    imageRemainingRef.current = duration;
    publish({
      status: 'image',
      currentCueId: cue.id,
      playing: true,
      currentTime: 0,
      duration,
      remaining: duration,
    });
    startImageTimer();
  }

  async function beginVideo(
    video: HTMLVideoElement,
    cue: CueItem,
    index: number,
    gen: number,
    deck: DeckId,
  ): Promise<void> {
    if (gen !== playGenRef.current) return;
    if (!isPlayable(video)) {
      const ready = await waitUntilPlayable(video, gen);
      if (!ready) return;
    }
    if (gen !== playGenRef.current) return;

    clearVideoHideTimer();
    fadeOutImages();
    showDeck(deck);
    setStatus('video');

    try {
      await video.play();
    } catch {
      if (gen !== playGenRef.current) return;
      const ready = await waitUntilPlayable(video, gen);
      if (!ready) return;
      try {
        await video.play();
      } catch {
        // Keep the first frame visible if playback is still blocked.
      }
    }
    if (gen !== playGenRef.current) return;

    publish({
      status: 'video',
      currentCueId: cue.id,
      playing: !video.paused,
      currentTime: video.currentTime,
      duration: mediaDuration(video),
      remaining: null,
    });
    if (!video.paused) startProgress();
    preloadFollowing(index);
  }

  async function swapTo(
    deck: DeckId,
    cue: CueItem,
    index: number,
    gen: number,
  ): Promise<void> {
    const incoming = getDeck(deck);
    const outgoing = getDeck(activeDeckRef.current);
    if (!incoming) return;

    activeDeckRef.current = deck;
    await beginVideo(incoming, cue, index, gen, deck);
    if (gen !== playGenRef.current) return;
    if (outgoing && outgoing !== incoming) outgoing.pause();
  }

  async function playVideo(
    cue: CueItem,
    index: number,
    gen: number,
  ): Promise<void> {
    const url = toMediaUrl(cue.src);
    const inactiveId = oppositeDeck(activeDeckRef.current);
    const inactive = getDeck(inactiveId);
    const active = getDeck(activeDeckRef.current);

    if (inactive && inactive.getAttribute('src') === url) {
      const ready = await ensureReady(inactive, url, gen);
      if (!ready) return;
      await swapTo(inactiveId, cue, index, gen);
      return;
    }

    if (active && active.getAttribute('src') === url) {
      const ready = await ensureReady(active, url, gen);
      if (!ready) return;
      await beginVideo(active, cue, index, gen, activeDeckRef.current);
      return;
    }

    const loadInto: DeckId =
      visibleDeckRef.current != null || stateRef.current.status === 'video'
        ? inactiveId
        : activeDeckRef.current;
    const target = getDeck(loadInto);
    if (!target) return;

    const ready = await ensureReady(target, url, gen);
    if (!ready) return;

    if (loadInto !== activeDeckRef.current) {
      await swapTo(loadInto, cue, index, gen);
      return;
    }

    await beginVideo(target, cue, index, gen, loadInto);
  }

  function playCueAt(index: number): void {
    const cue = playlistRef.current.cues[index];
    if (!cue) {
      goBlank();
      return;
    }

    const gen = playGenRef.current + 1;
    playGenRef.current = gen;
    seekGenRef.current += 1;
    seekingRef.current = false;
    scrubbingRef.current = false;
    pendingSeekRef.current = null;
    currentIndexRef.current = index;
    stopImageTimer();
    imageRemainingRef.current = null;

    if (cue.type === 'image') {
      playImage(cue);
      return;
    }

    void playVideo(cue, index, gen);
  }

  function playNext(): void {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= playlistRef.current.cues.length) {
      goBlank();
      return;
    }
    playCueAt(nextIndex);
  }

  function playPrevious(): void {
    const previousIndex = currentIndexRef.current - 1;
    if (previousIndex < 0) {
      goBlank();
      return;
    }
    playCueAt(previousIndex);
  }

  function handleEndAction(action: EndAction): void {
    const cue = playlistRef.current.cues[currentIndexRef.current];
    const resolved =
      cue?.type === 'video' && action === 'freeze' ? 'continue' : action;
    if (resolved === 'stop') {
      goBlank();
      return;
    }
    if (resolved === 'freeze') {
      const video = getDeck(activeDeckRef.current);
      video?.pause();
      stopProgress();
      stopImageTimer();
      imageRemainingRef.current = null;
      publish({
        playing: false,
        remaining: null,
        currentTime:
          stateRef.current.status === 'video'
            ? (video?.currentTime ?? stateRef.current.currentTime)
            : stateRef.current.currentTime,
        duration:
          stateRef.current.status === 'video'
            ? (video ? mediaDuration(video) : stateRef.current.duration)
            : stateRef.current.duration,
      });
      return;
    }
    playNext();
  }

  function resume(): void {
    const state = stateRef.current;
    if (state.status === 'video') {
      const video = getDeck(activeDeckRef.current);
      if (!video) return;
      wasPlayingRef.current = true;
      const gen = ++seekGenRef.current;
      void restorePlayback(video, gen);
      return;
    }
    if (
      state.status === 'image' &&
      imageRemainingRef.current != null &&
      !state.playing
    ) {
      startImageTimer();
      publish({ playing: true });
    }
  }

  function pause(): void {
    const state = stateRef.current;
    wasPlayingRef.current = false;
    if (state.status === 'video') {
      const video = getDeck(activeDeckRef.current);
      video?.pause();
      stopProgress();
      publish({
        playing: false,
        currentTime: video?.currentTime ?? state.currentTime,
      });
      return;
    }
    if (state.status === 'image' && state.playing) {
      if (imageDeadlineRef.current != null) {
        imageRemainingRef.current = Math.max(
          0,
          (imageDeadlineRef.current - performance.now()) / 1000,
        );
      }
      stopImageTimer();
      const remaining = imageRemainingRef.current;
      publish({
        playing: false,
        remaining,
        currentTime: Math.max(0, state.duration - (remaining ?? 0)),
      });
    }
  }

  function clampSeekTime(video: HTMLVideoElement, time: number): number {
    const duration = mediaDuration(video);
    if (duration <= 0) return Math.max(0, time);
    return Math.min(Math.max(0, time), Math.max(0, duration - 0.12));
  }

  function publishVideoTime(
    video: HTMLVideoElement,
    playing: boolean,
    time?: number,
  ): void {
    publish({
      playing,
      currentTime: time ?? video.currentTime,
      duration: mediaDuration(video),
    });
  }

  async function restorePlayback(
    video: HTMLVideoElement,
    gen: number,
  ): Promise<void> {
    if (gen !== seekGenRef.current) return;
    await waitForSeeked(video);
    if (gen !== seekGenRef.current) return;

    const duration = mediaDuration(video);
    if (video.ended || (duration > 0 && video.currentTime >= duration - 0.05)) {
      try {
        video.currentTime = 0;
        await waitForSeeked(video);
      } catch {
        return;
      }
    }
    if (gen !== seekGenRef.current) return;

    const tryPlay = async (): Promise<boolean> => {
      try {
        await video.play();
        return !video.paused && !video.ended;
      } catch {
        return false;
      }
    };

    if (await tryPlay()) {
      if (gen !== seekGenRef.current) return;
      publishVideoTime(video, true);
      startProgress();
      return;
    }
    if (gen !== seekGenRef.current) return;

    if (video.error) {
      const src = video.getAttribute('src');
      const time = pendingSeekRef.current ?? video.currentTime;
      if (src) {
        video.src = src;
        video.load();
        const reloaded = await waitUntilPlayable(video, playGenRef.current);
        if (!reloaded || gen !== seekGenRef.current) return;
        try {
          video.currentTime = clampSeekTime(video, time);
          await waitForSeeked(video);
        } catch {
          return;
        }
      }
    } else {
      const ready = await waitUntilPlayable(
        video,
        playGenRef.current,
        SEEK_READY_STATE,
        SEEK_TIMEOUT_MS,
      );
      if (!ready || gen !== seekGenRef.current) return;
    }

    if (await tryPlay()) {
      if (gen !== seekGenRef.current) return;
      publishVideoTime(video, true);
      startProgress();
      return;
    }
    if (gen !== seekGenRef.current) return;
    publishVideoTime(video, false);
  }

  function applyPreviewFrame(video: HTMLVideoElement): void {
    if (!scrubbingRef.current) return;
    const next = pendingSeekRef.current;
    if (next == null) return;
    if (video.seeking) return;
    if (Math.abs(video.currentTime - next) < 0.04) return;
    seekingRef.current = true;
    try {
      video.currentTime = next;
    } catch {
      seekingRef.current = false;
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      if (!scrubbingRef.current) return;
      seekingRef.current = false;
      applyPreviewFrame(video);
    };
    video.addEventListener('seeked', onSeeked, { once: true });
  }

  async function commitSeek(
    video: HTMLVideoElement,
    time: number,
    resume: boolean,
    gen: number,
  ): Promise<void> {
    const clamped = clampSeekTime(video, time);
    pendingSeekRef.current = clamped;
    seekingRef.current = true;
    publishVideoTime(video, resume, clamped);

    const alreadyThere =
      Math.abs(video.currentTime - clamped) < 0.02 && !video.seeking;
    if (!alreadyThere) {
      try {
        video.currentTime = clamped;
      } catch {
        if (gen === seekGenRef.current) seekingRef.current = false;
        return;
      }
      await waitForSeeked(video);
    }
    if (gen !== seekGenRef.current) return;
    seekingRef.current = false;
    pendingSeekRef.current = null;

    if (resume) {
      await restorePlayback(video, gen);
      return;
    }
    publishVideoTime(video, false);
  }

  function beginScrub(): void {
    const video = getDeck(activeDeckRef.current);
    if (stateRef.current.status !== 'video' || !video) return;
    seekGenRef.current += 1;
    scrubbingRef.current = true;
    seekingRef.current = true;
    wasPlayingRef.current = !video.paused && !video.ended;
    stopProgress();
    video.pause();
  }

  function previewScrub(time: number): void {
    if (!scrubbingRef.current) return;
    const video = getDeck(activeDeckRef.current);
    if (stateRef.current.status !== 'video' || !video) return;
    const clamped = clampSeekTime(video, time);
    pendingSeekRef.current = clamped;
    publishVideoTime(video, wasPlayingRef.current, clamped);
    applyPreviewFrame(video);
  }

  function endScrub(time: number): void {
    const video = getDeck(activeDeckRef.current);
    const resume = wasPlayingRef.current;
    scrubbingRef.current = false;
    const gen = ++seekGenRef.current;
    if (stateRef.current.status !== 'video' || !video) {
      seekingRef.current = false;
      return;
    }
    void commitSeek(video, time, resume, gen);
  }

  function seek(time: number): void {
    const video = getDeck(activeDeckRef.current);
    if (stateRef.current.status !== 'video' || !video) return;
    wasPlayingRef.current = !video.paused && !video.ended;
    stopProgress();
    video.pause();
    endScrub(time);
  }

  function applyVolume(value: number): void {
    const volume = Math.min(1, Math.max(0, value));
    applyVolumeToDecks(volume);
    publish({ volume });
  }

  function handleTransport(command: TransportCommand): void {
    switch (command.action) {
      case 'play':
        resume();
        break;
      case 'pause':
        pause();
        break;
      case 'seek':
        seek(command.time);
        break;
      case 'scrubStart':
        beginScrub();
        break;
      case 'scrub':
        previewScrub(command.time);
        break;
      case 'scrubEnd':
        endScrub(command.time);
        break;
      case 'volume':
        applyVolume(command.value);
        break;
      case 'stop':
        goBlank();
        break;
      case 'next':
        playNext();
        break;
      case 'previous':
        playPrevious();
        break;
    }
  }

  function onDeckEnded(deck: DeckId): void {
    if (activeDeckRef.current !== deck) return;
    if (stateRef.current.status !== 'video') return;
    if (seekingRef.current || scrubbingRef.current) return;
    const video = getDeck(deck);
    if (
      video &&
      Number.isFinite(video.duration) &&
      video.currentTime < video.duration - 0.08
    ) {
      return;
    }
    stopProgress();
    const cue = playlistRef.current.cues[currentIndexRef.current];
    if (!cue) {
      goBlank();
      return;
    }
    handleEndAction(cue.endAction);
  }

  function handleMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'hello':
      case 'requestState':
        postRef.current({ type: 'playerState', state: stateRef.current });
        break;
      case 'playlist':
        playlistRef.current = {
          ...message.playlist,
          cues: normalizeCues(message.playlist.cues),
        };
        break;
      case 'settings':
        setSettings(message.settings);
        break;
      case 'triggerCue': {
        const index = playlistRef.current.cues.findIndex(
          (cue) => cue.id === message.cueId,
        );
        if (index >= 0) playCueAt(index);
        break;
      }
      case 'transport':
        handleTransport(message.command);
        break;
      default:
        break;
    }
  }

  engineRef.current.goBlank = goBlank;
  engineRef.current.handleEndAction = handleEndAction;

  const post = useBroadcastChannel(handleMessage);
  postRef.current = post;

  useEffect(() => {
    post({ type: 'hello' });
    post({ type: 'playerState', state: stateRef.current });
  }, [post]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current != null) {
        window.clearInterval(progressTimerRef.current);
      }
      if (imageTimerRef.current != null) {
        window.clearInterval(imageTimerRef.current);
      }
      clearImageFadeTimer();
      clearVideoHideTimer();
    };
  }, []);

  const blankImage =
    settings.defaultBlankType === 'custom_image' && settings.customBlankSrc
      ? toMediaUrl(settings.customBlankSrc)
      : null;
  const blankTextSize = Number.isFinite(settings.blankTextSize)
    ? settings.blankTextSize
    : DEFAULT_BLANK_TEXT_SIZE;

  function deckClassName(deck: DeckId): string {
    const visible = visibleDeck === deck;
    return [
      VIDEO_BASE_CLASS,
      visible ? 'z-10 opacity-100' : 'z-0 opacity-0',
    ].join(' ');
  }

    return (
    <div className="relative h-full w-full overflow-hidden rounded-none bg-[#000] select-none">
      <PlayerWindowFrame />
      <div
        className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-[450ms] ease-in-out ${
          status === 'blank' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {blankImage ? (
          <img
            src={blankImage}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : settings.defaultBlankType === 'text' ? (
          <div className="flex h-full w-full items-center justify-center bg-black px-16 py-12">
            <div
              className="font-standby max-h-full max-w-full overflow-hidden text-center leading-tight font-normal tracking-normal whitespace-pre-wrap text-white"
              style={{ fontSize: `${blankTextSize}vmin` }}
            >
              {settings.blankText}
            </div>
          </div>
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: settings.defaultBlankColor }}
          />
        )}
      </div>

      <video
        ref={videoARef}
        className={deckClassName('A')}
        controls={false}
        playsInline
        disablePictureInPicture
        muted={false}
        loop={false}
        preload="auto"
        onEnded={() => onDeckEnded('A')}
      />
      <video
        ref={videoBRef}
        className={deckClassName('B')}
        controls={false}
        playsInline
        disablePictureInPicture
        muted={false}
        loop={false}
        preload="auto"
        onEnded={() => onDeckEnded('B')}
      />

      {imageLayers.map((layer) => (
        <img
          key={layer.id}
          src={layer.url}
          alt=""
          draggable={false}
          className={`pointer-events-none absolute inset-0 z-20 h-full w-full object-contain transition-opacity duration-[450ms] ease-in-out ${
            layer.shown ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  );
}
