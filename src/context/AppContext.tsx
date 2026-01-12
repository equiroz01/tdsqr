import React, { createContext, useContext, useState, useCallback } from 'react';
import { QRItem, SlideItem, TransitionType } from '../types';

export type AppMode = 'select' | 'tv' | 'control';

interface AppState {
  mode: AppMode;
  isConnected: boolean;
  connectionInfo: {
    ip: string;
    pin: string;
  } | null;
  content: {
    qrItems: QRItem[];
    slideItems: SlideItem[];
    currentIndex: number;
    isPlaying: boolean;
    interval: number;
    transition: TransitionType;
  };
}

interface AppContextType extends AppState {
  setMode: (mode: AppMode) => void;
  setConnected: (connected: boolean) => void;
  setConnectionInfo: (info: { ip: string; pin: string } | null) => void;
  addQRItem: (item: QRItem) => void;
  addSlideItem: (item: SlideItem) => void;
  removeQRItem: (id: string) => void;
  removeSlideItem: (id: string) => void;
  setContent: (qrItems: QRItem[], slideItems: SlideItem[]) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setInterval: (interval: number) => void;
  setTransition: (transition: TransitionType) => void;
  clearContent: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    mode: 'select',
    isConnected: false,
    connectionInfo: null,
    content: {
      qrItems: [],
      slideItems: [],
      currentIndex: 0,
      isPlaying: true,
      interval: 5,
      transition: 'fade',
    },
  });

  const setMode = useCallback((mode: AppMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const setConnected = useCallback((isConnected: boolean) => {
    setState((prev) => ({ ...prev, isConnected }));
  }, []);

  const setConnectionInfo = useCallback((connectionInfo: { ip: string; pin: string } | null) => {
    setState((prev) => ({ ...prev, connectionInfo }));
  }, []);

  const addQRItem = useCallback((item: QRItem) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        qrItems: [...prev.content.qrItems, item],
      },
    }));
  }, []);

  const addSlideItem = useCallback((item: SlideItem) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        slideItems: [...prev.content.slideItems, item],
      },
    }));
  }, []);

  const removeQRItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        qrItems: prev.content.qrItems.filter((item) => item.id !== id),
      },
    }));
  }, []);

  const removeSlideItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        slideItems: prev.content.slideItems.filter((item) => item.id !== id),
      },
    }));
  }, []);

  const setContent = useCallback((qrItems: QRItem[], slideItems: SlideItem[]) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        qrItems,
        slideItems,
      },
    }));
  }, []);

  const setCurrentIndex = useCallback((currentIndex: number) => {
    setState((prev) => ({
      ...prev,
      content: { ...prev.content, currentIndex },
    }));
  }, []);

  const setIsPlaying = useCallback((isPlaying: boolean) => {
    setState((prev) => ({
      ...prev,
      content: { ...prev.content, isPlaying },
    }));
  }, []);

  const setInterval = useCallback((interval: number) => {
    setState((prev) => ({
      ...prev,
      content: { ...prev.content, interval },
    }));
  }, []);

  const setTransition = useCallback((transition: TransitionType) => {
    setState((prev) => ({
      ...prev,
      content: { ...prev.content, transition },
    }));
  }, []);

  const clearContent = useCallback(() => {
    setState((prev) => ({
      ...prev,
      content: {
        qrItems: [],
        slideItems: [],
        currentIndex: 0,
        isPlaying: true,
        interval: 5,
        transition: 'fade',
      },
    }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setMode,
        setConnected,
        setConnectionInfo,
        addQRItem,
        addSlideItem,
        removeQRItem,
        removeSlideItem,
        setContent,
        setCurrentIndex,
        setIsPlaying,
        setInterval,
        setTransition,
        clearContent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
