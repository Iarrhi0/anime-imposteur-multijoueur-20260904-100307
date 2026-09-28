// Plateau de « Carte sur le front ».
import { useState } from 'preact/hooks';
import type { BoardProps, Player } from '../../core/types';
import { Avatar, Btn, byId, Card, Pill, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import type { FView } from './front';
import { AnswerBadge, DvHead, EndPanel, QLog, Suggest } from './ui';

export function FrontBoard({ view: v, me, players, dispatch, remaining }: BoardProps<FView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}-${v.current}-${v.qlog.length}`, remaining);
  const cur = byId(players, v.current);
  const myTurn = !!me && v.current === me.id;
  const [guessOpen, setGuessOpen] = useState(false);
  const q = v.question;

  return (
    <div class="board dv front">
      <DvHead emoji="🤔" title="Carte sur le front" sub={`${v.packEmoji} ${v.packName}`}>
        <Pill tone="info">
          Tour {Math.min(v.round, v.maxRounds)}/{v.maxRounds}
        </Pill>
        <Pill tone="good">
          ✅ {v.found.length}/{v.order.length}
        </Pill>
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}

      <div class="dv-fronts">
        {v.order.map((id) => (
          <FrontCard id={id} v={v} players={players} me={me} />
        ))}
      </div>

      {v.phase === 'ask' &&
        (myTurn ? (
          <Card>
            <div class="your-turn">À toi ! Pose une question oui/non sur TA carte.</div>
            <TextInput autoFocus placeholder="Ex. : Est-ce que je suis un animal ?" button="Demander" onSubmit={(text) => dispatch({ type: 'ask', text })} maxLength={140} />
            <Suggest list={v.suggestions} onPick={(text) => dispatch({ type: 'ask', text })} />
            {!guessOpen ? (
              <Btn kind="ghost" onClick={() => setGuessOpen(true)}>
                🎯 Je sais déjà !
              </Btn>
            ) : (
              <TextInput placeholder="Je suis…" button="Deviner" onSubmit={(text) => dispatch({ type: 'guess', text })} maxLength={80} />
            )}
          </Card>
        ) : (
          cur && <Waiting who={cur} text="prépare sa question…" />
        ))}

      {v.phase === 'answer' && q && (
        <Card class="dv-question-card">
          <div class="muted small">{cur?.name} demande :</div>
          <div class="question">❓ {q.text}</div>
          {me && v.needs.includes(me.id) ? (
            <>
              <div class="muted small center">
                Sa carte : <b>{v.cards[q.pid]?.emoji} {v.cards[q.pid]?.name}</b>
              </div>
              <div class="dv-yn">
                <Btn kind="ok" big onClick={() => dispatch({ type: 'answer', value: 'oui' })}>
                  ✅ Oui
                </Btn>
                <Btn kind="danger" big onClick={() => dispatch({ type: 'answer', value: 'non' })}>
                  ❌ Non
                </Btn>
                <Btn kind="ghost" onClick={() => dispatch({ type: 'answer', value: 'nsp' })}>
                  🤷
                </Btn>
              </div>
            </>
          ) : (
            <Waiting text={v.myAnswer ? 'Réponse envoyée, on attend les autres…' : myTurn ? 'Les autres réfléchissent…' : 'Les joueurs répondent…'} />
          )}
          <div class="ready-list">
            {v.order
              .filter((id) => id !== q.pid)
              .map((id) => (
                <span class={'ready-item' + (v.answered.includes(id) ? ' ok' : '')}>
                  <Avatar p={byId(players, id)} size={26} />
                  {v.answered.includes(id) ? '✅' : '…'}
                </span>
              ))}
          </div>
        </Card>
      )}

      {v.phase === 'guess' && q && (
        <Card class="dv-question-card pop">
          <div class="question">
            ❓ {q.text} → {q.result && <AnswerBadge a={q.result === 'nsp' ? 'peut-être' : q.result} />}
          </div>
          <div class="dv-votes">
            {Object.entries(q.answers).map(([id, a]) => (
              <span class="dv-vote">
                <Avatar p={byId(players, id)} size={22} /> <AnswerBadge a={a === 'nsp' ? 'peut-être' : a} />
              </span>
            ))}
          </div>
          {myTurn ? (
            <>
              <div class="your-turn">Tu veux tenter ta chance ?</div>
              <TextInput autoFocus placeholder="Je suis…" button="Deviner" onSubmit={(text) => dispatch({ type: 'guess', text })} maxLength={80} />
              <Btn kind="ghost" onClick={() => dispatch({ type: 'pass' })}>
                ⏭️ Passer
              </Btn>
            </>
          ) : (
            cur && <Waiting who={cur} text="hésite à deviner…" />
          )}
        </Card>
      )}

      {v.phase === 'end' && <EndPanel v={v} me={me} players={players} />}

      {v.guesses.length > 0 && (
        <div class="dv-feed">
          {v.guesses
            .slice(-5)
            .reverse()
            .map((g) => (
              <div class={'dv-feed-row ' + (g.correct ? 'ok' : 'ko')}>
                <Avatar p={byId(players, g.pid)} size={22} />
                <span>
                  {g.correct ? '✅' : '❌'} « {g.text} »
                </span>
              </div>
            ))}
        </div>
      )}
      <QLog
        rows={v.qlog.filter((x) => x.result).map((x) => ({ pid: x.pid, text: x.text, answer: x.result === 'nsp' ? 'peut-être' : x.result! }))}
        players={players}
      />
    </div>
  );
}

function FrontCard({ id, v, players, me }: { id: string; v: FView; players: Player[]; me: Player | null }) {
  const p = byId(players, id);
  const c = v.cards[id];
  const found = v.found.includes(id);
  const isMe = me?.id === id;
  return (
    <div class={'dv-front' + (v.current === id ? ' current' : '') + (found ? ' found' : '') + (isMe ? ' me' : '')}>
      <div class="dv-front-card">{c ? <span class="dv-front-emoji">{c.emoji}</span> : <span class="dv-front-emoji">❓</span>}</div>
      <div class="dv-front-name">{c ? c.name : isMe ? 'Ta carte (cachée)' : '???'}</div>
      <div class="dv-front-player">
        <Avatar p={p} size={22} /> {p?.name} {found && <span>✅ +{v.foundPts[id]}</span>}
        <b class="dv-front-score">{v.scores[id] ?? 0}</b>
      </div>
    </div>
  );
}
