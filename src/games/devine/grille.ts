// 🧑‍🤝‍🧑 Qui est-ce ? : 2 joueurs, une grille de 24 éléments, chacun un secret.
// Les questions sont répondues automatiquement (et honnêtement) par le jeu.
import type { AgentAPI, AgentMind, BaseState, BaseView, GameModule, RuntimeCtx } from '../../core/types';
import type { Item } from '../../content/types';
import { answerQuestion, bestSplitTag, matchesItem, questionForTag } from '../../content';
import { norm } from '../../core/text';
import { activeIds, aiChance, aiEnd, aiMem, aiReady, aiSay, askedTags, choosePack, copyItem, mini, nameOf, packFor, pickLine, sec, simAnswer, stripAsk, suggest, thinkMs, zeroScores, type Answer, type MiniItem } from './common';
import { GrilleBoard } from './GrilleBoard';

export interface GrLog {
  pid: string;
  text: string;
  answer: Answer | 'correct' | 'faux';
  guess?: boolean;
}

export interface GrState extends BaseState {
  phase: 'play' | 'end';
  duo: string[];
  turn: string;
  packId: string;
  packName: string;
  packEmoji: string;
  grid: Item[];
  secrets: Record<string, string>;
  crossed: Record<string, string[]>;
  log: GrLog[];
  sugg: Record<string, string[]>;
  turnMs: number;
  turns: number;
  maxTurns: number;
  note: Record<string, string>;
}

export interface GrView extends BaseView {
  phase: GrState['phase'];
  duo: string[];
  turn: string | null;
  packName: string;
  packEmoji: string;
  packId: string;
  grid: MiniItem[];
  mySecret: MiniItem | null;
  crossed: string[];
  oppRemaining: Record<string, number>;
  log: GrLog[];
  suggestions: string[];
  note: string | null;
  reveal: Record<string, MiniItem> | null;
  turns: number;
  maxTurns: number;
}

const GRID = 24;

function other(s: GrState, pid: string) {
  return s.duo.find((id) => id !== pid)!;
}

function refreshSugg(s: GrState, ctx: RuntimeCtx, pid: string) {
  const pack = packFor(ctx.packs, s.packId);
  const crossed = new Set(s.crossed[pid] ?? []);
  const rest = s.grid.filter((i) => !crossed.has(i.name));
  const asked = s.log.filter((l) => l.pid === pid).map((l) => l.text);
  // uniquement des attributs présents dans la grille
  const sub = pack ? { ...pack, attributes: pack.attributes.filter((a) => s.grid.some((i) => i.tags.includes(a.tag))) } : undefined;
  s.sugg[pid] = suggest(sub, rest.length ? rest : s.grid, asked, 8);
}

function endGrille(s: GrState, ctx: RuntimeCtx, winner: string | null, text: string) {
  s.phase = 'end';
  s.deadline = undefined;
  s.winners = winner ? [winner] : [];
  if (winner) s.scores[winner] = (s.scores[winner] ?? 0) + 5;
  const secrets = s.duo.map((id) => `${nameOf(ctx, id)} : ${s.grid.find((i) => i.name === s.secrets[id])?.emoji ?? ''} ${s.secrets[id]}`);
  s.summary = `${text}\n${secrets.join('\n')}`;
  ctx.announce(text);
}

function passTurn(s: GrState, ctx: RuntimeCtx) {
  s.turns++;
  if (s.turns >= s.maxTurns) return endGrille(s, ctx, null, '⏱️ Limite de tours atteinte : match nul !');
  s.turn = other(s, s.turn);
  s.deadline = ctx.now + s.turnMs;
}

function setup(ctx: RuntimeCtx): GrState {
  const duo = activeIds(ctx).slice(0, 2);
  const pack = choosePack(ctx.packs, ctx.rng, GRID);
  const grid = ctx.rng.sample(pack.items, Math.min(GRID, pack.items.length)).map(copyItem);
  const [a, b] = ctx.rng.sample(grid, 2);
  const secrets: Record<string, string> = {};
  duo.forEach((id, i) => (secrets[id] = (i === 0 ? a : b ?? a).name));
  const s: GrState = {
    phase: 'play',
    scores: zeroScores(ctx),
    duo,
    turn: ctx.rng.pick(duo),
    packId: pack.id,
    packName: pack.name,
    packEmoji: pack.emoji,
    grid,
    secrets,
    crossed: Object.fromEntries(duo.map((id) => [id, []])),
    log: [],
    sugg: {},
    turnMs: sec(ctx.options, 'turnSec', 60),
    turns: 0,
    maxTurns: 60,
    note: {}
  };
  duo.forEach((id) => refreshSugg(s, ctx, id));
  s.deadline = ctx.now + s.turnMs;
  ctx.announce(`🧑‍🤝‍🧑 Qui est-ce ? Grille ${pack.emoji} ${pack.name} : chacun a un secret. ${nameOf(ctx, s.turn)} commence !`);
  return s;
}

