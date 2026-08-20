import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  protocol,
  screen,
} from 'electron';
import { createReadStream, type ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import squirrelStartup from 'electron-squirrel-startup';
import {
  isPlaylistFilePath,
  PLAYLIST_DIALOG_FILTERS,
  playlistSaveFileName,
} from '../src/lib/playlist-file';
import { normalizeSettings } from '../src/lib/settings';
import {
  IMAGE_EXTENSIONS,
  QUIT_HOLD_MS,
  VIDEO_EXTENSIONS,
  type AppSettings,
  type PlaylistData,
  type QuitEvent,
} from '../src/types';

const VIDEO_DIALOG_EXTENSIONS = [...VIDEO_EXTENSIONS];
const IMAGE_DIALOG_EXTENSIONS = [...IMAGE_EXTENSIONS];

if (squirrelStartup) {
  app.quit();
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-share',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

const DEFAULT_SETTINGS: AppSettings = {
  defaultBlankType: 'color',
  defaultBlankColor: '#000000',
  blankText: '',
  blankTextSize: 6,
};

const WINDOW_TITLE = {
  control: 'Media Share Control',
  output: 'Media Share Output',
} as const;

let controlPanelWindow: BrowserWindow | null = null;
let mediaPlayerWindow: BrowserWindow | null = null;
let isQuitting = false;
let allowQuit = false;
let quitPromptVisible = false;
let quitHoldTimer: ReturnType<typeof setTimeout> | null = null;
let pendingOpenedPlaylist: unknown | null = null;
let pendingOpenedMedia: string[] = [];
let openedMediaFlush: ReturnType<typeof setTimeout> | null = null;
const openedMediaBuffer: string[] = [];
let controlRendererReady = false;

function preloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function windowIconPath(): string {
  const icons = path.join(__dirname, '..', 'icons');
  switch (process.platform) {
    case 'darwin':
      return path.join(icons, 'macos', 'icon.icns');
    case 'win32':
      return path.join(icons, 'windows', 'icon.ico');
    default:
      return path.join(icons, 'linux', 'icons', '512x512.png');
  }
}

function appIconImage(): Electron.NativeImage | undefined {
  const image = nativeImage.createFromPath(windowIconPath());
  return image.isEmpty() ? undefined : image;
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function legacyPlaylistPath(): string {
  return path.join(app.getPath('userData'), 'playlist.json');
}

async function removeLegacyPlaylist(): Promise<void> {
  try {
    await fs.unlink(legacyPlaylistPath());
  } catch {
    // Already gone, or never existed.
  }
}

function playlistPathsFromArgv(argv: string[]): string[] {
  return argv.filter((arg) => typeof arg === 'string' && isPlaylistFilePath(arg));
}

function isMediaFilePath(filePath: string): boolean {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  return VIDEO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext);
}

function mediaPathsFromArgv(argv: string[]): string[] {
  return argv.filter((arg) => typeof arg === 'string' && isMediaFilePath(arg));
}

function takeOpenedMediaBuffer(): string[] {
  if (openedMediaFlush) {
    clearTimeout(openedMediaFlush);
    openedMediaFlush = null;
  }
  return openedMediaBuffer.splice(0);
}

function rememberOpenedMedia(paths: string[]): void {
  for (const filePath of paths) {
    if (!isMediaFilePath(filePath)) continue;
    if (!pendingOpenedMedia.includes(filePath)) pendingOpenedMedia.push(filePath);
  }
}

function sendOpenedMedia(paths: string[]): void {
  const unique = [...new Set(paths.filter(isMediaFilePath))];
  if (unique.length === 0) return;
  if (controlRendererReady && controlPanelWindow && !controlPanelWindow.isDestroyed()) {
    controlPanelWindow.webContents.send('media:opened', unique);
    revealControlPanel();
    return;
  }
  rememberOpenedMedia(unique);
}

function queueOpenedMedia(paths: string[]): void {
  openedMediaBuffer.push(...paths);
  if (openedMediaFlush) clearTimeout(openedMediaFlush);
  openedMediaFlush = setTimeout(() => {
    openedMediaFlush = null;
    sendOpenedMedia(openedMediaBuffer.splice(0));
  }, 50);
}

async function ingestPlaylistFile(filePath: string): Promise<void> {
  if (!isPlaylistFilePath(filePath)) return;
  const data = await readJsonFile<unknown>(filePath, null);
  if (data == null) return;
  if (controlRendererReady && controlPanelWindow && !controlPanelWindow.isDestroyed()) {
    controlPanelWindow.webContents.send('playlist:opened', data);
    revealControlPanel();
    return;
  }
  pendingOpenedPlaylist = data;
}

async function ingestOpenedPath(filePath: string): Promise<void> {
  if (isPlaylistFilePath(filePath)) {
    await ingestPlaylistFile(filePath);
    return;
  }
  queueOpenedMedia([filePath]);
}

async function ingestArgv(argv: string[]): Promise<void> {
  const lastPlaylist = playlistPathsFromArgv(argv).at(-1);
  if (lastPlaylist) await ingestPlaylistFile(lastPlaylist);
  const media = mediaPathsFromArgv(argv);
  if (media.length) queueOpenedMedia(media);
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StoredWindowState {
  control?: WindowBounds;
  output?: WindowBounds;
}

function windowStatePath(): string {
  return path.join(app.getPath('userData'), 'windows.json');
}

function boundsOverlapDisplay(bounds: WindowBounds): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function usableBounds(bounds: WindowBounds | undefined): WindowBounds | null {
  if (!bounds) return null;
  if (
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 200 ||
    bounds.height < 160
  ) {
    return null;
  }
  return boundsOverlapDisplay(bounds) ? bounds : null;
}

async function loadWindowState(): Promise<StoredWindowState> {
  return readJsonFile<StoredWindowState>(windowStatePath(), {});
}

function persistedBounds(win: BrowserWindow): WindowBounds {
  const bounds = win.getNormalBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

async function saveWindowState(): Promise<void> {
  const state: StoredWindowState = {};
  if (controlPanelWindow && !controlPanelWindow.isDestroyed()) {
    state.control = persistedBounds(controlPanelWindow);
  }
  if (mediaPlayerWindow && !mediaPlayerWindow.isDestroyed()) {
    state.output = persistedBounds(mediaPlayerWindow);
  }
  await writeJsonFile(windowStatePath(), state);
}

function persistWindow(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void saveWindowState();
    }, 200);
  };
  win.on('moved', schedule);
  win.on('resized', schedule);
  win.on('close', () => {
    if (timer) clearTimeout(timer);
    void saveWindowState();
  });
}

const PLAYER_WIDTH = 1280;
const PLAYER_HEIGHT = 720;
const PLAYER_ASPECT = PLAYER_WIDTH / PLAYER_HEIGHT;
const PLAYER_MIN_WIDTH = 640;
const PLAYER_MIN_HEIGHT = 360;

type PlayerResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const PLAYER_RESIZE_EDGES = new Set<PlayerResizeEdge>([
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]);

interface PlayerResizeSession {
  win: BrowserWindow;
  edge: PlayerResizeEdge;
  startMouse: { x: number; y: number };
  startBounds: Electron.Rectangle;
  timer: ReturnType<typeof setInterval>;
}

interface PlayerMoveSession {
  win: BrowserWindow;
  startMouse: { x: number; y: number };
  startBounds: Electron.Rectangle;
  timer: ReturnType<typeof setInterval>;
}

let playerResize: PlayerResizeSession | null = null;
let playerMove: PlayerMoveSession | null = null;

function clampPlayerSize(width: number): { width: number; height: number } {
  let nextWidth = Math.max(PLAYER_MIN_WIDTH, width);
  let nextHeight = Math.round(nextWidth / PLAYER_ASPECT);
  if (nextHeight < PLAYER_MIN_HEIGHT) {
    nextHeight = PLAYER_MIN_HEIGHT;
    nextWidth = Math.round(nextHeight * PLAYER_ASPECT);
  }
  return { width: nextWidth, height: nextHeight };
}

function boundsForPlayerResize(
  start: Electron.Rectangle,
  edge: PlayerResizeEdge,
  dx: number,
  dy: number,
): Electron.Rectangle {
  let width = start.width;
  let height = start.height;

  if (edge.includes('e')) width = start.width + dx;
  if (edge.includes('w')) width = start.width - dx;
  if (edge.includes('s')) height = start.height + dy;
  if (edge.includes('n')) height = start.height - dy;

  if (edge === 'n' || edge === 's') {
    width = height * PLAYER_ASPECT;
  } else if (edge === 'e' || edge === 'w') {
    height = width / PLAYER_ASPECT;
  } else if (Math.abs(dx) * PLAYER_ASPECT >= Math.abs(dy)) {
    height = width / PLAYER_ASPECT;
  } else {
    width = height * PLAYER_ASPECT;
  }

  const size = clampPlayerSize(width);
  return {
    x: edge.includes('w') ? start.x + start.width - size.width : start.x,
    y: edge.includes('n') ? start.y + start.height - size.height : start.y,
    width: size.width,
    height: size.height,
  };
}

function stopPlayerResize(): void {
  if (!playerResize) return;
  clearInterval(playerResize.timer);
  if (!playerResize.win.isDestroyed() && !playerResize.win.isFullScreen()) {
    playerResize.win.setAspectRatio(PLAYER_ASPECT);
  }
  playerResize = null;
}

function stopPlayerMove(): void {
  if (!playerMove) return;
  clearInterval(playerMove.timer);
  playerMove = null;
}

function stopPlayerChrome(): void {
  stopPlayerResize();
  stopPlayerMove();
}

function startPlayerMove(win: BrowserWindow): void {
  if (win.isFullScreen()) return;
  stopPlayerChrome();
  const startMouse = screen.getCursorScreenPoint();
  const startBounds = win.getBounds();
  playerMove = {
    win,
    startMouse,
    startBounds,
    timer: setInterval(() => {
      const session = playerMove;
      if (!session || session.win.isDestroyed() || session.win.isFullScreen()) {
        stopPlayerMove();
        return;
      }
      const mouse = screen.getCursorScreenPoint();
      session.win.setPosition(
        session.startBounds.x + (mouse.x - session.startMouse.x),
        session.startBounds.y + (mouse.y - session.startMouse.y),
      );
    }, 16),
  };
}

function togglePlayerFullscreen(win: BrowserWindow): void {
  stopPlayerChrome();
  const next = !win.isFullScreen();
  if (next) win.setAspectRatio(0);
  win.setFullScreen(next);
}

function sendPlayerFullscreen(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.webContents.send('player:fullscreen', win.isFullScreen());
}

function startPlayerResize(win: BrowserWindow, edge: PlayerResizeEdge): void {
  if (win.isFullScreen()) return;
  stopPlayerChrome();
  win.setAspectRatio(0);
  playerResize = {
    win,
    edge,
    startMouse: screen.getCursorScreenPoint(),
    startBounds: win.getBounds(),
    timer: setInterval(() => {
      const session = playerResize;
      if (!session || session.win.isDestroyed()) {
        stopPlayerResize();
        return;
      }
      const mouse = screen.getCursorScreenPoint();
      session.win.setBounds(
        boundsForPlayerResize(
          session.startBounds,
          session.edge,
          mouse.x - session.startMouse.x,
          mouse.y - session.startMouse.y,
        ),
      );
    }, 16),
  };
}

const MEDIA_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

function mimeTypeFor(filePath: string): string {
  return MEDIA_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function parseByteRange(
  header: string | null,
  fileSize: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];
  if (startText === '' && endText === '') return null;

  let start: number;
  let end: number;
  if (startText === '') {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = Number(startText);
    end = endText === '' ? fileSize - 1 : Number(endText);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0) return null;
  if (start >= fileSize) return null;
  end = Math.min(Math.max(end, start), fileSize - 1);
  return { start, end };
}

function nodeStreamToWeb(resultStream: ReadStream): ReadableStream<Uint8Array> {
  resultStream.pause();
  let closed = false;

  return new ReadableStream({
    start(controller) {
      resultStream.on('data', (chunk: Buffer | string) => {
        if (closed) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        controller.enqueue(new Uint8Array(bytes));
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          resultStream.pause();
        }
      });
      resultStream.on('error', (error) => {
        controller.error(error);
      });
      resultStream.on('end', () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
    },
    pull() {
      if (!closed) resultStream.resume();
    },
    cancel() {
      if (closed) return;
      closed = true;
      resultStream.destroy();
    },
  });
}

function fileStreamBody(
  filePath: string,
  start: number,
  end: number,
  signal: AbortSignal | null,
): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(filePath, { start, end });
  signal?.addEventListener(
    'abort',
    () => {
      nodeStream.destroy();
    },
    { once: true },
  );
  return nodeStreamToWeb(nodeStream);
}

