// Salon en ligne : créer / rejoindre avec un code, liste des joueurs, chat, lancement de partie.
// Tout est éphémère : l'hôte efface le salon en le fermant.
import { signal } from '@preact/signals';
import type { ChatMsg, GameAction, GameOptions, Player } from '../core/types';
import { fb, type FB } from './firebase';
import { COLORS } from '../ai/personalities';

export const ROOMS = 'ip_rooms';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface RoomDoc {
  host: string;
  createdAt: number;
  status: 'lobby' | 'playing';
  gameId: string;
  options: GameOptions;
  ais: Player[];
  players?: Player[];
  gameNo: number;
  seed?: number;
}

export interface Member {
  uid: string;
  name: string;
  avatar: string;
  color: string;
  seen: number;
  joinedAt: number;
  voice?: boolean;
  /** ✋ veut parler, 🤫 demande le silence. */
  hand?: 'parler' | 'silence' | null;
}

export interface Profile {
  name: string;
  avatar: string;
}

const STALE_MS = 60_000;

export class RoomClient {
  room = signal<RoomDoc | null>(null);
  members = signal<Member[]>([]);
  chat = signal<ChatMsg[]>([]);
  error = signal<string | null>(null);
  closed = signal(false);
  private unsubs: (() => void)[] = [];
  private beat: ReturnType<typeof setInterval> | null = null;

  private constructor(
    public f: FB,
    public code: string,
    public profile: Profile
  ) {}

  get uid() {
    return this.f.uid;
  }
  get isHost() {
    return this.room.value?.host === this.f.uid;
  }

  ref(...path: string[]) {
    return this.f.fs.doc(this.f.db, ROOMS, this.code, ...path);
  }
  col(name: string) {
    return this.f.fs.collection(this.f.db, ROOMS, this.code, name);
  }

  static async create(profile: Profile, gameId: string, options: GameOptions): Promise<RoomClient> {
    const f = await fb();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      const ref = f.fs.doc(f.db, ROOMS, code);
      const snap = await f.fs.getDoc(ref);
      if (snap.exists()) continue;
      const doc: RoomDoc = { host: f.uid, createdAt: Date.now(), status: 'lobby', gameId, options, ais: [], gameNo: 0 };
      await f.fs.setDoc(ref, doc);
      const rc = new RoomClient(f, code, profile);
      await rc.enter();
      return rc;
    }
    throw new Error('Impossible de créer un code de salon, réessaie.');
  }

  static async join(code: string, profile: Profile): Promise<RoomClient> {
    const f = await fb();
    const c = code.trim().toUpperCase();
    const snap = await f.fs.getDoc(f.fs.doc(f.db, ROOMS, c));
    if (!snap.exists()) throw new Error('not-found');
    const rc = new RoomClient(f, c, profile);
    await rc.enter();
    return rc;
  }

  private async enter() {
    const { fs } = this.f;
    const existing = this.members.value.find((m) => m.uid === this.uid);
    const me: Member = {
      uid: this.uid,
      name: this.profile.name || 'Joueur',
      avatar: this.profile.avatar,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      seen: Date.now(),
      joinedAt: existing?.joinedAt ?? Date.now()
    };
    await fs.setDoc(this.ref('members', this.uid), me);
    this.unsubs.push(
      fs.onSnapshot(
        this.ref(),
        (snap) => {
          if (!snap.exists()) {
            this.closed.value = true;
            this.room.value = null;
            return;
          }
          this.room.value = snap.data() as RoomDoc;
        },
        (e) => (this.error.value = String(e))
      )
    );
    this.unsubs.push(
      fs.onSnapshot(this.col('members'), (snap) => {
        this.members.value = snap.docs.map((d) => d.data() as Member).sort((a, b) => a.joinedAt - b.joinedAt);
      })
    );
    this.unsubs.push(
      fs.onSnapshot(fs.query(this.col('chat'), fs.orderBy('ts'), fs.limitToLast(120)), (snap) => {
        this.chat.value = snap.docs.map((d) => {
          const x = d.data() as any;
          return { id: d.id, from: x.from, name: x.name, text: x.text, ts: x.ts, kind: x.kind } as ChatMsg;
        });
      })
    );
    this.beat = setInterval(() => {
      fs.updateDoc(this.ref('members', this.uid), { seen: Date.now() }).catch(() => {});
    }, 15_000);
  }

  activeMembers(): Member[] {
    const now = Date.now();
    return this.members.value.filter((m) => m.uid === this.uid || now - m.seen < STALE_MS);
  }

  async sendChat(msg: { from: string; name: string; text: string; kind: ChatMsg['kind']; id?: string; ts?: number }) {
    const { fs } = this.f;
    const data = { uid: this.uid, from: msg.from, name: msg.name, text: msg.text.slice(0, 300), kind: msg.kind, ts: msg.ts ?? Date.now() };
    if (msg.id) await fs.setDoc(fs.doc(this.col('chat'), msg.id), data);
    else await fs.addDoc(this.col('chat'), data);
  }

  async sendAction(a: GameAction) {
    const { fs } = this.f;
    await fs.addDoc(this.col('actions'), { uid: this.uid, a: JSON.parse(JSON.stringify(a)), ts: Date.now() });
  }

  async setHand(hand: 'parler' | 'silence' | null) {
    await this.f.fs.updateDoc(this.ref('members', this.uid), { hand }).catch(() => {});
  }

  async setVoice(on: boolean) {
    await this.f.fs.updateDoc(this.ref('members', this.uid), { voice: on }).catch(() => {});
  }

  // ---------- Hôte ----------

  async update(patch: Partial<RoomDoc>) {
    if (!this.isHost) return;
    await this.f.fs.updateDoc(this.ref(), JSON.parse(JSON.stringify(patch)));
  }

  async kick(uid: string) {
    if (!this.isHost) return;
    await this.f.fs.deleteDoc(this.ref('members', uid));
  }

  /** Efface tout le salon (sous-collections comprises). */
  async destroy() {
    const { fs } = this.f;
    for (const c of ['chat', 'actions', 'views', 'signals', 'members']) {
      try {
        const snap = await fs.getDocs(this.col(c));
        await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
      } catch {
        /* ignore */
      }
    }
    await fs.deleteDoc(this.ref()).catch(() => {});
  }

  async clearChat() {
    const { fs } = this.f;
    const snap = await fs.getDocs(this.col('chat'));
    await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
  }

  async leave() {
    this.stopListening();
    if (this.isHost) await this.destroy();
    else await this.f.fs.deleteDoc(this.ref('members', this.uid)).catch(() => {});
  }

  stopListening() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
  }
}

export function memberToPlayer(m: Member): Player {
  return { id: m.uid, name: m.name, avatar: m.avatar, color: m.color, kind: 'human' };
}
