// Chat vocal gratuit : WebRTC en « maillage » (chaque téléphone parle directement aux autres).
// Firebase ne sert qu'à échanger les petits messages de connexion (signalisation).
// Aucun son ne passe par un serveur, sauf si un relais TURN est nécessaire sur ton réseau.
import { signal } from '@preact/signals';
import type { RoomClient } from './room';
import { settings } from '../app/settings';

const STUN: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  analyser?: AnalyserNode;
  retry?: ReturnType<typeof setTimeout>;
}

export class VoiceMesh {
  on = signal(false);
  muted = signal(false);
  speaking = signal<Set<string>>(new Set());
  status = signal('');
  private stream: MediaStream | null = null;
  private peers = new Map<string, Peer>();
  private unsubs: (() => void)[] = [];
  private ac: AudioContext | null = null;
  private localAnalyser?: AnalyserNode;
  private meter: ReturnType<typeof setInterval> | null = null;
  private ice: RTCIceServer[] = STUN;

  constructor(private room: RoomClient) {}

  async join() {
    if (this.on.value) return;
    this.status.value = 'Demande d’accès au micro…';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch {
      this.status.value = '❌ Micro refusé : autorise le micro dans ton navigateur.';
      return;
    }
    this.ice = await iceServers();
    this.on.value = true;
    this.status.value = 'Connexion aux autres…';
    this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.localAnalyser = this.analyse(this.stream);
    const { fs } = this.room.f;
    // messages de signalisation qui me sont destinés
    this.unsubs.push(
      fs.onSnapshot(fs.query(this.room.col('signals'), fs.where('to', '==', this.room.uid)), (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added') return;
          const d = ch.doc.data() as { from: string; type: string; data: any };
          void this.onSignal(d.from, d.type, d.data);
          void fs.deleteDoc(ch.doc.ref).catch(() => {});
        });
      })
    );
    // qui est dans le vocal ?
    this.unsubs.push(this.room.members.subscribe(() => this.sync()));
    await this.room.setVoice(true);
    this.sync();
    this.meter = setInterval(() => this.measure(), 200);
  }

  async leave() {
    this.on.value = false;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.meter) clearInterval(this.meter);
    void this.ac?.close().catch(() => {});
    this.ac = null;
    this.speaking.value = new Set();
    this.status.value = '';
    await this.room.setVoice(false);
  }

  toggleMute() {
    this.muted.value = !this.muted.value;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted.value));
  }

  private sync() {
    if (!this.on.value) return;
    const others = this.room
      .activeMembers()
      .filter((m) => m.voice && m.uid !== this.room.uid)
      .map((m) => m.uid);
    for (const id of others) if (!this.peers.has(id) && this.room.uid < id) void this.call(id);
    for (const id of [...this.peers.keys()]) if (!others.includes(id)) this.closePeer(id);
    const n = [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length;
    this.status.value = others.length ? `🔊 Connecté à ${n}/${others.length}` : '🎧 En attente d’autres joueurs dans le vocal…';
  }

  private makePeer(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const audio = new Audio();
    audio.autoplay = true;
    (audio as any).playsInline = true;
    const peer: Peer = { pc, audio, pendingIce: [] };
    this.stream?.getTracks().forEach((t) => pc.addTrack(t, this.stream!));
    pc.onicecandidate = (e) => e.candidate && void this.send(id, 'ice', e.candidate.toJSON());
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      void audio.play().catch(() => {});
      peer.analyser = this.analyse(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.closePeer(id);
        if (this.room.uid < id) peer.retry = setTimeout(() => this.on.value && void this.call(id), 3000);
      }
      this.sync();
    };
    this.peers.set(id, peer);
    return peer;
  }

  private async call(id: string) {
    const p = this.makePeer(id);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    await this.send(id, 'offer', { type: offer.type, sdp: offer.sdp });
  }

  private async onSignal(from: string, type: string, data: any) {
    if (!this.on.value) return;
    let p = this.peers.get(from);
    try {
      if (type === 'offer') {
        if (p) this.closePeer(from);
        p = this.makePeer(from);
        await p.pc.setRemoteDescription(data);
        const answer = await p.pc.createAnswer();
        await p.pc.setLocalDescription(answer);
        await this.send(from, 'answer', { type: answer.type, sdp: answer.sdp });
        for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c);
      } else if (type === 'answer' && p) {
        await p.pc.setRemoteDescription(data);
        for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c);
      } else if (type === 'ice' && p) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data);
        else p.pendingIce.push(data);
      }
    } catch (e) {
      console.warn('Signal vocal ignoré', e);
    }
  }

  private async send(to: string, type: string, data: any) {
    const { fs } = this.room.f;
    await fs.addDoc(this.room.col('signals'), { from: this.room.uid, to, type, data, ts: Date.now() }).catch(() => {});
  }

  private closePeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    clearTimeout(p.retry);
    p.pc.close();
    p.audio.srcObject = null;
    this.peers.delete(id);
  }

  private analyse(stream: MediaStream): AnalyserNode | undefined {
    if (!this.ac) return;
    try {
      const src = this.ac.createMediaStreamSource(stream);
      const an = this.ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      return an;
    } catch {
      return;
    }
  }

  private measure() {
    const level = (an?: AnalyserNode) => {
      if (!an) return 0;
      const buf = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      return Math.sqrt(sum / buf.length);
    };
    const set = new Set<string>();
    if (!this.muted.value && level(this.localAnalyser) > 6) set.add(this.room.uid);
    this.peers.forEach((p, id) => level(p.analyser) > 6 && set.add(id));
    const prev = this.speaking.value;
    if (set.size !== prev.size || [...set].some((x) => !prev.has(x))) this.speaking.value = set;
  }
}

/** Serveurs STUN gratuits + relais TURN optionnel (réglages ou Worker). */
async function iceServers(): Promise<RTCIceServer[]> {
  const s = settings.get();
  const list = [...STUN];
  if (s.turnUrl) list.push({ urls: s.turnUrl, username: s.turnUser, credential: s.turnPass });
  if (s.brainUrl) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(s.brainUrl.replace(/\/$/, '') + '/turn', { signal: ctrl.signal });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.iceServers)) list.push(...d.iceServers);
      }
    } catch {
      /* pas de relais : on tente en direct */
    }
  }
  return list;
}
