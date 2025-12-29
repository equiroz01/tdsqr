import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useQRItems } from '../../src/hooks/useStorage';
import { QRItem } from '../../src/types';

export default function QRViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items } = useQRItems();
  const [fullscreen, setFullscreen] = useState(false);
  const [item, setItem] = useState<QRItem | null>(null);

  useEffect(() => {
    const found = items.find((i) => i.id === id);
    setItem(found || null);
  }, [items, id]);

  useEffect(() => {
    if (fullscreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.unlockAsync();
    }
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, [fullscreen]);

  if (!item) {
    return (
      <>
        <Stack.Screen options={{ title: 'QR' }} />
        <View style={styles.container}>
          <Text style={styles.errorText}>QR no encontrado</Text>
        </View>
      </>
    );
  }

  if (fullscreen) {
    return (
      <TouchableOpacity
        style={styles.fullscreenContainer}
        activeOpacity={1}
        onPress={() => setFullscreen(false)}
      >
        <View style={styles.fullscreenQR}>
          <QRCode
            value={item.url}
            size={400}
            backgroundColor="#FFFFFF"
            color="#000000"
          />
        </View>
        <Text style={styles.fullscreenName}>{item.name}</Text>
        <Text style={styles.fullscreenHint}>Toca para salir</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
          headerBackTitle: 'Volver',
        }}
      />
      <View style={styles.container}>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={item.url}
              size={250}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.value}>{item.name}</Text>

          <Text style={styles.label}>URL / Contenido</Text>
          <Text style={styles.value} numberOfLines={3}>{item.url}</Text>
        </View>

        <TouchableOpacity style={styles.fullscreenButton} onPress={() => setFullscreen(true)}>
          <Text style={styles.fullscreenButtonText}>Pantalla Completa</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 24,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  qrWrapper: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  info: {
    marginBottom: 32,
  },
  label: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  fullscreenButton: {
    backgroundColor: '#00FFC3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullscreenButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenQR: {
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  fullscreenName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 32,
  },
  fullscreenHint: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
