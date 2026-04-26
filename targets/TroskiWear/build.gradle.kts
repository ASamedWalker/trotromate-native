plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.troski.wear"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.troski.wear"
        minSdk = 30  // Wear OS 3.0+
        targetSdk = 34
        versionCode = 3
        versionName = "1.1.3"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true // for java.time on API 30
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Core library desugaring for java.time on API < 34
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")

    // Compose for Wear OS
    implementation("androidx.wear.compose:compose-foundation:1.4.0")
    implementation("androidx.wear.compose:compose-material:1.4.0")
    implementation("androidx.wear.compose:compose-navigation:1.4.0")

    // Horologist — Google's Wear helper library for better layouts
    implementation("com.google.android.horologist:horologist-compose-layout:0.6.17")

    // Activity Compose
    implementation("androidx.activity:activity-compose:1.9.3")

    // Wear Tiles
    implementation("androidx.wear.tiles:tiles:1.4.0")
    implementation("androidx.wear.protolayout:protolayout:1.2.1")
    implementation("androidx.wear.protolayout:protolayout-material:1.2.1")
    implementation("androidx.wear.protolayout:protolayout-expression:1.2.1")

    // Google Play Services Wearable (DataClient + MessageClient)
    implementation("com.google.android.gms:play-services-wearable:18.2.0")

    // Guava for ListenableFuture (required by TileService)
    implementation("com.google.guava:guava:33.3.1-android")

    // Kotlin coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")
}
