// Moteur commun à tous les jeux « trouver l'imposteur » :
// distribution secrète → indices → débat → vote → révélation → (dernière chance) → fin.
// Chaque jeu (Imposteur, Question piège, Caméléon, Espion, Artiste, Faux fan…) fournit
// seulement sa façon de distribuer les secrets et le type d'indice.
import type { BaseState, BaseView, GameAction, OptionDef, Player, RuntimeCtx } from '../../core/types';
import type { Item, Pack } from '../../content/types';
import { norm, joinNames, keywords, fuzzyEq } from '../../core/text';

export type Role = 'civil' | 'undercover' | 'mrwhite' | 'imposteur' | 'teamA' | 'teamB' | 'pair' | 'solo';
export const BAD_ROLES: Role[] = ['undercover', 'mrwhite', 'imposteur'];

export const ROLE_LABEL: Record<Role, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mrwhite: 'Mr. White',
  imposteur: 'Imposteur',
  teamA: 'Équipe A',
  teamB: 'Équipe B',
  pair: 'Membre de la paire',
  solo: 'Solitaire'
};

export type ClueKind = 'word' | 'phrase' | 'emoji' | 'answer' | 'drawing' | 'qa';

export interface Secret {
  role: Role;
  /** Mot / personnage / lieu / question reçu (null = rien). */
  word: string | null;
  /** Emoji associé au mot, pour l'affichage. */
  emoji?: string;
  /** Indice vague (variante « faux indice ») ou rôle dans le lieu (espion). */
  hint?: string;
  knowsRole: boolean;
  allies?: string[];
  /** Pour la Question piège : type et plage de réponse de SA question. */
  answerHint?: { answer: string; range?: [number, number]; examples?: string[] };
  forbidden?: string[];
}

export interface PublicInfo {
  title: string;
  subtitle?: string;
  packId?: string;
  theme?: string;
  grid?: string[];
  category?: string;
  /** Révélé après les réponses (Question piège). */
  question?: string;
  letter?: string;
}

export interface Stroke {
  color: string;
  pts: [number, number][];
}

export interface Clue {
  pid: string;
  round: number;
  text: string;
  strokes?: Stroke;
  target?: string;
  answer?: string;
  /** Numéro du vote précédent (sépare les manches d'indices). */
  stage?: number;
}

export interface AssignResult {
  secrets: Record<string, Secret>;
  publicInfo: PublicInfo;
  solution: string;
  guessOptions?: string[];
  /** Aucun imposteur dans cette manche (manche piège). */
  trap?: boolean;
  /** Mode de fin particulier. */
  special?: 'equipes' | 'paire';
}

export interface DeductionConfig {
  clueKind: ClueKind | ((opts: Record<string, any>) => ClueKind);
  assign(ctx: RuntimeCtx, active: Player[]): AssignResult;
  candidates(pub: PublicInfo, packs: Pack[]): Item[];
  lookup(word: string, pub: PublicInfo, packs: Pack[]): Item | undefined;
  prompt(round: number, pub: PublicInfo, kind: ClueKind): string;
  lastChanceRoles: Role[];
  /** Nombre de tours d'indices par défaut. */
  defaultRounds?: number;
}

export type Phase = 'reveal' | 'clues' | 'discussion' | 'vote' | 'result' | 'lastChance' | 'end';

export interface VoteResult {
  tally: Record<string, number>;
  eliminated: string | null;
  tie: boolean;
  role?: Role;
  word?: string | null;
  text: string;
}

export interface DState extends BaseState {
  phase: Phase;
  kind: ClueKind;
  round: number;
  cluesRounds: number;
  order: string[];
  turn: number;
  /** Tours d'indices joués depuis le dernier vote. */
  stageRound: number;
  /** Espion : étape de la question en cours. */
  qa?: { asker: string; target?: string; question?: string; count: number };
  active: string[];
  alive: string[];
  secrets: Record<string, Secret>;
  pub: PublicInfo;
  solution: string;
  guessOptions: string[];
  clues: Clue[];
  ready: string[];
  votes: Record<string, any>;
  results: VoteResult[];
  events: string[];
  notes: Record<string, string[]>;
  muted: string[];
  doubleVote?: string;
  guess?: { pid: string; text: string; correct: boolean };
  trap: boolean;
  special?: 'equipes' | 'paire';
  answersRevealed: boolean;
  spectatorGuesses: Record<string, string>;
  resultUntil?: number;
  opts: Record<string, any>;
}

