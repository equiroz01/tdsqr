# Guia de Publicacion - TDS QR

## Requisitos Previos

1. Cuenta de Expo: https://expo.dev
2. EAS CLI instalado globalmente:
   ```bash
   npm install -g eas-cli
   ```
3. Iniciar sesion en EAS:
   ```bash
   eas login
   ```

## Perfiles de Build

| Perfil | Uso | Android | iOS |
|--------|-----|---------|-----|
| `development` | Desarrollo con dev client | APK | Simulator/Device |
| `preview` | Testing interno | APK | Ad Hoc |
| `production` | Tiendas | AAB | App Store |

## Android

### Build Preview (APK para testing)

```bash
eas build --profile preview --platform android
```

Esto genera un APK que puedes instalar directamente en dispositivos Android.

### Build Production (Google Play)

```bash
eas build --profile production --platform android
```

Genera un AAB (Android App Bundle) para subir a Google Play Console.

## iOS

### Configuracion Inicial (cuenta personal)

1. Asegurate de tener una cuenta de Apple Developer ($99/year)

2. Configura las credenciales en `eas.json`:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "tu@email.com",
         "ascAppId": "1234567890",
         "appleTeamId": "ABCD1234"
       }
     }
   }
   ```

   - `appleId`: Tu email de Apple Developer
   - `ascAppId`: ID de la app en App Store Connect (lo obtienes al crear la app)
   - `appleTeamId`: Tu Team ID (visible en developer.apple.com > Membership)

### Build Preview (TestFlight interno)

```bash
eas build --profile preview --platform ios
```

### Build Production (App Store)

```bash
eas build --profile production --platform ios
```

### Submit a App Store

```bash
eas submit --platform ios
```

## Builds para Ambas Plataformas

```bash
# Preview (testing)
eas build --profile preview --platform all

# Production
eas build --profile production --platform all
```

## Workflow Recomendado

1. **Desarrollo**: Usa Expo Go o development build
2. **Testing interno**: `eas build --profile preview`
3. **Release**: `eas build --profile production` + `eas submit`

## Comandos Utiles

```bash
# Ver estado de builds
eas build:list

# Cancelar un build
eas build:cancel

# Ver credenciales configuradas
eas credentials

# Actualizar app sin nuevo build (OTA)
eas update --branch production
```

## Notas

- Los builds de iOS requieren una cuenta de Apple Developer activa
- Para distribucion interna en iOS, necesitas registrar los UDIDs de los dispositivos
- El primer build de iOS te pedira crear/configurar certificados y provisioning profiles
- EAS maneja automaticamente los certificados si lo permites

## Troubleshooting

### Error de credenciales iOS
```bash
eas credentials --platform ios
```
Selecciona "Remove" y vuelve a crear las credenciales.

### Build falla por dependencias
```bash
npx expo-doctor
npx expo install --fix
```

### Limpiar cache
```bash
npx expo start --clear
```
