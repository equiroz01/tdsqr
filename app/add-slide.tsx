import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { useSlideItems } from '../src/hooks/useStorage';

export default function AddSlideScreen() {
  const router = useRouter();
  const { addItem } = useSlideItems();
  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galeria para seleccionar imagenes');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el slide');
      return;
    }
    if (!imageUri) {
      Alert.alert('Error', 'Por favor selecciona una imagen');
      return;
    }

    setSaving(true);
    try {
      await addItem({ name: name.trim(), imageUri });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el slide');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Agregar Slide',
          headerBackTitle: 'Volver',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderIcon}>+</Text>
                <Text style={styles.placeholderText}>Toca para seleccionar imagen</Text>
                <Text style={styles.placeholderSubtext}>Formato 16:9 recomendado</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.form}>
            <Input
              label="Nombre del slide"
              placeholder="Ej: Promocion, Menu del dia..."
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={saving ? 'Guardando...' : 'Guardar Slide'}
            onPress={handleSave}
            disabled={saving || !name.trim() || !imageUri}
          />
          <Button
            title="Cancelar"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.cancelButton}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
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
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2C2C2C',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    color: '#00FFC3',
    marginBottom: 16,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  placeholderSubtext: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  form: {
    marginTop: 16,
  },
  footer: {
    padding: 24,
  },
  cancelButton: {
    marginTop: 8,
  },
});
