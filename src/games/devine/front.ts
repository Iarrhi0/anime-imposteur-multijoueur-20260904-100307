// 🤔 Carte sur le front : chacun a une carte que tout le monde voit… sauf lui.
// À ton tour : une question oui/non aux autres, puis tu peux tenter ta chance.
import type { AgentAPI, AgentMind, BaseState, BaseView, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { answerQuestion, bestSplitTag, matchesItem, pickDistinct, questionForTag } from '../../content';
import { norm } from '../../core/text';
import { activeIds, aiChance, aiEnd, aiMem, aiReady, aiSay, askedTags, byDiff, consistent, copyItem, finish, isGuessOf, nameOf, num, packFor, pickLine, sec, suggest, thinkMs, zeroScores } from './common';
import { FrontBoard } from './FrontBoard';

export type FAnswer = 'oui' | 'non' | 'nsp';

export interface FQuestion {
  pid: string;
  text: string;
  answers: Record<string, FAnswer>;
  result: FAnswer | null;
  round: number;
}

export interface FGuess {
  pid: string;
  text: string;
  correct: boolean;
}

export interface FState extends BaseState {
  phase: 'ask' | 'answer' | 'guess' | 'end';
  packId: string;
  packName: string;
  packEmoji: string;
  order: string[];
  turn: number;
  round: number;
  maxRounds: number;
  cards: Record<string, Item>;
  found: string[];
  foundPts: Record<string, number>;
  qlog: FQuestion[];
  guesses: FGuess[];
  sugg: string[];
  askMs: number;
  answerMs: number;
}

export interface FView extends BaseView {
  phase: FState['phase'];
  packId: string;
  packName: string;
  packEmoji: string;
  order: string[];
  current: string | null;
  round: number;
  maxRounds: number;
  /** Cartes visibles par ce joueur (la sienne est absente tant qu'il ne l'a pas trouvée). */
  cards: Record<string, { name: string; emoji: string }>;
  found: string[];
  foundPts: Record<string, number>;
  qlog: FQuestion[];
  question: FQuestion | null;
  guesses: FGuess[];
  suggestions: string[];
  answered: string[];
  myAnswer: FAnswer | null;
}

function current(s: FState): string | null {
  return s.phase === 'end' ? null : s.order[s.turn] ?? null;
}

function answerers(s: FState): string[] {
  const cur = current(s);
  return s.order.filter((id) => id !== cur);
}

function computeSugg(s: FState, ctx: RuntimeCtx, pid: string) {
  const pack = packFor(ctx.packs, s.packId);
  if (!pack) return (s.sugg = []);
  const others = new Set(Object.entries(s.cards).filter(([id]) => id !== pid).map(([, c]) => c.name));
  const mine = s.qlog.filter((q) => q.pid === pid && q.result);
  const wrong = s.guesses.filter((g) => g.pid === pid && !g.correct).map((g) => g.text);
  let cands = pack.items.filter((i) => !others.has(i.name) && !wrong.some((w) => matchesItem(w, i)));
  cands = consistent(pack, cands, mine.map((q) => ({ text: q.text, answer: q.result! })));
  s.sugg = suggest(pack, cands, mine.map((q) => q.text));
}

function startTurn(s: FState, ctx: RuntimeCtx, announce = true) {
  if (s.order.every((id) => s.found.includes(id))) return endFront(s, ctx);
  let guard = 0;
  while (s.found.includes(s.order[s.turn]) && guard++ < s.order.length * 2) advance(s);
  if (s.round > s.maxRounds) return endFront(s, ctx);
  s.phase = 'ask';
  s.deadline = ctx.now + s.askMs;
  const cur = s.order[s.turn];
  computeSugg(s, ctx, cur);
  if (announce) ctx.announce(`🤔 À ${nameOf(ctx, cur)} de poser une question sur sa carte.`);
}

function advance(s: FState) {
  s.turn++;
  if (s.turn >= s.order.length) {
    s.turn = 0;
    s.round++;
  }
}

function nextTurn(s: FState, ctx: RuntimeCtx) {
  const before = s.round;
  advance(s);
  if (s.round > s.maxRounds) return endFront(s, ctx);
  if (s.round !== before && s.round === s.maxRounds) ctx.announce('⚠️ Dernier tour de table !');
  startTurn(s, ctx);
}

function endFront(s: FState, ctx: RuntimeCtx) {
  const lines = s.order.map((id) => `${s.found.includes(id) ? '✅' : '❌'} ${nameOf(ctx, id)} : ${s.cards[id].emoji} ${s.cards[id].name}${s.foundPts[id] ? ` (+${s.foundPts[id]})` : ''}`);
  finish(s, ctx, s.order, lines.join('\n'));
}

function resolveAnswers(s: FState, ctx: RuntimeCtx) {
  const q = s.qlog[s.qlog.length - 1];
  const vals = Object.values(q.answers);
  const c = { oui: 0, non: 0, nsp: 0 } as Record<FAnswer, number>;
  vals.forEach((a) => c[a]++);
  let res: FAnswer = 'nsp';
  if (c.oui > c.non && c.oui >= c.nsp) res = 'oui';
  else if (c.non > c.oui && c.non >= c.nsp) res = 'non';
  q.result = res;
  s.phase = 'guess';
  s.deadline = ctx.now + s.answerMs;
  ctx.announce(`« ${q.text} » → ${res === 'oui' ? '✅ OUI' : res === 'non' ? '❌ NON' : '🤷 on ne sait pas'} (${c.oui} oui · ${c.non} non${c.nsp ? ` · ${c.nsp} ?` : ''})`);
}

function setup(ctx: RuntimeCtx): FState {
  const o = ctx.options;
  const order = ctx.rng.shuffle(activeIds(ctx));
  const picks = pickDistinct(ctx.packs, ctx.rng, Math.max(order.length, 2), true);
  const pack = picks[0].pack;
  const cards: Record<string, Item> = {};
  order.forEach((id, i) => (cards[id] = copyItem(picks[i % picks.length].item)));
  const s: FState = {
    phase: 'ask',
    scores: zeroScores(ctx),
    packId: pack.id,
    packName: pack.name,
    packEmoji: pack.emoji,
    order,
    turn: 0,
    round: 1,
    maxRounds: num(o, 'maxRounds', 8, 1, 20),
    cards,
    found: [],
    foundPts: {},
    qlog: [],
    guesses: [],
    sugg: [],
    askMs: sec(o, 'askSec', 60),
    answerMs: sec(o, 'answerSec', 30)
  };
  ctx.announce(`🤔 Chacun a une carte ${pack.emoji} ${pack.name} sur le front ! Vous voyez celles des autres, mais pas la vôtre.`);
  startTurn(s, ctx);
  return s;
}

function guess(s: FState, pid: string, text: string, ctx: RuntimeCtx) {
  const card = s.cards[pid];
  const correct = matchesItem(text, card);
  s.guesses.push({ pid, text, correct });
  if (correct) {
    const pts = Math.max(1, 5 - s.found.length) + (s.round === 1 ? 1 : 0);
    s.found.push(pid);
    s.foundPts[pid] = pts;
    s.scores[pid] = (s.scores[pid] ?? 0) + pts;
    ctx.announce(`🎉 ${nameOf(ctx, pid)} a trouvé : « ${card.name} » ${card.emoji} ! +${pts} points`);
  } else ctx.announce(`❌ ${nameOf(ctx, pid)} pense être « ${text} »… raté !`);
  nextTurn(s, ctx);
}

function onAction(s: FState, pid: string, a: { type: string; [k: string]: any }, ctx: RuntimeCtx) {
  const cur = current(s);
  switch (a.type) {
    case 'ask': {
      if (s.phase !== 'ask' || pid !== cur) return;
      const text = String(a.text ?? '').trim().slice(0, 140);
      if (!text) return;
      // « Est-ce que je suis X ? » = tentative directe
      if (isGuessOf(text, s.cards[pid]) || (/^(est[- ]ce que )?je suis\b/i.test(text) && matchesItem(text.replace(/^(est[- ]ce que )?je suis\s+/i, '').replace(/[?!.]+$/, ''), s.cards[pid]))) return guess(s, pid, text, ctx);
      s.qlog.push({ pid, text, answers: {}, result: null, round: s.round });
      s.phase = 'answer';
      s.deadline = ctx.now + s.answerMs;
      if (!answerers(s).length) resolveAnswers(s, ctx);
      return;
    }
    case 'answer': {
      if (s.phase !== 'answer' || !answerers(s).includes(pid)) return;
      const q = s.qlog[s.qlog.length - 1];
      q.answers[pid] = a.value === 'oui' ? 'oui' : a.value === 'non' ? 'non' : 'nsp';
      if (answerers(s).every((id) => q.answers[id])) resolveAnswers(s, ctx);
      return;
    }
    case 'guess': {
      if ((s.phase !== 'guess' && s.phase !== 'ask') || pid !== cur) return;
      const text = String(a.text ?? '').trim().slice(0, 80);
      if (!text) return;
      return guess(s, pid, text, ctx);
    }
    case 'pass': {
      if (s.phase !== 'guess' || pid !== cur) return;
      return nextTurn(s, ctx);
    }
  }
}

function onTick(s: FState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'ask') {
    ctx.announce(`⏱️ ${nameOf(ctx, current(s))} passe son tour.`);
    nextTurn(s, ctx);
  } else if (s.phase === 'answer') resolveAnswers(s, ctx);
  else if (s.phase === 'guess') nextTurn(s, ctx);
}

