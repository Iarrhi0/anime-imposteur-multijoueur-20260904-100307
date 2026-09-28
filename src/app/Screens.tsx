// Écrans secondaires : réglages, packs perso, campagne, badges.
import { useState } from 'preact/hooks';
import { settings } from './settings';
import { go, showToast } from './state';
import { TopBar } from './TopBar';
import { Btn, Card, Section } from '../ui/components';
import { Toggle } from './forms';
import { testBrain } from '../ai/llm';
import { canListen, canSpeak, speak } from '../ai/speech';
import { buildPack, deleteCustomPack, exportPackCode, importPackCode, itemsToText, loadCustomPacks, upsertCustomPack } from '../content/custom';
import type { Pack } from '../content/types';
import { LEVELS } from './campaign';
import { BADGES, loadStats } from './stats';
import { getGame } from '../games';
import { PERSONALITIES } from '../ai/personalities';

export function SettingsScreen() {
  const s = settings.signal.value;
  const [testing, setTesting] = useState(false);
  return (
    <div>
      <TopBar title="⚙️ Réglages" back={() => go({ name: 'home' })} />
      <div class="screen">
        <Section title="🔊 Voix et sons">
          <Card>
            <Toggle label="Les IA parlent à voix haute" value={s.aiVoice} onChange={(v) => settings.set({ aiVoice: v })} help={canSpeak() ? 'Synthèse vocale gratuite du navigateur' : 'Non disponible sur ce navigateur'} />
            <Toggle label="🎙️ Mode émission : le présentateur commente" value={s.narratorVoice} onChange={(v) => settings.set({ narratorVoice: v })} />
            <Toggle label="Effets sonores" value={s.sounds} onChange={(v) => settings.set({ sounds: v })} />
            <Toggle label="Animations (confettis…)" value={s.animations} onChange={(v) => settings.set({ animations: v })} />
            <Btn kind="ghost" onClick={() => speak('Bienvenue dans Imposteur Party ! Qui sera l’imposteur ce soir ?')}>
              Tester la voix
            </Btn>
            <p class="muted small">
              {canListen() ? '✅ Ce navigateur peut transcrire ta voix : active 🎙️ dans le chat pendant une partie pour que les IA t’entendent.' : '⚠️ La transcription de la voix n’est pas disponible ici (utilise Chrome sur Android ou PC).'}
            </p>
          </Card>
        </Section>

        <Section title="🧠 Cerveau IA conversationnel (optionnel)">
          <Card>
            <p class="muted small">
              Sans réglage, les IA utilisent leur cerveau local : gratuit, hors ligne et illimité. Pour des discussions encore plus naturelles, colle ici l’adresse de ton Cloudflare Worker gratuit (voir le guide
              dans le dossier <code>worker/</code>). Ta clé reste cachée dans le Worker.
            </p>
            <div class="field">
              <label>Adresse du Worker</label>
              <input class="plain" placeholder="https://imposteur-party.xxx.workers.dev" value={s.brainUrl} onInput={(e) => settings.set({ brainUrl: (e.target as HTMLInputElement).value.trim() })} />
            </div>
            <Toggle label="Utiliser le cerveau IA en ligne" value={s.brainOn} onChange={(v) => settings.set({ brainOn: v })} help="Si le quota gratuit est épuisé, retour automatique au cerveau local." />
            <Btn
              kind="ghost"
              disabled={!s.brainUrl || testing}
              onClick={async () => {
                setTesting(true);
                try {
                  const t = await testBrain(s.brainUrl);
                  showToast('✅ Le cerveau répond : ' + t.slice(0, 80));
                } catch (e) {
                  showToast('❌ Pas de réponse du Worker : ' + String((e as Error).message));
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? 'Test…' : 'Tester la connexion'}
            </Btn>
          </Card>
        </Section>

        <Section title="📡 Chat vocal : serveur relais (optionnel)">
          <Card>
            <p class="muted small">
              Le vocal passe directement de téléphone à téléphone. Sur certains réseaux (4G, Wi-Fi d’école), un relais « TURN » est nécessaire. Le Worker du dossier <code>worker/</code> peut en fournir un
              gratuitement : il est utilisé automatiquement si l’adresse du Worker est remplie. Tu peux aussi saisir un serveur TURN manuellement.
            </p>
            <div class="field">
              <label>URL TURN</label>
              <input class="plain" placeholder="turn:exemple.com:3478" value={s.turnUrl} onInput={(e) => settings.set({ turnUrl: (e.target as HTMLInputElement).value.trim() })} />
            </div>
            <div class="row gap">
              <input class="plain grow" placeholder="Identifiant" value={s.turnUser} onInput={(e) => settings.set({ turnUser: (e.target as HTMLInputElement).value })} />
              <input class="plain grow" placeholder="Mot de passe" type="password" value={s.turnPass} onInput={(e) => settings.set({ turnPass: (e.target as HTMLInputElement).value })} />
            </div>
          </Card>
        </Section>

        <Section title="🤖 Les personnalités des IA">
          <div class="stack">
            {PERSONALITIES.map((p) => (
              <Card>
                <b>
                  {p.emoji} {p.label}
                </b>
                <p class="muted small">{p.desc}</p>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

export function PacksScreen() {
  const [packs, setPacks] = useState<Pack[]>(loadCustomPacks());
  const [edit, setEdit] = useState<{ id?: string; name: string; emoji: string; text: string } | null>(null);
  const [code, setCode] = useState('');
  const refresh = () => setPacks(loadCustomPacks());

  if (edit) {
    return (
      <div>
        <TopBar title="✏️ Éditer un pack" back={() => setEdit(null)} />
        <div class="screen">
          <div class="row gap">
            <input class="plain" style={{ maxWidth: 70 }} value={edit.emoji} maxLength={4} onInput={(e) => setEdit({ ...edit, emoji: (e.target as HTMLInputElement).value })} />
            <input class="plain grow" placeholder="Nom du pack (ex. Ma classe)" value={edit.name} onInput={(e) => setEdit({ ...edit, name: (e.target as HTMLInputElement).value })} />
          </div>
          <div class="field">
            <label>Éléments (un par ligne)</label>
            <div class="help">
              Format : <code>Nom | tag1, tag2 | indice 1 ; indice 2</code> — seul le nom est obligatoire. Les tags servent aux IA et aux questions oui/non.
            </div>
            <textarea class="plain" value={edit.text} placeholder={'Kevin | blagueur, grand, lunettes | Toujours en retard ; Adore le foot\nSarah | sportive, rire | Capitaine de l’équipe'} onInput={(e) => setEdit({ ...edit, text: (e.target as HTMLTextAreaElement).value })} />
          </div>
          <Btn
            big
            onClick={() => {
              const p = buildPack(edit.name, edit.emoji, edit.text, edit.id);
              if (p.items.length < 4) return showToast('Ajoute au moins 4 éléments.');
              upsertCustomPack(p);
              refresh();
              setEdit(null);
              showToast('Pack enregistré ✅');
            }}
          >
            Enregistrer
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="✏️ Mes packs" back={() => go({ name: 'home' })} />
      <div class="screen">
        <p class="muted">Crée tes propres thèmes (tes amis, ta classe, vos blagues…). Ils sont enregistrés sur ce téléphone et se partagent avec un code, sans serveur.</p>
        <Btn big onClick={() => setEdit({ name: '', emoji: '⭐', text: '' })}>
          + Nouveau pack
        </Btn>
        <Section title="Mes packs">
          {packs.length === 0 && <p class="muted">Aucun pack pour l’instant.</p>}
          <div class="stack">
            {packs.map((p) => (
              <Card>
                <div class="row gap">
                  <b class="grow">
                    {p.emoji} {p.name} <span class="muted small">({p.items.length} éléments)</span>
                  </b>
                  <button class="icon-btn" onClick={() => setEdit({ id: p.id, name: p.name, emoji: p.emoji, text: itemsToText(p.items) })}>
                    ✏️
                  </button>
                  <button
                    class="icon-btn"
                    onClick={() => {
                      const c = exportPackCode(p);
                      navigator.clipboard?.writeText(c).then(
                        () => showToast('Code copié ! Envoie-le à tes amis.'),
                        () => prompt('Copie ce code :', c)
                      );
                    }}
                  >
                    📤
                  </button>
                  <button
                    class="icon-btn danger"
                    onClick={() => {
                      if (confirm(`Supprimer « ${p.name} » ?`)) {
                        deleteCustomPack(p.id);
                        refresh();
                      }
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
        <Section title="Importer un pack reçu">
          <div class="tinput">
            <input placeholder="Colle le code IP1:…" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
            <Btn
              onClick={() => {
                const p = importPackCode(code);
                if (!p) return showToast('Code invalide.');
                upsertCustomPack(p);
                setCode('');
                refresh();
                showToast(`Pack « ${p.name} » importé ✅`);
              }}
            >
              Importer
            </Btn>
          </div>
        </Section>
      </div>
    </div>
  );
}

export function CampaignScreen() {
  const stats = loadStats();
  return (
    <div>
      <TopBar title="🗺️ Campagne" back={() => go({ name: 'home' })} />
      <div class="screen">
        <p class="muted">Gagne chaque niveau pour débloquer le suivant. Les IA deviennent de plus en plus rusées !</p>
        {LEVELS.map((l) => {
          const done = stats.campaign >= l.n;
          const locked = l.n > stats.campaign + 1;
          const g = getGame(l.gameId);
          return (
            <div class={'level' + (done ? ' done' : '') + (locked ? ' locked' : '')} onClick={() => !locked && go({ name: 'setup', mode: 'solo', gameId: l.gameId, campaignLevel: l.n })}>
              <span class="lv-num">{done ? '✅' : locked ? '🔒' : l.n}</span>
              <span class="grow">
                <b>{l.title}</b>
                <div class="muted small">
                  {g?.emoji} {g?.name} — {l.desc}
                </div>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatsScreen() {
  const s = loadStats();
  return (
    <div>
      <TopBar title="🏅 Badges & stats" back={() => go({ name: 'home' })} />
      <div class="screen">
        <Card>
          <div class="row gap" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <h2>{s.played}</h2>
              <span class="muted small">parties</span>
            </div>
            <div>
              <h2>{s.wins}</h2>
              <span class="muted small">victoires</span>
            </div>
            <div>
              <h2>{s.played ? Math.round((s.wins / s.played) * 100) : 0}%</h2>
              <span class="muted small">réussite</span>
            </div>
            <div>
              <h2>{s.bestStreak}</h2>
              <span class="muted small">meilleure série</span>
            </div>
          </div>
        </Card>
        <Section title="Badges">
          <div class="row gap">
            {BADGES.map((b) => (
              <div class={'badge' + (b.ok(s) ? '' : ' locked')} title={b.desc}>
                <span class="b-emoji">{b.emoji}</span>
                <b>{b.name}</b>
                <span class="muted">{b.desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Par jeu">
          <div class="stack">
            {Object.entries(s.byGame).map(([id, g]) => {
              const game = getGame(id);
              return (
                <div class="row gap">
                  <span class="grow">
                    {game?.emoji} {game?.name ?? id}
                  </span>
                  <span class="muted">
                    {g.wins}/{g.played} victoires
                  </span>
                </div>
              );
            })}
            {!Object.keys(s.byGame).length && <p class="muted">Joue ta première partie !</p>}
          </div>
        </Section>
      </div>
    </div>
  );
}
