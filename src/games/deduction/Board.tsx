// Plateau commun des jeux « trouver l'imposteur ».
import { useState } from 'preact/hooks';
import type { BoardProps, Player } from '../../core/types';
import { Avatar, Btn, byId, Card, DrawCanvas, Flip, Pill, PlayerTag, Section, TextInput, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { ROLE_LABEL, isBad, type DView, type Clue } from './engine';

export function DeductionBoard({ view: v, me, players, dispatch, remaining, local }: BoardProps<DView>) {
  const total = usePhaseTotal(`${v.phase}-${v.round}-${v.current}-${v.results.length}`, remaining);
  const P = (id?: string | null) => byId(players, id);
  const myId = me?.id ?? null;
  const canAct = !!myId && v.needs.includes(myId);

  return (
    <div class="board deduction">
      <Header v={v} />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.events.length > 0 && v.phase === 'discussion' && <div class="event-banner">🌪️ {v.events[v.events.length - 1]}</div>}
      {v.notes.length > 0 && v.phase !== 'reveal' && (
        <div class="notes">
          {v.notes.slice(-3).map((n) => (
            <div class="note">{n}</div>
          ))}
        </div>
      )}
      {v.phase !== 'reveal' && v.me && !v.me.spectator && <MiniSecret v={v} />}
      {v.phase === 'reveal' && <Reveal v={v} me={me} canAct={canAct} dispatch={dispatch} players={players} />}
      {v.phase === 'clues' && <Clues v={v} me={me} canAct={canAct} dispatch={dispatch} players={players} />}
      {v.phase === 'discussion' && <Discussion v={v} me={me} dispatch={dispatch} players={players} local={local} />}
      {v.phase === 'vote' && <Vote v={v} me={me} dispatch={dispatch} players={players} />}
      {v.phase === 'result' && <Result v={v} players={players} dispatch={dispatch} />}
      {v.phase === 'lastChance' && <LastChance v={v} me={me} dispatch={dispatch} P={P} />}
      {v.phase === 'end' && <End v={v} players={players} />}
      {v.phase !== 'clues' && v.phase !== 'reveal' && v.clues.length > 0 && <ClueTable v={v} players={players} />}
    </div>
  );
}

function Header({ v }: { v: DView }) {
  return (
    <div class="game-head">
      <div class="gh-title">{v.pub.title}</div>
      {v.pub.subtitle && <div class="gh-sub">{v.pub.subtitle}</div>}
      <div class="gh-meta">
        <Pill tone="info">Tour {v.round}</Pill>
        {v.pub.letter && v.phase === 'clues' && <Pill tone="warn">Lettre : {v.pub.letter}</Pill>}
        {v.pub.category && <Pill>{v.pub.category}</Pill>}
        {v.voteMode === 'elimination' && <Pill>Élimination</Pill>}
      </div>
    </div>
  );
}

function SecretContent({ v }: { v: DView }) {
  const s = v.me!;
  if (s.spectator) return <div class="secret-body"><div class="secret-emoji">🔎</div><div class="secret-word">Enquêteur</div><p>Tu observes les IA. Vote pour l’imposteur à la fin !</p></div>;
  return (
    <div class="secret-body">
      {v.roleLabel && <div class={'secret-role ' + (isBad(s.role) ? 'bad' : 'good')}>{v.roleLabel}</div>}
      <div class="secret-emoji">{s.word ? s.emoji ?? '🃏' : '❓'}</div>
      <div class="secret-word">{s.word ?? (s.role === 'mrwhite' ? 'Tu n’as aucun mot' : 'Tu ne connais pas le mot')}</div>
      {s.hint && <div class="secret-hint">{v.kind === 'qa' ? `Ton rôle : ${s.hint}` : `Indice : ${s.hint}`}</div>}
      {!!s.allies?.length && <div class="secret-hint">Tes complices : {s.allies.length} (voir la liste des joueurs)</div>}
      {!!s.forbidden?.length && <div class="secret-hint">Mots interdits : {s.forbidden.join(', ')}</div>}
      {v.pub.grid && <div class="secret-hint">Le mot est dans la grille ci-dessous.</div>}
      {!v.roleLabel && s.word && <p class="muted small">Attention : tu es peut-être l’imposteur sans le savoir…</p>}
    </div>
  );
}

