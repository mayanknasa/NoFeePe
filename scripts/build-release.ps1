param (
    [string]$Version = "v1.0.0"
)

Write-Host "==> Building noFeePe Release APK ($Version)..." -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# 1. Bundle JavaScript & copy assets
Write-Host "==> Generating offline JS bundle..." -ForegroundColor Yellow
if (-not (Test-Path "android\app\src\main\assets")) {
    New-Item -ItemType Directory -Path "android\app\src\main\assets" -Force | Out-Null
}

npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android\app\src\main\assets\index.android.bundle --assets-dest android\app\src\main\res\

if ($LASTEXITCODE -ne 0) {
    Write-Host "Bundle creation failed!" -ForegroundColor Red
    exit 1
}

# 2. Build APK via Gradle (Release mode with native symbol stripping & ARM architectures)
Write-Host "==> Compiling Android Release APK with Gradle..." -ForegroundColor Yellow
Set-Location "$rootDir\android"
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a" --no-daemon

if ($LASTEXITCODE -ne 0) {
    Write-Host "Gradle release build failed!" -ForegroundColor Red
    exit 1
}

# 3. Create release directory and copy named APK
Set-Location $rootDir
$releaseDir = "$rootDir\release"
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

$sourceApk = "$rootDir\android\app\build\outputs\apk\release\app-release.apk"
$destApk = "$releaseDir\NoFeePe_$Version.apk"

Copy-Item $sourceApk $destApk -Force

Write-Host "==> Successfully created: $destApk" -ForegroundColor Green
Write-Host "==> File size: $((Get-Item $destApk).Length / 1MB | ForEach-Object { [math]::Round($_, 2) }) MB" -ForegroundColor Green
Write-Host "Ready to upload to GitHub Releases: https://github.com/mayanknasa/NoFeePe/releases" -ForegroundColor Cyan
