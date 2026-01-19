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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/context/AppContext';
import { controlClient } from '../src/services/TCPCommunication';
import { QRItem, SlideItem, SyncStatus, TransitionType, MenuBoard } from '../src/types';
import { useTranslation } from '../src/i18n';
import { useMenuBoards } from '../src/hooks/useMenuBoards';
import { SyncProgress } from '../src/components/SyncProgress';

const INTERVAL_OPTIONS = [3, 5, 10, 15, 30];
const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'Sin transición' },
  { value: 'fade', label: 'Desvanecer' },
  { value: 'slide', label: 'Deslizar' },
];

const { width } = Dimensions.get('window');

type ControlState = 'scan' | 'manual' | 'select_board' | 'connected';
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
  const { setMode, isConnected, setConnected, content, setContent, setInterval, setTransition } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ selectedBoardId?: string }>();
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

  // Menu boards
  const { boards, loading: loadingBoards, updateBoard, getBoard } = useMenuBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [currentBoard, setCurrentBoard] = useState<MenuBoard | null>(null);

  // Local board state for editing
  const [localQRItems, setLocalQRItems] = useState<QRItem[]>([]);
  const [localSlideItems, setLocalSlideItems] = useState<SlideItem[]>([]);
  const [localInterval, setLocalInterval] = useState(5);
  const [localTransition, setLocalTransition] = useState<TransitionType>('fade');

  // QR creation form
  const [qrName, setQrName] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // Slide creation
  const [slideName, setSlideName] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sync progress state
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentSyncItem, setCurrentSyncItem] = useState(0);
  const [totalSyncItems, setTotalSyncItems] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'sending' | 'receiving' | 'processing'>('sending');

  // Handle navigation with selected board
  useEffect(() => {
    if (params.selectedBoardId && isConnected) {
      const board = getBoard(params.selectedBoardId);
      if (board) {
        selectBoard(board);
      }
    }
  }, [params.selectedBoardId, isConnected, boards]);

  const selectBoard = (board: MenuBoard) => {
    setSelectedBoardId(board.id);
    setCurrentBoard(board);
    setLocalQRItems(board.qrItems);
    setLocalSlideItems(board.slideItems);
    setLocalInterval(board.settings.slideInterval);
    setLocalTransition(board.settings.transition);
    setControlState('connected');

    // Sync to TV
    syncBoardToTV(board);
  };

  const syncBoardToTV = async (board: MenuBoard) => {
    const allItems = [...board.qrItems, ...board.slideItems];
    const total = allItems.length;

    if (total === 0) {
      // No items, just send empty update
      controlClient.send({
        type: 'content_update',
        qrItems: [],
        slideItems: [],
        settings: {
          interval: board.settings.slideInterval,
          transition: board.settings.transition,
        },
      });
      return;
    }

    setIsSyncing(true);
    setShowSyncProgress(true);
    setSyncProgress(0);
    setCurrentSyncItem(0);
    setTotalSyncItems(total);
    setSyncStatus('sending');

    const allIds = new Set([...board.qrItems.map(q => q.id), ...board.slideItems.map(s => s.id)]);
    setSyncingItemIds(allIds);

    // Send sync_start message
    controlClient.send({
      type: 'sync_start',
      totalItems: total,
      settings: {
        interval: board.settings.slideInterval,
        transition: board.settings.transition,
      },
    });

    // Send items one by one with delay for visual feedback
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const isQR = 'url' in item;

      // Update progress
      setCurrentSyncItem(i + 1);
      setSyncProgress(Math.round(((i + 1) / total) * 100));

      // Send item
      controlClient.send({
        type: 'sync_item',
        index: i,
        total: total,
        itemType: isQR ? 'qr' : 'slide',
        item: item,
      });

      // Small delay between items for visual feedback and to prevent overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send sync_complete
    controlClient.send({
      type: 'sync_complete',
      qrCount: board.qrItems.length,
      slideCount: board.slideItems.length,
    });

    // Keep progress visible briefly, then hide
    setTimeout(() => {
      setShowSyncProgress(false);
      setIsSyncing(false);
      setSyncingItemIds(new Set());
      setSyncProgress(0);
    }, 800);
  };

  useEffect(() => {
    setMode('control');

    controlClient.onMessage((data) => {
      handleMessage(data);
    });

    controlClient.onConnection((connected) => {
      setConnected(connected);
      if (connected) {
        setControlState('select_board');
      } else {
        setControlState('scan');
        setIsConnecting(false);
        setSelectedBoardId(null);
        setCurrentBoard(null);
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
        setControlState('select_board');
        break;
      case 'auth_failed':
        setIsConnecting(false);
        Alert.alert(t('error'), data.message || t('authError'));
        setConnected(false);
        setControlState('scan');
        setScanned(false);
        break;
      case 'content_received':
        setIsSyncing(false);
        setSyncingItemIds(new Set());
        setDeletingItemIds(new Set());
        console.log('[Control] TV confirmed content received');
        break;
      case 'sync_request':
        console.log('[Control] TV requested sync');
        if (currentBoard) {
          syncBoardToTV(currentBoard);
        }
        break;
    }
  };

  const syncContentToTV = async () => {
    if (!selectedBoardId) return;

    const allItems = [...localQRItems, ...localSlideItems];
    const total = allItems.length;

    // Save to board first
    updateBoard(selectedBoardId, {
      qrItems: localQRItems,
      slideItems: localSlideItems,
      settings: {
        slideInterval: localInterval,
        autoLoop: true,
        showIndicators: true,
        transition: localTransition,
      },
    });

    if (total === 0) {
      controlClient.send({
        type: 'content_update',
        qrItems: [],
        slideItems: [],
        settings: {
          interval: localInterval,
          transition: localTransition,
        },
      });
      return;
    }

    setIsSyncing(true);
    setShowSyncProgress(true);
    setSyncProgress(0);
    setCurrentSyncItem(0);
    setTotalSyncItems(total);
    setSyncStatus('sending');

    const allIds = new Set([...localQRItems.map(q => q.id), ...localSlideItems.map(s => s.id)]);
    setSyncingItemIds(allIds);

    // Send sync_start
    controlClient.send({
      type: 'sync_start',
      totalItems: total,
      settings: {
        interval: localInterval,
        transition: localTransition,
      },
    });

    // Send items one by one
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const isQR = 'url' in item;

      setCurrentSyncItem(i + 1);
      setSyncProgress(Math.round(((i + 1) / total) * 100));

      controlClient.send({
        type: 'sync_item',
        index: i,
        total: total,
        itemType: isQR ? 'qr' : 'slide',
        item: item,
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send sync_complete
    controlClient.send({
      type: 'sync_complete',
      qrCount: localQRItems.length,
      slideCount: localSlideItems.length,
    });

    setTimeout(() => {
      setShowSyncProgress(false);
      setIsSyncing(false);
      setSyncingItemIds(new Set());
      setSyncProgress(0);
    }, 800);
  };

  const handleIntervalChange = (newInterval: number) => {
    setLocalInterval(newInterval);
    if (isConnected && selectedBoardId) {
      controlClient.send({
        type: 'settings_update',
        settings: {
          interval: newInterval,
          transition: localTransition,
        },
      });
      updateBoard(selectedBoardId, {
        settings: {
          slideInterval: newInterval,
          autoLoop: true,
          showIndicators: true,
          transition: localTransition,
        },
      });
    }
  };

  const handleTransitionChange = (newTransition: TransitionType) => {
    setLocalTransition(newTransition);
    if (isConnected && selectedBoardId) {
      controlClient.send({
        type: 'settings_update',
        settings: {
          interval: localInterval,
          transition: newTransition,
        },
      });
      updateBoard(selectedBoardId, {
        settings: {
          slideInterval: localInterval,
          autoLoop: true,
          showIndicators: true,
          transition: newTransition,
        },
      });
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

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

    const updatedQRs = [...localQRItems, newQR];
    setLocalQRItems(updatedQRs);

    if (isConnected && selectedBoardId) {
      setIsSyncing(true);
      setSyncingItemIds(new Set([newQR.id]));
      controlClient.send({
        type: 'content_update',
        qrItems: updatedQRs,
        slideItems: localSlideItems,
        settings: {
          interval: localInterval,
          transition: localTransition,
        },
      });
      updateBoard(selectedBoardId, { qrItems: updatedQRs });
      setTimeout(() => {
        setIsSyncing(false);
        setSyncingItemIds(new Set());
      }, 5000);
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

        const targetAspect = 16 / 9;
        const currentAspect = originalWidth / originalHeight;

        let cropWidth = originalWidth;
        let cropHeight = originalHeight;
        let cropX = 0;
        let cropY = 0;

        if (currentAspect > targetAspect) {
          cropWidth = Math.round(originalHeight * targetAspect);
          cropX = Math.round((originalWidth - cropWidth) / 2);
        } else if (currentAspect < targetAspect) {
          cropHeight = Math.round(originalWidth / targetAspect);
          cropY = Math.round((originalHeight - cropHeight) / 2);
        }

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

        const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const newSlide: SlideItem = {
          id: Date.now().toString(),
          name: slideName || `Slide ${localSlideItems.length + 1}`,
          imageUri: manipulatedImage.uri,
          imageBase64: `data:image/jpeg;base64,${base64}`,
          createdAt: Date.now(),
          syncStatus: 'pending',
        };

        const updatedSlides = [...localSlideItems, newSlide];
        setLocalSlideItems(updatedSlides);

        if (isConnected && selectedBoardId) {
          setIsSyncing(true);
          setSyncingItemIds(new Set([newSlide.id]));
          controlClient.send({
            type: 'content_update',
            qrItems: localQRItems,
            slideItems: updatedSlides,
            settings: {
              interval: localInterval,
              transition: localTransition,
            },
          });
          updateBoard(selectedBoardId, { slideItems: updatedSlides });
          setTimeout(() => {
            setIsSyncing(false);
            setSyncingItemIds(new Set());
          }, 5000);
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
    setDeletingItemIds(prev => new Set(prev).add(id));

    const updatedQRs = localQRItems.filter((item) => item.id !== id);
    setLocalQRItems(updatedQRs);

    if (isConnected && selectedBoardId) {
      controlClient.send({
        type: 'content_update',
        qrItems: updatedQRs,
        slideItems: localSlideItems,
        settings: {
          interval: localInterval,
          transition: localTransition,
        },
      });
      updateBoard(selectedBoardId, { qrItems: updatedQRs });
    }

    setDeletingItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleRemoveSlide = (id: string) => {
    setDeletingItemIds(prev => new Set(prev).add(id));

    const updatedSlides = localSlideItems.filter((item) => item.id !== id);
    setLocalSlideItems(updatedSlides);

    if (isConnected && selectedBoardId) {
      controlClient.send({
        type: 'content_update',
        qrItems: localQRItems,
        slideItems: updatedSlides,
        settings: {
          interval: localInterval,
          transition: localTransition,
        },
      });
      updateBoard(selectedBoardId, { slideItems: updatedSlides });
    }

    setDeletingItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleStartPresentation = () => {
    if (localQRItems.length === 0 && localSlideItems.length === 0) {
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
    setSelectedBoardId(null);
    setCurrentBoard(null);
    router.replace('/');
  };

  const handleChangeBoard = () => {
    setControlState('select_board');
  };

  const handleCreateNewBoard = () => {
    router.push({
      pathname: '/board-editor' as any,
      params: { boardId: 'new' },
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const renderBoardItem = ({ item }: { item: MenuBoard }) => {
    const itemCount = item.qrItems.length + item.slideItems.length;

    return (
      <TouchableOpacity
        style={styles.boardCard}
        onPress={() => selectBoard(item)}
      >
        <View style={styles.boardInfo}>
          <Text style={styles.boardName}>{item.name || t('untitled') || 'Untitled'}</Text>
          {item.description ? (
            <Text style={styles.boardDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.boardMeta}>
            <Text style={styles.boardMetaText}>
              {itemCount} {t('elements')}
            </Text>
            <Text style={styles.boardMetaSeparator}>•</Text>
            <Text style={styles.boardMetaText}>
              {formatDate(item.updatedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.boardArrow}>
          <Text style={styles.boardArrowText}>›</Text>
        </View>
      </TouchableOpacity>
    );
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

  // Board selection screen
  if (controlState === 'select_board') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>{t('appName')}</Text>
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>{t('connected')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>{t('disconnect')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.selectBoardTitle}>
          {t('selectTemplate') || 'Select Template'}
        </Text>
        <Text style={styles.selectBoardHint}>
          {t('selectBoardHint') || 'Select a template to sync with the TV'}
        </Text>

        {loadingBoards ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2DD4BF" />
          </View>
        ) : boards.length === 0 ? (
          <View style={styles.emptyBoardsContainer}>
            <Text style={styles.emptyStateText}>{t('noBoards') || 'No templates yet'}</Text>
            <Text style={styles.emptyStateHint}>
              {t('createBoardHint') || 'Create your first template to organize your content'}
            </Text>
            <TouchableOpacity style={styles.createBoardButton} onPress={handleCreateNewBoard}>
              <Text style={styles.createBoardButtonText}>{t('createBoard') || 'Create Template'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={boards}
              keyExtractor={(item) => item.id}
              renderItem={renderBoardItem}
              contentContainerStyle={styles.boardsList}
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.createBoardFooter}>
              <TouchableOpacity style={styles.createBoardFab} onPress={handleCreateNewBoard}>
                <Text style={styles.createBoardFabText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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

      {/* Current board indicator */}
      <TouchableOpacity style={styles.currentBoardBar} onPress={handleChangeBoard}>
        <View style={styles.currentBoardInfo}>
          <Text style={styles.currentBoardLabel}>{t('currentTemplate') || 'Template'}:</Text>
          <Text style={styles.currentBoardName}>{currentBoard?.name || t('untitled')}</Text>
        </View>
        <Text style={styles.changeBoardText}>{t('change') || 'Change'}</Text>
      </TouchableOpacity>

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

            {localQRItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noQRCodes')}</Text>
                <Text style={styles.emptyStateHint}>{t('addQRHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {localQRItems.map((item) => {
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

            {localSlideItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noImages')}</Text>
                <Text style={styles.emptyStateHint}>{t('selectImageHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {localSlideItems.map((item) => {
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
                    localInterval === opt && styles.settingOptionActive,
                  ]}
                  onPress={() => handleIntervalChange(opt)}
                >
                  <Text
                    style={[
                      styles.settingOptionText,
                      localInterval === opt && styles.settingOptionTextActive,
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
                    localTransition === opt.value && styles.settingOptionActive,
                  ]}
                  onPress={() => handleTransitionChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.settingOptionText,
                      localTransition === opt.value && styles.settingOptionTextActive,
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
          {localQRItems.length + localSlideItems.length} {t('elements')}
        </Text>
        <TouchableOpacity style={styles.startButton} onPress={handleStartPresentation}>
          <Text style={styles.startButtonText}>{t('startOnTV')}</Text>
        </TouchableOpacity>
      </View>

      {/* Sync Progress Modal */}
      <SyncProgress
        visible={showSyncProgress}
        progress={syncProgress}
        currentItem={currentSyncItem}
        totalItems={totalSyncItems}
        status={syncStatus}
        title={t('syncingToTV') || 'Sincronizando con TV...'}
        subtitle={t('pleaseWait') || 'Por favor espera...'}
      />
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
    alignSelf: 'center',
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
  // Board selection styles
  selectBoardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
  },
  selectBoardHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBoardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  boardsList: {
    padding: 20,
    gap: 12,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D3A',
    marginBottom: 12,
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  boardDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  boardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boardMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  boardMetaSeparator: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  boardArrow: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardArrowText: {
    fontSize: 24,
    color: '#6B7280',
  },
  createBoardButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 16,
  },
  createBoardButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createBoardFooter: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
  createBoardFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2DD4BF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createBoardFabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Current board bar
  currentBoardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
  },
  currentBoardInfo: {
    flex: 1,
  },
  currentBoardLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  currentBoardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2DD4BF',
  },
  changeBoardText: {
    fontSize: 14,
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
