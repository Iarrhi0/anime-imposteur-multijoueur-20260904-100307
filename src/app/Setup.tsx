// Préparation d'une partie locale (solo ou un seul téléphone).
import { useMemo, useState } from 'preact/hooks';
import type { GameOptions, Player } from '../core/types';
import { getGame } from '../games';
import { Btn, Card, Section } from '../ui/components';
import { AISlots, DifficultyPicker, OptionsForm, PackPicker, PresetPicker, defaultOptions, makeAIPlayers, newAISlot, type AISlot } from './forms';
import { go, startLocalGame, type Mode } from './state';
import { settings } from './settings';
import { COLORS, HUMAN_AVATARS } from '../ai/personalities';
import { uid } from '../core/rng';
import { LEVELS, dailyChallenge } from './campaign';
import { TopBar } from './TopBar';

export function Setup({ mode, gameId, preset, campaignLevel, daily }: { mode: Mode; gameId: string; preset?: string; campaignLevel?: number; daily?: boolean }) {
  const game = getGame(gameId);
  const level = campaignLevel ? LEVELS.find((l) => l.n === campaignLevel) : undefined;
  const dc = daily ? dailyChallenge() : undefined;
  const me = settings.get();

  const init = useMemo<GameOptions>(() => {
    if (!game) return {};
    let o = defaultOptions(game);
    const p = game.presets?.find((x) => x.id === preset);
    if (p) o = { ...o, ...p.options };
    if (level) o = { ...o, ...level.options };
    if (dc) o = { ...o, ...dc.options };
    return o;
  }, [gameId]);

  const [options, setOptions] = useState<GameOptions>(init);
  const [humans, setHumans] = useState<{ id: string; name: string; avatar: string }[]>(() =>
    mode === 'local'
      ? [
          { id: uid('h_'), name: me.name || 'Joueur 1', avatar: me.avatar },
          { id: uid('h_'), name: 'Joueur 2', avatar: HUMAN_AVATARS[1] },
          { id: uid('h_'), name: 'Joueur 3', avatar: HUMAN_AVATARS[2] }
        ]
      : [{ id: uid('h_'), name: me.name.trim() || 'Joueur', avatar: me.avatar }]
  );
  const [slots, setSlots] = useState<AISlot[]>(() => {
    if (level) return level.ais.map((personality) => ({ ...newAISlot(), personality }));
    const n = mode === 'solo' ? Math.max(3, game?.minPlayers ?? 3) : Math.max(0, (game?.minPlayers ?? 3) - 3);
    return Array.from({ length: Math.min(n, (game?.maxPlayers ?? 8) - 1) }, newAISlot);
  });

  if (!game) return <div class="screen">Jeu introuvable.</div>;
  const locked = !!level || !!dc;
  const total = humans.length + slots.length;
  const tooFew = total < game.minPlayers;
  const tooMany = total > game.maxPlayers;

  const start = () => {
    const humanPlayers: Player[] = humans.map((h, i) => ({ id: h.id, name: h.name.trim() || `Joueur ${i + 1}`, avatar: h.avatar, color: COLORS[i % COLORS.length], kind: 'human' }));
    const ais = makeAIPlayers(slots, new Set(humanPlayers.map((h) => h.name)));
    const players = [...humanPlayers, ...ais];
    startLocalGame(game, players, { gameId: game.id, options, mode, campaignLevel, daily: dc?.date }, dc?.seed);
  };

  return (
    <div>
      <TopBar title={`${game.emoji} ${game.name}`} back={() => go(level ? { name: 'campaign' } : dc ? { name: 'home' } : { name: 'catalog', mode })} />
      <div class="screen">
        {level && (
          <Card class="section">
            <b>
              🗺️ Niveau {level.n} : {level.title}
            </b>
            <p class="muted">{level.desc}. Gagne pour débloquer la suite !</p>
          </Card>
        )}
        {dc && (
          <Card class="section">
            <b>📅 Défi du jour — {dc.date}</b>
            <p class="muted">Même partie pour tout le monde aujourd’hui. Compare ton score avec tes amis !</p>
          </Card>
        )}
        <p class="muted">{game.tagline}</p>
        <details class="adv">
          <summary>📜 Règles du jeu</summary>
          <ol>
            {game.rules.map((r) => (
              <li>{r}</li>
            ))}
          </ol>
        </details>

        {!locked && game.presets && (
          <Section title="Variantes">
            <PresetPicker game={game} options={options} onChange={setOptions} />
          </Section>
        )}

        {!locked && game.usesThemes && (
          <Section title="Thèmes">
            <PackPicker selected={options.packs ?? ['mix']} onChange={(packs) => setOptions({ ...options, packs })} />
          </Section>
        )}

        {!locked && (
          <Section title="Difficulté des IA">
            <DifficultyPicker value={options.difficulty} onChange={(difficulty) => setOptions({ ...options, difficulty })} />
          </Section>
        )}

        {!locked && game.options.length > 0 && (
          <Section title="Réglages">
            <Card>
              <OptionsForm game={game} options={options} onChange={setOptions} />
            </Card>
          </Section>
        )}

        <Section title={`Joueurs (${total}) — ${game.minPlayers} à ${game.maxPlayers}`}>
          <Card>
            {mode === 'local' && (
              <>
                <b>👥 Joueurs sur ce téléphone</b>
                {humans.map((h, i) => (
                  <div class="player-row">
                    <button
                      class="icon-btn"
                      type="button"
                      onClick={() => setHumans(humans.map((x) => (x.id === h.id ? { ...x, avatar: HUMAN_AVATARS[(HUMAN_AVATARS.indexOf(x.avatar) + 1) % HUMAN_AVATARS.length] } : x)))}
                    >
                      {h.avatar}
                    </button>
                    <input class="plain" value={h.name} maxLength={16} onInput={(e) => setHumans(humans.map((x) => (x.id === h.id ? { ...x, name: (e.target as HTMLInputElement).value } : x)))} />
                    {humans.length > 1 && (
                      <button class="icon-btn" type="button" onClick={() => setHumans(humans.filter((x) => x.id !== h.id))}>
                        ✖
                      </button>
                    )}
                    {void i}
                  </div>
                ))}
                {humans.length + slots.length < game.maxPlayers && (
                  <Btn kind="ghost" onClick={() => setHumans([...humans, { id: uid('h_'), name: `Joueur ${humans.length + 1}`, avatar: HUMAN_AVATARS[humans.length % HUMAN_AVATARS.length] }])}>
                    + Ajouter un joueur
                  </Btn>
                )}
                <hr style={{ borderColor: 'var(--line)', margin: '14px 0' }} />
              </>
            )}
            {mode === 'solo' && (
              <p>
                {humans[0].avatar} <b>{humans[0].name}</b> <span class="muted">(toi)</span>
              </p>
            )}
            {!locked ? <AISlots slots={slots} onChange={setSlots} max={Math.max(0, game.maxPlayers - humans.length)} /> : <p class="muted">{slots.length} IA vont t’affronter.</p>}
          </Card>
        </Section>

        {tooFew && <p class="pill warn">Il faut au moins {game.minPlayers} joueurs (ajoute des IA).</p>}
        {tooMany && <p class="pill warn">Maximum {game.maxPlayers} joueurs.</p>}
        <Btn big disabled={tooFew || tooMany} onClick={start}>
          🚀 Lancer la partie
        </Btn>
      </div>
    </div>
  );
}
