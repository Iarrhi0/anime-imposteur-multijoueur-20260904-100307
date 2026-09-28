// ⚔️ Qui gagnerait ? Deux éléments proches s'affrontent, le groupe vote.
import { joinNames } from '../../core/text';
import type { AgentMind, AIStrategy, BaseState, BaseView, GameAction, GameModule, RuntimeCtx } from '../../core/types';
import { line, personality } from '../../ai/personalities';
import { activeIds, aiMem, initScores, nameOf, newChat, secs, type ItemRef } from '../kit';
import { argumentFor, pickPairs, POWER, powerOf, taste, textMentions } from './duel-kit';
import { QuiGagneraitBoard } from './QuiGagneraitBoard';

export type Side = 'a' | 'b';

export interface QGRound {
  a: ItemRef;
  b: ItemRef;
  question: string;
  votes: Record<string, Side>;
  winner?: Side | 'tie';
}

export interface QGState extends BaseState {
  phase: 'vote' | 'reveal' | 'end';
  active: string[];
  rounds: QGRound[];
  idx: number;
  opts: Record<string, any>;
}

export interface QGView extends BaseView {
  phase: QGState['phase'];
  active: string[];
  idx: number;
  total: number;
  round: Omit<QGRound, 'votes'> | null;
  voted: string[];
  myVote?: Side;
  votes?: Record<string, Side>;
  debate: boolean;
  history: { a: string; b: string; aEmoji: string; bEmoji: string; winner?: Side | 'tie'; na: number; nb: number }[];
}

function questionFor(category: string): string {
  if (['anime', 'films', 'series', 'dessins-animes', 'jeux-video', 'super-heros', 'histoire'].includes(category)) return 'Qui gagnerait dans un combat ?';
  if (category === 'sport') return 'Qui gagnerait en duel ?';
  if (category === 'animaux') return 'Qui gagnerait dans la nature ?';
  if (category === 'celebrites' || category === 'musique') return 'Qui gagnerait un concours de popularité ?';
  if (category === 'nourriture') return 'Lequel gagnerait un concours de goût ?';
  if (category === 'marques') return 'Laquelle gagnerait la guerre des marques ?';
  return 'Lequel gagnerait le duel ?';
}

function setup(ctx: RuntimeCtx): QGState {
  const n = Math.max(3, Math.min(20, Number(ctx.options.rounds ?? 8) || 8));
  const pairs = pickPairs(ctx.packs, ctx.rng, n);
  const s: QGState = {
    phase: 'vote',
    active: activeIds(ctx),
    rounds: pairs.map((p) => ({ a: p.a, b: p.b, question: questionFor(p.category), votes: {} })),
    idx: 0,
    scores: initScores(ctx),
    opts: { ...ctx.options }
  };
  if (!s.rounds.length) {
    s.phase = 'end';
    s.winners = [];
    s.summary = 'Pas assez d’éléments dans les thèmes choisis.';
    return s;
  }
  startRound(s, ctx);
  return s;
}

function startRound(s: QGState, ctx: RuntimeCtx) {
  const r = s.rounds[s.idx];
  s.phase = 'vote';
  s.deadline = ctx.now + secs(s.opts, 'voteSec', 25);
  ctx.announce(`⚔️ Duel ${s.idx + 1} : ${r.a.emoji.split(' ')[0]} ${r.a.name} contre ${r.b.name} ${r.b.emoji.split(' ')[0]} — ${r.question}`);
}

function resolve(s: QGState, ctx: RuntimeCtx) {
  const r = s.rounds[s.idx];
  const na = Object.values(r.votes).filter((x) => x === 'a').length;
  const nb = Object.values(r.votes).filter((x) => x === 'b').length;
  r.winner = na === nb ? 'tie' : na > nb ? 'a' : 'b';
  if (r.winner !== 'tie') for (const [id, side] of Object.entries(r.votes)) if (side === r.winner) s.scores[id] = (s.scores[id] ?? 0) + 1;
  s.phase = 'reveal';
  const debate = s.opts.debate !== false;
  s.deadline = ctx.now + (debate ? secs(s.opts, 'debateSec', 20) : 6000);
  const total = na + nb || 1;
  if (r.winner === 'tie') ctx.announce(`Égalité parfaite ${na}–${nb} ! Le groupe est divisé 😱${debate ? ' Défendez votre camp !' : ''}`);
  else {
    const w = r.winner === 'a' ? r.a : r.b;
    ctx.announce(`${w.name} l’emporte avec ${Math.round(((r.winner === 'a' ? na : nb) / total) * 100)} % des votes !${debate ? ' 20 secondes pour débattre…' : ''}`);
  }
}

