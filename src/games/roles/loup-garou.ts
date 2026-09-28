// 🐺 Loup-Garou : cycle nuit / jour, rôles secrets, le présentateur est l'application.
import type { AgentAPI, AgentMind, AIStrategy, GameAction, GameModule, RuntimeCtx } from '../../core/types';
import { joinNames, norm } from '../../core/text';
import { line as rawLine, personality, type LineKind, type Personality } from '../../ai/personalities';
import type { Rng } from '../../core/rng';
import { activeIds, aiMem, initScores, nameOf, newChat, secs, stable01 } from '../kit';
import { LoupGarouBoard } from './LoupGarouBoard';
import { LG_ROLE, type LGMe, type LGRole, type LGState, type LGView } from './lg-types';

export { LG_ROLE };
export type { LGRole, LGState, LGView };


// Les répliques génériques des personnalités parlent parfois d'« indice » ou de « mot » (jeux d'imposteur) : on les adapte au village.
const OFF_TOPIC = /indice|\bmot\b|imposteur|undercover/i;
const LG_LINES: Partial<Record<LineKind, string[]>> = {
  accuse: ['Je pense que {name} est un loup.', '{name}, tu joues le loup à fond.', 'Moi je vote {name}.'],
  suspect: ['{name} me paraît louche…', 'Je garde un œil sur {name}.', '{name} est trop discret, ça cache quelque chose.'],
  defend: ['Ce n’est pas moi, je vous jure !', 'Je suis du côté du village.', 'Pourquoi moi ? Regardez plutôt les autres.'],
  bluff: ['Je suis un simple villageois, rien à cacher.', 'Franchement, je suis clean.']
};
function line(P: Personality, kind: LineKind, rng: Rng, vars: Record<string, string> = {}): string {
  for (let i = 0; i < 6; i++) {
    const l = rawLine(P, kind, rng, vars);
    if (!OFF_TOPIC.test(l)) return l;
  }
  let t = rng.pick(LG_LINES[kind] ?? ['Hmm…']);
  for (const [k, v] of Object.entries(vars)) t = t.split(`{${k}}`).join(v);
  return t;
}

// ---------- Mise en place ----------

function wolfCount(n: number, opt: any): number {
  const o = Number(opt);
  if (Number.isFinite(o) && o > 0) return Math.max(1, Math.min(o, Math.floor((n - 1) / 2)));
  return n <= 6 ? 1 : n <= 11 ? 2 : n <= 15 ? 3 : 4;
}

function setup(ctx: RuntimeCtx): LGState {
  const o = ctx.options;
  const active = activeIds(ctx);
  const n = active.length;
  const nWolves = wolfCount(n, o.wolves === 'auto' ? 0 : o.wolves);
  const specials: LGRole[] = [];
  if (o.voyante !== false) specials.push('voyante');
  if (o.garde !== false) specials.push('garde');
  if (o.complice && n >= 7) specials.push('complice');
  if (o.bouffon) specials.push('bouffon');
  // Au moins un simple villageois ou un rôle du village en plus des loups.
  while (specials.length > Math.max(0, n - nWolves - 1)) specials.pop();
  const deck: LGRole[] = [...Array(nWolves).fill('loup'), ...specials];
  while (deck.length < n) deck.push('villageois');
  const shuffled = ctx.rng.shuffle(deck);
  const roles: Record<string, LGRole> = {};
  active.forEach((id, i) => (roles[id] = shuffled[i]));
  const s: LGState = {
    phase: 'reveal',
    day: 0,
    active,
    alive: [...active],
    roles,
    ready: [],
    wolfVotes: {},
    seerPick: null,
    guardPick: null,
    lastGuarded: null,
    nightDone: [],
    seerResults: [],
    lastNight: null,
    votes: {},
    history: [],
    deaths: [],
    kinds: Object.fromEntries(ctx.players.map((p) => [p.id, p.kind])),
    scores: initScores(ctx),
    deadline: ctx.now + 45_000,
    opts: { ...o }
  };
  const comp = composition(s);
  ctx.announce(
    `Bienvenue au village ! ${n} habitants, dont ${nWolves} loup${nWolves > 1 ? 's' : ''}-garou${nWolves > 1 ? 's' : ''}. ` +
      `Rôles en jeu : ${Object.entries(comp)
        .map(([r, c]) => `${LG_ROLE[r as LGRole].emoji} ${LG_ROLE[r as LGRole].label}${c! > 1 ? ' ×' + c : ''}`)
        .join(', ')}. Découvrez votre carte en secret…`
  );
  return s;
}

function composition(s: LGState): Partial<Record<LGRole, number>> {
  const c: Partial<Record<LGRole, number>> = {};
  for (const id of s.active) c[s.roles[id]] = (c[s.roles[id]] ?? 0) + 1;
  return c;
}

// ---------- Aides ----------

const isWolf = (s: LGState, id: string) => s.roles[id] === 'loup';
const aliveWolves = (s: LGState) => s.alive.filter((id) => isWolf(s, id));

/** Acteurs de la nuit encore vivants. */
function nightActors(s: LGState): string[] {
  return s.alive.filter((id) => ['loup', 'voyante', 'garde'].includes(s.roles[id]));
}

