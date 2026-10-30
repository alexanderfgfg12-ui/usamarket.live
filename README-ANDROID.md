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

## Release signing

The GitHub Actions release workflow reuses the repository's existing secrets:
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_PASSWORD`
- `KEY_ALIAS`

Do not commit the keystore or passwords. The app keeps the existing application ID so it can be upgraded in place only if this key matches the certificate expected by the installed app. If Google Play App Signing is enabled, verify the Play app-signing certificate separately; the repository key may be an upload key rather than the app-signing key. The Google Play listing and published releases are managed separately and are not deleted or replaced by repository changes.
