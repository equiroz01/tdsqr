export interface QRItem {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

export interface SlideItem {
  id: string;
  name: string;
  imageUri: string;
  createdAt: number;
}

export interface PresentationSettings {
  slideInterval: number; // in seconds (3, 5, 10)
  autoLoop: boolean;
  showIndicators: boolean;
}