function actorDone(s: LGState, id: string): boolean {
  const r = s.roles[id];
  if (r === 'loup') return s.wolfVotes[id] !== undefined;
  if (r === 'voyante') return s.seerPick !== null;
  if (r === 'garde') return s.guardPick !== null;
  return true;
}

/** Joueurs dont on attend quelque chose cette nuit : tous les humains vivants (pour ne rien trahir) + les acteurs IA. */
function nightNeeds(s: LGState): string[] {
  return s.alive.filter((id) => {
    const actor = nightActors(s).includes(id);
    if (s.kinds[id] === 'human') return !s.nightDone.includes(id) || (actor && !actorDone(s, id));
    return actor && !actorDone(s, id);
  });
}

function revealRoles(s: LGState) {
  return s.opts.revealRole !== false;
}

// ---------- Transitions ----------

function startNight(s: LGState, ctx: RuntimeCtx) {
  s.phase = 'night';
  s.day++;
  s.wolfVotes = {};
  s.seerPick = null;
  s.guardPick = null;
  s.nightDone = [];
  s.ready = [];
  s.votes = {};
  s.deadline = ctx.now + secs(s.opts, 'nightSec', 40);
  ctx.announce(`🌙 Nuit ${s.day}. Le village s’endort… Loups, choisissez votre victime. ${s.alive.some((id) => s.roles[id] === 'voyante') ? 'Détective, inspectez quelqu’un. ' : ''}${s.alive.some((id) => s.roles[id] === 'garde') ? 'Ange gardien, protégez quelqu’un.' : ''}`);
}

function checkNightEnd(s: LGState, ctx: RuntimeCtx) {
  if (s.phase === 'night' && nightNeeds(s).length === 0) resolveNight(s, ctx);
}

function resolveNight(s: LGState, ctx: RuntimeCtx) {
  const wolves = aliveWolves(s);
  const tally: Record<string, number> = {};
  for (const w of wolves) {
    const t = s.wolfVotes[w];
    if (t && s.alive.includes(t)) tally[t] = (tally[t] ?? 0) + 1;
  }
  let victim: string | null = null;
  const best = Math.max(0, ...Object.values(tally));
  if (best > 0) victim = ctx.rng.pick(Object.keys(tally).filter((id) => tally[id] === best));
  else if (wolves.length) {
    // Loups absents : ils attaquent quelqu'un au hasard.
    const prey = s.alive.filter((id) => !isWolf(s, id));
    victim = prey.length ? ctx.rng.pick(prey) : null;
  }
  const saved = !!victim && s.guardPick === victim;
  s.lastGuarded = s.guardPick;
  if (victim && !saved) {
    s.alive = s.alive.filter((id) => id !== victim);
    s.deaths.push({ day: s.day, pid: victim, cause: 'loups', role: revealRoles(s) ? s.roles[victim] : undefined });
  }
  s.lastNight = { victim: saved ? null : victim, saved };
  if (victim && !saved) {
    const r = s.roles[victim];
    ctx.announce(`☀️ Le jour se lève… ${nameOf(ctx, victim)} a été dévoré${revealRoles(s) ? ` cette nuit. C’était ${article(r)} ${LG_ROLE[r].emoji}.` : ' cette nuit.'}`);
  } else if (saved) ctx.announce('☀️ Le jour se lève… Les loups ont attaqué, mais l’Ange gardien veillait : personne n’est mort cette nuit !');
  else ctx.announce('☀️ Le jour se lève… Miracle, personne n’est mort cette nuit.');
  if (checkWin(s, ctx)) return;
  startDay(s, ctx);
}

function startDay(s: LGState, ctx: RuntimeCtx) {
  s.phase = 'day';
  s.ready = [];
  s.deadline = ctx.now + secs(s.opts, 'daySec', 120);
  ctx.announce(`Débat du jour ${s.day} : qui sont les loups ? Discutez, puis votez.`);
}

function startVote(s: LGState, ctx: RuntimeCtx) {
  s.phase = 'vote';
  s.votes = {};
  s.deadline = ctx.now + secs(s.opts, 'voteSec', 45);
  ctx.announce('🗳️ Aux votes ! Qui le village élimine-t-il ? (vous pouvez voter « personne »)');
}

function resolveVote(s: LGState, ctx: RuntimeCtx) {
  const tally: Record<string, number> = {};
  for (const v of Object.values(s.votes)) tally[v] = (tally[v] ?? 0) + 1;
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const tie = !top || (sorted.length > 1 && sorted[1][1] === top[1]);
  let lynched: string | null = null;
  let text: string;
  if (!top) text = 'Personne n’a voté : le village reste indécis.';
  else if (tie) text = 'Égalité ! Le village n’arrive pas à se décider, personne n’est éliminé.';
  else if (top[0] === 'personne') text = 'Le village décide de n’éliminer personne aujourd’hui.';
  else {
    lynched = top[0];
    const r = s.roles[lynched];
    text = `Le village élimine ${nameOf(ctx, lynched)}${revealRoles(s) || r === 'bouffon' ? ` : c’était ${article(r)} ${LG_ROLE[r].emoji} !` : '.'}`;
  }
  s.history.push({ day: s.day, votes: { ...s.votes }, lynched, role: lynched && (revealRoles(s) || s.roles[lynched] === 'bouffon') ? s.roles[lynched] : undefined, text });
  if (lynched) {
    s.alive = s.alive.filter((id) => id !== lynched);
    s.deaths.push({ day: s.day, pid: lynched, cause: 'vote', role: revealRoles(s) ? s.roles[lynched] : undefined });
  }
  ctx.announce(text);
  if (lynched && s.roles[lynched] === 'bouffon') {
    return endGame(s, ctx, [lynched], `🃏 ${nameOf(ctx, lynched)} était le Bouffon… et voulait justement être éliminé ! Il gagne seul.`, 5);
  }
  s.phase = 'verdict';
  s.deadline = ctx.now + 7000;
}