function view(s: FState, pid: string | null): FView {
  const cur = current(s);
  const cards: FView['cards'] = {};
  for (const id of s.order) {
    if (id !== pid || s.found.includes(id) || s.phase === 'end') cards[id] = { name: s.cards[id].name, emoji: s.cards[id].emoji };
  }
  const q = s.phase === 'answer' || s.phase === 'guess' ? s.qlog[s.qlog.length - 1] ?? null : null;
  let needs: string[] = [];
  if (s.phase === 'ask' || s.phase === 'guess') needs = cur ? [cur] : [];
  if (s.phase === 'answer' && q) needs = answerers(s).filter((id) => !q.answers[id]);
  // pendant la phase de réponse on ne montre pas qui a répondu quoi avant la fin
  const hideAnswers = (x: FQuestion): FQuestion => (x === q && s.phase === 'answer' ? { ...x, answers: pid && x.answers[pid] ? { [pid]: x.answers[pid] } : {} } : x);
  return {
    phase: s.phase,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    packId: s.packId,
    packName: s.packName,
    packEmoji: s.packEmoji,
    order: s.order,
    current: cur,
    round: s.round,
    maxRounds: s.maxRounds,
    cards,
    found: s.found,
    foundPts: s.foundPts,
    qlog: s.qlog.map(hideAnswers),
    question: q ? hideAnswers(q) : null,
    guesses: s.guesses,
    suggestions: pid && pid === cur ? s.sugg : [],
    answered: q && s.phase === 'answer' ? Object.keys(q.answers) : [],
    myAnswer: q && pid ? q.answers[pid] ?? null : null
  };
}

