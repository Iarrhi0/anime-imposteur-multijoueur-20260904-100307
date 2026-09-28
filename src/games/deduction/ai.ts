// Cerveau local des IA pour les jeux « trouver l'imposteur ».
// Chaque IA ne voit QUE sa propre vue : son mot, les indices publics et le chat.
// Elle déduit la majorité, se rend compte si elle est l'undercover, soupçonne,
// accuse, se défend, suit ou contredit les autres selon sa personnalité.
import type { AgentAPI, AgentMind, AIStrategy, Player } from '../../core/types';
import type { Item } from '../../content/types';
import { rankByClues, textMatch } from '../../content';
import { keywords, norm } from '../../core/text';
import { line, personality, type Personality } from '../../ai/personalities';
import { isBad, type DeductionConfig, type DView, type Stroke } from './engine';

interface Mem {
  phaseKey?: string;
  said: number;
  readyAt?: number;
  actAt?: number;
  chatSus: Record<string, number>;
  pending: { kind: 'defend' | 'mentioned' | 'agree' | 'opinion'; who?: string }[];
  greeted?: boolean;
  endSaid?: boolean;
  talkAt?: number;
  lastClueSeen: number;
  answered?: Record<string, boolean>;
}

const ACCUSE = /imposteur|louche|suspect|\bsus\b|menteur|\bment\b|c est (lui|elle|toi)|je vote|votez|bizarre|grill|accuse|coupable|undercover|mr white|espion|cameleon|pas clair|hypothese|analyse|surveille|oeil|vague|colle pas|coherent|correlation|regardez|propose|elimine|perdre de temps|tete d|pointe vers|j en suis sur|c est toi/;
const DEFEND = /innocent|pas (moi|lui|elle)|confiance|clean|crois pas|je te crois|sincere/;

function names(api: AgentAPI, ids: string[]) {
  return ids.map((id) => api.players.find((p) => p.id === id)).filter(Boolean) as Player[];
}

function nameOf(api: AgentAPI, id: string) {
  return api.players.find((p) => p.id === id)?.name ?? '?';
}

export function makeDeductionAI(cfg: DeductionConfig): AIStrategy<DView> {
  return {
    think(v, mind, api) {
      const mem = (mind.mem as Mem).chatSus ? (mind.mem as Mem) : Object.assign(mind.mem, { said: 0, chatSus: {}, pending: [], lastClueSeen: 0 } as Mem);
      const me = api.me;
      const P = personality(me.personality);
      const key = `${v.phase}-${v.round}-${v.results.length}`;
      if (mem.phaseKey !== key) {
        mem.phaseKey = key;
        mem.said = 0;
        mem.actAt = undefined;
        mem.readyAt = undefined;
        mem.answered = {};
        mem.talkAt = api.now + 1500 + api.rng.int(0, 4000) * (1.2 - P.talk);
      }
      readChat(v, mind, api, mem, P);
      const k = knowledge(cfg, v, api);

      switch (v.phase) {
        case 'reveal': {
          if (v.ready.includes(me.id)) return;
          mem.readyAt ??= api.now + 1200 + api.rng.int(0, 2500);
          if (api.now >= mem.readyAt) {
            api.act({ type: 'ready' });
            if (!mem.greeted && api.rng.chance(P.talk * 0.35)) {
              mem.greeted = true;
              api.say(line(P, 'hello', api.rng));
            }
          }
          return;
        }
        case 'clues': {
          if (!v.needs.includes(me.id)) {
            maybeReactToClue(v, api, mem, P, k);
            return;
          }
          const think = { facile: 1500, normal: 2500, difficile: 3500 }[api.difficulty];
          mem.actAt ??= api.now + think + api.rng.int(0, 2500);
          if (api.now < mem.actAt) return;
          mem.actAt = undefined;
          giveClue(cfg, v, api, k, P);
          return;
        }
        case 'discussion':
          return discuss(v, api, mem, P, k);
        case 'vote': {
          if (v.voted.includes(me.id) || !v.alive.includes(me.id)) return;
          mem.actAt ??= api.now + 2000 + api.rng.int(0, 5000);
          if (api.now < mem.actAt) return;
          api.act({ type: 'vote', target: chooseVote(v, api, k, P, mem) });
          return;
        }
        case 'lastChance': {
          if (v.lastChanceFor !== me.id || v.guess) return;
          mem.actAt ??= api.now + 3000 + api.rng.int(0, 3000);
          if (api.now < mem.actAt) return;
          const guess = guessWord(v, k);
          api.say(line(P, 'lastChance', api.rng));
          api.act({ type: 'guess', text: guess });
          return;
        }
        case 'end': {
          if (mem.endSaid) return;
          mem.endSaid = true;
          if (api.rng.chance(P.talk * 0.6)) api.say(line(P, v.winners?.includes(me.id) ? 'win' : 'lose', api.rng));
          return;
        }
      }
    }
  };
}

