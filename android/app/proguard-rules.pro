# ProGuard rules for Android Journal Application
-keepclassmembers class * {
    @androidx.room.* *;
}
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**
