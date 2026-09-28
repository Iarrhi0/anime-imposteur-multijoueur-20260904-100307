// 🤷 Tu préfères ? Dilemmes impossibles : choisis ton camp et devine celui du groupe.
import { joinNames } from '../../core/text';
import type { AgentMind, AIStrategy, BaseState, BaseView, GameAction, GameModule, OptionChoice, RuntimeCtx } from '../../core/types';
import type { Dilemma } from '../../content/types';
import { dilemmas } from '../../content/extra/dilemmas';
import { norm } from '../../core/text';
import { line, personality } from '../../ai/personalities';
import { activeIds, aiMem, initScores, nameOf, newChat, secs, stable01 } from '../kit';
import { TuPreferesBoard } from './TuPreferesBoard';

export type AB = 'a' | 'b';

export interface TPRound {
  d: Dilemma;
  votes: Record<string, { choice: AB; predict: AB }>;
  majority?: AB | 'tie';
}

export interface TPState extends BaseState {
  phase: 'vote' | 'reveal' | 'end';
  active: string[];
  rounds: TPRound[];
  idx: number;
  opts: Record<string, any>;
}

export interface TPView extends BaseView {
  phase: TPState['phase'];
  active: string[];
  idx: number;
  total: number;
  dilemma: Dilemma | null;
  voted: string[];
  myVote?: { choice: AB; predict: AB };
  votes?: TPRound['votes'];
  majority?: AB | 'tie';
  history: { a: string; b: string; pa: number; majority?: AB | 'tie' }[];
}

const FALLBACK: Dilemma[] = [
  { a: 'Pouvoir voler', b: 'Être invisible', theme: 'pouvoirs' },
  { a: 'Ne plus jamais manger de pizza', b: 'Ne plus jamais manger de chocolat', theme: 'bouffe' },
  { a: 'Vivre sans musique', b: 'Vivre sans films', theme: 'quotidien' },
  { a: 'Parler toutes les langues', b: 'Parler aux animaux', theme: 'pouvoirs' },
  { a: 'Être toujours 10 minutes en retard', b: 'Être toujours 20 minutes en avance', theme: 'quotidien' },
  { a: 'Avoir un dragon', b: 'Être un dragon', theme: 'fun' },
  { a: 'Voyager dans le passé', b: 'Voyager dans le futur', theme: 'pouvoirs' },
  { a: 'Perdre ton téléphone', b: 'Perdre ton portefeuille', theme: 'tech' },
  { a: 'Faire le tour du monde seul', b: 'Ne jamais quitter ta ville avec tes amis', theme: 'extrême' },
  { a: 'Manger un piment très fort', b: 'Manger un citron entier', theme: 'bouffe' }
];

const BANK: Dilemma[] = Array.isArray(dilemmas) && dilemmas.length ? dilemmas : FALLBACK;

const THEME_LABELS: Record<string, string> = {
  fun: '😜 Fun',
  anime: '🍥 Anime',
  pouvoirs: '⚡ Super-pouvoirs',
  quotidien: '🏠 Quotidien',
  bouffe: '🍔 Bouffe',
  extrême: '🔥 Extrême',
  tech: '📱 Tech'
};

const THEME_CHOICES: OptionChoice[] = [
  { value: 'tous', label: '🎲 Tous les thèmes' },
  ...[...new Set(BANK.map((d) => d.theme))].map((t) => ({ value: t, label: THEME_LABELS[t] ?? t }))
];

function setup(ctx: RuntimeCtx): TPState {
  const o = ctx.options;
  const n = Math.max(3, Math.min(30, Number(o.rounds ?? 10) || 10));
  const theme = String(o.theme ?? 'tous');
  let pool = theme === 'tous' ? BANK : BANK.filter((d) => d.theme === theme);
  if (pool.length < 3) pool = BANK;
  const picked = ctx.rng.sample(pool, Math.min(n, pool.length)).map((d) => (ctx.rng.chance(0.5) ? { ...d } : { a: d.b, b: d.a, theme: d.theme }));
  const s: TPState = {
    phase: 'vote',
    active: activeIds(ctx),
    rounds: picked.map((d) => ({ d, votes: {} })),
    idx: 0,
    scores: initScores(ctx),
    opts: { ...o }
  };
  startRound(s, ctx);
  return s;
}

