# Airento TWA — Release build (Step A: Play Protect / targetSdk 35)

## 1. Create release keystore (once)

Run from `mobile/android-twa/android/` (store the file **outside git** or rely on `.gitignore`):

```bash
keytool -genkeypair -v \
  -keystore airento-release.keystore \
  -alias airento \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=airento.ru, OU=Mobile Engineering, O=Airento, L=Moscow, ST=Moscow, C=RU"
```

You will be prompted for **keystore password** and **key password** (may be the same). Save both in a password manager.

Print SHA-256 for Digital Asset Links (`/.well-known/assetlinks.json`):

```bash
keytool -list -v \
  -keystore airento-release.keystore \
  -alias airento
```

Copy the **SHA-256** certificate fingerprint into your site's `assetlinks.json` for package `ru.airento.app`.

## 2. Configure signing (local only)

```bash
cd mobile/android-twa/android
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:

```properties
storeFile=airento-release.keystore
storePassword=<your-store-password>
keyAlias=airento
keyPassword=<your-key-password>
```

Never commit `keystore.properties` or `*.keystore`.

## 3. Install Android SDK

- Android Studio Ladybug+ or command-line SDK
- **Android SDK Platform 35** (Android 15)
- **Build-Tools 35.x**
- Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`)

## 4. Build release APK / AAB

```bash
cd mobile/android-twa/android

# Windows
gradlew.bat clean assembleRelease

# macOS / Linux
./gradlew clean assembleRelease
```

**Outputs:**

| Artifact | Path |
|----------|------|
| APK | `app/build/outputs/apk/release/app-release.apk` |
| AAB (Play Store) | `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab` |

## 5. Verify signature (before distributing)

```bash
# APK
apksigner verify --verbose app/build/outputs/apk/release/app-release.apk

# Or
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk
```

Release build must **not** be signed with the debug keystore. Play Protect warns on debug + low `targetSdk`.

## 6. Install on device (smoke test)

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

## SDK SSOT

| Constant | Value | File |
|----------|-------|------|
| `compileSdkVersion` | **35** | `android/variables.gradle` |
| `targetSdkVersion` | **35** | `android/variables.gradle` |
| `minSdkVersion` | 23 | `android/variables.gradle` |

Bump `versionCode` / `versionName` in `app/build.gradle` before each store upload.

## Gradle wrapper note

If `gradlew` / `gradlew.bat` are missing, generate them once:

```bash
cd mobile/android-twa/android
gradle wrapper --gradle-version 8.7
```

Or open the `android` folder in Android Studio and let it sync.
