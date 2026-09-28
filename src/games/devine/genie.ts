// 🧞 Le Génie devin : un « penseur » choisit un élément en secret, le Génie (l'appli)
// pose des questions oui / non / je ne sais pas et tente de le deviner.
import type { AgentAPI, AgentMind, BaseState, BaseView, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { bestSplitTag, matchesItem, questionForTag } from '../../content';
import { activeIds, aiChance, aiEnd, aiMem, aiReady, aiSay, choosePack, copyItem, finish, itemIn, mini, nameOf, num, packFor, pickLine, sec, thinkMs, zeroScores, type MiniItem } from './common';
import { GenieBoard } from './GenieBoard';

export type GAnswer = 'oui' | 'non' | 'nsp';

export interface GQ {
  q: string;
  tag: string;
  a: GAnswer;
}

export interface GRound {
  penseur: string;
  item: string;
  emoji: string;
  genieWon: boolean;
  questions: number;
}

export interface GState extends BaseState {
  phase: 'pick' | 'ask' | 'propose' | 'reveal' | 'end';
  round: number;
  rounds: number;
  order: string[];
  penseur: string;
  maxQ: number;
  answerMs: number;
  packId: string;
  packName: string;
  packEmoji: string;
  list: MiniItem[];
  secret: Item | null;
  free: boolean;
  cands: string[];
  asked: string[];
  qlog: GQ[];
  question: { q: string; tag: string } | null;
  proposal: string | null;
  rejected: string[];
  count: number;
  predictions: Record<string, 'genie' | 'penseur'>;
  genieWon: boolean | null;
  revealText: string | null;
  mood: string;
  history: GRound[];
}

export interface GView extends BaseView {
  phase: GState['phase'];
  round: number;
  rounds: number;
  penseur: string;
  maxQ: number;
  count: number;
  packName: string;
  packEmoji: string;
  /** Liste à choisir (seulement pour le penseur pendant le choix). */
  list: MiniItem[];
  /** Secret du penseur (seulement pour lui, ou à la fin de la manche). */
  secret: { name: string; emoji: string; tags: string[] } | null;
  free: boolean;
  candCount: number;
  qlog: GQ[];
  question: { q: string; tag: string } | null;
  proposal: { name: string; emoji: string } | null;
  rejected: string[];
  predictions: Record<string, 'genie' | 'penseur'>;
  canPredict: boolean;
  genieWon: boolean | null;
  revealText: string | null;
  mood: string;
  history: GRound[];
}

const PREDICT_UNTIL = 5;

const MOODS_THINK = ['🧞 Hmm… je sens une présence…', '🧞 Les étoiles me murmurent quelque chose…', '🧞 Ma lampe s’illumine…', '🧞 Intéressant… très intéressant…', '🧞 Je lis dans tes pensées…', '🧞 Ne me cache rien, humain !'];
const MOODS_CLOSE = ['🧞 J’y suis presque !', '🧞 Je le vois… il se dessine dans la fumée…', '🧞 Encore un effort et ton secret est à moi !'];
const MOODS_LOST = ['🧞 Tes réponses me troublent…', '🧞 Aurais-tu choisi quelque chose d’étrange ?', '🧞 Ma boule de cristal est embuée…'];

function startRound(s: GState, ctx: RuntimeCtx) {
  const pack = choosePack(ctx.packs, ctx.rng, 10);
  s.penseur = s.order[(s.round - 1) % s.order.length];
  s.packId = pack.id;
  s.packName = pack.name;
  s.packEmoji = pack.emoji;
  s.list = pack.items.map(mini).sort((a, b) => a.name.localeCompare(b.name));
  s.secret = null;
  s.free = false;
  s.cands = pack.items.map((i) => i.name);
  s.asked = [];
  s.qlog = [];
  s.question = null;
  s.proposal = null;
  s.rejected = [];
  s.count = 0;
  s.predictions = {};
  s.genieWon = null;
  s.revealText = null;
  s.mood = '🧞 Pense très fort à ton choix…';
  s.phase = 'pick';
  s.deadline = ctx.now + 60_000;
  ctx.announce(`${s.rounds > 1 ? `Manche ${s.round}/${s.rounds} — ` : ''}🧞 ${nameOf(ctx, s.penseur)} choisit en secret quelque chose du thème ${pack.emoji} ${pack.name}. Le Génie va tenter de le deviner !`);
}

function genieNext(s: GState, ctx: RuntimeCtx) {
  const pack = packFor(ctx.packs, s.packId);
  const items = (pack?.items ?? []).filter((i) => s.cands.includes(i.name));
  if (s.count >= s.maxQ || !items.length) return roundOver(s, ctx, false);
  const tag = items.length > 2 ? bestSplitTag(items, new Set(s.asked)) : null;
  if (!tag || s.maxQ - s.count <= 1) {
    // propose le plus « typique » (celui qui partage le plus de tags avec les autres)
    const pick = items.length === 1 ? items[0] : ctx.rng.pick(items.slice(0, Math.min(items.length, 2)));
    s.proposal = pick.name;
    s.question = null;
    s.phase = 'propose';
    s.count++;
    s.mood = items.length <= 2 ? ctx.rng.pick(MOODS_CLOSE) : '🧞 Je tente le tout pour le tout…';
    s.deadline = ctx.now + s.answerMs;
    ctx.announce(`🧞 Je le vois ! Est-ce… « ${pick.name} » ${pick.emoji} ?`);
    return;
  }
  s.question = { q: questionForTag(pack, tag), tag };
  s.phase = 'ask';
  s.deadline = ctx.now + s.answerMs;
  if (s.count > 0 && s.count % 5 === 0) {
    s.mood = items.length > 20 ? ctx.rng.pick(MOODS_LOST) : ctx.rng.pick(MOODS_THINK);
    ctx.announce(s.mood);
  } else if (s.count === 0) s.mood = ctx.rng.pick(MOODS_THINK);
}

function roundOver(s: GState, ctx: RuntimeCtx, genieWon: boolean) {
  s.phase = 'reveal';
  s.genieWon = genieWon;
  s.question = null;
  const pen = s.penseur;
  if (genieWon) {
    const pts = Math.floor(s.count / 4);
    s.scores[pen] = (s.scores[pen] ?? 0) + pts;
    ctx.announce(`🧞 HA HA ! Le Génie a lu dans les pensées de ${nameOf(ctx, pen)} en ${s.count} question${s.count > 1 ? 's' : ''} !${pts ? ` (${nameOf(ctx, pen)} marque quand même ${pts} pt${pts > 1 ? 's' : ''} pour la résistance)` : ''}`);
  } else {
    s.scores[pen] = (s.scores[pen] ?? 0) + 5;
    s.mood = '🧞 Impossible… tu m’as battu !';
    ctx.announce(`🧞 Je donne ma langue au chat… ${nameOf(ctx, pen)} a vaincu le Génie : +5 points !`);
  }
  for (const [pid, bet] of Object.entries(s.predictions)) {
    if ((bet === 'genie') === genieWon) s.scores[pid] = (s.scores[pid] ?? 0) + 2;
  }
  if (genieWon && s.proposal) s.revealText = s.proposal;
  else if (s.secret) s.revealText = s.secret.name;
  s.history.push({
    penseur: pen,
    item: s.revealText ?? '(secret)',
    emoji: s.secret?.emoji ?? (genieWon && s.proposal ? itemIn(packFor(ctx.packs, s.packId), s.proposal)?.emoji ?? '❔' : '❔'),
    genieWon,
    questions: s.count
  });
  s.deadline = ctx.now + (s.free && !genieWon ? 25_000 : 8000);
}

function nextRound(s: GState, ctx: RuntimeCtx) {
  if (s.round >= s.rounds) {
    const g = s.history.filter((h) => h.genieWon).length;
    const lines = s.history.map((h, i) => `${i + 1}. ${nameOf(ctx, h.penseur)} : ${h.emoji} ${h.item} — ${h.genieWon ? `deviné en ${h.questions} q.` : 'le Génie a échoué'}`);
    return finish(s, ctx, s.order, `🧞 Le Génie a trouvé ${g}/${s.history.length} fois.\n${lines.join('\n')}`);
  }
  s.round++;
  startRound(s, ctx);
}

function setup(ctx: RuntimeCtx): GState {
  const o = ctx.options;
  const order = ctx.rng.shuffle(activeIds(ctx));
  const s: GState = {
    phase: 'pick',
    scores: zeroScores(ctx),
    round: 1,
    rounds: num(o, 'rounds', Math.min(order.length, 3), 1, 12),
    order,
    penseur: order[0],
    maxQ: num(o, 'maxQuestions', 20, 8, 40),
    answerMs: sec(o, 'answerSec', 60),
    packId: '',
    packName: '',
    packEmoji: '',
    list: [],
    secret: null,
    free: false,
    cands: [],
    asked: [],
    qlog: [],
    question: null,
    proposal: null,
    rejected: [],
    count: 0,
    predictions: {},
    genieWon: null,
    revealText: null,
    mood: '',
    history: []
  };
  startRound(s, ctx);
  return s;
}

function beginAsking(s: GState, ctx: RuntimeCtx) {
  ctx.announce(`🧞 ${nameOf(ctx, s.penseur)} a fait son choix. Que la lecture des pensées commence ! (Les autres : pariez sur le gagnant 🎲)`);
  genieNext(s, ctx);
}

function onAction(s: GState, pid: string, a: { type: string; [k: string]: any }, ctx: RuntimeCtx) {
  const pack = packFor(ctx.packs, s.packId);
  switch (a.type) {
    case 'pick': {
      if (s.phase !== 'pick' || pid !== s.penseur) return;
      if (a.free) {
        s.free = true;
        s.secret = null;
      } else {
        const it = itemIn(pack, String(a.name ?? ''));
        if (!it) return;
        s.secret = copyItem(it);
        s.free = false;
      }
      return beginAsking(s, ctx);
    }
    case 'answer': {
      if (s.phase !== 'ask' || pid !== s.penseur || !s.question) return;
      const v: GAnswer = a.value === 'oui' ? 'oui' : a.value === 'non' ? 'non' : 'nsp';
      const tag = s.question.tag;
      s.qlog.push({ q: s.question.q, tag, a: v });
      s.asked.push(tag);
      s.count++;
      if (v !== 'nsp' && pack) {
        const has = new Set(pack.items.filter((i) => i.tags.includes(tag)).map((i) => i.name));
        s.cands = s.cands.filter((n) => (v === 'oui' ? has.has(n) : !has.has(n)));
      }
      return genieNext(s, ctx);
    }
    case 'confirm': {
      if (s.phase !== 'propose' || pid !== s.penseur || !s.proposal) return;
      if (a.correct) return roundOver(s, ctx, true);
      s.rejected.push(s.proposal);
      s.cands = s.cands.filter((n) => n !== s.proposal);
      ctx.announce(pickRandom(ctx, ['🧞 Quoi ?! Non ? Laisse-moi réfléchir encore…', '🧞 Grrr… Je ne m’avoue pas vaincu !', '🧞 Presque… je continue !']));
      s.proposal = null;
      return genieNext(s, ctx);
    }
    case 'predict': {
      if (pid === s.penseur || s.predictions[pid] || !canPredict(s) || !s.order.includes(pid)) return;
      s.predictions[pid] = a.bet === 'penseur' ? 'penseur' : 'genie';
      return;
    }
    case 'reveal': {
      if (s.phase !== 'reveal' || pid !== s.penseur || !s.free || s.genieWon) return;
      const t = String(a.text ?? '').trim().slice(0, 60);
      if (!t) return;
      s.revealText = t;
      s.history[s.history.length - 1].item = t;
      ctx.announce(`${nameOf(ctx, pid)} pensait à : « ${t} » !`);
      s.deadline = Math.min(s.deadline ?? ctx.now, ctx.now + 6000);
      return;
    }
    case 'next': {
      if (s.phase === 'reveal') nextRound(s, ctx);
      return;
    }
  }
}

function pickRandom(ctx: RuntimeCtx, l: string[]) {
  return ctx.rng.pick(l);
}

function canPredict(s: GState): boolean {
  return (s.phase === 'pick' || s.phase === 'ask' || s.phase === 'propose') && s.count < PREDICT_UNTIL;
}

function onTick(s: GState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  const pack = packFor(ctx.packs, s.packId);
  switch (s.phase) {
    case 'pick': {
      const it = ctx.rng.pick(pack?.items ?? []);
      if (it) s.secret = copyItem(it);
      else s.free = true;
      ctx.announce('⏱️ Temps écoulé : le Génie choisit à ta place… en fermant les yeux, promis 🙈');
      return beginAsking(s, ctx);
    }
    case 'ask':
      return onAction(s, s.penseur, { type: 'answer', value: 'nsp' }, ctx);
    case 'propose':
      return onAction(s, s.penseur, { type: 'confirm', correct: false }, ctx);
    case 'reveal':
      return nextRound(s, ctx);
  }
}

function view(s: GState, pid: string | null): GView {
  const isPen = pid === s.penseur;
  const needs: string[] = [];
  if (s.phase === 'pick' || s.phase === 'ask' || s.phase === 'propose') needs.push(s.penseur);
  if (s.phase === 'reveal' && s.free && !s.genieWon && !s.revealText) needs.push(s.penseur);
  // les parieurs potentiels viennent après le penseur (pass-and-play : le penseur d'abord)
  if (canPredict(s)) needs.push(...s.order.filter((id) => id !== s.penseur && !s.predictions[id]));
  const showSecret = isPen || s.phase === 'reveal' || s.phase === 'end';
  const proposalItem = s.proposal ? s.list.find((i) => i.name === s.proposal) ?? { name: s.proposal, emoji: '❔' } : null;
  return {
    phase: s.phase,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    round: s.round,
    rounds: s.rounds,
    penseur: s.penseur,
    maxQ: s.maxQ,
    count: s.count,
    packName: s.packName,
    packEmoji: s.packEmoji,
    list: isPen && s.phase === 'pick' ? s.list : [],
    secret: showSecret && s.secret ? { name: s.secret.name, emoji: s.secret.emoji, tags: isPen ? s.secret.tags : [] } : null,
    free: s.free,
    candCount: s.cands.length,
    qlog: s.qlog,
    question: s.question,
    proposal: proposalItem,
    rejected: s.rejected,
    predictions: s.phase === 'reveal' || s.phase === 'end' ? s.predictions : Object.fromEntries(Object.keys(s.predictions).map((k) => [k, k === pid ? s.predictions[k] : ('?' as any)])),
    canPredict: canPredict(s) && !!pid && pid !== s.penseur && s.order.includes(pid) && !s.predictions[pid],
    genieWon: s.genieWon,
    revealText: s.revealText,
    mood: s.mood,
    history: s.history
  };
}

// ---------- IA ----------

function think(v: GView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.round}-${v.count}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  // Pari (spectateur)
  if (v.canPredict && !mind.mem[`bet${v.round}`]) {
    mind.mem[`bet${v.round}`] = true;
    const bet = api.rng.chance(v.free ? 0.35 : 0.7) ? 'genie' : 'penseur';
    api.act({ type: 'predict', bet });
    if (aiChance(api, 0.3)) aiSay(api, mem, bet === 'genie' ? pickLine(api, ['Le Génie va le trouver, facile.', 'Je parie sur la lampe 🧞']) : pickLine(api, ['Le Génie va se casser les dents 😏', 'Je parie sur le penseur !']), 1);
    return;
  }
  if (v.penseur !== me) {
    if (v.phase === 'reveal' && aiChance(api, 0.15)) aiSay(api, mem, v.genieWon ? pickLine(api, ['Ce génie est flippant 😳', 'Comment il a fait ?!']) : pickLine(api, ['Bien joué, le génie s’est fait avoir !', 'Haha, raté le génie !']), 1);
    return;
  }
  switch (v.phase) {
    case 'pick': {
      if (!aiReady(api, mem, thinkMs(api, { facile: [2000, 4000], normal: [2000, 5000], difficile: [3000, 6000] }))) return;
      const pool = v.list;
      if (!pool.length) return api.act({ type: 'pick', free: true });
      api.act({ type: 'pick', name: api.rng.pick(pool).name });
      if (aiChance(api, 0.6)) aiSay(api, mem, pickLine(api, ['C’est bon, j’ai choisi ! Bonne chance, Génie 😏', 'Choisi. Tu ne trouveras jamais !', 'J’ai une idée en tête…']), 1);
      return;
    }
    case 'ask': {
      if (!v.question || !v.secret) return;
      if (!aiReady(api, mem, thinkMs(api, { facile: [1200, 2500], normal: [1000, 2200], difficile: [900, 2000] }))) return;
      api.act({ type: 'answer', value: v.secret.tags.includes(v.question.tag) ? 'oui' : 'non' });
      return;
    }
    case 'propose': {
      if (!v.proposal || !v.secret) return;
      if (!aiReady(api, mem, thinkMs(api, { facile: [1500, 2500], normal: [1500, 2500], difficile: [1500, 2500] }))) return;
      const ok = v.proposal.name === v.secret.name || matchesItem(v.proposal.name, { name: v.secret.name, emoji: '', tags: [], clues: [] });
      api.act({ type: 'confirm', correct: ok });
      if (aiChance(api, 0.5)) aiSay(api, mem, ok ? pickLine(api, ['Argh… oui, c’est ça 😩', 'Bravo le Génie…']) : pickLine(api, ['Non ! Raté 😎', 'Perdu, cherche encore !']), 1);
      return;
    }
  }
}

