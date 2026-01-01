import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Image, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../src/context/AppContext';
import { getLocalIP, generatePIN, PORT } from '../src/services/NetworkService';
import { tvServer } from '../src/services/TCPCommunication';
import { QRItem, SlideItem } from '../src/types';
import { useTranslation } from '../src/i18n';

const { width, height } = Dimensions.get('window');

type TVState = 'loading' | 'waiting' | 'connected' | 'presenting';

export default function TVScreen() {
  const { setMode, setConnected, setConnectionInfo, content, setContent } = useApp();
  const { t } = useTranslation();
  const [tvState, setTVState] = useState<TVState>('loading');
  const [localIP, setLocalIP] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState<{ qrItems: QRItem[]; slideItems: SlideItem[] }>({
    qrItems: [],
    slideItems: [],
  });

  // Combined content for presentation
  const allContent = [...localContent.qrItems, ...localContent.slideItems];

  useEffect(() => {
    setMode('tv');

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
        const newQRItems = data.qrItems || [];
        const newSlideItems = data.slideItems || [];
        setLocalContent({ qrItems: newQRItems, slideItems: newSlideItems });
        setContent(newQRItems, newSlideItems);
        if (newQRItems.length > 0 || newSlideItems.length > 0) {
          setTVState('presenting');
          setCurrentSlideIndex(0);
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
        setCurrentSlideIndex((prev) => (prev + 1) % Math.max(allContent.length, 1));
        break;

      case 'prev_slide':
        setCurrentSlideIndex((prev) =>
          (prev - 1 + Math.max(allContent.length, 1)) % Math.max(allContent.length, 1)
        );
        break;

      case 'go_to_slide':
        if (data.index >= 0 && data.index < allContent.length) {
          setCurrentSlideIndex(data.index);
        }
        break;
    }
  }, [allContent.length]);

  // Auto-advance slides
  useEffect(() => {
    if (tvState !== 'presenting' || allContent.length <= 1 || !content.isPlaying) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % allContent.length);
    }, content.interval * 1000);

    return () => clearInterval(timer);
  }, [tvState, allContent.length, content.isPlaying, content.interval]);

  const connectionUrl = `tdsqr://${localIP}:${PORT}/${pin}`;

  if (tvState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#A855F7" />
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
        </View>
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
        </View>
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
      </SafeAreaView>
    );
  }

  const currentItem = allContent[currentSlideIndex];
  const isQR = currentItem && 'url' in currentItem;

  return (
    <View style={styles.presentationContainer}>
      {isQR ? (
        <View style={styles.qrSlide}>
          <Text style={styles.qrSlideTitle}>{currentItem.name}</Text>
          <View style={styles.qrSlideCode}>
            <QRCode
              value={(currentItem as QRItem).url}
              size={Math.min(width * 0.6, height * 0.5)}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.qrSlideUrl}>{(currentItem as QRItem).url}</Text>
        </View>
      ) : (
        <View style={styles.imageSlide}>
          <Image
            source={{ uri: (currentItem as SlideItem).imageUri }}
            style={styles.slideImage}
            resizeMode="contain"
          />
          {currentItem.name && (
            <View style={styles.imageCaption}>
              <Text style={styles.imageCaptionText}>{currentItem.name}</Text>
            </View>
          )}
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
    color: '#A855F7',
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
    color: '#A855F7',
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
    backgroundColor: '#A855F7',
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
    color: '#A855F7',
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
    color: '#C084FC',
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
    backgroundColor: '#A855F7',
    width: 24,
  },
});
