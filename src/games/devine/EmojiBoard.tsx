// Plateau de l'« Emoji Quiz ».
import type { BoardProps } from '../../core/types';
import { Avatar, Btn, byId, Pill, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import type { EView } from './emoji-quiz';
import { DvHead, EndPanel, Scores } from './ui';

export function EmojiBoard({ view: v, me, players, dispatch, remaining }: BoardProps<EView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}`, remaining);
  const canAnswer = !!me && v.phase === 'play' && v.order.includes(me.id) && !v.mine;
  return (
    <div class="board dv emoji-quiz">
      <DvHead emoji="😀" title="Emoji Quiz" sub={`${v.packEmoji} ${v.packName}`}>
        <Pill tone="info">
          Manche {v.round}/{v.rounds}
        </Pill>
        <Pill>
          ✋ {v.answered.length}/{v.order.length}
        </Pill>
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}

      {v.phase !== 'end' && <div class="dv-emoji-big pop">{v.emoji}</div>}

      {v.phase !== 'end' && v.choices.length > 0 && (
        <div class="dv-choices">
          {v.choices.map((c, i) => {
            const picked = v.mine?.choice === i;
            const good = v.answerIdx === i;
            const cls = v.answerIdx !== null ? (good ? ' good' : picked ? ' bad' : ' faded') : picked ? ' picked' : '';
            const who = v.answers ? Object.entries(v.answers).filter(([, a]) => a.choice === i).map(([id]) => id) : [];
            return (
              <button class={'dv-choice' + cls} disabled={!canAnswer} onClick={() => dispatch({ type: 'answer', choice: i })}>
                <span class="dv-choice-letter">{'ABCD'[i]}</span>
                <span class="dv-choice-text">{c}</span>
                {who.length > 0 && (
                  <span class="dv-choice-who">
                    {who.map((id) => (
                      <Avatar p={byId(players, id)} size={18} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {canAnswer && (
        <TextInput autoFocus={v.mode === 'texte'} placeholder={v.mode === 'texte' ? 'Ta réponse…' : 'Ou écris-la (+2 bonus)…'} button="Répondre" onSubmit={(text) => dispatch({ type: 'answer', text })} maxLength={80} />
      )}
      {v.mine && v.phase === 'play' && <Waiting text={`Réponse enregistrée${v.mine.text ? ` : « ${v.mine.text} »` : ''} ! On attend les autres…`} />}

      {v.phase === 'reveal' && (
        <div class="dv-reveal pop">
          <div class="dv-reveal-name">{v.answer}</div>
          {v.mine && <div class={'result-text ' + (v.mine.correct ? 'good' : 'bad')}>{v.mine.correct ? `✅ Bravo ! +${v.mine.pts}` : '❌ Raté !'}</div>}
          <div class="dv-finders">
            {v.answers &&
              Object.entries(v.answers)
                .filter(([, a]) => a.correct)
                .sort((a, b) => a[1].ms - b[1].ms)
                .map(([id, a]) => (
                  <span class="dv-bet-chip ok">
                    {byId(players, id)?.name} {(a.ms / 1000).toFixed(1)} s +{a.pts}
                  </span>
                ))}
          </div>
          <Btn kind="ghost" onClick={() => dispatch({ type: 'next' })}>
            Continuer ▶️
          </Btn>
        </div>
      )}

      {v.phase === 'end' && (
        <EndPanel v={v} me={me} players={players}>
          <div class="dv-history">
            {v.history.map((h) => (
              <div class="dv-hist-row">
                <span>
                  {h.emoji} → {h.name}
                </span>
                <span class="muted small">{h.winners.length ? `⚡ ${byId(players, h.winners[0])?.name}` : '—'}</span>
              </div>
            ))}
          </div>
        </EndPanel>
      )}
      {v.phase !== 'end' && <Scores v={v} players={players} ids={v.order} mark={(id) => (v.answered.includes(id) && v.phase === 'play' ? <span>✋</span> : null)} />}
    </div>
  );
}
