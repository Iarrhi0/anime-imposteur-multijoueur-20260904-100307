// Plateau de « Devine mon personnage ».
import { useState } from 'preact/hooks';
import type { BoardProps } from '../../core/types';
import { Btn, byId, Pill, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import type { VQView } from './vingt-questions';
import { DvHead, EndPanel, QLog, Reveal, Scores, Suggest } from './ui';

export function VingtBoard({ view: v, me, players, dispatch, remaining }: BoardProps<VQView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}-${v.log.length}`, remaining);
  const [mode, setMode] = useState<'ask' | 'guess'>('ask');
  const cur = byId(players, v.current);
  const myTurn = !!me && v.current === me.id;
  const left = v.maxQ - v.used;
  return (
    <div class="board dv vingt">
      <DvHead emoji="🔮" title="L’oracle a choisi…" sub={`${v.packEmoji} ${v.packName} · ${v.poolSize} possibilités`}>
        {v.rounds > 1 && (
          <Pill tone="info">
            Manche {v.round}/{v.rounds}
          </Pill>
        )}
        <Pill tone={left <= 3 ? 'bad' : left <= 7 ? 'warn' : 'good'}>
          ❓ {v.used}/{v.maxQ}
        </Pill>
      </DvHead>
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.phase === 'play' && (
        <div class="dv-meter">
          <div style={{ width: `${Math.min(100, (v.used / v.maxQ) * 100)}%` }} />
        </div>
      )}

      {v.phase === 'play' && (
        <div class="dv-oracle">
          <div class="dv-orb">🔮</div>
          {myTurn ? (
            <div class="dv-turn-box">
              <div class="your-turn">À toi ! Pose une question ou tente ta chance.</div>
              <div class="dv-tabs">
                <button class={'dv-tab' + (mode === 'ask' ? ' on' : '')} onClick={() => setMode('ask')}>
                  ❓ Question
                </button>
                <button class={'dv-tab' + (mode === 'guess' ? ' on' : '')} onClick={() => setMode('guess')}>
                  🎯 Deviner
                </button>
              </div>
              {mode === 'ask' ? (
                <>
                  <TextInput autoFocus placeholder="Ex. : Est-ce un humain ?" button="Demander" onSubmit={(text) => dispatch({ type: 'ask', text })} maxLength={140} />
                  <Suggest list={v.suggestions} onPick={(text) => dispatch({ type: 'ask', text })} />
                </>
              ) : (
                <TextInput autoFocus placeholder="C’est… (nom)" button="Deviner" onSubmit={(text) => dispatch({ type: 'guess', text })} maxLength={80} />
              )}
            </div>
          ) : (
            cur && <Waiting who={cur} text="réfléchit à sa question…" />
          )}
          {v.log.length > 0 && (
            <div class="dv-last pop">
              <span class="muted small">Dernière réponse :</span> « {v.log[v.log.length - 1].text} » →{' '}
              <b>{answerWord(v.log[v.log.length - 1].answer)}</b>
            </div>
          )}
        </div>
      )}

      {v.phase === 'reveal' && v.secret && (
        <Reveal emoji={v.secret.emoji} name={v.secret.name}>
          <div class="result-text">{v.finder ? `🎉 ${byId(players, v.finder)?.name} a trouvé ! +${v.lastPts} pts` : '🔮 L’oracle garde son secret… personne n’a trouvé.'}</div>
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
                <span class="muted small">{h.finder ? `${byId(players, h.finder)?.name} · ${h.used} q. · +${h.pts}` : 'non trouvé'}</span>
              </div>
            ))}
          </div>
        </EndPanel>
      )}

      {v.phase !== 'end' && <Scores v={v} players={players} ids={v.order} />}
      <QLog rows={v.log.map((e) => ({ pid: e.pid, text: e.text, answer: e.answer, guess: e.kind === 'guess' }))} players={players} />
    </div>
  );
}

function answerWord(a: string) {
  return a === 'oui' ? '✅ Oui' : a === 'non' ? '❌ Non' : a === 'correct' ? '🎯 Trouvé !' : a === 'faux' ? '❌ Raté' : a === 'passe' ? '⏭️ Passe' : '🤷 Je ne sais pas';
}
