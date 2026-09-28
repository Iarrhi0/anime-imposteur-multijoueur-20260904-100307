// Chat écrit (+ transcription de la voix pour que les IA entendent).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChatMsg, Player } from '../core/types';
import { Avatar } from '../ui/components';
import { settings } from './settings';
import { canListen, startListening, stopListening } from '../ai/speech';
import { showToast } from './state';

export function Chat({
  messages,
  players,
  me,
  onSend,
  disabled,
  senders,
  onSender
}: {
  messages: ChatMsg[];
  players: Player[];
  me: Player | null;
  onSend: (text: string, kind: 'chat' | 'voice') => void;
  disabled?: boolean;
  senders?: Player[];
  onSender?: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const s = settings.signal.value;
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => () => stopListening(), []);

  const toggleListen = () => {
    if (listening) {
      stopListening();
      setListening(false);
      return;
    }
    if (!canListen()) {
      showToast('La reconnaissance vocale n’est pas disponible sur ce navigateur (essaie Chrome).');
      return;
    }
    const ok = startListening((t) => sendRef.current(t, 'voice'), setListening);
    if (!ok) showToast('Impossible de démarrer le micro.');
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t, 'chat');
    setText('');
  };

  return (
    <div class="chat">
      <div class="chat-head">
        <span class="grow">💬 Discussion</span>
        <button class={'icon-btn' + (s.aiVoice ? ' on' : '')} title="Voix des IA" onClick={() => settings.set({ aiVoice: !s.aiVoice, narratorVoice: !s.aiVoice })}>
          {s.aiVoice ? '🔊' : '🔇'}
        </button>
        <button class={'icon-btn' + (listening ? ' on' : '')} title="Les IA t’écoutent (transcription de ta voix)" onClick={toggleListen}>
          {listening ? '👂' : '🎙️'}
        </button>
      </div>
      <div class="chat-list" ref={listRef}>
        {messages.length === 0 && <p class="muted small center">Les messages apparaissent ici. Les IA lisent le chat et répondent !</p>}
        {messages.map((m) => {
          const p = players.find((x) => x.id === m.from);
          const mine = !!me && m.from === me.id;
          return (
            <div class={'msg' + (mine ? ' mine' : '') + (m.kind === 'system' ? ' system' : '') + (m.kind === 'voice' ? ' voice' : '')}>
              {m.kind !== 'system' && <Avatar p={p} size={28} />}
              <div class="bubble">
                {!mine && (
                  <div class="who" style={{ color: p?.color ?? 'var(--warn)' }}>
                    {m.name}
                    {p?.kind === 'ai' ? ' 🤖' : ''}
                  </div>
                )}
                <div>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit}>
        {senders && senders.length > 1 && (
          <select class="plain" style={{ maxWidth: 110 }} value={me?.id} onChange={(e) => onSender?.((e.target as HTMLSelectElement).value)}>
            {senders.map((p) => (
              <option value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <input value={text} maxLength={300} placeholder={disabled ? '🤐 Tu es muet ce tour-ci' : 'Écris un message…'} disabled={disabled} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button class="btn" type="submit" disabled={disabled || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
