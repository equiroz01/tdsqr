import { Platform } from 'react-native';
import * as Device from 'expo-constants';

// Detect if running on Android TV
export function isAndroidTV(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Check if it's a TV device using the device type from manifest
  // Android TV devices have the leanback feature
  try {
    // @ts-ignore - accessing native constants
    const uiMode = Platform.constants?.uiMode as number | undefined;
    // UI_MODE_TYPE_TELEVISION = 4
    if (typeof uiMode === 'number' && (uiMode & 0x0f) === 4) {
      return true;
    }
  } catch (e) {
    // Ignore errors
  }

  // Fallback: check device name patterns common in Android TV
  const deviceName = Device.default?.deviceName?.toLowerCase() || '';
  const tvPatterns = ['tv', 'android tv', 'fire tv', 'shield', 'mi box', 'chromecast', 'ar2101', 'noblex'];

  return tvPatterns.some(pattern => deviceName.includes(pattern));
}

export function getDeviceType(): 'tv' | 'mobile' | 'tablet' {
  if (isAndroidTV()) {
    return 'tv';
  }

  // Could add tablet detection here if needed
  return 'mobile';
}
