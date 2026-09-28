// Autres jeux construits sur le moteur de déduction :
// ❓ La Question Piège · 🦎 Le Caméléon · 🕵️ L'Espion du lieu · 🎨 L'Artiste Imposteur · 🤥 Le Faux Fan
import type { Player, RuntimeCtx } from '../core/types';
import type { Item, Location, QuestionPair } from '../content/types';
import { entries, pickPair } from '../content';
import { keywords } from '../core/text';
import { COMMON_OPTIONS, type AssignResult, type Secret } from './deduction/engine';
import { clamp, deductionModule, firstEmoji, guessChoices, lookupIn, packItems } from './deduction/module';
import { locations as LOCATIONS } from '../content/extra/locations';
import { questionPairs as QUESTIONS } from '../content/extra/questions';

const noSpecial = COMMON_OPTIONS.filter((o) => o.key !== 'voteMode');

function impostorIds(ctx: RuntimeCtx, active: Player[], max = 2) {
  const k = clamp(Number(ctx.options.numImpostors ?? 1), 1, Math.min(max, Math.max(1, Math.floor((active.length - 1) / 2))));
  const ids = ctx.rng.shuffle(active.map((p) => p.id));
  return { bad: ids.slice(0, k), good: ids.slice(k), ids };
}

// ---------------- ❓ La Question Piège ----------------

function assignQuestion(ctx: RuntimeCtx, active: Player[]): AssignResult {
  const list: QuestionPair[] = QUESTIONS?.length ? QUESTIONS : [{ main: 'Combien d’heures dors-tu par nuit ?', impostor: 'Combien d’heures passes-tu sur ton téléphone par jour ?', answer: 'nombre', range: [5, 10], impostorRange: [1, 8] }];
  const q = ctx.rng.pick(list);
  const trap = Number(ctx.options.trapChance ?? 0) > 0 && ctx.rng.chance(Number(ctx.options.trapChance) / 100);
  const { bad, ids } = impostorIds(ctx, active);
  const secrets: Record<string, Secret> = {};
  for (const id of ids) {
    const isBad = !trap && bad.includes(id);
    secrets[id] = isBad
      ? { role: 'imposteur', word: q.impostor, emoji: '❓', knowsRole: false, answerHint: { answer: q.answer, range: q.impostorRange, examples: q.impostorExamples } }
      : { role: 'civil', word: q.main, emoji: '❓', knowsRole: false, answerHint: { answer: q.answer, range: q.range, examples: q.examples } };
  }
  return { secrets, publicInfo: { title: '❓ La Question Piège', subtitle: 'Répondez tous en même temps', question: q.main }, solution: q.main, trap };
}

export const questionPiege = deductionModule(
  {
    id: 'question-piege',
    name: 'La Question Piège',
    family: 'imposteur',
    emoji: '❓',
    tagline: 'Tout le monde répond à la même question… sauf l’imposteur.',
    rules: [
      'Chacun reçoit une question en secret. L’imposteur reçoit une question différente mais proche, et ne le sait pas.',
      'Tout le monde répond en même temps (un nombre, un mot…).',
      'Les réponses et la vraie question sont révélées : qui a répondu à côté ?',
      'Débattez puis votez. L’imposteur peut essayer de se justifier !'
    ],
    minPlayers: 3,
    maxPlayers: 16,
    usesThemes: false,
    options: [
      { key: 'numImpostors', label: 'Nombre d’imposteurs', type: 'number', min: 1, max: 2, default: 1 },
      {
        key: 'trapChance',
        label: 'Manche piège (aucun imposteur)',
        type: 'select',
        default: '0',
        choices: [
          { value: '0', label: 'Jamais' },
          { value: '15', label: 'Parfois' }
        ]
      },
      ...noSpecial.filter((o) => o.key !== 'cluesRounds' && o.key !== 'lastChance')
    ]
  },
  {
    clueKind: 'answer',
    assign: assignQuestion,
    candidates: () => [],
    lookup: () => undefined,
    prompt: () => 'Réponds à ta question secrète (réponse courte).',
    lastChanceRoles: []
  }
);

// ---------------- 🦎 Le Caméléon ----------------

function assignCameleon(ctx: RuntimeCtx, active: Player[]): AssignResult {
  const packs = ctx.packs.filter((p) => p.items.length >= 16);
  const pack = ctx.rng.pick(packs.length ? packs : ctx.packs);
  const grid = ctx.rng.sample(pack.items, Math.min(16, pack.items.length));
  const secret = ctx.rng.pick(grid);
  const { bad, ids } = impostorIds(ctx, active, 1);
  const secrets: Record<string, Secret> = {};
  for (const id of ids) secrets[id] = bad.includes(id) ? { role: 'imposteur', word: null, knowsRole: true } : { role: 'civil', word: secret.name, emoji: firstEmoji(secret.emoji), knowsRole: false };
  return {
    secrets,
    publicInfo: { title: '🦎 Le Caméléon', subtitle: `${pack.emoji} ${pack.name}`, packId: pack.id, grid: grid.map((g) => g.name), category: pack.name },
    solution: secret.name,
    guessOptions: grid.map((g) => g.name)
  };
}

