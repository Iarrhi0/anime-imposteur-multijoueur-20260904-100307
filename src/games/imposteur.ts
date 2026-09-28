// 🎭 L'Imposteur : toutes les variantes « un joueur n'a pas le même mot ».
import type { Player, RuntimeCtx } from '../core/types';
import { pickPair, type Closeness } from '../content';
import { COMMON_OPTIONS, type AssignResult, type ClueKind, type Role, type Secret } from './deduction/engine';
import { clamp, deductionModule, firstEmoji, guessChoices, lookupIn, packItems, rareTags } from './deduction/module';

const MODES = [
  { value: 'classique', label: '🎭 Classique : l’imposteur a un autre mot et ne le sait pas' },
  { value: 'undercover', label: '🕶️ Undercover : un mot très proche, il ne le sait pas' },
  { value: 'aveugle', label: '🙈 Aveugle : l’imposteur n’a aucun mot' },
  { value: 'conscient', label: '😈 Conscient : il a un autre mot ET sait qu’il est l’imposteur' },
  { value: 'indice', label: '🧩 Faux indice : l’imposteur n’a qu’un indice vague' },
  { value: 'mrwhite', label: '⚪ Mr. White : civils + undercover + un joueur sans mot' },
  { value: 'equipes', label: '⚔️ Deux équipes : moitié mot A, moitié mot B' },
  { value: 'paire', label: '👯 Paire cachée : tous différents sauf deux' }
];

const CLUE_MODES = [
  { value: 'mot', label: 'Un seul mot' },
  { value: 'phrase', label: 'Une phrase' },
  { value: 'emoji', label: 'Emojis uniquement' },
  { value: 'lettre', label: 'Mot avec lettre imposée' },
  { value: 'interdits', label: 'Phrase avec mots interdits' }
];

function clueKind(o: Record<string, any>): ClueKind {
  const m = o.clueMode ?? 'mot';
  return m === 'phrase' || m === 'interdits' ? 'phrase' : m === 'emoji' ? 'emoji' : 'word';
}

