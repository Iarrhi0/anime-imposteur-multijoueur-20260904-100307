// 😀 Emoji Quiz : des emojis s'affichent, trouve de quoi il s'agit parmi 4 choix
// (ou en l'écrivant). Plus tu réponds vite, plus tu marques.
import type { AgentAPI, AgentMind, BaseState, BaseView, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { matchesItem, similarity } from '../../content';
import { activeIds, aiChance, aiEnd, aiMem, aiReady, aiSay, byDiff, choosePack, copyItem, finish, nameOf, num, packFor, pickLine, sec, zeroScores } from './common';
import { EmojiBoard } from './EmojiBoard';

export interface EAnswer {
  choice?: number;
  text?: string;
  correct: boolean;
  pts: number;
  ms: number;
}

export interface EHistory {
  name: string;
  emoji: string;
  winners: string[];
}

export interface EState extends BaseState {
  phase: 'play' | 'reveal' | 'end';
  round: number;
  rounds: number;
  mode: 'choix' | 'texte';
  order: string[];
  roundMs: number;
  startAt: number;
  packId: string;
  packName: string;
  packEmoji: string;
  item: Item;
  choices: string[];
  answerIdx: number;
  answers: Record<string, EAnswer>;
  history: EHistory[];
}

export interface EView extends BaseView {
  phase: EState['phase'];
  round: number;
  rounds: number;
  mode: EState['mode'];
  order: string[];
  packId: string;
  packName: string;
  packEmoji: string;
  emoji: string;
  choices: string[];
  answered: string[];
  mine: EAnswer | null;
  /** Révélé après la manche. */
  answerIdx: number | null;
  answer: string | null;
  answers: Record<string, EAnswer> | null;
  history: EHistory[];
}

function startRound(s: EState, ctx: RuntimeCtx) {
  const used = new Set(s.history.map((h) => h.name));
  const pack = choosePack(ctx.packs, ctx.rng, 4);
  const pool = pack.items.filter((i) => !used.has(i.name) && i.emoji);
  const item = ctx.rng.pick(pool.length ? pool : pack.items);
  const close = pack.items
    .filter((i) => i !== item && i.name !== item.name)
    .map((i) => ({ i, s: similarity(item, i) + ctx.rng.next() * 0.15 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 7);
  const wrong = ctx.rng.sample(close, 3).map((x) => x.i.name);
  const choices = ctx.rng.shuffle([item.name, ...wrong]);
  s.packId = pack.id;
  s.packName = pack.name;
  s.packEmoji = pack.emoji;
  s.item = copyItem(item);
  s.choices = choices;
  s.answerIdx = choices.indexOf(item.name);
  s.answers = {};
  s.startAt = ctx.now;
  s.deadline = ctx.now + s.roundMs;
  s.phase = 'play';
  if (s.round === 1) ctx.announce(`😀 Emoji Quiz ! ${s.rounds} manches, ${Math.round(s.roundMs / 1000)} secondes chacune. Répondez vite !`);
}

function endRound(s: EState, ctx: RuntimeCtx) {
  s.phase = 'reveal';
  const good = s.order.filter((id) => s.answers[id]?.correct).sort((a, b) => s.answers[a].ms - s.answers[b].ms);
  s.history.push({ name: s.item.name, emoji: s.item.emoji, winners: good });
  ctx.announce(`${s.item.emoji} = « ${s.item.name} » ! ${good.length ? `Le plus rapide : ${nameOf(ctx, good[0])}.` : 'Personne n’a trouvé 😅'}`);
  s.deadline = ctx.now + 5000;
}

function nextRound(s: EState, ctx: RuntimeCtx) {
  if (s.round >= s.rounds) {
    const lines = s.history.map((h, i) => `${i + 1}. ${h.emoji} → ${h.name}${h.winners.length ? ` (⚡ ${nameOf(ctx, h.winners[0])})` : ''}`);
    return finish(s, ctx, s.order, lines.join('\n'));
  }
  s.round++;
  startRound(s, ctx);
}

function setup(ctx: RuntimeCtx): EState {
  const o = ctx.options;
  const s: EState = {
    phase: 'play',
    scores: zeroScores(ctx),
    round: 1,
    rounds: num(o, 'rounds', 8, 1, 30),
    mode: o.answerMode === 'texte' ? 'texte' : 'choix',
    order: activeIds(ctx),
    roundMs: sec(o, 'roundSec', 20),
    startAt: 0,
    packId: '',
    packName: '',
    packEmoji: '',
    item: { name: '', emoji: '', tags: [], clues: [] },
    choices: [],
    answerIdx: 0,
    answers: {},
    history: []
  };
  startRound(s, ctx);
  return s;
}

function onAction(s: EState, pid: string, a: { type: string; [k: string]: any }, ctx: RuntimeCtx) {
  if (a.type === 'next') {
    if (s.phase === 'reveal') nextRound(s, ctx);
    return;
  }
  if (a.type !== 'answer' || s.phase !== 'play' || !s.order.includes(pid) || s.answers[pid]) return;
  const ms = Math.max(0, ctx.now - s.startAt);
  let correct = false;
  const ans: EAnswer = { correct: false, pts: 0, ms };
  if (typeof a.choice === 'number' && a.choice >= 0 && a.choice < s.choices.length) {
    ans.choice = a.choice;
    correct = a.choice === s.answerIdx;
  } else {
    const text = String(a.text ?? '').trim().slice(0, 80);
    if (!text) return;
    ans.text = text;
    correct = matchesItem(text, s.item);
  }
  ans.correct = correct;
  if (correct) {
    const frac = Math.max(0, 1 - ms / s.roundMs);
    // écrire la réponse rapporte un petit bonus
    ans.pts = 2 + Math.round(8 * frac) + (ans.text ? 2 : 0);
    s.scores[pid] = (s.scores[pid] ?? 0) + ans.pts;
  }
  s.answers[pid] = ans;
  if (s.order.every((id) => s.answers[id])) endRound(s, ctx);
}

function onTick(s: EState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'play') endRound(s, ctx);
  else if (s.phase === 'reveal') nextRound(s, ctx);
}

function view(s: EState, pid: string | null): EView {
  const open = s.phase !== 'play';
  return {
    phase: s.phase,
    needs: s.phase === 'play' ? s.order.filter((id) => !s.answers[id]) : [],
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    round: s.round,
    rounds: s.rounds,
    mode: s.mode,
    order: s.order,
    packId: s.packId,
    packName: s.packName,
    packEmoji: s.packEmoji,
    emoji: s.item.emoji,
    choices: s.mode === 'choix' || open ? s.choices : [],
    answered: Object.keys(s.answers),
    mine: pid ? s.answers[pid] ?? null : null,
    answerIdx: open ? s.answerIdx : null,
    answer: open ? s.item.name : null,
    answers: open ? s.answers : null,
    history: s.history
  };
}

// ---------- IA ----------

function think(v: EView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.round}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  if (v.phase === 'reveal') {
    const a = v.answers?.[me];
    if (a && !a.correct && aiChance(api, 0.15)) aiSay(api, mem, pickLine(api, ['Ah mais oui ! 🤦', 'J’étais sûr que c’était l’autre…', 'Ces emojis sont trompeurs 😅']), 1);
    return;
  }
  if (v.mine || !v.order.includes(me)) return;
  const pack = packFor(api.packs, v.packId);
  const secLeft = v.deadline ? (v.deadline - api.now) / 1000 : 20;
  const [lo, hi] = byDiff(api, { facile: [0.35, 0.8], normal: [0.2, 0.6], difficile: [0.1, 0.35] });
  const total = Math.max(5, secLeft);
  if (!aiReady(api, mem, api.rng.int(Math.round(total * lo * 1000), Math.round(total * hi * 1000)))) return;
  const accuracy = byDiff(api, { facile: 0.55, normal: 0.75, difficile: 0.92 });
  // L'IA « reconnaît » l'élément du pack dont les emojis collent le mieux (sa culture).
  const items = pack?.items ?? [];
  const exact = items.find((i) => i.emoji === v.emoji);
  const knows = !!exact && api.rng.chance(accuracy);
  if (v.mode === 'choix' && v.choices.length) {
    let idx = exact ? v.choices.indexOf(exact.name) : -1;
    if (!knows || idx < 0) {
      const others = v.choices.map((_, i) => i).filter((i) => i !== idx);
      idx = api.rng.pick(others.length ? others : [0]);
    }
    api.act({ type: 'answer', choice: idx });
  } else {
    let text = exact?.name ?? '';
    if (!knows || !text) {
      const pool = items.filter((i) => i.name !== exact?.name);
      text = pool.length ? api.rng.pick(pool).name : '???';
    }
    api.act({ type: 'answer', text });
  }
  if (aiChance(api, 0.12)) aiSay(api, mem, pickLine(api, ['Facile celle-là !', 'Hmm… je tente.', 'Évident 😏']), 1);
}

export const emojiQuiz: GameModule<EState, EView> = {
  id: 'emoji-quiz',
  name: 'Emoji Quiz',
  family: 'devine',
  emoji: '😀',
  tagline: 'Quelques emojis, 4 réponses, une seule bonne : le plus rapide gagne !',
  rules: [
    'Des emojis représentent un élément du thème (film, personnage, plat…).',
    'Choisis la bonne réponse parmi 4 propositions (ou écris-la en mode « Réponse libre »).',
    'Une seule réponse par manche ! Plus tu es rapide, plus tu marques (jusqu’à 10 points).',
    'En mode choix, écrire la bonne réponse toi-même rapporte +2 bonus.'
  ],
  minPlayers: 1,
  maxPlayers: 16,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Manches', type: 'number', min: 1, max: 30, default: 8 },
    {
      key: 'answerMode',
      label: 'Réponses',
      type: 'select',
      default: 'choix',
      choices: [
        { value: 'choix', label: '🔘 4 choix' },
        { value: 'texte', label: '⌨️ Réponse libre' }
      ]
    },
    { key: 'roundSec', label: 'Temps par manche (s)', type: 'number', min: 5, max: 60, step: 5, default: 20 }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai: { think },
  Board: EmojiBoard
};
