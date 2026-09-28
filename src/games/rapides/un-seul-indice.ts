// ☝️ Un seul indice : jeu coopératif. Chacun écrit UN mot pour faire deviner, les doublons s'annulent !
import type { AgentMind, AIStrategy, BaseState, BaseView, GameAction, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { matchesItem, rankByClues } from '../../content';
import { keywords, norm } from '../../core/text';
import { line, personality } from '../../ai/personalities';
import { activeIds, aiMem, initScores, nameOf, newChat, secs, stable01, type ItemRef } from '../kit';
import { pickItems } from '../duels/duel-kit';
import { UnSeulIndiceBoard } from './UnSeulIndiceBoard';

export interface USClue {
  text: string;
  cancelled?: 'doublon' | 'interdit' | 'vide';
}

export interface USResult {
  item: ItemRef;
  guesser: string;
  clues: Record<string, USClue>;
  guess: string | null;
  correct: boolean;
}

export interface USState extends BaseState {
  phase: 'clues' | 'guess' | 'result' | 'end';
  active: string[];
  order: string[];
  round: number;
  items: ItemRef[];
  clues: Record<string, USClue>;
  guess: { text: string | null; correct: boolean } | null;
  success: number;
  results: USResult[];
  opts: Record<string, any>;
}

export interface USView extends BaseView {
  phase: USState['phase'];
  active: string[];
  round: number;
  total: number;
  guesser: string;
  /** L'élément à faire deviner (caché au devineur tant que la manche n'est pas finie). */
  item: ItemRef | null;
  packId: string;
  packName: string;
  /** Indices visibles par ce joueur. */
  clues: Record<string, USClue & { hidden?: boolean }>;
  written: string[];
  cancelledCount: number;
  guess: USState['guess'];
  success: number;
  results: { name: string; emoji: string; guesser: string; correct: boolean; guess: string | null }[];
}

/** Clé de comparaison d'un indice (normalisé, pluriel/féminin simplifiés). */
export function clueKey(text: string): string {
  const k = keywords(text);
  const base = k.length ? k.join(' ') : norm(text);
  return base.replace(/(eux|euse|ique|ment|ant|ent)$/, '').replace(/(e|s)$/, '');
}

function forbidden(text: string, item: ItemRef): boolean {
  const n = norm(text);
  if (!n) return true;
  if (matchesItem(text, item as Item)) return true;
  const nameWords = [item.name, ...(item.aliases ?? [])].flatMap((x) => keywords(x)).filter((w) => w.length >= 3);
  const k = keywords(text);
  return k.some((w) => nameWords.some((nw) => nw === w || (w.length >= 5 && nw.startsWith(w)) || (nw.length >= 5 && w.startsWith(nw))));
}

function setup(ctx: RuntimeCtx): USState {
  const active = activeIds(ctx);
  const n = Math.max(3, Math.min(20, Number(ctx.options.rounds ?? 13) || 13));
  const items = pickItems(ctx.packs, ctx.rng, n, ctx.options.mixPacks !== true);
  const s: USState = {
    phase: 'clues',
    active,
    order: ctx.rng.shuffle(active),
    round: 0,
    items,
    clues: {},
    guess: null,
    success: 0,
    results: [],
    scores: initScores(ctx),
    opts: { ...ctx.options }
  };
  if (!items.length) {
    s.phase = 'end';
    s.winners = [];
    s.summary = 'Pas assez d’éléments dans les thèmes choisis.';
    return s;
  }
  startRound(s, ctx);
  return s;
}

const guesserOf = (s: USState) => s.order[s.round % s.order.length];
const givers = (s: USState) => s.active.filter((id) => id !== guesserOf(s));

function startRound(s: USState, ctx: RuntimeCtx) {
  s.phase = 'clues';
  s.clues = {};
  s.guess = null;
  s.deadline = ctx.now + secs(s.opts, 'clueSec', 45);
  const it = s.items[s.round];
  ctx.announce(`☝️ Carte ${s.round + 1}/${s.items.length} (${it.packName}). ${nameOf(ctx, guesserOf(s))} devine : les autres, écrivez UN mot chacun… sans vous copier !`);
}

function checkClues(s: USState, ctx: RuntimeCtx) {
  const it = s.items[s.round];
  const byKey: Record<string, string[]> = {};
  for (const [pid, c] of Object.entries(s.clues)) {
    if (!c.text) c.cancelled = 'vide';
    else if (forbidden(c.text, it)) c.cancelled = 'interdit';
    else (byKey[clueKey(c.text)] ??= []).push(pid);
  }
  let dup = 0;
  for (const ids of Object.values(byKey)) {
    if (ids.length > 1) {
      ids.forEach((id) => (s.clues[id].cancelled = 'doublon'));
      dup += ids.length;
    }
  }
  const valid = Object.values(s.clues).filter((c) => !c.cancelled).length;
  s.phase = 'guess';
  s.deadline = ctx.now + secs(s.opts, 'guessSec', 45);
  ctx.announce(`${dup ? `💥 ${dup} indice${dup > 1 ? 's' : ''} identique${dup > 1 ? 's' : ''} annulé${dup > 1 ? 's' : ''} ! ` : ''}${valid} indice${valid > 1 ? 's' : ''} pour ${nameOf(ctx, guesserOf(s))}. À toi de deviner !`);
}

function finishRound(s: USState, ctx: RuntimeCtx, text: string | null) {
  const it = s.items[s.round];
  const correct = !!text && matchesItem(text, it as Item);
  s.guess = { text, correct };
  if (correct) s.success++;
  s.results.push({ item: it, guesser: guesserOf(s), clues: { ...s.clues }, guess: text, correct });
  s.phase = 'result';
  s.deadline = ctx.now + secs(s.opts, 'resultSec', 7);
  ctx.announce(correct ? `✅ Bravo ! C’était bien ${it.name} ${it.emoji.split(' ')[0]}` : text ? `❌ Raté : « ${text} »… c’était ${it.name} ${it.emoji.split(' ')[0]}` : `⏭️ Passé. C’était ${it.name} ${it.emoji.split(' ')[0]}`);
}

function next(s: USState, ctx: RuntimeCtx) {
  s.round++;
  if (s.round >= s.items.length) return endGame(s, ctx);
  startRound(s, ctx);
}

function grade(n: number, total: number): string {
  const r = n / Math.max(1, total);
  if (r >= 1) return 'Score parfait ! Vous êtes télépathes 🤯';
  if (r >= 0.9) return 'Incroyable, quelle équipe ! 🌟';
  if (r >= 0.8) return 'Génial ! 🎉';
  if (r >= 0.65) return 'Super travail d’équipe 👏';
  if (r >= 0.5) return 'Pas mal du tout 🙂';
  if (r >= 0.3) return 'Dans la moyenne… on peut mieux faire 😉';
  return 'Aïe… essayez encore ! 😅';
}

function endGame(s: USState, ctx: RuntimeCtx) {
  s.phase = 'end';
  s.deadline = undefined;
  const total = s.items.length;
  for (const id of s.active) s.scores[id] = (s.scores[id] ?? 0) + s.success;
  s.winners = s.success >= Math.ceil(total / 2) ? [...s.active] : [];
  s.summary = `Équipe : ${s.success}/${total} cartes trouvées. ${grade(s.success, total)}`;
  ctx.announce(s.summary);
}

function onAction(s: USState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  switch (a.type) {
    case 'clue': {
      if (s.phase !== 'clues' || !givers(s).includes(pid)) return;
      const text = String(a.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
      if (!text || text.split(' ').length > 1) return; // un seul mot
      s.clues[pid] = { text };
      if (givers(s).every((id) => s.clues[id])) checkClues(s, ctx);
      return;
    }
    case 'guess': {
      if (s.phase !== 'guess' || pid !== guesserOf(s)) return;
      const text = String(a.text ?? '').trim().slice(0, 60);
      if (!text) return;
      finishRound(s, ctx, text);
      return;
    }
    case 'pass': {
      if (s.phase !== 'guess' || pid !== guesserOf(s)) return;
      finishRound(s, ctx, null);
      return;
    }
    case 'skip': {
      if (s.phase === 'result') next(s, ctx);
      return;
    }
  }
}

function onTick(s: USState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'clues') {
    for (const id of givers(s)) if (!s.clues[id]) s.clues[id] = { text: '', cancelled: 'vide' };
    checkClues(s, ctx);
  } else if (s.phase === 'guess') finishRound(s, ctx, null);
  else if (s.phase === 'result') next(s, ctx);
}

function view(s: USState, pid: string | null): USView {
  const guesser = guesserOf(s);
  const isGuesser = pid === guesser;
  const it = s.items[s.round];
  const clues: USView['clues'] = {};
  for (const [id, c] of Object.entries(s.clues)) {
    if (s.phase === 'clues') clues[id] = id === pid ? c : { text: '✍️', hidden: true };
    else if (s.phase === 'guess' && isGuesser) clues[id] = c.cancelled ? { text: '❌', cancelled: c.cancelled, hidden: true } : { text: c.text };
    else if (s.phase === 'guess' && !pid) clues[id] = c.cancelled ? { text: '❌', cancelled: c.cancelled, hidden: true } : { text: c.text };
    else clues[id] = c;
  }
  const showItem = s.phase === 'result' || (!!pid && !isGuesser && s.active.includes(pid) && s.phase !== 'end');
  const needs: string[] = [];
  if (s.phase === 'clues') needs.push(...givers(s).filter((id) => !s.clues[id]));
  if (s.phase === 'guess') needs.push(guesser);
  return {
    phase: s.phase,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    active: s.active,
    round: s.round,
    total: s.items.length,
    guesser,
    item: showItem && it ? it : null,
    packId: it?.pack ?? '',
    packName: it?.packName ?? '',
    clues,
    written: Object.keys(s.clues),
    cancelledCount: Object.values(s.clues).filter((c) => c.cancelled).length,
    guess: s.guess,
    success: s.success,
    results: s.results.map((r) => ({ name: r.item.name, emoji: r.item.emoji, guesser: r.guesser, correct: r.correct, guess: r.guess }))
  };
}

// ---------- IA ----------

interface USMem {
  key: string;
  actAt: number;
  said: number;
  endSaid: boolean;
}

function candidateWords(it: ItemRef): string[] {
  const nameWords = new Set([it.name, ...(it.aliases ?? [])].flatMap((x) => keywords(x)));
  const words = new Set<string>();
  for (const t of it.tags) {
    // mot le plus parlant du tag (« amerique-du-nord » → « amerique »), sans les nombres seuls
    const parts = t.split('-').filter((w) => w.length >= 3 && !/^\d+$/.test(w) && keywords(w).length && !nameWords.has(keywords(w)[0]));
    const best = parts.sort((a, b) => b.length - a.length)[0];
    if (best) words.add(best);
  }
  return [...words].filter((w) => !forbidden(w, it));
}

const ai: AIStrategy<USView> = {
  think(v, mind: AgentMind, api) {
    const mem = aiMem<USMem>(mind, () => ({ key: '', actAt: 0, said: 0, endSaid: false }));
    const P = personality(api.me.personality);
    const me = api.me.id;
    const key = `${v.phase}-${v.round}`;
    if (mem.key !== key) {
      mem.key = key;
      mem.said = 0;
      const think = { facile: 2500, normal: 4000, difficile: 5500 }[api.difficulty];
      mem.actAt = api.now + think + api.rng.int(0, 6000);
    }
    newChat(api, mind); // le chat est libre ici, on ne l'exploite pas pour tricher
    if (v.phase === 'clues') {
      if (!v.needs.includes(me) || !v.item || api.now < mem.actAt) return;
      const it = v.item;
      const pack = api.packs.find((p) => p.id === it.pack);
      const pool = pack?.items ?? [];
      const words = candidateWords(it);
      let word: string;
      if (words.length) {
        // Mots « spécifiques » (peu d'éléments du pack les partagent) : les IA ont tendance à choisir les mêmes → doublons réalistes
        const spec = (w: string) => pool.filter((i) => i.tags.some((t) => t.split('-').includes(w))).length || 1;
        // Chaque IA a ses associations d'idées (bruit stable) ; en difficile elle évite le mot le plus évident, souvent pris par les autres.
        const flair = { facile: 2, normal: 3.5, difficile: 5 }[api.difficulty];
        const ranked = words.map((w) => ({ w, s: spec(w) + stable01(me + w) * flair })).sort((a, b) => a.s - b.s);
        const obvious = words.slice().sort((a, b) => spec(a) - spec(b))[0];
        const pool2 = api.difficulty === 'difficile' && ranked.length > 2 ? ranked.filter((x) => x.w !== obvious) : ranked;
        const top = pool2.slice(0, Math.max(2, Math.ceil(pool2.length * 0.4)));
        word = api.rng.pick(top).w;
      } else {
        const clueWords = it.clues.flatMap((c) => c.split(/[\s,.'’]+/)).filter((w) => w.length >= 5 && !forbidden(w, it));
        word = clueWords.length ? api.rng.pick(clueWords) : 'mystère';
      }
      api.act({ type: 'clue', text: word.replace(/\s+/g, '') });
      return;
    }
    if (v.phase === 'guess') {
      if (v.guesser !== me) {
        if (mem.said < 1 && api.rng.chance(P.talk * 0.25)) {
          mem.said++;
          api.say(api.rng.pick(['Allez, tu peux le faire !', 'C’est facile avec ces indices 😉', 'Oups, on s’est copiés…', line(P, 'thinking', api.rng)]));
        }
        return;
      }
      if (api.now < mem.actAt) return;
      const clues = Object.values(v.clues).filter((c) => !c.hidden && !c.cancelled).map((c) => c.text);
      const pack = api.packs.find((p) => p.id === v.packId);
      const pool: Item[] = pack?.items ?? api.packs.flatMap((p) => p.items);
      const ranked = rankByClues(pool, clues);
      if (!clues.length || !ranked.length || ranked[0].score <= 0) {
        if (api.rng.chance(0.5) || !ranked.length) {
          api.say(api.rng.pick(['Aucune idée… je passe.', 'Vous m’avez pas aidé là 😅 Je passe.']));
          api.act({ type: 'pass' });
        } else api.act({ type: 'guess', text: api.rng.pick(pool).name });
        return;
      }
      let pick = ranked[0].item;
      const slip = { facile: 0.35, normal: 0.15, difficile: 0.05 }[api.difficulty];
      if (ranked[1] && api.rng.chance(slip)) pick = ranked[1].item;
      if (api.rng.chance(P.talk * 0.5)) api.say(api.rng.pick([`Je dirais… ${pick.name} !`, `${pick.name} ?`, `Facile : ${pick.name}.`, `Euh… ${pick.name} ?`]));
      api.act({ type: 'guess', text: pick.name });
      return;
    }
    if (v.phase === 'result' && mem.said < 1) {
      mem.said++;
      if (api.rng.chance(P.talk * 0.4)) api.say(v.guess?.correct ? api.rng.pick(['Bien joué ! 🎉', 'Trop fort !', 'Yes !']) : api.rng.pick(['Dommage…', 'Ah ! On y était presque.', 'Nos indices étaient nuls 😅']));
      return;
    }
    if (v.phase === 'end' && !mem.endSaid) {
      mem.endSaid = true;
      if (api.rng.chance(P.talk * 0.5)) api.say(line(P, v.winners?.length ? 'win' : 'lose', api.rng));
    }
  }
};

export const unSeulIndice: GameModule<USState, USView> = {
  id: 'un-seul-indice',
  name: 'Un seul indice',
  family: 'rapides',
  emoji: '☝️',
  tagline: 'Faites deviner avec un seul mot chacun… mais les indices identiques s’annulent !',
  rules: [
    'Jeu coopératif : toute l’équipe gagne ou perd ensemble.',
    'À chaque manche, un joueur devine. Les autres voient l’élément et écrivent chacun UN mot en secret.',
    'Les indices identiques (ou trop proches) sont annulés, ainsi que ceux qui contiennent le nom !',
    'Le devineur voit les indices restants et tente sa chance (ou passe). Objectif : trouver un maximum de cartes.'
  ],
  minPlayers: 3,
  maxPlayers: 12,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Nombre de cartes', type: 'number', min: 3, max: 20, default: 13 },
    { key: 'clueSec', label: 'Temps pour écrire (s)', type: 'number', min: 15, max: 120, step: 5, default: 45 },
    { key: 'guessSec', label: 'Temps pour deviner (s)', type: 'number', min: 15, max: 120, step: 5, default: 45 },
    { key: 'mixPacks', label: 'Mélanger les thèmes entre les cartes', type: 'toggle', default: false, advanced: true }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '☝️', desc: '13 cartes', options: { rounds: 13 } },
    { id: 'court', label: 'Partie courte', emoji: '⏱️', desc: '7 cartes', options: { rounds: 7 } },
    { id: 'eclair', label: 'Éclair', emoji: '⚡', desc: 'Chrono serré', options: { rounds: 10, clueSec: 20, guessSec: 20 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: UnSeulIndiceBoard
};
