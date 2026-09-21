# noFeePe — Build Specification

This is the single source of truth for this repository. Read it fully before
writing any code. If something is not specified here, ask before inventing it.

---

## 1. What the app is

noFeePe is an Android-first React Native app. The user scans a UPI QR code,
enters an amount, and pays it either in one transaction or as a series of
instalments capped at Rs 1999 each.

The instalment feature ("Split & Pay") is the headline feature of the product.
Everything else exists to serve it.

The app does not process payments itself. It builds a UPI deep link and hands
off to whichever UPI app the user has installed. It never sees a PIN, a bank
account, a card, or an OTP.

App name: **noFeePe**
Package / applicationId: **com.nasa.nofeepe**
Splash credit line: **Developed by Mayank Nasa**

---

## 2. Hard constraints (do not violate these)

1. **Keep it small.** This is a 6 screen app. Do not add a state library beyond
   Zustand, do not add a navigation library beyond React Navigation native
   stack, do not add an animation library beyond Reanimated, do not add a
   backend, do not add analytics, do not add a UI kit.
2. **No persistence in v1.** All state is in memory. If the app is killed mid
   split, the session is gone and the user starts over. This is acceptable and
   intentional. Do not add MMKV, AsyncStorage, SQLite, or Keychain.
3. **No encryption layer.** The app holds no secrets. Do not add crypto
   libraries, HMAC signing, or key management. Security here means input
   validation and screen flags, nothing more.
4. **All money is integer paise.** Never store or compute money as a float.
   Convert to paise at the input boundary, convert back to rupees only for
   display. Display always uses exactly two decimal places.
5. **Strict TypeScript.** No `any`. No silent `catch {}`. Every failure path
   has a typed error and a visible UI state.
6. **Android is the real product.** iOS gets a degraded flow (see section 10).

---

## 3. Approved dependency list

Runtime dependencies. Do not add to this list without asking.

```
react-native                      0.76+ bare CLI, TypeScript
react-native-vision-camera        QR scanning
react-native-reanimated           animation
zustand                           state
@react-navigation/native
@react-navigation/native-stack
react-native-screens
react-native-safe-area-context
react-native-linear-gradient      accent gradients, splash
react-native-image-picker         "pick QR from gallery"
react-native-haptic-feedback
```

