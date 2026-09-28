// Plateau de « Un seul indice ».
import type { BoardProps, Player } from '../../core/types';
import { Btn, byId, Pill, PlayerTag, Section, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { DoneDots, EndPanel, GameHead, Progress } from '../kit-ui';
import type { USView } from './un-seul-indice';

const REASON: Record<string, string> = { doublon: 'doublon', interdit: 'interdit', vide: 'vide' };

export function UnSeulIndiceBoard({ view: v, me, players, dispatch, remaining }: BoardProps<USView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}`, remaining);
  const guesser = byId(players, v.guesser);
  const isGuesser = me?.id === v.guesser;
  const givers = v.active.filter((id) => id !== v.guesser);
  return (
    <div class="board usi">
      <GameHead
        title="☝️ Un seul indice"
        sub={v.phase !== 'end' ? <span>Thème : {v.packName} · Devineur : <PlayerTag p={guesser} /></span> : undefined}
        pills={
          <>
            {v.phase !== 'end' && <Progress idx={v.round} total={v.total} label="Carte" />}
            <Pill tone="good">✅ {v.success}</Pill>
          </>
        }
      />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.item && v.phase !== 'end' && (
        <div class="usi-card pop">
          <div class="usi-emoji">{v.item.emoji}</div>
          <div class="usi-name">{v.item.name}</div>
          {v.phase === 'clues' && !isGuesser && <div class="small muted">À faire deviner à {guesser?.name} — ne dis pas le nom !</div>}
        </div>
      )}
      {v.phase === 'clues' && (
        <div class="clues-phase">
          {isGuesser ? (
            <div class="usi-card hidden-card">
              <div class="usi-emoji">🙈</div>
              <div>Ferme les yeux ! Les autres écrivent leurs indices…</div>
            </div>
          ) : me && v.needs.includes(me.id) ? (
            <div class="card">
              <div class="your-turn">Ton indice : UN seul mot</div>
              <TextInput autoFocus placeholder="Un mot…" maxLength={30} button="Valider" onSubmit={(text) => dispatch({ type: 'clue', text: text.trim().split(/\s+/)[0] })} />
              <p class="muted small">Évite l’évidence : si un autre écrit le même mot, les deux sont annulés !</p>
            </div>
          ) : (
            <Waiting text={me ? 'Indice envoyé ! En attente des autres…' : 'Les joueurs écrivent leurs indices…'} />
          )}
          <DoneDots ids={givers} done={v.written} players={players} mark="✍️" />
        </div>
      )}
      {(v.phase === 'guess' || v.phase === 'result') && <ClueGrid v={v} players={players} />}
      {v.phase === 'guess' &&
        (isGuesser ? (
          <div class="card">
            <div class="your-turn">À toi de deviner ! {v.cancelledCount > 0 && <span class="muted small">({v.cancelledCount} indice(s) annulé(s))</span>}</div>
            <TextInput autoFocus placeholder="Ta réponse…" button="Deviner" onSubmit={(text) => dispatch({ type: 'guess', text })} />
            <Btn kind="ghost" onClick={() => dispatch({ type: 'pass' })}>
              Passer ⏭️
            </Btn>
          </div>
        ) : (
          <Waiting who={guesser} text="réfléchit… 🤔" />
        ))}
      {v.phase === 'result' && v.guess && (
        <div class={'result pop usi-result ' + (v.guess.correct ? 'good' : 'bad')}>
          <div class="result-text">{v.guess.correct ? '✅ Trouvé !' : v.guess.text ? `❌ « ${v.guess.text} »` : '⏭️ Passé'}</div>
          <Btn onClick={() => dispatch({ type: 'skip' })}>Carte suivante ▶️</Btn>
        </div>
      )}
      {v.phase === 'end' && (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active} unit="cartes">
          <Section title="Les cartes">
            <div class="usi-history">
              {v.results.map((r) => (
                <div class="usi-hist-row">
                  <span>{r.correct ? '✅' : '❌'}</span>
                  <span>
                    {r.emoji.split(' ')[0]} {r.name}
                  </span>
                  <span class="small muted">{byId(players, r.guesser)?.name}{r.guess && !r.correct ? ` : « ${r.guess} »` : ''}</span>
                </div>
              ))}
            </div>
          </Section>
        </EndPanel>
      )}
    </div>
  );
}

function ClueGrid({ v, players }: { v: USView; players: Player[] }) {
  return (
    <div class="usi-clues">
      {Object.entries(v.clues).map(([id, c]) => (
        <div class={'usi-clue' + (c.cancelled ? ' cancelled' : '')}>
          <span class="usi-clue-text">{c.cancelled && c.hidden ? '❌' : c.text || '—'}</span>
          {c.cancelled && <span class="small muted">{REASON[c.cancelled]}</span>}
          <PlayerTag p={byId(players, id)} />
        </div>
      ))}
    </div>
  );
}
