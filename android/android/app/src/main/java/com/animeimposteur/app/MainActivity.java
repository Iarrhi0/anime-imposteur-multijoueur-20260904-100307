package com.animeimposteur.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

import io.agora.rtc2.ChannelMediaOptions;
import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;

public class MainActivity extends AppCompatActivity {
    private static final int REQUEST_MICROPHONE = 861;

    private WebView webView;
    private RtcEngine rtcEngine;
    private boolean voiceJoined = false;
    private boolean voiceMuted = false;
    private String currentVoiceChannel = null;
    private int currentVoiceUid = 0;
    private String pendingVoiceChannel = null;
    private int pendingVoiceUid = 0;
    private final Set<Integer> remoteVoiceUsers = new HashSet<>();

    private final IRtcEngineEventHandler rtcEventHandler = new IRtcEngineEventHandler() {
        @Override
        public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
            voiceJoined = true;
            voiceMuted = false;
            currentVoiceChannel = channel;
            currentVoiceUid = uid;
            emitVoiceEvent("joined", uid, participantCount(), null);
        }

        @Override
        public void onUserJoined(int uid, int elapsed) {
            synchronized (remoteVoiceUsers) {
                remoteVoiceUsers.add(uid);
            }
            emitVoiceEvent("participants", currentVoiceUid, participantCount(), null);
        }

        @Override
        public void onUserOffline(int uid, int reason) {
            synchronized (remoteVoiceUsers) {
                remoteVoiceUsers.remove(uid);
            }
            emitVoiceEvent("participants", currentVoiceUid, participantCount(), null);
        }

        @Override
        public void onError(int err) {
            emitVoiceEvent("error", currentVoiceUid, participantCount(), "Agora error " + err);
        }
    };

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        webView.setBackgroundColor(Color.rgb(7,17,31));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return false;
            }
        });

        webView.addJavascriptInterface(new VoiceBridge(), "AnimeVoice");

        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                    "window.__animeHandleBack ? window.__animeHandleBack() : history.back()",
                    null
                );
            }
        });

        if(savedInstanceState==null) {
            webView.loadUrl(BuildConfig.GAME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private int participantCount() {
        synchronized (remoteVoiceUsers) {
            return (voiceJoined ? 1 : 0) + remoteVoiceUsers.size();
        }
    }

    private boolean ensureAgora() {
        if (rtcEngine != null) return true;

        String appId = BuildConfig.AGORA_APP_ID == null ? "" : BuildConfig.AGORA_APP_ID.trim();
        if (appId.isEmpty()) {
            emitVoiceEvent("error", 0, 0, "Agora App ID non configuré");
            return false;
        }

        try {
            RtcEngineConfig config = new RtcEngineConfig();
            config.mContext = getApplicationContext();
            config.mAppId = appId;
            config.mEventHandler = rtcEventHandler;
            rtcEngine = RtcEngine.create(config);
            rtcEngine.enableAudio();
            rtcEngine.setEnableSpeakerphone(true);
            return true;
        } catch (Exception e) {
            emitVoiceEvent("error", 0, 0, "Initialisation Agora impossible");
            return false;
        }
    }

    private void joinAgoraChannel(String channel, int uid) {
        if (!ensureAgora()) return;
        if (channel == null || channel.trim().isEmpty()) {
            emitVoiceEvent("error", uid, 0, "Canal vocal invalide");
            return;
        }

        if (voiceJoined) {
            leaveAgoraChannel(false);
        }

        synchronized (remoteVoiceUsers) {
            remoteVoiceUsers.clear();
        }

        currentVoiceChannel = channel.trim();
        currentVoiceUid = Math.max(1, uid);
        emitVoiceEvent("joining", currentVoiceUid, 0, null);

        ChannelMediaOptions options = new ChannelMediaOptions();
        options.channelProfile = Constants.CHANNEL_PROFILE_COMMUNICATION;
        options.publishMicrophoneTrack = true;
        options.autoSubscribeAudio = true;

        int result = rtcEngine.joinChannel(
            null,
            currentVoiceChannel,
            currentVoiceUid,
            options
        );

        if (result < 0) {
            emitVoiceEvent("error", currentVoiceUid, 0, "Connexion vocale impossible (" + result + ")");
        }
    }

    private void leaveAgoraChannel(boolean notifyWeb) {
        if (rtcEngine != null) {
            try {
                rtcEngine.leaveChannel();
            } catch (Exception ignored) {}
        }

        voiceJoined = false;
        voiceMuted = false;
        currentVoiceChannel = null;
        currentVoiceUid = 0;
        synchronized (remoteVoiceUsers) {
            remoteVoiceUsers.clear();
        }

        if (notifyWeb) {
            emitVoiceEvent("left", 0, 0, null);
        }
    }

    private void setAgoraMuted(boolean muted) {
        if (rtcEngine == null || !voiceJoined) return;
        rtcEngine.muteLocalAudioStream(muted);
        voiceMuted = muted;
        emitVoiceEvent("muted", currentVoiceUid, participantCount(), muted ? "1" : "0");
    }

    private void emitVoiceEvent(String type, int uid, int count, String message) {
        try {
            JSONObject data = new JSONObject();
            data.put("type", type);
            data.put("uid", uid);
            data.put("count", count);
            data.put("muted", voiceMuted);
            if (message != null) data.put("message", message);

            final String js = "window.__animeVoiceNativeEvent && window.__animeVoiceNativeEvent(" +
                data.toString() + ");";

            runOnUiThread(() -> {
                if (webView != null) webView.evaluateJavascript(js, null);
            });
        } catch (Exception ignored) {}
    }

    public class VoiceBridge {
        @JavascriptInterface
        public boolean isConfigured() {
            return BuildConfig.AGORA_APP_ID != null && !BuildConfig.AGORA_APP_ID.trim().isEmpty();
        }

        @JavascriptInterface
        public boolean isJoined() {
            return voiceJoined;
        }

        @JavascriptInterface
        public void join(String channel, int uid) {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED) {
                    joinAgoraChannel(channel, uid);
                    return;
                }

                pendingVoiceChannel = channel;
                pendingVoiceUid = uid;
                requestPermissions(
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    REQUEST_MICROPHONE
                );
            });
        }

        @JavascriptInterface
        public void setMuted(boolean muted) {
            runOnUiThread(() -> setAgoraMuted(muted));
        }

        @JavascriptInterface
        public void leave() {
            runOnUiThread(() -> leaveAgoraChannel(true));
        }

        @JavascriptInterface
        public String getState() {
            try {
                JSONObject data = new JSONObject();
                data.put("configured", isConfigured());
                data.put("joined", voiceJoined);
                data.put("muted", voiceMuted);
                data.put("count", participantCount());
                data.put("uid", currentVoiceUid);
                return data.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != REQUEST_MICROPHONE) return;

        String channel = pendingVoiceChannel;
        int uid = pendingVoiceUid;
        pendingVoiceChannel = null;
        pendingVoiceUid = 0;

        if (grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED
                && channel != null) {
            joinAgoraChannel(channel, uid);
        } else {
            emitVoiceEvent("error", uid, 0, "Permission microphone refusée");
        }
    }

    @Override
    protected void onDestroy() {
        leaveAgoraChannel(false);

        if (rtcEngine != null) {
            try {
                RtcEngine.destroy();
            } catch (Exception ignored) {}
            rtcEngine = null;
        }

        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.removeJavascriptInterface("AnimeVoice");
            webView.destroy();
        }

        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out);
        super.onSaveInstanceState(out);
    }
}