function next(s: QGState, ctx: RuntimeCtx) {
  s.idx++;
  if (s.idx >= s.rounds.length) return endGame(s, ctx);
  startRound(s, ctx);
}

function endGame(s: QGState, ctx: RuntimeCtx) {
  s.phase = 'end';
  s.deadline = undefined;
  const best = Math.max(0, ...s.active.map((id) => s.scores[id] ?? 0));
  s.winners = best > 0 ? s.active.filter((id) => s.scores[id] === best) : [];
  const split = s.rounds.filter((r) => r.winner === 'tie').length;
  s.summary = `${joinNames(s.winners.map((id) => nameOf(ctx, id))) || 'Personne'} pense${s.winners.length > 1 ? 'nt' : ''} le plus comme le groupe (${best} pts).${split ? ` ${split} duel${split > 1 ? 's' : ''} à égalité !` : ''}`;
  ctx.announce(s.summary);
}

function onAction(s: QGState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  if (a.type === 'vote') {
    if (s.phase !== 'vote' || !s.active.includes(pid)) return;
    if (a.side !== 'a' && a.side !== 'b') return;
    const r = s.rounds[s.idx];
    r.votes[pid] = a.side;
    if (s.active.every((id) => r.votes[id])) resolve(s, ctx);
  } else if (a.type === 'skip' && s.phase === 'reveal') next(s, ctx);
}

function onTick(s: QGState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'vote') resolve(s, ctx);
  else if (s.phase === 'reveal') next(s, ctx);
}

function view(s: QGState, pid: string | null): QGView {
  const r = s.rounds[s.idx];
  const showVotes = s.phase !== 'vote';
  return {
    phase: s.phase,
    needs: s.phase === 'vote' && r ? s.active.filter((id) => !r.votes[id]) : [],
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    active: s.active,
    idx: s.idx,
    total: s.rounds.length,
    round: r && s.phase !== 'end' ? { a: r.a, b: r.b, question: r.question, winner: r.winner } : null,
    voted: r ? Object.keys(r.votes) : [],
    myVote: pid && r ? r.votes[pid] : undefined,
    votes: showVotes && r ? { ...r.votes } : undefined,
    debate: s.opts.debate !== false,
    history: s.rounds
      .filter((x) => x.winner)
      .map((x) => ({
        a: x.a.name,
        b: x.b.name,
        aEmoji: x.a.emoji,
        bEmoji: x.b.emoji,
        winner: x.winner,
        na: Object.values(x.votes).filter((v) => v === 'a').length,
        nb: Object.values(x.votes).filter((v) => v === 'b').length
      }))
  };
}

// ---------- IA ----------

interface QGMem {
  key: string;
  actAt: number;
  talkAt: number;
  said: number;
  bias: number;
  choice?: Side;
  endSaid: boolean;
}

