// Personnalités des IA : chacune a son caractère, sa façon de parler et sa stratégie.
import type { PersonalityId } from '../core/types';
import type { Rng } from '../core/rng';

export interface Personality {
  id: PersonalityId;
  label: string;
  emoji: string;
  desc: string;
  /** Probabilité de parler spontanément (0..1). */
  talk: number;
  /** Tendance à accuser vite. */
  aggro: number;
  /** Tendance à suivre l'avis de la majorité. */
  follow: number;
  /** Capacité à bluffer quand elle est imposteur. */
  bluff: number;
  /** Tendance à changer d'avis. */
  flexible: number;
  /** Réglages de voix (synthèse vocale du navigateur). */
  voice: { pitch: number; rate: number };
  lines: Partial<Record<LineKind, string[]>>;
}

export type LineKind =
  | 'hello'
  | 'accuse'
  | 'suspect'
  | 'defend'
  | 'agree'
  | 'disagree'
  | 'unsure'
  | 'mentioned'
  | 'innocent'
  | 'win'
  | 'lose'
  | 'thinking'
  | 'vote'
  | 'lastChance'
  | 'bluff'
  | 'react';

// Lignes communes à tous, complétées par les lignes propres à chaque personnalité.
const COMMON: Record<LineKind, string[]> = {
  hello: ['Salut tout le monde !', 'Prêt·e à jouer.', 'On y va !'],
  accuse: ['Je pense que c’est {name}.', '{name}, ton indice ne colle pas du tout.', 'Moi je vote {name}.'],
  suspect: ['{name} me paraît louche…', 'Je garde un œil sur {name}.', 'Hmm, {name} est resté très vague.'],
  defend: ['Ce n’est pas moi, je vous jure !', 'Mon indice était logique pourtant.', 'Pourquoi moi ? Regardez plutôt les autres.'],
  agree: ['Je suis d’accord avec {name}.', 'Pareil que {name}.', '{name} a raison.'],
  disagree: ['Je ne suis pas d’accord avec {name}.', 'Non, {name} se trompe.', 'Je ne pense pas, {name}.'],
  unsure: ['Difficile à dire pour l’instant.', 'J’hésite encore.', 'Je n’ai pas assez d’infos.'],
  mentioned: ['Oui {name} ?', 'Tu me parles {name} ?', 'Je t’écoute {name}.'],
  innocent: ['Pour moi {name} est clean.', '{name} a l’air sincère.', 'Je fais confiance à {name}.'],
  win: ['Victoire !', 'Trop facile.', 'GG à tous !'],
  lose: ['Bien joué…', 'Je me suis fait avoir.', 'La prochaine fois !'],
  thinking: ['Laissez-moi réfléchir…', 'Hmm…', 'Voyons voir…'],
  vote: ['J’ai voté.', 'C’est fait.', 'Vote envoyé.'],
  lastChance: ['Je tente ma chance…', 'Je crois que c’était ça !', 'Allez, je devine !'],
  bluff: ['Franchement, c’était évident.', 'J’ai donné un indice parfait.', 'On est tous d’accord sur le mot, non ?'],
  react: ['Intéressant…', 'Ah oui ?', 'Je note.']
};

