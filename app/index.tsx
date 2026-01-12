import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n';
import { isAndroidTV } from '../src/services/DeviceService';

export default function ModeSelectScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isTV, setIsTV] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if running on Android TV
    const checkDevice = () => {
      const tvDevice = isAndroidTV();
      setIsTV(tvDevice);

      // If it's a TV, automatically redirect to TV mode
      if (tvDevice) {
        router.replace('/tv');
      }
    };

    checkDevice();
  }, []);

  // Show loading while checking device type
  if (isTV === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2DD4BF" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If it's a TV, show loading (will redirect)
  if (isTV) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2DD4BF" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Normal mode selection for mobile devices
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <View style={styles.headerCenter}>
          <Text style={styles.logo}>{t('appName')}</Text>
          <Text style={styles.subtitle}>{t('appSubtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.question}>{t('modeQuestion')}</Text>

        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => router.push('/tv')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>📺</Text>
          <View style={styles.modeInfo}>
            <Text style={styles.modeTitle}>{t('tvMode')}</Text>
            <Text style={styles.modeDescription}>
              {t('tvModeDescription')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => router.push('/control')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>📱</Text>
          <View style={styles.modeInfo}>
            <Text style={styles.modeTitle}>{t('controlMode')}</Text>
            <Text style={styles.modeDescription}>
              {t('controlModeDescription')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('networkWarning')}
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
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  headerLeft: {
    width: 44,
  },
  headerCenter: {
    alignItems: 'center',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#2DD4BF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  question: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  modeIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
