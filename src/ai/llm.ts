// « Cerveau IA conversationnel » optionnel.
// L'app n'appelle jamais directement une API payante : elle appelle TON Cloudflare Worker
// (gratuit) qui garde la clé secrète et utilise une offre gratuite (Gemini, Groq…).
// Si le Worker n'est pas configuré, ou si le quota gratuit est épuisé, les IA utilisent
// leur cerveau local : la partie continue toujours.
import type { BaseView, ChatMsg, Player } from '../core/types';
import { personality } from './personalities';
import { settings } from '../app/settings';

let failures = 0;
let pausedUntil = 0;
let inflight = 0;

let lastFree = 0;

export function brainEnabled(): boolean {
  const s = settings.get();
  return s.brainOn && Date.now() > pausedUntil;
}

/** IA gratuite sans compte ni clé (Pollinations). Limitée : 1 requête à la fois, espacées. */
async function askFree(system: string, user: string): Promise<string> {
  if (inflight > 1 || Date.now() - lastFree < 3500) throw new Error('busy');
  lastFree = Date.now();
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 70, temperature: 0.95 })
  });
  if (res.status === 429) {
    pausedUntil = Date.now() + 30_000;
    throw new Error('quota');
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = await res.json();
  return String(d?.choices?.[0]?.message?.content ?? '').trim();
}

export interface BrainRequest {
  player: Player;
  /** Ce que l'IA veut exprimer (décidé par le cerveau local). */
  intent: string;
  view: BaseView;
  chat: ChatMsg[];
  game: string;
}

/** Résumé de ce que l'IA sait, SANS jamais inclure les secrets des autres. */
function describeView(v: BaseView): string {
  const keep: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (['needs', 'scores', 'deadline'].includes(k)) continue;
    if (typeof val === 'function') continue;
    keep[k] = val;
  }
  const s = JSON.stringify(keep);
  return s.length > 1800 ? s.slice(0, 1800) + '…' : s;
}

export async function askBrain(req: BrainRequest): Promise<string> {
  const s = settings.get();
  if (inflight > 3) return req.intent;
  const p = personality(req.player.personality);
  if (!s.brainUrl) {
    const system = `Tu es ${body0(req, p).persona} dans le jeu de société « ${req.game} ». Tu écris UN message de chat en français familier, 1 phrase courte (max 20 mots), fidèle à ton caractère. Varie toujours tes formulations, ne répète jamais une phrase déjà dite. Ne révèle jamais ton mot secret ni ton rôle. Ne dis jamais que tu es une IA. Pas de guillemets.`;
    const user = `Ce que tu sais : ${describeView(req.view)}\nChat récent :\n${req.chat.map((m) => `${m.name}: ${m.text}`).slice(-12).join('\n')}\nTon intention : ${req.intent}`;
    inflight++;
    try {
      const t = (await askFree(system, user)).replace(/^["«\s]+|["»\s]+$/g, '').slice(0, 220);
      failures = 0;
      return t || req.intent;
    } catch (e) {
      if (String((e as Error).message) !== 'busy' && ++failures >= 3) pausedUntil = Date.now() + 120_000;
      return req.intent;
    } finally {
      inflight--;
    }
  }
  const body = {
    persona: `${req.player.name}, ${p.label} : ${p.desc}`,
    game: req.game,
    intent: req.intent,
    knowledge: describeView(req.view),
    chat: req.chat.map((m) => `${m.name}: ${m.text}`).slice(-15)
  };
  inflight++;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(s.brainUrl.replace(/\/$/, '') + '/talk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (res.status === 429) {
      pausedUntil = Date.now() + 60_000;
      throw new Error('quota');
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = (await res.json()) as { text?: string };
    failures = 0;
    const text = String(data.text ?? '').trim().slice(0, 240);
    return text || req.intent;
  } catch (e) {
    failures++;
    if (failures >= 3) pausedUntil = Date.now() + 120_000;
    throw e;
  } finally {
    clearTimeout(t);
    inflight--;
  }
}

function body0(req: BrainRequest, p: ReturnType<typeof personality>) {
  return { persona: `${req.player.name}, ${p.label} (${p.desc})` };
}

export async function testBrain(url: string): Promise<string> {
  const res = await fetch(url.replace(/\/$/, '') + '/talk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      persona: 'Kaito, Le Blagueur',
      game: 'Test',
      intent: 'Dire bonjour à tout le monde',
      knowledge: '{}',
      chat: []
    })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return String(data.text ?? '');
}
