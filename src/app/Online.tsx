// Salon en ligne : créer / rejoindre, lobby (joueurs, IA, choix du jeu, vocal, chat), partie.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { TopBar } from './TopBar';
import { go, showToast, type Controller } from './state';
import { settings } from './settings';
import { Avatar, Btn, Card, Section } from '../ui/components';
import { Chat } from './Chat';
import { GameScreen } from './GameScreen';
import { Catalog } from './Catalog';
import { AISlots, DifficultyPicker, OptionsForm, PackPicker, PresetPicker, defaultOptions, makeAIPlayers, type AISlot } from './forms';
import { getGame, GAMES } from '../games';
import type { Player } from '../core/types';
import { RoomClient, memberToPlayer } from '../net/room';
import { OnlineClientController, OnlineHostController } from '../net/controllers';
import { VoiceMesh } from '../net/voice';
import { explainError, isConfigured } from '../net/firebase';

// Salon courant (survit aux changements d'écran).
const current = signal<{ rc: RoomClient; voice: VoiceMesh } | null>(null);

export function pendingJoinCode(): string | null {
  const m = location.search.match(/[?&]salon=([A-Z0-9]{4,6})/i);
  return m ? m[1].toUpperCase() : null;
}

export function OnlineScreen() {
  const s = settings.signal.value;
  const [code, setCode] = useState(pendingJoinCode() ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const profile = { name: s.name.trim() || 'Joueur', avatar: s.avatar };

  const enter = async (fn: () => Promise<RoomClient>) => {
    if (!s.name.trim()) {
      setErr('Choisis d’abord un pseudo (ci-dessous).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const rc = await fn();
      current.value = { rc, voice: new VoiceMesh(rc) };
      if (pendingJoinCode()) history.replaceState(null, '', location.pathname);
      go({ name: 'room', code: rc.code });
    } catch (e) {
      setErr(explainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TopBar title="🌐 Salon en ligne" back={() => go({ name: 'home' })} />
      <div class="screen">
        {!isConfigured() && <p class="pill bad">Firebase n’est pas configuré : voir GUIDE.md.</p>}
        <Card>
          <div class="field">
            <label>Ton pseudo</label>
            <div class="row gap">
              <span class="icon-btn" style={{ fontSize: '1.4rem' }}>
                {s.avatar}
              </span>
              <input class="plain grow" maxLength={16} value={s.name} placeholder="Pseudo" onInput={(e) => settings.set({ name: (e.target as HTMLInputElement).value })} />
            </div>
          </div>
        </Card>
        <Section title="Créer un salon">
          <p class="muted small">Tu seras l’hôte : tu choisis les jeux, ajoutes des IA et lances les parties. Partage le code à tes amis.</p>
          <Btn big disabled={busy} onClick={() => enter(() => RoomClient.create(profile, 'imposteur', defaultOptions(getGame('imposteur')!)))}>
            ✨ Créer un salon
          </Btn>
        </Section>
        <Section title="Rejoindre un salon">
          <div class="tinput">
            <input placeholder="CODE" value={code} maxLength={6} style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800 }} onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())} />
            <Btn disabled={busy || code.trim().length < 4} onClick={() => enter(() => RoomClient.join(code, profile))}>
              Rejoindre
            </Btn>
          </div>
        </Section>
        {err && <p class="pill bad">{err}</p>}
        {busy && <p class="muted">Connexion…</p>}
        <Card class="section">
          <b>Comment ça marche ?</b>
          <ul class="muted small">
            <li>Le salon sert juste à se retrouver : il est effacé quand l’hôte le ferme.</li>
            <li>Le vocal passe directement de téléphone à téléphone (WebRTC), gratuitement.</li>
            <li>Le chat écrit n’est pas conservé après la partie.</li>
            <li>L’hôte peut ajouter autant d’IA qu’il veut.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function RoomScreen({ code }: { code: string }) {
  const cur = current.value;
  if (!cur || cur.rc.code !== code) {
    return (
      <div>
        <TopBar title={`Salon ${code}`} back={() => go({ name: 'online' })} />
        <div class="screen">
          <p class="muted">Tu n’es plus connecté à ce salon.</p>
          <Btn onClick={() => go({ name: 'online' })}>Retour</Btn>
        </div>
      </div>
    );
  }
  return <Room rc={cur.rc} voice={cur.voice} />;
}

function Room({ rc, voice }: { rc: RoomClient; voice: VoiceMesh }) {
  const room = rc.room.value;
  const members = rc.activeMembers();
  const isHost = rc.isHost;
  const [ctrl, setCtrl] = useState<Controller | null>(null);
  const [picking, setPicking] = useState(false);
  const [slots, setSlots] = useState<AISlot[]>([]);
  const ctrlRef = useRef<Controller | null>(null);
  ctrlRef.current = ctrl;

  // Salon fermé par l'hôte
  useEffect(() => {
    if (rc.closed.value) {
      showToast('Le salon a été fermé par l’hôte.');
      void quit(false);
    }
  }, [rc.closed.value]);

  // L'invité suit l'état de la partie décidé par l'hôte
  useEffect(() => {
    if (!room || isHost) return;
    if (room.status === 'playing' && room.players) {
      const game = getGame(room.gameId);
      if (!game) return;
      if (!ctrlRef.current || (ctrlRef.current as any).gameNo !== room.gameNo) {
        ctrlRef.current?.stop();
        const c = new OnlineClientController(rc, game, room.players, { gameId: game.id, options: room.options, mode: 'online' });
        (c as any).gameNo = room.gameNo;
        setCtrl(c);
      }
    } else if (room.status === 'lobby' && ctrlRef.current) {
      ctrlRef.current.stop();
      setCtrl(null);
    }
  }, [room?.status, room?.gameNo, isHost]);

  useEffect(() => () => ctrlRef.current?.stop(), []);

  const quit = async (confirmFirst = true) => {
    if (confirmFirst && !confirm(isHost ? 'Fermer le salon pour tout le monde ?' : 'Quitter le salon ?')) return;
    ctrlRef.current?.stop();
    await voice.leave().catch(() => {});
    await rc.leave().catch(() => {});
    current.value = null;
    go({ name: 'home' });
  };

  if (!room) {
    return (
      <div>
        <TopBar title={`Salon ${rc.code}`} back={() => quit()} />
        <p class="screen muted">Chargement du salon…</p>
      </div>
    );
  }

  const game = getGame(room.gameId) ?? GAMES[0];
  const aiPlayers: Player[] = room.ais ?? [];
  const total = members.length + aiPlayers.length;

  const startGame = async () => {
    const humans = members.map(memberToPlayer);
    const players = [...humans, ...aiPlayers];
    if (players.length < game.minPlayers) return showToast(`Il faut au moins ${game.minPlayers} joueurs (ajoute des IA).`);
    if (players.length > game.maxPlayers) return showToast(`Maximum ${game.maxPlayers} joueurs pour ce jeu.`);
    ctrlRef.current?.stop();
    const seed = Math.floor(Math.random() * 1e9);
    await rc.clearChat().catch(() => {});
    await rc.update({ status: 'playing', players, gameNo: (room.gameNo ?? 0) + 1, seed });
    const c = new OnlineHostController(rc, game, players, { gameId: game.id, options: room.options, mode: 'online' }, seed);
    setCtrl(c);
  };

  const backToLobby = async () => {
    ctrlRef.current?.stop();
    setCtrl(null);
    await rc.update({ status: 'lobby' });
  };

  const voiceBar = <VoiceBar voice={voice} />;

  if (ctrl) {
    return (
      <GameScreen
        key={ctrl.id}
        ctrl={ctrl}
        voice={voiceBar}
        speaking={voice.speaking.value}
        onLeave={() => (isHost ? backToLobby() : quit())}
        onReplay={isHost ? startGame : undefined}
        onChangeGame={isHost ? backToLobby : undefined}
      />
    );
  }

  if (picking && isHost) {
    return (
      <div>
        <TopBar title="Choisir le jeu" back={() => setPicking(false)} />
        <div class="screen">
          <Catalog
            mode="online"
            onPick={(gameId, preset) => {
              const g = getGame(gameId)!;
              let options = { ...defaultOptions(g), packs: room.options.packs ?? ['mix'], difficulty: room.options.difficulty ?? 'normal' };
              const p = g.presets?.find((x) => x.id === preset);
              if (p) options = { ...options, ...p.options };
              void rc.update({ gameId, options });
              setPicking(false);
            }}
          />
        </div>
      </div>
    );
  }

  const share = async () => {
    const url = `${location.origin}${location.pathname}?salon=${rc.code}`;
    const text = `Rejoins mon salon Imposteur Party ! Code : ${rc.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Imposteur Party', text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        showToast('Lien copié !');
      }
    } catch {
      /* annulé */
    }
  };

  return (
    <div>
      <TopBar title={`🌐 Salon ${rc.code}`} back={() => quit()} right={<button class="icon-btn" onClick={share}>📤</button>} />
      <div class="screen">
        <div class="room-code" onClick={share}>
          {rc.code}
        </div>
        <p class="muted small center">Partage ce code (ou le lien 📤) à tes amis.</p>
        {voiceBar}
        <div class="game-layout">
          <div>
            <Section title={`Joueurs (${total})`}>
              <Card>
                {members.map((m) => (
                  <div class="player-row">
                    <span class={'avatar' + (voice.speaking.value.has(m.uid) ? ' speaking' : '')} style={{ width: 36, height: 36, fontSize: 20, borderColor: m.color }}>
                      {m.avatar}
                    </span>
                    <b class="grow" style={{ color: m.color }}>
                      {m.name} {m.uid === room.host ? '👑' : ''} {m.uid === rc.uid ? '(toi)' : ''}
                    </b>
                    {m.voice && <span title="Dans le vocal">🎧</span>}
                    {isHost && m.uid !== rc.uid && (
                      <button class="icon-btn" onClick={() => rc.kick(m.uid)} title="Retirer">
                        ✖
                      </button>
                    )}
                  </div>
                ))}
                {aiPlayers.map((p) => (
                  <div class="player-row">
                    <Avatar p={p} size={36} />
                    <b class="grow" style={{ color: p.color }}>
                      {p.name} <span class="ai-badge">IA</span>
                    </b>
                  </div>
                ))}
              </Card>
              {isHost && (
                <Card class="section">
                  <AISlots
                    slots={slots.length === aiPlayers.length ? slots : aiPlayers.map((p) => ({ id: p.id, personality: p.personality ?? 'random' }))}
                    max={Math.max(0, game.maxPlayers - members.length)}
                    onChange={(next) => {
                      setSlots(next);
                      const keep = new Map(aiPlayers.map((p) => [p.id, p]));
                      const fresh = makeAIPlayers(
                        next.filter((s) => !keep.has(s.id) || keep.get(s.id)!.personality !== s.personality),
                        new Set([...members.map((m) => m.name), ...aiPlayers.map((p) => p.name)])
                      );
                      const ais = next.map((s) => {
                        const k = keep.get(s.id);
                        return k && (s.personality === 'random' || k.personality === s.personality) ? k : fresh.find((f) => f.id === s.id)!;
                      });
                      void rc.update({ ais });
                    }}
                  />
                </Card>
              )}
            </Section>

            <Section title="Jeu" right={isHost && <Btn kind="ghost" onClick={() => setPicking(true)}>Changer</Btn>}>
              <Card>
                <h3>
                  {game.emoji} {game.name}
                </h3>
                <p class="muted small">{game.tagline}</p>
                {isHost ? (
                  <HostOptions rc={rc} />
                ) : (
                  <p class="muted small">L’hôte règle la partie. Variante : {String(room.options.mode ?? '—')} · difficulté : {String(room.options.difficulty ?? 'normal')}</p>
                )}
              </Card>
            </Section>
            {isHost ? (
              <Btn big onClick={startGame} disabled={total < game.minPlayers || total > game.maxPlayers}>
                🚀 Lancer la partie ({total} joueurs)
              </Btn>
            ) : (
              <p class="muted center">En attente du lancement par l’hôte…</p>
            )}
          </div>
          <div class="game-side">
            <Chat
              messages={rc.chat.value}
              players={[...members.map(memberToPlayer), ...aiPlayers]}
              me={members.map(memberToPlayer).find((p) => p.id === rc.uid) ?? null}
              onSend={(text, kind) => void rc.sendChat({ from: rc.uid, name: rc.profile.name, text, kind })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HostOptions({ rc }: { rc: RoomClient }) {
  const room = rc.room.value!;
  const game = getGame(room.gameId)!;
  const [opts, setOpts] = useState(room.options);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => setOpts(room.options), [room.gameId]);
  const change = (o: typeof opts) => {
    setOpts(o);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void rc.update({ options: o }), 400);
  };
  return (
    <div>
      <PresetPicker game={game} options={opts} onChange={change} />
      {game.usesThemes && (
        <details class="adv">
          <summary>🎨 Thèmes</summary>
          <PackPicker selected={opts.packs ?? ['mix']} onChange={(packs) => change({ ...opts, packs })} />
        </details>
      )}
      <div style={{ margin: '10px 0' }}>
        <DifficultyPicker value={opts.difficulty} onChange={(difficulty) => change({ ...opts, difficulty })} />
      </div>
      <details class="adv">
        <summary>⚙️ Réglages</summary>
        <OptionsForm game={game} options={opts} onChange={change} />
      </details>
    </div>
  );
}

function VoiceBar({ voice }: { voice: VoiceMesh }) {
  const on = voice.on.value;
  const supported = useMemo(() => !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined', []);
  if (!supported) return <p class="muted small">🎙️ Vocal non disponible sur ce navigateur.</p>;
  return (
    <div class="voice-bar card" style={{ padding: 10, margin: '10px 0' }}>
      {!on ? (
        <Btn kind="ok" onClick={() => voice.join()}>
          🎙️ Rejoindre le vocal
        </Btn>
      ) : (
        <>
          <button class={'icon-btn' + (voice.muted.value ? ' danger' : ' on')} onClick={() => voice.toggleMute()}>
            {voice.muted.value ? '🔇 Micro coupé' : '🎤 Micro ouvert'}
          </button>
          <button class="icon-btn" onClick={() => voice.leave()}>
            📴 Quitter le vocal
          </button>
        </>
      )}
      <span class="voice-status">{voice.status.value}</span>
    </div>
  );
}