function afterVerdict(s: LGState, ctx: RuntimeCtx) {
  if (checkWin(s, ctx)) return;
  startNight(s, ctx);
}

function checkWin(s: LGState, ctx: RuntimeCtx): boolean {
  const wolves = aliveWolves(s);
  const wolfTeam = s.alive.filter((id) => LG_ROLE[s.roles[id]].team === 'loups');
  const others = s.alive.length - wolfTeam.length;
  const village = s.active.filter((id) => LG_ROLE[s.roles[id]].team === 'village');
  const wolvesAll = s.active.filter((id) => LG_ROLE[s.roles[id]].team === 'loups');
  if (!wolves.length) {
    endGame(s, ctx, village, `🎉 Tous les loups sont morts : victoire du village ! (Loups : ${joinNames(s.active.filter((id) => isWolf(s, id)).map((id) => nameOf(ctx, id)))})`, 3);
    return true;
  }
  if (wolfTeam.length >= others || s.day >= 15) {
    endGame(s, ctx, wolvesAll, `🐺 Les loups sont aussi nombreux que les villageois : ils dévorent le village ! (${joinNames(wolvesAll.map((id) => nameOf(ctx, id)))})`, 4);
    return true;
  }
  return false;
}

function endGame(s: LGState, ctx: RuntimeCtx, winners: string[], summary: string, pts: number) {
  s.phase = 'end';
  s.deadline = undefined;
  s.winners = winners;
  s.summary = summary;
  winners.forEach((id) => (s.scores[id] = (s.scores[id] ?? 0) + pts));
  // bonus de survie
  s.alive.forEach((id) => winners.includes(id) && (s.scores[id] += 1));
  ctx.announce(summary);
}

function article(r: LGRole): string {
  return { loup: 'un Loup-Garou', villageois: 'un Villageois', voyante: 'le Détective', garde: 'l’Ange gardien', bouffon: 'le Bouffon', complice: 'le Complice' }[r];
}

// ---------- Actions ----------

function onAction(s: LGState, pid: string, a: GameAction, ctx: RuntimeCtx) {
  const alive = s.alive.includes(pid);
  switch (a.type) {
    case 'ready': {
      if (s.phase === 'reveal') {
        if (s.active.includes(pid) && !s.ready.includes(pid)) s.ready.push(pid);
        if (s.active.every((id) => s.ready.includes(id))) startNight(s, ctx);
      } else if (s.phase === 'day' && alive) {
        if (!s.ready.includes(pid)) s.ready.push(pid);
        if (s.alive.every((id) => s.ready.includes(id))) startVote(s, ctx);
      }
      return;
    }
    case 'skip': {
      if (s.phase === 'reveal') startNight(s, ctx);
      else if (s.phase === 'day') startVote(s, ctx);
      else if (s.phase === 'verdict') afterVerdict(s, ctx);
      return;
    }
    case 'night': {
      if (s.phase !== 'night' || !alive) return;
      const r = s.roles[pid];
      const t = String(a.target ?? '');
      if (r === 'loup') {
        if (!s.alive.includes(t) || isWolf(s, t)) return;
        s.wolfVotes[pid] = t;
      } else if (r === 'voyante') {
        if (s.seerPick !== null || !s.alive.includes(t) || t === pid) return;
        s.seerPick = t;
        s.seerResults.push({ day: s.day, target: t, wolf: isWolf(s, t) });
      } else if (r === 'garde') {
        if (s.guardPick !== null || !s.alive.includes(t) || t === s.lastGuarded) return;
        s.guardPick = t;
      } else return;
      if (!s.nightDone.includes(pid)) s.nightDone.push(pid);
      checkNightEnd(s, ctx);
      return;
    }
    case 'sleep': {
      // Humain sans pouvoir (ou ayant fini) : confirme qu'il dort.
      if (s.phase !== 'night' || !alive) return;
      if (nightActors(s).includes(pid) && !actorDone(s, pid)) return;
      if (!s.nightDone.includes(pid)) s.nightDone.push(pid);
      checkNightEnd(s, ctx);
      return;
    }
    case 'vote': {
      if (s.phase !== 'vote' || !alive) return;
      const t = String(a.target ?? '');
      if (t !== 'personne' && (!s.alive.includes(t) || t === pid)) return;
      s.votes[pid] = t;
      if (s.alive.every((id) => s.votes[id] !== undefined)) resolveVote(s, ctx);
      return;
    }
  }
}

