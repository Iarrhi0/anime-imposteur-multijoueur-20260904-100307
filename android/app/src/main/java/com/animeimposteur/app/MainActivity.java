package com.animeimposteur.app;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private boolean exitDialogVisible = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        webView.setBackgroundColor(Color.rgb(7, 17, 31));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        settings.setUserAgentString(
            settings.getUserAgentString() + " AnimeImposteurAndroid/8.5"
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                // Tout reste dans l'application.
                return false;
            }
        });

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    handleAppBack();
                }
            }
        );

        if (savedInstanceState == null) {
            webView.loadUrl(BuildConfig.GAME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void handleAppBack() {
        if (webView == null) {
            showExitConfirmation();
            return;
        }

        /*
         * Détecte l'écran actuel sans utiliser l'historique Chrome.
         *
         * Messages :
         *   -> revient à Indices / Vote / Résultat.
         *
         * Partie ou lobby :
         *   -> utilise la modale "Quitter la partie / salle ?" du jeu.
         *
         * Accueil :
         *   -> affiche une confirmation Android avant de fermer.
         */
        String script =
            "(function(){" +
            "try{" +
            "var leave=document.querySelector('#leave-modal');" +
            "if(leave && !leave.classList.contains('hidden')) return 'modal';" +

            "var bot=document.querySelector('#bot-modal');" +
            "if(bot && !bot.classList.contains('hidden')) return 'modal';" +

            "var install=document.querySelector('#install-modal');" +
            "if(install && !install.classList.contains('hidden')) return 'modal';" +

            "var active=document.querySelector('.screen.active');" +
            "var id=active?active.id:'';" +

            "var chat=document.querySelector('#game-chat-panel');" +
            "if(id==='screen-game' && chat && !chat.classList.contains('hidden')) return 'chat';" +

            "if(id==='screen-game' || id==='screen-lobby') return 'room';" +

            "return 'home';" +
            "}catch(e){" +
            "return 'home';" +
            "}" +
            "})()";

        webView.evaluateJavascript(script, rawValue -> {
            String context = decodeJsString(rawValue);

            if (
                "chat".equals(context) ||
                "room".equals(context) ||
                "modal".equals(context)
            ) {
                webView.evaluateJavascript(
                    "window.__animeHandleBack ? window.__animeHandleBack() : void(0)",
                    null
                );
                return;
            }

            showExitConfirmation();
        });
    }

    private String decodeJsString(String value) {
        if (value == null) return "";

        String result = value.trim();

        if (
            result.length() >= 2 &&
            result.startsWith("\"") &&
            result.endsWith("\"")
        ) {
            result = result.substring(1, result.length() - 1);
        }

        return result
            .replace("\\\"", "\"")
            .replace("\\\\", "\\");
    }

    private void showExitConfirmation() {
        if (exitDialogVisible || isFinishing()) return;

        exitDialogVisible = true;

        new AlertDialog.Builder(this)
            .setTitle("Quitter Anime Imposteur ?")
            .setMessage("Veux-tu vraiment fermer l’application ?")
            .setNegativeButton("Rester", (dialog, which) -> {
                exitDialogVisible = false;
                dialog.dismiss();
            })
            .setPositiveButton("Quitter", (dialog, which) -> {
                exitDialogVisible = false;
                finishAndRemoveTask();
            })
            .setOnCancelListener(dialog -> exitDialogVisible = false)
            .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }

        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
