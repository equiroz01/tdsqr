import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useQRItems, useSlideItems, useSettings } from '../src/hooks/useStorage';
import { QRItem, SlideItem } from '../src/types';

type ContentItem =
  | { type: 'qr'; data: QRItem }
  | { type: 'slide'; data: SlideItem };

export default function PresentationScreen() {
  const router = useRouter();
  const { items: qrItems } = useQRItems();
  const { items: slideItems } = useSlideItems();
  const { settings, updateSettings } = useSettings();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allContent: ContentItem[] = [
    ...qrItems.map((item): ContentItem => ({ type: 'qr', data: item })),
    ...slideItems.map((item): ContentItem => ({ type: 'slide', data: item })),
  ];

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const goToNext = useCallback(() => {
    if (allContent.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % allContent.length);
  }, [allContent.length]);

  const goToPrev = useCallback(() => {
    if (allContent.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + allContent.length) % allContent.length);
  }, [allContent.length]);

  useEffect(() => {
    if (isPaused || allContent.length <= 1) return;

    timerRef.current = setTimeout(() => {
      goToNext();
    }, settings.slideInterval * 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isPaused, settings.slideInterval, allContent.length, goToNext]);

  useEffect(() => {
    if (showControls) {
      hideControlsAfterDelay();
    }
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [showControls, hideControlsAfterDelay]);

  const handleScreenPress = () => {
    setShowControls(true);
    hideControlsAfterDelay();
  };

  const cycleInterval = () => {
    const intervals = [3, 5, 10];
    const currentIdx = intervals.indexOf(settings.slideInterval);
    const nextIdx = (currentIdx + 1) % intervals.length;
    updateSettings({ slideInterval: intervals[nextIdx] });
  };

  if (allContent.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay contenido para mostrar</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const currentItem = allContent[currentIndex];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity
        style={styles.container}
        activeOpacity={1}
        onPress={handleScreenPress}
      >
        {currentItem.type === 'qr' ? (
          <View style={styles.qrContent}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={currentItem.data.url}
                size={350}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
            <Text style={styles.contentName}>{currentItem.data.name}</Text>
          </View>
        ) : (
          <View style={styles.slideContent}>
            <Image source={{ uri: currentItem.data.imageUri }} style={styles.slideImage} />
          </View>
        )}

        {showControls && (
          <View style={styles.controlsOverlay}>
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
              <Text style={styles.counter}>
                {currentIndex + 1} / {allContent.length}
              </Text>
              <TouchableOpacity style={styles.intervalButton} onPress={cycleInterval}>
                <Text style={styles.intervalButtonText}>{settings.slideInterval}s</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sideControls}>
              <TouchableOpacity style={styles.navButton} onPress={goToPrev}>
                <Text style={styles.navButtonText}>{'<'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={() => setIsPaused(!isPaused)}
              >
                <Text style={styles.playPauseText}>{isPaused ? '>' : '||'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={goToNext}>
                <Text style={styles.navButtonText}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            {settings.showIndicators && allContent.length > 1 && (
              <View style={styles.indicators}>
                {allContent.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      index === currentIndex && styles.activeIndicator,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  qrContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrapper: {
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  contentName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 32,
  },
  slideContent: {
    flex: 1,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  intervalButton: {
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#00FFC3',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sideControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00FFC3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeIndicator: {
    backgroundColor: '#00FFC3',
    width: 28,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#00FFC3',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
