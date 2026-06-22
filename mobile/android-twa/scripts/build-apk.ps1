# Airento - release APK build (Windows)
# From repo root:
#   powershell -ExecutionPolicy Bypass -File mobile\android-twa\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$androidDir = Join-Path $repoRoot "mobile\android-twa\android"
$wrapperJar = Join-Path $androidDir "gradle\wrapper\gradle-wrapper.jar"
$keystoreInAndroid = Join-Path $androidDir "airento-release.keystore"
$keystoreInRoot = Join-Path $repoRoot "airento-release.keystore"
$keystoreProps = Join-Path $androidDir "keystore.properties"
$keystoreExample = Join-Path $androidDir "keystore.properties.example"

function Find-JavaHomeForAndroid {
    $patterns = @(
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    foreach ($pattern in $patterns) {
        $dir = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($dir -and (Test-Path (Join-Path $dir.FullName "bin\java.exe"))) {
            return $dir.FullName
        }
    }
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        $ver = & (Join-Path $env:JAVA_HOME "bin\java.exe") -version 2>&1 | Out-String
        if ($ver -match 'version "1[7-9]\.|version "2[01]\.') {
            return $env:JAVA_HOME
        }
    }
    return $null
}

function Ensure-Java17 {
    $javaHome = Find-JavaHomeForAndroid
    if (-not $javaHome) {
        Write-Host "ERROR: Android build needs Java 17 (not Java 25)." -ForegroundColor Red
        Write-Host "Install: winget install EclipseAdoptium.Temurin.17.JDK"
        Write-Host "Then close and reopen Cursor, run this script again."
        exit 1
    }
    $env:JAVA_HOME = $javaHome
    $env:PATH = "$javaHome\bin;" + $env:PATH
    Write-Host "Using Java: $javaHome" -ForegroundColor Green
    & (Join-Path $javaHome "bin\java.exe") -version
}

function Resolve-AndroidSdkDir {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
        (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'),
        'C:\Android\Sdk'
    ) | Where-Object { $_ -and $_.Trim() -ne '' }

    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir 'platform-tools')) {
            return (Resolve-Path $dir).Path
        }
    }

    # Standard Windows default (Android Studio SDK Manager)
    return (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
}

function Format-GradleSdkDir([string]$sdkPath) {
    return ($sdkPath -replace '\\', '/')
}

function Ensure-LocalProperties {
    $sdkDir = Resolve-AndroidSdkDir
    $gradleSdk = Format-GradleSdkDir $sdkDir
    $localProps = Join-Path $androidDir 'local.properties'
    $content = "sdk.dir=$gradleSdk`n"

    [System.IO.File]::WriteAllText($localProps, $content, [System.Text.UTF8Encoding]::new($false))
    $env:ANDROID_HOME = $sdkDir
    $env:ANDROID_SDK_ROOT = $sdkDir

    Write-Host "Android SDK path: $sdkDir" -ForegroundColor Green
    Write-Host "Wrote local.properties -> sdk.dir=$gradleSdk" -ForegroundColor Green

    if (-not (Test-Path (Join-Path $sdkDir 'platform-tools'))) {
        Write-Host ""
        Write-Host "WARNING: SDK folder exists but platform-tools not found yet." -ForegroundColor Yellow
        Write-Host "Open Android Studio once -> More Actions -> SDK Manager -> install Android SDK." -ForegroundColor Yellow
        Write-Host "Default location should be: $sdkDir" -ForegroundColor Yellow
        Write-Host ""
    }
}

function Ensure-GradleWrapper {
    if ((Test-Path $wrapperJar) -and (Test-Path (Join-Path $androidDir "gradlew.bat"))) {
        return
    }
    Write-Host "Downloading Gradle Wrapper (one time)..." -ForegroundColor Cyan
    $jarUrl = "https://github.com/gradle/gradle/raw/v8.7.0/gradle/wrapper/gradle-wrapper.jar"
    New-Item -ItemType Directory -Force -Path (Split-Path $wrapperJar) | Out-Null
    Invoke-WebRequest -Uri $jarUrl -OutFile $wrapperJar -UseBasicParsing
    Write-Host "Gradle Wrapper ready." -ForegroundColor Green
}

function Ensure-Keystore {
    if (Test-Path $keystoreInAndroid) { return }
    if (Test-Path $keystoreInRoot) {
        Write-Host "Copying keystore from repo root to android folder..." -ForegroundColor Yellow
        Copy-Item $keystoreInRoot $keystoreInAndroid
        return
    }
    Write-Host "ERROR: airento-release.keystore not found." -ForegroundColor Red
    Write-Host "Run first: mobile\android-twa\scripts\create-keystore.ps1"
    exit 1
}

function Ensure-KeystoreProperties {
    if (Test-Path $keystoreProps) { return }
    Write-Host ""
    Write-Host "Need keystore.properties with your keystore passwords." -ForegroundColor Yellow
    Write-Host "File path: $keystoreProps"
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Cyan
    Get-Content $keystoreExample
    Write-Host ""
    $storePass = Read-Host "Enter storePassword"
    $keyPass = Read-Host "Enter keyPassword (Enter = same as store)"
    if ([string]::IsNullOrWhiteSpace($keyPass)) { $keyPass = $storePass }
    @(
        "storeFile=airento-release.keystore",
        "storePassword=$storePass",
        "keyAlias=airento",
        "keyPassword=$keyPass"
    ) | ForEach-Object { $_ } | Set-Content -Path $keystoreProps -Encoding Ascii
    Write-Host "Created keystore.properties" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Airento: release APK build ===" -ForegroundColor Green
Write-Host "Folder: $androidDir"
Write-Host ""

Ensure-Java17
Ensure-LocalProperties

$sdkCheck = Resolve-AndroidSdkDir
if (-not (Test-Path (Join-Path $sdkCheck 'platform-tools'))) {
    Write-Host ""
    Write-Host "ERROR: Android SDK not installed yet." -ForegroundColor Red
    Write-Host "1. Open Android Studio"
    Write-Host "2. More Actions (or File) -> SDK Manager"
    Write-Host "3. Install Android SDK Platform 35 + Build-Tools 35"
    Write-Host "4. SDK path should be: $sdkCheck"
    Write-Host "5. Run this script again"
    exit 1
}

Ensure-GradleWrapper
Ensure-Keystore
Ensure-KeystoreProperties

Set-Location $androidDir

Write-Host "Running Gradle (first run may take 5-15 min)..." -ForegroundColor Cyan
& (Join-Path $androidDir "gradlew.bat") clean assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. Common fixes:" -ForegroundColor Red
    if (-not (Test-Path (Join-Path (Resolve-AndroidSdkDir) 'platform-tools'))) {
        Write-Host "  1) Open Android Studio -> SDK Manager -> install Android SDK Platform 35"
        Write-Host "     Default path: $(Join-Path $env:LOCALAPPDATA 'Android\Sdk')"
    } else {
        Write-Host "  1) Install Android Studio (includes Android SDK)"
    }
    Write-Host "  2) Wrong password in keystore.properties"
    Write-Host "  3) Java 25 is too new - script now uses Java 17 automatically"
    Write-Host "  4) Set ANDROID_HOME if SDK is installed"
    exit $LASTEXITCODE
}

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "APK: $apk"
Write-Host ""
Write-Host "Copy APK to phone or run: adb install -r `"$apk`"" -ForegroundColor Cyan
