// Fabrique un module de jeu complet à partir d'une configuration de déduction.
import type { GameModule, OptionDef } from '../../core/types';
import type { Item, Pack } from '../../content/types';
import { entries, getPack, findItemByName, similarity } from '../../content';
import type { Rng } from '../../core/rng';
import { createState, makeView, onAction, onTick, type DeductionConfig, type DState, type DView } from './engine';
import { makeDeductionAI } from './ai';
import { DeductionBoard } from './Board';

export function deductionModule(
  meta: Omit<GameModule<DState, DView>, 'setup' | 'onAction' | 'onTick' | 'view' | 'ai' | 'Board' | 'options'> & { options: OptionDef[] },
  cfg: DeductionConfig
): GameModule<DState, DView> {
  return {
    ...meta,
    setup: (ctx) => createState(cfg, ctx),
    onAction: (s, pid, a, ctx) => onAction(cfg, s, pid, a, ctx),
    onTick: (s, ctx) => onTick(cfg, s, ctx),
    view: (s, pid, ctx) => makeView(cfg, s, pid, ctx),
    ai: makeDeductionAI(cfg),
    Board: DeductionBoard
  };
}

// ---------- Aides partagées par les jeux ----------

export function packItems(pub: { packId?: string }, packs: Pack[]): Item[] {
  const p = pub.packId ? getPack(pub.packId) : undefined;
  return p ? p.items : entries(packs).map((e) => e.item);
}

export function lookupIn(items: Item[], word: string, packs: Pack[]): Item | undefined {
  return items.find((i) => i.name === word) ?? findItemByName(packs, word);
}

export function firstEmoji(s: string): string {
  const seg = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return seg[0] ?? '🃏';
}

/** Propositions pour la dernière chance : la solution + les éléments les plus proches. */
export function guessChoices(solution: Item, pool: Item[], rng: Rng, n = 8): string[] {
  const close = pool
    .filter((i) => i !== solution)
    .map((i) => ({ i, s: similarity(solution, i) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n - 1)
    .map((x) => x.i.name);
  return rng.shuffle([solution.name, ...close]);
}

/** Tags les plus rares d'un élément : servent de mots interdits. */
export function rareTags(item: Item, pool: Item[], n = 2): string[] {
  return item.tags
    .map((t) => ({ t, c: pool.filter((i) => i.tags.includes(t)).length }))
    .sort((a, b) => a.c - b.c)
    .slice(0, n)
    .map((x) => x.t.replace(/-/g, ' '));
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