function onTick(s: LGState, ctx: RuntimeCtx) {
  if (!s.deadline || ctx.now < s.deadline) return;
  switch (s.phase) {
    case 'reveal':
      return startNight(s, ctx);
    case 'night':
      return resolveNight(s, ctx);
    case 'day':
      return startVote(s, ctx);
    case 'vote':
      return resolveVote(s, ctx);
    case 'verdict':
      return afterVerdict(s, ctx);
  }
}

// ---------- Vue ----------

function view(s: LGState, pid: string | null): LGView {
  const role = pid ? s.roles[pid] : undefined;
  let me: LGMe | null = null;
  if (pid && role) {
    const knowsWolves = role === 'loup' || role === 'complice';
    me = {
      role,
      alive: s.alive.includes(pid),
      wolves: knowsWolves ? s.active.filter((id) => isWolf(s, id)) : undefined,
      seerResults: role === 'voyante' ? s.seerResults : undefined,
      lastGuarded: role === 'garde' ? s.lastGuarded : undefined,
      done: s.phase === 'night' ? s.nightDone.includes(pid) || (nightActors(s).includes(pid) && actorDone(s, pid) && s.kinds[pid] !== 'human') : false,
      myTarget: s.phase === 'night' ? (role === 'loup' ? s.wolfVotes[pid] ?? null : role === 'voyante' ? s.seerPick : role === 'garde' ? s.guardPick : null) : null,
      isNightActor: ['loup', 'voyante', 'garde'].includes(role)
    };
  }
  const needs: string[] = [];
  if (s.phase === 'reveal') needs.push(...s.active.filter((id) => !s.ready.includes(id)));
  if (s.phase === 'night') needs.push(...nightNeeds(s));
  if (s.phase === 'vote') needs.push(...s.alive.filter((id) => s.votes[id] === undefined));
  const end = s.phase === 'end';
  return {
    phase: s.phase,
    needs,
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    day: s.day,
    active: s.active,
    alive: s.alive,
    me,
    wolfVotes: role === 'loup' && s.phase === 'night' ? { ...s.wolfVotes } : undefined,
    ready: s.ready,
    voted: Object.keys(s.votes),
    myVote: pid ? s.votes[pid] : undefined,
    lastNight: s.lastNight,
    history: s.history,
    deaths: s.deaths,
    composition: composition(s),
    revealRoles: revealRoles(s),
    reveal: end ? { ...s.roles } : undefined
  };
}

// ---------- IA ----------

interface LGMem {
  key: string;
  sus: Record<string, number>;
  /** Joueurs connus loups / innocents (Détective, révélations). */
  wolves: string[];
  clean: string[];
  /** Qui a accusé qui (auteur → cibles). */
  accused: Record<string, string[]>;
  /** Joueurs qui se sont déclarés Détective. */
  seerClaims: string[];
  said: number;
  talkAt: number;
  actAt: number;
  phaseStart: number;
  pending: { kind: 'defend' | 'mentioned' | 'agree'; who: string; about?: string }[];
  revealed: string[];
  heard: string[];
  historySeen: number;
  deathsSeen: number;
  endSaid: boolean;
  greeted: boolean;
}

const ACCUSE_RE = /loup|louche|suspect|\bsus\b|ment|menteur|je vote|votez|elimin|grill|coupable|bizarre|pas clair|accuse/;
const DEFEND_RE = /innocent|pas (un )?loup|confiance|clean|villageois|crois pas|sincere|gentil/;
const CLAIM_RE = /(je suis|moi c est) (la |le )?(voyante|detective)|j ai (inspecte|vu|sonde|regarde)|(voyante|detective) ici/;

