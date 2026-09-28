// Plateau de « Qui est-ce ? ».
import { useState } from 'preact/hooks';
import type { BoardProps } from '../../core/types';
import { Btn, byId, Card, Pill, PlayerTag, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import type { GrView } from './grille';
import { DvHead, EndPanel, QLog, Suggest } from './ui';

export function GrilleBoard({ view: v, me, players, dispatch, remaining }: BoardProps<GrView>) {
  const total = usePhaseTotal(`${v.phase}-${v.turns}`, remaining);
  const [guessMode, setGuessMode] = useState(false);
  const playing = !!me && v.duo.includes(me.id);
  const myTurn = playing && v.turn === me!.id;
  const turnP = byId(players, v.turn);
  const crossed = new Set(v.crossed);

  const onCell = (name: string) => {
    if (!playing || v.phase !== 'play') return;
    if (guessMode && myTurn) {
      if (confirmGuess(name)) dispatch({ type: 'guess', name });
      setGuessMode(false);
    } else dispatch({ type: 'toggle', name });
  };

  return (
    <div class="board dv grille">
      <DvHead emoji="🧑‍🤝‍🧑" title="Qui est-ce ?" sub={`${v.packEmoji} ${v.packName}`}>
        {v.duo.map((id) => (
          <Pill tone={v.turn === id ? 'warn' : undefined}>
            {byId(players, id)?.name} : {v.oppRemaining[id]} restants
          </Pill>
        ))}
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}

      {v.mySecret && v.phase === 'play' && (
        <div class="dv-secret-mini">
          🤫 Ton secret : <b>
            {v.mySecret.emoji} {v.mySecret.name}
          </b>
        </div>
      )}

      {v.phase === 'play' &&
        (myTurn ? (
          <Card>
            <div class="your-turn">{guessMode ? '🎯 Touche la case de ta réponse (attention : erreur = défaite !)' : 'À toi ! Pose une question ou tente ta chance.'}</div>
            {!guessMode && (
              <>
                <TextInput autoFocus placeholder="Ex. : Porte-t-il des lunettes ?" button="Demander" onSubmit={(text) => dispatch({ type: 'ask', text })} maxLength={140} />
                <Suggest list={v.suggestions} onPick={(text) => dispatch({ type: 'ask', text })} />
              </>
            )}
            <Btn kind={guessMode ? 'ghost' : 'danger'} onClick={() => setGuessMode(!guessMode)}>
              {guessMode ? '↩️ Annuler' : '🎯 Je sais qui c’est !'}
            </Btn>
            {v.note && <div class="note">{v.note}</div>}
          </Card>
        ) : (
          turnP && <Waiting who={turnP} text="interroge son adversaire…" />
        ))}

      {v.log.length > 0 && v.phase === 'play' && (
        <div class="dv-last">
          <PlayerTag p={byId(players, v.log[v.log.length - 1].pid)} /> « {v.log[v.log.length - 1].text} » → <b>{ansWord(v.log[v.log.length - 1].answer)}</b>
        </div>
      )}

      <div class={'dv-grid' + (guessMode ? ' guessing' : '')}>
        {v.grid.map((g) => {
          const off = crossed.has(g.name);
          const secret = v.mySecret?.name === g.name;
          const rev = v.reveal ? Object.entries(v.reveal).filter(([, it]) => it.name === g.name).map(([id]) => id) : [];
          return (
            <button class={'dv-cell' + (off ? ' off' : '') + (secret ? ' mine' : '') + (rev.length ? ' revealed' : '')} onClick={() => onCell(g.name)} disabled={!playing || v.phase !== 'play'}>
              <span class="dv-cell-emoji">{g.emoji}</span>
              <span class="dv-cell-name">{g.name}</span>
              {rev.length > 0 && <span class="dv-cell-tag">{rev.map((id) => byId(players, id)?.name).join(' / ')}</span>}
            </button>
          );
        })}
      </div>
      {playing && v.phase === 'play' && <p class="muted small center">Touche une case pour la griser / dégriser.</p>}

      {v.phase === 'end' && <EndPanel v={v} me={me} players={players} />}
      <QLog rows={v.log.map((l) => ({ pid: l.pid, text: l.text, answer: l.answer, guess: l.guess }))} players={players} />
    </div>
  );
}

function confirmGuess(name: string): boolean {
  try {
    return typeof window === 'undefined' || window.confirm(`Tu es sûr ? « ${name} » — une erreur et tu perds !`);
  } catch {
    return true;
  }
}

function ansWord(a: string) {
  return a === 'oui' ? '✅ Oui' : a === 'non' ? '❌ Non' : a === 'correct' ? '🎯 Gagné' : a === 'faux' ? '❌ Raté' : '🤷 ?';
}
