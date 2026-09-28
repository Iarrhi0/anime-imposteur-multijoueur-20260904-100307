// Écran de jeu commun à tous les modes (solo, un téléphone, en ligne).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { BaseView, ChatMsg, Player } from '../core/types';
import { Avatar, Btn, Confetti } from '../ui/components';
import { Chat } from './Chat';
import { settings } from './settings';
import { sessionScores, showToast, type Controller } from './state';
import { personality } from '../ai/personalities';
import { speak, speakAs, stopSpeaking } from '../ai/speech';
import { sfx } from '../ui/sounds';
import { completeLevel, recordGame } from './stats';
import { TopBar } from './TopBar';

export interface GameScreenProps {
  ctrl: Controller;
  onLeave: () => void;
  onReplay?: () => void;
  onChangeGame?: () => void;
  /** Barre vocale (salon en ligne). */
  voice?: ComponentChildren;
  speaking?: Set<string>;
}

const BAD = ['imposteur', 'undercover', 'mrwhite', 'loup', 'complice'];

export function GameScreen({ ctrl, onLeave, onReplay, onChangeGame, voice, speaking }: GameScreenProps) {
  const [, force] = useState(0);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [sender, setSender] = useState<string | null>(null);
  const spoken = useRef(new Set<string>());
  const lastPhase = useRef<string>('');
  const recorded = useRef(false);

  useEffect(() => {
    const un = ctrl.subscribe(() => force((n) => n + 1));
    const t = setInterval(() => force((n) => n + 1), 500);
    // les messages déjà présents ne sont pas relus
    ctrl.chat().forEach((m) => spoken.current.add(m.id));
    return () => {
      un();
      clearInterval(t);
      stopSpeaking();
    };
  }, [ctrl]);

  const players = ctrl.players;
  const humans = ctrl.localHumans;
  const pub = ctrl.getView(null);
  const multi = ctrl.kind === 'local' && humans.length > 1;

  // ---- Qui regarde l'écran ? (pass-and-play) ----
  let viewer: string | null = humans[0] ?? null;
  let gateFor: string | null = null;
  if (multi && pub) {
    const need = pub.needs.filter((id) => humans.includes(id));
    if (need.length) {
      if (confirmed === need[0]) viewer = need[0];
      else {
        gateFor = need[0];
        viewer = null;
      }
    } else viewer = peek && peek !== '__choose' ? peek : null;
  }
  const view: BaseView | null = ctrl.getView(viewer) ?? pub;
  const me = players.find((p) => p.id === viewer) ?? null;
  const chatSender = players.find((p) => p.id === (sender ?? viewer ?? humans[0])) ?? null;

  // ---- Voix, sons, fin de partie ----
  const chat = ctrl.chat();
  useEffect(() => {
    const s = settings.get();
    for (const m of chat) {
      if (spoken.current.has(m.id)) continue;
      spoken.current.add(m.id);
      const p = players.find((x) => x.id === m.from);
      if (m.kind === 'system') {
        if (s.narratorVoice) speak(m.text, { pitch: 0.9, rate: 1.05, voiceIdx: 0 });
      } else if (p?.kind === 'ai') {
        if (s.aiVoice) speakAs(personality(p.personality), m.text, players.indexOf(p));
      } else if (!humans.includes(m.from)) sfx.msg();
    }
  }, [chat.length, chat[chat.length - 1]?.id]);

  useEffect(() => {
    if (!view) return;
    if (view.phase !== lastPhase.current) {
      lastPhase.current = view.phase;
      if (view.phase === 'end') {
        const win = humans.some((id) => view.winners?.includes(id));
        win ? sfx.win() : sfx.lose();
        setTimeout(() => setShowEnd(true), 1400);
        if (!recorded.current) {
          recorded.current = true;
          const add: Record<string, number> = { ...sessionScores.value };
          for (const [id, n] of Object.entries(view.scores ?? {})) add[id] = (add[id] ?? 0) + Number(n);
          sessionScores.value = add;
          const reveal = (view as any).reveal as Record<string, { role: string }> | undefined;
          const wasImpostor = humans.some((id) => BAD.includes(reveal?.[id]?.role ?? ''));
          recordGame({
            gameId: ctrl.meta.gameId,
            win,
            wasImpostor,
            online: ctrl.kind !== 'local',
            withAI: players.some((p) => p.kind === 'ai'),
            daily: ctrl.meta.daily ? { date: ctrl.meta.daily, score: Number(view.scores?.[humans[0]] ?? 0) } : undefined
          });
          if (ctrl.meta.campaignLevel && win) {
            completeLevel(ctrl.meta.campaignLevel);
            showToast(`🗺️ Niveau ${ctrl.meta.campaignLevel} réussi ! Niveau suivant débloqué.`);
          }
        }
      } else if (view.phase !== 'reveal') sfx.turn();
    }
  });

  // son quand c'est à moi de jouer
  const myTurn = !!viewer && !!view?.needs.includes(viewer);
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current && ctrl.kind !== 'local') sfx.turn();
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  if (!view) {
    return (
      <div class="screen">
        <TopBar title="Chargement…" back={onLeave} />
        <p class="muted center">Connexion à la partie…</p>
      </div>
    );
  }

  const Board = ctrl.module.Board;
  const hostNow = Date.now() + ctrl.offset();
  const remaining = view.deadline ? (view.deadline - hostNow) / 1000 : null;
  const muted = !!viewer && Array.isArray((view as any).muted) && (view as any).muted.includes(viewer);

  const leave = () => {
    if (view.phase === 'end' || confirm('Quitter la partie en cours ?')) onLeave();
  };

  return (
    <div>
      <TopBar
        title={`${ctrl.module.emoji} ${ctrl.module.name}`}
        back={leave}
        right={
          multi && !gateFor ? (
            <button class="icon-btn" onClick={() => setPeek(peek ? null : '__choose')}>
              {peek ? '🙈 Masquer' : '👁️ Ma carte'}
            </button>
          ) : null
        }
      />
      <div class="screen">
        <PlayersBar players={players} view={view} speaking={speaking} />
        {voice}
        <div class="game-layout">
          <div>
            <Board view={view} me={me} players={players} remaining={remaining} local={ctrl.kind === 'local' || ctrl.isHost} dispatch={(a) => viewer && ctrl.dispatch(viewer, a)} />
            {view.phase === 'end' && !showEnd && (
              <div style={{ marginTop: 12 }}>
                <Btn big onClick={() => setShowEnd(true)}>
                  🏁 Voir les résultats
                </Btn>
              </div>
            )}
          </div>
          <div class="game-side">
            <Chat
              messages={chat}
              players={players}
              me={chatSender}
              disabled={muted}
              senders={multi ? players.filter((p) => humans.includes(p.id)) : undefined}
              onSender={setSender}
              onSend={(text, kind) => chatSender && ctrl.sendChat(chatSender.id, text, kind)}
            />
          </div>
        </div>
      </div>

      {gateFor && <Gate p={players.find((p) => p.id === gateFor)!} onOk={() => setConfirmed(gateFor)} />}
      {peek === '__choose' && (
        <div class="gate">
          <h2>Qui veut voir sa carte ?</h2>
          <p class="muted">Les autres, regardez ailleurs 👀</p>
          <div class="choose-row" style={{ justifyContent: 'center' }}>
            {players
              .filter((p) => humans.includes(p.id))
              .map((p) => (
                <button class="choose" onClick={() => setPeek(p.id)}>
                  <Avatar p={p} size={44} />
                  <span>{p.name}</span>
                </button>
              ))}
          </div>
          <Btn kind="ghost" onClick={() => setPeek(null)}>
            Annuler
          </Btn>
        </div>
      )}
      {showEnd && view.phase === 'end' && (
        <EndOverlay
          view={view}
          players={players}
          humans={humans}
          onClose={() => setShowEnd(false)}
          onReplay={onReplay}
          onChangeGame={onChangeGame}
          onLeave={onLeave}
          isHost={ctrl.isHost}
        />
      )}
    </div>
  );
}

