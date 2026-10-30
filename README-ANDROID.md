# US Market Live — Native Android

This is a native Android (Kotlin + Jetpack Compose) client, separate from the existing website and its PWA/TWA wrapper.

## Current first milestone
- Native Compose news feed
- Search by headline/description
- Category filters
- Native article detail view
- Reads the same published `news-data.json` used by the website

## Build
Open this repository in Android Studio (Hedgehog or newer), sync Gradle, then run the `:app` configuration.

The website remains unchanged. This first milestone uses the published JSON feed because the current site is static and does not expose a dedicated backend API. Authentication, server-side personalization, and other dynamic capabilities require API endpoints before they can be implemented natively.
