import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuBoard, QRItem, SlideItem, PresentationSettings } from '../types';

const STORAGE_KEYS = {
  MENU_BOARDS: '@tdsqr/menu_boards',
  // Legacy keys for migration
  LEGACY_QR_ITEMS: '@tdsqr/controller_qr_items',
  LEGACY_SLIDE_ITEMS: '@tdsqr/controller_slide_items',
  LEGACY_SETTINGS: '@tdsqr/controller_settings',
};

const DEFAULT_SETTINGS: PresentationSettings = {
  slideInterval: 5,
  autoLoop: true,
  showIndicators: true,
  transition: 'fade',
};

export function useMenuBoards() {
  const [boards, setBoards] = useState<MenuBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationComplete, setMigrationComplete] = useState(false);

  const loadBoards = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MENU_BOARDS);
      if (data) {
        setBoards(JSON.parse(data));
      }
    } catch (error) {
      console.error('[useMenuBoards] Error loading boards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBoards = useCallback(async (newBoards: MenuBoard[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MENU_BOARDS, JSON.stringify(newBoards));
      setBoards(newBoards);
    } catch (error) {
      console.error('[useMenuBoards] Error saving boards:', error);
    }
  }, []);

  const migrateFromLegacy = useCallback(async () => {
    try {
      // Check if we already have boards
      const existingData = await AsyncStorage.getItem(STORAGE_KEYS.MENU_BOARDS);
      if (existingData) {
        const existingBoards = JSON.parse(existingData);
        if (existingBoards.length > 0) {
          setMigrationComplete(true);
          return; // Already have boards, skip migration
        }
      }

      // Load legacy data
      const [qrData, slideData, settingsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LEGACY_QR_ITEMS),
        AsyncStorage.getItem(STORAGE_KEYS.LEGACY_SLIDE_ITEMS),
        AsyncStorage.getItem(STORAGE_KEYS.LEGACY_SETTINGS),
      ]);

      const legacyQRs: QRItem[] = qrData ? JSON.parse(qrData) : [];
      const legacySlides: SlideItem[] = slideData ? JSON.parse(slideData) : [];
      const legacySettings: Partial<PresentationSettings> = settingsData ? JSON.parse(settingsData) : {};

      // Only migrate if there's content
      if (legacyQRs.length > 0 || legacySlides.length > 0) {
        const defaultBoard: MenuBoard = {
          id: Date.now().toString(),
          name: 'Default',
          description: 'Migrated from previous version',
          qrItems: legacyQRs,
          slideItems: legacySlides,
          settings: { ...DEFAULT_SETTINGS, ...legacySettings },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveBoards([defaultBoard]);

        // Clean up legacy keys
        await Promise.all([
          AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_QR_ITEMS),
          AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_SLIDE_ITEMS),
          AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_SETTINGS),
        ]);

        console.log('[useMenuBoards] Migration completed successfully');
      }
    } catch (error) {
      console.error('[useMenuBoards] Migration error:', error);
    } finally {
      setMigrationComplete(true);
    }
  }, [saveBoards]);

  const addBoard = useCallback(async (board: Omit<MenuBoard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newBoard: MenuBoard = {
      ...board,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newBoards = [...boards, newBoard];
    await saveBoards(newBoards);
    return newBoard;
  }, [boards, saveBoards]);

  const updateBoard = useCallback(async (id: string, updates: Partial<Omit<MenuBoard, 'id' | 'createdAt'>>) => {
    const newBoards = boards.map(board => {
      if (board.id === id) {
        return {
          ...board,
          ...updates,
          updatedAt: Date.now(),
        };
      }
      return board;
    });
    await saveBoards(newBoards);
  }, [boards, saveBoards]);

  const deleteBoard = useCallback(async (id: string) => {
    const newBoards = boards.filter(board => board.id !== id);
    await saveBoards(newBoards);
  }, [boards, saveBoards]);

  const getBoard = useCallback((id: string) => {
    return boards.find(board => board.id === id);
  }, [boards]);

  const createEmptyBoard = useCallback((): Omit<MenuBoard, 'id' | 'createdAt' | 'updatedAt'> => {
    return {
      name: '',
      description: '',
      qrItems: [],
      slideItems: [],
      settings: { ...DEFAULT_SETTINGS },
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadBoards();
      await migrateFromLegacy();
    };
    initialize();
  }, [loadBoards, migrateFromLegacy]);

  return {
    boards,
    loading: loading || !migrationComplete,
    addBoard,
    updateBoard,
    deleteBoard,
    getBoard,
    createEmptyBoard,
    refresh: loadBoards,
  };
}
