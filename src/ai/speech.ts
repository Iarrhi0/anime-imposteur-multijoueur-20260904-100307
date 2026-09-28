// Voix gratuites intégrées au navigateur :
// - synthèse vocale : les IA et le présentateur parlent à voix haute ;
// - reconnaissance vocale : ta voix est transcrite pour que les IA t'entendent.
import type { Personality } from './personalities';

let voices: SpeechSynthesisVoice[] = [];
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export function canSpeak(): boolean {
  return !!synth;
}

const queue: { text: string; pitch: number; rate: number; voiceIdx: number }[] = [];
let speaking = false;

function cleanForSpeech(t: string): string {
  return t
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pump() {
  if (!synth || speaking) return;
  const next = queue.shift();
  if (!next) return;
  const text = cleanForSpeech(next.text);
  if (!text) return pump();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  if (voices.length) u.voice = voices[next.voiceIdx % voices.length];
  u.pitch = next.pitch;
  u.rate = next.rate;
  speaking = true;
  const done = () => {
    speaking = false;
    setTimeout(pump, 120);
  };
  u.onend = done;
  u.onerror = done;
  synth.speak(u);
  // sécurité si onend ne se déclenche jamais (certains Android)
  setTimeout(() => speaking && done(), Math.max(4000, text.length * 110));
}

export function speak(text: string, opts: { pitch?: number; rate?: number; voiceIdx?: number } = {}) {
  if (!synth) return;
  if (queue.length > 4) queue.splice(0, queue.length - 4);
  queue.push({ text, pitch: opts.pitch ?? 1, rate: opts.rate ?? 1.05, voiceIdx: opts.voiceIdx ?? 0 });
  pump();
}

export function speakAs(p: Personality | null, text: string, seed = 0) {
  if (!p) return speak(text, { pitch: 1, rate: 1.08, voiceIdx: 0 });
  speak(text, { pitch: p.voice.pitch, rate: p.voice.rate, voiceIdx: seed + 1 });
}

export function stopSpeaking() {
  queue.length = 0;
  synth?.cancel();
  speaking = false;
}

// ---------- Reconnaissance vocale ----------

type Rec = any;
let rec: Rec | null = null;
let wanted = false;

export function canListen(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startListening(onText: (text: string) => void, onState?: (on: boolean) => void): boolean {
  if (!canListen()) return false;
  stopListening();
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  rec = new Ctor();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = false;
  wanted = true;
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const t = String(e.results[i][0].transcript ?? '').trim();
        if (t) onText(t);
      }
    }
  };
  rec.onend = () => {
    // le navigateur coupe régulièrement l'écoute : on relance tant que l'utilisateur la veut
    if (wanted) {
      try {
        rec.start();
      } catch {
        onState?.(false);
      }
    } else onState?.(false);
  };
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      wanted = false;
      onState?.(false);
    }
  };
  try {
    rec.start();
    onState?.(true);
    return true;
  } catch {
    return false;
  }
}

export function stopListening() {
  wanted = false;
  try {
    rec?.stop();
  } catch {
    /* ignore */
  }
  rec = null;
}
