# Anime Imposteur TURN worker

This Worker returns short-lived Cloudflare Realtime TURN credentials only to users
who present a valid Firebase Authentication ID token.

## Required configuration

1. Create a Cloudflare Realtime TURN key.
2. Set `FIREBASE_API_KEY` in `wrangler.toml`.
3. Add the secrets:
   - `TURN_KEY_ID`
   - `TURN_KEY_API_TOKEN`
4. Deploy the Worker.
5. Put the deployed Worker URL in `voice-config.js` as `turnCredentialsUrl`.

The browser never receives the long-term Cloudflare TURN key or API token.