// ---------- Raisonnement ----------

interface Knowledge {
  myItem?: Item;
  majority?: Item;
  candidates: Item[];
  /** L'IA pense être du mauvais côté (imposteur connu ou undercover deviné). */
  bad: boolean;
  allies: string[];
  innocents: string[];
  sus: Record<string, number>;
  cluesOf: Record<string, string[]>;
}

function knowledge(cfg: DeductionConfig, v: DView, api: AgentAPI): Knowledge {
  const me = api.me.id;
  const secret = v.me;
  const candidates = cfg.candidates(v.pub, api.packs);
  const myItem = secret?.word ? cfg.lookup(secret.word, v.pub, api.packs) : undefined;
  const cluesOf: Record<string, string[]> = {};
  for (const c of v.clues) {
    if (c.hidden) continue;
    if (v.kind === 'qa') {
      if (c.target && c.answer) (cluesOf[c.target] ??= []).push(c.answer);
      (cluesOf[c.pid] ??= []).push(c.text);
    } else if (c.text && !c.text.startsWith('⏱️')) (cluesOf[c.pid] ??= []).push(c.text);
  }
  const othersClues = Object.entries(cluesOf)
    .filter(([pid]) => pid !== me)
    .flatMap(([, t]) => t);

  let bad = !!secret && secret.knowsRole && isBad(secret.role);
  let majority: Item | undefined = myItem;
  if ((!myItem || bad) && candidates.length) {
    majority = othersClues.length ? rankByClues(candidates, othersClues)[0]?.item : undefined;
  } else if (myItem && candidates.length && othersClues.length >= 2 && api.difficulty !== 'facile' && v.kind !== 'answer') {
    // Suis-je l'undercover sans le savoir ? Si les indices des autres collent mieux à un autre élément…
    const ranked = rankByClues(candidates, othersClues);
    const mine = ranked.find((r) => r.item === myItem)?.score ?? 0;
    const top = ranked[0];
    const threshold = api.difficulty === 'difficile' ? 1.25 : 1.6;
    if (top && top.item !== myItem && top.score > mine * threshold + 0.6) {
      bad = true;
      majority = top.item;
    }
  }

  // Question piège : si la question révélée n'est pas la mienne, je suis l'imposteur.
  if (v.kind === 'answer' && v.pub.question && secret?.word && norm(v.pub.question) !== norm(secret.word)) bad = true;

  const allies = secret?.allies ?? [];
  const innocents = v.notes
    .map((n) => n.match(/Info secrète : (.+) est innocent/)?.[1])
    .filter(Boolean)
    .map((nm) => api.players.find((p) => p.name === nm)?.id)
    .filter(Boolean) as string[];

  const sus: Record<string, number> = {};
  for (const pid of v.alive) {
    if (pid === me) continue;
    let s = 0.3;
    const cl = cluesOf[pid] ?? [];
    if (v.kind === 'answer') s = answerSuspicion(v, pid, secret, bad);
    else if (v.kind === 'drawing') s = 0.3 + ((hash(pid + v.round + me) % 100) / 100) * 0.3;
    else if (majority && cl.length) s = cl.reduce((acc, c) => acc + (1 - textMatch(c, majority!)), 0) / cl.length;
    else if (cl.length === 0) s = 0.35;
    s += (api.difficulty === 'facile' ? 0.25 : 0.1) * ((hash(pid + me) % 100) / 100 - 0.5);
    sus[pid] = s;
  }
  for (const id of [...allies, ...innocents]) if (sus[id] !== undefined) sus[id] = -1;
  return { myItem, majority, candidates, bad, allies, innocents, sus, cluesOf };
}