function doGuess(s: GrState, pid: string, name: string, ctx: RuntimeCtx) {
  const opp = other(s, pid);
  const target = s.grid.find((i) => i.name === s.secrets[opp])!;
  const ok = matchesItem(name, target);
  s.log.push({ pid, text: `C’est ${name} !`, answer: ok ? 'correct' : 'faux', guess: true });
  if (ok) endGrille(s, ctx, pid, `🎯 ${nameOf(ctx, pid)} a démasqué « ${target.name} » et gagne !`);
  else endGrille(s, ctx, opp, `❌ Raté ! Ce n’était pas « ${name} ». ${nameOf(ctx, opp)} gagne !`);
}

function onAction(s: GrState, pid: string, a: { type: string; [k: string]: any }, ctx: RuntimeCtx) {
  if (s.phase !== 'play' || !s.duo.includes(pid)) return;
  if (a.type === 'toggle') {
    const n = String(a.name ?? '');
    if (!s.grid.some((i) => i.name === n)) return;
    const list = s.crossed[pid];
    s.crossed[pid] = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
    return refreshSugg(s, ctx, pid);
  }
  if (pid !== s.turn) return;
  if (a.type === 'guess') {
    const n = String(a.name ?? a.text ?? '').trim();
    if (!n) return;
    return doGuess(s, pid, n, ctx);
  }
  if (a.type === 'ask') {
    const text = String(a.text ?? '').trim().slice(0, 140);
    if (!text) return;
    // nommer un élément de la grille = tenter sa chance
    const named = s.grid.find((i) => matchesItem(stripAsk(text), i));
    if (named) return doGuess(s, pid, named.name, ctx);
    const pack = packFor(ctx.packs, s.packId);
    const opp = other(s, pid);
    const target = s.grid.find((i) => i.name === s.secrets[opp])!;
    const answer = answerQuestion(target, pack, text);
    if (answer === 'peut-être') {
      s.note[pid] = '🤷 Le jeu ne sait pas répondre à cette question : reformule ou choisis une suggestion (ton tour continue).';
      s.log.push({ pid, text, answer });
      return;
    }
    s.note[pid] = '';
    s.log.push({ pid, text, answer });
    // grisage automatique des éléments incompatibles
    const crossed = new Set(s.crossed[pid]);
    for (const it of s.grid) {
      if (crossed.has(it.name)) continue;
      const sim = simAnswer(pack, pack?.items.find((x) => x.name === it.name) ?? it, text);
      if (sim !== 'peut-être' && sim !== answer) crossed.add(it.name);
    }
    s.crossed[pid] = [...crossed];
    refreshSugg(s, ctx, pid);
    return passTurn(s, ctx);
  }
}

function onTick(s: GrState, ctx: RuntimeCtx) {
  if (s.phase !== 'play' || !s.deadline || ctx.now < s.deadline) return;
  ctx.announce(`⏱️ ${nameOf(ctx, s.turn)} passe son tour.`);
  passTurn(s, ctx);
}

function view(s: GrState, pid: string | null): GrView {
  const playing = !!pid && s.duo.includes(pid);
  const end = s.phase === 'end';
  const find = (n: string) => mini(s.grid.find((i) => i.name === n) ?? { name: n, emoji: '❔', tags: [], clues: [] });
  return {
    phase: s.phase,
    needs: s.phase === 'play' ? [s.turn] : [],
    deadline: s.deadline,
    scores: s.scores,
    winners: s.winners,
    summary: s.summary,
    duo: s.duo,
    turn: s.phase === 'play' ? s.turn : null,
    packName: s.packName,
    packEmoji: s.packEmoji,
    packId: s.packId,
    grid: s.grid.map(mini),
    mySecret: playing ? find(s.secrets[pid!]) : null,
    crossed: playing ? s.crossed[pid!] : [],
    oppRemaining: Object.fromEntries(s.duo.map((id) => [id, s.grid.length - (s.crossed[id]?.length ?? 0)])),
    log: s.log,
    suggestions: playing ? s.sugg[pid!] ?? [] : [],
    note: playing ? s.note[pid!] || null : null,
    reveal: end ? Object.fromEntries(s.duo.map((id) => [id, find(s.secrets[id])])) : null,
    turns: s.turns,
    maxTurns: s.maxTurns
  };
}

