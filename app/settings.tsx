import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation, Language } from '../src/i18n';

const languages: { code: Language; labelKey: 'spanish' | 'english' | 'portuguese'; flag: string }[] = [
  { code: 'es', labelKey: 'spanish', flag: '🇪🇸' },
  { code: 'en', labelKey: 'english', flag: '🇺🇸' },
  { code: 'pt', labelKey: 'portuguese', flag: '🇧🇷' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.optionsList}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.optionItem,
                  language === lang.code && styles.optionItemActive,
                ]}
                onPress={() => setLanguage(lang.code)}
              >
                <Text style={styles.optionFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.optionText,
                    language === lang.code && styles.optionTextActive,
                  ]}
                >
                  {t(lang.labelKey)}
                </Text>
                {language === lang.code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <View style={styles.aboutCard}>
            <Text style={styles.appName}>{t('appName')}</Text>
            <Text style={styles.appSubtitle}>{t('appSubtitle')}</Text>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>{t('version')}</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#A855F7',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionsList: {
    backgroundColor: '#16161F',
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3A',
  },
  optionItemActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  optionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  optionTextActive: {
    color: '#A855F7',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#A855F7',
    fontWeight: 'bold',
  },
  aboutCard: {
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A855F7',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  versionValue: {
    fontSize: 14,
    color: '#FFFFFF',
  },
});
