// Outils partagés par les jeux « Devine » : packs, questions oui/non simulées,
// candidats cohérents avec les réponses, fin de partie, petites aides pour les IA.
import type { AgentAPI, AgentMind, BaseState, Player, RuntimeCtx } from '../../core/types';
import type { Item, Pack } from '../../content/types';
import { answerQuestion, getPack, matchesItem, questionForTag } from '../../content';
import { joinNames, norm } from '../../core/text';
import { line, personality, type LineKind } from '../../ai/personalities';

export type Answer = 'oui' | 'non' | 'peut-être';
export type Difficulty = 'facile' | 'normal' | 'difficile';

export interface MiniItem {
  name: string;
  emoji: string;
}

export interface QA {
  text: string;
  answer: string;
}

/** Copie JSON d'un élément (on ne garde jamais de référence partagée dans l'état). */
export function copyItem(i: Item): Item {
  return {
    name: i.name,
    emoji: i.emoji,
    tags: [...i.tags],
    clues: [...i.clues],
    ...(i.aliases ? { aliases: [...i.aliases] } : {}),
    ...(i.group ? { group: i.group } : {})
  };
}

export function mini(i: Item): MiniItem {
  return { name: i.name, emoji: i.emoji };
}

export function firstGrapheme(s: string): string {
  try {
    const seg = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
    return seg[0] ?? '❔';
  } catch {
    return [...s][0] ?? '❔';
  }
}

export function graphemes(s: string): string[] {
  try {
    return [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  } catch {
    return [...s];
  }
}

/** Joueurs qui jouent réellement (hors spectateurs). */
export function activeIds(ctx: { players: Player[] }): string[] {
  return ctx.players.filter((p) => !p.spectator).map((p) => p.id);
}

export function zeroScores(ctx: { players: Player[] }): Record<string, number> {
  return Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
}

export function nameOf(ctx: { players: Player[] }, id?: string | null): string {
  return ctx.players.find((p) => p.id === id)?.name ?? '?';
}

export function packFor(packs: Pack[], id?: string): Pack | undefined {
  if (!id) return undefined;
  return packs.find((p) => p.id === id) ?? getPack(id);
}

export function itemIn(pack: Pack | undefined, name?: string | null): Item | undefined {
  if (!pack || !name) return undefined;
  return pack.items.find((i) => i.name === name);
}

/** Choisit un pack avec au moins `min` éléments (sinon le plus gros). */
export function choosePack(packs: Pack[], rng: RuntimeCtx['rng'], min: number): Pack {
  const ok = packs.filter((p) => p.items.length >= min);
  if (ok.length) return rng.pick(ok);
  return [...packs].sort((a, b) => b.items.length - a.items.length)[0];
}

export function sec(opts: Record<string, any>, key: string, def: number): number {
  const n = Number(opts[key]);
  return (Number.isFinite(n) && n > 0 ? n : def) * 1000;
}

export function num(opts: Record<string, any>, key: string, def: number, min = 1, max = 999): number {
  const n = Number(opts[key]);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : def));
}

/** Termine la partie : gagnants = meilleurs scores (> 0). */
export function finish(s: BaseState, ctx: RuntimeCtx, among: string[], summary?: string) {
  s.phase = 'end';
  s.deadline = undefined;
  const best = Math.max(0, ...among.map((id) => s.scores[id] ?? 0));
  s.winners = best > 0 ? among.filter((id) => (s.scores[id] ?? 0) === best) : [];
  const head = s.winners.length ? `🏆 ${joinNames(s.winners.map((id) => nameOf(ctx, id)))} ${s.winners.length > 1 ? 'gagnent' : 'gagne'} avec ${best} point${best > 1 ? 's' : ''} !` : 'Personne n’a marqué de point…';
  s.summary = summary ? `${head}\n${summary}` : head;
  ctx.announce(head);
}

// ---------- Questions oui/non simulées ----------

const simCache = new Map<string, Record<string, Answer>>();

/** Réponse de chaque élément du pack à une question (mise en cache). */
export function simAnswers(pack: Pack, question: string): Record<string, Answer> {
  const key = `${pack.id}|${pack.items.length}|${norm(question)}`;
  let r = simCache.get(key);
  if (r) return r;
  r = {};
  for (const it of pack.items) r[it.name] = answerQuestion(it, pack, question);
  if (simCache.size > 4000) simCache.clear();
  simCache.set(key, r);
  return r;
}

export function simAnswer(pack: Pack | undefined, item: Item, question: string): Answer {
  if (!pack || !pack.items.includes(item)) return answerQuestion(item, pack, question);
  return simAnswers(pack, question)[item.name] ?? answerQuestion(item, pack, question);
}

function toYesNo(a: string): 'oui' | 'non' | null {
  const n = norm(a);
  if (n === 'oui') return 'oui';
  if (n === 'non') return 'non';
  return null;
}

/**
 * Candidats les plus cohérents avec les réponses reçues : on garde ceux qui
 * contredisent le moins de réponses (tolère les erreurs des humains).
 */
