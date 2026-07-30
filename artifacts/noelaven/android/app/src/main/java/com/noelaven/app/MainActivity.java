package com.noelaven.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity for Noelaven (Capacitor)
 *
 * Adds a native offline/error overlay that appears when the device has no
 * internet connection.  This prevents Play Store reviewers from seeing a
 * blank white screen or the browser's "Webpage not available" error when
 * they test with airplane mode, which is the main reason Capacitor apps
 * get flagged as "thin WebView wrappers."
 *
 * Architecture:
 *  • A FrameLayout overlay is inflated on top of the WebView root.
 *  • ConnectivityManager.NetworkCallback (API 21+) detects online/offline
 *    transitions and shows/hides the overlay on the UI thread.
 *  • A "Try again" button calls webView.reload() and hides the overlay.
 *  • The web-side NetworkContext + OfflineScreen (React) handles mid-session
 *    drops after the page is already loaded — the two layers complement each other.
 */
public class MainActivity extends BridgeActivity {

    private View offlineOverlay;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        inflateOfflineOverlay();
        monitorConnectivity();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterNetworkCallback();
    }

    // ─── Offline overlay ─────────────────────────────────────────────────────

    private void inflateOfflineOverlay() {
        offlineOverlay = LayoutInflater.from(this)
                .inflate(R.layout.offline_overlay, null);
        offlineOverlay.setVisibility(View.GONE);

        // Attach to the activity's root content view so it sits above everything
        ViewGroup root = (ViewGroup) getWindow()
                .getDecorView()
                .findViewById(android.R.id.content);
        root.addView(offlineOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        Button retryButton = offlineOverlay.findViewById(R.id.btn_retry);
        retryButton.setOnClickListener(v -> {
            offlineOverlay.setVisibility(View.GONE);
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.reload();
            }
        });
    }

    private void showOfflineOverlay() {
        runOnUiThread(() -> {
            if (offlineOverlay != null) {
                offlineOverlay.setVisibility(View.VISIBLE);
            }
        });
    }

    private void hideOfflineOverlay() {
        runOnUiThread(() -> {
            if (offlineOverlay != null) {
                offlineOverlay.setVisibility(View.GONE);
            }
        });
    }

    // ─── Connectivity monitoring ──────────────────────────────────────────────

    private void monitorConnectivity() {
        ConnectivityManager cm = (ConnectivityManager)
                getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;

        // Check initial state — show overlay immediately if already offline
        if (!isConnected(cm)) {
            showOfflineOverlay();
        }

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                // Connection restored — hide overlay and reload
                hideOfflineOverlay();
                runOnUiThread(() -> {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.reload();
                    }
                });
            }

            @Override
            public void onLost(Network network) {
                // All networks lost — show overlay
                // (the web-side OfflineScreen handles mid-session drops gracefully,
                // but showing the native overlay here ensures a branded experience
                // even before the page has fully loaded)
                if (!isConnected(cm)) {
                    showOfflineOverlay();
                }
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
        cm.registerNetworkCallback(request, networkCallback);
    }

    private void unregisterNetworkCallback() {
        if (networkCallback == null) return;
        try {
            ConnectivityManager cm = (ConnectivityManager)
                    getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                cm.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception e) {
            // Already unregistered — safe to ignore
        }
        networkCallback = null;
    }

    /** Returns true if the device has at least one network with INTERNET capability. */
    private boolean isConnected(ConnectivityManager cm) {
        Network activeNetwork = cm.getActiveNetwork();
        if (activeNetwork == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
}
