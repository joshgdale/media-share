import { useCallback, useEffect, useRef } from 'react';
import { CHANNEL_NAME, type SyncMessage } from '../types';

export function useBroadcastChannel(
  onMessage: (message: SyncMessage) => void,
): (message: SyncMessage) => void {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      handlerRef.current(event.data);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return useCallback((message: SyncMessage) => {
    channelRef.current?.postMessage(message);
  }, []);
}