export const PERSONALITIES: Personality[] = [
  {
    id: 'parano',
    label: 'Le Parano',
    emoji: '🕵️',
    desc: 'Soupçonne tout le monde et accuse vite.',
    talk: 0.8,
    aggro: 0.9,
    follow: 0.2,
    bluff: 0.4,
    flexible: 0.7,
    voice: { pitch: 1.2, rate: 1.15 },
    lines: {
      accuse: ['C’EST {name} ! J’en suis sûr !', '{name}, arrête de mentir !', 'Tout pointe vers {name}.'],
      suspect: ['{name}… pourquoi tu dis ça ?', 'Je le sens mal, {name}.', 'Même toi {name}, je te surveille.'],
      defend: ['Moi ? Vous êtes fous ! C’est un complot.', 'Évidemment qu’on m’accuse, moi !'],
      unsure: ['Tout le monde est suspect ici.', 'Je ne fais confiance à personne.']
    }
  },
  {
    id: 'discret',
    label: 'Le Discret',
    emoji: '🤫',
    desc: 'Parle peu mais chaque mot compte.',
    talk: 0.25,
    aggro: 0.4,
    follow: 0.3,
    bluff: 0.8,
    flexible: 0.3,
    voice: { pitch: 0.8, rate: 0.9 },
    lines: {
      accuse: ['{name}.', 'Regardez {name}.', '{name}. C’est tout.'],
      suspect: ['{name}…', 'Hmm. {name}.'],
      defend: ['Non.', 'Pas moi.'],
      unsure: ['…', 'On verra.']
    }
  },
  {
    id: 'bluffeur',
    label: 'Le Bluffeur',
    emoji: '🎭',
    desc: 'Ment avec aplomb, toujours sûr de lui.',
    talk: 0.7,
    aggro: 0.6,
    follow: 0.3,
    bluff: 1,
    flexible: 0.4,
    voice: { pitch: 1, rate: 1.05 },
    lines: {
      accuse: ['Faites-moi confiance : c’est {name}.', 'J’ai un 6e sens, c’est {name}.'],
      defend: ['Moi ? J’ai donné le meilleur indice de la partie.', 'Relisez mon indice, il est parfait.'],
      bluff: ['C’était tellement évident, le mot.', 'On a tous le même, je le sens.']
    }
  },
  {
    id: 'leader',
    label: 'Le Leader',
    emoji: '👑',
    desc: 'Organise le débat et oriente les votes.',
    talk: 0.75,
    aggro: 0.6,
    follow: 0.1,
    bluff: 0.6,
    flexible: 0.4,
    voice: { pitch: 0.95, rate: 1 },
    lines: {
      hello: ['OK l’équipe, on reste concentrés.', 'Chacun donne son avis, on vote ensemble.'],
      accuse: ['Tout le monde vote {name}, c’est le plus logique.', 'Je propose qu’on élimine {name}.'],
      unsure: ['Faisons le point : qui a été le plus vague ?', 'On a besoin de plus d’indices.']
    }
  },
  {
    id: 'suiveur',
    label: 'Le Suiveur',
    emoji: '🐑',
    desc: 'Suit la majorité, rarement le premier à parler.',
    talk: 0.4,
    aggro: 0.2,
    follow: 0.95,
    bluff: 0.3,
    flexible: 0.9,
    voice: { pitch: 1.1, rate: 0.95 },
    lines: {
      agree: ['Ouais, comme {name} !', 'Je suis {name} sur ce coup.', '+1 pour {name}.'],
      unsure: ['Je fais comme vous.', 'Vous pensez quoi, vous ?']
    }
  },
  {
    id: 'chaotique',
    label: 'Le Chaotique',
    emoji: '🤡',
    desc: 'Imprévisible, sème le doute pour le plaisir.',
    talk: 0.85,
    aggro: 0.7,
    follow: 0.1,
    bluff: 0.7,
    flexible: 1,
    voice: { pitch: 1.35, rate: 1.2 },
    lines: {
      accuse: ['Je vote {name}, parce que… pourquoi pas ?', '{name} a une tête d’imposteur.'],
      react: ['Mdrr', 'Quoi ?? 😂', 'Plot twist !'],
      unsure: ['Et si c’était moi ? 😈', 'Et si on était tous imposteurs ?']
    }
  },
  {
    id: 'intello',
    label: 'L’Intello',
    emoji: '🧠',
    desc: 'Analyse chaque indice, très logique.',
    talk: 0.6,
    aggro: 0.5,
    follow: 0.2,
    bluff: 0.5,
    flexible: 0.5,
    voice: { pitch: 1, rate: 1.1 },
    lines: {
      accuse: ['Statistiquement, l’indice de {name} est le moins cohérent.', 'Analyse faite : {name}.'],
      suspect: ['L’indice de {name} a une faible corrélation avec les autres.', 'Hypothèse : {name}.'],
      unsure: ['Données insuffisantes.', 'Il me faut un tour de plus.']
    }
  },
  {
    id: 'drole',
    label: 'Le Blagueur',
    emoji: '😂',
    desc: 'Fait des blagues mais reste redoutable.',
    talk: 0.7,
    aggro: 0.4,
    follow: 0.5,
    bluff: 0.6,
    flexible: 0.6,
    voice: { pitch: 1.15, rate: 1.1 },
    lines: {
      accuse: ['{name}, même ton indice a honte 😂', 'Désolé {name}, mais c’est toi 😅'],
      react: ['Haha', 'Je suis mort 😂', 'Pas mal celle-là'],
      defend: ['Moi imposteur ? Je suis trop drôle pour ça.']
    }
  },
  {
    id: 'timide',
    label: 'Le Timide',
    emoji: '😳',
    desc: 'Hésite beaucoup, se défend mal.',
    talk: 0.3,
    aggro: 0.2,
    follow: 0.7,
    bluff: 0.2,
    flexible: 0.8,
    voice: { pitch: 1.25, rate: 0.9 },
    lines: {
      accuse: ['Euh… peut-être {name} ?', 'J’ose pas dire… {name} ?'],
      defend: ['C’est… c’est pas moi…', 'Euh non, je crois pas…'],
      unsure: ['Je sais pas trop…', 'Euh…']
    }
  },
  {
    id: 'competitif',
    label: 'Le Compétitif',
    emoji: '🔥',
    desc: 'Veut gagner à tout prix.',
    talk: 0.65,
    aggro: 0.75,
    follow: 0.3,
    bluff: 0.75,
    flexible: 0.4,
    voice: { pitch: 0.9, rate: 1.1 },
    lines: {
      accuse: ['On perd pas de temps : {name}.', '{name}, t’es grillé.'],
      win: ['Je le savais ! 🔥', 'Encore une victoire.'],
      lose: ['Pff… revanche !', 'Pas possible…']
    }
  }
];

