// Communication bridge for TV-Control communication
// This provides in-app communication for demo/development
// For production cross-device communication, use a signaling server or bare workflow

import { QRItem, SlideItem } from '../types';

type MessageType =
  | 'auth'
  | 'auth_success'
  | 'auth_failed'
  | 'content_update'
  | 'start_presentation'
  | 'stop_presentation'
  | 'next_slide'
  | 'prev_slide'
  | 'go_to_slide';

interface Message {
  type: MessageType;
  [key: string]: any;
}

type MessageHandler = (message: Message) => void;
type ConnectionHandler = (connected: boolean) => void;

class CommunicationBridge {
  private static instance: CommunicationBridge;
  private tvPin: string = '';
  private isControlConnected: boolean = false;
  private tvMessageHandler: MessageHandler | null = null;
  private controlMessageHandler: MessageHandler | null = null;
  private tvConnectionHandler: ConnectionHandler | null = null;
  private controlConnectionHandler: ConnectionHandler | null = null;
  private content: { qrItems: QRItem[]; slideItems: SlideItem[] } = {
    qrItems: [],
    slideItems: [],
  };

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): CommunicationBridge {
    if (!CommunicationBridge.instance) {
      CommunicationBridge.instance = new CommunicationBridge();
    }
    return CommunicationBridge.instance;
  }

  // TV Mode Methods
  initializeTV(pin: string) {
    this.tvPin = pin;
    this.isControlConnected = false;
    console.log('[Bridge] TV initialized with PIN:', pin);
  }

  onTVMessage(handler: MessageHandler) {
    this.tvMessageHandler = handler;
  }

  onTVConnection(handler: ConnectionHandler) {
    this.tvConnectionHandler = handler;
  }

  sendToControl(message: Message) {
    console.log('[Bridge] TV -> Control:', message);
    setTimeout(() => {
      this.controlMessageHandler?.(message);
    }, 100);
  }

  stopTV() {
    this.tvPin = '';
    this.isControlConnected = false;
    this.tvMessageHandler = null;
    this.tvConnectionHandler = null;
  }

  // Control Mode Methods
  connectToTV(pin: string): boolean {
    console.log('[Bridge] Control attempting connection with PIN:', pin);
    if (pin === this.tvPin) {
      this.isControlConnected = true;
      this.tvConnectionHandler?.(true);
      this.controlConnectionHandler?.(true);

      // Send auth success after small delay
      setTimeout(() => {
        this.controlMessageHandler?.({ type: 'auth_success' });
      }, 200);

      return true;
    } else {
      setTimeout(() => {
        this.controlMessageHandler?.({ type: 'auth_failed', message: 'PIN incorrecto' });
      }, 200);
      return false;
    }
  }

  onControlMessage(handler: MessageHandler) {
    this.controlMessageHandler = handler;
  }

  onControlConnection(handler: ConnectionHandler) {
    this.controlConnectionHandler = handler;
  }

  sendToTV(message: Message) {
    console.log('[Bridge] Control -> TV:', message);
    if (this.isControlConnected) {
      setTimeout(() => {
        this.tvMessageHandler?.(message);
      }, 100);
    }
  }

  disconnectControl() {
    this.isControlConnected = false;
    this.controlMessageHandler = null;
    this.controlConnectionHandler = null;
    this.tvConnectionHandler?.(false);
  }

  // Shared state
  isConnected(): boolean {
    return this.isControlConnected;
  }

  getTVPin(): string {
    return this.tvPin;
  }

  setContent(qrItems: QRItem[], slideItems: SlideItem[]) {
    this.content = { qrItems, slideItems };
  }

  getContent() {
    return this.content;
  }
}

export const bridge = CommunicationBridge.getInstance();