function PlayersBar({ players, view, speaking }: { players: Player[]; view: BaseView; speaking?: Set<string> }) {
  const alive: string[] | undefined = (view as any).alive;
  return (
    <div class="players-bar">
      {players.map((p) => {
        const out = alive && !alive.includes(p.id) && !p.spectator;
        const waiting = view.needs.includes(p.id);
        return (
          <div class="pb-item" title={p.name}>
            <span class={speaking?.has(p.id) ? 'speaking-wrap' : ''}>
              <span class={'avatar' + (speaking?.has(p.id) ? ' speaking' : '') + (out ? ' dim' : '')} style={{ width: 40, height: 40, fontSize: 22, borderColor: waiting ? 'var(--warn)' : p.color }}>
                {p.avatar}
              </span>
            </span>
            <span style={{ color: p.color }}>{p.name}</span>
            <span class="score">{view.scores?.[p.id] ?? 0} pts</span>
          </div>
        );
      })}
    </div>
  );
}

function Gate({ p, onOk }: { p: Player; onOk: () => void }) {
  return (
    <div class="gate">
      <Avatar p={p} size={96} />
      <h2>📱 Passe le téléphone à {p.name}</h2>
      <p class="muted">Les autres, ne regardez pas l’écran !</p>
      <Btn big kind="ok" onClick={onOk}>
        C’est moi, {p.name} 👋
      </Btn>
    </div>
  );
}

