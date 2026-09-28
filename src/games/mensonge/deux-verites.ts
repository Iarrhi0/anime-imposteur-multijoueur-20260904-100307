// 🤥 2 vérités, 1 mensonge : chacun passe sur la sellette, les autres traquent le mensonge.
import type { AgentAPI, AgentMind, AIStrategy, BaseState, BaseView, GameAction, GameModule, RuntimeCtx } from '../../core/types';
import type { PersonaFacts } from '../../content/types';
import { personaFacts } from '../../content/extra/persona-facts';
import { norm } from '../../core/text';
import type { Rng } from '../../core/rng';
import { line, personality } from '../../ai/personalities';
import { activeIds, aiMem, initScores, nameOf, newChat, secs } from '../kit';
import { DeuxVeritesBoard } from './DeuxVeritesBoard';

export type DVPhase = 'write' | 'vote' | 'reveal' | 'end';

export interface DVTurn {
  pid: string;
  statements: string[] | null;
  lie: number | null;
  votes: Record<string, number>;
  auto?: boolean;
}

export interface DVState extends BaseState {
  phase: DVPhase;
  active: string[];
  turns: string[];
  turn: number;
  cur: DVTurn;
  done: (DVTurn & { gained: Record<string, number> })[];
  opts: Record<string, any>;
}

export interface DVView extends BaseView {
  phase: DVPhase;
  active: string[];
  turn: number;
  totalTurns: number;
  hot: string;
  statements: string[] | null;
  /** Visible par l'auteur, et par tous à la révélation. */
  lie: number | null;
  voted: string[];
  myVote?: number;
  /** Votes détaillés (à la révélation seulement). */
  votes?: Record<string, number>;
  gained?: Record<string, number>;
  auto?: boolean;
  history: { pid: string; statements: string[]; lie: number; fooled: number }[];
}

// Faits de secours si le contenu n'est pas disponible.
const FALLBACK: PersonaFacts = {
  truths: [
    'J’ai déjà raté un train à cause d’un café.',
    'Je dors avec deux oreillers.',
    'J’ai déjà chanté faux devant toute une classe.',
    'Je préfère le salé au sucré.',
    'J’ai peur des guêpes.',
    'J’ai déjà mangé une pizza entière tout seul.'
  ],
  lies: [
    'J’ai déjà rencontré le président de la République.',
    'J’ai sauté en parachute trois fois.',
    'Je parle couramment le japonais.',
    'J’ai gagné un concours de mangeurs de piments.',
    'J’ai nagé avec des requins en Australie.',
    'J’ai déjà été figurant dans un film d’action.'
  ]
};

function factsFor(personalityId: string | undefined, rng: Rng): PersonaFacts {
  const bank = personaFacts && typeof personaFacts === 'object' ? personaFacts : {};
  const own = personalityId ? bank[personalityId] : undefined;
  if (own && own.truths?.length >= 2 && own.lies?.length >= 1) return own;
  const all = Object.values(bank).filter((f) => f?.truths?.length >= 2 && f?.lies?.length >= 1);
  return all.length ? rng.pick(all) : FALLBACK;
}

/** Tire 2 vérités + 1 mensonge (en évitant les phrases déjà utilisées). */
export function drawStatements(facts: PersonaFacts, rng: Rng, used: string[] = []): { statements: string[]; lie: number } {
  const fresh = (arr: string[]) => {
    const f = arr.filter((x) => !used.includes(x));
    return f.length ? f : arr;
  };
  const truths = rng.sample(fresh(facts.truths), 2);
  const lie = rng.pick(fresh(facts.lies));
  while (truths.length < 2) truths.push(rng.pick(FALLBACK.truths));
  const statements = rng.shuffle([...truths, lie]);
  return { statements, lie: statements.indexOf(lie) };
}

// ---------- Moteur ----------

