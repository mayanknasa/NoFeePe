<p align="center">
  <img src="assets/logo.png" width="120" height="120" alt="NoFeePe Logo" />
</p>

<h1 align="center">NoFeePe ⚡</h1>

<p align="center">
  <strong>Android-first, open-source smart UPI payment utility with automated micro-installment splitting.</strong><br>
  <em>Developed by Mayank Nasa</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://developer.android.com"><img src="https://img.shields.io/badge/Platform-Android%2011+-green.svg" alt="Platform: Android" /></a>
  <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/React%20Native-0.76%2B%20(Fabric)-61DAFB.svg" alt="React Native" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-Strict-3178C6.svg" alt="TypeScript" /></a>
  <a href="https://github.com/mayanknasa/NoFeePe/releases"><img src="https://img.shields.io/badge/Download-Latest%20APK-7C5CFF.svg" alt="GitHub Releases" /></a>
</p>

---

## 📦 Releases & Downloads

Pre-built, ready-to-install Android APKs are published with every release:

* **Official GitHub Releases**: [github.com/mayanknasa/NoFeePe/releases](https://github.com/mayanknasa/NoFeePe/releases)
* **Release File Format**: `NoFeePe_v<version>.apk` (e.g., [`NoFeePe_v1.0.0.apk`](https://github.com/mayanknasa/NoFeePe/releases))
* **In-App Update Checker**: The app automatically checks GitHub Releases on startup (`api.github.com/repos/mayanknasa/NoFeePe/releases/latest`) and notifies you when an update is available, allowing one-tap APK download.

---

## 💡 What is NoFeePe?

In India's Unified Payments Interface (UPI) ecosystem, high-value payments to merchants often face friction:
1. **Merchant Discount Rate (MDR) charges** levied on Person-to-Merchant (P2M) transactions above ₹2,000.
2. Single-transaction limits enforced by issuing banks on individual UPI transfers.
3. Daily merchant acceptance limits leading to failed payments.

**NoFeePe** solves this transparently. When a user scans any merchant or peer UPI QR code and enters an amount greater than ₹1,999.00, NoFeePe provides the option to **Split & Pay** — automatically calculating an optimal sequence of micro-installments strictly capped at **₹1,999.00** each, eliminating merchant MDR charges entirely.

The user then executes each installment sequentially via their favorite installed UPI app (PhonePe, Google Pay, Paytm, BHIM, Navi, CRED, Super.money, etc.) with a single deliberate tap per installment.

> **Crucial Security Principle**: NoFeePe is **not** a payment processor. It never asks for, reads, or stores UPI PINs, bank accounts, card numbers, or OTPs. It constructs an official Android Intent (`upi://pay`) and hands off execution to your existing, authenticated UPI apps.

---

## ✨ Key Features

* 📷 **High-Speed QR Scanner**: Built on `react-native-vision-camera` with custom neon viewfinder, looping laser sweep, torch toggle, and gallery QR decoding.
* ⚡ **Zero-MDR Split & Pay Engine**: Mathematically verified installment planner capping individual transactions at ₹1,999.00 to avoid MDR charges.
* 💳 **Direct Pay**: Standard single-shot payment for amounts under ₹1,999 or when split isn't needed.
* ⌨️ **Smart Manual UPI Entry**: Dedicated top-anchored keyboard mode with 1-tap bank handle autocomplete chips (`@okaxis`, `@okhdfcbank`, `@paytm`, `@ybl`, `@upi`, `@sbi`), persistent keyboard focus, and strict `VPA_REGEX` validation.
* 🎨 **Theme Purple & Bank-Grade Design**: Premium dark glassmorphism theme with solid Theme Purple action buttons (`#6338F2` / `#7C5CFF`) and high-contrast light purple typography (`#C4B5FD`).
* 🎯 **Geometric Vector Icon Suite**: Bank-grade pure React Native geometric icons (`AppIcon.tsx`) with zero emojis and zero external font dependencies.
* 🔢 **Custom In-App Numeric Keypad**: Prevents keyboard flickering and layout jumps, with exact Indian digit grouping (`1,00,000.00`).
* 📱 **Alphabetical UPI App Picker**: Queries installed UPI apps using Android's `<queries>` package visibility, alphabetizes them, and remembers your last-used app for instant handoff.
* 📜 **Offline History Ledger**: Expandable transaction history saved locally in Android's secure `SharedPreferences`, tracking per-installment UTRs, approval references, and UPI apps.
* ℹ️ **Dedicated About & Info Screen**: In-depth guidance explaining the MDR rules, NPCI guidelines, and app mission.
* 🧾 **Masked Gallery Receipts**: Export proof-of-payment image receipts directly to your device gallery with privacy-preserving VPA masking.
* 🚀 **Automated GitHub Update Notifications**: Detects newer versions on GitHub and alerts you with release notes and one-tap download.

---

## 🧠 The Split Algorithm

The core domain logic is implemented as a pure, dependency-free TypeScript module in [`src/domain/split.ts`](src/domain/split.ts).

### Mathematical Rules & Invariants
* **Integer Paise Only**: All money is computed as integer paise (`1 Rupee = 100 paise`). Floats are never used for currency math.
* **Cap per Leg**: Exactly `199,900 paise` (₹1,999.00).
* **Minimum Leg**: `100 paise` (₹1.00, the UPI protocol floor).
* **Maximum Installments**: Up to `20 legs` supported per banking daily guidelines.
* **Sub-Rupee Rebalancing**: If the remainder after splitting is less than ₹1.00 (e.g. ₹1,999.01 producing a 1 paise remainder), the remainder cannot be its own transaction. The algorithm merges it with the preceding leg and divides it evenly between the final two legs so neither exceeds ₹1,999.00.
* **Sum Invariant**: `sum(legs) === totalPaise` is strictly asserted before any plan is returned.

### Split Plan Examples

| Total Entered (₹) | Total Paise | Installment Breakdown |
| :--- | :--- | :--- |
| **₹1,999.00** | 199,900 | 1 leg of ₹1,999.00 |
| **₹1,999.01** | 199,901 | 2 legs: ₹999.51 + ₹999.50 (rebalanced) |
| **₹2,000.00** | 200,000 | 2 legs: ₹1,999.00 + ₹1.00 |
| **₹4,500.75** | 450,075 | 3 legs: ₹1,999.00, ₹1,999.00, ₹502.75 |
| **₹10,000.00** | 1,000,000 | 6 legs: 5 × ₹1,999.00 + ₹5.00 |
| **₹39,980.00** | 3,998,000 | 20 legs: 20 × ₹1,999.00 |

---

## 🔒 Security & Privacy Guarantees

1. **No Sensitive Financial Access**: The app does not process transactions. It launches Android's standard `Intent.ACTION_VIEW` targeting `upi://pay` URIs.
2. **No Backend Required**: 100% client-side execution. The app does not transmit your transaction details to any server.
3. **No Invasive Permissions**:
   * `CAMERA`: Used exclusively for the live viewfinder to scan QR codes locally.
   * `INTERNET`: Used only to check the public GitHub Releases API for app updates.
   * No `QUERY_ALL_PACKAGES`: Uses strict Android 11+ `<queries>` filtering for UPI schemes (`upi://pay`).
4. **VPA Masking**: Payee VPAs are masked throughout the user interface (e.g., `mer••••@upi`) and on generated receipt images.
5. **Session Immutability**: The payee VPA is locked on scan. If an in-memory modification is detected before intent launch, the session aborts immediately.

---

## 🏗️ Architecture & Project Structure

```
NoFeePe/
├── .github/
│   └── workflows/
│       └── release.yml          # GitHub Actions CI for automated APK release builds
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml # Camera, Internet & UPI package queries
│   │   │   ├── java/com/nasa/nofeepe/
│   │   │   │   ├── MainApplication.kt
│   │   │   │   └── upi/
│   │   │   │       ├── UpiIntentModule.kt  # Native UPI intent handoff & storage
│   │   │   │       └── UpiIntentPackage.kt # React Native native module bridge
│   │   │   └── res/            # Adaptive icons (mdpi to xxxhdpi), colors, launch assets
│   │   └── build.gradle
│   └── build.gradle
├── assets/
│   └── logo.png                # Official brand logo (double chevron in purple & cyan)
├── scripts/
│   └── build-release.ps1       # Script to build and package named APKs locally
├── src/
│   ├── components/             # Reusable bank-grade UI components
│   │   ├── AmountText.tsx      # Indian currency digit grouping formatter
│   │   ├── AppIcon.tsx         # Pure React Native geometric vector icons (zero emojis)
│   │   ├── BackButton.tsx      # Pure-vector chevron back button
│   │   ├── CustomModal.tsx     # Unified dark glassmorphism modal system
│   │   ├── ErrorBoundary.tsx   # Top-level crash boundary with recovery CTA
│   │   ├── GlassCard.tsx       # Translucent card container
│   │   ├── GradientButton.tsx  # Theme Purple solid action buttons with white text
│   │   ├── NumericKeypad.tsx   # Custom in-app numeric touch keypad
│   │   ├── ProgressBar.tsx     # Smooth animated progress indicators
│   │   ├── ScannerCamera.tsx   # Cross-platform camera wrapper
│   │   └── UpdateModal.tsx     # GitHub release notification dialog
│   ├── constants/
│   │   └── version.ts          # App version and GitHub repository constants
│   ├── domain/                 # Pure business logic (zero UI dependencies)
│   │   ├── split.ts            # Mathematical split algorithm & validation
│   │   └── upi.ts              # URI parser, sanitizer, and builder
│   ├── native/
│   │   └── upiIntent.ts        # TypeScript wrapper for Android UpiIntentModule
│   ├── screens/                # Application screens
│   │   ├── SplashScreen.tsx    # Branded animated splash screen with sweep gradient
│   │   ├── ScannerScreen.tsx   # Camera scanner, gallery picker, manual UPI entry
│   │   ├── AmountScreen.tsx    # Numeric keypad with live Indian currency grouping
│   │   ├── MethodScreen.tsx    # Direct Pay vs Split & Pay selector
│   │   ├── PayScreen.tsx       # Installment progress tracker & UPI app picker sheet
│   │   ├── SuccessScreen.tsx   # Summary receipt & gallery image export
│   │   ├── HistoryScreen.tsx   # Expandable transaction history ledger
│   │   └── AboutScreen.tsx     # MDR guidelines, NPCI rules, and app info
│   ├── services/
│   │   └── updateChecker.ts    # GitHub Releases API client & semver comparator
│   ├── store/
│   │   ├── sessionStore.ts     # In-memory Zustand store for active payment session
│   │   └── historyStore.ts     # Persistent Zustand store backed by native storage
│   ├── theme/
│   │   ├── tokens.ts           # Color palette, spacing, radii, typography, light purple text
│   │   └── index.ts
│   └── types/
│       └── index.ts            # TypeScript interfaces and navigation params
├── __tests__/                  # Comprehensive Jest test suite (39 passing tests)
│   ├── AboutScreen.test.tsx    # Info screen rendering tests
│   ├── App.test.tsx            # Navigation smoke tests
│   ├── historyStore.test.ts    # Persistence hydration tests
│   ├── keypad.test.ts          # Touch keypad input and decimal tests
│   ├── sessionStore.test.ts    # State machine and transition tests
│   ├── split.test.ts           # Algorithm tests (including 5,000 property iterations)
│   ├── updateChecker.test.ts   # Semver comparison and update logic tests
│   └── upi.test.ts             # URI parsing, sanitization, and security tests
├── App.tsx                     # Root navigation stack configuration
├── package.json
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native 0.76+](https://reactnative.dev) (Bare CLI, New Architecture Fabric) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (Strict mode, zero `any`) |
| **Camera & QR** | [react-native-vision-camera](https://react-native-vision-camera.com) |
| **Animation** | [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) (In-memory session + native persistence) |
| **Navigation** | [@react-navigation/native-stack](https://reactnavigation.org) |
| **Native Bridge** | Kotlin Android Module (`UpiIntentModule.kt`) with Android Intent & SharedPreferences |
| **Icons** | Custom Pure Vector Primitives (`AppIcon.tsx`) |
| **Styling** | Vanilla React Native StyleSheet + [react-native-linear-gradient](https://github.com/react-native-linear-gradient/react-native-linear-gradient) |
| **Testing** | [Jest](https://jestjs.io) (8 suites, 39 tests) |

---

## 💻 Building from Source

### Prerequisites
* **Node.js**: 20.x or later
* **Java Development Kit**: JDK 17 (Eclipse Temurin recommended)
* **Android SDK**: API Level 34+ with Android Build Tools
* **Physical Device or Emulator**: Android 11+ with at least one UPI app installed for real payment testing.

### 1. Clone the Repository
```sh
git clone https://github.com/mayanknasa/NoFeePe.git
cd NoFeePe
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Run Tests
```sh
npm test
```

### 4. Run on Connected Android Device
Ensure USB or wireless debugging is enabled via `adb devices`:
```sh
npm run android
```

### 5. Build Release APK
To compile an installable release APK named `NoFeePe_v1.0.0.apk`:
```sh
npm run build:release
```
The output APK will be saved to `release/NoFeePe_v1.0.0.apk`.

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve NoFeePe:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Ensure all tests pass (`npm test`) and type check passes (`npx tsc --noEmit`).
4. Commit your changes (`git commit -m 'feat: add amazing feature'`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Made with ❤️ by [Mayank Nasa](https://github.com/mayanknasa)*
