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

export function brainEnabled(): boolean {
  const s = settings.get();
  return !!s.brainUrl && s.brainOn && Date.now() > pausedUntil;
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
  if (!s.brainUrl || inflight > 3) return req.intent;
  const p = personality(req.player.personality);
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
