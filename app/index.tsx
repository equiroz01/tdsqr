import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ModeSelectScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>TDS QR</Text>
        <Text style={styles.subtitle}>TV Display Slides + QR</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.question}>Como vas a usar este dispositivo?</Text>

        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => router.push('/tv')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>📺</Text>
          <View style={styles.modeInfo}>
            <Text style={styles.modeTitle}>Modo TV / Display</Text>
            <Text style={styles.modeDescription}>
              Muestra contenido en pantalla completa. Ideal para televisores y pantallas comerciales.
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
            <Text style={styles.modeTitle}>Modo Control</Text>
            <Text style={styles.modeDescription}>
              Administra y envia contenido a un TV conectado. Crea QRs y sube imagenes.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Ambos dispositivos deben estar en la misma red WiFi
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
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#A855F7',
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