function think(v: LGView, mind: AgentMind, api: AgentAPI) {
  const mem = aiMem<LGMem>(mind, () => ({
    key: '',
    sus: {},
    wolves: [],
    clean: [],
    accused: {},
    seerClaims: [],
    said: 0,
    talkAt: 0,
    actAt: 0,
    phaseStart: 0,
    pending: [],
    revealed: [],
    heard: [],
    historySeen: 0,
    deathsSeen: 0,
    endSaid: false,
    greeted: false
  }));
  const me = api.me.id;
  const P = personality(api.me.personality);
  const role = v.me?.role;
  const key = `${v.phase}-${v.day}`;
  if (mem.key !== key) {
    mem.key = key;
    mem.said = 0;
    mem.phaseStart = api.now;
    mem.actAt = api.now + 1500 + api.rng.int(0, 4000);
    mem.talkAt = api.now + 1500 + api.rng.int(0, 5000) * (1.3 - P.talk);
  }
  learn(v, mem, api, P);
  readChat(v, mem, mind, api, P);
  if (!v.me) return;
  const myWolves = v.me.wolves ?? [];
  const wolfSide = role === 'loup' || role === 'complice';

  switch (v.phase) {
    case 'reveal': {
      if (v.ready.includes(me) || api.now < mem.actAt) return;
      api.act({ type: 'ready' });
      if (!mem.greeted && api.rng.chance(P.talk * 0.3)) {
        mem.greeted = true;
        api.say(line(P, 'hello', api.rng));
      }
      return;
    }
    case 'night': {
      if (!v.me.alive || !v.me.isNightActor || api.now < mem.actAt) return;
      if (role === 'loup') {
        const target = wolfTarget(v, mem, api, myWolves);
        if (target && v.wolfVotes?.[me] !== target) api.act({ type: 'night', target });
        mem.actAt = api.now + 4000; // peut se rallier à ses complices ensuite
      } else if (!v.me.done && role === 'voyante') {
        const inspected = new Set((v.me.seerResults ?? []).map((r) => r.target));
        const pool = v.alive.filter((id) => id !== me && !inspected.has(id));
        const t = pool.sort((a, b) => score(mem, b) - score(mem, a))[0] ?? v.alive.find((id) => id !== me);
        if (t) api.act({ type: 'night', target: t });
      } else if (!v.me.done && role === 'garde') {
        const pool = v.alive.filter((id) => id !== v.me!.lastGuarded);
        const claim = mem.seerClaims.find((id) => pool.includes(id) && !mem.wolves.includes(id));
        let t = claim;
        if (!t) {
          // protège quelqu'un de confiance ou soi-même
          const trusted = pool.filter((id) => id !== me).sort((a, b) => score(mem, a) - score(mem, b));
          t = pool.includes(me) && api.rng.chance(0.35) ? me : trusted[0] ?? pool[0];
        }
        if (t) api.act({ type: 'night', target: t });
      }
      return;
    }
    case 'day':
      return discuss(v, mem, api, P, wolfSide, myWolves);
    case 'vote': {
      if (!v.me.alive || v.voted.includes(me) || api.now < mem.actAt) return;
      const t = chooseVote(v, mem, api, P, wolfSide, myWolves);
      if (t !== 'personne' && api.rng.chance(P.talk * 0.35)) api.say(line(P, 'accuse', api.rng, { name: nameOf(api, t) }));
      api.act({ type: 'vote', target: t });
      return;
    }
    case 'end': {
      if (mem.endSaid) return;
      mem.endSaid = true;
      if (api.rng.chance(P.talk * 0.7)) api.say(line(P, v.winners?.includes(me) ? 'win' : 'lose', api.rng));
      return;
    }
  }
}

function score(mem: LGMem, id: string): number {
  if (mem.wolves.includes(id)) return 5;
  if (mem.clean.includes(id)) return -5;
  return mem.sus[id] ?? 0;
}

function bump(mem: LGMem, id: string, d: number) {
  mem.sus[id] = (mem.sus[id] ?? 0) + d;
}

/** Lit la vue et le chat : résultats du Détective, morts, votes passés, accusations. */
function learn(v: LGView, mem: LGMem, api: AgentAPI, P: Personality) {
  const me = api.me.id;
  for (const r of v.me?.seerResults ?? []) {
    if (r.wolf && !mem.wolves.includes(r.target)) mem.wolves.push(r.target);
    if (!r.wolf && !mem.clean.includes(r.target)) mem.clean.push(r.target);
  }
  for (const w of v.me?.wolves ?? []) if (!mem.wolves.includes(w)) mem.wolves.push(w);
  // Morts de la nuit : ceux qui accusaient la victime deviennent un peu suspects… et ceux que la victime accusait aussi.
  for (const d of v.deaths.slice(mem.deathsSeen)) {
    if (d.cause === 'loups') {
      for (const t of mem.accused[d.pid] ?? []) bump(mem, t, 0.5);
      if (mem.seerClaims.includes(d.pid)) for (const t of mem.accused[d.pid] ?? []) bump(mem, t, 1.2);
    }
    if (d.role === 'loup' && !mem.wolves.includes(d.pid)) mem.wolves.push(d.pid);
    if (d.role && d.role !== 'loup' && !mem.clean.includes(d.pid)) mem.clean.push(d.pid);
  }
  mem.deathsSeen = v.deaths.length;
  // Votes passés : voter contre un loup révélé = confiance, contre un innocent révélé = soupçon.
  for (const h of v.history.slice(mem.historySeen)) {
    if (!h.lynched) continue;
    for (const [voter, t] of Object.entries(h.votes)) {
      if (voter === me) continue;
      if (t === h.lynched && h.role === 'loup') bump(mem, voter, -0.6);
      if (t === h.lynched && h.role && h.role !== 'loup') bump(mem, voter, 0.35);
      if (h.role === 'loup' && t !== h.lynched) bump(mem, voter, 0.3);
    }
  }
  mem.historySeen = v.history.length;
  // Chat
  // (mind.lastChatSeen est géré par l'hôte, on lit via newChat)
  void P;
}

