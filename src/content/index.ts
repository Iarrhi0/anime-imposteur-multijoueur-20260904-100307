// Registre des packs de thèmes + fonctions de similarité utilisées par les jeux et les IA.
import type { Item, Pack, PackCategory } from './types';
import type { Rng } from '../core/rng';
import { keywords, norm, fuzzyEq } from '../core/text';
import { loadCustomPacks } from './custom';

// Tous les fichiers de src/content/packs/*.ts sont chargés automatiquement.
const modules = import.meta.glob<{ pack: Pack }>('./packs/*.ts', { eager: true });

export const CATEGORY_LABELS: Record<PackCategory, string> = {
  anime: 'Anime & manga',
  films: 'Films',
  series: 'Séries',
  'dessins-animes': 'Dessins animés',
  'jeux-video': 'Jeux vidéo',
  'super-heros': 'Super-héros',
  sport: 'Sport',
  celebrites: 'Célébrités',
  musique: 'Musique',
  histoire: 'Histoire',
  geographie: 'Pays & lieux',
  nourriture: 'Nourriture',
  animaux: 'Animaux',
  metiers: 'Métiers',
  objets: 'Objets',
  marques: 'Marques',
  perso: 'Mes packs'
};

const CATEGORY_ORDER: PackCategory[] = Object.keys(CATEGORY_LABELS) as PackCategory[];

const BUILTIN: Pack[] = Object.values(modules)
  .map((m) => m.pack)
  .filter((p): p is Pack => !!p && Array.isArray(p.items) && p.items.length > 0)
  .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));


export function allPacks(): Pack[] {
  return [...BUILTIN, ...loadCustomPacks()];
}

export function getPack(id: string): Pack | undefined {
  return allPacks().find((p) => p.id === id);
}

/** Packs choisis par l'utilisateur ; 'mix' ou vide = tous les packs intégrés. */
export function resolvePacks(ids: string[] | undefined): Pack[] {
  const all = allPacks();
  if (!ids || !ids.length || ids.includes('mix')) return BUILTIN.length ? BUILTIN : all;
  const res = all.filter((p) => ids.includes(p.id));
  return res.length ? res : all;
}

export interface Entry {
  item: Item;
  pack: Pack;
}

export function entries(packs: Pack[]): Entry[] {
  return packs.flatMap((pack) => pack.items.map((item) => ({ item, pack })));
}

// ---------- Similarité ----------

export function similarity(a: Item, b: Item): number {
  if (a === b || a.name === b.name) return 1;
  const ta = new Set(a.tags);
  const tb = new Set(b.tags);
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  const union = ta.size + tb.size - inter || 1;
  let s = inter / union;
  if (a.group && b.group && a.group === b.group) s += 0.25;
  return Math.min(0.99, s);
}

export type Closeness = 'proche' | 'moyen' | 'loin';

/**
 * Choisit une paire (majorité, imposteur) dans un même pack.
 * 'proche' = très similaires (difficile), 'loin' = différents (facile).
 */
export function pickPair(packs: Pack[], rng: Rng, closeness: Closeness = 'proche'): { a: Entry; b: Entry } {
  const pack = rng.pick(packs.filter((p) => p.items.length >= 2));
  const a = rng.pick(pack.items);
  const others = pack.items.filter((i) => i !== a).map((i) => ({ i, s: similarity(a, i) }));
  others.sort((x, y) => y.s - x.s);
  let pool: typeof others;
  if (closeness === 'proche') pool = others.slice(0, Math.max(1, Math.ceil(others.length * 0.08)));
  else if (closeness === 'moyen') pool = others.slice(Math.ceil(others.length * 0.08), Math.max(2, Math.ceil(others.length * 0.35)));
  else pool = others.slice(Math.ceil(others.length * 0.5));
  if (!pool.length) pool = others;
  const b = rng.pick(pool).i;
  return { a: { item: a, pack }, b: { item: b, pack } };
}

export function pickDistinct(packs: Pack[], rng: Rng, n: number, samePack = true): Entry[] {
  if (samePack) {
    const candidates = packs.filter((p) => p.items.length >= n);
    if (candidates.length) {
      const pack = rng.pick(candidates);
      return rng.sample(pack.items, n).map((item) => ({ item, pack }));
    }
  }
  return rng.sample(entries(packs), n);
}

// ---------- Texte ↔ élément (utilisé par les IA pour « comprendre » les indices) ----------

const vocabCache = new WeakMap<Item, Set<string>>();

