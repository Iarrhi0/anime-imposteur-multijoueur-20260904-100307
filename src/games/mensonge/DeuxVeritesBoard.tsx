// Plateau de « 2 vérités, 1 mensonge ».
import { useState } from 'preact/hooks';
import type { BoardProps, Player } from '../../core/types';
import { personaFacts } from '../../content/extra/persona-facts';
import { Avatar, Btn, byId, Card, Pill, PlayerTag, Section, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { DoneDots, EndPanel, GameHead, Progress } from '../kit-ui';
import type { DVView } from './deux-verites';

const NUM = ['1️⃣', '2️⃣', '3️⃣'];

export function DeuxVeritesBoard({ view: v, me, players, dispatch, remaining }: BoardProps<DVView>) {
  const total = usePhaseTotal(`${v.phase}-${v.turn}`, remaining);
  const hot = byId(players, v.hot);
  return (
    <div class="board dv">
      <GameHead
        title="🤥 2 vérités, 1 mensonge"
        sub={v.phase !== 'end' && hot ? <span>Sur la sellette : <PlayerTag p={hot} /></span> : undefined}
        pills={<Progress idx={v.turn} total={v.totalTurns} label="Tour" />}
      />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.phase === 'write' && (me?.id === v.hot ? <Writer dispatch={dispatch} /> : <Waiting who={hot} text="écrit ses 3 affirmations… 🤫" />)}
      {v.phase === 'vote' && <Vote v={v} me={me} players={players} dispatch={dispatch} />}
      {v.phase === 'reveal' && <Reveal v={v} players={players} dispatch={dispatch} />}
      {v.phase === 'end' && (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active}>
          <Section title="Les mensonges">
            <div class="dv-history">
              {v.history.map((h) => (
                <div class="dv-hist-row">
                  <PlayerTag p={byId(players, h.pid)} />
                  <span class="dv-lie-text">« {h.statements[h.lie]} »</span>
                  <Pill tone={h.fooled ? 'warn' : 'good'}>{h.fooled} berné{h.fooled > 1 ? 's' : ''}</Pill>
                </div>
              ))}
            </div>
          </Section>
        </EndPanel>
      )}
    </div>
  );
}

function randomIdeas(): { statements: string[]; lie: number } {
  const all = Object.values(personaFacts ?? {}).filter((f) => f?.truths?.length && f?.lies?.length);
  if (!all.length) return { statements: ['', '', ''], lie: 2 };
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const f1 = pick(all);
  const f2 = pick(all);
  const t1 = pick(f1.truths);
  let t2 = pick(f2.truths);
  if (t2 === t1) t2 = pick(all.flatMap((f) => f.truths).filter((x) => x !== t1));
  const lie = pick(pick(all).lies);
  const lieAt = Math.floor(Math.random() * 3);
  const st = [t1, t2];
  st.splice(lieAt, 0, lie);
  return { statements: st, lie: lieAt };
}

function Writer({ dispatch }: { dispatch: BoardProps['dispatch'] }) {
  const [st, setSt] = useState<string[]>(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  const ok = st.every((x) => x.trim().length > 2) && lie !== null;
  return (
    <Card class="dv-writer">
      <div class="your-turn">Écris 2 vérités et 1 mensonge sur toi</div>
      <p class="muted small">Coche le mensonge 🤥. Les autres ne verront pas lequel c’est !</p>
      {st.map((val, i) => (
        <div class={'dv-field' + (lie === i ? ' lie' : '')}>
          <span class="dv-num">{NUM[i]}</span>
          <input
            class="dv-input"
            value={val}
            maxLength={160}
            placeholder={i === 0 ? 'Ex. : J’ai déjà mangé un insecte' : 'Une autre affirmation…'}
            onInput={(e) => {
              const n = [...st];
              n[i] = (e.target as HTMLInputElement).value;
              setSt(n);
            }}
          />
          <button type="button" class={'dv-lie-btn' + (lie === i ? ' on' : '')} onClick={() => setLie(i)} title="C’est le mensonge">
            🤥
          </button>
        </div>
      ))}
      <div class="row gap">
        <Btn
          kind="ghost"
          onClick={() => {
            const r = randomIdeas();
            setSt(r.statements);
            setLie(r.lie);
          }}
        >
          🎲 Inspiration
        </Btn>
        <Btn big disabled={!ok} onClick={() => dispatch({ type: 'write', statements: st.map((x) => x.trim()), lie })}>
          Valider
        </Btn>
      </div>
    </Card>
  );
}

function Statements({ v, players, onPick, selected, showVotes }: { v: DVView; players: Player[]; onPick?: (i: number) => void; selected?: number; showVotes?: boolean }) {
  const st = v.statements ?? [];
  return (
    <div class="dv-statements">
      {st.map((text, i) => {
        const isLie = v.lie === i;
        const voters = showVotes && v.votes ? Object.entries(v.votes).filter(([, c]) => c === i).map(([id]) => id) : [];
        return (
          <button
            type="button"
            class={'dv-statement' + (selected === i ? ' sel' : '') + (v.lie !== null && v.lie !== undefined ? (isLie ? ' lie' : ' truth') : '')}
            disabled={!onPick}
            onClick={() => onPick?.(i)}
          >
            <span class="dv-num">{NUM[i]}</span>
            <span class="dv-text">{text}</span>
            {v.lie !== null && v.lie !== undefined && <span class="dv-tag">{isLie ? '🤥 Mensonge' : '✅ Vrai'}</span>}
            {voters.length > 0 && (
              <span class="dv-voters">
                {voters.map((id) => (
                  <Avatar p={byId(players, id)} size={22} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Vote({ v, me, players, dispatch }: { v: DVView; me: Player | null; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const isHot = me?.id === v.hot;
  const canVote = !!me && !isHot && v.active.includes(me.id) && v.myVote === undefined;
  const voters = v.active.filter((id) => id !== v.hot);
  return (
    <div class="vote">
      {v.auto && <div class="note">⏱️ Affirmations tirées au sort (temps écoulé).</div>}
      <div class="prompt">{isHot ? 'Les autres cherchent ton mensonge… défends-toi dans le chat ! 😇' : canVote ? 'Où est le mensonge ? Touche l’affirmation fausse.' : 'Vote envoyé ! En attente des autres…'}</div>
      <Statements v={v} players={players} selected={v.myVote} onPick={canVote ? (i) => dispatch({ type: 'vote', choice: i }) : undefined} />
      <DoneDots ids={voters} done={v.voted} players={players} mark="🗳️" />
    </div>
  );
}

function Reveal({ v, players, dispatch }: { v: DVView; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const gained = Object.entries(v.gained ?? {}).filter(([, p]) => p > 0);
  return (
    <div class="result pop">
      <Statements v={v} players={players} showVotes />
      {gained.length > 0 && (
        <div class="dv-gains">
          {gained.map(([id, p]) => (
            <span class="dv-gain">
              <PlayerTag p={byId(players, id)} /> +{p}
            </span>
          ))}
        </div>
      )}
      <Btn onClick={() => dispatch({ type: 'skip' })}>Suivant ▶️</Btn>
    </div>
  );
}
