// Composants d'interface réutilisés par tous les jeux.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Player } from '../core/types';
import type { Stroke } from '../games/deduction/engine';

export function Avatar({ p, size = 40, dim = false }: { p?: Player | null; size?: number; dim?: boolean }) {
  if (!p) return <span class="avatar" style={{ width: size, height: size }}>❔</span>;
  return (
    <span
      class={'avatar' + (dim ? ' dim' : '') + (p.kind === 'ai' ? ' ai' : '')}
      style={{ width: size, height: size, fontSize: size * 0.55, borderColor: p.color }}
      title={p.name}
    >
      {p.avatar}
    </span>
  );
}

export function PlayerTag({ p, dim, badge }: { p?: Player | null; dim?: boolean; badge?: ComponentChildren }) {
  return (
    <span class={'ptag' + (dim ? ' dim' : '')}>
      <Avatar p={p} size={26} dim={dim} />
      <span class="pname" style={{ color: p?.color }}>
        {p?.name ?? '?'}
      </span>
      {p?.kind === 'ai' && <span class="ai-badge">IA</span>}
      {badge}
    </span>
  );
}

export function Btn(props: {
  children: ComponentChildren;
  onClick?: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'ok';
  disabled?: boolean;
  big?: boolean;
  class?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={props.type ?? 'button'}
      class={`btn ${props.kind ?? 'primary'} ${props.big ? 'big' : ''} ${props.class ?? ''}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function Timer({ remaining, total }: { remaining: number | null; total?: number }) {
  if (remaining === null || remaining === undefined) return null;
  const r = Math.max(0, Math.ceil(remaining));
  const pct = total ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 100;
  return (
    <div class={'timer' + (r <= 10 ? ' urgent' : '')}>
      <div class="timer-bar" style={{ width: pct + '%' }} />
      <span>⏱️ {r}s</span>
    </div>
  );
}

/** Retient la durée initiale d'une phase pour afficher la barre de progression. */
export function usePhaseTotal(key: string, remaining: number | null): number | undefined {
  const ref = useRef<{ key: string; total: number } | null>(null);
  if (remaining !== null && (!ref.current || ref.current.key !== key)) ref.current = { key, total: Math.max(remaining, 1) };
  return ref.current?.total;
}

export function Card({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <div class={'card ' + (cls ?? '')}>{children}</div>;
}

export function Flip({ front, back, flipped, onToggle }: { front: ComponentChildren; back: ComponentChildren; flipped: boolean; onToggle: () => void }) {
  return (
    <div class={'flip' + (flipped ? ' flipped' : '')} onClick={onToggle}>
      <div class="flip-inner">
        <div class="flip-front">{front}</div>
        <div class="flip-back">{back}</div>
      </div>
    </div>
  );
}

export function TextInput(props: {
  placeholder?: string;
  onSubmit: (text: string) => void;
  button?: string;
  maxLength?: number;
  type?: 'text' | 'number';
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus();
  }, []);
  const submit = (e?: Event) => {
    e?.preventDefault();
    const v = val.trim();
    if (!v) return;
    props.onSubmit(v);
    setVal('');
  };
  return (
    <form class="tinput" onSubmit={submit}>
      <input
        ref={ref}
        type={props.type ?? 'text'}
        inputMode={props.type === 'number' ? 'decimal' : undefined}
        value={val}
        maxLength={props.maxLength ?? 120}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onInput={(e) => setVal((e.target as HTMLInputElement).value)}
      />
      <Btn type="submit" disabled={props.disabled || !val.trim()}>
        {props.button ?? 'Envoyer'}
      </Btn>
    </form>
  );
}

export function Pill({ children, tone }: { children: ComponentChildren; tone?: 'good' | 'bad' | 'warn' | 'info' }) {
  return <span class={'pill ' + (tone ?? '')}>{children}</span>;
}

export function Section({ title, children, right }: { title?: ComponentChildren; children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <section class="section">
      {(title || right) && (
        <div class="section-head">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Waiting({ who, text }: { who?: Player | null; text?: string }) {
  return (
    <div class="waiting">
      <span class="dots">
        <i />
        <i />
        <i />
      </span>
      {who ? (
        <span>
          <PlayerTag p={who} /> {text ?? 'réfléchit…'}
        </span>
      ) : (
        <span>{text ?? 'En attente…'}</span>
      )}
    </div>
  );
}

// ---------- Dessin ----------

export function DrawCanvas({ strokes, canDraw, color, onStroke }: { strokes: Stroke[]; canDraw: boolean; color: string; onStroke?: (s: Stroke) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<[number, number][] | null>(null);

  const redraw = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(0, 0, w, h);
    const all = [...strokes, ...(cur.current ? [{ color, pts: cur.current }] : [])];
    for (const s of all) {
      if (s.pts.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = w / 90;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.stroke();
    }
  };

  useEffect(redraw, [strokes, color]);

  const pos = (e: PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  return (
    <canvas
      ref={ref}
      width={600}
      height={600}
      class={'draw' + (canDraw ? ' active' : '')}
      onPointerDown={(e) => {
        if (!canDraw) return;
        (e.target as Element).setPointerCapture(e.pointerId);
        cur.current = [pos(e)];
        redraw();
      }}
      onPointerMove={(e) => {
        if (!cur.current) return;
        const p = pos(e);
        const last = cur.current[cur.current.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.012) {
          cur.current.push(p);
          redraw();
        }
      }}
      onPointerUp={() => {
        const pts = cur.current;
        cur.current = null;
        if (pts && pts.length >= 2 && onStroke) {
          // sous-échantillonnage pour limiter la taille
          const step = Math.max(1, Math.ceil(pts.length / 60));
          onStroke({ color, pts: pts.filter((_, i) => i % step === 0 || i === pts.length - 1) });
        } else redraw();
      }}
    />
  );
}

export function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.12}s`, background: ['#ff5d8f', '#4cc9f0', '#f7b801', '#7bd389', '#b388ff'][i % 5] }} />
      ))}
    </div>
  );
}

export function byId(players: Player[], id?: string | null): Player | undefined {
  return players.find((p) => p.id === id);
}