async function serveLocalMedia(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('p');
  if (!filePath) {
    return new Response('Missing path', { status: 400 });
  }

  const resolved = path.normalize(filePath);
  let fileSize = 0;
  try {
    const stats = await fs.stat(resolved);
    if (!stats.isFile()) {
      return new Response('Not found', { status: 404 });
    }
    fileSize = stats.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const mime = mimeTypeFor(resolved);
  const range = parseByteRange(request.headers.get('range'), fileSize);
  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, fileSize - 1);
  const chunkSize = fileSize === 0 ? 0 : end - start + 1;
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Content-Length': String(chunkSize),
    'Accept-Ranges': 'bytes',
  };

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    return new Response(fileStreamBody(resolved, start, end, request.signal), {
      status: 206,
      headers,
    });
  }

  return new Response(
    fileSize === 0 ? null : fileStreamBody(resolved, 0, end, request.signal),
    { status: 200, headers },
  );
}

function defaultOutputBounds(): WindowBounds {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const target = displays.find((d) => d.id !== primary.id) ?? primary;
  const { x, y, width, height } = target.workArea;
  return {
    x: x + Math.round((width - PLAYER_WIDTH) / 2),
    y: y + Math.round((height - PLAYER_HEIGHT) / 2),
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}

function loadView(win: BrowserWindow, view: 'control-panel' | 'media-player'): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(`${devUrl}?view=${view}`);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view },
    });
  }
}

