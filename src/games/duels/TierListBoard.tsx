// Plateau de la Tier list.
import type { BoardProps } from '../../core/types';
import { Avatar, Btn, byId, Section, Timer, usePhaseTotal, Waiting } from '../../ui/components';
import { DoneDots, EndPanel, GameHead, Progress } from '../kit-ui';
import type { Tier, TLView } from './tier-list';

const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export function TierListBoard({ view: v, me, players, dispatch, remaining }: BoardProps<TLView>) {
  const total = usePhaseTotal(`${v.phase}-${v.idx}`, remaining);
  const it = v.item;
  const canRate = !!me && v.active.includes(me.id) && v.phase === 'rate' && !v.myRating;
  return (
    <div class="board tl">
      <GameHead title="🏆 Tier list" sub={v.packName} pills={v.phase !== 'end' ? <Progress idx={v.idx} total={v.total} label="Élément" /> : undefined} />
      {v.phase !== 'end' && <Timer remaining={remaining} total={total} />}
      {it && v.phase !== 'end' && (
        <div class={'tl-item pop' + (v.group ? ' tier-' + v.group : '')}>
          <div class="tl-emoji">{it.emoji}</div>
          <div class="tl-name">{it.name}</div>
          {it.group && <div class="small muted">{it.group}</div>}
          {v.group && <div class={'tl-badge tier-' + v.group}>{v.group}</div>}
        </div>
      )}
      {v.phase === 'rate' && (
        <>
          {canRate ? (
            <div class="tl-picker">
              {TIERS.map((t) => (
                <button type="button" class={'tl-tier-btn tier-' + t} onClick={() => dispatch({ type: 'rate', tier: t })}>
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <Waiting text={v.myRating ? `Tu as mis ${v.myRating}. En attente des autres…` : 'Les joueurs notent…'} />
          )}
          <DoneDots ids={v.active} done={v.rated} players={players} />
        </>
      )}
      {v.phase === 'reveal' && v.ratings && (
        <div class="result">
          <div class="tl-votes">
            {TIERS.map((t) => (
              <div class="tl-vote-col">
                <span class={'tl-mini tier-' + t}>{t}</span>
                {Object.entries(v.ratings!)
                  .filter(([, x]) => x === t)
                  .map(([id]) => (
                    <Avatar p={byId(players, id)} size={24} />
                  ))}
              </div>
            ))}
          </div>
          {v.avg != null && <div class="muted center small">Moyenne du groupe : {v.avg.toFixed(1)} / 5</div>}
          <Btn onClick={() => dispatch({ type: 'skip' })}>Suivant ▶️</Btn>
        </div>
      )}
      {v.phase === 'end' ? (
        <EndPanel summary={v.summary} scores={v.scores} players={players} winners={v.winners} me={me} ids={v.active}>
          <TierBoard board={v.board} />
        </EndPanel>
      ) : (
        v.board.length > 0 && <TierBoard board={v.board} />
      )}
    </div>
  );
}

function TierBoard({ board }: { board: TLView['board'] }) {
  return (
    <Section title="La tier list du groupe">
      <div class="tl-board">
        {TIERS.map((t: Tier) => (
          <div class="tl-row">
            <div class={'tl-label tier-' + t}>{t}</div>
            <div class="tl-cells">
              {board
                .filter((b) => b.tier === t)
                .sort((a, b) => b.avg - a.avg)
                .map((b) => (
                  <span class="tl-cell" title={`${b.name} (${b.avg.toFixed(1)})`}>
                    <span>{b.emoji.split(' ')[0]}</span>
                    <span class="small">{b.name}</span>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}