export interface DView extends BaseView {
  phase: Phase;
  kind: ClueKind;
  round: number;
  cluesRounds: number;
  pub: PublicInfo;
  me: (Secret & { alive: boolean; spectator: boolean }) | null;
  roleLabel: string | null;
  alive: string[];
  active: string[];
  order: string[];
  current: string | null;
  qa?: DState['qa'];
  clues: (Clue & { hidden?: boolean })[];
  voted: string[];
  ready: string[];
  results: VoteResult[];
  events: string[];
  notes: string[];
  muted: string[];
  prompt: string;
  guessOptions: string[];
  guess?: DState['guess'];
  voteMode: string;
  special?: 'equipes' | 'paire';
  trapPossible: boolean;
  lastChanceFor: string | null;
  reveal?: Record<string, Secret>;
  maxAllies: number;
  myVote?: any;
}

// ---------- Options communes ----------

export const COMMON_OPTIONS: OptionDef[] = [
  { key: 'cluesRounds', label: 'Tours d’indices avant le débat', type: 'number', min: 1, max: 3, default: 1 },
  { key: 'clueSec', label: 'Temps par indice (s)', type: 'number', min: 15, max: 120, step: 5, default: 40 },
  { key: 'discussionSec', label: 'Temps de débat (s)', type: 'number', min: 20, max: 300, step: 10, default: 90 },
  { key: 'voteSec', label: 'Temps de vote (s)', type: 'number', min: 15, max: 120, step: 5, default: 40, advanced: true },
  {
    key: 'voteMode',
    label: 'Vote',
    type: 'select',
    default: 'unique',
    choices: [
      { value: 'unique', label: 'Vote unique à la fin' },
      { value: 'elimination', label: 'Élimination tour par tour' },
      { value: 'points', label: 'Mise de 3 jetons de soupçon' }
    ]
  },
  { key: 'lastChance', label: 'Dernière chance : l’imposteur démasqué peut deviner le mot', type: 'toggle', default: true },
  { key: 'revealRole', label: 'Révéler le rôle des éliminés', type: 'toggle', default: true, advanced: true },
  { key: 'twists', label: '🌪️ Rebondissements surprise', type: 'toggle', default: false },
  { key: 'spectator', label: '🔎 Mode enquêteur (les humains observent les IA)', type: 'toggle', default: false, advanced: true }
];

// ---------- Création ----------

export function createState(cfg: DeductionConfig, ctx: RuntimeCtx): DState {
  const o = ctx.options;
  const activePlayers = ctx.players.filter((p) => !p.spectator && !(o.spectator && p.kind === 'human'));
  const a = cfg.assign(ctx, activePlayers);
  const kind = typeof cfg.clueKind === 'function' ? cfg.clueKind(o) : cfg.clueKind;
  const active = activePlayers.map((p) => p.id);
  const s: DState = {
    phase: 'reveal',
    kind,
    round: 1,
    cluesRounds: Number(o.cluesRounds ?? cfg.defaultRounds ?? 1),
    order: ctx.rng.shuffle(active),
    turn: 0,
    stageRound: 1,
    active,
    alive: [...active],
    secrets: a.secrets,
    pub: a.publicInfo,
    solution: a.solution,
    guessOptions: a.guessOptions ?? [],
    clues: [],
    ready: [],
    votes: {},
    results: [],
    events: [],
    notes: {},
    muted: [],
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    trap: !!a.trap,
    special: a.special,
    answersRevealed: false,
    spectatorGuesses: {},
    deadline: ctx.now + 60_000,
    opts: { ...o }
  };
  ctx.announce(`${a.publicInfo.title}${a.publicInfo.subtitle ? ' — ' + a.publicInfo.subtitle : ''}. Regardez votre carte secrète !`);
  return s;
}