function showOutputWindow(): void {
  if (!mediaPlayerWindow || mediaPlayerWindow.isDestroyed()) {
    return;
  }
  mediaPlayerWindow.setTitle(WINDOW_TITLE.output);
  mediaPlayerWindow.setAlwaysOnTop(false);
  mediaPlayerWindow.setContentProtection(false);
  mediaPlayerWindow.showInactive();
}

function sendQuitEvent(event: QuitEvent): void {
  if (!controlPanelWindow || controlPanelWindow.isDestroyed()) return;
  controlPanelWindow.webContents.send('app:quit-event', event);
}

function revealControlPanel(): void {
  if (!controlPanelWindow || controlPanelWindow.isDestroyed()) return;
  if (controlPanelWindow.isMinimized()) controlPanelWindow.restore();
  if (!controlPanelWindow.isVisible()) controlPanelWindow.show();
  controlPanelWindow.moveTop();
  if (!controlPanelWindow.isFocused()) controlPanelWindow.focus();
}

function stopQuitHold(notify = true): void {
  if (!quitHoldTimer) return;
  clearTimeout(quitHoldTimer);
  quitHoldTimer = null;
  if (notify && quitPromptVisible) {
    sendQuitEvent({ type: 'hold-stop' });
    revealControlPanel();
  }
}

