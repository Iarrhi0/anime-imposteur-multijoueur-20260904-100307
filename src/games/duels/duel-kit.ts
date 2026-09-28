// Aides partagées par les jeux de la famille « duels » (IA : goûts et puissance perçue).
import type { AgentAPI } from '../../core/types';
import type { Pack } from '../../content/types';
import { norm } from '../../core/text';
import type { Rng } from '../../core/rng';
import { similarity } from '../../content';
import { stable01, tagLabel, toRef, type ItemRef } from '../kit';
import type { Personality } from '../../ai/personalities';

/** Poids des tags pour juger « qui gagnerait ». */
export const POWER: Record<string, number> = {
  dieu: 3,
  invincible: 3,
  immortel: 2.5,
  légendaire: 2,
  puissant: 2,
  'super-force': 2,
  'super-pouvoirs': 1.5,
  dangereux: 1.5,
  'champion-du-monde': 1.5,
  'champion-olympique': 1.5,
  combat: 1.2,
  héros: 1,
  génie: 1,
  sorcier: 1,
  transformation: 1,
  démon: 1.2,
  carnivore: 1,
  prédateur: 1.2,
  méchant: 0.8,
  protagoniste: 0.8,
  culte: 0.8,
  grand: 0.7,
  feu: 0.7,
  foudre: 0.7,
  glace: 0.6,
  épéiste: 0.8,
  ninja: 0.8,
  militaire: 1,
  armé: 1,
  rapide: 0.7,
  intelligent: 0.6,
  leader: 0.6,
  sauvage: 0.6,
  'non-humain': 0.5,
  légende: 1.5,
  iconique: 0.8,
  populaire: 0.6,
  'ballon-d-or': 1.5,
  petit: -0.8,
  enfant: -0.6,
  drôle: -0.3,
  mignon: -0.6,
  herbivore: -0.4,
  domestique: -0.5,
  retraité: -0.3
};

/** Tags « appréciés » pour noter une tier list / juger une popularité. */
export const LIKED: Record<string, number> = {
  légendaire: 1.5,
  culte: 1.5,
  iconique: 1.2,
  populaire: 1,
  héros: 0.8,
  puissant: 0.8,
  protagoniste: 0.6,
  'champion-du-monde': 1,
  'ballon-d-or': 1.2,
  sucré: 0.5,
  drôle: 0.6,
  génie: 0.6,
  classique: 0.6,
  chaud: 0.2,
  mignon: 0.5,
  rare: 0.3,
  ancien: -0.2,
  méchant: -0.1,
  retraité: -0.2,
  amer: -0.6,
  dangereux: -0.2
};

export function tagWeight(tag: string, table: Record<string, number>): number {
  if (table[tag] !== undefined) return table[tag];
  if (/pouvoir|magie|force/.test(tag)) return 0.6;
  return 0;
}

export function powerOf(it: ItemRef, table: Record<string, number> = POWER): number {
  return it.tags.reduce((s, t) => s + tagWeight(t, table), 0) + Math.min(1, it.clues.length * 0.05);
}

/** Tirage de paires d'éléments proches (même groupe ou très similaires) dans un même pack. */
export function pickPairs(packs: Pack[], rng: Rng, n: number): { a: ItemRef; b: ItemRef; category: string }[] {
  const out: { a: ItemRef; b: ItemRef; category: string }[] = [];
  const used = new Set<string>();
  const usable = packs.filter((p) => p.items.length >= 2);
  for (let tries = 0; out.length < n && tries < n * 20 && usable.length; tries++) {
    const pack = rng.pick(usable);
    const free = pack.items.filter((i) => !used.has(i.name));
    if (free.length < 2) continue;
    const a = rng.pick(free);
    const others = free
      .filter((i) => i !== a)
      .map((i) => ({ i, s: similarity(a, i) + (a.group && i.group === a.group ? 0.3 : 0) + rng.next() * 0.1 }))
      .sort((x, y) => y.s - x.s);
    const b = rng.pick(others.slice(0, Math.min(4, others.length))).i;
    used.add(a.name);
    used.add(b.name);
    const pair = rng.chance(0.5) ? [a, b] : [b, a];
    out.push({ a: toRef(pair[0], pack), b: toRef(pair[1], pack), category: pack.category });
  }
  return out;
}

/** Sélection de n éléments distincts d'un même pack (tier list, un seul indice…). */
export function pickItems(packs: Pack[], rng: Rng, n: number, samePack = true): ItemRef[] {
  const usable = packs.filter((p) => p.items.length > 0);
  if (!usable.length) return [];
  if (samePack) {
    const big = usable.filter((p) => p.items.length >= n);
    if (big.length) {
      const pack = rng.pick(big);
      return rng.sample(pack.items, n).map((i) => toRef(i, pack));
    }
  }
  const all = usable.flatMap((p) => p.items.map((i) => ({ i, p })));
  return rng.sample(all, Math.min(n, all.length)).map(({ i, p }) => toRef(i, p));
}

/** Un nom d'élément est-il évoqué dans un texte (normalisé) ? */
export function textMentions(normText: string, it: ItemRef): boolean {
  const names = [it.name, ...(it.aliases ?? [])].map(norm);
  if (names.some((n) => n && normText.includes(n))) return true;
  return norm(it.name)
    .split(' ')
    .some((w) => w.length >= 4 && new RegExp(`(^|\\s)${w}(\\s|$)`).test(normText));
}

/** Goût personnel stable d'une IA pour un élément, centré sur 0. */
export function taste(api: AgentAPI, key: string, P: Personality): number {
  const spread = 0.6 + P.flexible * 0.8 + (P.id === 'chaotique' ? 1.2 : 0);
  return (stable01(api.me.id + '|' + key) - 0.5) * spread;
}

/** Meilleur argument (tag distinctif ou indice) en faveur d'un élément. */
export function argumentFor(api: AgentAPI, it: ItemRef, other: ItemRef | null, table: Record<string, number>): string {
  const own = it.tags.filter((t) => !other || !other.tags.includes(t));
  const best = own.map((t) => ({ t, w: tagWeight(t, table) })).sort((x, y) => y.w - x.w)[0];
  if (best && best.w > 0 && api.rng.chance(0.75)) return tagLabel(best.t);
  const clue = it.clues.length ? api.rng.pick(it.clues) : undefined;
  if (clue) return clue.charAt(0).toLowerCase() + clue.slice(1).replace(/\.$/, '');
  return tagLabel(api.rng.pick(it.tags.length ? it.tags : ['classe']));
}