// ---------- Transitions ----------

function sec(s: DState, key: string, def: number): number {
  return Number(s.opts[key] ?? def) * 1000;
}

function name(ctx: RuntimeCtx | { players: Player[] }, id: string): string {
  return ctx.players.find((p) => p.id === id)?.name ?? '?';
}

function startClues(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  s.phase = 'clues';
  s.ready = [];
  s.order = s.order.filter((id) => s.alive.includes(id));
  s.turn = 0;
  s.stageRound = 1;
  if (s.kind === 'qa') {
    const asker = s.order[0];
    s.qa = { asker, count: 0 };
  }
  if (s.opts.clueMode === 'lettre') {
    s.pub.letter = ctx.rng.pick('ABCDEFGHIJLMNOPRSTV'.split(''));
  }
  s.deadline = ctx.now + sec(s, 'clueSec', 40) * (s.kind === 'answer' ? 1.5 : 1);
  const p = cfg.prompt(s.round, s.pub, s.kind);
  ctx.announce(s.round > 1 ? `Tour ${s.round} — ${p}` : p);
}

function startDiscussion(s: DState, ctx: RuntimeCtx) {
  s.phase = 'discussion';
  s.ready = [];
  s.muted = [];
  s.doubleVote = undefined;
  if (s.kind === 'answer') s.answersRevealed = true;
  let dur = sec(s, 'discussionSec', 90);
  if (s.opts.twists && ctx.rng.chance(0.6)) dur = applyTwist(s, ctx, dur);
  s.deadline = ctx.now + dur;
  if (s.kind === 'answer' && s.pub.question) ctx.announce(`Tout le monde a répondu ! La vraie question était : « ${s.pub.question} ». Qui a répondu à côté ?`);
  else ctx.announce('Place au débat ! Qui est l’imposteur ?');
}

function startVote(s: DState, ctx: RuntimeCtx) {
  s.phase = 'vote';
  s.votes = {};
  s.deadline = ctx.now + sec(s, 'voteSec', 40);
  ctx.announce(s.special === 'equipes' ? 'Votez pour les joueurs que vous pensez dans VOTRE équipe.' : s.special === 'paire' ? 'Votez pour un joueur que vous pensez dans la paire.' : 'À vous de voter !');
}

function applyTwist(s: DState, ctx: RuntimeCtx, dur: number): number {
  const alive = s.alive;
  const twist = ctx.rng.pick(['echange', 'muet', 'double', 'revelation', 'turbo', 'turbo'] as const);
  const note = (pid: string, text: string) => (s.notes[pid] = [...(s.notes[pid] ?? []), text]);
  let pub = '';
  if (twist === 'echange' && alive.length >= 3 && !s.special) {
    const candidates = alive.filter((id) => s.secrets[id].role !== 'mrwhite');
    if (candidates.length >= 2) {
      const [x, y] = ctx.rng.sample(candidates, 2);
      const sx = s.secrets[x];
      s.secrets[x] = s.secrets[y];
      s.secrets[y] = sx;
      note(x, `🌪️ Ta carte a été échangée avec celle de ${name(ctx, y)} ! Ton nouveau mot : ${s.secrets[x].word ?? '(aucun)'}`);
      note(y, `🌪️ Ta carte a été échangée avec celle de ${name(ctx, x)} ! Ton nouveau mot : ${s.secrets[y].word ?? '(aucun)'}`);
      pub = 'Deux joueurs ont secrètement échangé leurs cartes !';
    }
  } else if (twist === 'muet') {
    const m = ctx.rng.pick(alive);
    s.muted = [m];
    pub = `${name(ctx, m)} est muet pendant ce débat 🤐 (il peut seulement voter).`;
  } else if (twist === 'double') {
    const d = ctx.rng.pick(alive);
    s.doubleVote = d;
    note(d, '🌪️ Ton vote comptera double à ce tour. Garde-le secret !');
    pub = 'Un joueur a reçu un vote double secret…';
  } else if (twist === 'revelation') {
    const good = alive.filter((id) => !BAD_ROLES.includes(s.secrets[id].role));
    if (good.length >= 2) {
      const [who, clean] = ctx.rng.sample(good, 2);
      note(who, `🌪️ Info secrète : ${name(ctx, clean)} est innocent.`);
      pub = 'Un joueur a reçu une information secrète…';
    }
  }
  if (!pub) {
    pub = 'Chrono turbo : le débat dure deux fois moins longtemps ⚡';
    dur = Math.max(15_000, dur / 2);
  }
  s.events.push(pub);
  ctx.announce('🌪️ Rebondissement : ' + pub);
  return dur;
}

