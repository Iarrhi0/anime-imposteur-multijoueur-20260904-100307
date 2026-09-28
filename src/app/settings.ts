// Réglages et profil, enregistrés uniquement sur l'appareil.
import { signal } from '@preact/signals';

export interface Settings {
  name: string;
  avatar: string;
  /** Les IA lisent leurs messages à voix haute. */
  aiVoice: boolean;
  /** Le présentateur lit les annonces (mode émission TV). */
  narratorVoice: boolean;
  /** Transcription de ta voix pour que les IA t'entendent. */
  listen: boolean;
  sounds: boolean;
  /** URL du Cloudflare Worker (cerveau IA + relais TURN). */
  brainUrl: string;
  brainOn: boolean;
  /** Serveur TURN personnalisé (optionnel). */
  turnUrl: string;
  turnUser: string;
  turnPass: string;
  animations: boolean;
}

const KEY = 'ip_settings_v1';

const DEFAULTS: Settings = {
  name: '',
  avatar: '😎',
  aiVoice: true,
  narratorVoice: true,
  listen: false,
  sounds: true,
  brainUrl: '',
  brainOn: true,
  turnUrl: '',
  turnUser: '',
  turnPass: '',
  animations: true
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

const state = signal<Settings>(load());

export const settings = {
  signal: state,
  get: () => state.value,
  set(patch: Partial<Settings>) {
    state.value = { ...state.value, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(state.value));
    } catch {
      /* ignore */
    }
  }
};