function setup(ctx: RuntimeCtx): DVState {
  const o = ctx.options;
  const active = activeIds(ctx);
  const laps = Math.max(1, Math.min(3, Number(o.laps ?? 1) || 1));
  const order = ctx.rng.shuffle(active);
  const turns: string[] = [];
  for (let i = 0; i < laps; i++) turns.push(...order);
  const s: DVState = {
    phase: 'write',
    active,
    turns,
    turn: 0,
    cur: { pid: turns[0], statements: null, lie: null, votes: {} },
    done: [],
    scores: initScores(ctx),
    opts: { ...o }
  };
  startWrite(s, ctx);
  return s;
}

function startWrite(s: DVState, ctx: RuntimeCtx) {
  const pid = s.turns[s.turn];
  s.phase = 'write';
  s.cur = { pid, statements: null, lie: null, votes: {} };
  s.deadline = ctx.now + secs(s.opts, 'writeSec', 150);
  ctx.announce(`🔥 ${nameOf(ctx, pid)} passe sur la sellette ! Écris 2 vérités et 1 mensonge sur toi.`);
}

function startVote(s: DVState, ctx: RuntimeCtx) {
  s.phase = 'vote';
  s.deadline = ctx.now + secs(s.opts, 'voteSec', 60);
  const st = s.cur.statements!;
  ctx.announce(`${nameOf(ctx, s.cur.pid)} affirme : 1️⃣ ${st[0]} 2️⃣ ${st[1]} 3️⃣ ${st[2]} — Où est le mensonge ?`);
}

function reveal(s: DVState, ctx: RuntimeCtx) {
  const cur = s.cur;
  const lie = cur.lie!;
  const gained: Record<string, number> = {};
  const voters = Object.keys(cur.votes);
  const right = voters.filter((id) => cur.votes[id] === lie);
  const fooled = voters.length - right.length;
  const ptsRight = Number(s.opts.pointsRight ?? 2);
  for (const id of right) gained[id] = ptsRight;
  gained[cur.pid] = fooled + (voters.length > 0 && right.length === 0 ? 2 : 0);
  for (const [id, p] of Object.entries(gained)) s.scores[id] = (s.scores[id] ?? 0) + p;
  s.done.push({ ...cur, gained });
  s.phase = 'reveal';
  s.deadline = ctx.now + secs(s.opts, 'revealSec', 9);
  const who = nameOf(ctx, cur.pid);
  ctx.announce(
    `Le mensonge de ${who} était le n°${lie + 1} : « ${cur.statements![lie]} ». ` +
      (right.length === 0 && voters.length ? `Personne ne l’a trouvé, ${who} a berné tout le monde ! 😈` : right.length === voters.length && voters.length ? 'Tout le monde l’a démasqué ! 🔍' : `${right.length} sur ${voters.length} l’ont trouvé.`)
  );
}

function next(s: DVState, ctx: RuntimeCtx) {
  s.turn++;
  if (s.turn >= s.turns.length) return endGame(s, ctx);
  startWrite(s, ctx);
}

function endGame(s: DVState, ctx: RuntimeCtx) {
  s.phase = 'end';
  s.deadline = undefined;
  const best = Math.max(0, ...s.active.map((id) => s.scores[id] ?? 0));
  s.winners = best > 0 ? s.active.filter((id) => (s.scores[id] ?? 0) === best) : [];
  const liar = s.done.slice().sort((a, b) => (b.gained[b.pid] ?? 0) - (a.gained[a.pid] ?? 0))[0];
  s.summary =
    `${s.winners.map((id) => nameOf(ctx, id)).join(' et ') || 'Personne'} remporte${s.winners.length > 1 ? 'nt' : ''} la partie avec ${best} pts !` +
    (liar && (liar.gained[liar.pid] ?? 0) > 0 ? ` Meilleur menteur : ${nameOf(ctx, liar.pid)} (« ${liar.statements![liar.lie!]} »).` : '');
  ctx.announce(s.summary);
}

