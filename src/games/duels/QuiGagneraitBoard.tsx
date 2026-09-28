// Plateau de « Qui gagnerait ? ».
import type { BoardProps, Player } from '../../core/types';
import { Avatar, Btn, byId, Section, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { Bar, DoneDots, EndPanel, GameHead, Progress } from '../kit-ui';
import type { ItemRef } from '../kit';
import type { QGView, Side } from './qui-gagnerait';

export function QuiGagneraitBoard({ view: v, me, players, dispatch, remaining }: BoardProps<QGView>) {
  const total = usePhaseTotal(`${v.phase}-${v.idx}`, remaining);
  const r = v.round;
  return (
    <div class="board qg">
      <GameHead title="⚔️ Qui gagnerait ?" sub={r ? `${r.a.packName} — ${r.question}` : undefined} pills={v.phase !== 'end' ? <Progress idx={v.idx} total={v.total} label="Duel" /> : undefined} />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {r && v.phase === 'vote' && <VoteDuel v={v} me={me} players={players} dispatch={dispatch} />}
      {r && v.phase === 'reveal' && <RevealDuel v={v} players={players} dispatch={dispatch} />}
      {v.phase === 'end' && (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active}>
          <Section title="Les duels">
            <div class="qg-history">
              {v.history.map((h) => (
                <div class="qg-hist-row">
                  <span class={h.winner === 'a' ? 'qg-win' : ''}>{h.a}</span>
                  <span class="muted small">
                    {h.na}–{h.nb}
                  </span>
                  <span class={h.winner === 'b' ? 'qg-win' : ''}>{h.b}</span>
                </div>
              ))}
            </div>
          </Section>
        </EndPanel>
      )}
    </div>
  );
}

function Fighter({ it, side, selected, onPick, pct, win }: { it: ItemRef; side: Side; selected?: boolean; onPick?: () => void; pct?: number; win?: boolean }) {
  return (
    <button type="button" class={'qg-fighter ' + side + (selected ? ' sel' : '') + (win ? ' win' : '')} disabled={!onPick} onClick={onPick}>
      <div class="qg-emoji">{it.emoji}</div>
      <div class="qg-name">{it.name}</div>
      {it.group && <div class="small muted">{it.group}</div>}
      {pct !== undefined && (
        <>
          <Bar pct={pct} tone={side} />
          <div class="qg-pct">{Math.round(pct)} %</div>
        </>
      )}
    </button>
  );
}

function VoteDuel({ v, me, players, dispatch }: { v: QGView; me: Player | null; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const r = v.round!;
  const canVote = !!me && v.active.includes(me.id);
  const pick = (side: Side) => dispatch({ type: 'vote', side });
  return (
    <div class="vote">
      <div class="qg-arena">
        <Fighter it={r.a} side="a" selected={v.myVote === 'a'} onPick={canVote ? () => pick('a') : undefined} />
        <div class="qg-vs">VS</div>
        <Fighter it={r.b} side="b" selected={v.myVote === 'b'} onPick={canVote ? () => pick('b') : undefined} />
      </div>
      {canVote && v.myVote ? <Waiting text="Vote enregistré (tu peux encore changer). En attente des autres…" /> : !canVote && <Waiting text="Les joueurs votent…" />}
      <DoneDots ids={v.active} done={v.voted} players={players} mark="🗳️" />
    </div>
  );
}

function RevealDuel({ v, players, dispatch }: { v: QGView; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const r = v.round!;
  const votes = v.votes ?? {};
  const ids = (s: Side) => Object.keys(votes).filter((id) => votes[id] === s);
  const n = Object.keys(votes).length || 1;
  return (
    <div class="result pop">
      <div class="qg-arena">
        <Fighter it={r.a} side="a" pct={(ids('a').length / n) * 100} win={r.winner === 'a'} />
        <div class="qg-vs">{r.winner === 'tie' ? '🤝' : 'VS'}</div>
        <Fighter it={r.b} side="b" pct={(ids('b').length / n) * 100} win={r.winner === 'b'} />
      </div>
      <div class="qg-voters">
        <div>
          {ids('a').map((id) => (
            <Avatar p={byId(players, id)} size={26} />
          ))}
        </div>
        <div>
          {ids('b').map((id) => (
            <Avatar p={byId(players, id)} size={26} />
          ))}
        </div>
      </div>
      {v.debate && <div class="prompt">🗣️ Débattez ! Les perdants ont-ils raison ?</div>}
      <Btn onClick={() => dispatch({ type: 'skip' })}>Duel suivant ▶️</Btn>
    </div>
  );
}
