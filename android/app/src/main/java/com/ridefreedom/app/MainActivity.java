package com.ridefreedom.app;

import android.os.Bundle;
import android.content.Intent;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GarminBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // durante l'allenamento lo schermo resta acceso
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // l'audio dei giochi non deve aspettare un gesto dell'utente dentro l'app
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
        // tasto indietro: lo gestisce l'app (chiude pannelli, giochi, menu); esce solo se l'app lo chiede
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) { moveTaskToBack(true); return; }
                getBridge().getWebView().evaluateJavascript("window.rfBack ? window.rfBack() : 'exit'", value -> {
                    if (value == null) return;
                    if (value.contains("exit")) finish();
                    else if (value.contains("background")) moveTaskToBack(true);
                });
            }
        });
        handleShare(getIntent());
    }

    // link condivisi da YouTube (Condividi → Ride Freedom): si aprono in "Pedala su un video"
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || getBridge() == null) return;
        String js = "window.rfShared ? window.rfShared(" + JSONObject.quote(text) + ") : (window.rfPendingShare = " + JSONObject.quote(text) + ")";
        getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(js, null), 400);
    }
}