function answerSuspicion(v: DView, pid: string, secret: DView['me'], iAmBad: boolean): number {
  const c = v.clues.find((x) => x.pid === pid && !x.hidden && x.round === v.round) ?? v.clues.filter((x) => x.pid === pid).pop();
  if (!c || !secret?.answerHint || iAmBad) return 0.4;
  const h = secret.answerHint;
  if (h.range) {
    const n = parseFloat(c.text.replace(',', '.'));
    if (Number.isNaN(n)) return 0.6;
    const [a, b] = h.range;
    if (n >= a && n <= b) return 0.2;
    const d = n < a ? (a - n) / Math.max(1, a) : (n - b) / Math.max(1, b);
    return Math.min(1, 0.5 + d);
  }
  if (h.examples?.length) return h.examples.some((e) => norm(e) === norm(c.text)) ? 0.2 : 0.55;
  return 0.4;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------- Indices ----------

function giveClue(cfg: DeductionConfig, v: DView, api: AgentAPI, k: Knowledge, P: Personality) {
  const used = new Set(v.clues.map((c) => norm(c.text)));
  if (v.kind === 'answer') {
    api.act({ type: 'clue', text: answerFor(v, api) });
    return;
  }
  if (v.kind === 'qa') return qaTurn(v, api, k);
  if (v.kind === 'drawing') {
    api.act({ type: 'clue', stroke: randomStroke(api, api.me.color), text: '' });
    return;
  }
  const target = k.bad ? k.majority ?? (v.me?.knowsRole && v.me.role === 'undercover' ? k.myItem : undefined) : k.myItem;
  const text = clueFor(v, api, target, k, used, P) ?? fallbackClue(v, api, k, used);
  api.act({ type: 'clue', text });
}

function tagWords(item: Item): string[] {
  return item.tags.map((t) => t.replace(/-/g, ' '));
}

function specificity(tag: string, pool: Item[]): number {
  return pool.filter((i) => i.tags.includes(tag.replace(/ /g, '-'))).length;
}

function clueFor(v: DView, api: AgentAPI, item: Item | undefined, k: Knowledge, used: Set<string>, P: Personality): string | null {
  const forbidden = new Set([...(v.me?.forbidden ?? []), ...(item ? keywords(item.name) : []), ...((item?.aliases ?? []).flatMap(keywords))].map(norm));
  const letter = v.pub.letter?.toLowerCase();
  const ok = (t: string) => {
    const n = norm(t);
    if (!n || used.has(n)) return false;
    if (keywords(t).some((w) => forbidden.has(w))) return false;
    if (letter && !n.startsWith(letter)) return false;
    return true;
  };
  if (v.kind === 'emoji') {
    const src = item?.emoji ?? k.candidates.slice(0, 3).map((c) => c.emoji).join('');
    const emojis = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(src)].map((x) => x.segment).filter((e) => /\p{Extended_Pictographic}/u.test(e));
    const free = emojis.filter((e) => !used.has(norm(e)) && !v.clues.some((c) => c.text.includes(e)));
    const pick = free.length ? free : emojis;
    if (!pick.length) return null;
    return api.rng.sample(pick, Math.min(pick.length, api.rng.int(1, 2))).join('');
  }
  if (!item) return null;
  const pool = k.candidates.length ? k.candidates : [item];
  let words = tagWords(item).filter(ok);
  if (letter) {
    const vocab = [...new Set([...tagWords(item), ...item.clues.flatMap((c) => c.split(/\s+/))])].filter((w) => w.length > 2 && ok(w));
    words = vocab;
  }
  if (!words.length) return null;
  // Civil : indice assez précis mais pas trop (sinon l'imposteur devine) ; imposteur : indice vague.
  const scored = words.map((w) => ({ w, n: specificity(w, pool) }));
  scored.sort((a, b) => a.n - b.n);
  let choice: string;
  if (k.bad) {
    const generic = scored.slice(Math.floor(scored.length / 2));
    choice = api.rng.pick(generic.length ? generic : scored).w;
  } else if (api.difficulty === 'facile') {
    choice = scored[0].w;
  } else {
    const mid = scored.filter((x) => x.n >= 2 && x.n <= Math.max(3, pool.length / 5));
    choice = api.rng.pick(mid.length ? mid : scored.slice(0, 3)).w;
  }
  if (v.kind === 'phrase') {
    const phrases = item.clues.filter(ok);
    if (!k.bad && phrases.length && api.rng.chance(0.6)) {
      const idx = Math.min(phrases.length - 1, api.difficulty === 'facile' ? phrases.length - 1 : v.round - 1 + api.rng.int(0, 1));
      return phrases[Math.max(0, idx)];
    }
    const tpl = P.bluff > 0.7 && k.bad
      ? ['Clairement, ça évoque {w}.', 'Je dirais : {w}, évidemment.']
      : ['Ça me fait penser à {w}.', 'Je dirais {w}.', 'Il y a un côté {w}.', 'Pour moi : {w}.'];
    return api.rng.pick(tpl).replace('{w}', choice);
  }
  // un seul mot : on garde le mot le plus parlant du tag
  const parts = choice.split(' ').filter((w) => w.length > 2 && ok(w));
  return parts.length ? parts.sort((a, b) => b.length - a.length)[0] : choice;
}

