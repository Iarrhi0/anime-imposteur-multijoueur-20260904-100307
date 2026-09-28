// Statistiques, badges, campagne et défi du jour : tout reste sur l'appareil.
const KEY = 'ip_stats_v1';

export interface Stats {
  played: number;
  wins: number;
  byGame: Record<string, { played: number; wins: number }>;
  impostorWins: number;
  caughtImpostors: number;
  streak: number;
  bestStreak: number;
  campaign: number; // niveaux terminés
  daily: Record<string, { score: number; win: boolean }>;
  onlineGames: number;
  aiGames: number;
}

const EMPTY: Stats = {
  played: 0,
  wins: 0,
  byGame: {},
  impostorWins: 0,
  caughtImpostors: 0,
  streak: 0,
  bestStreak: 0,
  campaign: 0,
  daily: {},
  onlineGames: 0,
  aiGames: 0
};

export function loadStats(): Stats {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...EMPTY };
  }
}

function save(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function recordGame(r: { gameId: string; win: boolean; wasImpostor?: boolean; online?: boolean; withAI?: boolean; daily?: { date: string; score: number } }) {
  const s = loadStats();
  s.played++;
  const g = (s.byGame[r.gameId] ??= { played: 0, wins: 0 });
  g.played++;
  if (r.win) {
    s.wins++;
    g.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (r.wasImpostor) s.impostorWins++;
  } else s.streak = 0;
  if (r.online) s.onlineGames++;
  if (r.withAI) s.aiGames++;
  if (r.daily) s.daily[r.daily.date] = { score: r.daily.score, win: r.win };
  save(s);
  return s;
}

export function completeLevel(n: number) {
  const s = loadStats();
  s.campaign = Math.max(s.campaign, n);
  save(s);
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  ok: (s: Stats) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'first', emoji: '🎉', name: 'Première partie', desc: 'Jouer une partie', ok: (s) => s.played >= 1 },
  { id: 'win1', emoji: '🏆', name: 'Première victoire', desc: 'Gagner une partie', ok: (s) => s.wins >= 1 },
  { id: 'ten', emoji: '🔟', name: 'Habitué', desc: 'Jouer 10 parties', ok: (s) => s.played >= 10 },
  { id: 'fifty', emoji: '💯', name: 'Accro', desc: 'Jouer 50 parties', ok: (s) => s.played >= 50 },
  { id: 'liar', emoji: '😈', name: 'Menteur pro', desc: 'Gagner 3 fois en imposteur', ok: (s) => s.impostorWins >= 3 },
  { id: 'streak3', emoji: '🔥', name: 'En feu', desc: '3 victoires d’affilée', ok: (s) => s.bestStreak >= 3 },
  { id: 'streak5', emoji: '☄️', name: 'Inarrêtable', desc: '5 victoires d’affilée', ok: (s) => s.bestStreak >= 5 },
  { id: 'explorer', emoji: '🧭', name: 'Explorateur', desc: 'Jouer à 8 jeux différents', ok: (s) => Object.keys(s.byGame).length >= 8 },
  { id: 'all', emoji: '🌈', name: 'Touche-à-tout', desc: 'Jouer à 15 jeux différents', ok: (s) => Object.keys(s.byGame).length >= 15 },
  { id: 'online', emoji: '🌐', name: 'Connecté', desc: 'Jouer une partie en ligne', ok: (s) => s.onlineGames >= 1 },
  { id: 'robots', emoji: '🤖', name: 'Ami des IA', desc: '10 parties avec des IA', ok: (s) => s.aiGames >= 10 },
  { id: 'camp5', emoji: '🗺️', name: 'Aventurier', desc: 'Finir 5 niveaux de campagne', ok: (s) => s.campaign >= 5 },
  { id: 'camp', emoji: '👑', name: 'Légende', desc: 'Finir toute la campagne', ok: (s) => s.campaign >= CAMPAIGN_LENGTH },
  { id: 'daily', emoji: '📅', name: 'Régulier', desc: 'Faire 5 défis du jour', ok: (s) => Object.keys(s.daily).length >= 5 }
];

export const CAMPAIGN_LENGTH = 12;

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
