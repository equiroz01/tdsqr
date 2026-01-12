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
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useApp } from '../src/context/AppContext';
import { controlClient } from '../src/services/TCPCommunication';
import { QRItem, SlideItem } from '../src/types';
import { useTranslation } from '../src/i18n';

const STORAGE_KEYS = {
  QR_ITEMS: '@tdsqr/controller_qr_items',
  SLIDE_ITEMS: '@tdsqr/controller_slide_items',
};

const { width } = Dimensions.get('window');

type ControlState = 'scan' | 'manual' | 'connected';
type Tab = 'qr' | 'slides';

export default function ControlScreen() {
  const { setMode, isConnected, setConnected, content, addQRItem, addSlideItem, removeQRItem, removeSlideItem, clearContent } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [controlState, setControlState] = useState<ControlState>('scan');
  const [activeTab, setActiveTab] = useState<Tab>('qr');
  const [pinInput, setPinInput] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [scanned, setScanned] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // QR creation form
  const [qrName, setQrName] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // Slide creation
  const [slideName, setSlideName] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  // Load saved content on mount
  useEffect(() => {
    loadSavedContent();
  }, []);

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
        break;
      case 'auth_failed':
        setIsConnecting(false);
        Alert.alert(t('error'), data.message || t('authError'));
        setConnected(false);
        setControlState('scan');
        setScanned(false);
        break;
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
    };

    const updatedQRs = [...content.qrItems, newQR];
    addQRItem(newQR);
    saveContent(updatedQRs, content.slideItems);
    syncContent(updatedQRs, content.slideItems);
    setQrName('');
    setQrUrl('');
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        // Convert image to base64 for network transfer
        const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const newSlide: SlideItem = {
          id: Date.now().toString(),
          name: slideName || `Slide ${content.slideItems.length + 1}`,
          imageUri: result.assets[0].uri,
          imageBase64: `data:image/jpeg;base64,${base64}`,
          createdAt: Date.now(),
        };

        const updatedSlides = [...content.slideItems, newSlide];
        addSlideItem(newSlide);
        saveContent(content.qrItems, updatedSlides);
        syncContent(content.qrItems, updatedSlides);
        setSlideName('');
      } catch (error) {
        console.error('[Control] Error converting image to base64:', error);
        Alert.alert(t('error'), 'Failed to process image');
      }
    }
  };

  const syncContent = (qrItems: QRItem[], slideItems: SlideItem[]) => {
    controlClient.send({
      type: 'content_update',
      qrItems,
      slideItems,
    });
  };

  const handleRemoveQR = (id: string) => {
    removeQRItem(id);
    const updatedQRs = content.qrItems.filter((item) => item.id !== id);
    saveContent(updatedQRs, content.slideItems);
    syncContent(updatedQRs, content.slideItems);
  };

  const handleRemoveSlide = (id: string) => {
    removeSlideItem(id);
    const updatedSlides = content.slideItems.filter((item) => item.id !== id);
    saveContent(content.qrItems, updatedSlides);
    syncContent(content.qrItems, updatedSlides);
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
        </View>
      </SafeAreaView>
    );
  }

  // Connected state - Content management
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>{t('appName')}</Text>
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
                {content.qrItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemQR}>
                      <QRCode value={item.url} size={50} color="#000" backgroundColor="#FFF" />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemUrl} numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveQR(item.id)}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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
              <TouchableOpacity style={styles.addButton} onPress={handlePickImage}>
                <Text style={styles.addButtonText}>{t('selectImage')}</Text>
              </TouchableOpacity>
            </View>

            {content.slideItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noImages')}</Text>
                <Text style={styles.emptyStateHint}>{t('selectImageHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {content.slideItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveSlide(item.id)}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.controlBar}>
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
  addButtonText: {
    fontSize: 16,
    color: '#2DD4BF',
    fontWeight: 'bold',
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
});