function nextClueTurn(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  s.turn++;
  if (s.turn >= s.order.length) {
    if (s.stageRound < s.cluesRounds) {
      s.turn = 0;
      s.stageRound++;
      s.round++;
      if (s.opts.clueMode === 'lettre') s.pub.letter = ctx.rng.pick('ABCDEFGHIJLMNOPRSTV'.split(''));
      ctx.announce(`Nouveau tour d’indices. ${cfg.prompt(s.round, s.pub, s.kind)}`);
    } else {
      startDiscussion(s, ctx);
      return;
    }
  }
  s.deadline = ctx.now + sec(s, 'clueSec', 40);
}

function validClue(s: DState, pid: string, text: string): string | null {
  const t = text.trim();
  if (!t) return 'Indice vide';
  const sec = s.secrets[pid];
  const n = norm(t);
  if (sec?.word && s.kind !== 'answer') {
    const w = norm(sec.word);
    if (n.includes(w) || keywords(sec.word).some((k) => k.length >= 4 && keywords(t).includes(k))) return 'Tu ne peux pas dire ton mot !';
  }
  if (s.opts.clueMode === 'mot' && s.kind === 'word' && t.split(/\s+/).length > 2) return 'Un seul mot !';
  if (s.opts.clueMode === 'lettre' && s.pub.letter && !n.startsWith(s.pub.letter.toLowerCase())) return `Ton indice doit commencer par ${s.pub.letter}`;
  if (s.opts.clueMode === 'emoji' && /[a-z0-9]/i.test(t)) return 'Emojis uniquement !';
  if (sec?.forbidden?.some((f) => keywords(t).includes(norm(f)))) return 'Mot interdit !';
  return null;
}

// ---------- Actions ----------

export function onAction(cfg: DeductionConfig, s: DState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  const isActive = s.active.includes(pid);
  const isAlive = s.alive.includes(pid);
  switch (a.type) {
    case 'ready': {
      if (!s.ready.includes(pid)) s.ready.push(pid);
      if (s.phase === 'reveal' && s.active.every((id) => s.ready.includes(id))) startClues(cfg, s, ctx);
      if (s.phase === 'discussion' && s.alive.every((id) => s.ready.includes(id))) startVote(s, ctx);
      return;
    }
    case 'skip': {
      // L'hôte (ou le téléphone en pass-and-play) force la suite.
      if (s.phase === 'reveal') startClues(cfg, s, ctx);
      else if (s.phase === 'discussion') startVote(s, ctx);
      else if (s.phase === 'result') afterResult(cfg, s, ctx);
      return;
    }
    case 'clue': {
      if (s.phase !== 'clues' || !isAlive) return;
      if (s.kind === 'answer') {
        if (s.clues.some((c) => c.pid === pid && c.round === s.round && (c as any).stage === s.results.length)) return;
        const t = String(a.text ?? '').trim().slice(0, 60);
        if (!t) return;
        s.clues.push({ pid, round: s.round, text: t, stage: s.results.length } as Clue);
        const done = s.alive.every((id) => s.clues.some((c) => c.pid === id && (c as any).stage === s.results.length));
        if (done) startDiscussion(s, ctx);
        return;
      }
      if (s.kind === 'qa') return onQA(cfg, s, pid, a, ctx);
      if (s.order[s.turn] !== pid) return;
      if (s.kind === 'drawing') {
        const st = a.stroke as Stroke | undefined;
        if (!st || !Array.isArray(st.pts) || st.pts.length < 2) return;
        const pts = st.pts.slice(0, 80).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as [number, number]);
        s.clues.push({ pid, round: s.round, text: String(a.text ?? '').slice(0, 30), strokes: { color: st.color, pts }, stage: s.results.length } as Clue);
      } else {
        const text = String(a.text ?? '').slice(0, 120);
        const err = validClue(s, pid, text);
        if (err) {
          s.notes[pid] = [...(s.notes[pid] ?? []), '⚠️ ' + err];
          return;
        }
        s.clues.push({ pid, round: s.round, text: text.trim(), stage: s.results.length } as Clue);
      }
      nextClueTurn(cfg, s, ctx);
      return;
    }
    case 'vote': {
      if (s.phase !== 'vote') return;
      if (!isActive) {
        // spectateur (mode enquêteur) : son pronostic est noté mais ne compte pas
        if (typeof a.target === 'string') s.spectatorGuesses[pid] = a.target;
        return;
      }
      if (!isAlive) return;
      s.votes[pid] = a.target;
      if (s.alive.every((id) => s.votes[id] !== undefined)) resolveVote(cfg, s, ctx);
      return;
    }
    case 'guess': {
      if (s.phase !== 'lastChance' || s.guess || !lastChanceFor(s)) return;
      if (lastChanceFor(s) !== pid) return;
      const text = String(a.text ?? '');
      const correct = fuzzyEq(text, s.solution) || norm(text) === norm(s.solution);
      s.guess = { pid, text, correct };
      finishLastChance(cfg, s, ctx);
      return;
    }
  }
}

