// État global de l'application (navigation, session en cours, notifications).
import { signal } from '@preact/signals';
import type { BaseView, ChatMsg, GameAction, GameModule, GameOptions, Player } from '../core/types';
import { GameHost } from '../core/host';
import { uid } from '../core/rng';

export type Mode = 'solo' | 'local' | 'online' | 'vs';

export type Route =
  | { name: 'home' }
  | { name: 'catalog'; mode: Mode }
  | { name: 'setup'; mode: Mode; gameId: string; preset?: string; campaignLevel?: number; daily?: boolean }
  | { name: 'play' }
  | { name: 'online' }
  | { name: 'room'; code: string }
  | { name: 'settings' }
  | { name: 'packs' }
  | { name: 'campaign' }
  | { name: 'stats' };

export const route = signal<Route>({ name: 'home' });
export const toast = signal<string | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string, ms = 2800) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), ms);
}

export function go(r: Route) {
  route.value = r;
  window.scrollTo?.(0, 0);
}

// ---------- Contrôleur de partie ----------
// Même interface pour une partie locale, pour l'hôte d'un salon et pour un invité.

export interface Controller {
  /** Identifiant unique de la partie (change à chaque « Rejouer »). */
  id: string;
  kind: 'local' | 'online-host' | 'online-client';
  module: GameModule;
  players: Player[];
  /** Joueurs humains qui jouent sur CET appareil. */
  localHumans: string[];
  isHost: boolean;
  getView(pid: string | null): BaseView | null;
  dispatch(pid: string, a: GameAction): void;
  chat(): ChatMsg[];
  sendChat(pid: string, text: string, kind?: 'chat' | 'voice'): void;
  /** Heure de l'hôte = Date.now() + offset. */
  offset(): number;
  subscribe(fn: () => void): () => void;
  stop(): void;
  meta: { gameId: string; options: GameOptions; mode: Mode; campaignLevel?: number; daily?: string };
}

export class LocalController implements Controller {
  kind = 'local' as const;
  isHost = true;
  id = uid('g');
  host: GameHost;
  constructor(
    public module: GameModule,
    public players: Player[],
    public meta: Controller['meta'],
    seed?: number
  ) {
    this.host = new GameHost({ module, players, options: meta.options, seed });
    this.host.start();
  }
  get localHumans() {
    return this.players.filter((p) => p.kind === 'human').map((p) => p.id);
  }
  getView(pid: string | null) {
    return this.host.view(pid);
  }
  dispatch(pid: string, a: GameAction) {
    this.host.dispatch(pid, a);
  }
  chat() {
    return this.host.chat;
  }
  sendChat(pid: string, text: string, kind: 'chat' | 'voice' = 'chat') {
    const p = this.players.find((x) => x.id === pid);
    if (p) this.host.humanChat(p, text, kind);
  }
  offset() {
    return 0;
  }
  subscribe(fn: () => void) {
    return this.host.subscribe(fn);
  }
  stop() {
    this.host.stop();
  }
}

export const session = signal<Controller | null>(null);

/** Scores cumulés sur plusieurs parties de la même soirée. */
export const sessionScores = signal<Record<string, number>>({});

export function startLocalGame(module: GameModule, players: Player[], meta: Controller['meta'], seed?: number) {
  session.value?.stop();
  session.value = new LocalController(module, players, meta, seed);
  go({ name: 'play' });
}

export function endSession() {
  session.value?.stop();
  session.value = null;
}