function readChat(v: LGView, mem: LGMem, mind: AgentMind, api: AgentAPI, P: Personality) {
  const me = api.me.id;
  for (const h of newChat(api, mind)) {
    const from = h.msg.from;
    if (!v.alive.includes(from)) continue;
    const claim = CLAIM_RE.test(h.text);
    const accuse = ACCUSE_RE.test(h.text) && !/pas (un )?loup/.test(h.text);
    const defend = DEFEND_RE.test(h.text);
    if (claim && !mem.seerClaims.includes(from)) {
      mem.seerClaims.push(from);
      // Double revendication : l'une des deux est fausse
      if (v.me?.role === 'voyante' && from !== me) bump(mem, from, 3);
    }
    for (const t of h.mentions) {
      if (accuse) {
        (mem.accused[from] ??= []).includes(t) || mem.accused[from].push(t);
        const trustClaim = claim && v.me?.role !== 'voyante' ? 1.2 : 0;
        // Chaque joueur ne pèse qu'un peu par accusation (évite l'effet boule de neige sans preuve)
        const k = `${from}>${t}@${v.day}`;
        const already = mem.heard.includes(k);
        if (!already) mem.heard.push(k);
        bump(mem, t, (already ? 0.03 : 0.1 + 0.25 * P.follow) + trustClaim - Math.max(0, mem.sus[from] ?? 0) * 0.1);
        // Accuser quelqu'un que je sais innocent → suspect
        if (mem.clean.includes(t) && from !== me) bump(mem, from, 0.5);
        if (mem.wolves.includes(t)) bump(mem, from, -0.4);
      }
      if (defend) {
        bump(mem, t, claim ? -1.2 : -0.2);
        if (mem.wolves.includes(t) && !v.me?.wolves?.includes(t)) bump(mem, from, 0.6);
      }
    }
    const isReply = /^(oui|tu me parles|je t ecoute)/.test(h.text);
    if (h.toMe && accuse) mem.pending.push({ kind: 'defend', who: from });
    else if (h.toMe && !isReply && /\?/.test(h.msg.text) && api.rng.chance(0.4 + P.talk * 0.4)) mem.pending.push({ kind: 'mentioned', who: from });
    else if (accuse && h.mentions.length && api.rng.chance(P.follow * 0.4)) mem.pending.push({ kind: 'agree', who: from, about: h.mentions[0] });
  }
  if (mem.pending.length > 3) mem.pending.splice(0, mem.pending.length - 3);
}

function wolfTarget(v: LGView, mem: LGMem, api: AgentAPI, wolves: string[]): string | undefined {
  const me = api.me.id;
  const prey = v.alive.filter((id) => !wolves.includes(id));
  if (!prey.length) return undefined;
  // Se rallier au choix d'un autre loup (coordination)
  const others = Object.entries(v.wolfVotes ?? {}).filter(([w]) => w !== me).map(([, t]) => t).filter((t) => prey.includes(t));
  if (others.length && api.rng.chance(0.8)) {
    const count: Record<string, number> = {};
    others.forEach((t) => (count[t] = (count[t] ?? 0) + 1));
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
  }
  const current = v.wolfVotes?.[me];
  if (current && prey.includes(current)) return current;
  // Menaces : Détective déclaré, ceux qui accusent des loups
  const threat = (id: string) => {
    let t = stable01(id + me + v.day) * 0.5;
    if (mem.seerClaims.includes(id)) t += 3;
    for (const w of wolves) if ((mem.accused[id] ?? []).includes(w)) t += 1.2;
    t -= (mem.sus[id] ?? 0) * 0.4; // les suspects servent de boucs émissaires le jour : on les garde
    return t;
  };
  return prey.sort((a, b) => threat(b) - threat(a))[0];
}

function discuss(v: LGView, mem: LGMem, api: AgentAPI, P: Personality, wolfSide: boolean, wolves: string[]) {
  const me = api.me.id;
  if (!v.me?.alive) return;
  if (api.now < mem.talkAt) return;
  // Laisse le temps aux humains de lire et de parler avant de se déclarer prêt.
  const daySec = Number(api.options.daySec ?? 120) * 1000;
  const mayReady = api.now - mem.phaseStart > Math.min(45_000, daySec * 0.4);
  const maxMsgs = 1 + Math.round(P.talk * 3);
  if (mem.said >= maxMsgs + mem.pending.length) {
    if (mayReady && !v.ready.includes(me) && api.rng.chance(0.3)) api.act({ type: 'ready' });
    return;
  }
  const msg = compose(v, mem, api, P, wolfSide, wolves);
  mem.talkAt = api.now + 4000 + api.rng.int(0, 7000) * (1.3 - P.talk);
  if (msg) {
    mem.said++;
    api.say(msg);
  } else if (mayReady && !v.ready.includes(me) && api.rng.chance(0.4)) api.act({ type: 'ready' });
}