// ---------- IA ----------

function myCandidates(v: FView, api: AgentAPI): Item[] {
  const pack = packFor(api.packs, v.packId);
  if (!pack) return [];
  const me = api.me.id;
  const others = new Set(Object.entries(v.cards).filter(([id]) => id !== me).map(([, c]) => c.name));
  const wrong = v.guesses.filter((g) => g.pid === me && !g.correct).map((g) => g.text);
  const base = pack.items.filter((i) => !others.has(i.name) && !wrong.some((w) => matchesItem(w, i)));
  const mine = v.qlog.filter((q) => q.pid === me && q.result).map((q) => ({ text: q.text, answer: q.result! }));
  return consistent(pack, base, mine);
}

function think(v: FView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.round}-${v.current}-${v.qlog.length}-${v.guesses.length}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  const pack = packFor(api.packs, v.packId);
  if (!pack) return;
  if (v.phase === 'answer' && v.needs.includes(me) && v.question) {
    if (!aiReady(api, mem, thinkMs(api, { facile: [1500, 4000], normal: [1200, 3000], difficile: [900, 2500] }))) return;
    const card = v.cards[v.question.pid];
    const item = pack.items.find((i) => i.name === card?.name);
    const a = item ? answerQuestion(item, pack, v.question.text) : 'peut-être';
    api.act({ type: 'answer', value: a === 'peut-être' ? 'nsp' : a });
    if (a === 'peut-être' && aiChance(api, 0.3)) aiSay(api, mem, pickLine(api, ['Question difficile, je ne sais pas trop 🤷', 'Hmm, pas sûr pour celle-là.']), 1);
    return;
  }
  if (v.current !== me) return;
  const cands = myCandidates(v, api);
  if (v.phase === 'ask') {
    if (!aiReady(api, mem, thinkMs(api, { facile: [3000, 6000], normal: [2500, 5000], difficile: [2000, 4000] }))) return;
    const asked = v.qlog.filter((q) => q.pid === me).map((q) => q.text);
    const exclude = askedTags(pack, cands, asked);
    let tag: string | null = null;
    if (api.difficulty === 'facile' && api.rng.chance(0.35)) {
      const pool = pack.attributes.filter((x) => !exclude.has(x.tag));
      if (pool.length) tag = api.rng.pick(pool).tag;
    }
    tag ??= bestSplitTag(cands, exclude);
    if (!tag || cands.length === 1) return api.act({ type: 'guess', text: cands[0]?.name ?? pack.items[0].name });
    const q = questionForTag(pack, tag);
    if (asked.some((t) => norm(t) === norm(q))) return api.act({ type: 'guess', text: api.rng.pick(cands).name });
    if (aiChance(api, 0.2)) aiSay(api, mem, pickLine(api, ['Alors, voyons voir…', 'Soyez honnêtes hein 😅', 'Je crois savoir ce que je vais demander.']), 1);
    return api.act({ type: 'ask', text: q });
  }
  if (v.phase === 'guess') {
    if (!aiReady(api, mem, thinkMs(api, { facile: [2000, 4000], normal: [1500, 3500], difficile: [1200, 3000] }))) return;
    const threshold = byDiff(api, { facile: 1, normal: 2, difficile: 2 });
    const turnsLeft = v.maxRounds - v.round;
    // plus assez de questions pour tout départager : on tente sa chance
    const hopeless = cands.length > Math.pow(2, turnsLeft) && turnsLeft <= 2;
    if (cands.length && (cands.length <= threshold || hopeless || (turnsLeft === 0 && cands.length <= 12))) {
      const pick = api.difficulty === 'difficile' ? cands[0] : api.rng.pick(cands);
      if (aiChance(api, 0.4)) aiSay(api, mem, pickLine(api, ['Je crois que je sais !', 'Ça doit être ça…', 'Allez, je tente !']), 1);
      return api.act({ type: 'guess', text: pick.name });
    }
    if (aiChance(api, 0.2)) aiSay(api, mem, pickLine(api, [`Il me reste encore ${cands.length} possibilités…`, 'Pas encore sûr, je passe.']), 1);
    return api.act({ type: 'pass' });
  }
}

export const front: GameModule<FState, FView> = {
  id: 'front',
  name: 'Carte sur le front',
  family: 'devine',
  emoji: '🤔',
  tagline: 'Tout le monde voit ta carte… sauf toi !',
  rules: [
    'Chaque joueur reçoit une carte que tous les autres voient, mais pas lui.',
    'À ton tour, pose UNE question oui/non sur ta carte : les autres répondent (la majorité l’emporte).',
    'Ensuite tu peux tenter de deviner ou passer.',
    'Le premier à trouver marque le plus de points (5, puis 4, 3…). Bonus au premier tour.',
    'La partie s’arrête quand tout le monde a trouvé ou après le nombre de tours maximum.'
  ],
  minPlayers: 2,
  maxPlayers: 10,
  usesThemes: true,
  options: [
    { key: 'maxRounds', label: 'Tours de table maximum', type: 'number', min: 1, max: 20, default: 8 },
    { key: 'askSec', label: 'Temps pour poser la question (s)', type: 'number', min: 15, max: 180, step: 5, default: 60, advanced: true },
    { key: 'answerSec', label: 'Temps pour répondre / deviner (s)', type: 'number', min: 10, max: 120, step: 5, default: 30, advanced: true }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai: { think },
  Board: FrontBoard
};
