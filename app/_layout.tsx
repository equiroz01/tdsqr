import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/context/AppContext';
import { I18nProvider } from '../src/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
            animation: 'fade',
          }}
        />
      </AppProvider>
    </I18nProvider>
  );
}