function onQA(cfg: DeductionConfig, s: DState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  const qa = s.qa!;
  if (!qa.question) {
    if (pid !== qa.asker) return;
    const target = String(a.target ?? '');
    const q = String(a.text ?? '').trim().slice(0, 140);
    if (!s.alive.includes(target) || target === pid || !q) return;
    qa.target = target;
    qa.question = q;
    s.deadline = ctx.now + sec(s, 'clueSec', 40);
    return;
  }
  if (pid !== qa.target) return;
  const ans = String(a.text ?? '').trim().slice(0, 140);
  if (!ans) return;
  s.clues.push({ pid: qa.asker, target: qa.target, round: s.round, text: qa.question, answer: ans, stage: s.results.length } as Clue);
  qa.count++;
  const total = s.alive.length * s.cluesRounds;
  if (qa.count >= total) {
    s.qa = undefined;
    startDiscussion(s, ctx);
    return;
  }
  s.qa = { asker: qa.target, count: qa.count };
  s.deadline = ctx.now + sec(s, 'clueSec', 40);
  void cfg;
}

function tallyVotes(s: DState): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const [voter, v] of Object.entries(s.votes)) {
    const w = s.doubleVote === voter ? 2 : 1;
    if (s.opts.voteMode === 'points' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [t, n] of Object.entries(v as Record<string, number>)) tally[t] = (tally[t] ?? 0) + Number(n) * w;
    } else if (Array.isArray(v)) {
      v.forEach((t) => (tally[t] = (tally[t] ?? 0) + w));
    } else if (typeof v === 'string' && v) {
      tally[v] = (tally[v] ?? 0) + w;
    }
  }
  return tally;
}

function resolveVote(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  const tally = tallyVotes(s);
  if (s.special) return resolveSpecial(s, ctx, tally);
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const tie = !top || (sorted.length > 1 && sorted[1][1] === top[1]);
  let eliminated: string | null = null;
  let text = '';
  if (!top) text = 'Personne n’a voté.';
  else if (tie) text = 'Égalité ! Personne n’est éliminé.';
  else if (top[0] === 'personne') text = 'La majorité pense qu’il n’y a pas d’imposteur…';
  else {
    eliminated = top[0];
    const sec = s.secrets[eliminated];
    text = `${name(ctx, eliminated)} est éliminé${s.opts.revealRole !== false ? ` : c’était ${article(sec.role)} !` : '.'}`;
  }
  const res: VoteResult = { tally, eliminated, tie, text };
  if (eliminated && s.opts.revealRole !== false) {
    res.role = s.secrets[eliminated].role;
    res.word = s.secrets[eliminated].word;
  }
  s.results.push(res);
  if (eliminated) s.alive = s.alive.filter((id) => id !== eliminated);
  s.phase = 'result';
  s.resultUntil = ctx.now + 7000;
  s.deadline = s.resultUntil;
  ctx.announce(text);
  void cfg;
}