function fallbackClue(v: DView, api: AgentAPI, k: Knowledge, used: Set<string>): string {
  const counts = new Map<string, number>();
  k.candidates.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const letter = v.pub.letter?.toLowerCase();
  const generic = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t.replace(/-/g, ' '))
    .filter((t) => !used.has(norm(t)) && (!letter || norm(t).startsWith(letter)));
  if (v.kind === 'emoji') return api.rng.pick(['🤔', '✨', '🔥', '👀', '💭']);
  if (generic.length) {
    const w = api.rng.pick(generic.slice(0, 6));
    return v.kind === 'phrase' ? `Je pense à quelque chose de ${w}.` : w.split(' ')[0];
  }
  return letter ? letter.toUpperCase() + 'uper' : 'Mystère';
}

function answerFor(v: DView, api: AgentAPI): string {
  const h = v.me?.answerHint;
  if (!h) return String(api.rng.int(1, 10));
  if (h.range) {
    const [a, b] = h.range;
    return String(api.rng.int(a, b));
  }
  if (h.examples?.length) return api.rng.pick(h.examples);
  return h.answer === 'oui-non' ? api.rng.pick(['Oui', 'Non']) : 'Je sais pas';
}

function qaTurn(v: DView, api: AgentAPI, k: Knowledge) {
  const me = api.me.id;
  const qa = v.qa;
  if (!qa) return;
  const loc = k.bad ? k.majority : k.myItem;
  if (qa.asker === me && !qa.question) {
    const others = v.alive.filter((id) => id !== me);
    const target = !k.bad && api.rng.chance(0.6) ? topSuspect(k, others) ?? api.rng.pick(others) : api.rng.pick(others);
    const generic = [
      'Tu viens souvent ici ?',
      'Tu es là pour quoi exactement ?',
      'Qu’est-ce que tu portes en ce moment ?',
      'C’est bruyant d’habitude ?',
      'Tu restes combien de temps ?',
      'Il fait quel temps là où on est ?',
      'Tu es venu avec qui ?',
      'Qu’est-ce qui te plaît le plus ici ?'
    ];
    let q = api.rng.pick(generic);
    if (!k.bad && loc && api.difficulty !== 'difficile' && api.rng.chance(0.35)) {
      const kw = api.rng.pick(loc.tags).replace(/-/g, ' ');
      q = api.rng.pick([`Tu as vu le coin ${kw} ?`, `Tu penses quoi de l’ambiance ${kw} ?`, `Ça te dérange, tout ce côté ${kw} ?`]);
    }
    api.act({ type: 'clue', target, text: q });
    return;
  }
  if (qa.target === me && qa.question) {
    let ans: string;
    if (loc) {
      const kw = api.rng.pick(loc.tags).replace(/-/g, ' ');
      const role = v.me?.hint;
      ans = api.rng.pick([
        `Surtout pour le côté ${kw}.`,
        role && !k.bad ? `En tant que ${role.toLowerCase()}, je dirais que c’est normal.` : `Ça dépend du moment.`,
        `Plutôt ${kw}, franchement.`,
        `Comme d’habitude, rien de spécial… un peu ${kw}.`
      ]);
      if (k.bad && api.rng.chance(0.4)) ans = api.rng.pick(['Comme d’habitude, rien de spécial.', 'Je préfère ne pas trop en dire 😅', 'Ça dépend des jours.']);
    } else ans = api.rng.pick(['Ça dépend des jours.', 'Comme tout le monde, je pense.', 'Je préfère garder un peu de mystère 😅', 'Franchement, c’est comme d’habitude.']);
    api.act({ type: 'clue', text: ans });
  }
}

