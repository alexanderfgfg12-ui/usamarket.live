# US Market Live — Native Android

This is the replacement native Android app (Kotlin + Jetpack Compose). The old Bubblewrap/TWA build workflow has been retired. Package ID: `com.usamarket.live`; version: `2.0.0` (versionCode `3`).

## Current first milestone
- Native Compose news feed
- Search by headline/description
- Category filters
- Native article detail view
- Reads the same published `news-data.json` used by the website

## Build
Open this repository in Android Studio (Hedgehog or newer), sync Gradle, then run the `:app` configuration.

The website remains unchanged. This first milestone uses the published JSON feed because the current site is static and does not expose a dedicated backend API. Authentication, server-side personalization, and other dynamic capabilities require API endpoints before they can be implemented natively.


## New release signing

The release workflow expects a newly generated upload/signing keystore stored as GitHub Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, and `ANDROID_KEY_ALIAS`. Do not commit the keystore or passwords. The new certificate differs from the previous TWA certificate, so users must uninstall the previous app before installing this replacement; Android will not accept it as an in-place update. The previous Google Play listing/release is not deleted automatically.