function article(r: Role): string {
  return { civil: 'un Civil', undercover: 'l’Undercover', mrwhite: 'Mr. White', imposteur: 'l’Imposteur', teamA: 'un membre de l’équipe A', teamB: 'un membre de l’équipe B', pair: 'un membre de la paire', solo: 'un solitaire' }[r];
}

function afterResult(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  const last = s.results[s.results.length - 1];
  const mode = s.opts.voteMode ?? 'unique';
  // Manche piège : aucun imposteur.
  if (s.trap) {
    const correct = last?.tally && Object.entries(last.tally).sort((a, b) => b[1] - a[1])[0]?.[0] === 'personne';
    return endGame(s, ctx, correct ? s.active : [], correct ? 'Bien vu : il n’y avait AUCUN imposteur !' : 'Piège ! Il n’y avait aucun imposteur dans cette manche 😈', correct ? 3 : 0);
  }
  if (last?.eliminated) {
    const role = s.secrets[last.eliminated].role;
    if (BAD_ROLES.includes(role) && s.opts.lastChance !== false && cfg.lastChanceRoles.includes(role)) {
      s.phase = 'lastChance';
      s.deadline = ctx.now + 35_000;
      ctx.announce(`Dernière chance pour ${name(ctx, last.eliminated)} : devine le mot des civils !`);
      return;
    }
  }
  checkEndOrContinue(cfg, s, ctx, mode);
}

function checkEndOrContinue(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx, mode: string) {
  const bad = s.alive.filter((id) => BAD_ROLES.includes(s.secrets[id].role));
  const good = s.alive.filter((id) => !BAD_ROLES.includes(s.secrets[id].role));
  const allBad = s.active.filter((id) => BAD_ROLES.includes(s.secrets[id].role));
  const allGood = s.active.filter((id) => !BAD_ROLES.includes(s.secrets[id].role));
  const last = s.results[s.results.length - 1];
  if (mode !== 'elimination') {
    const caught = last?.eliminated && BAD_ROLES.includes(s.secrets[last.eliminated].role);
    if (caught) return endGame(s, ctx, allGood, `Les civils ont démasqué ${name(ctx, last!.eliminated!)} !`, 2);
    return endGame(s, ctx, allBad, `${joinNames(allBad.map((id) => name(ctx, id)))} ${allBad.length > 1 ? 'ont' : 'a'} berné tout le monde !`, 4);
  }
  if (!bad.length) return endGame(s, ctx, allGood, 'Tous les imposteurs sont éliminés : victoire des civils !', 2);
  if (bad.length >= good.length || s.alive.length <= 2) return endGame(s, ctx, allBad, 'Les imposteurs sont aussi nombreux que les civils : victoire des imposteurs !', 4);
  // Nouveau tour d'indices
  s.round++;
  startClues(cfg, s, ctx);
}

function finishLastChance(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  const g = s.guess;
  const who = lastChanceFor(s)!;
  if (g?.correct) {
    ctx.announce(`${name(ctx, who)} a trouvé le mot « ${s.solution} » ! Retournement de situation !`);
    return endGame(s, ctx, [who], `${name(ctx, who)} était démasqué… mais a deviné le mot « ${s.solution} » et vole la victoire !`, 5);
  }
  ctx.announce(g ? `Raté ! « ${g.text} » n’était pas le bon mot.` : 'Temps écoulé !');
  const allGood = s.active.filter((id) => !BAD_ROLES.includes(s.secrets[id].role));
  if ((s.opts.voteMode ?? 'unique') === 'elimination') {
    const bad = s.alive.filter((id) => BAD_ROLES.includes(s.secrets[id].role));
    const good = s.alive.filter((id) => !BAD_ROLES.includes(s.secrets[id].role));
    if (bad.length && bad.length < good.length && s.alive.length > 2) {
      s.round++;
      s.guess = undefined;
      startClues(cfg, s, ctx);
      return;
    }
    if (bad.length) return endGame(s, ctx, s.active.filter((id) => BAD_ROLES.includes(s.secrets[id].role)), 'Les imposteurs restants l’emportent !', 4);
  }
  return endGame(s, ctx, allGood, `Victoire des civils ! Le mot était « ${s.solution} ».`, 2);
}