function randomStroke(api: AgentAPI, color: string): Stroke {
  const n = api.rng.int(5, 12);
  let x = 0.3 + api.rng.next() * 0.4;
  let y = 0.3 + api.rng.next() * 0.4;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    x = Math.min(0.95, Math.max(0.05, x + (api.rng.next() - 0.5) * 0.18));
    y = Math.min(0.95, Math.max(0.05, y + (api.rng.next() - 0.5) * 0.18));
    pts.push([x, y]);
  }
  return { color, pts };
}

// ---------- Débat ----------

function topSuspect(k: Knowledge, among: string[]): string | undefined {
  return among.filter((id) => k.sus[id] !== undefined && k.sus[id] >= 0).sort((a, b) => k.sus[b] - k.sus[a])[0];
}

function readChat(v: DView, mind: AgentMind, api: AgentAPI, mem: Mem, P: Personality) {
  const me = api.me;
  const myName = norm(me.name);
  for (const m of api.chat) {
    if (m.ts <= mind.lastChatSeen || m.from === me.id || m.from === 'system') continue;
    const t = norm(m.text);
    const mentioned = api.players.filter((p) => p.id !== m.from && new RegExp(`\\b${norm(p.name)}\\b`).test(t));
    const accuse = ACCUSE.test(t);
    const defend = DEFEND.test(t);
    for (const p of mentioned) {
      if (accuse) mem.chatSus[p.id] = (mem.chatSus[p.id] ?? 0) + 0.08 + 0.2 * P.follow;
      if (defend) mem.chatSus[p.id] = (mem.chatSus[p.id] ?? 0) - 0.1;
    }
    const fromHuman = api.players.find((p) => p.id === m.from)?.kind === 'human';
    mem.answered ??= {};
    if (new RegExp(`\\b${myName}\\b`).test(t)) {
      // on se défend une fois par accusateur et par phase ; on ne répond aux simples mentions que des humains
      if (accuse && !mem.answered['d' + m.from]) {
        mem.answered['d' + m.from] = true;
        mem.pending.push({ kind: 'defend', who: m.from });
      } else if (!accuse && fromHuman) mem.pending.push({ kind: 'mentioned', who: m.from });
    } else if (accuse && mentioned.length && !mem.answered['a' + m.from] && api.rng.chance(P.follow * (fromHuman ? 0.7 : 0.35))) {
      mem.answered['a' + m.from] = true;
      mem.pending.push({ kind: 'agree', who: m.from });
    } else if (fromHuman && /\?/.test(t) && /qui|vous pensez|avis|quelqu un|vous en pensez/.test(t) && api.rng.chance(0.5 + P.talk / 2)) {
      mem.pending.push({ kind: 'opinion' });
    }
  }
  if (mem.pending.length > 3) mem.pending.splice(0, mem.pending.length - 3);
  void v;
}

