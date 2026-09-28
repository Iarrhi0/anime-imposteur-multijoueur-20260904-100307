// Types et constantes du Loup-Garou (partagés entre le moteur et le plateau).
import type { BaseState, BaseView } from '../../core/types';


export type LGRole = 'loup' | 'villageois' | 'voyante' | 'garde' | 'bouffon' | 'complice';
export type LGPhase = 'reveal' | 'night' | 'day' | 'vote' | 'verdict' | 'end';

export const LG_ROLE: Record<LGRole, { label: string; emoji: string; team: 'loups' | 'village' | 'solo'; desc: string }> = {
  loup: { label: 'Loup-Garou', emoji: '🐺', team: 'loups', desc: 'Chaque nuit, choisis une victime avec les autres loups. Le jour, fais-toi passer pour un villageois.' },
  villageois: { label: 'Villageois', emoji: '🧑‍🌾', team: 'village', desc: 'Aucun pouvoir, mais ton vote compte : trouve les loups et élimine-les.' },
  voyante: { label: 'Détective', emoji: '🔮', team: 'village', desc: 'Chaque nuit, inspecte un joueur pour savoir s’il est loup. À toi de choisir quand le révéler…' },
  garde: { label: 'Ange gardien', emoji: '😇', team: 'village', desc: 'Chaque nuit, protège un joueur de l’attaque des loups (pas le même deux nuits de suite).' },
  bouffon: { label: 'Bouffon', emoji: '🃏', team: 'solo', desc: 'Tu gagnes SEUL si le village t’élimine au vote. Sois louche… mais pas trop.' },
  complice: { label: 'Complice', emoji: '🦹', team: 'loups', desc: 'Tu connais les loups (eux ne te connaissent pas) et tu gagnes avec eux. Le Détective te voit comme un villageois.' }
};

export interface LGDeath {
  day: number;
  pid: string;
  cause: 'loups' | 'vote';
  role?: LGRole;
}

export interface LGDay {
  day: number;
  votes: Record<string, string>;
  lynched: string | null;
  role?: LGRole;
  text: string;
}

export interface LGState extends BaseState {
  phase: LGPhase;
  day: number;
  active: string[];
  alive: string[];
  roles: Record<string, LGRole>;
  ready: string[];
  /** Nuit : votes des loups (loup → cible). */
  wolfVotes: Record<string, string>;
  seerPick: string | null;
  guardPick: string | null;
  lastGuarded: string | null;
  /** Nuit : joueurs (humains ou acteurs) ayant terminé. */
  nightDone: string[];
  seerResults: { day: number; target: string; wolf: boolean }[];
  lastNight: { victim: string | null; saved: boolean } | null;
  votes: Record<string, string>;
  history: LGDay[];
  deaths: LGDeath[];
  kinds: Record<string, 'human' | 'ai'>;
  opts: Record<string, any>;
}

export interface LGMe {
  role: LGRole;
  alive: boolean;
  /** Loups connus (loups et complice). */
  wolves?: string[];
  seerResults?: LGState['seerResults'];
  lastGuarded?: string | null;
  /** A déjà agi cette nuit. */
  done: boolean;
  myTarget?: string | null;
  isNightActor: boolean;
}

export interface LGView extends BaseView {
  phase: LGPhase;
  day: number;
  active: string[];
  alive: string[];
  me: LGMe | null;
  wolfVotes?: Record<string, string>;
  ready: string[];
  voted: string[];
  myVote?: string;
  lastNight: LGState['lastNight'];
  history: LGDay[];
  deaths: LGDeath[];
  composition: Partial<Record<LGRole, number>>;
  revealRoles: boolean;
  reveal?: Record<string, LGRole>;
}

