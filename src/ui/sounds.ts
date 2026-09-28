// Petits effets sonores générés à la volée (aucun fichier audio à télécharger).
import { settings } from '../app/settings';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!settings.get().sounds) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, vol = 0.12) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  click: () => tone(660, 0.06, 'triangle'),
  tick: () => tone(1200, 0.04, 'square', 0, 0.05),
  turn: () => {
    tone(523, 0.12, 'triangle');
    tone(784, 0.16, 'triangle', 0.1);
  },
  reveal: () => {
    tone(392, 0.15, 'sawtooth', 0, 0.07);
    tone(523, 0.15, 'sawtooth', 0.12, 0.07);
    tone(659, 0.3, 'sawtooth', 0.24, 0.07);
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', i * 0.16)),
  msg: () => tone(880, 0.05, 'sine', 0, 0.05)
};
