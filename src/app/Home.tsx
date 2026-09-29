// Accueil : les trois façons de jouer + accès rapides.
import { settings } from './settings';
import { go } from './state';
import { dailyChallenge } from './campaign';
import { getGame } from '../games';
import { loadStats, CAMPAIGN_LENGTH } from './stats';
import { HUMAN_AVATARS } from '../ai/personalities';
import { Card } from '../ui/components';

export function Home() {
  const s = settings.signal.value;
  const dc = dailyChallenge();
  const dg = getGame(dc.gameId);
  const stats = loadStats();
  const doneToday = !!stats.daily[dc.date];

  return (
    <div class="screen">
      <div class="hero">
        <div class="logo">🎭🕵️🧠</div>
        <h1>Imposteur Party</h1>
        <p class="muted">Jeux de société d’imposteur, de bluff et de devinettes — entre amis ou contre des IA.</p>
      </div>

      <Card>
        <div class="row gap">
          <button
            class="icon-btn"
            style={{ fontSize: '1.6rem' }}
            onClick={() => settings.set({ avatar: HUMAN_AVATARS[(HUMAN_AVATARS.indexOf(s.avatar) + 1) % HUMAN_AVATARS.length] })}
            title="Changer d’avatar"
          >
            {s.avatar}
          </button>
          <input class="plain grow" placeholder="Ton pseudo" maxLength={16} value={s.name} onInput={(e) => settings.set({ name: (e.target as HTMLInputElement).value })} />
        </div>
      </Card>

      <div class="mode-grid">
        <button class="mode-card" onClick={() => go({ name: 'catalog', mode: 'solo' })}>
          <span class="mc-emoji">🤖</span>
          <span>
            <div class="mc-title">Solo contre des IA</div>
            <div class="mc-desc">Des IA avec de vraies personnalités qui bluffent, accusent et se défendent.</div>
          </span>
        </button>
        <button class="mode-card" onClick={() => go({ name: 'catalog', mode: 'vs' })}>
          <span class="mc-emoji">⚔️</span>
          <span>
            <div class="mc-title">Mode VS (à deux)</div>
            <div class="mc-desc">Toi contre une IA ou contre un ami : devine mon personnage, Qui est-ce, quiz…</div>
          </span>
        </button>
        <button class="mode-card" onClick={() => go({ name: 'online' })}>
          <span class="mc-emoji">📞</span>
          <span>
            <div class="mc-title">Appel entre amis</div>
            <div class="mc-desc">Crée un salon, partage le code : vous vous parlez comme dans un appel de groupe.</div>
          </span>
        </button>
        <button class="mode-card" onClick={() => go({ name: 'catalog', mode: 'local' })}>
          <span class="mc-emoji">📱</span>
          <span>
            <div class="mc-title">Un seul téléphone</div>
            <div class="mc-desc">Vous êtes ensemble : le téléphone passe de main en main (IA possibles).</div>
          </span>
        </button>
        <button class="mode-card" onClick={() => go({ name: 'campaign' })}>
          <span class="mc-emoji">🗺️</span>
          <span>
            <div class="mc-title">Campagne</div>
            <div class="mc-desc">
              {stats.campaign}/{CAMPAIGN_LENGTH} niveaux — des IA de plus en plus fortes.
            </div>
          </span>
        </button>
      </div>

      {dg && (
        <button class="mode-card" style={{ width: '100%' }} onClick={() => go({ name: 'setup', mode: 'solo', gameId: dc.gameId, daily: true })}>
          <span class="mc-emoji">📅</span>
          <span>
            <div class="mc-title">Défi du jour {doneToday ? '✅' : ''}</div>
            <div class="mc-desc">
              {dg.emoji} {dg.name} — la même partie pour tout le monde aujourd’hui.
            </div>
          </span>
        </button>
      )}

      <h3 style={{ marginTop: 22 }}>Accès rapides</h3>
      <div class="quick-grid">
        <button class="quick" onClick={() => go({ name: 'packs' })}>
          <b>✏️ Mes packs</b>
          <span class="muted small">Crée tes propres thèmes</span>
        </button>
        <button class="quick" onClick={() => go({ name: 'stats' })}>
          <b>🏅 Badges</b>
          <span class="muted small">
            {stats.played} parties, {stats.wins} victoires
          </span>
        </button>
        <button class="quick" onClick={() => go({ name: 'settings' })}>
          <b>⚙️ Réglages</b>
          <span class="muted small">Voix, IA, vocal</span>
        </button>
        <button class="quick" onClick={() => go({ name: 'catalog', mode: 'solo' })}>
          <b>📚 Tous les jeux</b>
          <span class="muted small">Catalogue complet</span>
        </button>
      </div>
      <p class="muted small center" style={{ marginTop: 24 }}>
        100 % gratuit · aucune donnée stockée en ligne · vocal de téléphone à téléphone
      </p>
    </div>
  );
}
