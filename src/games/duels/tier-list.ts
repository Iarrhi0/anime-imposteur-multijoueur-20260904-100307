// 🏆 Tier list : le groupe classe des éléments de S à D, un par un.
import { joinNames } from '../../core/text';
import type { AgentMind, AIStrategy, BaseState, BaseView, GameAction, GameModule, RuntimeCtx } from '../../core/types';
import { line, personality } from '../../ai/personalities';
import { activeIds, aiMem, initScores, nameOf, newChat, secs, type ItemRef } from '../kit';
import { argumentFor, LIKED, pickItems, powerOf, taste, textMentions } from './duel-kit';
import { TierListBoard } from './TierListBoard';

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_VALUE: Record<Tier, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export function tierOf(avg: number): Tier {
  const r = Math.max(1, Math.min(5, Math.round(avg)));
  return TIERS[5 - r];
}

export interface TLState extends BaseState {
  phase: 'rate' | 'reveal' | 'end';
  active: string[];
  items: ItemRef[];
  idx: number;
  ratings: Record<string, Tier>[];
  groups: (Tier | null)[];
  avgs: (number | null)[];
  opts: Record<string, any>;
}

export interface TLView extends BaseView {
  phase: TLState['phase'];
  active: string[];
  idx: number;
  total: number;
  item: ItemRef | null;
  packName: string;
  rated: string[];
  myRating?: Tier;
  /** Notes de la manche (révélation) */
  ratings?: Record<string, Tier>;
  group?: Tier | null;
  avg?: number | null;
  /** Tableau final (éléments déjà notés). */
  board: { name: string; emoji: string; tier: Tier; avg: number }[];
}

function setup(ctx: RuntimeCtx): TLState {
  const n = Math.max(4, Math.min(15, Number(ctx.options.items ?? 8) || 8));
  const items = pickItems(ctx.packs, ctx.rng, n, true);
  const s: TLState = {
    phase: 'rate',
    active: activeIds(ctx),
    items,
    idx: 0,
    ratings: items.map(() => ({})),
    groups: items.map(() => null),
    avgs: items.map(() => null),
    scores: initScores(ctx),
    opts: { ...ctx.options }
  };
  if (!items.length) {
    s.phase = 'end';
    s.winners = [];
    s.summary = 'Pas assez d’éléments dans les thèmes choisis.';
    return s;
  }
  ctx.announce(`🏆 Tier list « ${items[0].packName} » : ${items.length} éléments à classer de S à D !`);
  startItem(s, ctx);
  return s;
}

function startItem(s: TLState, ctx: RuntimeCtx) {
  const it = s.items[s.idx];
  s.phase = 'rate';
  s.deadline = ctx.now + secs(s.opts, 'rateSec', 25);
  ctx.announce(`${it.emoji} ${it.name} : S, A, B, C ou D ?`);
}

function resolve(s: TLState, ctx: RuntimeCtx) {
  const r = s.ratings[s.idx];
  const vals = Object.values(r).map((t) => TIER_VALUE[t]);
  const it = s.items[s.idx];
  if (vals.length) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    s.avgs[s.idx] = avg;
    s.groups[s.idx] = tierOf(avg);
    // Points : proche de la moyenne du groupe
    for (const [id, t] of Object.entries(r)) {
      const d = Math.abs(TIER_VALUE[t] - avg);
      const p = d <= 0.5 ? 2 : d <= 1.5 ? 1 : 0;
      s.scores[id] = (s.scores[id] ?? 0) + p;
    }
    ctx.announce(`Le groupe classe ${it.name} en ${s.groups[s.idx]} (moyenne ${avg.toFixed(1)}).`);
  } else {
    s.avgs[s.idx] = 3;
    s.groups[s.idx] = 'B';
    ctx.announce(`Personne n’a noté ${it.name}… il atterrit en B par défaut.`);
  }
  s.phase = 'reveal';
  s.deadline = ctx.now + secs(s.opts, 'revealSec', 6);
}

function next(s: TLState, ctx: RuntimeCtx) {
  s.idx++;
  if (s.idx >= s.items.length) return endGame(s, ctx);
  startItem(s, ctx);
}