function startRound(s: TPState, ctx: RuntimeCtx) {
  const d = s.rounds[s.idx].d;
  s.phase = 'vote';
  s.deadline = ctx.now + secs(s.opts, 'voteSec', 30);
  ctx.announce(`🤷 Tu préfères… 🅰️ ${d.a} — ou — 🅱️ ${d.b} ? Et que va choisir la majorité ?`);
}

function resolve(s: TPState, ctx: RuntimeCtx) {
  const r = s.rounds[s.idx];
  const vs = Object.values(r.votes);
  const na = vs.filter((x) => x.choice === 'a').length;
  const nb = vs.length - na;
  r.majority = na === nb ? 'tie' : na > nb ? 'a' : 'b';
  for (const [id, x] of Object.entries(r.votes)) {
    if (r.majority !== 'tie' && x.predict === r.majority) s.scores[id] = (s.scores[id] ?? 0) + 1;
  }
  s.phase = 'reveal';
  s.deadline = ctx.now + secs(s.opts, 'revealSec', 8);
  const pa = vs.length ? Math.round((na / vs.length) * 100) : 0;
  ctx.announce(r.majority === 'tie' ? `Égalité parfaite : ${pa} % / ${100 - pa} % ! Aucun point de pronostic.` : `Résultat : ${pa} % pour 🅰️, ${100 - pa} % pour 🅱️. Bravo à ceux qui l’avaient prédit !`);
}

function next(s: TPState, ctx: RuntimeCtx) {
  s.idx++;
  if (s.idx >= s.rounds.length) return endGame(s, ctx);
  startRound(s, ctx);
}

function endGame(s: TPState, ctx: RuntimeCtx) {
  s.phase = 'end';
  s.deadline = undefined;
  const best = Math.max(0, ...s.active.map((id) => s.scores[id] ?? 0));
  s.winners = best > 0 ? s.active.filter((id) => s.scores[id] === best) : [];
  // Le plus original : souvent dans la minorité
  const minority: Record<string, number> = {};
  for (const r of s.rounds) {
    if (!r.majority || r.majority === 'tie') continue;
    for (const [id, x] of Object.entries(r.votes)) if (x.choice !== r.majority) minority[id] = (minority[id] ?? 0) + 1;
  }
  const rebel = Object.entries(minority).sort((a, b) => b[1] - a[1])[0];
  s.summary = `${joinNames(s.winners.map((id) => nameOf(ctx, id))) || 'Personne'} ${s.winners.length > 1 ? 'lisent' : 'lit'} le mieux dans les pensées du groupe (${best} pts).${rebel ? ` Esprit rebelle : ${nameOf(ctx, rebel[0])} (${rebel[1]} fois dans la minorité) 😎` : ''}`;
  ctx.announce(s.summary);
}

function onAction(s: TPState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  if (a.type === 'vote') {
    if (s.phase !== 'vote' || !s.active.includes(pid)) return;
    const ok = (x: any): x is AB => x === 'a' || x === 'b';
    if (!ok(a.choice) || !ok(a.predict)) return;
    const r = s.rounds[s.idx];
    r.votes[pid] = { choice: a.choice, predict: a.predict };
    if (s.active.every((id) => r.votes[id])) resolve(s, ctx);
  } else if (a.type === 'skip' && s.phase === 'reveal') next(s, ctx);
}

function onTick(s: TPState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'vote') resolve(s, ctx);
  else if (s.phase === 'reveal') next(s, ctx);
}