function onAction(s: DVState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  switch (a.type) {
    case 'write': {
      if (s.phase !== 'write' || pid !== s.cur.pid) return;
      const st = Array.isArray(a.statements) ? a.statements.map((x: any) => String(x ?? '').trim().slice(0, 160)) : [];
      const lie = Number(a.lie);
      if (st.length !== 3 || st.some((x: string) => !x) || !(lie >= 0 && lie <= 2)) return;
      s.cur.statements = st;
      s.cur.lie = Math.floor(lie);
      startVote(s, ctx);
      return;
    }
    case 'vote': {
      if (s.phase !== 'vote' || pid === s.cur.pid || !s.active.includes(pid)) return;
      const c = Number(a.choice);
      if (!(c >= 0 && c <= 2)) return;
      s.cur.votes[pid] = Math.floor(c);
      if (voters(s).every((id) => s.cur.votes[id] !== undefined)) reveal(s, ctx);
      return;
    }
    case 'skip': {
      if (s.phase === 'reveal') next(s, ctx);
      return;
    }
  }
}

const voters = (s: DVState) => s.active.filter((id) => id !== s.cur.pid);

function onTick(s: DVState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  if (s.phase === 'write') {
    // Joueur absent : on tire des affirmations pour lui.
    const p = ctx.players.find((x) => x.id === s.cur.pid);
    const { statements, lie } = drawStatements(factsFor(p?.personality, ctx.rng), ctx.rng, usedStatements(s));
    s.cur.statements = statements;
    s.cur.lie = lie;
    s.cur.auto = true;
    ctx.announce(`⏱️ Temps écoulé : des affirmations ont été tirées au sort pour ${nameOf(ctx, s.cur.pid)}.`);
    startVote(s, ctx);
  } else if (s.phase === 'vote') reveal(s, ctx);
  else if (s.phase === 'reveal') next(s, ctx);
}

function usedStatements(s: DVState): string[] {
  return s.done.flatMap((d) => d.statements ?? []);
}

function view(s: DVState, pid: string | null): DVView {
  const cur = s.cur;
  const showLie = s.phase === 'reveal' || (pid === cur.pid && s.phase !== 'end');
  const last = s.done[s.done.length - 1];
  const needs: string[] = [];
  if (s.phase === 'write') needs.push(cur.pid);
  if (s.phase === 'vote') needs.push(...voters(s).filter((id) => cur.votes[id] === undefined));
  return {
    phase: s.phase,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    active: s.active,
    turn: s.turn,
    totalTurns: s.turns.length,
    hot: cur.pid,
    statements: s.phase === 'write' ? (pid === cur.pid ? cur.statements : null) : cur.statements,
    lie: showLie ? cur.lie : null,
    voted: Object.keys(cur.votes),
    myVote: pid ? cur.votes[pid] : undefined,
    votes: s.phase === 'reveal' || s.phase === 'end' ? { ...cur.votes } : undefined,
    gained: s.phase === 'reveal' ? last?.gained : undefined,
    auto: cur.auto,
    history: s.done.map((d) => ({ pid: d.pid, statements: d.statements!, lie: d.lie!, fooled: Object.values(d.votes).filter((x) => x !== d.lie).length }))
  };
}

// ---------- IA ----------

interface DVMem {
  key: string;
  actAt: number;
  talkAt: number;
  said: number;
  used: string[];
  hints: number[];
  pending: string[];
  endSaid: boolean;
}

const BOLD = /jamais|deja rencontre|rencontre|celebre|star|champion|record|million|parachute|requin|president|tele|television|film|concours|gagne|couramment|monde entier|tous les jours|chaque jour|trois fois|ferrari|japon|australie|sauve|pompier|festival|vol|avion|prison/;
const MUNDANE = /je deteste|j adore|je prefere|je dors|je mange|je bois|peur|j oublie|toujours en retard|telephone|chaussette|lit|cafe|the|pizza/;

