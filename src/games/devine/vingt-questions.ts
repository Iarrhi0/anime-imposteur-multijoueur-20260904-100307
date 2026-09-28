// 🧠 Devine mon personnage : un oracle neutre (l'appli) a choisi un élément secret.
// Chacun son tour, les joueurs posent une question oui/non ou tentent une réponse.
import type { AgentAPI, BaseState, BaseView, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { answerQuestion, bestSplitTag, matchesItem, questionForTag } from '../../content';
import { norm } from '../../core/text';
import { activeIds, aiChance, aiEnd, aiMem, aiReady, aiSay, askedTags, byDiff, choosePack, copyItem, finish, isGuessOf, nameOf, num, packFor, pickLine, sec, strictFilter, suggest, thinkMs, zeroScores, type Answer } from './common';
import { VingtBoard } from './VingtBoard';

export interface VQEntry {
  pid: string;
  kind: 'q' | 'guess' | 'pass';
  text: string;
  answer: Answer | 'correct' | 'faux' | 'passe';
}

export interface VQHistory {
  name: string;
  emoji: string;
  finder: string | null;
  used: number;
  pts: number;
}

export interface VQState extends BaseState {
  phase: 'play' | 'reveal' | 'end';
  round: number;
  rounds: number;
  maxQ: number;
  turnMs: number;
  order: string[];
  turn: number;
  packId: string;
  packName: string;
  packEmoji: string;
  poolSize: number;
  secret: Item;
  log: VQEntry[];
  used: number;
  suggestions: string[];
  finder: string | null;
  lastPts: number;
  history: VQHistory[];
}

export interface VQView extends BaseView {
  phase: VQState['phase'];
  round: number;
  rounds: number;
  maxQ: number;
  used: number;
  current: string | null;
  order: string[];
  packId: string;
  packName: string;
  packEmoji: string;
  poolSize: number;
  log: VQEntry[];
  suggestions: string[];
  finder: string | null;
  lastPts: number;
  secret: { name: string; emoji: string } | null;
  history: VQHistory[];
}

function startRound(s: VQState, ctx: RuntimeCtx) {
  const pack = choosePack(ctx.packs, ctx.rng, 8);
  const item = ctx.rng.pick(pack.items);
  s.packId = pack.id;
  s.packName = pack.name;
  s.packEmoji = pack.emoji;
  s.poolSize = pack.items.length;
  s.secret = copyItem(item);
  s.log = [];
  s.used = 0;
  s.finder = null;
  s.lastPts = 0;
  s.turn = (s.round - 1) % s.order.length;
  s.phase = 'play';
  s.deadline = ctx.now + s.turnMs;
  s.suggestions = suggest(pack, pack.items, []);
  ctx.announce(
    `${s.rounds > 1 ? `Manche ${s.round}/${s.rounds} — ` : ''}🔮 L’oracle pense à quelque chose du thème ${pack.emoji} ${pack.name}. ${s.maxQ} questions maximum ! ${nameOf(ctx, s.order[s.turn])} commence.`
  );
}

function current(s: VQState): string | null {
  return s.phase === 'play' ? s.order[s.turn] ?? null : null;
}

function nextTurn(s: VQState, ctx: RuntimeCtx) {
  if (s.used >= s.maxQ) return roundOver(s, ctx, null);
  s.turn = (s.turn + 1) % s.order.length;
  s.deadline = ctx.now + s.turnMs;
  const left = s.maxQ - s.used;
  if (left === 5 || left === 1) ctx.announce(left === 1 ? '⚠️ Dernière question !' : 'Plus que 5 questions…');
}

function refreshSuggestions(s: VQState, ctx: RuntimeCtx) {
  const pack = packFor(ctx.packs, s.packId);
  if (!pack) return;
  const qa = s.log.filter((e) => e.kind === 'q').map((e) => ({ text: e.text, answer: e.answer }));
  let cands = strictFilter(pack, pack.items, qa).filter((i) => !s.log.some((e) => e.kind === 'guess' && matchesItem(e.text, i)));
  if (!cands.length) cands = pack.items;
  s.suggestions = suggest(pack, cands, s.log.map((e) => e.text));
}

function roundOver(s: VQState, ctx: RuntimeCtx, finder: string | null) {
  s.phase = 'reveal';
  s.finder = finder;
  let pts = 0;
  if (finder) {
    pts = 3 + Math.round((7 * (s.maxQ - s.used)) / s.maxQ);
    s.scores[finder] = (s.scores[finder] ?? 0) + pts;
    ctx.announce(`🎉 ${nameOf(ctx, finder)} a trouvé « ${s.secret.name} » ${s.secret.emoji} en ${s.used} question${s.used > 1 ? 's' : ''} : +${pts} points !`);
  } else {
    ctx.announce(`🔮 L’oracle gagne cette manche ! C’était « ${s.secret.name} » ${s.secret.emoji}.`);
  }
  s.lastPts = pts;
  s.history.push({ name: s.secret.name, emoji: s.secret.emoji, finder, used: s.used, pts });
  s.deadline = ctx.now + 7000;
}

function nextRound(s: VQState, ctx: RuntimeCtx) {
  if (s.round >= s.rounds) {
    const lines = s.history.map((h, i) => `Manche ${i + 1} : ${h.emoji} ${h.name} — ${h.finder ? `trouvé par ${nameOf(ctx, h.finder)} (${h.used} questions)` : 'personne n’a trouvé'}`);
    return finish(s, ctx, s.order, lines.join('\n'));
  }
  s.round++;
  startRound(s, ctx);
}

function setup(ctx: RuntimeCtx): VQState {
  const o = ctx.options;
  const order = ctx.rng.shuffle(activeIds(ctx));
  const s: VQState = {
    phase: 'play',
    scores: zeroScores(ctx),
    round: 1,
    rounds: num(o, 'rounds', 2, 1, 10),
    maxQ: num(o, 'maxQuestions', 20, 5, 40),
    turnMs: sec(o, 'turnSec', 45),
    order,
    turn: 0,
    packId: '',
    packName: '',
    packEmoji: '',
    poolSize: 0,
    secret: { name: '', emoji: '', tags: [], clues: [] },
    log: [],
    used: 0,
    suggestions: [],
    finder: null,
    lastPts: 0,
    history: []
  };
  startRound(s, ctx);
  return s;
}

function onAction(s: VQState, pid: string, a: { type: string; [k: string]: any }, ctx: RuntimeCtx) {
  if (a.type === 'next') {
    if (s.phase === 'reveal') nextRound(s, ctx);
    return;
  }
  if (s.phase !== 'play' || current(s) !== pid) return;
  const text = String(a.text ?? '').trim().slice(0, 140);
  if (!text) return;
  const pack = packFor(ctx.packs, s.packId);
  if (a.type === 'ask') {
    if (isGuessOf(text, s.secret)) {
      s.used++;
      s.log.push({ pid, kind: 'guess', text, answer: 'correct' });
      return roundOver(s, ctx, pid);
    }
    const answer = answerQuestion(s.secret, pack, text);
    s.log.push({ pid, kind: 'q', text, answer });
    // « je ne sais pas » ne coûte pas de question
    if (answer !== 'peut-être') s.used++;
    refreshSuggestions(s, ctx);
    return nextTurn(s, ctx);
  }
  if (a.type === 'guess') {
    s.used++;
    if (matchesItem(text, s.secret)) {
      s.log.push({ pid, kind: 'guess', text, answer: 'correct' });
      return roundOver(s, ctx, pid);
    }
    s.log.push({ pid, kind: 'guess', text, answer: 'faux' });
    refreshSuggestions(s, ctx);
    return nextTurn(s, ctx);
  }
}

function onTick(s: VQState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'play') {
    const pid = current(s)!;
    s.used++;
    s.log.push({ pid, kind: 'pass', text: '⏱️ Temps écoulé', answer: 'passe' });
    nextTurn(s, ctx);
  } else if (s.phase === 'reveal') nextRound(s, ctx);
}