export const genie: GameModule<GState, GView> = {
  id: 'genie',
  name: 'Le Génie devin',
  family: 'devine',
  emoji: '🧞',
  tagline: 'Pense à quelque chose… le Génie va lire dans tes pensées !',
  rules: [
    'Le penseur choisit secrètement un élément dans la liste du thème (ou « hors liste » pour un défi).',
    'Le Génie pose des questions : réponds Oui, Non ou Je ne sais pas, honnêtement !',
    'Quand il pense avoir trouvé, il propose une réponse. Si c’est faux, il continue.',
    'Si le Génie échoue avant la limite de questions, le penseur gagne 5 points.',
    'Les autres joueurs parient au début : le Génie va-t-il trouver ? (+2 si bon pari)',
    'Le rôle de penseur tourne à chaque manche.'
  ],
  minPlayers: 1,
  maxPlayers: 10,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Manches (le penseur tourne)', type: 'number', min: 1, max: 12, default: 3 },
    { key: 'maxQuestions', label: 'Questions max du Génie', type: 'number', min: 8, max: 40, default: 20 },
    { key: 'answerSec', label: 'Temps pour répondre (s)', type: 'number', min: 15, max: 180, step: 5, default: 60, advanced: true }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai: { think },
  Board: GenieBoard
};
