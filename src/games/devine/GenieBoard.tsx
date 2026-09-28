// Plateau du « Génie devin ».
import { useState } from 'preact/hooks';
import type { BoardProps } from '../../core/types';
import { Btn, byId, Card, Pill, PlayerTag, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import type { GView } from './genie';
import { DvHead, EndPanel, QLog, Reveal, Scores, SearchList } from './ui';

export function GenieBoard({ view: v, me, players, dispatch, remaining }: BoardProps<GView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}-${v.count}`, remaining);
  const pen = byId(players, v.penseur);
  const isPen = !!me && me.id === v.penseur;
  const [chosen, setChosen] = useState<string | null>(null);
  const qrows = v.qlog.map((q) => ({ text: q.q, answer: q.a === 'nsp' ? 'peut-être' : q.a }));
  const rejected = v.rejected.map((r) => ({ text: `Est-ce « ${r} » ?`, answer: 'non', guess: true }));

  return (
    <div class="board dv genie">
      <DvHead emoji="🧞" title="Le Génie devin" sub={`${v.packEmoji} ${v.packName}`}>
        {v.rounds > 1 && (
          <Pill tone="info">
            Manche {v.round}/{v.rounds}
          </Pill>
        )}
        <Pill>
          ❓ {v.count}/{v.maxQ}
        </Pill>
        <Pill tone="warn">Penseur : {pen?.name}</Pill>
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}

      {v.phase !== 'end' && v.phase !== 'pick' && (
        <div class="dv-genie-stage">
          <div class={'dv-genie-face' + (v.phase === 'propose' ? ' excited' : '')}>🧞</div>
          <div class="dv-bubble">{v.mood}</div>
        </div>
      )}

      {v.phase === 'pick' &&
        (isPen ? (
          <Card>
            <div class="your-turn">🤫 Choisis en secret quelque chose que le Génie devra deviner</div>
            <SearchList items={v.list} selected={chosen} onPick={(n) => setChosen(n)} placeholder="Rechercher dans le thème…" />
            <div class="row gap dv-actions">
              <Btn kind="ok" disabled={!chosen} onClick={() => chosen && dispatch({ type: 'pick', name: chosen })}>
                Je pense à {chosen ? `« ${chosen} »` : '…'} ✅
              </Btn>
              <Btn kind="ghost" onClick={() => dispatch({ type: 'pick', free: true })}>
                🎲 Hors liste (choix libre)
              </Btn>
            </div>
            <p class="muted small">« Hors liste » : pense à ce que tu veux, mais réponds honnêtement… le Génie ne connaîtra que sa liste !</p>
          </Card>
        ) : (
          <Waiting who={pen} text="choisit quelque chose en secret… 🤫" />
        ))}

      {isPen && v.phase !== 'end' && v.phase !== 'pick' && (
        <div class="mini-secret">{v.secret ? `🤫 Ton choix : ${v.secret.emoji} ${v.secret.name}` : '🤫 Choix libre (hors liste) — garde-le en tête !'}</div>
      )}

      {v.phase === 'ask' && v.question && (
        <Card class="dv-question-card">
          <div class="question">❓ {v.question.q}</div>
          {isPen ? (
            <div class="dv-yn">
              <Btn kind="ok" big onClick={() => dispatch({ type: 'answer', value: 'oui' })}>
                ✅ Oui
              </Btn>
              <Btn kind="danger" big onClick={() => dispatch({ type: 'answer', value: 'non' })}>
                ❌ Non
              </Btn>
              <Btn kind="ghost" onClick={() => dispatch({ type: 'answer', value: 'nsp' })}>
                🤷 Je ne sais pas
              </Btn>
            </div>
          ) : (
            <Waiting who={pen} text="répond au Génie…" />
          )}
        </Card>
      )}

      {v.phase === 'propose' && v.proposal && (
        <Card class="dv-question-card pop">
          <div class="dv-propose">
            <div class="dv-reveal-emoji">{v.proposal.emoji}</div>
            <div class="question">Est-ce… « {v.proposal.name} » ?</div>
          </div>
          {isPen ? (
            <div class="dv-yn">
              <Btn kind="ok" big onClick={() => dispatch({ type: 'confirm', correct: true })}>
                😱 Oui, c’est ça !
              </Btn>
              <Btn kind="danger" big onClick={() => dispatch({ type: 'confirm', correct: false })}>
                😏 Non, raté
              </Btn>
            </div>
          ) : (
            <Waiting who={pen} text="va-t-il/elle avouer ?…" />
          )}
        </Card>
      )}

      {v.canPredict && (
        <Card class="dv-bet">
          <div class="your-turn">🎲 Ton pari : le Génie va-t-il trouver ?</div>
          <div class="dv-yn">
            <Btn onClick={() => dispatch({ type: 'predict', bet: 'genie' })}>🧞 Oui, le Génie</Btn>
            <Btn kind="ghost" onClick={() => dispatch({ type: 'predict', bet: 'penseur' })}>
              🙅 Non, {pen?.name} va gagner
            </Btn>
          </div>
        </Card>
      )}
      {me && v.predictions[me.id] && v.phase !== 'reveal' && v.phase !== 'end' && (
        <div class="muted small center">Ton pari : {v.predictions[me.id] === 'genie' ? '🧞 le Génie' : `🙅 ${pen?.name}`}</div>
      )}

      {v.phase === 'reveal' && (
        <Reveal emoji={v.genieWon ? v.proposal?.emoji ?? v.secret?.emoji ?? '🧞' : v.secret?.emoji ?? '❔'} name={v.revealText ?? (v.free ? 'Choix libre…' : '???')}>
          <div class="result-text">{v.genieWon ? `🧞 Le Génie a deviné en ${v.count} questions !` : `🏆 ${pen?.name} a battu le Génie !`}</div>
          {isPen && v.free && !v.genieWon && !v.revealText && (
            <TextInput autoFocus placeholder="À quoi pensais-tu ?" button="Révéler" onSubmit={(text) => dispatch({ type: 'reveal', text })} maxLength={60} />
          )}
          <BetResults v={v} players={players} />
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
                  {i + 1}. <PlayerTag p={byId(players, h.penseur)} /> {h.emoji} {h.item}
                </span>
                <span class="muted small">{h.genieWon ? `🧞 en ${h.questions} q.` : '🏆 Génie battu'}</span>
              </div>
            ))}
          </div>
        </EndPanel>
      )}

      {v.phase !== 'end' && <Scores v={v} players={players} mark={(id) => (id === v.penseur ? <span title="Penseur">🤫</span> : null)} />}
      <QLog rows={[...qrows, ...rejected]} players={players} title="Questions du Génie" />
    </div>
  );
}

function BetResults({ v, players }: { v: GView; players: { id: string; name: string }[] | any }) {
  const bets = Object.entries(v.predictions);
  if (!bets.length) return null;
  return (
    <div class="dv-bets">
      {bets.map(([id, b]) => {
        const ok = (b === 'genie') === !!v.genieWon;
        return (
          <span class={'dv-bet-chip ' + (ok ? 'ok' : 'ko')}>
            {byId(players, id)?.name} : {b === 'genie' ? '🧞' : '🙅'} {ok ? '+2' : ''}
          </span>
        );
      })}
    </div>
  );
}