function view(s: VQState, pid: string | null): VQView {
  const cur = current(s);
  return {
    phase: s.phase,
    needs: cur ? [cur] : [],
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    round: s.round,
    rounds: s.rounds,
    maxQ: s.maxQ,
    used: s.used,
    current: cur,
    order: s.order,
    packId: s.packId,
    packName: s.packName,
    packEmoji: s.packEmoji,
    poolSize: s.poolSize,
    log: s.log,
    suggestions: cur && cur === pid ? s.suggestions : s.suggestions.slice(0, 4),
    finder: s.finder,
    lastPts: s.lastPts,
    secret: s.phase === 'play' ? null : { name: s.secret.name, emoji: s.secret.emoji },
    history: s.history
  };
}

// ---------- IA ----------

function candidates(v: VQView, api: AgentAPI): Item[] {
  const pack = packFor(api.packs, v.packId);
  if (!pack) return [];
  const qa = v.log.filter((e) => e.kind === 'q').map((e) => ({ text: e.text, answer: e.answer }));
  const wrong = v.log.filter((e) => e.kind === 'guess' && e.answer === 'faux').map((e) => e.text);
  const notWrong = (i: Item) => !wrong.some((w) => matchesItem(w, i));
  const c = strictFilter(pack, pack.items, qa).filter(notWrong);
  return c.length ? c : pack.items.filter(notWrong);
}