export function personality(id?: PersonalityId): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}

export function line(p: Personality, kind: LineKind, rng: Rng, vars: Record<string, string> = {}): string {
  const own = p.lines[kind] ?? [];
  const pool = own.length && rng.chance(0.7) ? own : COMMON[kind];
  let s = rng.pick(pool);
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

// Noms et avatars des IA.
export const AI_NAMES: { name: string; avatar: string }[] = [
  { name: 'Kaito', avatar: '🦊' },
  { name: 'Aïcha', avatar: '🐱' },
  { name: 'Moussa', avatar: '🦁' },
  { name: 'Yuki', avatar: '🐰' },
  { name: 'Léo', avatar: '🐯' },
  { name: 'Nina', avatar: '🦄' },
  { name: 'Hiro', avatar: '🐲' },
  { name: 'Fatou', avatar: '🦋' },
  { name: 'Sora', avatar: '🦉' },
  { name: 'Inès', avatar: '🐼' },
  { name: 'Ryo', avatar: '🐺' },
  { name: 'Mia', avatar: '🐨' },
  { name: 'Ousmane', avatar: '🐘' },
  { name: 'Emma', avatar: '🐧' },
  { name: 'Ken', avatar: '🦅' },
  { name: 'Awa', avatar: '🐬' }
];

export const HUMAN_AVATARS = ['😎', '🤠', '👽', '🤖', '👻', '🐸', '🐵', '🦖', '🐙', '🦈', '🍕', '⚡', '🔥', '🌙', '🎮', '👑'];

export const COLORS = ['#ff5d8f', '#4cc9f0', '#f7b801', '#7bd389', '#b388ff', '#ff8c42', '#2ec4b6', '#e76f51', '#90be6d', '#f15bb5', '#00bbf9', '#fee440'];
