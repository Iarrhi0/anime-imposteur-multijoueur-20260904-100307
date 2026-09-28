// Catalogue de tous les jeux, rangés par famille.
import type { FamilyId, GameModule } from '../core/types';
import { imposteur } from './imposteur';
import { questionPiege, cameleon, espion, artiste, fauxFan } from './autres-deduction';
import { vingtQuestions, genie, front, indices, lettres, emojiQuiz, grille } from './devine';
import { loupGarou } from './roles';
import { deuxVerites } from './mensonge';
import { quiGagnerait, tuPreferes, tierList } from './duels';
import { unSeulIndice } from './rapides';

export const FAMILIES: { id: FamilyId; label: string; emoji: string; desc: string }[] = [
  { id: 'imposteur', label: 'Trouver l’imposteur', emoji: '🎭', desc: 'Un joueur n’a pas la même info que les autres' },
  { id: 'devine', label: 'Devine mon personnage', emoji: '🧠', desc: 'Questions, indices, emojis… qui est-ce ?' },
  { id: 'mensonge', label: 'Qui ment ?', emoji: '🤥', desc: 'Bluff et détection de mensonges' },
  { id: 'roles', label: 'Rôles cachés', emoji: '🐺', desc: 'Loup-garou, nuit et jour' },
  { id: 'duels', label: 'Duels & débats', emoji: '⚔️', desc: 'Votez, classez, débattez' },
  { id: 'rapides', label: 'Jeux rapides', emoji: '⚡', desc: 'Parties courtes et coopératives' }
];

export const GAMES: GameModule[] = [
  imposteur,
  questionPiege,
  cameleon,
  espion,
  artiste,
  fauxFan,
  vingtQuestions,
  genie,
  front,
  indices,
  lettres,
  emojiQuiz,
  grille,
  deuxVerites,
  loupGarou,
  quiGagnerait,
  tuPreferes,
  tierList,
  unSeulIndice
].filter(Boolean);

export function getGame(id: string): GameModule | undefined {
  return GAMES.find((g) => g.id === id);
}