function compose(v: LGView, mem: LGMem, api: AgentAPI, P: Personality, wolfSide: boolean, wolves: string[]): string | null {
  const rng = api.rng;
  const me = api.me.id;
  const role = v.me!.role;
  const nm = (id: string) => nameOf(api, id);
  const others = v.alive.filter((id) => id !== me);
  const suspects = others.filter((id) => !(wolfSide && wolves.includes(id))).sort((a, b) => score(mem, b) - score(mem, a));
  const scapegoat = () => {
    const pool = others.filter((id) => !wolves.includes(id));
    return pool.sort((a, b) => (mem.sus[b] ?? 0) + (mem.seerClaims.includes(b) ? 2 : 0) - ((mem.sus[a] ?? 0) + (mem.seerClaims.includes(a) ? 2 : 0)))[0];
  };

  const pend = mem.pending.shift();
  if (pend) {
    if (pend.kind === 'defend') {
      if (role === 'bouffon') return rng.pick(['Moi ? Peut-être… ou peut-être pas 😏', 'Allez-y, votez pour moi si vous êtes si sûrs !', 'Hmm, vous avez peut-être raison… 🙃']);
      const counter = wolfSide ? scapegoat() : suspects[0];
      const base =
        role === 'voyante' && mem.revealed.length
          ? rng.pick(['Je suis le Détective, je vous l’ai dit ! Écoutez-moi.', 'Si vous m’éliminez, vous perdez votre Détective…'])
          : rng.pick([line(P, 'defend', rng), 'Je suis villageois, je vous jure !', 'Pas moi, je suis du côté du village.']);
      return counter && rng.chance(P.aggro) ? `${base} ${line(P, 'suspect', rng, { name: nm(counter) })}` : base;
    }
    if (pend.kind === 'mentioned') {
      const t = wolfSide ? scapegoat() : suspects[0];
      return `${line(P, 'mentioned', rng, { name: nm(pend.who) })} ${t && score(mem, t) > 0.3 ? line(P, 'suspect', rng, { name: nm(t) }) : line(P, 'unsure', rng)}`;
    }
    if (pend.kind === 'agree' && pend.about) {
      if (wolfSide && wolves.includes(pend.about)) return line(P, 'disagree', rng, { name: nm(pend.who) });
      if (!wolfSide && mem.clean.includes(pend.about)) return line(P, 'disagree', rng, { name: nm(pend.who) });
      return rng.chance(P.follow + 0.2) ? line(P, 'agree', rng, { name: nm(pend.who) }) : null;
    }
  }

  // Détective : révèle un loup trouvé selon sa personnalité
  if (role === 'voyante') {
    const found = (v.me!.seerResults ?? []).filter((r) => v.alive.includes(r.target) && !mem.revealed.includes(r.target));
    const wolf = found.find((r) => r.wolf);
    const boldness = 0.25 + P.aggro * 0.5 + P.talk * 0.3 + (v.alive.length <= 5 ? 0.3 : 0);
    if (wolf && rng.chance(boldness)) {
      mem.revealed.push(wolf.target);
      return rng.pick([
        `Je suis le Détective : ${nm(wolf.target)} est un loup ! J’ai inspecté cette nuit.`,
        `J’ai inspecté ${nm(wolf.target)} : c’est un LOUP. Votez ${nm(wolf.target)} !`,
        `Détective ici. ${nm(wolf.target)} est loup, j’en suis certain.`
      ]);
    }
    const clean = found.find((r) => !r.wolf);
    if (clean && mem.said > 0 && rng.chance(0.2 + P.talk * 0.2)) {
      mem.revealed.push(clean.target);
      return `J’ai des infos : ${nm(clean.target)} est innocent, faites-moi confiance.`;
    }
  }

  // Bouffon : se rend suspect exprès
  if (role === 'bouffon') {
    const t = rng.pick(others);
    return rng.pick([
      'Si j’étais un loup, vous le sauriez pas, hein 😏',
      `Je défends ${nm(t)}, c’est sûrement pas un loup… enfin je crois.`,
      'Moi je dis qu’on devrait voter contre le plus bizarre. Genre moi ? 🙃',
      'J’ai rien vu cette nuit. Rien du tout. Promis. 👀',
      `Hmm ${nm(t)}… non, rien.`
    ]);
  }

  if (mem.said >= 1 + Math.round(P.talk * 3)) return null;

  if (wolfSide) {
    // Loup : faux Détective parfois (gros bluffeurs), sinon accuse un bouc émissaire
    const t = scapegoat();
    if (!t) return line(P, 'unsure', rng);
    if (role === 'loup' && P.bluff >= 0.9 && v.day >= 2 && !mem.revealed.length && rng.chance(0.25)) {
      mem.revealed.push(t);
      return `Je vais être honnête : je suis le Détective. ${nm(t)} est un loup.`;
    }
    const victim = v.lastNight?.victim;
    if (victim && rng.chance(0.3)) return `Pauvre ${nm(victim)}… ${line(P, 'suspect', rng, { name: nm(t) })}`;
    return line(P, rng.chance(P.aggro) ? 'accuse' : 'suspect', rng, { name: nm(t) });
  }

  const top = suspects[0];
  const s = top ? score(mem, top) : 0;
  if (top && mem.wolves.includes(top) && role !== 'voyante') return line(P, 'accuse', rng, { name: nm(top) });
  if (top && s > 1 + (1 - P.aggro)) return line(P, 'accuse', rng, { name: nm(top) });
  if (top && s > 0.4) return line(P, 'suspect', rng, { name: nm(top) });
  const victim = v.lastNight?.victim;
  if (victim && mem.said === 0 && rng.chance(0.5)) {
    const accusers = Object.entries(mem.accused).filter(([, ts]) => ts.includes(victim)).map(([a]) => a).filter((a) => v.alive.includes(a) && a !== me);
    if (accusers.length) return `${nm(victim)} a été tué… et ${nm(accusers[0])} l’accusait hier. Étrange, non ?`;
    return rng.pick([`RIP ${nm(victim)} 😢 Qui avait intérêt à l’éliminer ?`, `${nm(victim)} en savait peut-être trop…`]);
  }
  if (v.lastNight?.saved && mem.said === 0 && rng.chance(0.4)) return 'L’Ange gardien a bien joué cette nuit 👏';
  const clean = [...others].sort((a, b) => score(mem, a) - score(mem, b))[0];
  if (clean && score(mem, clean) < -0.5 && rng.chance(0.4)) return line(P, 'innocent', rng, { name: nm(clean) });
  return mem.said === 0 ? line(P, 'unsure', rng) : null;
}