function effectiveSus(k: Knowledge, mem: Mem, id: string): number {
  if (k.sus[id] === undefined || k.sus[id] < 0) return -1;
  return k.sus[id] + (mem.chatSus[id] ?? 0);
}

function discuss(v: DView, api: AgentAPI, mem: Mem, P: Personality, k: Knowledge) {
  const me = api.me.id;
  if (!v.alive.includes(me)) return;
  if (v.muted.includes(me)) {
    if (!v.ready.includes(me)) api.act({ type: 'ready' });
    return;
  }
  const others = v.alive.filter((id) => id !== me && !k.allies.includes(id));
  const maxMsgs = 1 + Math.round(P.talk * 3);
  const canTalk = api.now >= (mem.talkAt ?? 0) && mem.said < maxMsgs + mem.pending.length;
  if (canTalk) {
    const msg = compose(v, api, mem, P, k, others);
    if (msg) {
      mem.said++;
      mem.talkAt = api.now + 3500 + api.rng.int(0, 6000) * (1.3 - P.talk);
      api.say(msg);
      return;
    }
  }
  const total = (v.deadline ?? api.now) - api.now;
  if (!v.ready.includes(me) && (mem.said >= 1 || total < 20_000) && api.rng.chance(0.25)) api.act({ type: 'ready' });
}