function startQuitHold(): boolean {
  if (quitHoldTimer) return false;
  quitHoldTimer = setTimeout(() => {
    quitHoldTimer = null;
    finishQuit();
  }, QUIT_HOLD_MS);
  return true;
}

function promptQuit(mode: 'confirm' | 'hold'): void {
  if (allowQuit) return;
  const already = quitPromptVisible;
  quitPromptVisible = true;
  // Raising/focusing the window during a hold swallows the matching key-up.
  if (mode === 'confirm') revealControlPanel();

  if (mode === 'hold') {
    const started = startQuitHold();
    if (!already) {
      sendQuitEvent({ type: 'prompt', hold: true, durationMs: QUIT_HOLD_MS });
    } else if (started) {
      sendQuitEvent({ type: 'hold-start', durationMs: QUIT_HOLD_MS });
    }
    return;
  }

  if (!already) {
    sendQuitEvent({ type: 'prompt', hold: false, durationMs: QUIT_HOLD_MS });
  }
}

function finishQuit(): void {
  if (allowQuit) return;
  allowQuit = true;
  isQuitting = true;
  quitPromptVisible = false;
  stopQuitHold(false);
  app.quit();
}

function cancelQuitPrompt(): void {
  stopQuitHold();
  quitPromptVisible = false;
}

