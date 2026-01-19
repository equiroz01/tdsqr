import { Dimensions, PixelRatio, Platform } from 'react-native';

// Base dimensions (designed for a standard mobile screen)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Get current screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Determine if it's a TV-like screen (large screen with landscape orientation typical of TVs)
const isLargeScreen = SCREEN_WIDTH > 1200 || SCREEN_HEIGHT > 1200;
const isLandscape = SCREEN_WIDTH > SCREEN_HEIGHT;
const isTV = isLargeScreen && (Platform.isTV || isLandscape);

// Calculate scale factors
// For TV screens, we use a different base to ensure UI elements are visible
const TV_BASE_WIDTH = 1920;
const TV_BASE_HEIGHT = 1080;

// Scale factor based on width
const widthScale = isTV
  ? SCREEN_WIDTH / TV_BASE_WIDTH
  : SCREEN_WIDTH / BASE_WIDTH;

// Scale factor based on height
const heightScale = isTV
  ? SCREEN_HEIGHT / TV_BASE_HEIGHT
  : SCREEN_HEIGHT / BASE_HEIGHT;

// Use the smaller scale to ensure nothing overflows
const scale = Math.min(widthScale, heightScale);

// For TV, we want elements to be larger and more visible
const tvMultiplier = isTV ? 1.2 : 1;

/**
 * Scale a size value based on screen width
 * @param size - The size to scale (designed for BASE_WIDTH)
 * @returns Scaled size appropriate for current screen
 */
export function wp(size: number): number {
  const scaled = size * widthScale * tvMultiplier;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Scale a size value based on screen height
 * @param size - The size to scale (designed for BASE_HEIGHT)
 * @returns Scaled size appropriate for current screen
 */
export function hp(size: number): number {
  const scaled = size * heightScale * tvMultiplier;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Scale a font size appropriately
 * Fonts scale more conservatively to maintain readability
 * @param size - The font size to scale
 * @returns Scaled font size
 */
export function sp(size: number): number {
  // For TVs, fonts need to be significantly larger
  const fontScale = isTV ? scale * 1.8 : scale;
  const scaled = size * fontScale;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Scale a size uniformly using the minimum scale factor
 * Good for elements that should maintain aspect ratio
 * @param size - The size to scale
 * @returns Scaled size
 */
export function ms(size: number): number {
  const scaled = size * scale * tvMultiplier;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Get percentage of screen width
 * @param percentage - Percentage of screen width (0-100)
 * @returns Pixel value
 */
export function widthPercent(percentage: number): number {
  return Math.round((SCREEN_WIDTH * percentage) / 100);
}

/**
 * Get percentage of screen height
 * @param percentage - Percentage of screen height (0-100)
 * @returns Pixel value
 */
export function heightPercent(percentage: number): number {
  return Math.round((SCREEN_HEIGHT * percentage) / 100);
}

// Export screen info for conditional rendering
export const screenInfo = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isTV,
  isLandscape,
  isLargeScreen,
  scale,
};

// Common scaled values for consistency
export const responsive = {
  // Spacing
  xs: ms(4),
  sm: ms(8),
  md: ms(16),
  lg: ms(24),
  xl: ms(32),
  xxl: ms(48),

  // Font sizes
  fontTiny: sp(10),
  fontSmall: sp(12),
  fontMedium: sp(14),
  fontLarge: sp(16),
  fontXLarge: sp(18),
  fontXXLarge: sp(24),
  fontHuge: sp(32),
  fontMassive: sp(48),

  // Border radius
  radiusSm: ms(4),
  radiusMd: ms(8),
  radiusLg: ms(12),
  radiusXl: ms(16),
  radiusRound: ms(9999),

  // Icon sizes
  iconSm: ms(16),
  iconMd: ms(24),
  iconLg: ms(32),
  iconXl: ms(48),
};
