// Catalogue des jeux par famille.
import { FAMILIES, GAMES } from '../games';
import { go, type Mode } from './state';
import { TopBar } from './TopBar';

const MODE_LABEL: Record<Mode, string> = { solo: '🤖 Solo contre des IA', local: '📱 Un seul téléphone', online: '🌐 En ligne', vs: '⚔️ Mode VS (à deux)' };

export function Catalog({ mode, onPick }: { mode: Mode; onPick?: (gameId: string, preset?: string) => void }) {
  const pick = onPick ?? ((gameId: string, preset?: string) => go({ name: 'setup', mode, gameId, preset }));
  return (
    <div>
      {!onPick && <TopBar title={MODE_LABEL[mode]} back={() => go({ name: 'home' })} />}
      <div class={onPick ? '' : 'screen'}>
        {FAMILIES.map((f) => {
          const games = GAMES.filter((g) => g.family === f.id && (mode !== 'vs' || g.minPlayers <= 2));
          if (!games.length) return null;
          return (
            <div class="family">
              <h2>
                {f.emoji} {f.label}
              </h2>
              <p class="muted small">{f.desc}</p>
              <div class="game-grid">
                {games.map((g) => (
                  <button class="game-card" onClick={() => pick(g.id)}>
                    <span class="gc-emoji">{g.emoji}</span>
                    <span class="gc-name">{g.name}</span>
                    <span class="gc-tag">{g.tagline}</span>
                    <span class="muted small">
                      👥 {g.minPlayers}–{g.maxPlayers}
                      {g.presets?.length ? ` · ${g.presets.length} variantes` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
