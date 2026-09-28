// Formulaires partagés : options de jeu, choix des thèmes, joueurs et IA.
import type { GameModule, GameOptions, OptionDef, Player, PersonalityId } from '../core/types';
import { allPacks, CATEGORY_LABELS } from '../content';
import { AI_NAMES, COLORS, PERSONALITIES } from '../ai/personalities';
import { uid } from '../core/rng';

export function defaultOptions(game: GameModule): GameOptions {
  const o: GameOptions = { difficulty: 'normal', packs: ['mix'] };
  for (const d of game.options) o[d.key] = d.default;
  return o;
}

export function Toggle({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div class="toggle" onClick={() => onChange(!value)}>
      <div>
        <div>{label}</div>
        {help && <div class="help muted small">{help}</div>}
      </div>
      <span class={'switch' + (value ? ' on' : '')} />
    </div>
  );
}

export function Stepper({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div class="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        −
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

function OptionField({ def, value, onChange }: { def: OptionDef; value: any; onChange: (v: any) => void }) {
  if (def.type === 'toggle') return <Toggle label={def.label} value={!!value} onChange={onChange} help={def.help} />;
  if (def.type === 'number')
    return (
      <div class="field row" style={{ justifyContent: 'space-between' }}>
        <label>{def.label}</label>
        <Stepper value={Number(value ?? def.default)} min={def.min ?? 0} max={def.max ?? 99} step={def.step} onChange={onChange} />
      </div>
    );
  return (
    <div class="field">
      <label>{def.label}</label>
      <select class="plain" value={String(value ?? def.default)} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {(def.choices ?? []).map((c) => (
          <option value={c.value}>{c.label}</option>
        ))}
      </select>
      {def.help && <div class="help">{def.help}</div>}
    </div>
  );
}

export function OptionsForm({ game, options, onChange }: { game: GameModule; options: GameOptions; onChange: (o: GameOptions) => void }) {
  const visible = game.options.filter((d) => !d.showIf || d.showIf(options));
  const basic = visible.filter((d) => !d.advanced);
  const adv = visible.filter((d) => d.advanced);
  const set = (k: string, v: any) => onChange({ ...options, [k]: v });
  return (
    <div>
      {basic.map((d) => (
        <OptionField def={d} value={options[d.key]} onChange={(v) => set(d.key, v)} />
      ))}
      {adv.length > 0 && (
        <details class="adv">
          <summary>Options avancées</summary>
          {adv.map((d) => (
            <OptionField def={d} value={options[d.key]} onChange={(v) => set(d.key, v)} />
          ))}
        </details>
      )}
    </div>
  );
}

export function PresetPicker({ game, options, onChange }: { game: GameModule; options: GameOptions; onChange: (o: GameOptions) => void }) {
  if (!game.presets?.length) return null;
  const isSel = (p: NonNullable<GameModule['presets']>[number]) => Object.entries(p.options).every(([k, v]) => options[k] === v);
  return (
    <div class="preset-grid">
      {game.presets.map((p) => (
        <button type="button" class={'preset' + (isSel(p) ? ' sel' : '')} onClick={() => onChange({ ...defaultKeep(game, options), ...p.options })}>
          <b>
            {p.emoji} {p.label}
          </b>
          <small>{p.desc}</small>
        </button>
      ))}
    </div>
  );
}

// Garde thèmes et difficulté quand on change de variante, remet le reste par défaut.
function defaultKeep(game: GameModule, o: GameOptions): GameOptions {
  return { ...defaultOptions(game), packs: o.packs, difficulty: o.difficulty };
}

export function DifficultyPicker({ value, onChange }: { value?: string; onChange: (v: 'facile' | 'normal' | 'difficile') => void }) {
  const opts = [
    { v: 'facile', l: '😊 Facile' },
    { v: 'normal', l: '😎 Normal' },
    { v: 'difficile', l: '🧠 Difficile' }
  ] as const;
  return (
    <div class="chips-select">
      {opts.map((o) => (
        <button type="button" class={'chip-sel' + ((value ?? 'normal') === o.v ? ' sel' : '')} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function PackPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const packs = allPacks();
  const mix = !selected.length || selected.includes('mix');
  const toggle = (id: string) => {
    const cur = mix ? [] : selected;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange(next.length ? next : ['mix']);
  };
  const cats = [...new Set(packs.map((p) => p.category))];
  return (
    <div class="stack">
      <div class="chips-select">
        <button type="button" class={'chip-sel' + (mix ? ' sel' : '')} onClick={() => onChange(['mix'])}>
          🎲 Mix de tout
        </button>
      </div>
      {cats.map((c) => (
        <div>
          <div class="muted small" style={{ margin: '4px 0' }}>
            {CATEGORY_LABELS[c]}
          </div>
          <div class="chips-select">
            {packs
              .filter((p) => p.category === c)
              .map((p) => (
                <button type="button" class={'chip-sel' + (!mix && selected.includes(p.id) ? ' sel' : '')} onClick={() => toggle(p.id)} title={p.description}>
                  {p.emoji} {p.name} <span class="muted small">({p.items.length})</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface AISlot {
  id: string;
  personality: PersonalityId | 'random';
}

export function makeAIPlayers(slots: AISlot[], taken: Set<string> = new Set()): Player[] {
  const names = AI_NAMES.filter((n) => !taken.has(n.name)).sort(() => Math.random() - 0.5);
  const pers = [...PERSONALITIES].sort(() => Math.random() - 0.5);
  return slots.map((s, i) => {
    const n = names[i % names.length];
    const personality = s.personality === 'random' ? pers[i % pers.length].id : s.personality;
    return { id: s.id, name: n.name, avatar: n.avatar, color: COLORS[(i + 3) % COLORS.length], kind: 'ai', personality };
  });
}

export function newAISlot(): AISlot {
  return { id: uid('ai_'), personality: 'random' };
}

export function AISlots({ slots, onChange, max }: { slots: AISlot[]; onChange: (s: AISlot[]) => void; max: number }) {
  return (
    <div>
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <b>🤖 IA adversaires</b>
        <Stepper
          value={slots.length}
          min={0}
          max={max}
          onChange={(n) => {
            const next = slots.slice(0, n);
            while (next.length < n) next.push(newAISlot());
            onChange(next);
          }}
        />
      </div>
      {slots.map((s, i) => (
        <div class="player-row">
          <span>🤖 IA {i + 1}</span>
          <select class="plain" value={s.personality} onChange={(e) => onChange(slots.map((x) => (x.id === s.id ? { ...x, personality: (e.target as HTMLSelectElement).value as AISlot['personality'] } : x)))}>
            <option value="random">🎲 Personnalité au hasard</option>
            {PERSONALITIES.map((p) => (
              <option value={p.id}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