export function consistent(pack: Pack | undefined, items: Item[], qa: QA[]): Item[] {
  if (!items.length) return [];
  const useful = qa.map((q) => ({ text: q.text, a: toYesNo(q.answer) })).filter((q) => q.a) as { text: string; a: 'oui' | 'non' }[];
  if (!useful.length) return items;
  let best = Infinity;
  const scored = items.map((it) => {
    let miss = 0;
    for (const q of useful) {
      const sim = simAnswer(pack, it, q.text);
      if (sim !== 'peut-être' && sim !== q.a) miss++;
    }
    if (miss < best) best = miss;
    return { it, miss };
  });
  return scored.filter((x) => x.miss === best).map((x) => x.it);
}

/** Élimine les éléments dont la réponse (certaine) diffère de la réponse reçue. */
export function strictFilter(pack: Pack | undefined, items: Item[], qa: QA[]): Item[] {
  return items.filter((it) =>
    qa.every((q) => {
      const a = toYesNo(q.answer);
      if (!a) return true;
      const sim = simAnswer(pack, it, q.text);
      return sim === 'peut-être' || sim === a;
    })
  );
}

/** Tags dont la question a déjà été posée. */
export function askedTags(pack: Pack | undefined, items: Item[], asked: string[]): Set<string> {
  const set = new Set(asked.map(norm));
  const out = new Set<string>();
  const tags = new Set(items.flatMap((i) => i.tags));
  pack?.attributes.forEach((a) => tags.add(a.tag));
  tags.forEach((t) => set.has(norm(questionForTag(pack, t))) && out.add(t));
  return out;
}

/** Questions d'attributs suggérées : celles qui coupent le mieux les candidats en deux. */
export function suggest(pack: Pack | undefined, cands: Item[], asked: string[], n = 6): string[] {
  if (!pack) return [];
  const done = new Set(asked.map(norm));
  const half = cands.length / 2;
  const rows = pack.attributes
    .filter((a) => !done.has(norm(a.question)))
    .map((a) => {
      const c = cands.filter((i) => i.tags.includes(a.tag)).length;
      return { q: a.question, c, score: c === 0 || c === cands.length ? 1000 + Math.abs(c - half) : Math.abs(c - half) };
    })
    .sort((a, b) => a.score - b.score);
  return rows.slice(0, n).map((r) => r.q);
}

/** Retire les préfixes « Est-ce », « C'est »… d'une question qui propose un nom. */
export function stripAsk(q: string): string {
  return q
    .trim()
    .replace(/[?!.…]+$/g, '')
    .replace(/^(est[- ]ce que c'?est|est[- ]ce que c’est|est[- ]ce|c'?est|c’est|serait[- ]ce|ce serait|c'?est pas|je pense que c'?est|je dirais)\s+/i, '')
    .replace(/^(le|la|les|l'|l’|un|une)\s*/i, '')
    .trim();
}

export function isGuessOf(q: string, item: Item): boolean {
  const s = stripAsk(q);
  return !!s && matchesItem(s, item);
}

// ---------- IA ----------

export interface AiMem {
  key?: string;
  said: number;
  actAt?: number;
  endSaid?: boolean;
  [k: string]: any;
}

/** Mémoire de l'IA, remise à zéro (compteurs) à chaque changement de `key`. */
export function aiMem(mind: AgentMind, key: string): AiMem {
  const m = mind.mem as AiMem;
  if (typeof m.said !== 'number') m.said = 0;
  if (m.key !== key) {
    m.key = key;
    m.said = 0;
    m.actAt = undefined;
  }
  return m;
}

/** Parle sans spammer : au plus `max` messages par phase. */
export function aiSay(api: AgentAPI, mem: AiMem, text: string, max = 2): boolean {
  if (mem.said >= max) return false;
  mem.said++;
  api.say(text);
  return true;
}

/** Parle avec une probabilité modulée par la personnalité. */
export function aiChance(api: AgentAPI, p: number): boolean {
  const P = personality(api.me.personality);
  return api.rng.chance(Math.min(1, p * (0.4 + P.talk)));
}

export function aiLine(api: AgentAPI, mem: AiMem, kind: LineKind, p: number, vars: Record<string, string> = {}, max = 2) {
  if (!aiChance(api, p)) return;
  aiSay(api, mem, line(personality(api.me.personality), kind, api.rng, vars), max);
}

export function pickLine(api: AgentAPI, lines: string[]): string {
  return api.rng.pick(lines);
}

/** Vrai quand le délai de réflexion (fixé au premier appel) est écoulé. */
export function aiReady(api: AgentAPI, mem: AiMem, ms: number): boolean {
  if (mem.actAt === undefined) mem.actAt = api.now + ms;
  if (api.now < mem.actAt) return false;
  mem.actAt = undefined;
  return true;
}

export function byDiff<T>(api: AgentAPI, v: Record<Difficulty, T>): T {
  return v[api.difficulty] ?? v.normal;
}

/** Délai de réflexion aléatoire selon la difficulté. */
export function thinkMs(api: AgentAPI, v: Record<Difficulty, [number, number]>): number {
  const [a, b] = byDiff(api, v);
  return api.rng.int(a, b);
}

/** Petit message de fin, une seule fois. */
export function aiEnd(api: AgentAPI, mind: AgentMind, winners?: string[]) {
  const m = mind.mem as AiMem;
  if (m.endSaid) return;
  m.endSaid = true;
  if (!aiChance(api, 0.5)) return;
  api.say(line(personality(api.me.personality), winners?.includes(api.me.id) ? 'win' : 'lose', api.rng));
}
