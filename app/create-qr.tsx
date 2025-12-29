import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { useQRItems } from '../src/hooks/useStorage';

export default function CreateQRScreen() {
  const router = useRouter();
  const { addItem } = useQRItems();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el QR');
      return;
    }
    if (!url.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL o texto para el QR');
      return;
    }

    setSaving(true);
    try {
      await addItem({ name: name.trim(), url: url.trim() });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el QR');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nuevo QR',
          headerBackTitle: 'Volver',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewContainer}>
              {url.length > 0 ? (
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={url || ' '}
                    size={180}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                  />
                </View>
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.placeholderText}>Vista previa QR</Text>
                </View>
              )}
            </View>

            <View style={styles.form}>
              <Input
                label="Nombre"
                placeholder="Ej: WiFi Tienda, Menu, Instagram..."
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Input
                label="URL o Texto"
                placeholder="https://ejemplo.com"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={saving ? 'Guardando...' : 'Guardar QR'}
              onPress={handleSave}
              disabled={saving || !name.trim() || !url.trim()}
            />
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="secondary"
              style={styles.cancelButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2C2C2C',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  form: {
    marginBottom: 24,
  },
  footer: {
    padding: 24,
    paddingTop: 0,
  },
  cancelButton: {
    marginTop: 8,
  },
});
