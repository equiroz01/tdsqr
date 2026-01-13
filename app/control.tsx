import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useApp } from '../src/context/AppContext';
import { controlClient } from '../src/services/TCPCommunication';
import { QRItem, SlideItem, SyncStatus, TransitionType } from '../src/types';
import { useTranslation } from '../src/i18n';

const INTERVAL_OPTIONS = [3, 5, 10, 15, 30];
const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'Sin transición' },
  { value: 'fade', label: 'Desvanecer' },
  { value: 'slide', label: 'Deslizar' },
];

const STORAGE_KEYS = {
  QR_ITEMS: '@tdsqr/controller_qr_items',
  SLIDE_ITEMS: '@tdsqr/controller_slide_items',
  SETTINGS: '@tdsqr/controller_settings',
};

const { width } = Dimensions.get('window');

type ControlState = 'scan' | 'manual' | 'connected';
type Tab = 'qr' | 'slides';

// Sync status indicator component
const SyncIndicator = ({ status }: { status?: SyncStatus }) => {
  if (!status || status === 'synced') return null;

  const getColor = () => {
    switch (status) {
      case 'syncing': return '#F59E0B';
      case 'pending': return '#6B7280';
      case 'error': return '#EF4444';
      case 'deleting': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
      {status === 'syncing' || status === 'deleting' ? (
        <ActivityIndicator size="small" color={getColor()} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getColor() }} />
      )}
    </View>
  );
};

