# Airento TWA — Release build (Step A: Play Protect / targetSdk 35)

**Package:** `ru.airento.app`  
**Host:** `https://airento.ru/`  
**Digital Asset Links (SSOT):** `public/.well-known/assetlinks.json` — **first** statement = TWA; second = Capacitor scaffold (`app.airento.shell`, placeholder until Cap ships).

Stage **189.35** restored the historical TWA fingerprint (see §7). If Play App Signing is enabled, prefer the **Play Console → App signing key certificate** SHA-256 over the upload keystore when they differ.

---

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

### Print SHA-256 for Digital Asset Links

From the **same** keystore used to sign the Play upload (or compare with Play Console):

```bash
cd mobile/android-twa/android

keytool -list -v \
  -keystore airento-release.keystore \
  -alias airento
```

In the output, find the line **`SHA256:`** (colon-separated hex).

1. Copy that value into `public/.well-known/assetlinks.json` under the statement with  
   `"package_name": "ru.airento.app"` → `sha256_cert_fingerprints` (array; you may keep multiple fingerprints if both upload + Play App Signing keys must verify).
2. **Do not** put the TWA SHA under `app.airento.shell` (that is Cap / future).
3. Deploy the site so `https://airento.ru/.well-known/assetlinks.json` serves the updated JSON (`Content-Type: application/json` via `vercel.json`).
4. Verify with Google’s checker / `adb shell pm get-app-links ru.airento.app` after install.

**Play App Signing:** Play Console → Your app → **Setup → App signing** → copy **App signing key certificate** SHA-256. If it differs from the upload keystore, **use the Play App Signing SHA** in `assetlinks.json` (you can list both).

---

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

---

## 3. Install Android SDK

- Android Studio Ladybug+ or command-line SDK
- **Android SDK Platform 35** (Android 15)
- **Build-Tools 35.x**
- Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`)

---

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

---

## 5. Verify signature (before distributing)

```bash
# APK
apksigner verify --verbose app/build/outputs/apk/release/app-release.apk

# Or
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk
```

Release build must **not** be signed with the debug keystore. Play Protect warns on debug + low `targetSdk`.

---

## 6. Install on device (smoke test)

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Confirm Digital Asset Links after the site deploys the TWA statement (see §1 / §7).

---

## 7. assetlinks.json map (Stage 189.35)

| Statement | `package_name` | Fingerprint |
|-----------|----------------|-------------|
| **TWA (primary)** | `ru.airento.app` | Restored from git history (pre-`9ca405ba`): `78:C0:FE:…:BB:8A` — **confirm** with `keytool` / Play Console |
| Capacitor (future) | `app.airento.shell` | `REPLACE_WITH_CAPACITOR_PLAY_APP_SIGNING_SHA256` until Cap ships |

Historical note: commit `9ca405ba` replaced the TWA statement with Cap-only placeholder; 189.35 restores TWA and keeps Cap as a **second** statement (do not overwrite).

---

## SDK SSOT

| Constant | Value | File |
|----------|-------|------|
| `compileSdkVersion` | **35** | `android/variables.gradle` |
| `targetSdkVersion` | **35** | `android/variables.gradle` |
| `minSdkVersion` | 23 | `android/variables.gradle` |

Bump `versionCode` / `versionName` in `app/build.gradle` before each store upload.

---

## Gradle wrapper note

If `gradlew` / `gradlew.bat` are missing, generate them once:

```bash
cd mobile/android-twa/android
gradle wrapper --gradle-version 8.7
```

Or open the `android` folder in Android Studio and let it sync.