function view(s: TPState, pid: string | null): TPView {
  const r = s.rounds[s.idx];
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
    dilemma: r && s.phase !== 'end' ? r.d : null,
    voted: r ? Object.keys(r.votes) : [],
    myVote: pid && r ? r.votes[pid] : undefined,
    votes: s.phase === 'reveal' && r ? { ...r.votes } : undefined,
    majority: s.phase === 'reveal' ? r?.majority : undefined,
    history: s.rounds
      .filter((x) => x.majority)
      .map((x) => {
        const vs = Object.values(x.votes);
        return { a: x.d.a, b: x.d.b, pa: vs.length ? Math.round((vs.filter((y) => y.choice === 'a').length / vs.length) * 100) : 0, majority: x.majority };
      })
  };
}

// ---------- IA ----------

interface TPMem {
  key: string;
  actAt: number;
  talkAt: number;
  said: number;
  lean: number;
  choice?: AB;
  endSaid: boolean;
}

const EXTREME = /jamais|toute ta vie|mourir|pour toujours|seul|entier|geant|infini|immortel|dragon|pouvoir|voler|milliard|million|espace/;
const COMFY = /ami|famille|chat|chien|pizza|chocolat|dormir|vacances|musique|film|argent|maison/;

/** Préférence de l'IA pour A (positif) ou B (négatif), selon sa personnalité. */
function preference(d: Dilemma, pid: string, pers: ReturnType<typeof personality>): number {
  const na = norm(d.a);
  const nb = norm(d.b);
  let p = (stable01(pid + '|' + d.a + '|' + d.b) - 0.5) * 1.6;
  const ext = (t: string) => (EXTREME.test(t) ? 1 : 0);
  const comfy = (t: string) => (COMFY.test(t) ? 1 : 0);
  const bold = pers.id === 'chaotique' || pers.id === 'competitif' || pers.id === 'bluffeur' ? 0.6 : pers.id === 'timide' || pers.id === 'parano' ? -0.5 : 0;
  p += (ext(na) - ext(nb)) * bold;
  p += (comfy(na) - comfy(nb)) * (pers.id === 'discret' || pers.id === 'timide' ? 0.5 : 0.2);
  return p;
}