function MiniSecret({ v }: { v: DView }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="mini-secret" onClick={() => setOpen(!open)}>
      {open ? (
        <span>
          🃏 {v.me?.word ?? '(aucun mot)'} {v.roleLabel ? `— ${v.roleLabel}` : ''} {v.me?.hint ? `— ${v.me.hint}` : ''}
        </span>
      ) : (
        <span>👁️ Revoir ma carte</span>
      )}
    </div>
  );
}

function Reveal({ v, me, canAct, dispatch, players }: { v: DView; me: Player | null; canAct: boolean; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const [flipped, setFlipped] = useState(false);
  if (!me || !v.me) {
    return (
      <Section title="Distribution des cartes">
        <ReadyList ids={v.active} ready={v.ready} players={players} />
      </Section>
    );
  }
  return (
    <div class="reveal">
      <Flip
        flipped={flipped}
        onToggle={() => setFlipped(!flipped)}
        front={
          <div class="card-back">
            <div class="big-emoji">🂠</div>
            <div>Touche pour voir ta carte</div>
            <small>Cache l’écran des autres !</small>
          </div>
        }
        back={<SecretContent v={v} />}
      />
      {v.pub.grid && <Grid grid={v.pub.grid} highlight={v.me.word} />}
      {!!v.me.allies?.length && (
        <div class="allies">
          Complices : {v.me.allies.map((id) => <PlayerTag p={byId(players, id)} />)}
        </div>
      )}
      {canAct ? (
        <Btn big kind="ok" onClick={() => dispatch({ type: 'ready' })} disabled={!flipped && !v.me.spectator}>
          J’ai vu ma carte ✅
        </Btn>
      ) : (
        <Waiting text="En attente des autres joueurs…" />
      )}
      <ReadyList ids={v.active} ready={v.ready} players={players} />
    </div>
  );
}

function ReadyList({ ids, ready, players }: { ids: string[]; ready: string[]; players: Player[] }) {
  return (
    <div class="ready-list">
      {ids.map((id) => (
        <span class={'ready-item' + (ready.includes(id) ? ' ok' : '')}>
          <Avatar p={byId(players, id)} size={30} />
          {ready.includes(id) ? '✅' : '…'}
        </span>
      ))}
    </div>
  );
}

function Grid({ grid, highlight }: { grid: string[]; highlight?: string | null }) {
  return (
    <div class="word-grid">
      {grid.map((g) => (
        <div class={'cell' + (highlight && g === highlight ? ' hl' : '')}>{g}</div>
      ))}
    </div>
  );
}

function Clues({ v, me, canAct, dispatch, players }: { v: DView; me: Player | null; canAct: boolean; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const current = byId(players, v.current);
  const strokes = v.clues.filter((c) => c.strokes).map((c) => c.strokes!);
  return (
    <div class="clues-phase">
      <div class="prompt">{v.prompt}</div>
      {v.pub.grid && <Grid grid={v.pub.grid} highlight={v.me?.word} />}
      {v.kind === 'drawing' && <DrawCanvas strokes={strokes} canDraw={canAct} color={me?.color ?? '#222'} onStroke={(stroke) => dispatch({ type: 'clue', stroke })} />}
      {v.kind === 'drawing' && canAct && <p class="muted center">Trace UN seul trait sans lever le doigt.</p>}
      {v.kind === 'qa' ? (
        <QAInput v={v} me={me} dispatch={dispatch} players={players} />
      ) : v.kind === 'answer' ? (
        canAct ? (
          <Card>
            <div class="question">❓ {v.me?.word}</div>
            <TextInput autoFocus placeholder="Ta réponse (courte)" onSubmit={(text) => dispatch({ type: 'clue', text })} button="Répondre" maxLength={40} />
          </Card>
        ) : (
          <Waiting text={me ? 'Réponse envoyée ! On attend les autres…' : 'Les joueurs répondent…'} />
        )
      ) : v.kind !== 'drawing' && canAct ? (
        <Card>
          <div class="your-turn">À toi ! {v.pub.letter ? `(commence par ${v.pub.letter})` : ''}</div>
          <TextInput
            autoFocus
            placeholder={v.kind === 'emoji' ? 'Tes emojis 😀🔥' : v.kind === 'phrase' ? 'Ta phrase…' : 'Ton mot…'}
            onSubmit={(text) => dispatch({ type: 'clue', text })}
            button="Donner"
          />
        </Card>
      ) : (
        !canAct && current && <Waiting who={current} text={v.kind === 'drawing' ? 'dessine…' : 'cherche un indice…'} />
      )}
      <ClueList clues={v.clues} players={players} kind={v.kind} />
    </div>
  );
}

function QAInput({ v, me, dispatch, players }: { v: DView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const [target, setTarget] = useState<string | null>(null);
  const qa = v.qa;
  if (!qa) return null;
  const asker = byId(players, qa.asker);
  const tgt = byId(players, qa.target);
  if (me && qa.asker === me.id && !qa.question) {
    return (
      <Card>
        <div class="your-turn">Pose une question à quelqu’un</div>
        <div class="choose-row">
          {v.alive
            .filter((id) => id !== me.id)
            .map((id) => (
              <button class={'choose' + (target === id ? ' sel' : '')} onClick={() => setTarget(id)}>
                <Avatar p={byId(players, id)} size={34} />
                <span>{byId(players, id)?.name}</span>
              </button>
            ))}
        </div>
        <TextInput placeholder="Ta question…" disabled={!target} onSubmit={(text) => dispatch({ type: 'clue', target, text })} button="Demander" />
      </Card>
    );
  }
  if (me && qa.target === me.id && qa.question) {
    return (
      <Card>
        <div class="qa-q">
          <PlayerTag p={asker} /> te demande : « {qa.question} »
        </div>
        <TextInput autoFocus placeholder="Ta réponse…" onSubmit={(text) => dispatch({ type: 'clue', text })} button="Répondre" />
      </Card>
    );
  }
  return qa.question ? (
    <div class="qa-live">
      <PlayerTag p={asker} /> → <PlayerTag p={tgt} /> : « {qa.question} »
      <Waiting who={tgt} text="réfléchit à sa réponse…" />
    </div>
  ) : (
    <Waiting who={asker} text="choisit qui interroger…" />
  );
}

function ClueList({ clues, players, kind }: { clues: (Clue & { hidden?: boolean })[]; players: Player[]; kind: DView['kind'] }) {
  if (!clues.length) return null;
  const list = [...clues].reverse();
  return (
    <div class="clue-list">
      {list.map((c) =>
        kind === 'qa' ? (
          <div class="clue qa">
            <PlayerTag p={byId(players, c.pid)} /> → <PlayerTag p={byId(players, c.target)} />
            <div class="qa-text">« {c.text} »</div>
            <div class="qa-ans">↳ « {c.answer} »</div>
          </div>
        ) : kind === 'drawing' ? (
          <div class="clue">
            <PlayerTag p={byId(players, c.pid)} /> a tracé un trait <span class="swatch" style={{ background: c.strokes?.color }} />
          </div>
        ) : (
          <div class={'clue' + (c.hidden ? ' hidden' : '')}>
            <PlayerTag p={byId(players, c.pid)} />
            <span class="clue-text">{c.text}</span>
          </div>
        )
      )}
    </div>
  );
}

function ClueTable({ v, players }: { v: DView; players: Player[] }) {
  const ids = v.active;
  if (v.kind === 'qa' || v.kind === 'drawing') {
    return (
      <Section title={v.kind === 'drawing' ? 'Le dessin' : 'Questions / réponses'}>
        {v.kind === 'drawing' ? <DrawCanvas strokes={v.clues.filter((c) => c.strokes).map((c) => c.strokes!)} canDraw={false} color="#000" /> : <ClueList clues={v.clues} players={players} kind={v.kind} />}
      </Section>
    );
  }
  return (
    <Section title="Récap des indices">
      <div class="clue-table">
        {ids.map((id) => {
          const p = byId(players, id);
          const out = !v.alive.includes(id);
          return (
            <div class={'ct-row' + (out ? ' out' : '')}>
              <PlayerTag p={p} dim={out} />
              <div class="ct-clues">
                {v.clues
                  .filter((c) => c.pid === id)
                  .map((c) => (
                    <span class="chip">{c.text}</span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Discussion({ v, me, dispatch, players, local }: { v: DView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[]; local: boolean }) {
  const iAmReady = !!me && v.ready.includes(me.id);
  const canReady = !!me && v.alive.includes(me.id);
  return (
    <div class="discussion">
      <div class="prompt">🗣️ Débattez ! Parlez au vocal ou écrivez dans le chat.</div>
      {v.muted.length > 0 && <div class="note">🤐 {byId(players, v.muted[0])?.name} est muet pendant ce débat.</div>}
      {v.pub.grid && <Grid grid={v.pub.grid} highlight={v.me?.word} />}
      <div class="row gap">
        {canReady && (
          <Btn kind={iAmReady ? 'ghost' : 'ok'} disabled={iAmReady} onClick={() => dispatch({ type: 'ready' })}>
            {iAmReady ? 'Prêt ✅' : 'Je suis prêt à voter'}
          </Btn>
        )}
        {canReady && (
          <Btn kind="ghost" disabled={v.moreVotes.includes(me!.id)} onClick={() => dispatch({ type: 'more' })}>
            🔁 Encore un tour d’indices ({v.moreVotes.length}/{Math.ceil(v.alive.length / 2)})
          </Btn>
        )}
        {local && (
          <Btn kind="ghost" onClick={() => dispatch({ type: 'skip' })}>
            Passer au vote ⏭️
          </Btn>
        )}
      </div>
      <ReadyList ids={v.alive} ready={v.ready} players={players} />
    </div>
  );
}

function Vote({ v, me, dispatch, players }: { v: DView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const [multi, setMulti] = useState<string[]>([]);
  const [chips, setChips] = useState<Record<string, number>>({});
  const spectator = !!v.me?.spectator;
  const canVote = !!me && (v.alive.includes(me.id) || spectator);
  const hasVoted = !!me && (v.voted.includes(me.id) || (spectator && !!v.myVote));
  const targets = v.alive.filter((id) => id !== me?.id);

  if (!canVote) return <Waiting text="Vote en cours…" />;
  if (hasVoted)
    return (
      <div>
        <Waiting text="Vote envoyé ! En attente des autres…" />
        <VotedList v={v} players={players} />
      </div>
    );

  if (v.special === 'equipes') {
    return (
      <div class="vote">
        <div class="prompt">Choisis jusqu’à {v.maxAllies} joueur(s) qui ont le MÊME mot que toi.</div>
        <div class="vote-grid">
          {targets.map((id) => (
            <button class={'vote-card' + (multi.includes(id) ? ' sel' : '')} onClick={() => setMulti(multi.includes(id) ? multi.filter((x) => x !== id) : multi.length < v.maxAllies ? [...multi, id] : multi)}>
              <Avatar p={byId(players, id)} size={48} />
              <span>{byId(players, id)?.name}</span>
            </button>
          ))}
        </div>
        <Btn big onClick={() => dispatch({ type: 'vote', target: multi })}>Valider mon équipe</Btn>
      </div>
    );
  }

  if (v.voteMode === 'points' && !spectator) {
    const used = Object.values(chips).reduce((a, b) => a + b, 0);
    return (
      <div class="vote">
        <div class="prompt">Répartis 3 jetons de soupçon ({3 - used} restant{3 - used > 1 ? 's' : ''})</div>
        <div class="vote-grid">
          {targets.map((id) => (
            <button class={'vote-card' + (chips[id] ? ' sel' : '')} onClick={() => used < 3 && setChips({ ...chips, [id]: (chips[id] ?? 0) + 1 })}>
              <Avatar p={byId(players, id)} size={48} />
              <span>{byId(players, id)?.name}</span>
              <span class="chips">{'🔴'.repeat(chips[id] ?? 0)}</span>
            </button>
          ))}
        </div>
        <div class="row gap">
          <Btn kind="ghost" onClick={() => setChips({})}>Effacer</Btn>
          <Btn disabled={used !== 3} onClick={() => dispatch({ type: 'vote', target: chips })}>Valider</Btn>
        </div>
      </div>
    );
  }

  return (
    <div class="vote">
      <div class="prompt">{spectator ? 'Ton pronostic : qui est l’imposteur ?' : v.special === 'paire' ? 'Qui fait partie de la paire ?' : 'Qui est l’imposteur ?'}</div>
      <div class="vote-grid">
        {targets.map((id) => (
          <button class="vote-card" onClick={() => dispatch({ type: 'vote', target: id })}>
            <Avatar p={byId(players, id)} size={48} />
            <span>{byId(players, id)?.name}</span>
          </button>
        ))}
        {v.trapPossible && !spectator && (
          <button class="vote-card nobody" onClick={() => dispatch({ type: 'vote', target: 'personne' })}>
            <span class="big-emoji">🙅</span>
            <span>Personne !</span>
          </button>
        )}
      </div>
    </div>
  );
}

function VotedList({ v, players }: { v: DView; players: Player[] }) {
  return (
    <div class="ready-list">
      {v.alive.map((id) => (
        <span class={'ready-item' + (v.voted.includes(id) ? ' ok' : '')}>
          <Avatar p={byId(players, id)} size={30} />
          {v.voted.includes(id) ? '🗳️' : '…'}
        </span>
      ))}
    </div>
  );
}

function Tally({ tally, players }: { tally: Record<string, number>; players: Player[] }) {
  const max = Math.max(1, ...Object.values(tally));
  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return (
    <div class="tally">
      {rows.map(([id, n]) => (
        <div class="tally-row">
          <span class="tally-name">{id === 'personne' ? '🙅 Personne' : byId(players, id)?.name ?? id}</span>
          <div class="tally-bar">
            <div style={{ width: (n / max) * 100 + '%' }} />
          </div>
          <span class="tally-n">{n}</span>
        </div>
      ))}
    </div>
  );
}

function Result({ v, players, dispatch }: { v: DView; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const r = v.results[v.results.length - 1];
  if (!r) return null;
  const el = byId(players, r.eliminated);
  return (
    <div class="result pop">
      {el && (
        <div class="elim">
          <Avatar p={el} size={80} />
          <div class="elim-name">{el.name}</div>
          {r.role && <div class={'secret-role ' + (isBad(r.role) ? 'bad' : 'good')}>{ROLE_LABEL[r.role]}</div>}
          {r.word !== undefined && <div class="muted">Son mot : {r.word ?? '(aucun)'}</div>}
        </div>
      )}
      <div class="result-text">{r.text}</div>
      <Tally tally={r.tally} players={players} />
      <Btn onClick={() => dispatch({ type: 'skip' })}>Continuer ▶️</Btn>
    </div>
  );
}

function LastChance({ v, me, dispatch, P }: { v: DView; me: Player | null; dispatch: BoardProps['dispatch']; P: (id?: string | null) => Player | undefined }) {
  const who = P(v.lastChanceFor);
  if (me && v.lastChanceFor === me.id && !v.guess) {
    return (
      <div class="last-chance pop">
        <div class="prompt">🎯 Dernière chance ! Devine le mot des autres.</div>
        {v.guessOptions.length > 0 && (
          <div class="word-grid">
            {v.guessOptions.map((g) => (
              <button class="cell btn-cell" onClick={() => dispatch({ type: 'guess', text: g })}>
                {g}
              </button>
            ))}
          </div>
        )}
        <TextInput autoFocus placeholder="Ou écris ta réponse…" onSubmit={(text) => dispatch({ type: 'guess', text })} button="Deviner" />
      </div>
    );
  }
  return <Waiting who={who} text="tente de deviner le mot… 🎯" />;
}

function End({ v, players }: { v: DView; players: Player[] }) {
  return (
    <div class="end">
      <div class="summary">{v.summary}</div>
      {v.reveal && (
        <Section title="Les cartes">
          <div class="reveal-list">
            {v.active.map((id) => {
              const s = v.reveal![id];
              return (
                <div class={'reveal-row' + (v.winners?.includes(id) ? ' win' : '')}>
                  <PlayerTag p={byId(players, id)} />
                  <span class={'secret-role small ' + (isBad(s.role) ? 'bad' : 'good')}>{ROLE_LABEL[s.role]}</span>
                  <span class="reveal-word">
                    {s.emoji ?? ''} {s.word ?? '—'}
                  </span>
                  {v.winners?.includes(id) && <span>🏆</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