function assign(ctx: RuntimeCtx, active: Player[]): AssignResult {
  const o = ctx.options;
  const rng = ctx.rng;
  const mode: string = o.mode ?? 'classique';
  const n = active.length;
  const special = mode === 'equipes' || mode === 'paire' ? (mode as 'equipes' | 'paire') : undefined;
  const trap = !special && Number(o.trapChance ?? 0) > 0 && rng.chance(Number(o.trapChance) / 100);
  const defaultClose: Closeness = mode === 'undercover' || mode === 'mrwhite' ? 'proche' : mode === 'classique' ? 'moyen' : 'moyen';
  const closeness: Closeness = o.closeness && o.closeness !== 'auto' ? o.closeness : o.difficulty === 'facile' ? 'loin' : o.difficulty === 'difficile' ? 'proche' : defaultClose;
  const { a, b } = pickPair(ctx.packs, rng, closeness);
  const pool = a.pack.items;
  const ids = rng.shuffle(active.map((p) => p.id));
  const secrets: Record<string, Secret> = {};
  const civil = (): Secret => ({ role: 'civil', word: a.item.name, emoji: firstEmoji(a.item.emoji), knowsRole: false });
  const k = clamp(Number(o.numImpostors ?? 1), 1, Math.max(1, Math.floor((n - 1) / 2)));
  const badIds: string[] = [];
  const modeLabel = MODES.find((m) => m.value === mode)?.label.split(':')[0] ?? '';

  if (trap) {
    ids.forEach((id) => (secrets[id] = civil()));
  } else if (mode === 'equipes') {
    ids.forEach((id, i) => (secrets[id] = i % 2 === 0 ? { role: 'teamA', word: a.item.name, emoji: firstEmoji(a.item.emoji), knowsRole: false } : { role: 'teamB', word: b.item.name, emoji: firstEmoji(b.item.emoji), knowsRole: false }));
  } else if (mode === 'paire') {
    const others = rng.shuffle(pool.filter((i) => i !== a.item));
    ids.forEach((id, i) => {
      if (i < 2) secrets[id] = { role: 'pair', word: a.item.name, emoji: firstEmoji(a.item.emoji), knowsRole: false };
      else {
        const it = others[(i - 2) % others.length];
        secrets[id] = { role: 'solo', word: it.name, emoji: firstEmoji(it.emoji), knowsRole: false };
      }
    });
  } else if (mode === 'mrwhite') {
    const nUnder = n >= 7 ? 2 : n >= 4 ? 1 : 0;
    ids.forEach((id, i) => {
      if (i === 0) secrets[id] = { role: 'mrwhite', word: null, knowsRole: true };
      else if (i <= nUnder) secrets[id] = { role: 'undercover', word: b.item.name, emoji: firstEmoji(b.item.emoji), knowsRole: false };
      else secrets[id] = civil();
      if (i <= nUnder) badIds.push(id);
    });
  } else {
    ids.forEach((id, i) => {
      if (i >= k) {
        secrets[id] = civil();
        return;
      }
      badIds.push(id);
      const role: Role = mode === 'undercover' ? 'undercover' : 'imposteur';
      if (mode === 'aveugle') secrets[id] = { role, word: null, knowsRole: true };
      else if (mode === 'indice') {
        const generic = rareTags(a.item, pool, a.item.tags.length).slice(-3);
        secrets[id] = { role, word: null, hint: rng.pick(generic.length ? generic : a.item.tags), knowsRole: true };
      } else secrets[id] = { role, word: b.item.name, emoji: firstEmoji(b.item.emoji), knowsRole: mode === 'conscient' };
    });
  }

  // Les imposteurs qui connaissent leur rôle se connaissent entre eux (option).
  if (o.impostorsKnow && badIds.length > 1) {
    badIds.forEach((id) => {
      if (secrets[id].knowsRole) secrets[id].allies = badIds.filter((x) => x !== id && secrets[x].knowsRole);
    });
  }

  if (o.clueMode === 'interdits') {
    for (const id of ids) {
      const w = secrets[id].word;
      const it = w ? pool.find((i) => i.name === w) : undefined;
      if (it) secrets[id].forbidden = rareTags(it, pool, 2);
    }
  }

  return {
    secrets,
    publicInfo: { title: '🎭 L’Imposteur', subtitle: `${modeLabel.trim()} · ${a.pack.emoji} ${a.pack.name}`, packId: a.pack.id, theme: a.pack.name },
    solution: a.item.name,
    guessOptions: guessChoices(a.item, pool, rng),
    trap,
    special
  };
}

