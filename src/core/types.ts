// Contrat commun à tous les jeux. Chaque jeu est un module qui décrit :
// - comment démarrer une partie (setup),
// - comment réagir aux actions des joueurs (onAction) et au temps (onTick),
// - ce que chaque joueur a le droit de voir (view),
// - comment jouent les IA (ai),
// - son plateau d'interface (Board).
// L'hôte (téléphone local ou hôte du salon) exécute le module ; les autres ne font qu'afficher.
import type { ComponentType } from 'preact';
import type { Rng } from './rng';
import type { Pack } from '../content/types';

export type PlayerKind = 'human' | 'ai';

export type PersonalityId =
  | 'parano'
  | 'discret'
  | 'bluffeur'
  | 'leader'
  | 'suiveur'
  | 'chaotique'
  | 'intello'
  | 'drole'
  | 'timide'
  | 'competitif';

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  avatar: string;
  color: string;
  personality?: PersonalityId;
  /** Ne joue pas (mode enquêteur, hôte spectateur). */
  spectator?: boolean;
}

export interface ChatMsg {
  id: string;
  from: string; // id du joueur, ou 'system' pour le présentateur
  name: string;
  text: string;
  ts: number;
  kind: 'chat' | 'system' | 'voice' | 'event';
}

export type FamilyId =
  | 'imposteur'
  | 'devine'
  | 'mensonge'
  | 'roles'
  | 'duels'
  | 'rapides';

export interface OptionChoice {
  value: string;
  label: string;
}

export interface OptionDef {
  key: string;
  label: string;
  type: 'select' | 'toggle' | 'number';
  choices?: OptionChoice[];
  min?: number;
  max?: number;
  step?: number;
  default: string | number | boolean;
  help?: string;
  /** Option avancée (repliée par défaut). */
  advanced?: boolean;
  showIf?: (opts: GameOptions) => boolean;
}

export type GameOptions = Record<string, any> & {
  packs?: string[];
  difficulty?: 'facile' | 'normal' | 'difficile';
  twists?: boolean;
};

export interface RuntimeCtx {
  now: number;
  rng: Rng;
  players: Player[];
  packs: Pack[];
  options: GameOptions;
  /** Message du présentateur dans le chat (lu à voix haute en mode émission). */
  announce(text: string): void;
}

export interface BaseState {
  phase: string;
  /** Échéance de la phase en cours (ms, horloge de l'hôte). */
  deadline?: number;
  scores: Record<string, number>;
  winners?: string[];
  /** Résumé affiché à la fin. */
  summary?: string;
}

/** Ce qu'un joueur voit. `needs` = joueurs dont on attend une action maintenant. */
export interface BaseView {
  phase: string;
  needs: string[];
  deadline?: number;
  scores: Record<string, number>;
  winners?: string[];
  summary?: string;
  [k: string]: any;
}

export interface GameAction {
  type: string;
  [k: string]: any;
}

export interface BoardProps<V extends BaseView = any> {
  view: V;
  /** Joueur qui regarde l'écran (null = vue publique, ex. discussion en pass-and-play). */
  me: Player | null;
  players: Player[];
  dispatch(action: GameAction): void;
  /** Temps restant avant l'échéance, en secondes (déjà corrigé du décalage d'horloge). */
  remaining: number | null;
  local: boolean;
}

// ---------- IA ----------

export interface AgentMind {
  /** Mémoire libre du module pour cette IA (soupçons, indices entendus…). */
  mem: Record<string, any>;
  /** Prochain moment où l'IA a le droit d'agir (ms). */
  nextAt: number;
  /** Dernier message du chat déjà traité. */
  lastChatSeen: number;
}

export interface AgentAPI {
  now: number;
  rng: Rng;
  me: Player;
  players: Player[];
  packs: Pack[];
  options: GameOptions;
  difficulty: 'facile' | 'normal' | 'difficile';
  /** Messages publics récents (dont ceux des humains, écrits ou transcrits du vocal). */
  chat: ChatMsg[];
  act(action: GameAction): void;
  say(text: string): void;
  /** Laisse l'IA « réfléchir » avant sa prochaine intervention. */
  wait(ms: number): void;
}

export interface AIStrategy<V extends BaseView = any> {
  /** Appelée régulièrement pour chaque IA avec SA vue uniquement (elle ne triche pas). */
  think(view: V, mind: AgentMind, api: AgentAPI): void;
}

export interface GameModule<S extends BaseState = any, V extends BaseView = any> {
  id: string;
  name: string;
  family: FamilyId;
  emoji: string;
  tagline: string;
  rules: string[];
  minPlayers: number;
  maxPlayers: number;
  usesThemes: boolean;
  options: OptionDef[];
  /** Préréglages rapides (variantes) affichés comme des cartes. */
  presets?: { id: string; label: string; emoji: string; desc: string; options: GameOptions }[];
  setup(ctx: RuntimeCtx): S;
  onAction(s: S, pid: string, action: GameAction, ctx: RuntimeCtx): void;
  onTick?(s: S, ctx: RuntimeCtx): void;
  view(s: S, pid: string | null, ctx: { players: Player[] }): V;
  ai: AIStrategy<V>;
  Board: ComponentType<BoardProps<V>>;
}
