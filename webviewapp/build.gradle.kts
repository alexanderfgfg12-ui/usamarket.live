plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    // Keep the Kotlin namespace unchanged; publish this WebView app under its own unique package ID.
    namespace = "com.usamarket.live"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.usamarket.mobile"
        minSdk = 24
        targetSdk = 35
        versionCode = 5
        versionName = "2.2.0"
    }
    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
}
