// Outils texte : normalisation, mots-clés, comparaison approximative.

const STOP = new Set(
  (
    'le la les l un une des du de d et ou a à au aux en dans sur sous avec sans pour par ce cet cette ces ' +
    'il elle ils elles on je tu nous vous me te se mon ma mes ton ta tes son sa ses leur leurs est sont ' +
    'c qu que qui quoi dont ne pas plus tres très trop bien fait faire etre être avoir ai as ont y ça ca ' +
    'moi toi lui eux mais donc car ni si oui non alors comme tout tous toute toutes quand peu beaucoup ' +
    'vraiment juste aussi encore deja déjà ici la là cest cest pense crois sais'
  ).split(/\s+/)
);

export function norm(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mots significatifs d'un texte (sans mots vides), pluriels simplifiés. */
export function keywords(s: string): string[] {
  return norm(s)
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

export function stem(w: string): string {
  if (w.length > 4 && (w.endsWith('s') || w.endsWith('x'))) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Vrai si deux textes désignent sensiblement la même chose (tolère les fautes). */
export function fuzzyEq(a: string, b: string): boolean {
  const x = norm(a).replace(/-/g, ' ');
  const y = norm(b).replace(/-/g, ' ');
  if (!x || !y) return false;
  if (x === y) return true;
  const d = levenshtein(x, y);
  return d <= Math.max(1, Math.floor(Math.max(x.length, y.length) * 0.2));
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1];
}
