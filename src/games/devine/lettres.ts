// 🔠 Lettre par lettre : le nom d'un élément apparaît en blancs, les lettres se dévoilent
// peu à peu (avec l'emoji et la catégorie en aide). Le plus rapide marque le plus.
import type { AgentAPI, AgentMind, GameModule } from '../../core/types';
import type { Item } from '../../content/types';
import { matchesItem } from '../../content';
import { aiChance, aiEnd, aiMem, aiReady, aiSay, byDiff, graphemes, packFor, pickLine, thinkMs } from './common';
import { progressive, type PState, type PView } from './progressive';
import { LettresBoard } from './LettresBoard';

const LETTER = /[\p{L}\p{N}]/u;

function baseChar(c: string): string {
  return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function letterIdx(name: string): number[] {
  return graphemes(name)
    .map((c, i) => (LETTER.test(c) ? i : -1))
    .filter((i) => i >= 0);
}

export function maskOf(name: string, revealed: number[], full = false): string[] {
  const set = new Set(revealed);
  return graphemes(name).map((c, i) => (!LETTER.test(c) || full || set.has(i) ? c : '_'));
}

/** Vrai si un nom est compatible avec le masque (lettres révélées, espaces, longueur). */
export function fitsMask(name: string, mask: string[]): boolean {
  const g = graphemes(name);
  if (g.length !== mask.length) return false;
  for (let i = 0; i < g.length; i++) {
    const m = mask[i];
    if (m === '_') {
      if (!LETTER.test(g[i])) return false;
    } else if (baseChar(m) !== baseChar(g[i])) return false;
  }
  return true;
}

const engine = progressive({
  minItems: 8,
  graceMs: 5000,
  defaultCooldown: 2,
  accept: (i) => letterIdx(i.name).length >= 3,
  prepare(item, rng, s) {
    const idx = letterIdx(item.name);
    const order = rng.shuffle(idx);
    const maxStep = Math.max(1, idx.length - 1);
    const opt = s.stepMs;
    // une manche ne dure pas plus d'environ 75 s, même pour un nom très long
    const stepMs = Math.round(Math.min(opt, Math.max(1500, 75_000 / maxStep)));
    return { maxStep, startStep: 0, stepMs, extra: { order, letters: idx.length, emojiAt: Math.max(1, Math.ceil(idx.length * 0.25)) } };
  },
  points(s) {
    const letters: number = s.extra.letters ?? 1;
    return 1 + Math.round((9 * (letters - s.step)) / letters);
  },
  pub(s) {
    const play = s.phase === 'play';
    const order: number[] = s.extra.order ?? [];
    return {
      mask: maskOf(s.item.name, order.slice(0, s.step), !play),
      hidden: play ? (s.extra.letters ?? 0) - s.step : 0,
      letters: s.extra.letters ?? 0,
      emoji: !play || s.step >= (s.extra.emojiAt ?? 1) ? s.item.emoji : null,
      emojiAt: s.extra.emojiAt ?? 1
    };
  },
  intro(s) {
    return `${s.rounds > 1 ? `Manche ${s.round}/${s.rounds} — ` : ''}🔠 Thème ${s.packEmoji} ${s.packName} : ${s.extra.letters} lettres à deviner !`;
  }
});

// ---------- IA ----------

function think(v: PView, mind: AgentMind, api: AgentAPI) {
  const me = api.me.id;
  const mem = aiMem(mind, `${v.phase}-${v.round}`);
  if (v.phase === 'end') return aiEnd(api, mind, v.winners);
  if (v.phase !== 'play') {
    if (v.phase === 'reveal' && v.found[0]?.pid === me && aiChance(api, 0.4)) aiSay(api, mem, pickLine(api, ['Trop facile 😎', 'Je l’ai vu tout de suite !']), 1);
    return;
  }
  if (v.found.some((f) => f.pid === me) || api.now < v.cooldownUntil) return;
  const pack = packFor(api.packs, v.packId);
  if (!pack) return;
  if (!aiReady(api, mem, thinkMs(api, { facile: [4000, 9000], normal: [2500, 6000], difficile: [1200, 3500] }))) return;
  const knowKey = `know-${v.round}`;
  if (!mind.mem[knowKey]) {
    const ratio = byDiff(api, { facile: 0.65, normal: 0.9, difficile: 1 });
    mind.mem[knowKey] = pack.items.filter(() => api.rng.chance(ratio)).map((i) => i.name);
  }
  const known = new Set<string>(mind.mem[knowKey]);
  const mask: string[] = v.pub.mask ?? [];
  const wrong = v.feed.filter((f) => !f.ok).map((f) => f.text);
  let cands: Item[] = pack.items.filter((i) => known.has(i.name) && fitsMask(i.name, mask) && !wrong.some((w) => matchesItem(w, i)));
  if (api.difficulty === 'difficile' && v.pub.emoji) {
    const e = cands.filter((i) => i.emoji === v.pub.emoji);
    if (e.length) cands = e;
  }
  if (!cands.length) return;
  const threshold = byDiff(api, { facile: 1, normal: 2, difficile: 3 });
  const lateGamble = v.pub.hidden <= 2 && cands.length <= 4;
  if (cands.length > threshold && !lateGamble) {
    if (v.step === 3 && aiChance(api, 0.12)) aiSay(api, mem, pickLine(api, ['Il me manque quelques lettres…', 'Ça commence à venir !']), 1);
    return;
  }
  api.act({ type: 'guess', text: api.rng.pick(cands).name });
}

export const lettres: GameModule<PState, PView> = {
  id: 'lettres',
  name: 'Lettre par lettre',
  family: 'devine',
  emoji: '🔠',
  tagline: 'Les lettres apparaissent une à une : devine le nom avant les autres !',
  rules: [
    'Le nom d’un élément est caché : seuls les blancs (et les espaces) sont visibles.',
    'Une lettre se dévoile toutes les quelques secondes. L’emoji arrive en renfort un peu plus tard.',
    'Écris ta réponse dès que tu la reconnais : plus il reste de lettres cachées, plus tu marques.',
    'Une erreur bloque tes réponses 2 secondes.'
  ],
  minPlayers: 1,
  maxPlayers: 12,
  usesThemes: true,
  options: [
    { key: 'rounds', label: 'Manches', type: 'number', min: 1, max: 20, default: 5 },
    { key: 'stepSec', label: 'Secondes entre deux lettres', type: 'number', min: 1, max: 10, default: 3 },
    { key: 'cooldownSec', label: 'Pénalité après une erreur (s)', type: 'number', min: 1, max: 10, default: 2, advanced: true }
  ],
  setup: engine.setup,
  onAction: engine.onAction,
  onTick: engine.onTick,
  view: engine.view,
  ai: { think },
  Board: LettresBoard
};
