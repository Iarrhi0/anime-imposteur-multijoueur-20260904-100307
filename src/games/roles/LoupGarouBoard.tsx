// Plateau du Loup-Garou.
import { useState } from 'preact/hooks';
import type { BoardProps, Player } from '../../core/types';
import { Avatar, Btn, byId, Card, Flip, Pill, PlayerTag, Section, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { DoneDots, EndPanel, GameHead } from '../kit-ui';
import { LG_ROLE, type LGRole, type LGView } from './lg-types';

export function LoupGarouBoard({ view: v, me, players, dispatch, remaining, local }: BoardProps<LGView>) {
  const total = usePhaseTotal(`${v.phase}-${v.day}`, remaining);
  const night = v.phase === 'night';
  return (
    <div class={'board lg ' + (night ? 'lg-night' : 'lg-day')}>
      <GameHead
        title={night ? `🌙 Nuit ${v.day}` : v.phase === 'reveal' ? '🐺 Loup-Garou' : v.phase === 'end' ? '🏁 Fin de partie' : `☀️ Jour ${v.day}`}
        sub={`${v.alive.length} survivant${v.alive.length > 1 ? 's' : ''} sur ${v.active.length}`}
        pills={<Composition comp={v.composition} />}
      />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {v.me && v.phase !== 'reveal' && v.phase !== 'end' && <MiniRole v={v} players={players} />}
      {v.phase === 'reveal' && <Reveal v={v} me={me} dispatch={dispatch} players={players} />}
      {v.phase === 'night' && <Night v={v} me={me} dispatch={dispatch} players={players} />}
      {v.phase === 'day' && <Day v={v} me={me} dispatch={dispatch} players={players} local={local} />}
      {v.phase === 'vote' && <Vote v={v} me={me} dispatch={dispatch} players={players} />}
      {v.phase === 'verdict' && <Verdict v={v} players={players} dispatch={dispatch} />}
      {v.phase === 'end' && (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active}>
          <Section title="Les rôles">
            <div class="reveal-list">
              {v.active.map((id) => {
                const r = v.reveal?.[id];
                return (
                  <div class={'reveal-row' + (v.winners?.includes(id) ? ' win' : '')}>
                    <PlayerTag p={byId(players, id)} dim={!v.alive.includes(id)} />
                    {r && <RoleChip role={r} />}
                    {!v.alive.includes(id) && <span class="muted small">☠️</span>}
                  </div>
                );
              })}
            </div>
          </Section>
        </EndPanel>
      )}
      {v.phase !== 'reveal' && <Village v={v} players={players} />}
      {v.history.length > 0 && v.phase !== 'verdict' && <History v={v} players={players} />}
    </div>
  );
}

function Composition({ comp }: { comp: LGView['composition'] }) {
  return (
    <>
      {Object.entries(comp).map(([r, n]) => (
        <Pill>
          {LG_ROLE[r as LGRole].emoji} {n}
        </Pill>
      ))}
    </>
  );
}

function RoleChip({ role }: { role: LGRole }) {
  const info = LG_ROLE[role];
  return (
    <span class={'secret-role small lg-role-' + info.team + ' ' + (info.team === 'village' ? 'good' : 'bad')}>
      {info.emoji} {info.label}
    </span>
  );
}

