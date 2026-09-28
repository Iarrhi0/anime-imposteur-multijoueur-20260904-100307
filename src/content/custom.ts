// Packs personnalisés : enregistrés sur le téléphone (localStorage), partageables par code.
import type { Item, Pack } from './types';
import { keywords, norm } from '../core/text';

const KEY = 'ip_custom_packs_v1';

export function loadCustomPacks(): Pack[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Pack[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && Array.isArray(p.items)) : [];
  } catch {
    return [];
  }
}

export function saveCustomPacks(packs: Pack[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(packs));
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export function upsertCustomPack(pack: Pack): void {
  const list = loadCustomPacks().filter((p) => p.id !== pack.id);
  list.push(pack);
  saveCustomPacks(list);
}

export function deleteCustomPack(id: string): void {
  saveCustomPacks(loadCustomPacks().filter((p) => p.id !== id));
}

/**
 * Format texte simple, une ligne par élément :
 *   Nom | tag1, tag2, tag3 | indice 1 ; indice 2 ; indice 3
 * Seul le nom est obligatoire.
 */
export function parseItems(text: string): Item[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, tagsRaw = '', cluesRaw = ''] = line.split('|').map((s) => s.trim());
      const tags = tagsRaw
        .split(',')
        .map((t) => norm(t).replace(/\s+/g, '-'))
        .filter(Boolean);
      const clues = cluesRaw
        .split(';')
        .map((c) => c.trim())
        .filter(Boolean);
      return {
        name,
        emoji: '⭐',
        tags: tags.length ? tags : keywords(name),
        clues: clues.length ? clues : ['Élément de ce pack perso']
      } satisfies Item;
    })
    .filter((i) => i.name);
}

export function itemsToText(items: Item[]): string {
  return items.map((i) => [i.name, i.tags.join(', '), i.clues.join(' ; ')].join(' | ')).join('\n');
}

export function buildPack(name: string, emoji: string, text: string, id?: string): Pack {
  const items = parseItems(text);
  const counts = new Map<string, number>();
  items.forEach((i) => i.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const attributes = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([tag]) => ({ tag, question: `Est-ce « ${tag.replace(/-/g, ' ')} » ?` }));
  return {
    id: id ?? 'perso-' + Date.now().toString(36),
    name: name || 'Mon pack',
    emoji: emoji || '⭐',
    category: 'perso',
    description: 'Pack personnalisé',
    attributes,
    items
  };
}

/** Code de partage : JSON compact encodé en base64 (sans serveur). */
export function exportPackCode(pack: Pack): string {
  const json = JSON.stringify({ n: pack.name, e: pack.emoji, t: itemsToText(pack.items) });
  return 'IP1:' + btoa(unescape(encodeURIComponent(json)));
}

export function importPackCode(code: string): Pack | null {
  try {
    const raw = code.trim().replace(/^IP1:/, '');
    const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
    const pack = buildPack(data.n, data.e, data.t);
    return pack.items.length ? pack : null;
  } catch {
    return null;
  }
}
