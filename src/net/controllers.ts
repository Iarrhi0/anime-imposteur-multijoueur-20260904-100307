// Contrôleurs de partie en ligne.
// - L'HÔTE exécute le jeu et les IA, et publie à chaque joueur SA vue (secrets compris, rien de plus).
// - Les INVITÉS affichent leur vue et envoient leurs actions à l'hôte.
import type { BaseView, ChatMsg, GameAction, GameModule, Player } from '../core/types';
import { GameHost } from '../core/host';
import { uid } from '../core/rng';
import type { Controller } from '../app/state';
import type { RoomClient } from './room';

type Listener = () => void;

export class OnlineHostController implements Controller {
  kind = 'online-host' as const;
  isHost = true;
  id = uid('g');
  host: GameHost;
  private listeners = new Set<Listener>();
  private lastSent = new Map<string, string>();
  private unsubs: (() => void)[] = [];
  private pubTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPublish = 0;

  constructor(
    public room: RoomClient,
    public module: GameModule,
    public players: Player[],
    public meta: Controller['meta'],
    seed: number
  ) {
    this.host = new GameHost({
      module,
      players,
      options: meta.options,
      seed,
      onChat: (m) => void room.sendChat(m).catch(() => {})
    });
    const { fs } = room.f;
    // actions des invités
    this.unsubs.push(
      fs.onSnapshot(room.col('actions'), (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added') return;
          const d = ch.doc.data() as { uid: string; a: GameAction };
          if (players.some((p) => p.id === d.uid)) this.host.dispatch(d.uid, d.a);
          void fs.deleteDoc(ch.doc.ref).catch(() => {});
        });
      })
    );
    // messages des invités → mémoire du jeu (les IA les lisent)
    const onChat = () => {
      // les doublons sont ignorés par l'hôte (même identifiant)
      for (const m of room.chat.value.slice(-20)) {
        if (m.from === room.uid || m.from === 'system') continue;
        const p = players.find((x) => x.id === m.from);
        if (p && p.kind === 'human') this.host.humanChat(p, m.text, m.kind === 'voice' ? 'voice' : 'chat', m.id, m.ts, true);
      }
      this.emit();
    };
    this.unsubs.push(room.chat.subscribe(onChat));
    this.host.subscribe(() => {
      this.schedulePublish();
      this.emit();
    });
    this.host.start();
  }

  get localHumans() {
    return [this.room.uid];
  }

  private schedulePublish() {
    if (this.pubTimer) return;
    const wait = Math.max(0, 300 - (Date.now() - this.lastPublish));
    this.pubTimer = setTimeout(() => {
      this.pubTimer = null;
      this.lastPublish = Date.now();
      void this.publish();
    }, wait);
  }

  private async publish() {
    const { fs } = this.room.f;
    const targets = new Set(this.room.activeMembers().map((m) => m.uid));
    this.players.filter((p) => p.kind === 'human').forEach((p) => targets.add(p.id));
    targets.delete(this.room.uid);
    const writes: Promise<unknown>[] = [];
    for (const id of targets) {
      const isPlayer = this.players.some((p) => p.id === id);
      const v = JSON.stringify(this.host.view(isPlayer ? id : null));
      if (this.lastSent.get(id) === v) continue;
      this.lastSent.set(id, v);
      writes.push(fs.setDoc(this.room.ref('views', id), { v, hostNow: Date.now(), gameNo: this.room.room.value?.gameNo ?? 0 }).catch(() => this.lastSent.delete(id)));
    }
    await Promise.all(writes);
  }

  getView(pid: string | null) {
    return this.host.view(pid);
  }
  dispatch(pid: string, a: GameAction) {
    this.host.dispatch(pid, a);
  }
  chat(): ChatMsg[] {
    return this.host.chat;
  }
  sendChat(pid: string, text: string, kind: 'chat' | 'voice' = 'chat') {
    const p = this.players.find((x) => x.id === pid);
    if (p) this.host.humanChat(p, text, kind);
    else void this.room.sendChat({ from: pid, name: this.room.profile.name, text, kind });
  }
  offset() {
    return 0;
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  stop() {
    this.host.stop();
    this.unsubs.forEach((u) => u());
    if (this.pubTimer) clearTimeout(this.pubTimer);
  }
}

export class OnlineClientController implements Controller {
  kind = 'online-client' as const;
  isHost = false;
  id = uid('g');
  private view: BaseView | null = null;
  private off = 0;
  private listeners = new Set<Listener>();
  private unsubs: (() => void)[] = [];

  constructor(
    public room: RoomClient,
    public module: GameModule,
    public players: Player[],
    public meta: Controller['meta']
  ) {
    const { fs } = room.f;
    this.unsubs.push(
      fs.onSnapshot(room.ref('views', room.uid), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as { v: string; hostNow: number; gameNo?: number };
        // ignore la vue d'une partie précédente
        if ((d.gameNo ?? 0) !== (room.room.value?.gameNo ?? 0)) return;
        try {
          this.view = JSON.parse(d.v);
          this.off = d.hostNow - Date.now();
        } catch {
          /* ignore */
        }
        this.emit();
      })
    );
    this.unsubs.push(room.chat.subscribe(() => this.emit()));
  }

  get localHumans() {
    return this.players.some((p) => p.id === this.room.uid) ? [this.room.uid] : [];
  }
  getView() {
    return this.view;
  }
  dispatch(_pid: string, a: GameAction) {
    void this.room.sendAction(a).catch(() => {});
  }
  chat(): ChatMsg[] {
    return this.room.chat.value;
  }
  sendChat(pid: string, text: string, kind: 'chat' | 'voice' = 'chat') {
    const p = this.players.find((x) => x.id === pid);
    void this.room.sendChat({ from: this.room.uid, name: p?.name ?? this.room.profile.name, text, kind }).catch(() => {});
  }
  offset() {
    return this.off;
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  stop() {
    this.unsubs.forEach((u) => u());
  }
}
