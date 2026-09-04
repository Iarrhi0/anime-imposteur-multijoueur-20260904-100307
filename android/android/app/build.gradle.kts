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
        versionCode = 71
        versionName = "7.1"
        buildConfigField("String","GAME_URL","\"__GAME_URL__\"")
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
}