export default function ControlScreen() {
  const { setMode, isConnected, setConnected, content, addQRItem, addSlideItem, removeQRItem, removeSlideItem, clearContent, setContent, setInterval, setTransition } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [controlState, setControlState] = useState<ControlState>('scan');
  const [activeTab, setActiveTab] = useState<Tab>('qr');
  const [pinInput, setPinInput] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [scanned, setScanned] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingItemIds, setSyncingItemIds] = useState<Set<string>>(new Set());
  const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(new Set());

  // QR creation form
  const [qrName, setQrName] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // Slide creation
  const [slideName, setSlideName] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved content on mount
  useEffect(() => {
    loadSavedContent();
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const settings = JSON.parse(data);
        if (settings.interval) setInterval(settings.interval);
        if (settings.transition) setTransition(settings.transition);
      }
    } catch (error) {
      console.error('[Control] Error loading settings:', error);
    }
  };

  const saveSettings = async (interval: number, transition: TransitionType) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ interval, transition }));
    } catch (error) {
      console.error('[Control] Error saving settings:', error);
    }
  };

  const loadSavedContent = async () => {
    try {
      const [qrData, slideData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.QR_ITEMS),
        AsyncStorage.getItem(STORAGE_KEYS.SLIDE_ITEMS),
      ]);

      const savedQRs: QRItem[] = qrData ? JSON.parse(qrData) : [];
      const savedSlides: SlideItem[] = slideData ? JSON.parse(slideData) : [];

      // Load saved content into app state
      for (const qr of savedQRs) {
        addQRItem(qr);
      }
      for (const slide of savedSlides) {
        addSlideItem(slide);
      }
    } catch (error) {
      console.error('[Control] Error loading saved content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const saveContent = async (qrItems: QRItem[], slideItems: SlideItem[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.QR_ITEMS, JSON.stringify(qrItems)),
        AsyncStorage.setItem(STORAGE_KEYS.SLIDE_ITEMS, JSON.stringify(slideItems)),
      ]);
    } catch (error) {
      console.error('[Control] Error saving content:', error);
    }
  };

  useEffect(() => {
    setMode('control');

    // Handle messages from TV
    controlClient.onMessage((data) => {
      handleMessage(data);
    });

    controlClient.onConnection((connected) => {
      setConnected(connected);
      if (connected) {
        setControlState('connected');
      } else {
        setControlState('scan');
        setIsConnecting(false);
      }
    });

    return () => {
      controlClient.disconnect();
    };
  }, []);

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'auth_success':
        setIsConnecting(false);
        Alert.alert(t('connected'), t('connectionSuccess'));
        setConnected(true);
        setControlState('connected');
        // Send current content to TV after connecting
        if (content.qrItems.length > 0 || content.slideItems.length > 0) {
          setTimeout(() => {
            syncContentToTV(content.qrItems, content.slideItems);
          }, 500);
        }
        break;
      case 'auth_failed':
        setIsConnecting(false);
        Alert.alert(t('error'), data.message || t('authError'));
        setConnected(false);
        setControlState('scan');
        setScanned(false);
        break;
      case 'content_received':
        // TV confirmed receipt of content
        setIsSyncing(false);
        setSyncingItemIds(new Set());
        setDeletingItemIds(new Set());
        console.log('[Control] TV confirmed content received');
        break;
      case 'sync_request':
        // TV is requesting content sync
        console.log('[Control] TV requested sync');
        syncContentToTV(content.qrItems, content.slideItems);
        break;
    }
  };

  const syncContentToTV = (qrItems: QRItem[], slideItems: SlideItem[]) => {
    setIsSyncing(true);
    // Mark all items as syncing
    const allIds = new Set([...qrItems.map(q => q.id), ...slideItems.map(s => s.id)]);
    setSyncingItemIds(allIds);

    controlClient.send({
      type: 'content_update',
      qrItems,
      slideItems,
      settings: {
        interval: content.interval,
        transition: content.transition,
      },
    });

    // Fallback: clear syncing state after timeout if no confirmation
    setTimeout(() => {
      setIsSyncing(false);
      setSyncingItemIds(new Set());
    }, 5000);
  };

  const handleIntervalChange = (newInterval: number) => {
    setInterval(newInterval);
    saveSettings(newInterval, content.transition);
    // Send settings update to TV if connected
    if (isConnected) {
      controlClient.send({
        type: 'settings_update',
        settings: {
          interval: newInterval,
          transition: content.transition,
        },
      });
    }
  };

  const handleTransitionChange = (newTransition: TransitionType) => {
    setTransition(newTransition);
    saveSettings(content.interval, newTransition);
    // Send settings update to TV if connected
    if (isConnected) {
      controlClient.send({
        type: 'settings_update',
        settings: {
          interval: content.interval,
          transition: newTransition,
        },
      });
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Parse the QR code: tdsqr://IP:PORT/PIN
    const match = data.match(/tdsqr:\/\/([^:]+):(\d+)\/(\d+)/);
    if (match) {
      const ip = match[1];
      const pin = match[3];
      connectToTV(ip, pin);
    } else {
      Alert.alert(t('error'), t('invalidQR'));
      setScanned(false);
    }
  };

  const connectToTV = async (ip: string, pin: string) => {
    setIsConnecting(true);
    try {
      console.log('[Control] Connecting to TV at', ip, 'with PIN', pin);
      const success = await controlClient.connect(ip, pin);
      if (!success) {
        setIsConnecting(false);
        Alert.alert(t('error'), t('connectionFailed'));
        setScanned(false);
      }
    } catch (error: any) {
      setIsConnecting(false);
      console.error('[Control] Connection error:', error);
      Alert.alert(t('error'), error.message || t('connectionFailed'));
      setScanned(false);
    }
  };

  const handleManualConnect = () => {
    if (!ipInput) {
      Alert.alert(t('error'), t('enterIP'));
      return;
    }
    if (!pinInput || pinInput.length !== 6) {
      Alert.alert(t('error'), t('invalidPin'));
      return;
    }

    connectToTV(ipInput, pinInput);
  };

  const handleAddQR = () => {
    if (!qrName || !qrUrl) {
      Alert.alert(t('error'), t('enterNameAndUrl'));
      return;
    }

    const newQR: QRItem = {
      id: Date.now().toString(),
      name: qrName,
      url: qrUrl.startsWith('http') ? qrUrl : `https://${qrUrl}`,
      createdAt: Date.now(),
      syncStatus: 'pending',
    };

    const updatedQRs = [...content.qrItems, newQR];
    addQRItem(newQR);
    saveContent(updatedQRs, content.slideItems);

    // Sync to TV if connected
    if (isConnected) {
      syncContentToTV(updatedQRs, content.slideItems);
    }

    setQrName('');
    setQrUrl('');
  };

  const handlePickImage = async () => {
    if (isProcessingImage) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsProcessingImage(true);

      try {
        const originalUri = result.assets[0].uri;
        const originalWidth = result.assets[0].width;
        const originalHeight = result.assets[0].height;

        // Calculate crop dimensions for 16:9 aspect ratio
        const targetAspect = 16 / 9;
        const currentAspect = originalWidth / originalHeight;

        let cropWidth = originalWidth;
        let cropHeight = originalHeight;
        let cropX = 0;
        let cropY = 0;

        if (currentAspect > targetAspect) {
          // Image is wider than 16:9, crop width
          cropWidth = Math.round(originalHeight * targetAspect);
          cropX = Math.round((originalWidth - cropWidth) / 2);
        } else if (currentAspect < targetAspect) {
          // Image is taller than 16:9, crop height
          cropHeight = Math.round(originalWidth / targetAspect);
          cropY = Math.round((originalHeight - cropHeight) / 2);
        }

        // Crop and resize image to 16:9 format (max 1920x1080 for performance)
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          originalUri,
          [
            {
              crop: {
                originX: cropX,
                originY: cropY,
                width: cropWidth,
                height: cropHeight,
              },
            },
            {
              resize: {
                width: Math.min(cropWidth, 1920),
                height: Math.min(cropHeight, 1080),
              },
            },
          ],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        // Convert processed image to base64
        const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const newSlide: SlideItem = {
          id: Date.now().toString(),
          name: slideName || `Slide ${content.slideItems.length + 1}`,
          imageUri: manipulatedImage.uri,
          imageBase64: `data:image/jpeg;base64,${base64}`,
          createdAt: Date.now(),
          syncStatus: 'pending',
        };

        const updatedSlides = [...content.slideItems, newSlide];
        addSlideItem(newSlide);
        saveContent(content.qrItems, updatedSlides);

        // Sync to TV if connected
        if (isConnected) {
          syncContentToTV(content.qrItems, updatedSlides);
        }

        setSlideName('');
      } catch (error) {
        console.error('[Control] Error processing image:', error);
        Alert.alert(t('error'), t('imageProcessError') || 'Failed to process image');
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleRemoveQR = (id: string) => {
    // Mark as deleting
    setDeletingItemIds(prev => new Set(prev).add(id));

    const updatedQRs = content.qrItems.filter((item) => item.id !== id);
    removeQRItem(id);
    saveContent(updatedQRs, content.slideItems);

    // Sync to TV if connected
    if (isConnected) {
      syncContentToTV(updatedQRs, content.slideItems);
    } else {
      setDeletingItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleRemoveSlide = (id: string) => {
    // Mark as deleting
    setDeletingItemIds(prev => new Set(prev).add(id));

    const updatedSlides = content.slideItems.filter((item) => item.id !== id);
    removeSlideItem(id);
    saveContent(content.qrItems, updatedSlides);

    // Sync to TV if connected
    if (isConnected) {
      syncContentToTV(content.qrItems, updatedSlides);
    } else {
      setDeletingItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleStartPresentation = () => {
    if (content.qrItems.length === 0 && content.slideItems.length === 0) {
      Alert.alert(t('noContent'), t('noContentToStart'));
      return;
    }
    controlClient.send({ type: 'start_presentation' });
  };

  const handleStopPresentation = () => {
    controlClient.send({ type: 'stop_presentation' });
  };

  const handleDisconnect = () => {
    controlClient.disconnect();
    setConnected(false);
    setControlState('scan');
    setScanned(false);
    router.replace('/');
  };

  // Connection screens
  if (controlState === 'scan') {
    if (!permission) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.text}>{t('loading')}</Text>
        </SafeAreaView>
      );
    }

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.title}>{t('cameraPermission')}</Text>
            <Text style={styles.subtitle}>
              {t('cameraPermissionDesc')}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>{t('allowCamera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setControlState('manual')}
            >
              <Text style={styles.secondaryButtonText}>{t('enterManually')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>{t('appName')}</Text>
          <Text style={styles.headerSubtitle}>{t('controlModeTitle')}</Text>
        </View>

        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.scanner}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
        </View>

        <Text style={styles.scanInstruction}>
          {t('scanTVQR')}
        </Text>

        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setControlState('manual')}
        >
          <Text style={styles.manualButtonText}>{t('enterPinManually')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backToHomeButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backToHomeButtonText}>{t('back') || 'Volver'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (controlState === 'manual') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>{t('appName')}</Text>
          <Text style={styles.headerSubtitle}>{t('manualConnection')}</Text>
        </View>

        <View style={styles.manualForm}>
          <Text style={styles.inputLabel}>{t('serverIP')}</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.100"
            placeholderTextColor="#666666"
            value={ipInput}
            onChangeText={setIpInput}
            keyboardType="numeric"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>{t('tvPin')}</Text>
          <TextInput
            style={styles.pinInput}
            placeholder="000000"
            placeholderTextColor="#666666"
            value={pinInput}
            onChangeText={setPinInput}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
          <Text style={styles.pinHint}>
            {t('pinHint')}
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, isConnecting && styles.primaryButtonDisabled]}
            onPress={handleManualConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('connect')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setControlState('scan');
              setScanned(false);
            }}
          >
            <Text style={styles.secondaryButtonText}>{t('backToScan')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToHomeButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backToHomeButtonText}>{t('back') || 'Volver'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Connected state - Content management
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>{t('appName')}</Text>
          {isSyncing && (
            <View style={styles.syncBadge}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.syncBadgeText}>{t('syncing') || 'Sincronizando'}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <Text style={styles.disconnectButtonText}>{t('disconnect') || 'Desconectar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
          onPress={() => setActiveTab('qr')}
        >
          <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>
            {t('qrCodes')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'slides' && styles.tabActive]}
          onPress={() => setActiveTab('slides')}
        >
          <Text style={[styles.tabText, activeTab === 'slides' && styles.tabTextActive]}>
            {t('images')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'qr' ? (
          <View style={styles.tabContent}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('qrName')}
                placeholderTextColor="#666666"
                value={qrName}
                onChangeText={setQrName}
              />
              <TextInput
                style={styles.input}
                placeholder={t('qrUrl')}
                placeholderTextColor="#666666"
                value={qrUrl}
                onChangeText={setQrUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddQR}>
                <Text style={styles.addButtonText}>{t('addQR')}</Text>
              </TouchableOpacity>
            </View>

            {content.qrItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noQRCodes')}</Text>
                <Text style={styles.emptyStateHint}>{t('addQRHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {content.qrItems.map((item) => {
                  const itemSyncStatus: SyncStatus | undefined = deletingItemIds.has(item.id)
                    ? 'deleting'
                    : syncingItemIds.has(item.id)
                    ? 'syncing'
                    : item.syncStatus;

                  return (
                    <View key={item.id} style={[styles.itemCard, itemSyncStatus === 'deleting' && styles.itemCardDeleting]}>
                      <View style={styles.itemQR}>
                        <QRCode value={item.url} size={50} color="#000" backgroundColor="#FFF" />
                      </View>
                      <View style={styles.itemInfo}>
                        <View style={styles.itemNameRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <SyncIndicator status={itemSyncStatus} />
                        </View>
                        <Text style={styles.itemUrl} numberOfLines={1}>
                          {item.url}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleRemoveQR(item.id)}
                        disabled={itemSyncStatus === 'deleting'}
                      >
                        {itemSyncStatus === 'deleting' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.deleteButtonText}>✕</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('imageName')}
                placeholderTextColor="#666666"
                value={slideName}
                onChangeText={setSlideName}
              />
              <TouchableOpacity
                style={[styles.addButton, isProcessingImage && styles.addButtonDisabled]}
                onPress={handlePickImage}
                disabled={isProcessingImage}
              >
                {isProcessingImage ? (
                  <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color="#2DD4BF" />
                    <Text style={[styles.addButtonText, { marginLeft: 8 }]}>
                      {t('processing') || 'Procesando...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.addButtonText}>{t('selectImage')}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.imageFormatHint}>
                {t('imageFormatHint') || 'Formato: 16:9'}
              </Text>
            </View>

            {content.slideItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noImages')}</Text>
                <Text style={styles.emptyStateHint}>{t('selectImageHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {content.slideItems.map((item) => {
                  const itemSyncStatus: SyncStatus | undefined = deletingItemIds.has(item.id)
                    ? 'deleting'
                    : syncingItemIds.has(item.id)
                    ? 'syncing'
                    : item.syncStatus;

                  return (
                    <View key={item.id} style={[styles.itemCard, itemSyncStatus === 'deleting' && styles.itemCardDeleting]}>
                      <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
                      <View style={styles.itemInfo}>
                        <View style={styles.itemNameRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <SyncIndicator status={itemSyncStatus} />
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleRemoveSlide(item.id)}
                        disabled={itemSyncStatus === 'deleting'}
                      >
                        {itemSyncStatus === 'deleting' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.deleteButtonText}>✕</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Settings Panel */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{t('interval') || 'Intervalo'}</Text>
            <View style={styles.settingOptions}>
              {INTERVAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.settingOption,
                    content.interval === opt && styles.settingOptionActive,
                  ]}
                  onPress={() => handleIntervalChange(opt)}
                >
                  <Text
                    style={[
                      styles.settingOptionText,
                      content.interval === opt && styles.settingOptionTextActive,
                    ]}
                  >
                    {opt}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{t('transition') || 'Transición'}</Text>
            <View style={styles.settingOptions}>
              {TRANSITION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.settingOption,
                    styles.settingOptionWide,
                    content.transition === opt.value && styles.settingOptionActive,
                  ]}
                  onPress={() => handleTransitionChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.settingOptionText,
                      content.transition === opt.value && styles.settingOptionTextActive,
                    ]}
                  >
                    {t(opt.value) || opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={styles.controlBar}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsButtonText}>⚙</Text>
        </TouchableOpacity>
        <Text style={styles.contentCount}>
          {content.qrItems.length + content.slideItems.length} {t('elements')}
        </Text>
        <TouchableOpacity style={styles.startButton} onPress={handleStartPresentation}>
          <Text style={styles.startButtonText}>{t('startOnTV')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  syncBadgeText: {
    fontSize: 12,
    color: '#F59E0B',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2DD4BF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#5EEAD4',
  },
  scannerContainer: {
    height: width * 0.8,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width * 0.6,
    height: width * 0.6,
    borderWidth: 2,
    borderColor: '#2DD4BF',
    borderRadius: 16,
  },
  scanInstruction: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  manualButton: {
    padding: 16,
  },
  manualButtonText: {
    fontSize: 14,
    color: '#5EEAD4',
    textAlign: 'center',
  },
  backToHomeButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
  },
  backToHomeButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  manualForm: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#16161F',
    borderWidth: 1,
    borderColor: '#2D2D3A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: '#16161F',
    borderWidth: 1,
    borderColor: '#2D2D3A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2DD4BF',
    marginBottom: 8,
    letterSpacing: 8,
  },
  pinHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2DD4BF',
    marginRight: 6,
  },
  connectedText: {
    fontSize: 12,
    color: '#5EEAD4',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#2DD4BF',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#16161F',
    borderWidth: 1,
    borderColor: '#2DD4BF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    color: '#2DD4BF',
    fontWeight: 'bold',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageFormatHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 14,
    color: '#4B5563',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  itemCardDeleting: {
    opacity: 0.5,
    borderColor: '#EF4444',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQR: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemUrl: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2D2D3A',
  },
  contentCount: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  startButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
  },
  disconnectButtonText: {
    fontSize: 12,
    color: '#EF4444',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16161F',
    borderWidth: 1,
    borderColor: '#2D2D3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonText: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  settingsPanel: {
    backgroundColor: '#16161F',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2D2D3A',
    gap: 16,
  },
  settingRow: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  settingOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  settingOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  settingOptionWide: {
    flex: 1,
    alignItems: 'center',
  },
  settingOptionActive: {
    backgroundColor: '#2DD4BF',
    borderColor: '#2DD4BF',
  },
  settingOptionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  settingOptionTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
});
