import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api';
import { useAuth } from './auth';

let socket: Socket | null = null;

/** One shared connection per logged-in user. Reconnects with a fresh token. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
      auth: (cb) => cb({ token: getAccessToken() }),
    });
    socket.on('connect_error', async (err) => {
      // Access tokens are short-lived; refresh and let socket.io retry.
      if (err.message === 'unauthorized') await refreshSession();
    });
  }
  return socket;
}

export function useRealtimeConnection() {
  const { user } = useAuth();
  useEffect(() => {
    const s = getSocket();
    if (user) s.connect();
    else s.disconnect();
  }, [user]);
}

/** Subscribe to a server event for the lifetime of the component. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}