function EndOverlay({
  view,
  players,
  humans,
  onClose,
  onReplay,
  onChangeGame,
  onLeave,
  isHost
}: {
  view: BaseView;
  players: Player[];
  humans: string[];
  onClose: () => void;
  onReplay?: () => void;
  onChangeGame?: () => void;
  onLeave: () => void;
  isHost: boolean;
}) {
  const win = humans.some((id) => view.winners?.includes(id));
  const rows = [...players].sort((a, b) => (view.scores?.[b.id] ?? 0) - (view.scores?.[a.id] ?? 0));
  const total = sessionScores.value;
  return (
    <div class="overlay">
      {win && settings.get().animations && <Confetti />}
      <div class="card pop">
        <h2 class="center">{win ? '🏆 Victoire !' : view.winners?.length ? '😵 Défaite…' : '🏁 Fin de partie'}</h2>
        <p class="summary">{view.summary}</p>
        <div class="podium">
          {rows.map((p, i) => (
            <div class={'podium-row' + (i === 0 ? ' first' : '')}>
              <span>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
              <Avatar p={p} size={30} />
              <b style={{ color: p.color }}>{p.name}</b>
              {view.winners?.includes(p.id) && <span>🏆</span>}
              <span class="pts">
                {view.scores?.[p.id] ?? 0} pts <span class="muted small">(soirée : {total[p.id] ?? 0})</span>
              </span>
            </div>
          ))}
        </div>
        <div class="stack">
          {onReplay && isHost && (
            <Btn big onClick={onReplay}>
              🔁 Rejouer
            </Btn>
          )}
          {onChangeGame && isHost && (
            <Btn big kind="ghost" onClick={onChangeGame}>
              🎲 Changer de jeu
            </Btn>
          )}
          {!isHost && <p class="muted center">L’hôte choisit la suite…</p>}
          <div class="row gap">
            <Btn kind="ghost" class="grow" onClick={onClose}>
              👀 Revoir le plateau
            </Btn>
            <Btn kind="ghost" class="grow" onClick={onLeave}>
              🏠 Quitter
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ChatMsg };
