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
