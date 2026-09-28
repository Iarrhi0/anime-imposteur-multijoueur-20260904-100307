// Moteur commun des jeux « révélation progressive » (Indices progressifs, Lettre par lettre) :
// un élément caché, des indices dévoilés pas à pas, tout le monde devine en même temps.
import type { BaseState, BaseView, GameAction, Player, RuntimeCtx } from '../../core/types';
import type { Item, Pack } from '../../content/types';
import type { Rng } from '../../core/rng';
import { matchesItem } from '../../content';
import { activeIds, choosePack, copyItem, finish, nameOf, num, sec, zeroScores } from './common';

export interface PFound {
  pid: string;
  pts: number;
  step: number;
}

export interface PFeed {
  pid: string;
  text: string;
  ok: boolean;
}

export interface PHistory {
  name: string;
  emoji: string;
  finders: string[];
}

export interface PState extends BaseState {
  phase: 'play' | 'reveal' | 'end';
  round: number;
  rounds: number;
  order: string[];
  packId: string;
  packName: string;
  packEmoji: string;
  item: Item;
  step: number;
  maxStep: number;
  stepMs: number;
  nextAt: number;
  cooldownMs: number;
  found: PFound[];
  cooldown: Record<string, number>;
  feed: PFeed[];
  history: PHistory[];
  extra: Record<string, any>;
  opts: Record<string, any>;
}

export interface PView extends BaseView {
  phase: PState['phase'];
  round: number;
  rounds: number;
  order: string[];
  packId: string;
  packName: string;
  packEmoji: string;
  step: number;
  maxStep: number;
  found: PFound[];
  feed: PFeed[];
  history: PHistory[];
  cooldownUntil: number;
  /** Prochaine révélation (horloge de l'hôte). */
  nextAt: number;
  potential: number;
  answer: { name: string; emoji: string } | null;
  pub: Record<string, any>;
}

export interface PConfig {
  minItems: number;
  graceMs: number;
  defaultCooldown: number;
  accept?(item: Item): boolean;
  /** Prépare la manche : nombre d'étapes, étape de départ, données propres au jeu. */
  prepare(item: Item, rng: Rng, s: PState): { maxStep: number; startStep: number; stepMs?: number; extra: Record<string, any> };
  /** Points pour une bonne réponse à l'étape courante (hors bonus du premier). */
  points(s: PState): number;
  /** Informations publiques visibles pendant la manche. */
  pub(s: PState): Record<string, any>;
  intro(s: PState, ctx: RuntimeCtx): string;
}

function pickItem(cfg: PConfig, packs: Pack[], rng: Rng, used: string[]): { pack: Pack; item: Item } {
  for (let i = 0; i < 20; i++) {
    const pack = choosePack(packs, rng, cfg.minItems);
    const pool = pack.items.filter((it) => (!cfg.accept || cfg.accept(it)) && !used.includes(it.name));
    if (pool.length) return { pack, item: rng.pick(pool) };
  }
  const pack = choosePack(packs, rng, 1);
  return { pack, item: rng.pick(pack.items) };
}

function startRound(cfg: PConfig, s: PState, ctx: RuntimeCtx) {
  const { pack, item } = pickItem(cfg, ctx.packs, ctx.rng, s.history.map((h) => h.name));
  s.packId = pack.id;
  s.packName = pack.name;
  s.packEmoji = pack.emoji;
  s.item = copyItem(item);
  s.found = [];
  s.feed = [];
  s.cooldown = {};
  const baseStep = sec(s.opts, 'stepSec', 5);
  s.stepMs = baseStep;
  const p = cfg.prepare(s.item, ctx.rng, s);
  s.extra = p.extra;
  s.maxStep = Math.max(p.startStep, p.maxStep);
  s.step = p.startStep;
  s.stepMs = p.stepMs ?? baseStep;
  s.nextAt = ctx.now + s.stepMs;
  s.deadline = ctx.now + (s.maxStep - s.step) * s.stepMs + cfg.graceMs;
  s.phase = 'play';
  ctx.announce(cfg.intro(s, ctx));
}

function endRound(s: PState, ctx: RuntimeCtx) {
  s.phase = 'reveal';
  s.step = s.maxStep;
  s.history.push({ name: s.item.name, emoji: s.item.emoji, finders: s.found.map((f) => f.pid) });
  const finders = s.found.map((f) => nameOf(ctx, f.pid));
  ctx.announce(`C’était « ${s.item.name} » ${s.item.emoji} ! ${finders.length ? `Trouvé par ${finders.join(', ')}.` : 'Personne n’a trouvé 😅'}`);
  s.deadline = ctx.now + 5500;
}