// ---------- IA ----------

function think(v: GrView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.turns}-${v.log.length}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  if (v.turn !== me) return;
  const pack = packFor(api.packs, v.packId);
  if (!pack) return;
  if (!aiReady(api, mem, thinkMs(api, { facile: [3000, 6000], normal: [2500, 5000], difficile: [2000, 4000] }))) return;
  const gridItems = v.grid.map((g) => pack.items.find((i) => i.name === g.name)).filter(Boolean) as Item[];
  const mine = v.log.filter((l) => l.pid === me && !l.guess && (l.answer === 'oui' || l.answer === 'non'));
  const cands = gridItems.filter((it) =>
    mine.every((l) => {
      const sim = simAnswer(pack, it, l.text);
      return sim === 'peut-être' || sim === l.answer;
    })
  );
  const opp = v.duo.find((id) => id !== me)!;
  const oppLeft = v.oppRemaining[opp] ?? 24;
  const gamble = (oppLeft <= 1 && cands.length <= 3) || (api.difficulty === 'facile' && cands.length === 2 && api.rng.chance(0.5));
  if (cands.length === 1 || (cands.length && gamble)) {
    if (cands.length > 1 && aiChance(api, 0.6)) aiSay(api, mem, pickLine(api, ['Tant pis, je tente le tout pour le tout !', 'Quitte ou double…']), 1);
    return api.act({ type: 'guess', name: api.rng.pick(cands).name });
  }
  const asked = v.log.filter((l) => l.pid === me).map((l) => l.text);
  const pool = cands.length ? cands : gridItems;
  const exclude = askedTags(pack, pool, asked);
  let tag: string | null = null;
  if (api.difficulty === 'facile' && api.rng.chance(0.4)) {
    const attrs = pack.attributes.filter((x) => !exclude.has(x.tag) && gridItems.some((i) => i.tags.includes(x.tag)));
    if (attrs.length) tag = api.rng.pick(attrs).tag;
  }
  if (!tag) {
    // on préfère les tags qui ont une vraie question dans le pack
    const attrTags = new Set(pack.attributes.map((x) => x.tag));
    const withAttr = bestSplitTag(pool.map((i) => ({ ...i, tags: i.tags.filter((t) => attrTags.has(t)) })), exclude);
    tag = withAttr ?? bestSplitTag(pool, exclude);
  }
  const q = tag ? questionForTag(pack, tag) : null;
  if (!q || asked.some((t) => norm(t) === norm(q))) return api.act({ type: 'guess', name: api.rng.pick(pool).name });
  if (pool.length <= 4 && aiChance(api, 0.3)) aiSay(api, mem, pickLine(api, ['Je te tiens presque 😏', 'Plus que quelques visages…']), 1);
  api.act({ type: 'ask', text: q });
}

export const grille: GameModule<GrState, GrView> = {
  id: 'grille',
  name: 'Qui est-ce ?',
  family: 'devine',
  emoji: '🧑‍🤝‍🧑',
  tagline: 'Le duel classique : pose les bonnes questions et démasque le secret adverse.',
  rules: [
    'Une grille de 24 éléments du même thème. Chaque joueur a un secret parmi eux.',
    'À ton tour, pose une question oui/non (suggestion ou texte libre) : le jeu répond honnêtement à la place de ton adversaire.',
    'Ta grille grise automatiquement les éléments éliminés (tu peux aussi cocher/décocher à la main).',
    'Au lieu de poser une question, tu peux tenter ta chance : bonne réponse = victoire, mauvaise = défaite !'
  ],
  minPlayers: 2,
  maxPlayers: 2,
  usesThemes: true,
  options: [{ key: 'turnSec', label: 'Temps par tour (s)', type: 'number', min: 15, max: 180, step: 5, default: 60 }],
  setup,
  onAction,
  onTick,
  view: (s, pid) => view(s, pid),
  ai: { think },
  Board: GrilleBoard
};
