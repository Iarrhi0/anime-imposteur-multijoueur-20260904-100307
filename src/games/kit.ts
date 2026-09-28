// Petits outils partagés par les jeux « rôles », « mensonge », « duels » et « rapides ».
import type { AgentAPI, AgentMind, ChatMsg, Player, RuntimeCtx } from '../core/types';
import { norm } from '../core/text';

export function activeIds(ctx: { players: Player[] }): string[] {
  return ctx.players.filter((p) => !p.spectator).map((p) => p.id);
}

export function initScores(ctx: { players: Player[] }): Record<string, number> {
  return Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
}

export function nameOf(ctx: { players: Player[] }, id?: string | null): string {
  return ctx.players.find((p) => p.id === id)?.name ?? '?';
}

export function secs(opts: Record<string, any>, key: string, def: number): number {
  const n = Number(opts?.[key]);
  return (Number.isFinite(n) && n > 0 ? n : def) * 1000;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Valeur pseudo-aléatoire stable dans [0,1) (goûts constants d'une IA). */
export function stable01(s: string): number {
  return (hash(s) % 10000) / 10000;
}

/** Mémoire IA typée, initialisée une seule fois. */
export function aiMem<T extends object>(mind: AgentMind, init: () => T): T {
  if (!mind.mem.__init) Object.assign(mind.mem, init(), { __init: true });
  return mind.mem as T;
}

export interface HeardMsg {
  msg: ChatMsg;
  text: string;
  /** Joueurs cités dans le message (hors auteur). */
  mentions: string[];
  /** L'IA elle-même est citée. */
  toMe: boolean;
}

export function mentionsName(normText: string, name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(normText);
}

/** Nouveaux messages de chat (des autres joueurs) depuis le dernier passage de l'IA. */
export function newChat(api: AgentAPI, mind: AgentMind): HeardMsg[] {
  const out: HeardMsg[] = [];
  for (const m of api.chat) {
    if (m.ts <= mind.lastChatSeen || m.from === api.me.id || m.from === 'system') continue;
    const text = norm(m.text);
    const mentions = api.players.filter((p) => p.id !== m.from && mentionsName(text, p.name)).map((p) => p.id);
    out.push({ msg: m, text, mentions, toMe: mentions.includes(api.me.id) });
  }
  return out;
}

/** Ordre de parole : délai avant de parler selon la personnalité. */
export function talkDelay(api: AgentAPI, talk: number, base = 2500): number {
  return base + api.rng.int(0, 5000) * (1.3 - talk);
}



/** Mot d'un tag lisible (« super-force » → « super force »). */
export function tagLabel(tag: string): string {
  return tag.replace(/-/g, ' ');
}

/** Élément de pack copié dans l'état (JSON pur). */
export interface ItemRef {
  name: string;
  emoji: string;
  group?: string;
  tags: string[];
  clues: string[];
  aliases?: string[];
  pack: string;
  packName: string;
}

export function toRef(item: { name: string; emoji: string; group?: string; tags: string[]; clues: string[]; aliases?: string[] }, pack: { id: string; name: string }): ItemRef {
  return { name: item.name, emoji: item.emoji, group: item.group, tags: [...item.tags], clues: [...item.clues], aliases: item.aliases ? [...item.aliases] : undefined, pack: pack.id, packName: pack.name };
}

/** Premier emoji (graphème) d'une chaîne d'emojis. */
export function firstGrapheme(s: string): string {
  try {
    const seg = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
    return seg[0] ?? '🃏';
  } catch {
    return [...s][0] ?? '🃏';
  }
}
