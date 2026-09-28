// Petits composants d'interface communs aux jeux « Devine ».
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { BaseView, Player } from '../../core/types';
import { Avatar, byId, Confetti, PlayerTag, Pill, Section } from '../../ui/components';
import { norm } from '../../core/text';
import '../../ui/devine.css';

export function DvHead({ emoji, title, sub, children }: { emoji: string; title: ComponentChildren; sub?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <div class="game-head dv-head">
      <div class="gh-title">
        {emoji} {title}
      </div>
      {sub && <div class="gh-sub">{sub}</div>}
      {children && <div class="gh-meta">{children}</div>}
    </div>
  );
}

export function Scores({ v, players, ids, mark }: { v: BaseView; players: Player[]; ids?: string[]; mark?: (id: string) => ComponentChildren }) {
  const list = (ids ?? Object.keys(v.scores)).filter((id) => byId(players, id));
  const sorted = [...list].sort((a, b) => (v.scores[b] ?? 0) - (v.scores[a] ?? 0));
  return (
    <div class="dv-scores">
      {sorted.map((id) => (
        <div class={'dv-score' + (v.needs.includes(id) ? ' waiting' : '') + (v.winners?.includes(id) ? ' win' : '')}>
          <Avatar p={byId(players, id)} size={28} />
          <span class="dv-score-name">{byId(players, id)?.name}</span>
          {mark?.(id)}
          <b>{v.scores[id] ?? 0}</b>
        </div>
      ))}
    </div>
  );
}

export function AnswerBadge({ a }: { a: string }) {
  const n = norm(a);
  const cls = n === 'oui' || n === 'correct' ? 'yes' : n === 'non' || n === 'faux' ? 'no' : 'maybe';
  const label = n === 'oui' ? '✅ Oui' : n === 'non' ? '❌ Non' : n === 'correct' ? '🎯 Trouvé !' : n === 'faux' ? '❌ Raté' : n === 'passe' ? '⏭️ Passe' : '🤷 Je ne sais pas';
  return <span class={'dv-ans ' + cls}>{label}</span>;
}

export interface LogRow {
  pid?: string;
  text: string;
  answer: string;
  guess?: boolean;
  extra?: ComponentChildren;
}

export function QLog({ rows, players, title = 'Questions posées', max = 30 }: { rows: LogRow[]; players: Player[]; title?: string; max?: number }) {
  if (!rows.length) return null;
  const shown = rows.slice(-max).reverse();
  return (
    <Section title={title} right={<Pill>{rows.length}</Pill>}>
      <div class="dv-log">
        {shown.map((r) => (
          <div class={'dv-log-row' + (r.guess ? ' guess' : '')}>
            {r.pid && <Avatar p={byId(players, r.pid)} size={24} />}
            <span class="dv-log-q">
              {r.guess ? '🎯 ' : ''}
              {r.text}
            </span>
            <AnswerBadge a={r.answer} />
            {r.extra}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Suggest({ list, onPick, disabled }: { list: string[]; onPick: (q: string) => void; disabled?: boolean }) {
  if (!list.length) return null;
  return (
    <div class="dv-sugg">
      <div class="muted small">💡 Questions suggérées</div>
      <div class="chips">
        {list.map((q) => (
          <button class="chip dv-chip" disabled={disabled} onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Liste d'éléments filtrable par recherche. */
export function SearchList({ items, onPick, placeholder, limit = 60, selected }: { items: { name: string; emoji: string }[]; onPick: (name: string) => void; placeholder?: string; limit?: number; selected?: string | null }) {
  const [q, setQ] = useState('');
  const nq = norm(q);
  const list = items.filter((i) => !nq || norm(i.name).includes(nq)).slice(0, limit);
  return (
    <div class="dv-search">
      <input class="dv-search-input" value={q} placeholder={placeholder ?? 'Rechercher…'} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="dv-search-list">
        {list.map((i) => (
          <button class={'dv-item' + (selected === i.name ? ' sel' : '')} onClick={() => onPick(i.name)}>
            <span class="dv-item-emoji">{i.emoji}</span>
            <span>{i.name}</span>
          </button>
        ))}
        {!list.length && <div class="muted small">Aucun résultat.</div>}
      </div>
    </div>
  );
}

export function EndPanel({ v, me, players, children }: { v: BaseView; me: Player | null; players: Player[]; children?: ComponentChildren }) {
  const won = !!me && !!v.winners?.includes(me.id);
  return (
    <div class="end dv-end pop">
      {won && <Confetti />}
      <div class="summary">
        {(v.summary ?? '').split('\n').map((l) => (
          <div>{l}</div>
        ))}
      </div>
      {!!v.winners?.length && (
        <div class="dv-winners">
          {v.winners.map((id) => (
            <PlayerTag p={byId(players, id)} badge={<span>🏆</span>} />
          ))}
        </div>
      )}
      {children}
      <Section title="Scores">
        <Scores v={v} players={players} />
      </Section>
    </div>
  );
}

export function Feed({ rows, players }: { rows: { pid: string; text: string; ok: boolean }[]; players: Player[] }) {
  if (!rows.length) return null;
  return (
    <div class="dv-feed">
      {rows
        .slice(-8)
        .reverse()
        .map((r) => (
          <div class={'dv-feed-row ' + (r.ok ? 'ok' : 'ko')}>
            <Avatar p={byId(players, r.pid)} size={22} />
            <span>{r.ok ? '✅ a trouvé !' : `❌ ${r.text}`}</span>
          </div>
        ))}
    </div>
  );
}

export function Reveal({ emoji, name, children }: { emoji: string; name: string; children?: ComponentChildren }) {
  return (
    <div class="dv-reveal pop">
      <div class="dv-reveal-emoji">{emoji}</div>
      <div class="dv-reveal-name">{name}</div>
      {children}
    </div>
  );
}
