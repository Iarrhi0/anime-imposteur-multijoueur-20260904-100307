// Plateau de « Tu préfères ? ».
import { useState } from 'preact/hooks';
import type { BoardProps, Player } from '../../core/types';
import { Avatar, Btn, byId, Section, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { Bar, DoneDots, EndPanel, GameHead, Progress } from '../kit-ui';
import type { AB, TPView } from './tu-preferes';

export function TuPreferesBoard({ view: v, me, players, dispatch, remaining }: BoardProps<TPView>) {
  const total = usePhaseTotal(`${v.phase}-${v.idx}`, remaining);
  return (
    <div class="board tp">
      <GameHead title="🤷 Tu préfères ?" pills={v.phase !== 'end' ? <Progress idx={v.idx} total={v.total} label="Dilemme" /> : undefined} />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.phase === 'vote' && v.dilemma && <VoteBox key={v.idx} v={v} me={me} players={players} dispatch={dispatch} />}
      {v.phase === 'reveal' && v.dilemma && <Reveal v={v} players={players} dispatch={dispatch} />}
      {v.phase === 'end' && (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active}>
          <Section title="Les dilemmes">
            <div class="tp-history">
              {v.history.map((h) => (
                <div class="tp-hist-row">
                  <span class={h.majority === 'a' ? 'qg-win' : ''}>{h.a}</span>
                  <Bar pct={h.pa} tone="a" />
                  <span class={h.majority === 'b' ? 'qg-win' : ''}>{h.b}</span>
                </div>
              ))}
            </div>
          </Section>
        </EndPanel>
      )}
    </div>
  );
}

function VoteBox({ v, me, players, dispatch }: { v: TPView; me: Player | null; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const d = v.dilemma!;
  const [choice, setChoice] = useState<AB | null>(null);
  const canVote = !!me && v.active.includes(me.id) && !v.myVote;
  if (!canVote)
    return (
      <div>
        <Options d={d} />
        <Waiting text={v.myVote ? 'Vote envoyé ! En attente des autres…' : 'Les joueurs votent…'} />
        <DoneDots ids={v.active} done={v.voted} players={players} mark="🗳️" />
      </div>
    );
  return (
    <div class="vote">
      <div class="prompt">{choice ? 'Et selon toi, quel camp aura la majorité ?' : 'Tu préfères…'}</div>
      <Options d={d} selected={choice ?? undefined} onPick={(c) => (choice ? dispatch({ type: 'vote', choice, predict: c }) : setChoice(c))} predicting={!!choice} />
      {choice && (
        <Btn kind="ghost" onClick={() => setChoice(null)}>
          ↩️ Changer mon choix
        </Btn>
      )}
      <DoneDots ids={v.active} done={v.voted} players={players} mark="🗳️" />
    </div>
  );
}

function Options({ d, selected, onPick, predicting, pct, win }: { d: { a: string; b: string }; selected?: AB; onPick?: (c: AB) => void; predicting?: boolean; pct?: number; win?: AB | 'tie' }) {
  return (
    <div class="tp-options">
      {(['a', 'b'] as AB[]).map((k, i) => (
        <>
          {i === 1 && <div class="qg-vs">OU</div>}
          <button type="button" class={'tp-option ' + k + (selected === k ? ' sel' : '') + (win === k ? ' win' : '')} disabled={!onPick} onClick={() => onPick?.(k)}>
            <span class="tp-letter">{k === 'a' ? '🅰️' : '🅱️'}</span>
            <span class="tp-text">{k === 'a' ? d.a : d.b}</span>
            {predicting && <span class="small muted">{selected === k ? 'ton choix · ' : ''}la majorité ?</span>}
            {pct !== undefined && (
              <>
                <Bar pct={k === 'a' ? pct : 100 - pct} tone={k} />
                <b>{Math.round(k === 'a' ? pct : 100 - pct)} %</b>
              </>
            )}
          </button>
        </>
      ))}
    </div>
  );
}

function Reveal({ v, players, dispatch }: { v: TPView; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const votes = v.votes ?? {};
  const all = Object.entries(votes);
  const pa = all.length ? (all.filter(([, x]) => x.choice === 'a').length / all.length) * 100 : 50;
  const good = all.filter(([, x]) => v.majority !== 'tie' && x.predict === v.majority).map(([id]) => id);
  return (
    <div class="result pop">
      <Options d={v.dilemma!} pct={pa} win={v.majority} />
      <div class="qg-voters">
        {(['a', 'b'] as AB[]).map((k) => (
          <div>
            {all
              .filter(([, x]) => x.choice === k)
              .map(([id]) => (
                <Avatar p={byId(players, id)} size={26} />
              ))}
          </div>
        ))}
      </div>
      {good.length > 0 && <div class="note">🔮 Bon pronostic (+1) : {good.map((id) => byId(players, id)?.name).join(', ')}</div>}
      <Btn onClick={() => dispatch({ type: 'skip' })}>Suivant ▶️</Btn>
    </div>
  );
}
