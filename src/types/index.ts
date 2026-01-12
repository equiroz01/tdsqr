export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'deleting';

export interface QRItem {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  syncStatus?: SyncStatus;
}

export interface SlideItem {
  id: string;
  name: string;
  imageUri: string;
  imageBase64?: string; // Base64 encoded image for network transfer
  createdAt: number;
  syncStatus?: SyncStatus;
}

export interface PresentationSettings {
  slideInterval: number; // in seconds (3, 5, 10)
  autoLoop: boolean;
  showIndicators: boolean;
}
