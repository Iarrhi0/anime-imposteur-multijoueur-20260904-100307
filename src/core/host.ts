// L'hôte d'une partie : il exécute le module de jeu, fait vivre les IA,
// gère le chrono et le chat. Utilisé en solo, en pass-and-play et par l'hôte d'un salon.
import type { AgentMind, BaseState, BaseView, ChatMsg, GameAction, GameModule, GameOptions, Player, RuntimeCtx } from './types';
import { makeRng, uid, type Rng } from './rng';
import { resolvePacks } from '../content';
import type { Pack } from '../content/types';
import { askBrain, brainEnabled } from '../ai/llm';

export type HostListener = () => void;

export interface HostConfig {
  module: GameModule;
  players: Player[];
  options: GameOptions;
  seed?: number;
  /** Appelé pour chaque nouveau message (le salon en ligne le diffuse). */
  onChat?: (m: ChatMsg) => void;
}

const MAX_CHAT = 200;

export class GameHost {
  module: GameModule;
  players: Player[];
  options: GameOptions;
  state: BaseState;
  chat: ChatMsg[] = [];
  rng: Rng;
  packs: Pack[];
  minds = new Map<string, AgentMind>();
  private listeners = new Set<HostListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private onChat?: (m: ChatMsg) => void;
  private stopped = false;

  constructor(cfg: HostConfig) {
    this.module = cfg.module;
    this.players = cfg.players;
    this.options = cfg.options;
    this.onChat = cfg.onChat;
    this.rng = makeRng(cfg.seed);
    this.packs = resolvePacks(cfg.options.packs);
    for (const p of this.players) if (p.kind === 'ai') this.minds.set(p.id, { mem: {}, nextAt: Date.now() + 800 + this.rng.int(0, 1500), lastChatSeen: 0 });
    this.state = this.module.setup(this.ctx());
  }

  private ctx(): RuntimeCtx {
    return {
      now: Date.now(),
      rng: this.rng,
      players: this.players,
      packs: this.packs,
      options: this.options,
      announce: (text) => this.pushChat({ from: 'system', name: '🎙️ Présentateur', text, kind: 'system' })
    };
  }

  start() {
    this.stopped = false;
    this.timer = setInterval(() => this.tick(), 400);
    this.emit();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(fn: HostListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  view(pid: string | null): BaseView {
    return this.module.view(this.state, pid, { players: this.players });
  }

  dispatch(pid: string, action: GameAction) {
    if (this.stopped) return;
    try {
      this.module.onAction(this.state, pid, action, this.ctx());
    } catch (e) {
      console.error('Action refusée', action, e);
    }
    this.emit();
  }

  /** `remote` = message déjà diffusé (reçu du salon) : on ne le renvoie pas. */
  pushChat(m: Omit<ChatMsg, 'id' | 'ts'> & { id?: string; ts?: number }, remote = false) {
    const msg: ChatMsg = { ...m, id: m.id ?? uid('m'), ts: m.ts ?? Date.now() } as ChatMsg;
    if (this.chat.some((x) => x.id === msg.id)) return;
    this.chat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
    if (!remote) this.onChat?.(msg);
  }

  /** Message reçu d'un humain (écrit ou transcrit depuis le vocal). */
  humanChat(player: Player, text: string, kind: 'chat' | 'voice' = 'chat', id?: string, ts?: number, remote = false) {
    const t = text.trim().slice(0, 300);
    if (!t) return;
    this.pushChat({ id, ts, from: player.id, name: player.name, text: t, kind }, remote);
    this.emit();
  }

  private tick() {
    if (this.stopped) return;
    const ctx = this.ctx();
    if (this.module.onTick) {
      try {
        this.module.onTick(this.state, ctx);
      } catch (e) {
        console.error(e);
      }
    }
    this.runAgents();
    this.emit();
  }

  private runAgents() {
    const now = Date.now();
    for (const p of this.players) {
      if (p.kind !== 'ai' || p.spectator) continue;
      const mind = this.minds.get(p.id)!;
      if (now < mind.nextAt) continue;
      const view = this.view(p.id);
      const difficulty = (this.options.difficulty ?? 'normal') as AgentMindDifficulty;
      let acted = false;
      try {
        this.module.ai.think(view, mind, {
          now,
          rng: this.rng,
          me: p,
          players: this.players,
          packs: this.packs,
          options: this.options,
          difficulty,
          chat: this.chat.slice(-40),
          act: (a) => {
            acted = true;
            try {
              this.module.onAction(this.state, p.id, a, this.ctx());
            } catch (e) {
              console.error('Action IA refusée', a, e);
            }
          },
          say: (text) => {
            acted = true;
            this.aiSay(p, text, view);
          },
          wait: (ms) => {
            mind.nextAt = Date.now() + ms;
          }
        });
      } catch (e) {
        console.error('Erreur IA', p.name, e);
      }
      if (mind.nextAt <= now) mind.nextAt = now + (acted ? 1500 : 700) + this.rng.int(0, 900);
      mind.lastChatSeen = this.chat.length ? this.chat[this.chat.length - 1].ts : mind.lastChatSeen;
    }
  }

  /**
   * Une IA parle. Si le « cerveau IA conversationnel » est configuré, il reformule
   * le message de façon naturelle à partir de ce qu'elle sait (sa vue uniquement).
   */
  private aiSay(p: Player, text: string, view: BaseView) {
    if (!brainEnabled()) {
      this.pushChat({ from: p.id, name: p.name, text, kind: 'chat' });
      return;
    }
    const recent = this.chat.slice(-15);
    askBrain({ player: p, intent: text, view, chat: recent, game: this.module.name })
      .then((out) => this.pushChat({ from: p.id, name: p.name, text: out || text, kind: 'chat' }))
      .catch(() => this.pushChat({ from: p.id, name: p.name, text, kind: 'chat' }))
      .finally(() => this.emit());
  }
}

type AgentMindDifficulty = 'facile' | 'normal' | 'difficile';
