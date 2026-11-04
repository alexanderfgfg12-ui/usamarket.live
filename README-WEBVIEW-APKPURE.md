# USA MARKET WebView Android app

A dedicated Android WebView build for https://usamarket.live.

- App name: USA MARKET
- Application ID / Package Name: com.usamarket.mobile
- Android namespace: com.usamarket.live (internal Kotlin resource namespace)
- Version: 2.2.0 (versionCode 5)
- Minimum Android: 7.0 (API 24)
- JavaScript and DOM storage enabled
- HTML5 video playback and third-party cookies enabled
- Same-site HTTPS navigation stays in the app; external links open in the browser
- Android back button navigates web history
- Branded launch/loading screen and network retry screen
- HTML file chooser support for website upload forms

GitHub Actions builds a debug APK for testing and, when signing secrets are configured, a signed release APK and Android App Bundle (AAB).

This WebView package is separate from the existing native-news app package. It uses its own application ID so APKPure can register it independently.

Release signing expects the workflow's configured Android signing environment variables. Never commit keystore files or credentials.