function nextRound(cfg: PConfig, s: PState, ctx: RuntimeCtx) {
  if (s.round >= s.rounds) {
    const lines = s.history.map((h, i) => `${i + 1}. ${h.emoji} ${h.name} — ${h.finders.length ? h.finders.map((id) => nameOf(ctx, id)).join(', ') : 'non trouvé'}`);
    return finish(s, ctx, s.order, lines.join('\n'));
  }
  s.round++;
  startRound(cfg, s, ctx);
}

export function progressive(cfg: PConfig) {
  return {
    setup(ctx: RuntimeCtx): PState {
      const s: PState = {
        phase: 'play',
        scores: zeroScores(ctx),
        round: 1,
        rounds: num(ctx.options, 'rounds', 5, 1, 20),
        order: activeIds(ctx),
        packId: '',
        packName: '',
        packEmoji: '',
        item: { name: '', emoji: '', tags: [], clues: [] },
        step: 0,
        maxStep: 1,
        stepMs: 5000,
        nextAt: 0,
        cooldownMs: sec(ctx.options, 'cooldownSec', cfg.defaultCooldown),
        found: [],
        cooldown: {},
        feed: [],
        history: [],
        extra: {},
        opts: { ...ctx.options }
      };
      startRound(cfg, s, ctx);
      return s;
    },

    onAction(s: PState, pid: string, a: GameAction, ctx: RuntimeCtx) {
      if (a.type === 'next') {
        if (s.phase === 'reveal') nextRound(cfg, s, ctx);
        return;
      }
      if (a.type !== 'guess' || s.phase !== 'play' || !s.order.includes(pid)) return;
      if (s.found.some((f) => f.pid === pid)) return;
      if (ctx.now < (s.cooldown[pid] ?? 0)) return;
      const text = String(a.text ?? '').trim().slice(0, 80);
      if (!text) return;
      if (matchesItem(text, s.item)) {
        const first = s.found.length === 0;
        const pts = cfg.points(s) + (first ? 2 : 0);
        s.found.push({ pid, pts, step: s.step });
        s.scores[pid] = (s.scores[pid] ?? 0) + pts;
        s.feed.push({ pid, text: '', ok: true });
        if (first) ctx.announce(`⚡ ${nameOf(ctx, pid)} a trouvé en premier ! +${pts}`);
        if (s.order.every((id) => s.found.some((f) => f.pid === id))) endRound(s, ctx);
      } else {
        s.cooldown[pid] = ctx.now + s.cooldownMs;
        s.feed.push({ pid, text, ok: false });
        if (s.feed.length > 60) s.feed.splice(0, s.feed.length - 60);
      }
    },

    onTick(s: PState, ctx: RuntimeCtx) {
      if (s.phase === 'play') {
        while (s.step < s.maxStep && ctx.now >= s.nextAt) {
          s.step++;
          s.nextAt += s.stepMs;
        }
        if (s.deadline && ctx.now >= s.deadline) endRound(s, ctx);
      } else if (s.phase === 'reveal' && s.deadline && ctx.now >= s.deadline) nextRound(cfg, s, ctx);
    },

    view(s: PState, pid: string | null, _ctx: { players: Player[] }): PView {
      return {
        phase: s.phase,
        needs: s.phase === 'play' ? s.order.filter((id) => !s.found.some((f) => f.pid === id)) : [],
        deadline: s.deadline,
        scores: s.scores,
        winners: s.winners,
        summary: s.summary,
        round: s.round,
        rounds: s.rounds,
        order: s.order,
        packId: s.packId,
        packName: s.packName,
        packEmoji: s.packEmoji,
        step: s.step,
        maxStep: s.maxStep,
        found: s.found,
        feed: s.feed,
        history: s.history,
        cooldownUntil: pid ? s.cooldown[pid] ?? 0 : 0,
        nextAt: s.nextAt,
        potential: s.phase === 'play' ? cfg.points(s) : 0,
        answer: s.phase === 'play' ? null : { name: s.item.name, emoji: s.item.emoji },
        pub: cfg.pub(s)
      };
    }
  };
}