const ai: AIStrategy<QGView> = {
  think(v, mind: AgentMind, api) {
    const mem = aiMem<QGMem>(mind, () => ({ key: '', actAt: 0, talkAt: 0, said: 0, bias: 0, endSaid: false }));
    const P = personality(api.me.personality);
    const me = api.me.id;
    const key = `${v.phase}-${v.idx}`;
    if (mem.key !== key) {
      if (v.phase === 'vote') {
        mem.bias = 0;
        mem.choice = undefined;
      }
      mem.key = key;
      mem.said = 0;
      mem.actAt = api.now + 2000 + api.rng.int(0, 7000) * (P.id === 'suiveur' ? 1.6 : 1);
      mem.talkAt = api.now + 1500 + api.rng.int(0, 5000) * (1.3 - P.talk);
    }
    const r = v.round;
    if (r) {
      for (const h of newChat(api, mind)) {
        const ma = textMentions(h.text, r.a);
        const mb = textMentions(h.text, r.b);
        const pro = /gagne|ecrase|eclate|facile|trop fort|plus fort|meilleur|aucune chance|explose|detruit|largement/.test(h.text);
        if (pro && ma !== mb) mem.bias += (ma ? 1 : -1) * (0.3 + P.follow * 0.8);
      }
    }
    if (v.phase === 'vote' && r) {
      if (v.myVote) return;
      const pa = powerOf(r.a) + taste(api, r.a.name, P);
      const pb = powerOf(r.b) + taste(api, r.b.name, P);
      const noise = { facile: 1.2, normal: 0.7, difficile: 0.4 }[api.difficulty];
      const choose = (): Side => (pa - pb + mem.bias + (api.rng.next() - 0.5) * noise >= 0 ? 'a' : 'b');
      // Prend la parole avant de voter
      if (api.now >= mem.talkAt && mem.said < 1 && api.rng.chance(0.25 + P.talk * 0.5)) {
        mem.choice = choose();
        const it = mem.choice === 'a' ? r.a : r.b;
        const other = mem.choice === 'a' ? r.b : r.a;
        const arg = argumentFor(api, it, other, POWER);
        mem.said++;
        api.say(
          api.rng.pick([
            `${it.name} gagne, trop ${arg}.`,
            `${it.name} sans hésiter : ${arg} !`,
            `Franchement ${other.name} n’a aucune chance face à ${it.name} (${arg}).`,
            P.id === 'intello' ? `Objectivement, ${it.name} a l’avantage : ${arg}.` : `${it.name} l’éclate, ${arg} quoi 😤`,
            P.id === 'timide' ? `Euh… ${it.name} peut-être ? À cause de ${arg}…` : `Team ${it.name} ! ${arg} 💪`
          ])
        );
        mem.actAt = Math.max(mem.actAt, api.now + 1500);
        return;
      }
      if (api.now < mem.actAt) return;
      api.act({ type: 'vote', side: mem.choice && !api.rng.chance(P.flexible * 0.2) ? mem.choice : choose() });
      return;
    }
    if (v.phase === 'reveal' && r && v.votes) {
      if (mem.said >= (v.debate ? 1 : 0) + (P.talk > 0.7 ? 1 : 0) || api.now < mem.talkAt) return;
      const mine = v.votes[me];
      if (!mine || !api.rng.chance(0.25 + P.talk * 0.5)) {
        mem.said++;
        return;
      }
      mem.said++;
      mem.talkAt = api.now + 5000 + api.rng.int(0, 4000);
      const it = mine === 'a' ? r.a : r.b;
      const other = mine === 'a' ? r.b : r.a;
      if (r.winner === 'tie') api.say(`Allez, ${it.name} ! Réfléchissez : ${argumentFor(api, it, other, POWER)}.`);
      else if (r.winner === mine) api.say(api.rng.pick(['Évident.', 'Logique 😎', `${it.name}, évidemment !`, line(P, 'agree', api.rng, { name: 'le groupe' })]));
      else api.say(api.rng.pick([`Vous rigolez ? ${it.name} l’éclate ! ${argumentFor(api, it, other, POWER)} !`, `Je maintiens : ${it.name}.`, `Bande de fous… ${it.name} gagne 100 fois sur 100.`, line(P, 'disagree', api.rng, { name: 'tout le monde' })]));
      return;
    }
    if (v.phase === 'end' && !mem.endSaid) {
      mem.endSaid = true;
      if (api.rng.chance(P.talk * 0.5)) api.say(line(P, v.winners?.includes(me) ? 'win' : 'lose', api.rng));
    }
  }
};

export const quiGagnerait: GameModule<QGState, QGView> = {
  id: 'qui-gagnerait',
  name: 'Qui gagnerait ?',
  family: 'duels',
  emoji: '⚔️',
  tagline: 'Deux personnages, un seul vainqueur. Pensez-vous comme le groupe ?',
  rules: [
    'À chaque manche, deux éléments proches du même thème s’affrontent (personnages, animaux, sportifs…).',
    'Chacun vote pour celui qui gagnerait selon lui.',
    'Ceux qui votent comme la majorité marquent 1 point : il faut penser comme le groupe !',
    'Après chaque révélation, quelques secondes pour débattre (et se moquer des perdants).'
  ],
  minPlayers: 2,
  maxPlayers: 16,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Nombre de duels', type: 'number', min: 3, max: 20, default: 8 },
    { key: 'voteSec', label: 'Temps de vote (s)', type: 'number', min: 10, max: 90, step: 5, default: 25 },
    { key: 'debate', label: 'Débat de 20 s après chaque résultat', type: 'toggle', default: true },
    { key: 'debateSec', label: 'Durée du débat (s)', type: 'number', min: 10, max: 60, step: 5, default: 20, advanced: true, showIf: (o) => o.debate !== false }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '⚔️', desc: '8 duels avec débat', options: { rounds: 8, debate: true } },
    { id: 'rapide', label: 'Express', emoji: '⚡', desc: '10 duels sans débat', options: { rounds: 10, debate: false, voteSec: 15 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: QuiGagneraitBoard
};
