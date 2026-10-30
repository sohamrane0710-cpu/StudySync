import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../api/client';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

export function getCollaborationSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(`${WS_BASE_URL}/collaboration`, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        const currentToken = getAuthToken();
        cb({
          token: currentToken ? `Bearer ${currentToken.trim()}` : undefined,
        });
      },
    });

    socketInstance.on('connect', () => {
      // connected successfully
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Collaboration socket connect error:', err.message);
    });
  }

  return socketInstance;
}

export function connectCollaborationSocket() {
  const socket = getCollaborationSocket();
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectCollaborationSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