function endGame(s: TLState, ctx: RuntimeCtx) {
  s.phase = 'end';
  s.deadline = undefined;
  const best = Math.max(0, ...s.active.map((id) => s.scores[id] ?? 0));
  s.winners = best > 0 ? s.active.filter((id) => s.scores[id] === best) : [];
  const top = s.items.map((it, i) => ({ it, a: s.avgs[i] ?? 0 })).sort((a, b) => b.a - a.a)[0];
  s.summary = `Tier list terminée ! ${top ? `Numéro 1 du groupe : ${top.it.name} ${top.it.emoji.split(' ')[0]}. ` : ''}${joinNames(s.winners.map((id) => nameOf(ctx, id))) || 'Personne'} ${s.winners.length > 1 ? 'ont' : 'a'} les goûts les plus proches du groupe (${best} pts).`;
  ctx.announce(s.summary);
}

function onAction(s: TLState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  if (a.type === 'rate') {
    if (s.phase !== 'rate' || !s.active.includes(pid)) return;
    if (!TIERS.includes(a.tier)) return;
    s.ratings[s.idx][pid] = a.tier;
    if (s.active.every((id) => s.ratings[s.idx][id])) resolve(s, ctx);
  } else if (a.type === 'skip' && s.phase === 'reveal') next(s, ctx);
}

function onTick(s: TLState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'rate') resolve(s, ctx);
  else if (s.phase === 'reveal') next(s, ctx);
}

function view(s: TLState, pid: string | null): TLView {
  const it = s.items[s.idx];
  const r = s.ratings[s.idx] ?? {};
  return {
    phase: s.phase,
    needs: s.phase === 'rate' ? s.active.filter((id) => !r[id]) : [],
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    active: s.active,
    idx: s.idx,
    total: s.items.length,
    item: s.phase !== 'end' ? it ?? null : null,
    packName: s.items[0]?.packName ?? '',
    rated: Object.keys(r),
    myRating: pid ? r[pid] : undefined,
    ratings: s.phase === 'reveal' ? { ...r } : undefined,
    group: s.phase === 'reveal' ? s.groups[s.idx] : undefined,
    avg: s.phase === 'reveal' ? s.avgs[s.idx] : undefined,
    board: s.items
      .map((x, i) => ({ name: x.name, emoji: x.emoji, tier: s.groups[i]!, avg: s.avgs[i] ?? 0 }))
      .filter((x) => x.tier)
  };
}

// ---------- IA ----------

interface TLMem {
  key: string;
  actAt: number;
  talkAt: number;
  said: number;
  heard: number[];
  endSaid: boolean;
}

function parseTier(text: string): Tier | null {
  const m = text.match(/(^|\s)(s|a|b|c|d)( tier)?(\s|$|!)/);
  if (m) return m[2].toUpperCase() as Tier;
  if (/incroyable|dieu|goat|legendaire|parfait|meilleur/.test(text)) return 'S';
  if (/nul|horrible|poubelle|pire|naze/.test(text)) return 'D';
  return null;
}