function lieScores(v: DVView, api: AgentAPI, mem: DVMem): number[] {
  const P = personality(api.me.personality);
  const st = v.statements ?? [];
  const bank = Object.values(personaFacts ?? {});
  const recall = { facile: 0, normal: 0.3, difficile: 0.6 }[api.difficulty];
  const noise = { facile: 1.2, normal: 0.7, difficile: 0.4 }[api.difficulty] * (0.6 + P.flexible * 0.6);
  return st.map((text, i) => {
    const n = norm(text);
    let sc = 0;
    if (BOLD.test(n)) sc += 0.6;
    if (MUNDANE.test(n)) sc -= 0.3;
    if (/\d{2,}/.test(n)) sc += 0.2;
    if (n.length > 80) sc += 0.15;
    // « Culture » des IA : certaines phrases types sont connues comme des mensonges classiques
    if (api.rng.chance(recall)) {
      if (bank.some((f) => f.lies?.includes(text))) sc += 1.5;
      else if (bank.some((f) => f.truths?.includes(text))) sc -= 0.8;
    }
    sc += mem.hints.filter((h) => h === i).length * 0.35 * (0.3 + P.follow);
    sc += (api.rng.next() - 0.5) * noise;
    return sc;
  });
}

function parseHint(text: string): number | null {
  const t = norm(text);
  if (!/mensonge|faux|ment|bidon|mytho|pas vrai|invente|louche/.test(t)) return null;
  if (/\b(1|un|premier|premiere|1ere)\b/.test(t)) return 0;
  if (/\b(2|deux|deuxieme|second|seconde|2eme)\b/.test(t)) return 1;
  if (/\b(3|trois|troisieme|derniere|dernier|3eme)\b/.test(t)) return 2;
  return null;
}

const ai: AIStrategy<DVView> = {
  think(v, mind: AgentMind, api) {
    const mem = aiMem<DVMem>(mind, () => ({ key: '', actAt: 0, talkAt: 0, said: 0, used: [], hints: [], pending: [], endSaid: false }));
    const P = personality(api.me.personality);
    const me = api.me.id;
    const key = `${v.phase}-${v.turn}`;
    if (mem.key !== key) {
      mem.key = key;
      mem.said = 0;
      mem.hints = [];
      mem.pending = [];
      const think = { facile: 3000, normal: 5000, difficile: 7000 }[api.difficulty];
      mem.actAt = api.now + think + api.rng.int(0, 6000);
      mem.talkAt = api.now + 2000 + api.rng.int(0, 6000) * (1.3 - P.talk);
    }
    for (const h of newChat(api, mind)) {
      const hint = parseHint(h.msg.text);
      if (hint !== null) mem.hints.push(hint);
      if (h.toMe) mem.pending.push(h.msg.from);
    }
    switch (v.phase) {
      case 'write': {
        if (v.hot !== me || api.now < mem.actAt) return;
        const { statements, lie } = drawStatements(factsFor(api.me.personality, api.rng), api.rng, mem.used);
        mem.used.push(...statements);
        api.act({ type: 'write', statements, lie });
        if (api.rng.chance(P.talk * 0.6)) api.say(api.rng.pick(['Bonne chance pour trouver 😏', 'Celle-là va vous piéger.', 'Facile… ou pas 😇', 'Je vous préviens, je suis un pro du mensonge.']));
        return;
      }
      case 'vote': {
        if (v.hot === me) {
          // Sur la sellette : bluff et réponses
          if (api.now < mem.talkAt || mem.said >= 1 + Math.round(P.talk * 2)) return;
          mem.talkAt = api.now + 5000 + api.rng.int(0, 5000);
          const who = mem.pending.shift();
          mem.said++;
          const fake = [0, 1, 2].filter((i) => i !== v.lie);
          const tpl = who
            ? [`${nameOf(api, who)}, je dirai rien 🤐`, `Tu crois vraiment, ${nameOf(api, who)} ? 😇`, line(P, 'mentioned', api.rng, { name: nameOf(api, who) })]
            : P.bluff > 0.6
              ? [`La ${api.rng.pick(fake) + 1}, je la trouve moi-même incroyable… et pourtant c’est vrai !`, 'Tout est vrai… sauf une 😇', line(P, 'bluff', api.rng)]
              : ['J’ai hâte de voir vos votes 😅', 'Ne me regardez pas comme ça !', 'Hmm…'];
          api.say(api.rng.pick(tpl));
          return;
        }
        if (v.myVote !== undefined) return;
        if (api.now < mem.actAt) {
          // Commentaire avant de voter
          if (api.now >= mem.talkAt && mem.said < 1 && api.rng.chance(P.talk * 0.7)) {
            mem.said++;
            mem.talkAt = api.now + 6000;
            const sc = lieScores(v, api, mem);
            const guess = sc.indexOf(Math.max(...sc));
            const hot = nameOf(api, v.hot);
            api.say(
              api.rng.pick([
                `La ${guess + 1} sent le mensonge 😏`,
                `${hot}, la n°${guess + 1}, sérieusement ? 🤨`,
                `Je dirais la ${guess + 1}… mais ${hot} est fourbe.`,
                P.id === 'intello' ? `Statistiquement, la ${guess + 1} est la moins crédible.` : `Aucune idée, elles ont toutes l’air vraies !`
              ])
            );
          }
          return;
        }
        const sc = lieScores(v, api, mem);
        let choice = sc.indexOf(Math.max(...sc));
        if (P.id === 'chaotique' && api.rng.chance(0.2)) choice = api.rng.int(0, 2);
        api.act({ type: 'vote', choice });
        return;
      }
      case 'reveal': {
        if (mem.said > 0 || v.gained === undefined) return;
        mem.said++;
        const got = (v.gained[me] ?? 0) > 0;
        if (v.hot === me) {
          if (api.rng.chance(P.talk)) api.say((v.gained[me] ?? 0) > 1 ? line(P, 'win', api.rng) : api.rng.pick(['Vous me connaissez trop bien…', 'Grillé 😅', line(P, 'lose', api.rng)]));
        } else if (api.rng.chance(P.talk * 0.6)) api.say(got ? api.rng.pick(['Je le savais !', 'Trop facile 😎', 'Bien vu moi.']) : api.rng.pick(['Quoi ?! C’était vrai ça ?', 'Je me suis fait avoir…', `Bien joué ${nameOf(api, v.hot)} !`]));
        return;
      }
      case 'end': {
        if (mem.endSaid) return;
        mem.endSaid = true;
        if (api.rng.chance(P.talk * 0.6)) api.say(line(P, v.winners?.includes(me) ? 'win' : 'lose', api.rng));
        return;
      }
    }
  }
};

