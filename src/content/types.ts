// Types des packs de contenu (thèmes).
// Un pack = une liste d'éléments (personnages, films, lieux, plats…) décrits par des
// tags d'attributs. Les tags servent à la fois à trouver des paires « proches »
// (Undercover), à faire raisonner les IA et à poser des questions oui/non.

export type PackCategory =
  | 'anime'
  | 'films'
  | 'series'
  | 'dessins-animes'
  | 'jeux-video'
  | 'super-heros'
  | 'sport'
  | 'celebrites'
  | 'musique'
  | 'histoire'
  | 'geographie'
  | 'nourriture'
  | 'animaux'
  | 'metiers'
  | 'objets'
  | 'marques'
  | 'perso';

export interface Item {
  /** Nom affiché, ex. « Naruto Uzumaki ». */
  name: string;
  /** Autres façons de l'écrire, acceptées quand on devine (ex. « Naruto »). */
  aliases?: string[];
  /** 2 à 4 emojis qui évoquent l'élément (sert au quiz emoji). */
  emoji: string;
  /** Sous-univers / famille, ex. « Naruto », « Marvel », « Fruits ». Sert aux paires proches. */
  group?: string;
  /** 6 à 12 tags d'attributs, en minuscules, en français, réutilisés entre éléments du pack. */
  tags: string[];
  /** 4 à 6 indices, du plus vague au plus précis. Ne contiennent jamais le nom. */
  clues: string[];
}

export interface Attribute {
  /** Tag concerné (doit exister dans les tags des éléments). */
  tag: string;
  /** Question oui/non correspondante, ex. « Est-ce un ninja ? ». */
  question: string;
}

export interface Pack {
  id: string;
  name: string;
  emoji: string;
  category: PackCategory;
  description: string;
  /** Questions oui/non sur les tags fréquents du pack. */
  attributes: Attribute[];
  items: Item[];
}

/** Lieu pour le jeu « L'Espion du lieu ». */
export interface Location {
  name: string;
  emoji: string;
  /** Univers : 'quotidien', 'anime', 'films', 'jeux-video', 'histoire'… */
  theme: string;
  /** 6 à 8 rôles possibles dans ce lieu. */
  roles: string[];
  /** 8 à 12 mots-clés (objets, ambiance, actions) utilisés par les IA pour poser/répondre. */
  keywords: string[];
}

/** Paire de questions pour « La Question Piège ». La réponse attendue est courte (nombre, mot). */
export interface QuestionPair {
  /** Question posée à la majorité. */
  main: string;
  /** Question proche posée à l'imposteur : les réponses doivent se ressembler sans être identiques. */
  impostor: string;
  /** Type de réponse attendue, sert aux IA. */
  answer: 'nombre' | 'mot' | 'oui-non' | 'personne' | 'lieu';
  /** Plage typique pour 'nombre' [min, max] pour la majorité. */
  range?: [number, number];
  /** Plage typique pour 'nombre' pour l'imposteur. */
  impostorRange?: [number, number];
  /** Exemples de réponses plausibles (pour les IA) quand ce n'est pas un nombre. */
  examples?: string[];
  impostorExamples?: string[];
}

/** Dilemme pour « Tu préfères ? ». */
export interface Dilemma {
  a: string;
  b: string;
  /** Thème : 'fun', 'anime', 'pouvoirs', 'quotidien', 'extrême'… */
  theme: string;
}

/** Faits d'une IA pour « 2 vérités, 1 mensonge ». */
export interface PersonaFacts {
  truths: string[];
  lies: string[];
}