function isKeyDown(input: Electron.Input): boolean {
  return input.type === 'keyDown' || input.type === 'rawKeyDown';
}

function inputKey(input: Electron.Input): string {
  return (input.key ?? '').toLowerCase();
}

function isQuitShortcut(input: Electron.Input): boolean {
  const key = inputKey(input);
  const isQ = key === 'q' || input.code === 'KeyQ';
  if (!isQ || input.shift || input.alt) return false;
  return process.platform === 'darwin' ? input.meta : input.control;
}

function attachQuitKeyListener(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (
      process.platform !== 'darwin' &&
      win === mediaPlayerWindow &&
      isKeyDown(input) &&
      inputKey(input) === 'escape' &&
      !input.alt &&
      !input.control &&
      !input.meta &&
      !input.shift &&
      win.isFullScreen()
    ) {
      event.preventDefault();
      win.setFullScreen(false);
      return;
    }
    if (isKeyDown(input) && isQuitShortcut(input)) {
      // Do not preventDefault: Chromium then drops the matching key-up
      // (https://github.com/electron/electron/issues/37336), so a tap looks like a hold.
      if (!input.isAutoRepeat) promptQuit('hold');
      return;
    }
    if (!quitHoldTimer) return;
    if (input.type === 'keyUp' || (isKeyDown(input) && inputKey(input) === 'escape')) {
      stopQuitHold();
    }
  });
}