export function itemVocab(item: Item): Set<string> {
  let v = vocabCache.get(item);
  if (v) return v;
  v = new Set<string>();
  const add = (s: string) => keywords(s).forEach((w) => v!.add(w));
  add(item.name);
  (item.aliases ?? []).forEach(add);
  item.tags.forEach((t) => add(t.replace(/-/g, ' ')));
  item.clues.forEach(add);
  if (item.group) add(item.group);
  vocabCache.set(item, v);
  return v;
}

/** Score 0..1 : à quel point un texte (indice) évoque un élément. */
export function textMatch(text: string, item: Item): number {
  const words = keywords(text);
  if (!words.length) {
    // indice composé uniquement d'emojis
    const emojis = [...text].filter((c) => /\p{Extended_Pictographic}/u.test(c));
    if (!emojis.length) return 0;
    const hit = emojis.filter((e) => item.emoji.includes(e)).length;
    return hit / emojis.length;
  }
  const vocab = itemVocab(item);
  let hit = 0;
  for (const w of words) {
    if (vocab.has(w)) hit++;
    else if (w.length > 4 && [...vocab].some((x) => x.length > 4 && (x.startsWith(w) || w.startsWith(x)))) hit += 0.6;
  }
  return Math.min(1, hit / Math.min(words.length, 3));
}

/** Classe des éléments candidats selon une liste d'indices entendus. */
export function rankByClues(candidates: Item[], clues: string[]): { item: Item; score: number }[] {
  return candidates
    .map((item) => ({ item, score: clues.reduce((s, c) => s + textMatch(c, item), 0) }))
    .sort((a, b) => b.score - a.score);
}

export function matchesItem(guess: string, item: Item): boolean {
  if (fuzzyEq(guess, item.name)) return true;
  if ((item.aliases ?? []).some((a) => fuzzyEq(guess, a))) return true;
  // « Naruto » pour « Naruto Uzumaki »
  const g = norm(guess);
  return g.length >= 4 && norm(item.name).split(' ').some((part) => part.length >= 4 && fuzzyEq(part, g));
}

export function findItemByName(packs: Pack[], guess: string): Item | undefined {
  return entries(packs).find((e) => matchesItem(guess, e.item))?.item;
}

/** Tag le plus « informatif » pour couper un ensemble de candidats en deux. */
export function bestSplitTag(candidates: Item[], exclude: Set<string>): string | null {
  const counts = new Map<string, number>();
  candidates.forEach((c) => c.tags.forEach((t) => !exclude.has(t) && counts.set(t, (counts.get(t) ?? 0) + 1)));
  let best: string | null = null;
  let bestScore = Infinity;
  const half = candidates.length / 2;
  counts.forEach((n, t) => {
    if (n === candidates.length) return;
    const score = Math.abs(n - half);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  });
  return best;
}

export function questionForTag(pack: Pack | undefined, tag: string): string {
  const a = pack?.attributes.find((x) => x.tag === tag);
  return a ? a.question : `Est-ce que ça correspond à « ${tag.replace(/-/g, ' ')} » ?`;
}

/** Réponse d'un connaisseur à une question libre sur un élément : oui / non / peut-être. */
export function answerQuestion(item: Item, pack: Pack | undefined, question: string): 'oui' | 'non' | 'peut-être' {
  const q = norm(question);
  // question correspondant exactement à un attribut du pack
  const attr = pack?.attributes.find((a) => norm(a.question) === q);
  if (attr) return item.tags.includes(attr.tag) ? 'oui' : 'non';
  // tentative de nom complet
  if (matchesItem(question.replace(/^(est ce|c est|serait ce)\s+/i, ''), item)) return 'oui';
  const words = keywords(question);
  if (!words.length) return 'peut-être';
  const tagWords = new Set(item.tags.flatMap((t) => keywords(t.replace(/-/g, ' '))));
  const vocab = itemVocab(item);
  if (words.some((w) => tagWords.has(w))) return 'oui';
  // mot correspondant à un tag du pack que l'élément n'a pas → non
  const packTags = new Set(
    (pack?.items ?? []).flatMap((i) => i.tags).flatMap((t) => keywords(t.replace(/-/g, ' ')))
  );
  if (words.some((w) => packTags.has(w))) return words.some((w) => vocab.has(w)) ? 'oui' : 'non';
  if (words.some((w) => vocab.has(w))) return 'oui';
  return 'peut-être';
}

export function describeTheme(packs: Pack[]): string {
  if (packs.length === 1) return `${packs[0].emoji} ${packs[0].name}`;
  if (packs.length === BUILTIN.length) return '🎲 Mix de tous les thèmes';
  return packs.map((p) => p.emoji).join('') + ' Mix';
}
