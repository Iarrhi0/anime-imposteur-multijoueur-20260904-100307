// 🔍 Indices progressifs : les indices d'un élément caché tombent un par un.
// Tout le monde peut répondre à tout moment : plus tôt = plus de points.
import type { AgentAPI, AgentMind, GameModule } from '../../core/types';
import type { Item } from '../../content/types';
import { matchesItem, rankByClues } from '../../content';
import { norm } from '../../core/text';
import { aiChance, aiEnd, aiMem, aiReady, aiSay, byDiff, packFor, pickLine, thinkMs } from './common';
import { progressive, type PState, type PView } from './progressive';
import { IndicesBoard } from './IndicesBoard';

export interface IClue {
  text: string;
  tag?: string;
}

function buildClues(item: Item): IClue[] {
  const out: IClue[] = [];
  const seen = new Set<string>();
  for (const c of item.clues) {
    const k = norm(c);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ text: c });
  }
  for (const t of item.tags) {
    const txt = t.replace(/-/g, ' ');
    const k = norm(txt);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ text: txt, tag: t });
  }
  return out;
}

const engine = progressive({
  minItems: 8,
  graceMs: 6000,
  defaultCooldown: 3,
  accept: (i) => i.clues.length + i.tags.length >= 4,
  prepare(item) {
    const clues = buildClues(item);
    return { maxStep: clues.length, startStep: 1, extra: { clues } };
  },
  points(s) {
    const span = Math.max(1, s.maxStep - 1);
    return 1 + Math.round((9 * (s.maxStep - s.step)) / span);
  },
  pub(s) {
    const clues: IClue[] = s.extra.clues ?? [];
    return { clues: s.phase === 'play' ? clues.slice(0, s.step) : clues, total: clues.length };
  },
  intro(s) {
    return `${s.rounds > 1 ? `Manche ${s.round}/${s.rounds} — ` : ''}🔍 Thème ${s.packEmoji} ${s.packName} : un nouvel indice toutes les ${Math.round(s.stepMs / 1000)} s. Répondez dès que vous savez !`;
  }
});

// ---------- IA ----------

function think(v: PView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.round}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  if (v.phase !== 'play') {
    if (v.phase === 'reveal' && v.found[0]?.pid === me && aiChance(api, 0.4)) aiSay(api, mem, pickLine(api, ['Trop rapide pour vous 😎', 'Dès le début je savais !', 'Facile !']), 1);
    return;
  }
  if (v.found.some((f) => f.pid === me) || api.now < v.cooldownUntil) return;
  const pack = packFor(api.packs, v.packId);
  if (!pack) return;
  const clues: IClue[] = v.pub.clues ?? [];
  // un peu de temps pour « lire » le nouvel indice
  if (!aiReady(api, mem, thinkMs(api, { facile: [3500, 8000], normal: [2000, 5000], difficile: [1000, 3000] }))) return;
  // la mémoire de l'IA dépend de la difficulté : elle ne connaît pas tout le pack
  const knowKey = `know-${v.round}`;
  if (!mind.mem[knowKey]) {
    const ratio = byDiff(api, { facile: 0.6, normal: 0.85, difficile: 1 });
    mind.mem[knowKey] = pack.items.filter(() => api.rng.chance(ratio)).map((i) => i.name);
  }
  const known = new Set<string>(mind.mem[knowKey]);
  const wrong = v.feed.filter((f) => !f.ok).map((f) => f.text);
  const tags = clues.filter((c) => c.tag).map((c) => c.tag!);
  const cands = pack.items.filter((i) => known.has(i.name) && !wrong.some((w) => matchesItem(w, i)) && tags.every((t) => i.tags.includes(t)));
  if (!cands.length) return;
  const texts = clues.filter((c) => !c.tag).map((c) => c.text);
  const ranked = texts.length ? rankByClues(cands, texts) : cands.map((item) => ({ item, score: 0 }));
  const s1 = ranked[0]?.score ?? 0;
  const s2 = ranked[1]?.score ?? 0;
  const minStep = byDiff(api, { facile: Math.ceil(v.maxStep * 0.45), normal: 2, difficile: 1 });
  const margin = byDiff(api, { facile: 1.2, normal: 0.8, difficile: 0.5 });
  const last = v.step >= v.maxStep - 1;
  const confident = ranked.length === 1 || (s1 > 0.5 && s1 - s2 >= margin);
  if (v.step < minStep && !last) return;
  if (!confident && !last && !(v.step >= v.maxStep * 0.7 && api.rng.chance(0.3))) {
    if (v.step === Math.ceil(v.maxStep / 2) && aiChance(api, 0.15)) aiSay(api, mem, pickLine(api, ['J’hésite entre plusieurs…', 'Hmm, ça me dit quelque chose…', 'Encore un indice !']), 1);
    return;
  }
  // en facile, l'IA se trompe parfois de candidat
  const pick = api.difficulty === 'facile' && ranked.length > 1 && api.rng.chance(0.3) ? ranked[1].item : ranked[0].item;
  api.act({ type: 'guess', text: pick.name });
}

export const indices: GameModule<PState, PView> = {
  id: 'indices',
  name: 'Indices progressifs',
  family: 'devine',
  emoji: '🔍',
  tagline: 'Un indice toutes les quelques secondes : qui trouvera le premier ?',
  rules: [
    'Un élément est caché. Ses indices apparaissent un par un, du plus vague au plus précis.',
    'Tout le monde peut répondre à tout moment en écrivant sa réponse.',
    'Plus tu trouves tôt, plus tu marques (jusqu’à 10 points, +2 pour le premier).',
    'Une mauvaise réponse ne coûte rien, mais bloque tes réponses quelques secondes.'
  ],
  minPlayers: 1,
  maxPlayers: 12,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Manches', type: 'number', min: 1, max: 20, default: 5 },
    { key: 'stepSec', label: 'Secondes entre deux indices', type: 'number', min: 2, max: 20, default: 5 },
    { key: 'cooldownSec', label: 'Pénalité après une erreur (s)', type: 'number', min: 1, max: 10, default: 3, advanced: true }
  ],
  presets: [
    { id: 'normal', label: 'Normal', emoji: '🔍', desc: '5 manches, 5 s par indice', options: { rounds: 5, stepSec: 5 } },
    { id: 'turbo', label: 'Turbo', emoji: '⚡', desc: '8 manches, 3 s par indice', options: { rounds: 8, stepSec: 3 } }
  ],
  setup: engine.setup,
  onAction: engine.onAction,
  onTick: engine.onTick,
  view: engine.view,
  ai: { think },
  Board: IndicesBoard
};
