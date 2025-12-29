// WebSocket server simulation for TV mode
// In a real scenario, we'd use a native WebSocket server
// For this app, we simulate server behavior within the app

import { PORT } from './NetworkService';

type MessageHandler = (data: any) => void;
type ConnectionHandler = (clientId: string) => void;

interface ConnectedClient {
  id: string;
  lastSeen: number;
  authenticated: boolean;
}

class WebSocketServer {
  private clients: Map<string, ConnectedClient> = new Map();
  private messageQueue: any[] = [];
  private onMessageHandler: MessageHandler | null = null;
  private onConnectionHandler: ConnectionHandler | null = null;
  private isRunning = false;
  private expectedPin: string = '';

  start() {
    this.isRunning = true;
    console.log(`Server started on port ${PORT}`);
  }

  stop() {
    this.isRunning = false;
    this.clients.clear();
    this.messageQueue = [];
  }

  setExpectedPin(pin: string) {
    this.expectedPin = pin;
  }

  onMessage(handler: MessageHandler) {
    this.onMessageHandler = handler;
  }

  onConnection(handler: ConnectionHandler) {
    this.onConnectionHandler = handler;
  }

  // Simulate receiving a message from client
  receiveMessage(clientId: string, data: any) {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, {
        id: clientId,
        lastSeen: Date.now(),
        authenticated: false
      });
      this.onConnectionHandler?.(clientId);
    }

    const client = this.clients.get(clientId)!;
    client.lastSeen = Date.now();

    this.onMessageHandler?.(data);
  }

  // Queue message to send to all authenticated clients
  broadcast(data: any) {
    this.messageQueue.push(data);
  }

  // Send to specific client
  sendToClient(clientId: string, data: any) {
    // In a real implementation, this would send via WebSocket
    console.log('Sending to client:', clientId, data);
  }

  getQueuedMessages(): any[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }

  getConnectedClients(): number {
    const now = Date.now();
    for (const [id, client] of this.clients) {
      if (now - client.lastSeen > 30000) {
        this.clients.delete(id);
      }
    }
    return this.clients.size;
  }

  getAuthenticatedClients(): number {
    let count = 0;
    for (const [_, client] of this.clients) {
      if (client.authenticated) count++;
    }
    return count;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const server = new WebSocketServer();