const ai: AIStrategy<TPView> = {
  think(v, mind: AgentMind, api) {
    const mem = aiMem<TPMem>(mind, () => ({ key: '', actAt: 0, talkAt: 0, said: 0, lean: 0, endSaid: false }));
    const P = personality(api.me.personality);
    const me = api.me.id;
    const key = `${v.phase}-${v.idx}`;
    if (mem.key !== key) {
      if (v.phase === 'vote') {
        mem.lean = 0;
        mem.choice = undefined;
      }
      mem.key = key;
      mem.said = 0;
      mem.actAt = api.now + 2500 + api.rng.int(0, 7000);
      mem.talkAt = api.now + 1500 + api.rng.int(0, 5000) * (1.3 - P.talk);
    }
    const d = v.dilemma;
    // Ce que disent les autres : « A », « la première », mots du choix…
    if (d) {
      for (const h of newChat(api, mind)) {
        const t = h.text;
        const saysA = /(^|\s)(a|la a|option a|la premiere|premier|1)(\s|$)/.test(t) || norm(d.a).split(' ').filter((w) => w.length > 4).some((w) => t.includes(w));
        const saysB = /(^|\s)(b|la b|option b|la deuxieme|deuxieme|second|2)(\s|$)/.test(t) || norm(d.b).split(' ').filter((w) => w.length > 4).some((w) => t.includes(w));
        if (saysA !== saysB) mem.lean += saysA ? 1 : -1;
      }
    }
    if (v.phase === 'vote' && d) {
      if (v.myVote) return;
      const pref = preference(d, me, P);
      const choice: AB = mem.choice ?? (pref + mem.lean * P.follow * 0.4 + (api.rng.next() - 0.5) * 0.4 >= 0 ? 'a' : 'b');
      mem.choice = choice;
      if (api.now >= mem.talkAt && mem.said < 1 && api.rng.chance(0.2 + P.talk * 0.5)) {
        mem.said++;
        const txt = choice === 'a' ? d.a : d.b;
        const other = choice === 'a' ? d.b : d.a;
        const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
        api.say(
          api.rng.pick([
            `${choice.toUpperCase()} sans hésiter, ${low(txt)} c’est largement mieux.`,
            `Qui choisirait « ${low(other)} » sérieusement ? 😂`,
            P.id === 'timide' ? `Euh… je dirais ${choice.toUpperCase()}…` : `Team ${choice.toUpperCase()} ! 🙌`,
            P.id === 'chaotique' ? `Les deux ! Non… ${choice.toUpperCase()}. Ou pas. ${choice.toUpperCase()}.` : `Dur… mais ${choice.toUpperCase()}.`,
            P.id === 'intello' ? `Rationnellement, ${choice.toUpperCase()} a moins d’inconvénients.` : `${choice.toUpperCase()}, et vous ?`
          ])
        );
        mem.actAt = Math.max(mem.actAt, api.now + 1500);
        return;
      }
      if (api.now < mem.actAt) return;
      // Pronostic : le groupe pense-t-il comme moi ? (suiveur écoute le chat)
      const skill = { facile: 0.2, normal: 0.5, difficile: 0.75 }[api.difficulty];
      let predict: AB = choice;
      if (mem.lean !== 0 && api.rng.chance(skill)) predict = mem.lean > 0 ? 'a' : 'b';
      else if (api.rng.chance(0.2 * P.flexible)) predict = choice === 'a' ? 'b' : 'a';
      api.act({ type: 'vote', choice, predict });
      return;
    }
    if (v.phase === 'reveal' && v.votes && v.majority) {
      if (mem.said > 0 || api.now < mem.talkAt) return;
      mem.said++;
      const mine = v.votes[me];
      if (!mine || !api.rng.chance(P.talk * 0.6)) return;
      if (v.majority === 'tie') api.say(api.rng.pick(['50/50, on est vraiment divisés 😅', 'Égalité, incroyable !']));
      else if (mine.choice !== v.majority) api.say(api.rng.pick(['Je suis incompris…', 'Vous avez tous tort 😤', 'Minorité, mais fier !', line(P, 'react', api.rng)]));
      else if (mine.predict === v.majority) api.say(api.rng.pick(['Je vous connais par cœur 😎', 'Prévisible !', 'Je le savais.']));
      return;
    }
    if (v.phase === 'end' && !mem.endSaid) {
      mem.endSaid = true;
      if (api.rng.chance(P.talk * 0.5)) api.say(line(P, v.winners?.includes(me) ? 'win' : 'lose', api.rng));
    }
  }
};

export const tuPreferes: GameModule<TPState, TPView> = {
  id: 'tu-preferes',
  name: 'Tu préfères ?',
  family: 'duels',
  emoji: '🤷',
  tagline: 'Des dilemmes impossibles. Choisis… et devine ce que choisira le groupe !',
  rules: [
    'À chaque manche, un dilemme : A ou B ?',
    'Choisis ton camp, puis prédis quel camp aura la majorité.',
    'Bonne prédiction = 1 point. Le camp que tu choisis ne rapporte rien : sois honnête !',
    'À la fin, découvre qui lit le mieux dans les pensées du groupe (et qui est le plus rebelle).'
  ],
  minPlayers: 2,
  maxPlayers: 16,
  usesThemes: false,
  options: [
    { key: 'theme', label: 'Thème des dilemmes', type: 'select', default: 'tous', choices: THEME_CHOICES },
    { key: 'rounds', label: 'Nombre de dilemmes', type: 'number', min: 3, max: 30, default: 10 },
    { key: 'voteSec', label: 'Temps de vote (s)', type: 'number', min: 10, max: 90, step: 5, default: 30 },
    { key: 'revealSec', label: 'Temps de révélation (s)', type: 'number', min: 4, max: 30, default: 8, advanced: true }
  ],
  presets: [
    { id: 'tous', label: 'Mix', emoji: '🎲', desc: 'Tous les thèmes', options: { theme: 'tous' } },
    { id: 'pouvoirs', label: 'Super-pouvoirs', emoji: '⚡', desc: 'Dilemmes de héros', options: { theme: 'pouvoirs' } },
    { id: 'extreme', label: 'Extrême', emoji: '🔥', desc: 'Pour les courageux', options: { theme: 'extrême' } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: TuPreferesBoard
};