const ai: AIStrategy<TLView> = {
  think(v, mind: AgentMind, api) {
    const mem = aiMem<TLMem>(mind, () => ({ key: '', actAt: 0, talkAt: 0, said: 0, heard: [], endSaid: false }));
    const P = personality(api.me.personality);
    const me = api.me.id;
    const key = `${v.phase}-${v.idx}`;
    if (mem.key !== key) {
      if (v.phase === 'rate') mem.heard = [];
      mem.key = key;
      mem.said = 0;
      mem.actAt = api.now + 2000 + api.rng.int(0, 6000);
      mem.talkAt = api.now + 1500 + api.rng.int(0, 5000) * (1.3 - P.talk);
    }
    const it = v.item;
    for (const h of newChat(api, mind)) {
      const t = parseTier(h.text);
      if (t && (!it || textMentions(h.text, it) || h.text.length < 25)) mem.heard.push(TIER_VALUE[t]);
    }
    if (v.phase === 'rate' && it) {
      if (v.myRating) return;
      // Base : tags appréciés + goût personnel + humeur de la personnalité
      const mood = P.id === 'parano' ? -0.5 : P.id === 'competitif' ? -0.2 : P.id === 'drole' || P.id === 'suiveur' ? 0.2 : 0;
      const bonus = P.id === 'competitif' && it.tags.some((t) => /champion|puissant|legend|légend/.test(t)) ? 0.8 : 0;
      let score = 3 + Math.max(-1.5, Math.min(1.8, powerOf(it, LIKED) * 0.5)) + taste(api, it.name, P) * 1.5 + mood + bonus;
      if (mem.heard.length) {
        const avg = mem.heard.reduce((a, b) => a + b, 0) / mem.heard.length;
        const skill = { facile: 0.3, normal: 0.5, difficile: 0.7 }[api.difficulty];
        score = score * (1 - P.follow * skill) + avg * P.follow * skill;
      }
      score += (api.rng.next() - 0.5) * (P.id === 'chaotique' ? 2.5 : 0.8);
      const tier = tierOf(score);
      if (api.now >= mem.talkAt && mem.said < 1 && api.rng.chance(0.2 + P.talk * 0.5)) {
        mem.said++;
        const arg = argumentFor(api, it, null, LIKED);
        api.say(
          TIER_VALUE[tier] >= 4
            ? api.rng.pick([`${it.name} ? ${tier} direct, ${arg} !`, `${tier} tier, ${it.name} c’est la base.`, `${it.name} mérite le ${tier}, ${arg} 🔥`])
            : TIER_VALUE[tier] <= 2
              ? api.rng.pick([`${it.name}… ${tier}, désolé.`, `Franchement ${tier}. Pas convaincu.`, `${tier} pour ${it.name}, et je suis gentil 😅`])
              : api.rng.pick([`${it.name}, B. Correct sans plus.`, `Je mets ${tier}, ${arg} mais bon…`, `Milieu de tableau : ${tier}.`])
        );
        mem.actAt = Math.max(mem.actAt, api.now + 1500);
        return;
      }
      if (api.now < mem.actAt) return;
      api.act({ type: 'rate', tier });
      return;
    }
    if (v.phase === 'reveal' && v.ratings && v.group && it) {
      if (mem.said > 0) return;
      mem.said++;
      const mine = v.ratings[me];
      if (!mine || !api.rng.chance(P.talk * 0.5)) return;
      const diff = TIER_VALUE[mine] - TIER_VALUE[v.group];
      if (diff >= 2) api.say(`Quoi ?! ${it.name} en ${v.group} ? C’est du ${mine} minimum !`);
      else if (diff <= -2) api.say(`${v.group} pour ${it.name} ? Vous êtes trop gentils.`);
      else if (diff === 0) api.say(api.rng.pick(['Classement parfait 👌', 'D’accord avec le groupe.', 'Logique.']));
      return;
    }
    if (v.phase === 'end' && !mem.endSaid) {
      mem.endSaid = true;
      if (api.rng.chance(P.talk * 0.5)) api.say(line(P, v.winners?.includes(me) ? 'win' : 'lose', api.rng));
    }
  }
};

export const tierList: GameModule<TLState, TLView> = {
  id: 'tier-list',
  name: 'Tier list',
  family: 'duels',
  emoji: '🏆',
  tagline: 'Classez ensemble de S à D. Avez-vous les mêmes goûts que le groupe ?',
  rules: [
    'Des éléments d’un même thème apparaissent un par un.',
    'Chacun les note secrètement : S (le top), A, B, C ou D.',
    'Le tier du groupe = la moyenne des notes. Plus ta note est proche de la moyenne, plus tu marques (2 pts si très proche, 1 pt si proche).',
    'À la fin, admirez la tier list du groupe !'
  ],
  minPlayers: 2,
  maxPlayers: 16,
  usesThemes: true,
  options: [
    { key: 'items', label: 'Nombre d’éléments', type: 'number', min: 4, max: 15, default: 8 },
    { key: 'rateSec', label: 'Temps pour noter (s)', type: 'number', min: 8, max: 60, step: 2, default: 25 },
    { key: 'revealSec', label: 'Temps de révélation (s)', type: 'number', min: 3, max: 20, default: 6, advanced: true }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '🏆', desc: '8 éléments', options: { items: 8 } },
    { id: 'long', label: 'Grande tier list', emoji: '📜', desc: '12 éléments', options: { items: 12 } },
    { id: 'eclair', label: 'Éclair', emoji: '⚡', desc: '6 éléments, 12 s chacun', options: { items: 6, rateSec: 12 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: TierListBoard
};
