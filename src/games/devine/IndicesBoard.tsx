// Plateau d'« Indices progressifs ».
import type { BoardProps } from '../../core/types';
import type { PView } from './progressive';
import type { IClue } from './indices';
import { ProgressiveBoard } from './ProgressiveBoard';

export function IndicesBoard(props: BoardProps<PView>) {
  const v = props.view;
  const clues: IClue[] = v.pub.clues ?? [];
  const total: number = v.pub.total ?? clues.length;
  return (
    <ProgressiveBoard props={props} emoji="🔍" title="Indices progressifs" placeholder="Ta réponse…">
      <div class="dv-clues">
        {clues.map((c, i) => (
          <div class={'dv-clue pop' + (c.tag ? ' tag' : '') + (i === clues.length - 1 && v.phase === 'play' ? ' fresh' : '')}>
            <span class="dv-clue-n">{i + 1}</span>
            <span>{c.tag ? `🏷️ ${c.text}` : c.text}</span>
          </div>
        ))}
        {v.phase === 'play' &&
          Array.from({ length: Math.max(0, total - clues.length) }, () => (
            <div class="dv-clue hidden">
              <span class="dv-clue-n">?</span>
              <span>…</span>
            </div>
          ))}
      </div>
    </ProgressiveBoard>
  );
}