function resolveSpecial(s: DState, ctx: RuntimeCtx, tally: Record<string, number>) {
  const pts: Record<string, number> = {};
  const lines: string[] = [];
  if (s.special === 'equipes') {
    for (const id of s.active) {
      const picks: string[] = Array.isArray(s.votes[id]) ? s.votes[id] : [];
      const mine = s.secrets[id].role;
      let p = 0;
      picks.forEach((t) => (p += s.secrets[t]?.role === mine ? 1 : -1));
      pts[id] = Math.max(0, p);
    }
    const a = s.active.filter((id) => s.secrets[id].role === 'teamA').map((id) => name(ctx, id));
    const b = s.active.filter((id) => s.secrets[id].role === 'teamB').map((id) => name(ctx, id));
    lines.push(`Équipe A (${s.secrets[s.active.find((id) => s.secrets[id].role === 'teamA')!].word}) : ${joinNames(a)}`);
    lines.push(`Équipe B (${s.secrets[s.active.find((id) => s.secrets[id].role === 'teamB')!].word}) : ${joinNames(b)}`);
  } else {
    const pair = s.active.filter((id) => s.secrets[id].role === 'pair');
    for (const id of s.active) {
      const t = s.votes[id];
      if (pair.includes(id)) pts[id] = pair.includes(t) && t !== id ? 3 : 0;
      else pts[id] = pair.includes(t) ? 1 : 0;
    }
    lines.push(`La paire était : ${joinNames(pair.map((id) => name(ctx, id)))} (« ${s.solution} »)`);
  }
  s.results.push({ tally, eliminated: null, tie: false, text: lines.join(' — ') });
  const best = Math.max(0, ...Object.values(pts));
  const winners = best > 0 ? Object.keys(pts).filter((id) => pts[id] === best) : [];
  for (const [id, p] of Object.entries(pts)) s.scores[id] = (s.scores[id] ?? 0) + p;
  endGame(s, ctx, winners, lines.join('\n'), 0);
}

function endGame(s: DState, ctx: RuntimeCtx, winners: string[], summary: string, pts: number) {
  s.phase = 'end';
  s.deadline = undefined;
  s.winners = winners;
  s.summary = summary;
  winners.forEach((id) => (s.scores[id] = (s.scores[id] ?? 0) + pts));
  // pronostics des spectateurs (mode enquêteur)
  const culprits = s.active.filter((id) => BAD_ROLES.includes(s.secrets[id].role));
  for (const [spec, guess] of Object.entries(s.spectatorGuesses)) {
    if (culprits.includes(guess)) {
      s.scores[spec] = (s.scores[spec] ?? 0) + 3;
      s.winners = [...(s.winners ?? []), spec];
    }
  }
  ctx.announce(summary);
}

export function lastChanceFor(s: DState): string | null {
  const last = s.results[s.results.length - 1];
  return last?.eliminated ?? null;
}

// ---------- Temps ----------