Dev dependencies: typescript, jest, @types/*, eslint, prettier. Nothing else.

QR decoding from a gallery image: use vision-camera's static image scanning API
if available in the installed version. If it is not, add
`@react-native-ml-kit/barcode-scanning` and nothing else. Do not pull in a
second camera library.

---

## 4. Screens

Six routes. Exact names, use these.

| Route | Purpose |
|---|---|
| `Splash` | Brand moment, 1.8s, then replace with Scanner |
| `Scanner` | Camera QR scan plus "pick from gallery" |
| `Amount` | Numeric entry, shows payee |
| `Method` | Pay Direct vs Split & Pay |
| `Pay` | App picker plus payment progress, single screen |
| `Success` | Final summary, receipt |

There is no separate app picker screen. The UPI app list is a bottom sheet
inside `Pay`, because the user must pick an app again on every leg if they want
to, and pushing a route each time would wreck the back stack.

### 4.1 Splash
Black canvas. Logo mark centered with an animated gradient sweep. At the bottom,
12px, letterSpacing 1.2, colour `#5A5F73`: `Developed by Mayank Nasa`.
Maximum 1.8 seconds, then `navigation.replace('Scanner')`. No splash on
subsequent navigations back.

### 4.2 Scanner
* Full bleed camera preview, vision-camera, QR format only.
* Custom overlay: dimmed surround with a clear square cutout, four animated
  corner brackets, a vertical sweep line looping over 2s.
* Torch toggle, top right.
* "Pick from gallery" pill, bottom center. Opens image picker, decodes the QR
  from the chosen image.
* Camera permission: show an in-app rationale sheet explaining why the camera is
  needed **before** triggering the OS dialog. If permanently denied, show an
  "Open settings" button that deep links to app settings.
* On a decoded string that is not a UPI URI: haptic error, shake the cutout,
  show an inline toast reading "Not a UPI QR code". Do not navigate.
* On a valid UPI URI: haptic success, navigate to `Amount` with the parsed payee.
* Pause the camera when the screen loses focus. This matters a lot for battery
  and heat.

### 4.3 Amount
* Glass card at the top showing payee name and masked VPA
  (first 3 characters, then `••••`, then `@handle`).
* Large amount display, right aligned, Indian digit grouping
  (`1,00,000.00` not `100,000.00`), always exactly two decimal places once the
  user has typed a decimal point, otherwise show the rupee part with `.00`
  appended in a muted colour.
* Custom in-app numeric keypad: digits 0 to 9, a decimal point, and backspace.
  Do not use the system keyboard.
* Decimal rules: at most one decimal point, at most two digits after it. Further
  keypresses after two decimals are ignored silently.
* Leading zero handling: typing `0` then `5` produces `5`, not `05`.
* If the scanned QR carried a fixed amount (`am=`), lock the field, show the
  amount read only with a "Fixed by merchant" pill, and skip straight past the
  split option later.
* Continue button disabled until amount is at least Rs 1.00.

### 4.4 Method
Two glass cards stacked.

* **Pay Direct.** Always enabled. One transaction for the full amount.
* **Split & Pay.** Enabled only when amount is strictly greater than Rs 1999.00
  **and** the QR did not carry a fixed amount. When disabled, show the reason in
  muted text under the card title, for example "Available for bills above
  Rs 1,999" or "This QR has a fixed amount set by the merchant". Never grey a
  card out with no explanation.
* When Split & Pay is available, show a preview line inside its card:
  "6 payments: 5 x Rs 1,999.00 + Rs 5.00" computed live from the entered amount.
* Below the cards, a collapsible chip: "What is Split & Pay?" expanding to two
  plain sentences explaining that the app will send several separate payments to
  the same UPI ID, one after another, and the user must approve each one.

### 4.5 Pay
This screen handles both modes. For Pay Direct it simply has a single leg.

Layout, top to bottom:

1. Payee card, masked VPA.
2. **Progress block.**
   * A horizontal progress bar showing amount paid over total.
   * Text above it: `Rs 3,998.00 of Rs 10,000.00 paid`.
   * Text below it: `Rs 6,002.00 remaining`.
   * A second line: `2 of 6 payments done`.
   * Both bars animate with Reanimated, 300ms, no spring overshoot.
3. **Leg list.** One row per instalment: index, amount, status icon.
   Statuses and colours:
   * Pending (not attempted): muted grey dot
   * In progress: pulsing accent dot
   * Success: green tick, plus the UPI transaction ID and approval reference
     returned by the UPI app, in small monospace text under the row
   * Failed: red cross, with a "Retry" affordance on the row
   * Unknown / submitted: amber question mark, with "Did this go through?"
     Yes / No buttons on the row
4. **Primary action button.** Label is `Pay Rs 1,999.00` for the next pending
   leg. Tapping it opens the UPI app bottom sheet, then launches the chosen app.
5. Secondary actions: `Pause` and `Abandon`.

Behaviour rules:

* The button is disabled while a leg is in flight and during a 3 second cooldown
  after a leg completes. Show the cooldown as a countdown on the button
  (`Next payment in 3`). The cooldown avoids accidental double taps and reduces
  the chance a payment processor flags rapid repeat payments to one VPA.
* The chosen UPI app is remembered for the session and pinned to the top of the
  sheet, but the sheet still opens each time so the user can switch.
* Haptic success on each completed leg, heavy impact on the final one.
* When the final leg succeeds, navigate to `Success`.
* `Abandon` opens a confirm dialog making clear that already completed payments
  are final and cannot be reversed by the app. On confirm, navigate to `Success`
  in partial mode.

### 4.6 Success
* Large status glyph: green check for fully paid, amber for partially paid.
* Total paid, number of transactions, payee masked VPA, timestamp.
* Full list of successful transactions with their UPI transaction IDs and
  approval reference numbers.
* If partial: a clearly separated block showing what was not paid, with the
  remaining amount, and a note that the user can scan again to pay the rest.
* "Save receipt" button renders the card to an image. The receipt must mask the
  VPA the same way the UI does.
* "Done" returns to `Scanner` and clears all session state.

---

## 5. The split algorithm

This is the core of the product. Implement it exactly as written, in a pure
module with no React imports, and unit test it.

```ts
export const LEG_CAP_PAISE = 199_900;      // Rs 1999.00
export const MIN_LEG_PAISE = 100;          // Rs 1.00, UPI floor
export const MAX_LEGS = 20;
export const MAX_TOTAL_PAISE = 10_000_000; // Rs 1,00,000

export type SplitPlan = { legs: number[]; totalPaise: number; count: number };

export class SplitError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function planSplit(totalPaise: number): SplitPlan {
  if (!Number.isInteger(totalPaise)) {
    throw new SplitError('NOT_INTEGER', 'Amount must be integer paise');
  }
  if (totalPaise < MIN_LEG_PAISE) {
    throw new SplitError('TOO_SMALL', 'Minimum payable amount is Rs 1');
  }
  if (totalPaise > MAX_TOTAL_PAISE) {
    throw new SplitError('TOO_LARGE', 'Maximum supported amount is Rs 1,00,000');
  }

  if (totalPaise <= LEG_CAP_PAISE) {
    return { legs: [totalPaise], totalPaise, count: 1 };
  }

  const fullLegs = Math.floor(totalPaise / LEG_CAP_PAISE);
  const remainder = totalPaise - fullLegs * LEG_CAP_PAISE;
  const legs: number[] = new Array(fullLegs).fill(LEG_CAP_PAISE);

  if (remainder === 0) {
    // exact multiple of 1999, nothing to append
  } else if (remainder < MIN_LEG_PAISE) {
    // remainder is under Rs 1 and cannot be its own UPI transaction.
    // Merge it into the last full leg and rebalance the final two legs so
    // neither exceeds the cap.
    const merged = legs.pop()! + remainder;
    const a = Math.floor(merged / 2);
    legs.push(a, merged - a);
  } else {
    legs.push(remainder);
  }

  if (legs.length > MAX_LEGS) {
    throw new SplitError(
      'TOO_MANY_LEGS',
      `This needs ${legs.length} payments. Most banks cap UPI at around 20 per day.`
    );
  }

  const sum = legs.reduce((a, b) => a + b, 0);
  if (sum !== totalPaise) throw new SplitError('INVARIANT', 'Split does not sum to total');

  return { legs, totalPaise, count: legs.length };
}
```

Required test cases, all must pass:

| Input (Rs) | Expected |
|---|---|
| 1999.00 | 1 leg of 1999.00 |
| 1999.01 | 2 legs: 1999.00 + 0.01 merges, rebalances to 999.51 + 999.50 |
| 2000.00 | 2 legs: 1999.00 + 1.00 |
| 10000.00 | 6 legs: 5 x 1999.00 + 5.00 |
| 4500.75 | 3 legs: 1999.00, 1999.00, 502.75 |
| 3998.00 | 2 legs of 1999.00, no remainder leg |
| 39980.00 | 20 legs, allowed |
| 41979.00 | throws TOO_MANY_LEGS |
| 100001.00 | throws TOO_LARGE |
| 0.50 | throws TOO_SMALL |

Plus a property test: for 5000 random amounts between 100 and 10,000,000 paise,
the plan always sums exactly to the input and no leg exceeds 199,900 paise.

---

## 6. UPI URI handling

### 6.1 Parsing a scanned QR

```ts
const VPA = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
const DANGEROUS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
```

Rules:
* Must start with `upi://pay?` (case insensitive). Anything else is rejected.
* Parse query params manually. **First occurrence of a key wins**, later
  duplicates are discarded. This blocks parameter smuggling where a malicious QR
  includes `pa` twice hoping the display and the payment read different values.
* `pa` is mandatory and must match the VPA regex.
* `pn` (payee name) and `tn` (note) are sanitised: strip the DANGEROUS character
  class, which removes control characters and right-to-left override characters
  used for display spoofing. Clamp `pn` to 40 characters, `tn` to 50.
* `am` if present is the fixed amount. Parse only `^\d{1,7}(\.\d{1,2})?$`.
* `mc` (merchant category code) if present must be 4 digits, keep it and forward
  it on payment.
* `sign` if present is preserved verbatim **only** for Pay Direct when the
  amount is unchanged. Never forward `sign` on a split leg, because the signed
  payload no longer matches the amount being sent. If a QR has both `sign` and
  a fixed `am`, disable Split & Pay entirely.
* Any parameter not explicitly listed above is dropped and never forwarded.

### 6.2 Building a payment URI

```
upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tr=<ref>&tn=<note>&mc=<mcc>
```

* `am` is always formatted to exactly two decimal places.
* `tr` is a fresh unique reference for every single launch attempt, including
  retries of the same leg. Format: `NFP` plus a 32 character uppercase random
  hex string, truncated to 35 characters total. Never reuse a `tr`.
* `cu` is always `INR`.
* The payee VPA is captured once at scan time and is immutable for the whole
  session. Assert it matches the original value immediately before every intent
  launch. If it has changed, abort the session with a tampering error.

---

## 7. Android native module

Create a Kotlin module named `UpiIntent` with two methods.

```kotlin
package com.nasa.nofeepe.upi

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.*

class UpiIntentModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx), ActivityEventListener {

  private var pending: Promise? = null
  private val REQ = 0x5550

  init { ctx.addActivityEventListener(this) }
  override fun getName() = "UpiIntent"

  @ReactMethod
  fun listUpiApps(promise: Promise) {
    val pm = ctx.packageManager
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"))
    val out = Arguments.createArray()
    val seen = HashSet<String>()
    for (ri in pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)) {
      val pkg = ri.activityInfo.packageName
      if (!seen.add(pkg)) continue
      val m = Arguments.createMap()
      m.putString("packageName", pkg)
      m.putString("label", ri.loadLabel(pm).toString())
      out.pushMap(m)
    }
    promise.resolve(out)
  }

  @ReactMethod
  fun pay(uri: String, packageName: String, promise: Promise) {
    val activity = currentActivity
      ?: return promise.reject("NO_ACTIVITY", "No foreground activity")
    if (pending != null) return promise.reject("IN_FLIGHT", "A payment is already open")
    if (!uri.startsWith("upi://pay?")) return promise.reject("BAD_URI", "Refusing non UPI uri")

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
    }
    if (intent.resolveActivity(ctx.packageManager) == null) {
      return promise.reject("APP_MISSING", "That UPI app is no longer available")
    }
    pending = promise
    try { activity.startActivityForResult(intent, REQ) }
    catch (e: Exception) { pending = null; promise.reject("LAUNCH_FAILED", e.message) }
  }

  override fun onActivityResult(a: Activity?, req: Int, res: Int, data: Intent?) {
    if (req != REQ) return
    val p = pending ?: return
    pending = null

    val raw = data?.getStringExtra("response") ?: data?.dataString ?: ""
    val fields = raw.split("&").mapNotNull {
      val i = it.indexOf('=')
      if (i < 1) null else it.substring(0, i).lowercase() to it.substring(i + 1)
    }.toMap()

    val status = (fields["status"] ?: "").uppercase()
    val code = fields["responsecode"] ?: ""

    val normalized = when {
      status.contains("SUCCESS") || code == "00" -> "SUCCESS"
      status.contains("SUBMITTED") || status.contains("PENDING") -> "PENDING"
      status.contains("FAIL") -> "FAILURE"
      res == Activity.RESULT_CANCELED && raw.isEmpty() -> "CANCELLED"
      raw.isEmpty() -> "UNKNOWN"
      else -> "FAILURE"
    }

    val map = Arguments.createMap()
    map.putString("status", normalized)
    map.putString("txnId", fields["txnid"] ?: "")
    map.putString("txnRef", fields["txnref"] ?: "")
    map.putString("approvalRef", fields["approvalrefno"] ?: "")
    map.putString("raw", raw)
    p.resolve(map)
  }

  override fun onNewIntent(intent: Intent?) {}
}
```

Register it via a `UpiIntentPackage` added to `getPackages()` in
`MainApplication.kt`.

### 7.1 Manifest

```xml
<uses-permission android:name="android.permission.CAMERA" />

<!-- Android 11+ package visibility. -->
<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" android:host="pay" />
    </intent>
</queries>
```

**Never add `QUERY_ALL_PACKAGES`.** It requires a Play Store policy declaration,
is almost always rejected for an app like this, and is the fastest way to get
flagged as spyware. The `<queries>` block above is the correct and sufficient
mechanism.

Do not request `INTERNET` unless something actually needs it. This app does not.
An offline payment app with no internet permission is a genuine trust signal.

### 7.2 UPI app display registry

The native `listUpiApps()` result is the source of truth. Use this map only to
prettify names and brand colours. Packages not in this map must still be shown,
using the system-provided label.

```ts
export const KNOWN_UPI_APPS: Record<string, { name: string; brand: string }> = {
  'com.phonepe.app':                       { name: 'PhonePe',       brand: '#5F259F' },
  'com.google.android.apps.nbu.paisa.user':{ name: 'Google Pay',    brand: '#1A73E8' },
  'net.one97.paytm':                       { name: 'Paytm',         brand: '#00BAF2' },
  'in.amazon.mShop.android.shopping':      { name: 'Amazon Pay',    brand: '#FF9900' },
  'com.whatsapp':                          { name: 'WhatsApp Pay',  brand: '#25D366' },
  'com.tatadigital.tcp':                   { name: 'Tata Neu',      brand: '#5A2D82' },
  'com.bajajfinservmarkets.app':           { name: 'Bajaj Finserv', brand: '#0B4DA2' },
  'com.dreamplug.androidapp':              { name: 'CRED',          brand: '#141414' },
  'com.naviapp':                           { name: 'Navi',          brand: '#2F6BFF' },
  'com.nextbillion.groww':                 { name: 'Groww Pay',     brand: '#00D09C' },
  'com.mobikwik_new':                      { name: 'MobiKwik',      brand: '#00509D' },
  'in.slice.android':                      { name: 'Slice',         brand: '#6A4DFF' },
  'money.super.payments':                  { name: 'Super.money',   brand: '#00C853' },
  'club.popclub.android':                  { name: 'PopClub',       brand: '#FF3D71' },
  'in.org.npci.upiapp':                    { name: 'BHIM',          brand: '#F7941D' },
  'com.csam.icici.bank.imobile':           { name: 'iMobile Pay',   brand: '#AE275F' },
  'com.hdfcbank.payzapp':                  { name: 'PayZapp',       brand: '#004C8F' },
};
```

---

## 8. State model

One Zustand store. In memory only.

```ts
type LegStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'unknown';

type Leg = {
  index: number;
  amountPaise: number;
  status: LegStatus;
  attempts: number;
  txnId?: string;
  approvalRef?: string;
  completedAt?: number;
};

type Session = {
  payeeVpa: string;          // immutable once set
  payeeName: string | null;
  merchantCode: string | null;
  totalPaise: number;
  mode: 'direct' | 'split';
  legs: Leg[];
  lastUsedPackage: string | null;
  inFlight: boolean;
  cooldownUntil: number | null;
};
```

Derived selectors, never stored:
* `paidPaise` = sum of amounts of legs with status `success`
* `remainingPaise` = `totalPaise - paidPaise`
* `doneCount` / `totalCount`
* `nextPendingLeg` = first leg whose status is `pending` or `failed`

`inFlight` is the double-tap guard. It lives in the store, not in component
state, so it survives re-renders and cannot be bypassed by a fast double tap.

---

## 9. Edge cases

Every one of these needs a dedicated, visible UI state. Do not collapse them
into a generic error toast.

### Scanning
1. Decoded string is not a UPI URI. Inline error, stay on Scanner.
2. UPI URI missing `pa`. "This QR is missing a UPI ID."
3. `pa` fails the VPA regex. "This QR has an invalid UPI ID."
4. QR carries `am=`. Lock the amount, disable Split & Pay.
5. QR carries `sign` plus fixed `am`. Disable Split & Pay, Pay Direct only.
6. QR has duplicate `pa` keys. First wins, later ones discarded.
7. `pn` contains RTL override characters. Stripped before display.
8. Gallery image contains no QR. "No QR code found in that image."
9. Gallery image contains several QRs. Use the first UPI one found, ignore the rest.
10. Camera permission denied once. Show rationale, allow retry.
11. Camera permission permanently denied. Show "Open settings".
12. Camera hardware unavailable or in use by another app. Fall back to gallery
    pick with an explanatory message.

### Amount entry
13. Amount is zero or below Rs 1.00. Continue stays disabled.
14. Amount above Rs 1,00,000. Inline error, Continue disabled.
15. More than two decimal digits typed. Extra keypresses ignored silently.
16. Multiple decimal points typed. Second and later ones ignored.
17. Amount typed is exactly 1999.00. Split & Pay stays disabled, with reason shown.
18. Amount produces more than 20 legs. Split & Pay disabled, reason shown.
19. Remainder under Rs 1.00 (for example 1999.01). Rebalance per the algorithm.

### App selection
20. Zero UPI apps resolvable. Empty state: "No UPI app found on this device",
    with a link to the Play Store search for UPI apps.
21. The chosen app is uninstalled between listing and launch.
    `ActivityNotFoundException` is caught, the leg stays pending, the list refreshes.
22. Two installed apps share a display label. Disambiguate by showing the package
    name in small muted text.
23. Only one UPI app installed. Still show the sheet, do not auto-launch. The
    user must make a deliberate choice before money moves.

### Payment result handling
24. `SUCCESS`. Mark leg success, store `txnId` and `approvalRef`, start cooldown.
25. `FAILURE`. Mark leg failed, offer Retry. Retry generates a **new** `tr`.
26. `PENDING` / `SUBMITTED`. **This is the most dangerous case.** Never count it
    as paid and never auto-advance. Show an amber leg with "Check your UPI app,
    then tell us" and explicit Yes / No buttons. Getting this wrong makes users
    pay twice.
27. `CANCELLED` with no data. User backed out. Leg stays pending, no penalty,
    no cooldown.
28. `RESULT_OK` but the response string is empty or unparseable. Treat as
    `UNKNOWN`, same handling as case 26.
29. A second `pay()` call while one is in flight. Rejected with `IN_FLIGHT`.
30. Double tap on the pay button. Blocked by the `inFlight` flag in the store.
31. Device runs out of battery or the OS kills the app mid split. State is lost.
    On next launch the app starts fresh at Scanner. Acceptable in v1.
32. User taps Abandon after some legs succeeded. Confirm dialog stating clearly
    that completed payments are final, then Success screen in partial mode.
33. Bank daily transaction limit hit mid split. Surfaces as a `FAILURE` from the
    UPI app. Show the retry option plus a hint that a daily limit may have been
    reached.
34. Payee VPA differs from the session VPA at launch time. Abort the entire
    session immediately with a security error. This should be impossible, which
    is exactly why it must be asserted.

### Display
35. Merchant name longer than the card. Clamp to two lines with an ellipsis.
36. Amount long enough to overflow. Auto-shrink the font size, do not wrap.
37. System font scale set very large. Layout must not break; test at 1.3x.
38. Rapid navigation back from Pay to Amount mid split. Block the hardware back
    button while a split session has completed legs, route it through the
    Abandon confirm dialog instead.

---

## 10. iOS behaviour

The NPCI UPI deep link specification returns transaction status through
`startActivityForResult`, which is an Android mechanism. iOS has no equivalent
callback, so an iOS build cannot reliably know whether a payment succeeded.

Therefore, on iOS:
* Use `Linking.canOpenURL` with the app-specific URL schemes to build the list.
* Launch with `Linking.openURL`.
* Always resolve the result as `UNKNOWN` and require the user to manually
  confirm each leg with Yes / No.
* Show a one-time explainer the first time an iOS user starts a split, stating
  that iOS cannot confirm payments automatically.

Do not fake a success state on iOS under any circumstances.

Info.plist entries:

```xml
<key>NSCameraUsageDescription</key>
<string>noFeePe uses the camera only to scan UPI QR codes. Nothing is recorded or uploaded.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>noFeePe reads a photo only to find a UPI QR code in it.</string>
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>upi</string><string>phonepe</string><string>tez</string><string>gpay</string>
  <string>paytmmp</string><string>amazonpay</string><string>credpay</string>
  <string>bhim</string><string>imobileapp</string><string>payzapp</string>
  <string>mobikwik</string><string>navi</string><string>slice</string><string>tataneu</string>
</array>
```

---

## 11. Security scope

This app has a deliberately small security surface. Do exactly this, no more.

1. Never collect, store, log or transmit a UPI PIN, bank credential, card number
   or OTP. There is no code path where the app could, and none should be added.
2. No network calls at all in v1. No `INTERNET` permission.
3. Set `FLAG_SECURE` on `Amount`, `Pay` and `Success` to block screenshots and
   screen recording by other apps during payment.
4. Set `filterTouchesWhenObscured={true}` on every payment-triggering button to
   defeat tap-jacking through overlay windows.
5. Validate every parsed QR through the rules in section 6.1. Treat every QR as
   hostile input.
6. Do not register any incoming deep link scheme. An app that can be opened by a
   URL with a prefilled payee and amount is a phishing vector. There is no reason
   to accept one here.
7. Never read the clipboard automatically.
8. Mask the VPA everywhere it is displayed and in the saved receipt image.
9. No logging of amounts, VPAs or transaction references in release builds.
   Strip `console.log` via `babel-plugin-transform-remove-console` in production.

---

## 12. Design system

```
Theme          Dark only. No light mode in v1.

Background     #07070B  base
               #0C0C14  elevated
Glass surface  rgba(255,255,255,0.055) fill
               rgba(255,255,255,0.10) 1px border
Accent         linear gradient 135deg, #7C5CFF to #22D3EE
Success        #2BD9A0
Pending        #FFB020
Danger         #FF5470
Text           #F5F6FA primary
               #9AA0B4 muted
               #5A5F73 faint

Radii          Card 28, button 20, pill 999, row 16
Spacing        4 / 8 / 12 / 16 / 24 / 32 / 48
Motion         Reanimated 3, 240ms, Easing.bezier(0.22, 1, 0.36, 1)
               Progress bars 300ms, no overshoot
Fonts          Headings and amounts: Clash Display, Semibold
               Body and labels: Satoshi, Regular and Medium
               Both from Fontshare, ship as .otf in assets/fonts
               Amount displays use tabular figures
```

Glass panels: do **not** add a blur library. Real blur on Android below API 31
is slow and janky, and it is almost certainly part of why the previous build felt
heavy. Achieve the glass look with a semi-transparent fill, a 1px light border, a
subtle inner top highlight, and a static gradient backdrop behind the content.
It reads as glass and costs nothing.

---

## 13. Google Stitch (MCP) usage

The Stitch MCP server is available for design work. Use it like this.

* Generate screen designs **before** writing the corresponding screen component,
  one screen at a time, in the order listed in section 4.
* Pass the design tokens from section 12 into every Stitch prompt so the six
  screens stay visually consistent. Do not let Stitch pick its own palette.
* Ask Stitch for mobile portrait, 390x844 logical points, dark theme.
* Treat Stitch output as a visual reference, not as code to paste. Extract
  spacing, hierarchy and composition from it, then hand-write the React Native
  component using the token constants. Generated layout code tends to hardcode
  values and fight the token system.
* Screens worth the most Stitch iteration, in order: `Pay` (the progress block is
  the hardest thing in the app to get right), `Amount` (keypad and numeral
  hierarchy), `Scanner` (overlay framing). `Splash`, `Method` and `Success` are
  simple enough to build directly.
* For the `Pay` screen specifically, ask Stitch for three variants of the
  progress block: a linear bar, a circular ring, and a segmented bar with one
  segment per instalment. The segmented variant usually communicates "6 separate
  payments" better than a continuous bar, which is worth evaluating visually.

---

## 14. Build order

Build and verify in this sequence. Do not move on until the current step runs.

1. **Scaffold.** `npx react-native init` with the TypeScript template. Confirm a
   blank app builds and installs on a real device before adding anything.
2. **Tokens and primitives.** `src/theme/tokens.ts`, then `GlassCard`,
   `GradientButton`, `ProgressBar`, `AmountText`. Render them on a throwaway
   screen and look at them on the device.
3. **Domain layer.** `planSplit`, `parseUpiUri`, `buildUpiUri`, plus the full
   test suite from section 5. This layer has zero React imports and must be
   green before any screen work.
4. **Native module.** `UpiIntent` Kotlin module plus the manifest `<queries>`
   block. Verify `listUpiApps()` returns the real list on a physical device with
   two or more UPI apps installed.
5. **Navigation shell.** Six routes with typed params, placeholder screens.
6. **Scanner** and **Amount**.
7. **Method** and the split preview.
8. **Pay.** The largest piece. Build the leg state machine first, drive it with a
   mock `pay()` that returns scripted results, and only then wire in the real
   native module.
9. **Success**.
10. **Edge case pass.** Walk section 9 top to bottom and verify each one.

Note on step 4: after any change to Kotlin code you must rebuild the native app
(`./gradlew assembleDebug` or `npx react-native run-android`). A Metro reload
will not pick it up.

---

## 15. Testing the split flow without spending money

* Build a `MockUpiIntent` implementation behind the same TypeScript interface,
  toggled by a dev-menu switch. It should be able to script any sequence of
  `SUCCESS`, `FAILURE`, `PENDING`, `CANCELLED` and `UNKNOWN` results so the whole
  leg state machine can be exercised without real payments.
* Test the real handoff with Rs 1.00 payments to your own UPI ID before ever
  testing a large split.
* A physical device is mandatory for real payment testing. Emulators have no
  bank binding and cannot complete a UPI transaction.

---

## 16. Things that are explicitly out of scope for v1

Do not build these, do not scaffold for them, do not add dependencies for them.

* Any backend, account system, or login
* Payment history persisted across app launches
* Scheduled or automatic payments
* Contacts, phone number, or SMS access
* Push notifications
* Light theme
* Tablet or landscape layouts
* Localisation beyond English