export const imposteur = deductionModule(
  {
    id: 'imposteur',
    name: 'L’Imposteur',
    family: 'imposteur',
    emoji: '🎭',
    tagline: 'Tout le monde a le même mot… sauf un. Démasquez-le !',
    rules: [
      'Chacun reçoit secrètement un mot (personnage, film, plat…). L’imposteur a un mot différent, ou aucun mot selon la variante.',
      'À tour de rôle, chacun donne un indice sur son mot sans le dire.',
      'On débat, puis on vote pour éliminer le joueur le plus suspect.',
      'Dernière chance : l’imposteur démasqué peut encore gagner s’il devine le mot des civils.'
    ],
    minPlayers: 3,
    maxPlayers: 16,
    usesThemes: true,
    options: [
      { key: 'mode', label: 'Variante', type: 'select', default: 'classique', choices: MODES },
      { key: 'numImpostors', label: 'Nombre d’imposteurs', type: 'number', min: 1, max: 3, default: 1, showIf: (o) => !['mrwhite', 'equipes', 'paire'].includes(o.mode) },
      { key: 'impostorsKnow', label: 'Les imposteurs se connaissent', type: 'toggle', default: false, showIf: (o) => Number(o.numImpostors) > 1 },
      { key: 'clueMode', label: 'Type d’indice', type: 'select', default: 'mot', choices: CLUE_MODES },
      {
        key: 'closeness',
        label: 'Proximité des mots',
        type: 'select',
        default: 'auto',
        advanced: true,
        choices: [
          { value: 'auto', label: 'Selon la difficulté' },
          { value: 'proche', label: 'Très proches (difficile)' },
          { value: 'moyen', label: 'Assez proches' },
          { value: 'loin', label: 'Différents (facile)' }
        ]
      },
      {
        key: 'trapChance',
        label: 'Manche piège (aucun imposteur)',
        type: 'select',
        default: '0',
        choices: [
          { value: '0', label: 'Jamais' },
          { value: '10', label: 'Parfois (10 %)' },
          { value: '25', label: 'Souvent (25 %)' }
        ]
      },
      ...COMMON_OPTIONS
    ],
    presets: [
      { id: 'classique', label: 'Classique', emoji: '🎭', desc: 'Un mot différent, il ne le sait pas', options: { mode: 'classique' } },
      { id: 'undercover', label: 'Undercover', emoji: '🕶️', desc: 'Un mot très proche', options: { mode: 'undercover', closeness: 'proche' } },
      { id: 'aveugle', label: 'Aveugle', emoji: '🙈', desc: 'L’imposteur n’a rien', options: { mode: 'aveugle' } },
      { id: 'mrwhite', label: 'Mr. White', emoji: '⚪', desc: 'Undercover + joueur sans mot', options: { mode: 'mrwhite', voteMode: 'elimination' } },
      { id: 'conscient', label: 'Imposteur conscient', emoji: '😈', desc: 'Il sait, il doit bluffer', options: { mode: 'conscient' } },
      { id: 'indice', label: 'Faux indice', emoji: '🧩', desc: 'L’imposteur a un indice vague', options: { mode: 'indice' } },
      { id: 'multi', label: 'Plusieurs imposteurs', emoji: '👥', desc: '2 imposteurs complices', options: { mode: 'conscient', numImpostors: 2, impostorsKnow: true, voteMode: 'elimination' } },
      { id: 'equipes', label: 'Deux équipes', emoji: '⚔️', desc: 'Trouve tes alliés', options: { mode: 'equipes' } },
      { id: 'paire', label: 'Paire cachée', emoji: '👯', desc: 'Tous différents sauf deux', options: { mode: 'paire', clueMode: 'phrase' } },
      { id: 'piege', label: 'Manche piège', emoji: '🪤', desc: 'Parfois… aucun imposteur', options: { mode: 'classique', trapChance: '25' } },
      { id: 'emoji', label: 'Emojis', emoji: '😀', desc: 'Indices en emojis', options: { mode: 'classique', clueMode: 'emoji' } },
      { id: 'lettre', label: 'Lettre imposée', emoji: '🔤', desc: 'L’indice commence par une lettre', options: { mode: 'classique', clueMode: 'lettre' } },
      { id: 'interdits', label: 'Mots interdits', emoji: '🚫', desc: 'Certains mots sont bannis', options: { mode: 'undercover', clueMode: 'interdits' } },
      { id: 'elimination', label: 'Élimination', emoji: '☠️', desc: 'Un joueur éliminé par tour', options: { mode: 'undercover', voteMode: 'elimination', cluesRounds: 1 } },
      { id: 'twists', label: 'Chaos', emoji: '🌪️', desc: 'Rebondissements surprise', options: { mode: 'classique', twists: true, cluesRounds: 2 } },
      { id: 'eclair', label: 'Chrono éclair', emoji: '⚡', desc: 'Tout va très vite', options: { mode: 'classique', clueSec: 15, discussionSec: 40, voteSec: 20 } },
      { id: 'enqueteur', label: 'Mode enquêteur', emoji: '🔎', desc: 'Observe les IA et trouve l’imposteur', options: { mode: 'classique', spectator: true, cluesRounds: 2 } }
    ]
  },
  {
    clueKind,
    assign,
    candidates: packItems,
    lookup: (w, pub, packs) => lookupIn(packItems(pub, packs), w, packs),
    prompt: (round, _pub, kind) =>
      kind === 'emoji'
        ? 'Décris ton mot secret avec des emojis uniquement.'
        : kind === 'phrase'
          ? round === 1
            ? 'Décris ton mot secret en une courte phrase, sans le dire !'
            : 'Donne une nouvelle phrase, un peu plus précise.'
          : round === 1
            ? 'Donne UN mot en rapport avec ton mot secret.'
            : 'Donne un nouveau mot, sans répéter les autres.',
    lastChanceRoles: ['mrwhite', 'imposteur']
  }
);
