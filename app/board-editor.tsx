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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMenuBoards } from '../src/hooks/useMenuBoards';
import { useTranslation } from '../src/i18n';
import { MenuBoard, QRItem, SlideItem, TransitionType, PresentationSettings } from '../src/types';

const INTERVAL_OPTIONS = [3, 5, 10, 15, 30];
const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
];

const DEFAULT_SETTINGS: PresentationSettings = {
  slideInterval: 5,
  autoLoop: true,
  showIndicators: true,
  transition: 'fade',
};

type Tab = 'qr' | 'slides';

export default function BoardEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ boardId: string }>();
  const { t } = useTranslation();
  const { boards, addBoard, updateBoard, getBoard, loading } = useMenuBoards();

  const isNew = params.boardId === 'new';
  const [hasChanges, setHasChanges] = useState(false);

  // Board state
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [qrItems, setQrItems] = useState<QRItem[]>([]);
  const [slideItems, setSlideItems] = useState<SlideItem[]>([]);
  const [settings, setSettings] = useState<PresentationSettings>(DEFAULT_SETTINGS);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('qr');
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // QR creation form
  const [qrName, setQrName] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // Slide creation
  const [slideName, setSlideName] = useState('');

  // Load existing board data
  useEffect(() => {
    if (!loading && !isNew && params.boardId) {
      const board = getBoard(params.boardId);
      if (board) {
        setBoardName(board.name);
        setBoardDescription(board.description || '');
        setQrItems(board.qrItems);
        setSlideItems(board.slideItems);
        setSettings(board.settings);
      }
    }
  }, [loading, isNew, params.boardId, getBoard]);

  const handleSave = async () => {
    if (!boardName.trim()) {
      Alert.alert(t('error'), t('enterBoardName') || 'Please enter a template name');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        await addBoard({
          name: boardName.trim(),
          description: boardDescription.trim() || undefined,
          qrItems,
          slideItems,
          settings,
        });
      } else {
        await updateBoard(params.boardId!, {
          name: boardName.trim(),
          description: boardDescription.trim() || undefined,
          qrItems,
          slideItems,
          settings,
        });
      }
      setHasChanges(false);
      router.back();
    } catch (error) {
      console.error('[BoardEditor] Save error:', error);
      Alert.alert(t('error'), t('saveFailed') || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        t('unsavedChanges') || 'Unsaved Changes',
        t('unsavedChangesConfirm') || 'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('discard') || 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
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

    setQrItems([...qrItems, newQR]);
    setQrName('');
    setQrUrl('');
    setHasChanges(true);
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
          name: slideName || `Slide ${slideItems.length + 1}`,
          imageUri: manipulatedImage.uri,
          imageBase64: `data:image/jpeg;base64,${base64}`,
          createdAt: Date.now(),
        };

        setSlideItems([...slideItems, newSlide]);
        setSlideName('');
        setHasChanges(true);
      } catch (error) {
        console.error('[BoardEditor] Error processing image:', error);
        Alert.alert(t('error'), t('imageProcessError') || 'Failed to process image');
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleRemoveQR = (id: string) => {
    setQrItems(qrItems.filter((item) => item.id !== id));
    setHasChanges(true);
  };

  const handleRemoveSlide = (id: string) => {
    setSlideItems(slideItems.filter((item) => item.id !== id));
    setHasChanges(true);
  };

  const handleIntervalChange = (newInterval: number) => {
    setSettings({ ...settings, slideInterval: newInterval });
    setHasChanges(true);
  };

  const handleTransitionChange = (newTransition: TransitionType) => {
    setSettings({ ...settings, transition: newTransition });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2DD4BF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{t('cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {isNew ? (t('newBoard') || 'New Template') : (t('editBoard') || 'Edit Template')}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Board Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('boardInfo') || 'Template Info'}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('boardName') || 'Template name'}
            placeholderTextColor="#666666"
            value={boardName}
            onChangeText={(text) => { setBoardName(text); setHasChanges(true); }}
          />
          <TextInput
            style={styles.input}
            placeholder={t('boardDescription') || 'Description (optional)'}
            placeholderTextColor="#666666"
            value={boardDescription}
            onChangeText={(text) => { setBoardDescription(text); setHasChanges(true); }}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
            onPress={() => setActiveTab('qr')}
          >
            <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>
              {t('qrCodes')} ({qrItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'slides' && styles.tabActive]}
            onPress={() => setActiveTab('slides')}
          >
            <Text style={[styles.tabText, activeTab === 'slides' && styles.tabTextActive]}>
              {t('images')} ({slideItems.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
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

            {qrItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noQRCodes')}</Text>
                <Text style={styles.emptyStateHint}>{t('addQRHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {qrItems.map((item) => (
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
              <TouchableOpacity
                style={[styles.addButton, isProcessingImage && styles.addButtonDisabled]}
                onPress={handlePickImage}
                disabled={isProcessingImage}
              >
                {isProcessingImage ? (
                  <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color="#2DD4BF" />
                    <Text style={[styles.addButtonText, { marginLeft: 8 }]}>
                      {t('processing')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.addButtonText}>{t('selectImage')}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.imageFormatHint}>{t('imageFormatHint')}</Text>
            </View>

            {slideItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noImages')}</Text>
                <Text style={styles.emptyStateHint}>{t('selectImageHint')}</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {slideItems.map((item) => (
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

        {/* Settings */}
        <TouchableOpacity
          style={styles.settingsToggle}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsToggleText}>
            {t('presentationSettings') || 'Presentation Settings'}
          </Text>
          <Text style={styles.settingsToggleArrow}>{showSettings ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('interval')}</Text>
              <View style={styles.settingOptions}>
                {INTERVAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.settingOption,
                      settings.slideInterval === opt && styles.settingOptionActive,
                    ]}
                    onPress={() => handleIntervalChange(opt)}
                  >
                    <Text
                      style={[
                        styles.settingOptionText,
                        settings.slideInterval === opt && styles.settingOptionTextActive,
                      ]}
                    >
                      {opt}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('transition')}</Text>
              <View style={styles.settingOptions}>
                {TRANSITION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.settingOption,
                      styles.settingOptionWide,
                      settings.transition === opt.value && styles.settingOptionActive,
                    ]}
                    onPress={() => handleTransitionChange(opt.value)}
                  >
                    <Text
                      style={[
                        styles.settingOptionText,
                        settings.transition === opt.value && styles.settingOptionTextActive,
                      ]}
                    >
                      {opt.value === 'none' ? t('none') : opt.value === 'fade' ? t('fade') : t('slide')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {qrItems.length + slideItems.length} {t('elements')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3A',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3A',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
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
  tabContent: {
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 24,
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
    marginBottom: 12,
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
  settingsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#16161F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  settingsToggleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsToggleArrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  settingsPanel: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D3A',
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0A0A0F',
    borderTopWidth: 1,
    borderTopColor: '#2D2D3A',
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
