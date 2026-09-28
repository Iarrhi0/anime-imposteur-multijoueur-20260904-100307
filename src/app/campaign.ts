// Campagne solo (niveaux de difficulté croissante) et défi du jour.
import type { GameOptions, PersonalityId } from '../core/types';
import { seedFromString } from '../core/rng';
import { todayKey } from './stats';

export interface Level {
  n: number;
  title: string;
  desc: string;
  gameId: string;
  options: GameOptions;
  ais: (PersonalityId | 'random')[];
}

export const LEVELS: Level[] = [
  { n: 1, title: 'Premiers pas', desc: 'Imposteur classique contre 3 IA gentilles', gameId: 'imposteur', options: { mode: 'classique', difficulty: 'facile' }, ais: ['timide', 'suiveur', 'drole'] },
  { n: 2, title: 'Emoji master', desc: 'Retrouve 6 éléments en emojis', gameId: 'emoji-quiz', options: { difficulty: 'facile' }, ais: ['drole', 'timide'] },
  { n: 3, title: 'Question piège', desc: 'Qui a répondu à une autre question ?', gameId: 'question-piege', options: { difficulty: 'normal' }, ais: ['suiveur', 'intello', 'drole', 'timide'] },
  { n: 4, title: 'Undercover', desc: 'Des mots très proches…', gameId: 'imposteur', options: { mode: 'undercover', difficulty: 'normal' }, ais: ['intello', 'parano', 'suiveur', 'discret'] },
  { n: 5, title: 'Le Caméléon', desc: 'Une grille, un intrus', gameId: 'cameleon', options: { difficulty: 'normal' }, ais: ['leader', 'bluffeur', 'timide', 'drole'] },
  { n: 6, title: 'Indices express', desc: 'Sois plus rapide que les IA', gameId: 'indices', options: { difficulty: 'normal' }, ais: ['competitif', 'intello', 'drole'] },
  { n: 7, title: 'L’Espion', desc: 'Pose les bonnes questions', gameId: 'espion', options: { difficulty: 'normal' }, ais: ['parano', 'leader', 'discret', 'suiveur'] },
  { n: 8, title: 'Mr. White', desc: 'Élimination avec Mr. White', gameId: 'imposteur', options: { mode: 'mrwhite', voteMode: 'elimination', difficulty: 'difficile' }, ais: ['intello', 'bluffeur', 'leader', 'parano', 'competitif'] },
  { n: 9, title: 'Faux fan', desc: 'Démasque celui qui bluffe', gameId: 'faux-fan', options: { difficulty: 'difficile' }, ais: ['bluffeur', 'intello', 'competitif', 'discret'] },
  { n: 10, title: 'Nuit des loups', desc: 'Loup-garou contre 6 IA', gameId: 'loup-garou', options: { difficulty: 'difficile' }, ais: ['parano', 'leader', 'bluffeur', 'suiveur', 'discret', 'intello'] },
  { n: 11, title: 'Chaos', desc: 'Rebondissements et 2 imposteurs', gameId: 'imposteur', options: { mode: 'conscient', numImpostors: 2, impostorsKnow: true, voteMode: 'elimination', twists: true, difficulty: 'difficile' }, ais: ['chaotique', 'bluffeur', 'intello', 'parano', 'leader', 'competitif'] },
  { n: 12, title: 'Grand final', desc: 'Undercover difficile, élimination, lettre imposée', gameId: 'imposteur', options: { mode: 'undercover', clueMode: 'lettre', voteMode: 'elimination', cluesRounds: 2, difficulty: 'difficile' }, ais: ['intello', 'bluffeur', 'competitif', 'leader', 'discret'] }
];

const DAILY_ROTATION: { gameId: string; options: GameOptions }[] = [
  { gameId: 'imposteur', options: { mode: 'undercover' } },
  { gameId: 'question-piege', options: {} },
  { gameId: 'cameleon', options: {} },
  { gameId: 'indices', options: {} },
  { gameId: 'emoji-quiz', options: {} },
  { gameId: 'espion', options: {} },
  { gameId: 'lettres', options: {} },
  { gameId: 'imposteur', options: { mode: 'aveugle' } }
];

export function dailyChallenge(d = new Date()) {
  const date = todayKey(d);
  const seed = seedFromString('ip-daily-' + date);
  const pick = DAILY_ROTATION[seed % DAILY_ROTATION.length];
  return { date, seed, ...pick, options: { ...pick.options, difficulty: 'normal' as const } };
}
