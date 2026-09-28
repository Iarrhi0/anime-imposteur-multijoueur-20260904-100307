// Composants d'interface partagés par les jeux rôles / mensonge / duels / rapides.
import type { ComponentChildren } from 'preact';
import type { Player } from '../core/types';
import { Avatar, byId, Confetti, Pill, PlayerTag, Section } from '../ui/components';
import '../ui/roles.css';

export function GameHead({ title, sub, pills }: { title: ComponentChildren; sub?: ComponentChildren; pills?: ComponentChildren }) {
  return (
    <div class="game-head">
      <div class="gh-title">{title}</div>
      {sub && <div class="gh-sub">{sub}</div>}
      {pills && <div class="gh-meta">{pills}</div>}
    </div>
  );
}

/** Pastilles « a joué / attend » pour une liste de joueurs. */
export function DoneDots({ ids, done, players, mark = '✅' }: { ids: string[]; done: string[]; players: Player[]; mark?: string }) {
  return (
    <div class="ready-list">
      {ids.map((id) => (
        <span class={'ready-item' + (done.includes(id) ? ' ok' : '')}>
          <Avatar p={byId(players, id)} size={30} />
          {done.includes(id) ? mark : '…'}
        </span>
      ))}
    </div>
  );
}

export function Scoreboard({ scores, players, winners, ids, unit = 'pts' }: { scores: Record<string, number>; players: Player[]; winners?: string[]; ids?: string[]; unit?: string }) {
  const list = (ids ?? Object.keys(scores)).filter((id) => byId(players, id)).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  return (
    <div class="rp-scores">
      {list.map((id, i) => (
        <div class={'rp-score-row' + (winners?.includes(id) ? ' win' : '')}>
          <span class="rp-rank">{i + 1}</span>
          <PlayerTag p={byId(players, id)} />
          <span class="rp-pts">
            {scores[id] ?? 0} {unit}
          </span>
          {winners?.includes(id) && <span>🏆</span>}
        </div>
      ))}
    </div>
  );
}

export function EndPanel({ summary, scores, players, winners, me, ids, children, unit }: {
  summary?: string;
  scores: Record<string, number>;
  players: Player[];
  winners?: string[];
  me: Player | null;
  ids?: string[];
  children?: ComponentChildren;
  unit?: string;
}) {
  const iWon = !!me && !!winners?.includes(me.id);
  return (
    <div class="end rp-end">
      {iWon && <Confetti />}
      {me && <div class={'rp-verdict ' + (iWon ? 'good' : 'bad')}>{iWon ? '🏆 Victoire !' : winners?.length ? 'Pas cette fois…' : 'Partie terminée'}</div>}
      {summary && <div class="summary">{summary}</div>}
      {children}
      <Section title="Classement">
        <Scoreboard scores={scores} players={players} winners={winners} ids={ids} unit={unit} />
      </Section>
    </div>
  );
}

export function Progress({ idx, total, label = 'Manche' }: { idx: number; total: number; label?: string }) {
  return (
    <Pill tone="info">
      {label} {Math.min(idx + 1, total)}/{total}
    </Pill>
  );
}

export function Bar({ pct, tone }: { pct: number; tone?: 'a' | 'b' | 'good' | 'bad' }) {
  return (
    <div class={'rp-bar ' + (tone ?? '')}>
      <div style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} />
    </div>
  );
}