function RoleCard({ v, players }: { v: LGView; players: Player[] }) {
  const m = v.me!;
  const info = LG_ROLE[m.role];
  return (
    <div class="secret-body">
      <div class={'secret-role ' + (info.team === 'village' ? 'good' : 'bad')}>{info.team === 'loups' ? 'Camp des loups' : info.team === 'solo' ? 'Solitaire' : 'Camp du village'}</div>
      <div class="secret-emoji">{info.emoji}</div>
      <div class="secret-word">{info.label}</div>
      <p class="secret-hint">{info.desc}</p>
      {!!m.wolves?.length && (
        <div class="lg-wolves">
          {m.role === 'complice' ? 'Les loups : ' : 'Ta meute : '}
          {m.wolves.map((id) => (
            <PlayerTag p={byId(players, id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniRole({ v, players }: { v: LGView; players: Player[] }) {
  const [open, setOpen] = useState(false);
  const m = v.me!;
  const info = LG_ROLE[m.role];
  return (
    <div class="mini-secret" onClick={() => setOpen(!open)}>
      {open ? (
        <div>
          <span>
            {info.emoji} {info.label} {!m.alive && '— ☠️ éliminé'}
          </span>
          {!!m.wolves?.length && <div class="small">🐺 {m.wolves.map((id) => byId(players, id)?.name).join(', ')}</div>}
          {!!m.seerResults?.length && (
            <div class="small">
              🔮 {m.seerResults.map((r) => `${byId(players, r.target)?.name} : ${r.wolf ? 'LOUP' : 'innocent'}`).join(' · ')}
            </div>
          )}
        </div>
      ) : (
        <span>👁️ Revoir mon rôle</span>
      )}
    </div>
  );
}

function Reveal({ v, me, dispatch, players }: { v: LGView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const [flipped, setFlipped] = useState(false);
  if (!me || !v.me) {
    return (
      <Section title="Distribution des rôles">
        <DoneDots ids={v.active} done={v.ready} players={players} />
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
            <div class="big-emoji">🌕</div>
            <div>Touche pour découvrir ton rôle</div>
            <small>Cache l’écran des autres !</small>
          </div>
        }
        back={<RoleCard v={v} players={players} />}
      />
      {v.needs.includes(me.id) ? (
        <Btn big kind="ok" disabled={!flipped} onClick={() => dispatch({ type: 'ready' })}>
          J’ai vu mon rôle ✅
        </Btn>
      ) : (
        <Waiting text="En attente des autres joueurs…" />
      )}
      <DoneDots ids={v.active} done={v.ready} players={players} />
    </div>
  );
}

function PickGrid({ ids, players, onPick, selected, disabled, badge }: { ids: string[]; players: Player[]; onPick: (id: string) => void; selected?: string | null; disabled?: (id: string) => boolean; badge?: (id: string) => any }) {
  return (
    <div class="vote-grid">
      {ids.map((id) => (
        <button class={'vote-card' + (selected === id ? ' sel' : '')} disabled={disabled?.(id)} onClick={() => onPick(id)}>
          <Avatar p={byId(players, id)} size={48} />
          <span>{byId(players, id)?.name}</span>
          {badge?.(id)}
        </button>
      ))}
    </div>
  );
}

function Night({ v, me, dispatch, players }: { v: LGView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[] }) {
  const m = v.me;
  if (!me || !m) return <div class="lg-sleep"><div class="big-emoji">🌙</div><Waiting text="Le village dort… les rôles de la nuit agissent." /></div>;
  if (!m.alive) return <div class="lg-sleep"><div class="big-emoji">👻</div><p class="muted center">Tu es mort. Observe la partie en silence…</p></div>;
  const myTurn = v.needs.includes(me.id);
  const act = (target: string) => dispatch({ type: 'night', target });
  if (m.role === 'loup') {
    const prey = v.alive.filter((id) => !m.wolves?.includes(id));
    const votes = v.wolfVotes ?? {};
    return (
      <Card class="lg-action">
        <div class="your-turn">🐺 Choisissez votre victime avec la meute</div>
        <PickGrid
          ids={prey}
          players={players}
          selected={m.myTarget}
          onPick={act}
          badge={(id) => {
            const n = Object.values(votes).filter((t) => t === id).length;
            return n ? <span class="chips">{'🐾'.repeat(n)}</span> : null;
          }}
        />
        <p class="muted small center">Les pattes 🐾 montrent le choix des autres loups. Majorité ; égalité = tirage au sort.</p>
        {m.myTarget && myTurn && <Btn kind="ghost" onClick={() => dispatch({ type: 'sleep' })}>C’est décidé, je dors 💤</Btn>}
      </Card>
    );
  }
  if (m.role === 'voyante' && !m.myTarget) {
    const done = new Set((m.seerResults ?? []).map((r) => r.target));
    return (
      <Card class="lg-action">
        <div class="your-turn">🔮 Qui veux-tu inspecter cette nuit ?</div>
        <PickGrid ids={v.alive.filter((id) => id !== me.id)} players={players} onPick={act} badge={(id) => (done.has(id) ? <span class="small muted">déjà vu</span> : null)} />
      </Card>
    );
  }
  if (m.role === 'garde' && !m.myTarget) {
    return (
      <Card class="lg-action">
        <div class="your-turn">😇 Qui protèges-tu cette nuit ?</div>
        <PickGrid ids={v.alive} players={players} onPick={act} disabled={(id) => id === m.lastGuarded} badge={(id) => (id === m.lastGuarded ? <span class="small muted">protégé hier</span> : id === me.id ? <span class="small muted">toi</span> : null)} />
      </Card>
    );
  }
  const last = m.role === 'voyante' ? m.seerResults?.[m.seerResults.length - 1] : undefined;
  return (
    <div class="lg-sleep">
      <div class="big-emoji">{m.role === 'voyante' ? '🔮' : m.role === 'garde' ? '🛡️' : '😴'}</div>
      {last && last.day === v.day && (
        <div class={'lg-seer-result ' + (last.wolf ? 'bad' : 'good')}>
          {byId(players, last.target)?.name} est {last.wolf ? 'un LOUP 🐺' : 'innocent 🙂'}
        </div>
      )}
      {m.role === 'garde' && m.myTarget && <p class="center">Tu veilles sur {byId(players, m.myTarget)?.name} cette nuit.</p>}
      {m.role === 'complice' && <p class="muted center">Tu dors, mais tu sais qui sont les loups… 🦹</p>}
      {myTurn ? (
        <Btn big kind="ok" onClick={() => dispatch({ type: 'sleep' })}>
          Fermer les yeux 💤
        </Btn>
      ) : (
        <Waiting text="Le village dort…" />
      )}
    </div>
  );
}

function Day({ v, me, dispatch, players, local }: { v: LGView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[]; local: boolean }) {
  const victim = byId(players, v.lastNight?.victim);
  const death = v.deaths.find((d) => d.pid === v.lastNight?.victim && d.cause === 'loups' && d.day === v.day);
  const canReady = !!me && v.alive.includes(me.id);
  const iAmReady = !!me && v.ready.includes(me.id);
  return (
    <div class="discussion">
      <div class="lg-dawn pop">
        {victim ? (
          <>
            <Avatar p={victim} size={64} dim />
            <div>
              <b>{victim.name}</b> a été dévoré cette nuit… {death?.role && <RoleChip role={death.role} />}
            </div>
          </>
        ) : (
          <div>{v.lastNight?.saved ? '😇 L’Ange gardien a sauvé la victime !' : '🌅 Personne n’est mort cette nuit.'}</div>
        )}
      </div>
      <div class="prompt">🗣️ Débattez ! Qui sont les loups ? (vocal ou chat)</div>
      <div class="row gap">
        {canReady && (
          <Btn kind={iAmReady ? 'ghost' : 'ok'} disabled={iAmReady} onClick={() => dispatch({ type: 'ready' })}>
            {iAmReady ? 'Prêt ✅' : 'Prêt à voter'}
          </Btn>
        )}
        {local && (
          <Btn kind="ghost" onClick={() => dispatch({ type: 'skip' })}>
            Passer au vote ⏭️
          </Btn>
        )}
      </div>
      <DoneDots ids={v.alive} done={v.ready} players={players} />
    </div>
  );
}

function Vote({ v, me, dispatch, players }: { v: LGView; me: Player | null; dispatch: BoardProps['dispatch']; players: Player[] }) {
  if (!me || !v.alive.includes(me.id)) return <Waiting text="Le village vote…" />;
  if (v.voted.includes(me.id))
    return (
      <div>
        <Waiting text={`Vote envoyé (${v.myVote === 'personne' ? 'personne' : byId(players, v.myVote)?.name}). En attente des autres…`} />
        <DoneDots ids={v.alive} done={v.voted} players={players} mark="🗳️" />
      </div>
    );
  return (
    <div class="vote">
      <div class="prompt">Qui le village doit-il éliminer ?</div>
      <div class="vote-grid">
        {v.alive
          .filter((id) => id !== me.id)
          .map((id) => (
            <button class="vote-card" onClick={() => dispatch({ type: 'vote', target: id })}>
              <Avatar p={byId(players, id)} size={48} />
              <span>{byId(players, id)?.name}</span>
            </button>
          ))}
        <button class="vote-card nobody" onClick={() => dispatch({ type: 'vote', target: 'personne' })}>
          <span class="big-emoji">🙅</span>
          <span>Personne</span>
        </button>
      </div>
    </div>
  );
}

function Tally({ votes, players }: { votes: Record<string, string>; players: Player[] }) {
  const tally: Record<string, string[]> = {};
  Object.entries(votes).forEach(([voter, t]) => (tally[t] ??= []).push(voter));
  const rows = Object.entries(tally).sort((a, b) => b[1].length - a[1].length);
  const max = Math.max(1, ...rows.map((r) => r[1].length));
  return (
    <div class="tally">
      {rows.map(([id, voters]) => (
        <div class="tally-row">
          <span class="tally-name">{id === 'personne' ? '🙅 Personne' : byId(players, id)?.name ?? id}</span>
          <div class="tally-bar">
            <div style={{ width: (voters.length / max) * 100 + '%' }} />
          </div>
          <span class="tally-n" title={voters.map((x) => byId(players, x)?.name).join(', ')}>
            {voters.length}
          </span>
        </div>
      ))}
    </div>
  );
}

function Verdict({ v, players, dispatch }: { v: LGView; players: Player[]; dispatch: BoardProps['dispatch'] }) {
  const h = v.history[v.history.length - 1];
  if (!h) return null;
  const el = byId(players, h.lynched);
  return (
    <div class="result pop">
      {el && (
        <div class="elim">
          <Avatar p={el} size={80} />
          <div class="elim-name">{el.name}</div>
          {h.role && <RoleChip role={h.role} />}
        </div>
      )}
      <div class="result-text">{h.text}</div>
      <Tally votes={h.votes} players={players} />
      <Btn onClick={() => dispatch({ type: 'skip' })}>La nuit tombe… 🌙</Btn>
    </div>
  );
}

function Village({ v, players }: { v: LGView; players: Player[] }) {
  return (
    <Section title="Le village">
      <div class="lg-village">
        {v.active.map((id) => {
          const dead = !v.alive.includes(id);
          const d = v.deaths.find((x) => x.pid === id);
          const wolfMate = v.me?.wolves?.includes(id);
          const seen = v.me?.seerResults?.find((r) => r.target === id);
          return (
            <div class={'lg-villager' + (dead ? ' dead' : '')}>
              <Avatar p={byId(players, id)} size={40} dim={dead} />
              <span class="small">{byId(players, id)?.name}</span>
              {dead && <span class="small">{d?.role ? LG_ROLE[d.role].emoji : '☠️'}</span>}
              {!dead && wolfMate && <span class="small">🐺</span>}
              {!dead && seen && <span class="small">{seen.wolf ? '🔴' : '🟢'}</span>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function History({ v, players }: { v: LGView; players: Player[] }) {
  return (
    <Section title="Journal du village">
      <div class="lg-history">
        {[...v.history].reverse().map((h) => (
          <div class="lg-hist-row">
            <Pill>Jour {h.day}</Pill>
            <span class="small">{h.text}</span>
            <div class="small muted">
              {Object.entries(h.votes)
                .map(([a, t]) => `${byId(players, a)?.name} → ${t === 'personne' ? 'personne' : byId(players, t)?.name}`)
                .join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
