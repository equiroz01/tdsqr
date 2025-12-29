import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QRItem, SlideItem, PresentationSettings } from '../types';

const STORAGE_KEYS = {
  QR_ITEMS: '@tdsqr/qr_items',
  SLIDE_ITEMS: '@tdsqr/slide_items',
  SETTINGS: '@tdsqr/settings',
};

const DEFAULT_SETTINGS: PresentationSettings = {
  slideInterval: 5,
  autoLoop: true,
  showIndicators: true,
};

export function useQRItems() {
  const [items, setItems] = useState<QRItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QR_ITEMS);
      if (data) {
        setItems(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading QR items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveItems = useCallback(async (newItems: QRItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.QR_ITEMS, JSON.stringify(newItems));
      setItems(newItems);
    } catch (error) {
      console.error('Error saving QR items:', error);
    }
  }, []);

  const addItem = useCallback(async (item: Omit<QRItem, 'id' | 'createdAt'>) => {
    const newItem: QRItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const newItems = [...items, newItem];
    await saveItems(newItems);
    return newItem;
  }, [items, saveItems]);

  const deleteItem = useCallback(async (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    await saveItems(newItems);
  }, [items, saveItems]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return { items, loading, addItem, deleteItem, refresh: loadItems };
}

export function useSlideItems() {
  const [items, setItems] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SLIDE_ITEMS);
      if (data) {
        setItems(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading slide items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveItems = useCallback(async (newItems: SlideItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SLIDE_ITEMS, JSON.stringify(newItems));
      setItems(newItems);
    } catch (error) {
      console.error('Error saving slide items:', error);
    }
  }, []);

  const addItem = useCallback(async (item: Omit<SlideItem, 'id' | 'createdAt'>) => {
    const newItem: SlideItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const newItems = [...items, newItem];
    await saveItems(newItems);
    return newItem;
  }, [items, saveItems]);

  const deleteItem = useCallback(async (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    await saveItems(newItems);
  }, [items, saveItems]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return { items, loading, addItem, deleteItem, refresh: loadItems };
}

export function useSettings() {
  const [settings, setSettings] = useState<PresentationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<PresentationSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      setSettings(updated);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return { settings, loading, updateSettings };
}