function chooseVote(v: LGView, mem: LGMem, api: AgentAPI, P: Personality, wolfSide: boolean, wolves: string[]): string {
  const me = api.me.id;
  const role = v.me!.role;
  const others = v.alive.filter((id) => id !== me);
  if (!others.length) return 'personne';
  if (role === 'bouffon') return api.rng.chance(0.3) ? 'personne' : api.rng.pick(others);
  if (wolfSide) {
    // Vote avec la foule contre un non-loup, jamais contre un loup
    const pool = others.filter((id) => !wolves.includes(id));
    if (!pool.length) return 'personne';
    return pool.sort((a, b) => (mem.sus[b] ?? 0) + (mem.seerClaims.includes(b) ? 1.5 : 0) - ((mem.sus[a] ?? 0) + (mem.seerClaims.includes(a) ? 1.5 : 0)))[0];
  }
  const ranked = others.sort((a, b) => score(mem, b) - score(mem, a));
  let t = ranked[0];
  const noise = api.difficulty === 'facile' ? 0.4 : api.difficulty === 'difficile' ? 0.08 : 0.2;
  if (api.rng.chance(noise + (P.id === 'chaotique' ? 0.2 : 0))) t = api.rng.pick(others);
  if (score(mem, t) < 0.2 && !mem.wolves.includes(t) && api.rng.chance(0.4 - P.aggro * 0.3) && v.day === 1) return 'personne';
  return t;
}

const ai: AIStrategy<LGView> = { think };

// ---------- Module ----------

export const loupGarou: GameModule<LGState, LGView> = {
  id: 'loup-garou',
  name: 'Loup-Garou',
  family: 'roles',
  emoji: '🐺',
  tagline: 'La nuit, les loups dévorent. Le jour, le village vote. Qui ment ?',
  rules: [
    'Chacun reçoit un rôle secret : Loup-Garou, Villageois, Détective, Ange gardien… (et parfois Bouffon ou Complice).',
    'La nuit, les loups choisissent ensemble une victime ; le Détective inspecte un joueur ; l’Ange gardien protège quelqu’un.',
    'Le jour, le présentateur annonce qui est mort. Le village débat puis vote pour éliminer un suspect (ou personne).',
    'Le village gagne quand tous les loups sont morts ; les loups gagnent quand ils sont aussi nombreux que les autres. Le Bouffon gagne seul s’il est éliminé au vote.'
  ],
  minPlayers: 5,
  maxPlayers: 16,
  usesThemes: false,
  options: [
    {
      key: 'wolves',
      label: 'Nombre de loups',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Automatique (selon le nombre de joueurs)' },
        { value: '1', label: '1 loup' },
        { value: '2', label: '2 loups' },
        { value: '3', label: '3 loups' },
        { value: '4', label: '4 loups' }
      ]
    },
    { key: 'voyante', label: '🔮 Détective (inspecte un joueur par nuit)', type: 'toggle', default: true },
    { key: 'garde', label: '😇 Ange gardien (protège un joueur par nuit)', type: 'toggle', default: true },
    { key: 'bouffon', label: '🃏 Bouffon (gagne seul s’il est éliminé au vote)', type: 'toggle', default: false },
    { key: 'complice', label: '🦹 Complice des loups (7 joueurs et +)', type: 'toggle', default: false },
    { key: 'revealRole', label: 'Révéler le rôle des morts', type: 'toggle', default: true },
    { key: 'nightSec', label: 'Durée de la nuit (s)', type: 'number', min: 20, max: 120, step: 5, default: 40, advanced: true },
    { key: 'daySec', label: 'Durée du débat (s)', type: 'number', min: 30, max: 400, step: 10, default: 120 },
    { key: 'voteSec', label: 'Durée du vote (s)', type: 'number', min: 15, max: 120, step: 5, default: 45, advanced: true }
  ],
  presets: [
    { id: 'classique', label: 'Classique', emoji: '🐺', desc: 'Loups, Détective, Ange gardien', options: { voyante: true, garde: true, bouffon: false, complice: false } },
    { id: 'chaos', label: 'Chaos', emoji: '🃏', desc: 'Avec Bouffon et Complice', options: { voyante: true, garde: true, bouffon: true, complice: true } },
    { id: 'mystere', label: 'Rôles cachés', emoji: '🙈', desc: 'Les rôles des morts restent secrets', options: { revealRole: false } },
    { id: 'eclair', label: 'Éclair', emoji: '⚡', desc: 'Nuits et débats courts', options: { nightSec: 25, daySec: 60, voteSec: 25 } }
  ],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai,
  Board: LoupGarouBoard
};