export const cameleon = deductionModule(
  {
    id: 'cameleon',
    name: 'Le Caméléon',
    family: 'imposteur',
    emoji: '🦎',
    tagline: 'Une grille de 16 mots. Tous connaissent le mot secret, sauf le caméléon.',
    rules: [
      'Une grille de 16 mots est visible par tous. Chacun connaît le mot secret… sauf le caméléon.',
      'Chacun donne un mot-indice : assez précis pour prouver qu’on sait, assez vague pour ne pas aider le caméléon.',
      'Votez pour démasquer le caméléon. S’il est pris, il peut encore gagner en devinant le mot dans la grille !'
    ],
    minPlayers: 3,
    maxPlayers: 12,
    usesThemes: true,
    options: noSpecial
  },
  {
    clueKind: 'word',
    assign: assignCameleon,
    candidates: (pub, packs) => {
      const items = packItems(pub, packs);
      return pub.grid ? items.filter((i) => pub.grid!.includes(i.name)) : items;
    },
    lookup: (w, pub, packs) => lookupIn(packItems(pub, packs), w, packs),
    prompt: () => 'Donne UN mot lié au mot secret de la grille.',
    lastChanceRoles: ['imposteur']
  }
);

// ---------------- 🕵️ L'Espion du lieu ----------------

export function locationItem(l: Location): Item {
  return {
    name: l.name,
    emoji: l.emoji,
    group: l.theme,
    tags: [...l.keywords, ...l.roles.map((r) => r.toLowerCase())].map((t) => t.toLowerCase().replace(/\s+/g, '-')),
    clues: l.roles
  };
}

function locPool(theme: string | undefined): Location[] {
  const all = LOCATIONS ?? [];
  const f = !theme || theme === 'tous' ? all : all.filter((l) => l.theme === theme);
  return f.length ? f : all;
}

function assignEspion(ctx: RuntimeCtx, active: Player[]): AssignResult {
  const pool = locPool(ctx.options.locTheme);
  const loc = ctx.rng.pick(pool);
  const { bad, ids } = impostorIds(ctx, active);
  const roles = ctx.rng.shuffle(loc.roles);
  const secrets: Record<string, Secret> = {};
  ids.forEach((id, i) => {
    secrets[id] = bad.includes(id) ? { role: 'imposteur', word: null, knowsRole: true, hint: 'Espion' } : { role: 'civil', word: loc.name, emoji: loc.emoji, hint: roles[i % roles.length], knowsRole: false };
  });
  const options = ctx.rng.shuffle([loc.name, ...ctx.rng.sample(pool.filter((l) => l !== loc), 11).map((l) => l.name)]);
  return {
    secrets,
    publicInfo: { title: '🕵️ L’Espion du lieu', subtitle: 'Questions, réponses… et un espion', theme: ctx.options.locTheme ?? 'tous' },
    solution: loc.name,
    guessOptions: options
  };
}

export const espion = deductionModule(
  {
    id: 'espion',
    name: 'L’Espion du lieu',
    family: 'imposteur',
    emoji: '🕵️',
    tagline: 'Tout le monde connaît le lieu… sauf l’espion.',
    rules: [
      'Tous les joueurs sont dans le même lieu (une école, Konoha, une station spatiale…) avec un rôle. L’espion ne connaît pas le lieu.',
      'À tour de rôle, on pose une question à quelqu’un, qui répond puis interroge à son tour.',
      'Répondez de façon à prouver que vous savez, sans trop en dire !',
      'Votez pour l’espion. S’il est pris, il peut gagner en devinant le lieu.'
    ],
    minPlayers: 3,
    maxPlayers: 12,
    usesThemes: false,
    options: [
      {
        key: 'locTheme',
        label: 'Lieux',
        type: 'select',
        default: 'tous',
        choices: [
          { value: 'tous', label: 'Tous les lieux' },
          { value: 'quotidien', label: 'Vie quotidienne' },
          { value: 'anime', label: 'Anime' },
          { value: 'films', label: 'Films & séries' },
          { value: 'jeux-video', label: 'Jeux vidéo' }
        ]
      },
      { key: 'numImpostors', label: 'Nombre d’espions', type: 'number', min: 1, max: 2, default: 1 },
      ...noSpecial.map((o) => (o.key === 'clueSec' ? { ...o, default: 45 } : o))
    ]
  },
  {
    clueKind: 'qa',
    assign: assignEspion,
    candidates: (pub) => locPool(pub.theme).map(locationItem),
    lookup: (w) => {
      const l = (LOCATIONS ?? []).find((x) => x.name === w);
      return l ? locationItem(l) : undefined;
    },
    prompt: () => 'Posez-vous des questions à tour de rôle.',
    lastChanceRoles: ['imposteur']
  }
);

// ---------------- 🎨 L'Artiste Imposteur ----------------

