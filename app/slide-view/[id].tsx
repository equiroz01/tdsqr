import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSlideItems } from '../../src/hooks/useStorage';
import { SlideItem } from '../../src/types';

export default function SlideViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items } = useSlideItems();
  const [fullscreen, setFullscreen] = useState(false);
  const [item, setItem] = useState<SlideItem | null>(null);

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
        <Stack.Screen options={{ title: 'Slide' }} />
        <View style={styles.container}>
          <Text style={styles.errorText}>Slide no encontrado</Text>
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
        <Image source={{ uri: item.imageUri }} style={styles.fullscreenImage} />
        <View style={styles.fullscreenOverlay}>
          <Text style={styles.fullscreenHint}>Toca para salir</Text>
        </View>
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
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.imageUri }} style={styles.image} />
        </View>

        <View style={styles.info}>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.value}>{item.name}</Text>
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
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  fullscreenOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullscreenHint: {
    color: '#AAAAAA',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
