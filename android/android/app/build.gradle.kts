val agoraAppId = System.getenv("AGORA_APP_ID") ?: ""

plugins {
    id("com.android.application")
}
android {
    namespace = "com.animeimposteur.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.animeimposteur.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 861
        versionName = "8.6.1"
        buildConfigField("String","GAME_URL","\"https://iarrhi0.github.io/anime-imposteur-multijoueur-20260904-100307/\"")
        buildConfigField("String","AGORA_APP_ID","\"$agoraAppId\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity:1.10.0")
    implementation("io.agora.rtc:voice-sdk:4.6.4")
}
