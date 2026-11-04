# USA Market WebView Android app

A dedicated Android WebView build for https://usamarket.live.

- App label: USA Market
- Application ID: com.usamarket.live
- Version: 2.1.0 (versionCode 4)
- Minimum Android: 7.0 (API 24)
- JavaScript and DOM storage enabled
- HTML5 video playback and third-party cookies enabled
- Same-site HTTPS navigation stays in the app; external links open in the browser
- Android back button navigates web history
- Branded launch/loading screen and network retry screen
- HTML file chooser support for website upload forms

GitHub Actions builds a debug APK for testing and, when signing secrets are configured, a signed release APK and Android App Bundle (AAB).

The WebView module is separate from the existing native-news module. Both use the same application ID, so install only one build at a time. The WebView release is versionCode 4 and is intended to supersede earlier builds only when signed with the matching key.

Release signing expects the GitHub Actions secrets KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_PASSWORD, and KEY_ALIAS. Never commit keystore files or credentials.