function setApplicationMenu(): void {
  const isMac = process.platform === 'darwin';
  const quitItem: Electron.MenuItemConstructorOptions = {
    label: isMac ? `Quit ${app.name}` : `Close ${app.name}`,
    // macOS menu accelerators swallow the matching key-up, which makes hold-to-quit
    // look like a tap. Handle Command/Control+Q in before-input-event instead.
    ...(!isMac
      ? { accelerator: 'CmdOrCtrl+Q', registerAccelerator: false }
      : {}),
    click: () => {
      promptQuit('confirm');
    },
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              quitItem,
            ],
          } satisfies Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: isMac ? [{ role: 'close' }] : [quitItem],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindows(): Promise<void> {
  const saved = await loadWindowState();
  const controlBounds = usableBounds(saved.control);
  const outputBounds = usableBounds(saved.output) ?? defaultOutputBounds();

  const preload = preloadPath();
  const isDark = nativeTheme.shouldUseDarkColors;
  const icon = appIconImage();
  if (icon && process.platform === 'darwin') {
    app.dock?.setIcon(icon);
  }
  const webPreferences: Electron.WebPreferences = {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };

  controlPanelWindow = new BrowserWindow({
    title: WINDOW_TITLE.control,
    width: controlBounds?.width ?? 520,
    height: controlBounds?.height ?? 800,
    x: controlBounds?.x,
    y: controlBounds?.y,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: isDark ? '#0a0a0a' : '#f4f4f5',
    autoHideMenuBar: true,
    icon,
    webPreferences,
  });

  // Output must stay a normal, focusable window at the default window level.
  // Zoom, Meet, and other capturers skip always-on-top / non-activating overlays.
  mediaPlayerWindow = new BrowserWindow({
    title: WINDOW_TITLE.output,
    width: outputBounds.width,
    height: outputBounds.height,
    x: outputBounds.x,
    y: outputBounds.y,
    minWidth: PLAYER_MIN_WIDTH,
    minHeight: PLAYER_MIN_HEIGHT,
    frame: false,
    roundedCorners: false,
    focusable: true,
    skipTaskbar: false,
    show: false,
    movable: true,
    fullscreenable: true,
    // Native edge-resize on a frameless macOS window eats the outer pixels
    // (and often click-throughs when the window is not key). Custom handles
    // still resize via setBounds.
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    icon,
    webPreferences,
  });

  mediaPlayerWindow.setAspectRatio(PLAYER_ASPECT);
  mediaPlayerWindow.once('ready-to-show', () => {
    showOutputWindow();
  });

  persistWindow(controlPanelWindow);
  persistWindow(mediaPlayerWindow);
  attachQuitKeyListener(controlPanelWindow);
  attachQuitKeyListener(mediaPlayerWindow);
  mediaPlayerWindow.on('enter-full-screen', () => {
    stopPlayerChrome();
    if (mediaPlayerWindow && !mediaPlayerWindow.isDestroyed()) {
      mediaPlayerWindow.setAspectRatio(0);
      sendPlayerFullscreen(mediaPlayerWindow);
    }
  });
  mediaPlayerWindow.on('leave-full-screen', () => {
    if (mediaPlayerWindow && !mediaPlayerWindow.isDestroyed()) {
      mediaPlayerWindow.setAspectRatio(PLAYER_ASPECT);
      sendPlayerFullscreen(mediaPlayerWindow);
    }
  });
  mediaPlayerWindow.webContents.on('did-finish-load', () => {
    if (mediaPlayerWindow && !mediaPlayerWindow.isDestroyed()) {
      sendPlayerFullscreen(mediaPlayerWindow);
    }
  });
  mediaPlayerWindow.on('closed', () => {
    stopPlayerChrome();
  });

  controlPanelWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    controlPanelWindow?.setTitle(WINDOW_TITLE.control);
  });
  mediaPlayerWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mediaPlayerWindow?.setTitle(WINDOW_TITLE.output);
  });

  mediaPlayerWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
    }
  });

  controlPanelWindow.on('close', (event) => {
    if (allowQuit) return;
    event.preventDefault();
    promptQuit('confirm');
  });

  controlPanelWindow.on('closed', () => {
    controlPanelWindow = null;
    isQuitting = true;
    mediaPlayerWindow?.destroy();
    mediaPlayerWindow = null;
    app.quit();
  });

  loadView(controlPanelWindow, 'control-panel');
  loadView(mediaPlayerWindow, 'media-player');
}

