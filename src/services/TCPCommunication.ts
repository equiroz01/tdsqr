import TcpSocket from 'react-native-tcp-socket';
import { getLocalIP, PORT } from './NetworkService';
import { QRItem, SlideItem } from '../types';

type MessageType =
  | 'auth'
  | 'auth_success'
  | 'auth_failed'
  | 'content_update'
  | 'content_received'
  | 'sync_request'
  | 'start_presentation'
  | 'stop_presentation'
  | 'ping'
  | 'pong';

interface Message {
  type: MessageType;
  [key: string]: any;
}

type MessageHandler = (message: Message) => void;
type ConnectionHandler = (connected: boolean) => void;

// TCP Server for TV Mode
class TVServer {
  private server: any = null;
  private clients: Map<number, any> = new Map();
  private pin: string = '';
  private messageHandler: MessageHandler | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private clientIdCounter: number = 0;
  private authenticatedClients: Set<number> = new Set();

  async start(pin: string): Promise<string> {
    this.pin = pin;
    this.authenticatedClients.clear();

    return new Promise((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket) => {
          const clientId = ++this.clientIdCounter;
          this.clients.set(clientId, socket);

          console.log('[TVServer] Client connected:', clientId);

          let buffer = '';

          socket.on('data', (data: Buffer | string) => {
            buffer += data.toString();

            // Process complete messages (separated by newlines)
            const messages = buffer.split('\n');
            buffer = messages.pop() || '';

            for (const msgStr of messages) {
              if (msgStr.trim()) {
                try {
                  const message = JSON.parse(msgStr);
                  this.handleMessage(clientId, message);
                } catch (e) {
                  console.error('[TVServer] Failed to parse message:', e);
                }
              }
            }
          });

          socket.on('error', (error: Error) => {
            console.error('[TVServer] Socket error:', error);
            this.removeClient(clientId);
          });

          socket.on('close', () => {
            console.log('[TVServer] Client disconnected:', clientId);
            this.removeClient(clientId);
          });
        });

        this.server.on('error', (error: Error) => {
          console.error('[TVServer] Server error:', error);
          reject(error);
        });

        this.server.listen({ port: PORT, host: '0.0.0.0' }, async () => {
          const ip = await getLocalIP();
          console.log('[TVServer] Listening on', ip, ':', PORT);
          resolve(ip);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(clientId: number, message: Message) {
    console.log('[TVServer] Received from', clientId, ':', message.type);

    switch (message.type) {
      case 'auth':
        if (message.pin === this.pin) {
          this.authenticatedClients.add(clientId);
          this.sendToClient(clientId, { type: 'auth_success' });
          this.connectionHandler?.(true);
          console.log('[TVServer] Client authenticated:', clientId);
        } else {
          this.sendToClient(clientId, { type: 'auth_failed', message: 'PIN incorrecto' });
          console.log('[TVServer] Auth failed for client:', clientId);
        }
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;

      default:
        if (this.authenticatedClients.has(clientId)) {
          this.messageHandler?.(message);
        }
        break;
    }
  }

  private sendToClient(clientId: number, message: Message) {
    const socket = this.clients.get(clientId);
    if (socket) {
      try {
        socket.write(JSON.stringify(message) + '\n');
      } catch (e) {
        console.error('[TVServer] Failed to send:', e);
      }
    }
  }

  sendToAll(message: Message) {
    const msgStr = JSON.stringify(message) + '\n';
    for (const [clientId, socket] of this.clients) {
      if (this.authenticatedClients.has(clientId)) {
        try {
          socket.write(msgStr);
        } catch (e) {
          console.error('[TVServer] Failed to send to', clientId, ':', e);
        }
      }
    }
  }

  private removeClient(clientId: number) {
    this.clients.delete(clientId);
    this.authenticatedClients.delete(clientId);
    if (this.authenticatedClients.size === 0) {
      this.connectionHandler?.(false);
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandler = handler;
  }

  stop() {
    for (const socket of this.clients.values()) {
      try {
        socket.destroy();
      } catch (e) {}
    }
    this.clients.clear();
    this.authenticatedClients.clear();

    if (this.server) {
      try {
        this.server.close();
      } catch (e) {}
      this.server = null;
    }
  }

  getPin(): string {
    return this.pin;
  }

  isClientConnected(): boolean {
    return this.authenticatedClients.size > 0;
  }
}

// TCP Client for Control Mode
class ControlClient {
  private socket: any = null;
  private messageHandler: MessageHandler | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private connected: boolean = false;
  private reconnectTimer: any = null;

  async connect(ip: string, pin: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.socket = TcpSocket.createConnection(
          { port: PORT, host: ip },
          () => {
            console.log('[ControlClient] Connected to', ip);
            // Send auth message
            this.send({ type: 'auth', pin });
          }
        );

        let buffer = '';
        let authResolved = false;

        this.socket.on('data', (data: Buffer | string) => {
          buffer += data.toString();

          const messages = buffer.split('\n');
          buffer = messages.pop() || '';

          for (const msgStr of messages) {
            if (msgStr.trim()) {
              try {
                const message = JSON.parse(msgStr);

                if (message.type === 'auth_success' && !authResolved) {
                  authResolved = true;
                  this.connected = true;
                  this.connectionHandler?.(true);
                  resolve(true);
                } else if (message.type === 'auth_failed' && !authResolved) {
                  authResolved = true;
                  this.disconnect();
                  this.messageHandler?.(message);
                  resolve(false);
                } else {
                  this.messageHandler?.(message);
                }
              } catch (e) {
                console.error('[ControlClient] Failed to parse:', e);
              }
            }
          }
        });

        this.socket.on('error', (error: Error) => {
          console.error('[ControlClient] Error:', error);
          if (!authResolved) {
            authResolved = true;
            resolve(false);
          }
          this.handleDisconnect();
        });

        this.socket.on('close', () => {
          console.log('[ControlClient] Connection closed');
          this.handleDisconnect();
        });

        // Timeout for connection
        setTimeout(() => {
          if (!authResolved) {
            authResolved = true;
            this.disconnect();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('[ControlClient] Connection failed:', error);
        resolve(false);
      }
    });
  }

  private handleDisconnect() {
    if (this.connected) {
      this.connected = false;
      this.connectionHandler?.(false);
    }
  }

  send(message: Message) {
    if (this.socket) {
      try {
        this.socket.write(JSON.stringify(message) + '\n');
      } catch (e) {
        console.error('[ControlClient] Failed to send:', e);
      }
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandler = handler;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (e) {}
      this.socket = null;
    }

    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instances
export const tvServer = new TVServer();
export const controlClient = new ControlClient();
