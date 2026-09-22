package com.nasa.nofeepe.upi

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.*
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.io.ByteArrayOutputStream
import java.io.File

class UpiIntentModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx), ActivityEventListener {

  private var pending: Promise? = null
  private val REQ = 0x5550

  init { ctx.addActivityEventListener(this) }
  override fun getName() = "UpiIntent"

  private fun drawableToBitmap(drawable: Drawable): Bitmap {
    if (drawable is BitmapDrawable && drawable.bitmap != null) {
      return drawable.bitmap
    }
    val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 96
    val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 96
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)
    return bitmap
  }

  private fun bitmapToBase64(bitmap: Bitmap): String {
    val baos = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
    val bytes = baos.toByteArray()
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
  }

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

      // Extract real installed app icon directly from system PackageManager
      try {
        val iconDrawable = ri.loadIcon(pm)
        val bitmap = drawableToBitmap(iconDrawable)
        val base64 = bitmapToBase64(bitmap)
        m.putString("iconBase64", "data:image/png;base64,$base64")
      } catch (_: Exception) {
        // Fallback to default icon handling in JS
      }

      out.pushMap(m)
    }
    promise.resolve(out)
  }

  @ReactMethod
  fun pay(uri: String, packageName: String, promise: Promise) {
    val activity = ctx.currentActivity
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

  @ReactMethod
  fun scanQr(uriString: String, promise: Promise) {
    try {
      val imageUri = if (uriString.startsWith("content://") || uriString.startsWith("file://")) {
        Uri.parse(uriString)
      } else {
        Uri.fromFile(File(uriString))
      }
      val inputImage = InputImage.fromFilePath(ctx, imageUri)
      val options = BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()
      val scanner = BarcodeScanning.getClient(options)
      scanner.process(inputImage)
        .addOnSuccessListener { barcodes ->
          for (barcode in barcodes) {
            val raw = barcode.rawValue
            if (!raw.isNullOrEmpty()) {
              promise.resolve(raw)
              return@addOnSuccessListener
            }
          }
          promise.reject("NO_QR", "No QR code found in that image.")
        }
        .addOnFailureListener { e ->
          promise.reject("SCAN_FAILED", e.message ?: "Failed to scan image")
        }
    } catch (e: Exception) {
      promise.reject("SCAN_ERROR", e.message ?: "Unable to read image file")
    }
  }

  @ReactMethod
  fun saveReceipt(details: ReadableMap, promise: Promise) {
    try {
      val title = if (details.hasKey("title")) details.getString("title") ?: "Payment Receipt" else "Payment Receipt"
      val amount = if (details.hasKey("amount")) details.getString("amount") ?: "₹0.00" else "₹0.00"
      val payeeName = if (details.hasKey("payeeName")) details.getString("payeeName") ?: "Merchant" else "Merchant"
      val payeeVpa = if (details.hasKey("payeeVpa")) details.getString("payeeVpa") ?: "" else ""
      val date = if (details.hasKey("date")) details.getString("date") ?: "" else ""
      val txnRef = if (details.hasKey("txnRef")) details.getString("txnRef") ?: "" else ""
      val status = if (details.hasKey("status")) details.getString("status") ?: "SUCCESS" else "SUCCESS"

      val width = 800
      val height = 1100
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)

      // Dark background
      val bgPaint = Paint().apply { color = Color.parseColor("#0B0B12") }
      canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

      // Glass Card surface
      val cardPaint = Paint().apply {
        color = Color.parseColor("#141420")
        isAntiAlias = true
      }
      val cardRect = RectF(40f, 40f, (width - 40).toFloat(), (height - 40).toFloat())
      canvas.drawRoundRect(cardRect, 32f, 32f, cardPaint)

      // Card border
      val borderPaint = Paint().apply {
        color = Color.parseColor("#2A2A3C")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
      }
      canvas.drawRoundRect(cardRect, 32f, 32f, borderPaint)

      val titlePaint = Paint().apply {
        color = Color.WHITE
        textSize = 42f
        typeface = Typeface.DEFAULT_BOLD
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
      }

      val subPaint = Paint().apply {
        color = Color.parseColor("#8A8FA3")
        textSize = 24f
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
      }

      val amountPaint = Paint().apply {
        color = Color.parseColor("#2BD9A0")
        textSize = 64f
        typeface = Typeface.DEFAULT_BOLD
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
      }

      val labelPaint = Paint().apply {
        color = Color.parseColor("#8A8FA3")
        textSize = 26f
        isAntiAlias = true
        textAlign = Paint.Align.LEFT
      }

      val valPaint = Paint().apply {
        color = Color.WHITE
        textSize = 26f
        typeface = Typeface.DEFAULT_BOLD
        isAntiAlias = true
        textAlign = Paint.Align.RIGHT
      }

      val linePaint = Paint().apply {
        color = Color.parseColor("#222234")
        strokeWidth = 2f
      }

      canvas.drawText("noFeePe", (width / 2).toFloat(), 120f, titlePaint)
      canvas.drawText("Zero MDR UPI Split & Pay", (width / 2).toFloat(), 165f, subPaint)

      canvas.drawLine(80f, 210f, (width - 80).toFloat(), 210f, linePaint)

      canvas.drawText(title, (width / 2).toFloat(), 270f, subPaint)
      canvas.drawText(amount, (width / 2).toFloat(), 350f, amountPaint)

      val statusColor = if (status == "SUCCESS") "#2BD9A0" else "#FFB020"
      val statusPaint = Paint().apply {
        color = Color.parseColor(statusColor)
        textSize = 28f
        typeface = Typeface.DEFAULT_BOLD
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
      }
      canvas.drawText("Status: $status", (width / 2).toFloat(), 410f, statusPaint)

      canvas.drawLine(80f, 460f, (width - 80).toFloat(), 460f, linePaint)

      var curY = 530f
      fun drawRow(label: String, value: String) {
        canvas.drawText(label, 80f, curY, labelPaint)
        canvas.drawText(value, (width - 80).toFloat(), curY, valPaint)
        curY += 65f
      }

      drawRow("Payee", payeeName)
      drawRow("UPI ID", payeeVpa)
      drawRow("Date & Time", date)
      if (txnRef.isNotEmpty()) {
        drawRow("Ref Number", txnRef)
      }

      canvas.drawLine(80f, curY + 20f, (width - 80).toFloat(), curY + 20f, linePaint)
      curY += 80f

      val footerPaint = Paint().apply {
        color = Color.parseColor("#5A5F73")
        textSize = 20f
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
      }
      canvas.drawText("Developed by Mayank Nasa • Zero Processing Fee", (width / 2).toFloat(), curY, footerPaint)
      canvas.drawText("Official Receipt stored on device", (width / 2).toFloat(), curY + 35f, footerPaint)

      val filename = "noFeePe_Receipt_${System.currentTimeMillis()}.png"
      val contentValues = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
        put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/noFeePe")
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
      }

      val resolver = ctx.contentResolver
      val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
        ?: return promise.reject("SAVE_FAILED", "Failed to create media store record")

      resolver.openOutputStream(uri)?.use { os ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        contentValues.clear()
        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, contentValues, null, null)
      }

      promise.resolve(uri.toString())
    } catch (e: Exception) {
      promise.reject("SAVE_ERROR", e.message ?: "Failed to save receipt")
    }
  }

  @ReactMethod
  fun saveHistoryJson(json: String, promise: Promise) {
    try {
      val prefs = ctx.getSharedPreferences("nofeepe_history", android.content.Context.MODE_PRIVATE)
      prefs.edit().putString("records_json", json).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SAVE_HISTORY_FAILED", e.message)
    }
  }

  @ReactMethod
  fun getHistoryJson(promise: Promise) {
    try {
      val prefs = ctx.getSharedPreferences("nofeepe_history", android.content.Context.MODE_PRIVATE)
      val json = prefs.getString("records_json", "[]") ?: "[]"
      promise.resolve(json)
    } catch (e: Exception) {
      promise.reject("GET_HISTORY_FAILED", e.message)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQ) return
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
      resultCode == Activity.RESULT_CANCELED && raw.isEmpty() -> "CANCELLED"
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

  override fun onNewIntent(intent: Intent) {}
}