function compose(v: DView, api: AgentAPI, mem: Mem, P: Personality, k: Knowledge, others: string[]): string | null {
  const rng = api.rng;
  const byName = (id?: string) => (id ? nameOf(api, id) : '');
  const ranked = others.map((id) => ({ id, s: effectiveSus(k, mem, id) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
  const top = ranked[0];
  const conf = top ? top.s - (ranked[1]?.s ?? 0) : 0;
  // bouc émissaire quand l'IA est du mauvais côté : le plus accusé dans le chat, sinon un civil au hasard
  const scapegoat = () => {
    const accused = others.filter((id) => (mem.chatSus[id] ?? 0) > 0).sort((a, b) => (mem.chatSus[b] ?? 0) - (mem.chatSus[a] ?? 0))[0];
    return accused ?? (others.length ? rng.pick(others) : undefined);
  };

  const pend = mem.pending.shift();
  if (pend) {
    if (pend.kind === 'defend') {
      const base = line(P, 'defend', rng);
      const counter = k.bad ? scapegoat() : top?.id;
      return counter && rng.chance(P.aggro) ? `${base} ${line(P, 'suspect', rng, { name: byName(counter) })}` : base;
    }
    if (pend.kind === 'mentioned') {
      const target = k.bad ? scapegoat() : top?.id;
      return `${line(P, 'mentioned', rng, { name: byName(pend.who) })} ${target ? line(P, conf > 0.2 ? 'accuse' : 'suspect', rng, { name: byName(target) }) : line(P, 'unsure', rng)}`;
    }
    if (pend.kind === 'agree' && pend.who) {
      return rng.chance(P.follow + 0.2) ? line(P, 'agree', rng, { name: byName(pend.who) }) : line(P, 'disagree', rng, { name: byName(pend.who) });
    }
  }
  if (mem.said >= 1 + Math.round(P.talk * 3)) return null;

  if (k.bad) {
    const t = scapegoat();
    if (rng.chance(0.25 * P.bluff)) return line(P, 'bluff', rng);
    return t ? line(P, rng.chance(P.aggro) ? 'accuse' : 'suspect', rng, { name: byName(t) }) : line(P, 'unsure', rng);
  }
  if (!top) return mem.said === 0 ? line(P, 'unsure', rng) : null;
  // L'intello cite l'indice qui cloche
  const clue = k.cluesOf[top.id]?.slice(-1)[0];
  if (clue && (P.id === 'intello' || rng.chance(0.3)) && conf > 0.1) {
    return `L’indice « ${clue} » de ${byName(top.id)} ne colle pas avec le mien.`;
  }
  if (conf > 0.25 || (conf > 0.1 && rng.chance(P.aggro))) return line(P, 'accuse', rng, { name: byName(top.id) });
  if (conf > 0.08) return line(P, 'suspect', rng, { name: byName(top.id) });
  const clean = ranked[ranked.length - 1];
  if (clean && rng.chance(0.3)) return line(P, 'innocent', rng, { name: byName(clean.id) });
  return mem.said === 0 ? line(P, 'unsure', rng) : null;
}

function maybeReactToClue(v: DView, api: AgentAPI, mem: Mem, P: Personality, k: Knowledge) {
  const last = v.clues[v.clues.length - 1];
  if (!last || v.clues.length <= mem.lastClueSeen) return;
  mem.lastClueSeen = v.clues.length;
  if (last.pid === api.me.id || last.hidden || v.muted.includes(api.me.id)) return;
  if ((k.sus[last.pid] ?? 0) > 0.75 && api.rng.chance(0.18 * P.talk)) api.say(line(P, 'react', api.rng));
}

// ---------- Vote ----------

function chooseVote(v: DView, api: AgentAPI, k: Knowledge, P: Personality, mem: Mem): any {
  const me = api.me.id;
  const others = v.alive.filter((id) => id !== me && !k.allies.includes(id));
  if (!others.length) return v.alive.find((id) => id !== me);
  const s = (id: string) => (k.sus[id] ?? 0.3) + ((mem?.chatSus?.[id] ?? 0) as number);
  if (v.special === 'equipes') {
    const mine = others.slice().sort((a, b) => s(a) - s(b));
    return mine.slice(0, v.maxAllies);
  }
  if (v.special === 'paire') {
    return others.slice().sort((a, b) => s(a) - s(b))[0];
  }
  let ranked = others.slice().sort((a, b) => s(b) - s(a));
  if (k.bad) {
    // voter comme la majorité contre un innocent
    const tallyChat = others.slice().sort((a, b) => (mem?.chatSus?.[b] ?? 0) - (mem?.chatSus?.[a] ?? 0));
    ranked = tallyChat;
  }
  if (v.trapPossible && !k.bad && Math.max(...others.map((id) => k.sus[id] ?? 0)) < 0.35 && api.rng.chance(0.5)) return 'personne';
  let target = ranked[0];
  if (api.difficulty === 'facile' && api.rng.chance(0.35)) target = api.rng.pick(others);
  if (P.id === 'chaotique' && api.rng.chance(0.25)) target = api.rng.pick(others);
  if (v.voteMode === 'points') {
    const second = ranked[1] ?? target;
    return second === target ? { [target]: 3 } : { [target]: 2, [second]: 1 };
  }
  return target;
}

function guessWord(v: DView, k: Knowledge): string {
  const clues = Object.values(k.cluesOf).flat();
  if (v.guessOptions.length) {
    const opts = v.guessOptions.map((n) => k.candidates.find((c) => c.name === n) ?? ({ name: n, tags: [], clues: [], emoji: '' } as Item));
    return rankByClues(opts, clues)[0]?.item.name ?? v.guessOptions[0];
  }
  return k.majority?.name ?? rankByClues(k.candidates, clues)[0]?.item.name ?? '???';
}

export { names };