export const deuxVerites: GameModule<DVState, DVView> = {
  id: 'deux-verites',
  name: '2 vérités, 1 mensonge',
  family: 'mensonge',
  emoji: '🤥',
  tagline: 'Deux affirmations vraies, une fausse. Saurez-vous démasquer le menteur ?',
  rules: [
    'À tour de rôle, un joueur passe sur la sellette : il écrit 3 affirmations sur lui-même, dont UNE seule est fausse.',
    'Les autres débattent et votent pour l’affirmation qu’ils pensent être le mensonge.',
    'Chaque bon vote rapporte des points ; le menteur gagne 1 point par joueur berné (+2 s’il berne tout le monde).',
    'La partie se termine quand tout le monde est passé sur la sellette.'
  ],
  minPlayers: 2,
  maxPlayers: 12,
  usesThemes: false,
  options: [
    {
      key: 'laps',
      label: 'Passages sur la sellette',
      type: 'select',
      default: '1',
      choices: [
        { value: '1', label: 'Une fois chacun' },
        { value: '2', label: 'Deux fois chacun' },
        { value: '3', label: 'Trois fois chacun' }
      ]
    },
    { key: 'writeSec', label: 'Temps pour écrire (s)', type: 'number', min: 30, max: 300, step: 10, default: 150 },
    { key: 'voteSec', label: 'Temps de vote (s)', type: 'number', min: 15, max: 180, step: 5, default: 60 },
    { key: 'pointsRight', label: 'Points par bonne réponse', type: 'number', min: 1, max: 5, default: 2, advanced: true }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '🤥', desc: 'Chacun passe une fois', options: { laps: '1' } },
    { id: 'marathon', label: 'Marathon', emoji: '🏃', desc: 'Deux passages chacun', options: { laps: '2' } },
    { id: 'eclair', label: 'Éclair', emoji: '⚡', desc: 'Votes rapides', options: { voteSec: 25, writeSec: 90 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: DeuxVeritesBoard
};
