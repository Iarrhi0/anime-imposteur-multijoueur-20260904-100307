// Plateau de « Lettre par lettre ».
import type { BoardProps } from '../../core/types';
import type { PView } from './progressive';
import { ProgressiveBoard } from './ProgressiveBoard';

export function LettresBoard(props: BoardProps<PView>) {
  const v = props.view;
  const mask: string[] = v.pub.mask ?? [];
  // découpe en mots pour que les retours à la ligne ne coupent pas un mot
  const words: string[][] = [[]];
  mask.forEach((c) => (c === ' ' ? words.push([]) : words[words.length - 1].push(c)));
  return (
    <ProgressiveBoard props={props} emoji="🔠" title="Lettre par lettre" placeholder="Le nom complet…">
      <div class="dv-letters-help">
        <span class="dv-letters-emoji">{v.pub.emoji ?? '❔'}</span>
        <span class="muted small">{v.pub.emoji ? `Catégorie : ${v.packName}` : `Emoji dévoilé après ${v.pub.emojiAt} lettre(s)`}</span>
      </div>
      <div class="dv-mask">
        {words.map((w) => (
          <span class="dv-word">
            {w.map((c) => (
              <span class={'dv-letter' + (c === '_' ? ' blank' : /[\p{L}\p{N}]/u.test(c) ? ' shown' : ' sym')}>{c === '_' ? '' : c}</span>
            ))}
          </span>
        ))}
      </div>
      {v.phase === 'play' && (
        <div class="muted small center">
          {v.pub.hidden} lettre(s) cachée(s) sur {v.pub.letters}
        </div>
      )}
    </ProgressiveBoard>
  );
}
