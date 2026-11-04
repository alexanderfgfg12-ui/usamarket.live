package com.usamarket.live

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var splash: FrameLayout
    private lateinit var progress: ProgressBar
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pageFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(7, 23, 46)
        window.navigationBarColor = Color.rgb(7, 23, 46)
        val root = FrameLayout(this)
        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        splash = makeSplash()
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        root.addView(progress, FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP))
        root.addView(splash, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)

        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(webView, true) }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = userAgentString + " USAmarketAndroid/2.1.0"
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host?.lowercase().orEmpty()
                if ((host == "usamarket.live" || host == "www.usamarket.live") && uri.scheme == "https") return false
                openExternal(uri)
                return true
            }
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                pageFailed = false
                progress.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
                if (!pageFailed) splash.visibility = View.GONE
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    pageFailed = true
                    progress.visibility = View.GONE
                    splash.removeAllViews()
                    val message = TextView(this@MainActivity).apply {
                        text = "Unable to connect to USA Market.\nCheck your internet connection and tap to retry."
                        setTextColor(Color.WHITE); textSize = 17f; gravity = Gravity.CENTER
                        setPadding(dp(28), dp(24), dp(28), dp(24))
                        setOnClickListener { splash.visibility = View.VISIBLE; webView.reload() }
                    }
                    splash.addView(message, FrameLayout.LayoutParams(-1, -1))
                    splash.visibility = View.VISIBLE
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
            override fun onShowFileChooser(webView: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try { startActivityForResult(params?.createIntent(), FILE_CHOOSER_REQUEST); true }
                catch (_: Exception) { fileCallback = null; false }
            }
        }
        if (savedInstanceState == null) webView.loadUrl(HOME_URL) else webView.restoreState(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (webView.canGoBack()) webView.goBack() else finish() }
        })
    }

    private fun makeSplash(): FrameLayout = FrameLayout(this).apply {
        setBackgroundColor(Color.rgb(7, 23, 46))
        val title = TextView(this@MainActivity).apply { text = "USA MARKET"; textSize = 28f; letterSpacing = 0.12f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
        val subtitle = TextView(this@MainActivity).apply { text = "News  •  Shopping  •  Markets"; textSize = 14f; setTextColor(Color.rgb(190, 210, 235)); gravity = Gravity.CENTER }
        val stack = android.widget.LinearLayout(this@MainActivity).apply {
            orientation = android.widget.LinearLayout.VERTICAL; gravity = Gravity.CENTER
            addView(title); addView(subtitle)
            addView(ProgressBar(this@MainActivity), android.widget.LinearLayout.LayoutParams(dp(42), dp(42)).apply { topMargin = dp(28) })
        }
        addView(stack, FrameLayout.LayoutParams(-1, -1))
    }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: ActivityNotFoundException) { }
    }

    @Deprecated("Activity result compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == Activity.RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null
            fileCallback?.onReceiveValue(result); fileCallback = null
        }
    }

    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onDestroy() { fileCallback?.onReceiveValue(null); webView.destroy(); super.onDestroy() }
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val HOME_URL = "https://usamarket.live/"
        private const val FILE_CHOOSER_REQUEST = 8102
    }
}
