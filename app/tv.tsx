import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Image, BackHandler, TouchableOpacity, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../src/context/AppContext';
import { getLocalIP, generatePIN, PORT } from '../src/services/NetworkService';
import { tvServer } from '../src/services/TCPCommunication';
import { QRItem, SlideItem, TransitionType } from '../src/types';
import { useTranslation } from '../src/i18n';

const TV_STORAGE_KEY = '@tdsqr/tv_content';
const TV_SETTINGS_KEY = '@tdsqr/tv_settings';

const { width, height } = Dimensions.get('window');

type TVState = 'loading' | 'waiting' | 'connected' | 'presenting';

export default function TVScreen() {
  const { setMode, setConnected, setConnectionInfo, content, setContent, setInterval, setTransition } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [tvState, setTVState] = useState<TVState>('loading');
  const [localIP, setLocalIP] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState<{ qrItems: QRItem[]; slideItems: SlideItem[] }>({
    qrItems: [],
    slideItems: [],
  });
  const [exitTapCount, setExitTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Combined content for presentation
  const allContent = [...localContent.qrItems, ...localContent.slideItems];

  // Load saved content from storage
  const loadSavedContent = async () => {
    try {
      const saved = await AsyncStorage.getItem(TV_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocalContent(parsed);
        setContent(parsed.qrItems || [], parsed.slideItems || []);
        if ((parsed.qrItems?.length || 0) + (parsed.slideItems?.length || 0) > 0) {
          return true; // Has content
        }
      }
    } catch (error) {
      console.error('[TV] Error loading saved content:', error);
    }
    return false;
  };

  // Save content to storage
  const saveContentToStorage = async (qrItems: QRItem[], slideItems: SlideItem[]) => {
    try {
      await AsyncStorage.setItem(TV_STORAGE_KEY, JSON.stringify({ qrItems, slideItems }));
    } catch (error) {
      console.error('[TV] Error saving content:', error);
    }
  };

  // Load saved settings from storage
  const loadSavedSettings = async () => {
    try {
      const data = await AsyncStorage.getItem(TV_SETTINGS_KEY);
      if (data) {
        const settings = JSON.parse(data);
        if (settings.interval) setInterval(settings.interval);
        if (settings.transition) setTransition(settings.transition);
      }
    } catch (error) {
      console.error('[TV] Error loading settings:', error);
    }
  };

  // Save settings to storage
  const saveSettingsToStorage = async (interval: number, transition: TransitionType) => {
    try {
      await AsyncStorage.setItem(TV_SETTINGS_KEY, JSON.stringify({ interval, transition }));
    } catch (error) {
      console.error('[TV] Error saving settings:', error);
    }
  };

  // Animate transition
  const animateTransition = (callback: () => void) => {
    const transitionType = content.transition;

    if (transitionType === 'none') {
      callback();
      return;
    }

    if (transitionType === 'fade') {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(callback, 300);
    } else if (transitionType === 'slide') {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: width,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(callback, 300);
    }
  };

  // Handle exit tap (5 taps in corner to exit)
  const handleExitTap = () => {
    const now = Date.now();
    if (now - lastTapTime > 2000) {
      // Reset if more than 2 seconds passed
      setExitTapCount(1);
    } else {
      setExitTapCount((prev) => prev + 1);
    }
    setLastTapTime(now);

    if (exitTapCount >= 4) {
      // 5th tap
      tvServer.stop();
      router.replace('/');
    }
  };

  useEffect(() => {
    setMode('tv');

    // Load saved content and settings first
    loadSavedContent();
    loadSavedSettings();

    // Prevent back button on TV (stay in TV mode)
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent going back
    });

    initializeServer();

    return () => {
      backHandler.remove();
      tvServer.stop();
    };
  }, []);

  const initializeServer = async () => {
    try {
      const generatedPin = generatePIN();
      setPin(generatedPin);

      console.log('[TV] Starting TCP server with PIN:', generatedPin);

      // Start TCP server
      const ip = await tvServer.start(generatedPin);
      setLocalIP(ip);
      setConnectionInfo({ ip, pin: generatedPin });

      // Handle connection status
      tvServer.onConnection((connected) => {
        console.log('[TV] Connection status:', connected);
        if (connected) {
          setConnected(true);
          setTVState('connected');
        } else {
          setConnected(false);
          setTVState('waiting');
        }
      });

      // Handle incoming messages
      tvServer.onMessage((data) => {
        handleMessage(data);
      });

      setTVState('waiting');
      setServerError(null);
    } catch (error: any) {
      console.error('[TV] Failed to initialize server:', error);
      setServerError(error.message || 'Error starting server');

      // Try to get IP anyway for display
      try {
        const ip = await getLocalIP();
        setLocalIP(ip);
      } catch (e) {
        setLocalIP(t('notAvailable'));
      }

      // Retry after delay
      setTimeout(() => {
        initializeServer();
      }, 5000);
    }
  };

  const handleMessage = useCallback((data: any) => {
    console.log('[TV] Received message:', data.type);

    switch (data.type) {
      case 'content_update':
        setIsSyncing(true);
        const newQRItems = data.qrItems || [];
        const newSlideItems = data.slideItems || [];
        setLocalContent({ qrItems: newQRItems, slideItems: newSlideItems });
        setContent(newQRItems, newSlideItems);
        // Save content for persistence (works without connection)
        saveContentToStorage(newQRItems, newSlideItems);

        // Apply settings if included
        if (data.settings) {
          if (data.settings.interval) setInterval(data.settings.interval);
          if (data.settings.transition) setTransition(data.settings.transition);
          saveSettingsToStorage(data.settings.interval || 5, data.settings.transition || 'fade');
        }

        // Confirm receipt to controller
        tvServer.sendToAll({ type: 'content_received' });
        setIsSyncing(false);

        if (newQRItems.length > 0 || newSlideItems.length > 0) {
          setTVState('presenting');
          setCurrentSlideIndex(0);
        } else {
          setTVState('connected');
        }
        break;

      case 'settings_update':
        if (data.settings) {
          if (data.settings.interval) setInterval(data.settings.interval);
          if (data.settings.transition) setTransition(data.settings.transition);
          saveSettingsToStorage(data.settings.interval || 5, data.settings.transition || 'fade');
        }
        break;

      case 'start_presentation':
        if (allContent.length > 0) {
          setTVState('presenting');
          setCurrentSlideIndex(0);
        }
        break;

      case 'stop_presentation':
        setTVState('connected');
        break;

      case 'next_slide':
        animateTransition(() => {
          setCurrentSlideIndex((prev) => (prev + 1) % Math.max(allContent.length, 1));
        });
        break;

      case 'prev_slide':
        animateTransition(() => {
          setCurrentSlideIndex((prev) =>
            (prev - 1 + Math.max(allContent.length, 1)) % Math.max(allContent.length, 1)
          );
        });
        break;

      case 'go_to_slide':
        if (data.index >= 0 && data.index < allContent.length) {
          setCurrentSlideIndex(data.index);
        }
        break;
    }
  }, [allContent.length]);

  // Stop presentation and go back to connected/waiting state
  const handleStopPresentation = () => {
    setTVState(tvServer.isClientConnected() ? 'connected' : 'waiting');
  };

  // Auto-advance slides with transition
  useEffect(() => {
    if (tvState !== 'presenting' || allContent.length <= 1 || !content.isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      animateTransition(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % allContent.length);
      });
    }, content.interval * 1000);

    return () => window.clearInterval(timer);
  }, [tvState, allContent.length, content.isPlaying, content.interval, content.transition]);

  const connectionUrl = `tdsqr://${localIP}:${PORT}/${pin}`;

  if (tvState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2DD4BF" />
        <Text style={styles.loadingText}>{t('startingServer')}</Text>
        {serverError && (
          <Text style={styles.errorText}>{serverError}</Text>
        )}
      </SafeAreaView>
    );
  }

  if (tvState === 'waiting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.waitingContainer}>
          <Text style={styles.logo}>{t('appName')}</Text>
          <Text style={styles.title}>{t('tvModeTitle')}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={connectionUrl}
              size={Math.min(width * 0.5, 300)}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>

          <Text style={styles.instruction}>
            {t('scanQRInstruction')}
          </Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('orUsePin')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.pinContainer}>
            <Text style={styles.pinLabel}>{t('connectionPin')}</Text>
            <Text style={styles.pin}>{pin}</Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>{t('serverIP')}</Text>
            <Text style={styles.infoValue}>{localIP}:{PORT}</Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{t('waitingConnection')}</Text>
          </View>

          <TouchableOpacity style={styles.exitButton} onPress={() => { tvServer.stop(); router.replace('/'); }}>
            <Text style={styles.exitButtonText}>{t('exit') || 'Salir'}</Text>
          </TouchableOpacity>
        </View>
        {/* Exit tap zone - top left corner */}
        <Pressable style={styles.exitZone} onPress={handleExitTap} />
      </SafeAreaView>
    );
  }

  if (tvState === 'connected') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedIcon}>✓</Text>
          <Text style={styles.connectedTitle}>{t('connected')}</Text>
          <Text style={styles.connectedSubtitle}>
            {t('waitingContent')}
          </Text>
          <Text style={styles.connectedHint}>
            {t('addContentHint')}
          </Text>

          <TouchableOpacity style={styles.exitButton} onPress={() => { tvServer.stop(); router.replace('/'); }}>
            <Text style={styles.exitButtonText}>{t('exit') || 'Salir'}</Text>
          </TouchableOpacity>
        </View>
        {/* Exit tap zone - top left corner */}
        <Pressable style={styles.exitZone} onPress={handleExitTap} />
      </SafeAreaView>
    );
  }

  // Presenting state
  if (allContent.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedTitle}>{t('noContent')}</Text>
          <Text style={styles.connectedSubtitle}>
            {t('noContentHint')}
          </Text>
        </View>
        {/* Exit tap zone - top left corner */}
        <Pressable style={styles.exitZone} onPress={handleExitTap} />
      </SafeAreaView>
    );
  }

  const currentItem = allContent[currentSlideIndex];
  const isQR = currentItem && 'url' in currentItem;

  return (
    <View style={styles.presentationContainer}>
      <Animated.View
        style={[
          styles.animatedContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {isQR ? (
          <View style={styles.qrSlide}>
            <View style={styles.qrSlideCode}>
              <QRCode
                value={(currentItem as QRItem).url}
                size={Math.min(width * 0.7, height * 0.6)}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            </View>
          </View>
        ) : (
          <View style={styles.imageSlide}>
            <Image
              source={{ uri: (currentItem as SlideItem).imageBase64 || (currentItem as SlideItem).imageUri }}
              style={styles.slideImage}
              resizeMode="contain"
            />
          </View>
        )}
      </Animated.View>

      {/* Syncing indicator */}
      {isSyncing && (
        <View style={styles.syncingOverlay}>
          <ActivityIndicator size="large" color="#2DD4BF" />
          <Text style={styles.syncingText}>{t('syncing') || 'Sincronizando...'}</Text>
        </View>
      )}

      {/* Slide indicators */}
      {allContent.length > 1 && (
        <View style={styles.indicators}>
          {allContent.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentSlideIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Stop presentation button - bottom right corner */}
      <TouchableOpacity style={styles.stopPresentationButton} onPress={handleStopPresentation}>
        <Text style={styles.stopPresentationText}>✕</Text>
      </TouchableOpacity>

      {/* Exit tap zone - top left corner */}
      <Pressable style={styles.exitZone} onPress={handleExitTap} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2DD4BF',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 40,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2D2D3A',
  },
  dividerText: {
    color: '#6B7280',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pinLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  pin: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2DD4BF',
    letterSpacing: 8,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2DD4BF',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  connectedContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  connectedIcon: {
    fontSize: 64,
    color: '#2DD4BF',
    marginBottom: 16,
  },
  connectedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  connectedSubtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  connectedHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  presentationContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  qrSlideTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  qrSlideCode: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  qrSlideUrl: {
    fontSize: 16,
    color: '#5EEAD4',
    textAlign: 'center',
  },
  imageSlide: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  imageCaption: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  imageCaptionText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  indicators: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D2D3A',
  },
  indicatorActive: {
    backgroundColor: '#2DD4BF',
    width: 24,
  },
  exitButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
  },
  exitButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  exitZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },
  syncingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  syncingText: {
    color: '#2DD4BF',
    fontSize: 14,
  },
  stopPresentationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  stopPresentationText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  animatedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});
