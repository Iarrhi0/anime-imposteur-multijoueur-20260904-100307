// Cadre commun des plateaux « révélation progressive » (indices, lettres).
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { BoardProps } from '../../core/types';
import { Btn, byId, Pill, TextInput, Timer, usePhaseTotal } from '../../ui/components';
import type { PView } from './progressive';
import { DvHead, EndPanel, Feed, Reveal, Scores } from './ui';

export function ProgressiveBoard({ props, emoji, title, children, placeholder }: { props: BoardProps<PView>; emoji: string; title: string; children: ComponentChildren; placeholder: string }) {
  const { view: v, me, players, dispatch, remaining } = props;
  const total = usePhaseTotal(`${v.phase}-${v.round}`, remaining);
  const [, force] = useState(0);
  // Horloge de l'hôte estimée à partir de l'échéance (corrige le décalage entre appareils).
  const hostNow = v.deadline && remaining !== null ? v.deadline - remaining * 1000 : Date.now();
  const cd = Math.max(0, Math.ceil((v.cooldownUntil - hostNow) / 1000));
  useEffect(() => {
    if (cd <= 0) return;
    const t = setTimeout(() => force((x) => x + 1), 300);
    return () => clearTimeout(t);
  });
  const mine = me ? v.found.find((f) => f.pid === me.id) : undefined;
  const canGuess = !!me && v.phase === 'play' && v.order.includes(me.id) && !mine;

  return (
    <div class="board dv progressive">
      <DvHead emoji={emoji} title={title} sub={`${v.packEmoji} ${v.packName}`}>
        <Pill tone="info">
          Manche {v.round}/{v.rounds}
        </Pill>
        {v.phase === 'play' && <Pill tone="warn">💎 {v.potential} pts</Pill>}
        {v.phase === 'play' && (
          <Pill tone="good">
            ✅ {v.found.length}/{v.order.length}
          </Pill>
        )}
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}

      {v.phase !== 'end' && children}

      {canGuess && (
        <div class={'dv-guess' + (cd > 0 ? ' cooling' : '')}>
          <TextInput autoFocus placeholder={cd > 0 ? `Patiente ${cd} s…` : placeholder} button="Deviner" disabled={cd > 0} onSubmit={(text) => dispatch({ type: 'guess', text })} maxLength={80} />
        </div>
      )}
      {mine && v.phase === 'play' && <div class="dv-found-banner pop">🎉 Trouvé ! +{mine.pts} points. Attends les autres…</div>}

      {v.phase === 'reveal' && v.answer && (
        <Reveal emoji={v.answer.emoji} name={v.answer.name}>
          <div class="dv-finders">
            {v.found.length ? (
              v.found.map((f, i) => (
                <span class="dv-bet-chip ok">
                  {i === 0 ? '⚡' : '✅'} {byId(players, f.pid)?.name} +{f.pts}
                </span>
              ))
            ) : (
              <span class="muted">Personne n’a trouvé 😅</span>
            )}
          </div>
          <Btn kind="ghost" onClick={() => dispatch({ type: 'next' })}>
            Continuer ▶️
          </Btn>
        </Reveal>
      )}
      {v.phase === 'end' && (
        <EndPanel v={v} me={me} players={players}>
          <div class="dv-history">
            {v.history.map((h, i) => (
              <div class="dv-hist-row">
                <span>
                  {i + 1}. {h.emoji} {h.name}
                </span>
                <span class="muted small">{h.finders.length ? h.finders.map((id) => byId(players, id)?.name).join(', ') : 'non trouvé'}</span>
              </div>
            ))}
          </div>
        </EndPanel>
      )}
      {v.phase === 'play' && <Feed rows={v.feed} players={players} />}
      {v.phase !== 'end' && <Scores v={v} players={players} ids={v.order} mark={(id) => (v.found.some((f) => f.pid === id) ? <span>✅</span> : null)} />}
    </div>
  );
}
