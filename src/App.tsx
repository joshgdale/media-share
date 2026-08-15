import { useLayoutEffect } from 'react';
import { ControlPanel } from './components/control-panel/ControlPanel';
import { MediaPlayer } from './components/media-player/MediaPlayer';

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');
  const isPlayer = view === 'media-player';

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('media-player-root', isPlayer);
    document.title = isPlayer ? 'Media Share Output' : 'Media Share Control';
  }, [isPlayer]);

  if (isPlayer) {
    return <MediaPlayer />;
  }
  return <ControlPanel />;
}