export function onTick(cfg: DeductionConfig, s: DState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  switch (s.phase) {
    case 'reveal':
      startClues(cfg, s, ctx);
      break;
    case 'clues':
      if (s.kind === 'answer') {
        s.alive.forEach((id) => {
          if (!s.clues.some((c) => c.pid === id && (c as any).stage === s.results.length)) s.clues.push({ pid: id, round: s.round, text: '…', stage: s.results.length } as Clue);
        });
        startDiscussion(s, ctx);
      } else if (s.kind === 'qa') {
        const qa = s.qa!;
        if (!qa.question) {
          const target = ctx.rng.pick(s.alive.filter((id) => id !== qa.asker));
          onQA(cfg, s, qa.asker, { type: 'clue', target, text: 'Tu peux me décrire ce que tu fais ici ?' }, ctx);
        } else onQA(cfg, s, qa.target!, { type: 'clue', text: '… (pas de réponse)' }, ctx);
      } else {
        s.clues.push({ pid: s.order[s.turn], round: s.round, text: '⏱️ (temps écoulé)', stage: s.results.length } as Clue);
        nextClueTurn(cfg, s, ctx);
      }
      break;
    case 'discussion':
      startVote(s, ctx);
      break;
    case 'vote':
      resolveVote(cfg, s, ctx);
      break;
    case 'result':
      afterResult(cfg, s, ctx);
      break;
    case 'lastChance':
      finishLastChance(cfg, s, ctx);
      break;
  }
}

// ---------- Vue par joueur ----------

export function makeView(cfg: DeductionConfig, s: DState, pid: string | null, ctx: { players: Player[] }): DView {
  const stage = s.results.length;
  const secret = pid ? s.secrets[pid] : undefined;
  const spectator = !!pid && !s.active.includes(pid);
  let me: DView['me'] = null;
  if (secret) {
    me = {
      ...secret,
      // un joueur qui ne connaît pas son rôle se croit civil
      role: secret.knowsRole ? secret.role : 'civil',
      allies: secret.allies,
      alive: s.alive.includes(pid!),
      spectator: false
    };
  } else if (spectator) {
    me = { role: 'solo', word: null, knowsRole: false, alive: false, spectator: true };
  }
  const clues = s.clues.map((c) => {
    const hidden = s.kind === 'answer' && (c as any).stage === stage && !s.answersRevealed && c.pid !== pid;
    return hidden ? { ...c, text: '✅ a répondu', hidden: true } : c;
  });
  const needs: string[] = [];
  let current: string | null = null;
  if (s.phase === 'reveal') needs.push(...s.active.filter((id) => !s.ready.includes(id)));
  if (s.phase === 'clues') {
    if (s.kind === 'answer') needs.push(...s.alive.filter((id) => !s.clues.some((c) => c.pid === id && (c as any).stage === stage)));
    else if (s.kind === 'qa' && s.qa) {
      current = s.qa.question ? s.qa.target! : s.qa.asker;
      needs.push(current);
    } else {
      current = s.order[s.turn] ?? null;
      if (current) needs.push(current);
    }
  }
  if (s.phase === 'vote') needs.push(...s.alive.filter((id) => s.votes[id] === undefined));
  const lc = s.phase === 'lastChance' ? lastChanceFor(s) : null;
  if (lc) needs.push(lc);
  const roleLabel = me ? (me.spectator ? 'Enquêteur' : me.knowsRole ? ROLE_LABEL[me.role] : null) : null;
  const maxAllies = s.special === 'equipes' ? Math.ceil(s.active.length / 2) - 1 : 1;
  return {
    phase: s.phase,
    kind: s.kind,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    round: s.round,
    cluesRounds: s.cluesRounds,
    pub: s.kind === 'answer' && !s.answersRevealed ? { ...s.pub, question: undefined } : s.pub,
    me,
    roleLabel,
    alive: s.alive,
    active: s.active,
    order: s.order,
    current,
    qa: s.qa,
    clues,
    voted: Object.keys(s.votes),
    ready: s.ready,
    results: s.results,
    events: s.events,
    notes: pid ? s.notes[pid] ?? [] : [],
    muted: s.muted,
    prompt: cfg.prompt(s.round, s.pub, s.kind),
    guessOptions: s.guessOptions,
    guess: s.guess,
    voteMode: s.opts.voteMode ?? 'unique',
    special: s.special,
    trapPossible: Number(s.opts.trapChance ?? 0) > 0,
    lastChanceFor: lc,
    reveal: s.phase === 'end' ? s.secrets : undefined,
    maxAllies,
    myVote: pid ? (s.phase === 'vote' ? s.votes[pid] : undefined) ?? s.spectatorGuesses[pid] : undefined
  };
}

export function isBad(r: Role) {
  return BAD_ROLES.includes(r);
}

export { name as playerName };
