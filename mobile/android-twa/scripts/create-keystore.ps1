# Airento — создание релизного ключа (Windows, без знания программирования)
# Запуск: правой кнопкой → "Выполнить с помощью PowerShell"
# Или в терминале:  cd mobile\android-twa\scripts
#                    powershell -ExecutionPolicy Bypass -File .\create-keystore.ps1

$ErrorActionPreference = "Stop"

$androidDir = Join-Path $PSScriptRoot "..\android"
$keystorePath = Join-Path $androidDir "airento-release.keystore"

function Find-Keytool {
    $candidates = @(
        "$env:JAVA_HOME\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Eclipse Adoptium\jdk-17*\bin\keytool.exe",
        "C:\Program Files\Microsoft\jdk-17*\bin\keytool.exe",
        "C:\Program Files\Java\jdk-17*\bin\keytool.exe"
    )
    foreach ($pattern in $candidates) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved) { return $resolved.Path }
    }
    return $null
}

$keytool = Find-Keytool

if (-not $keytool) {
    Write-Host ""
    Write-Host "=== keytool не найден ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Нужно один раз установить Java (JDK). Выберите один способ:"
    Write-Host ""
    Write-Host "  СПОСОБ А (проще всего):" -ForegroundColor Cyan
    Write-Host "  1. Откройте в браузере: https://adoptium.net/temurin/releases/"
    Write-Host "  2. Version: 17 или 21, Operating System: Windows, Architecture: x64"
    Write-Host "  3. Скачайте .msi и установите (все галочки по умолчанию — OK)"
    Write-Host "  4. Закройте и снова откройте терминал / Cursor"
    Write-Host "  5. Запустите этот скрипт ещё раз"
    Write-Host ""
    Write-Host "  СПОСОБ Б (если ставите Android Studio):" -ForegroundColor Cyan
    Write-Host "  Android Studio уже содержит keytool в папке jbr\bin"
    Write-Host ""
    exit 1
}

if (Test-Path $keystorePath) {
    Write-Host "Файл ключа уже существует:" -ForegroundColor Yellow
    Write-Host "  $keystorePath"
    Write-Host "Удалите его вручную, если хотите создать новый (осторожно — старый ключ нельзя восстановить!)."
    exit 1
}

Write-Host ""
Write-Host "Найден keytool: $keytool" -ForegroundColor Green
Write-Host "Сейчас создадим файл: $keystorePath"
Write-Host ""
Write-Host "Вас спросят ПАРОЛЬ (два раза). Придумайте надёжный и сохраните в менеджере паролей!" -ForegroundColor Cyan
Write-Host "Можно использовать один пароль для хранилища и для ключа." -ForegroundColor Cyan
Write-Host ""
Read-Host "Нажмите Enter, чтобы продолжить"

& $keytool -genkeypair -v `
    -keystore $keystorePath `
    -alias airento `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=airento.ru, OU=Mobile, O=Airento, L=Moscow, C=RU"

Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Green
Write-Host "Файл ключа: $keystorePath"
Write-Host ""
Write-Host "Теперь получите SHA-256 для сайта (скопируйте строку SHA256: ...):" -ForegroundColor Cyan
Write-Host ""

& $keytool -list -v -keystore $keystorePath -alias airento

Write-Host ""
Write-Host "Вставьте SHA-256 в файл public\.well-known\assetlinks.json вместо XX:XX:..." -ForegroundColor Yellow
Write-Host ""
