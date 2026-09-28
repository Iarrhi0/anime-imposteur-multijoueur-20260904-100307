// Cloudflare Worker gratuit d'Imposteur Party.
//  POST /talk : reformule le message d'une IA de façon naturelle avec un modèle gratuit (Gemini).
//  GET  /turn : fournit des identifiants temporaires de relais vocal (Cloudflare TURN), si configuré.
// La clé API reste ici, jamais dans le navigateur.

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
});

const json = (env, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    try {
      if (url.pathname === '/talk' && req.method === 'POST') return await talk(req, env);
      if (url.pathname === '/turn') return await turn(env);
      return json(env, { ok: true, service: 'imposteur-party' });
    } catch (e) {
      return json(env, { error: String(e?.message || e) }, 500);
    }
  }
};

async function talk(req, env) {
  if (!env.GEMINI_API_KEY) return json(env, { error: 'GEMINI_API_KEY manquante' }, 503);
  const b = await req.json();
  const str = (v, n) => String(v ?? '').slice(0, n);
  const prompt = [
    `Tu joues un personnage dans un jeu de société de déduction (${str(b.game, 60)}).`,
    `Ton personnage : ${str(b.persona, 200)}.`,
    `Ce que tu sais (tes informations secrètes et publiques, JSON) : ${str(b.knowledge, 2000)}`,
    `Derniers messages du chat :\n${(Array.isArray(b.chat) ? b.chat : []).slice(-15).map((l) => str(l, 200)).join('\n')}`,
    `Ton intention : « ${str(b.intent, 300)} ».`,
    'Écris UNIQUEMENT ton prochain message de chat, en français familier, 1 ou 2 phrases courtes, fidèle à ton caractère et à ton intention.',
    'Ne révèle jamais ton mot secret ni ton rôle. Ne dis jamais que tu es une IA. Pas de guillemets.'
  ].join('\n\n');
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 80, temperature: 0.9 } })
  });
  if (r.status === 429) return json(env, { error: 'quota' }, 429);
  if (!r.ok) return json(env, { error: 'modèle indisponible' }, 502);
  const d = await r.json();
  const text = (d?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["«]|["»]$/g, '');
  return json(env, { text });
}

async function turn(env) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json(env, { iceServers: [] });
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 })
  });
  if (!r.ok) return json(env, { iceServers: [] });
  const d = await r.json();
  const servers = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
  return json(env, { iceServers: servers });
}