function think(v: VQView, mind: Parameters<GameModule['ai']['think']>[1], api: AgentAPI) {
  const mem = aiMem(mind, `${v.phase}-${v.round}-${v.used}-${v.log.length}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  if (v.phase === 'reveal') {
    if (v.finder === api.me.id && aiChance(api, 0.6)) aiSay(api, mem, pickLine(api, ['Trop facile 😎', 'Je le sentais !', 'Et hop !']), 1);
    return;
  }
  if (v.current !== api.me.id) return;
  const pack = packFor(api.packs, v.packId);
  if (!pack) return;
  if (!aiReady(api, mem, thinkMs(api, { facile: [3000, 6000], normal: [2200, 4500], difficile: [1500, 3200] }))) return;
  const cands = candidates(v, api);
  const left = v.maxQ - v.used;
  const threshold = byDiff(api, { facile: 1, normal: 2, difficile: 2 });
  const asked = v.log.map((e) => e.text);
  const exclude = askedTags(pack, cands, asked);
  let tag: string | null = null;
  if (api.difficulty === 'facile' && api.rng.chance(0.35)) {
    const pool = pack.attributes.filter((a) => !exclude.has(a.tag));
    if (pool.length) tag = api.rng.pick(pool).tag;
  }
  tag ??= bestSplitTag(cands, exclude);
  const mustGuess = cands.length <= threshold || left <= 1 || !tag || (cands.length <= 3 && left <= 3);
  if (mustGuess) {
    const pick = api.difficulty === 'facile' ? api.rng.pick(cands) : cands[api.rng.int(0, Math.min(cands.length, 2) - 1)];
    if (cands.length > 3 && aiChance(api, 0.5)) aiSay(api, mem, pickLine(api, ['Bon, je tente un coup…', 'Au pif !', 'Allez, un essai.']), 1);
    api.act({ type: 'guess', text: pick.name });
    return;
  }
  const q = questionForTag(pack, tag!);
  if (asked.some((t) => norm(t) === norm(q))) {
    api.act({ type: 'guess', text: api.rng.pick(cands).name });
    return;
  }
  if (cands.length <= 6 && aiChance(api, 0.25)) aiSay(api, mem, pickLine(api, ['On se rapproche…', 'J’ai une petite idée 🤔', 'Il reste peu de possibilités.']), 1);
  api.act({ type: 'ask', text: q });
}

export const vingtQuestions: GameModule<VQState, VQView> = {
  id: 'vingt-questions',
  name: 'Devine mon personnage',
  family: 'devine',
  emoji: '🧠',
  tagline: 'L’oracle a choisi en secret : trouvez-le en 20 questions oui/non !',
  rules: [
    'L’oracle choisit secrètement un élément du thème (personnage, animal, film…).',
    'Chacun son tour, pose UNE question fermée (réponse oui / non) ou tente une réponse.',
    'Les questions suggérées sont celles qui coupent le mieux les possibilités restantes.',
    '20 questions maximum au total (réponses comprises) : plus vite tu trouves, plus tu marques.',
    'Si personne ne trouve, l’oracle gagne la manche.'
  ],
  minPlayers: 1,
  maxPlayers: 10,
  usesThemes: true,
  options: [
    { key: 'maxQuestions', label: 'Questions maximum', type: 'number', min: 5, max: 40, step: 1, default: 20 },
    { key: 'rounds', label: 'Manches', type: 'number', min: 1, max: 10, default: 2 },
    { key: 'turnSec', label: 'Temps par tour (s)', type: 'number', min: 15, max: 120, step: 5, default: 45, advanced: true }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '🧠', desc: '20 questions, 2 manches', options: { maxQuestions: 20, rounds: 2 } },
    { id: 'eclair', label: 'Éclair', emoji: '⚡', desc: '10 questions seulement', options: { maxQuestions: 10, rounds: 3, turnSec: 25 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai: { think },
  Board: VingtBoard
};
