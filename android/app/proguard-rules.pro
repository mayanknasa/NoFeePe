# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add project specific keep options here:

# Keep our native module bridge
-keep class com.nasa.nofeepe.** { *; }

# React Native JNI & TurboModules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }

# Reanimated & Worklets
-keep class com.swmansion.reanimated.** { *; }

# VisionCamera & Nitro
-keep class com.mrousavy.camera.** { *; }
-keep class com.margelo.nitro.** { *; }

# Google ML Kit Barcode Scanning
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.tasks.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep annotations
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature,Exceptions