function registerIpc(): void {
  ipcMain.handle('media:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media',
          extensions: [...VIDEO_DIALOG_EXTENSIONS, ...IMAGE_DIALOG_EXTENSIONS],
        },
        { name: 'Video', extensions: VIDEO_DIALOG_EXTENSIONS },
        { name: 'Images', extensions: IMAGE_DIALOG_EXTENSIONS },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('media:pick-blank-image', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose blank still',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_DIALOG_EXTENSIONS }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('playlist:export', async (_event, playlist: PlaylistData, settings: AppSettings) => {
    const result = await dialog.showSaveDialog({
      title: 'Save playlist',
      defaultPath: playlistSaveFileName(playlist.name),
      filters: PLAYLIST_DIALOG_FILTERS,
    });
    if (result.canceled || !result.filePath) {
      return false;
    }
    await writeJsonFile(result.filePath, { ...playlist, settings });
    return true;
  });

  ipcMain.handle('playlist:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open playlist',
      properties: ['openFile'],
      filters: PLAYLIST_DIALOG_FILTERS,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return readJsonFile<unknown>(result.filePaths[0], null);
  });

  ipcMain.handle('playlist:read-file', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isPlaylistFilePath(filePath)) {
      return null;
    }
    return readJsonFile<unknown>(filePath, null);
  });

  ipcMain.handle('persist:load', async () => {
    rememberOpenedMedia(takeOpenedMediaBuffer());
    controlRendererReady = true;
    const settings = await readJsonFile<AppSettings>(settingsPath(), DEFAULT_SETTINGS);
    const openedPlaylist = pendingOpenedPlaylist;
    const openedMedia = pendingOpenedMedia;
    pendingOpenedPlaylist = null;
    pendingOpenedMedia = [];
    return {
      settings: normalizeSettings(settings) ?? DEFAULT_SETTINGS,
      openedPlaylist,
      openedMedia,
    };
  });

  ipcMain.handle('persist:save-settings', async (_event, settings: AppSettings) => {
    await writeJsonFile(settingsPath(), settings);
  });

  ipcMain.handle('player:reveal', () => {
    showOutputWindow();
  });

  ipcMain.on('player:resize-start', (event, edge: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win !== mediaPlayerWindow || win.isDestroyed()) return;
    if (typeof edge !== 'string' || !PLAYER_RESIZE_EDGES.has(edge as PlayerResizeEdge)) return;
    startPlayerResize(win, edge as PlayerResizeEdge);
  });

  ipcMain.on('player:resize-end', () => {
    stopPlayerResize();
  });

  ipcMain.on('player:move-start', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win !== mediaPlayerWindow || win.isDestroyed()) return;
    startPlayerMove(win);
  });

  ipcMain.on('player:move-end', () => {
    stopPlayerMove();
  });

  ipcMain.on('player:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win !== mediaPlayerWindow || win.isDestroyed()) return;
    togglePlayerFullscreen(win);
  });

  ipcMain.on('app:quit-confirm', () => {
    finishQuit();
  });

  ipcMain.on('app:quit-cancel', () => {
    cancelQuitPrompt();
  });

  ipcMain.on('app:quit-hold-release', () => {
    stopQuitHold();
  });
}

app.setName('Media Share');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.MediaShare.MediaShare');
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  void ingestOpenedPath(filePath);
});

const isPrimaryInstance = !app.isPackaged || app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
} else {
  if (app.isPackaged) {
    app.on('second-instance', (_event, argv) => {
      void ingestArgv(argv);
      if (controlPanelWindow && !controlPanelWindow.isDestroyed()) {
        if (controlPanelWindow.isMinimized()) controlPanelWindow.restore();
        controlPanelWindow.focus();
      }
    });
  }

  app.whenReady().then(async () => {
    protocol.handle('media-share', (request) => serveLocalMedia(request));

    registerIpc();
    setApplicationMenu();
    if (process.platform === 'darwin') {
      app.setAboutPanelOptions({
        applicationName: app.name,
        iconPath: windowIconPath(),
      });
    }
    await removeLegacyPlaylist();
    await ingestArgv(process.argv);
    await createWindows();
  });

  app.on('before-quit', (event) => {
    if (allowQuit) {
      isQuitting = true;
      void saveWindowState();
      return;
    }
    event.preventDefault();
    if (!quitPromptVisible) promptQuit('confirm');
  });

  app.on('will-quit', (event) => {
    if (allowQuit) return;
    event.preventDefault();
    if (!quitPromptVisible) promptQuit('confirm');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      isQuitting = false;
      allowQuit = false;
      quitPromptVisible = false;
      stopQuitHold(false);
      void createWindows();
    } else {
      showOutputWindow();
      controlPanelWindow?.show();
    }
  });
}
