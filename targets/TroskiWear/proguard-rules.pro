# Troski Wear OS ProGuard Rules

# Keep Wear Tile service
-keep class com.troski.wear.tile.TroskiTileService { *; }

# Keep WearableListenerService
-keep class com.troski.wear.data.WearDataListenerService { *; }

# Keep data models for JSON parsing
-keep class com.troski.wear.data.** { *; }

# Google Play Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