function assignArtiste(ctx: RuntimeCtx, active: Player[]): AssignResult {
  const { a } = pickPair(ctx.packs, ctx.rng, 'moyen');
  const { bad, ids } = impostorIds(ctx, active, 1);
  const category = a.item.group ?? a.pack.name;
  const secrets: Record<string, Secret> = {};
  for (const id of ids) secrets[id] = bad.includes(id) ? { role: 'imposteur', word: null, knowsRole: true, hint: category } : { role: 'civil', word: a.item.name, emoji: firstEmoji(a.item.emoji), knowsRole: false };
  return {
    secrets,
    publicInfo: { title: '🎨 L’Artiste Imposteur', subtitle: `Catégorie : ${category}`, packId: a.pack.id, category },
    solution: a.item.name,
    guessOptions: guessChoices(a.item, a.pack.items, ctx.rng)
  };
}

export const artiste = deductionModule(
  {
    id: 'artiste',
    name: 'L’Artiste Imposteur',
    family: 'imposteur',
    emoji: '🎨',
    tagline: 'On dessine ensemble… mais l’un de vous ne sait pas quoi !',
    rules: [
      'Tout le monde connaît le mot à dessiner, sauf l’imposteur qui ne connaît que la catégorie.',
      'Chacun ajoute UN trait au dessin commun, à tour de rôle (2 tours).',
      'Démasquez le faux artiste ! S’il est pris, il peut deviner le mot pour gagner.'
    ],
    minPlayers: 3,
    maxPlayers: 10,
    usesThemes: true,
    options: noSpecial.map((o) => (o.key === 'cluesRounds' ? { ...o, default: 2 } : o.key === 'clueSec' ? { ...o, default: 30 } : o))
  },
  {
    clueKind: 'drawing',
    assign: assignArtiste,
    candidates: packItems,
    lookup: (w, pub, packs) => lookupIn(packItems(pub, packs), w, packs),
    prompt: (round) => (round === 1 ? 'Ajoute UN trait au dessin.' : 'Encore un trait !'),
    lastChanceRoles: ['imposteur'],
    defaultRounds: 2
  }
);

// ---------------- 🤥 Le Faux Fan ----------------

const FAN_PROMPTS = [
  'Cite un détail que seul un vrai fan connaît.',
  'Décris un moment marquant lié à ce mot.',
  'Donne un indice encore plus précis !'
];

function assignFauxFan(ctx: RuntimeCtx, active: Player[]): AssignResult {
  // on choisit un univers (groupe) avec assez d'éléments
  const groups = new Map<string, Item[]>();
  let packId: string | undefined;
  for (const e of entries(ctx.packs)) {
    if (!e.item.group) continue;
    const key = e.pack.id + '::' + e.item.group;
    groups.set(key, [...(groups.get(key) ?? []), e.item]);
  }
  const big = [...groups.entries()].filter(([, v]) => v.length >= 3);
  const [key, items] = big.length ? ctx.rng.pick(big) : ['::Mix', entries(ctx.packs).map((e) => e.item)];
  packId = key.split('::')[0] || undefined;
  const topic = key.split('::')[1];
  const item = ctx.rng.pick(items);
  const { bad, ids } = impostorIds(ctx, active, 1);
  const secrets: Record<string, Secret> = {};
  for (const id of ids) secrets[id] = bad.includes(id) ? { role: 'imposteur', word: null, knowsRole: true, hint: `Thème : ${topic}` } : { role: 'civil', word: item.name, emoji: firstEmoji(item.emoji), knowsRole: false };
  return {
    secrets,
    publicInfo: { title: '🤥 Le Faux Fan', subtitle: `Thème : ${topic}`, packId, category: topic },
    solution: item.name,
    guessOptions: guessChoices(item, items, ctx.rng)
  };
}

export const fauxFan = deductionModule(
  {
    id: 'faux-fan',
    name: 'Le Faux Fan',
    family: 'mensonge',
    emoji: '🤥',
    tagline: 'Tous des fans… sauf un qui bluffe.',
    rules: [
      'Un thème est annoncé (ex. Naruto). Les vrais fans reçoivent un élément précis de ce thème.',
      'Le faux fan ne connaît que le thème : il doit bluffer.',
      'Chacun répond aux consignes du présentateur. Démasquez le faux fan !'
    ],
    minPlayers: 3,
    maxPlayers: 12,
    usesThemes: true,
    options: noSpecial.map((o) => (o.key === 'cluesRounds' ? { ...o, default: 2 } : o))
  },
  {
    clueKind: 'phrase',
    assign: assignFauxFan,
    candidates: (pub, packs) => {
      const items = packItems(pub, packs);
      return pub.category ? items.filter((i) => i.group === pub.category) : items;
    },
    lookup: (w, pub, packs) => lookupIn(packItems(pub, packs), w, packs),
    prompt: (round) => FAN_PROMPTS[Math.min(FAN_PROMPTS.length - 1, round - 1)],
    lastChanceRoles: ['imposteur'],
    defaultRounds: 2
  }
);

void keywords;
