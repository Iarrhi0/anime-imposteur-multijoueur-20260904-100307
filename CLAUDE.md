# Imposteur Party — instructions pour Claude

Jeux de société (imposteur, devinettes, loup-garou…) : Vite + TypeScript + Preact, salon en ligne Firebase, vocal WebRTC, APK Android via Capacitor.
L'utilisateur parle français et a un **quota limité** : chaque action doit être utile.

## Règles d'économie (prioritaires)
- Réponses **courtes** en français, sans long récapitulatif.
- **Lecture ciblée** : `grep -n` puis seulement les lignes utiles. Ne relis pas un fichier déjà lu. Pas d'exploration générale : utilise la carte.
- **Pas de sous-agents / workflows** sauf demande explicite.
- **Une passe** : éditer → `npx tsc --noEmit -p .` → `npx vite build` → commit → push. Pas de captures ni de tests navigateur sauf demande.
- Une seule question courte si la demande est floue. Pas d'améliorations non demandées.
- Branche de travail : `imposteur-party`. Chaque push reconstruit l'APK (Releases, lien `releases/latest/download/imposteur-party.apk`).

## Carte du projet
| Chemin | Rôle |
|---|---|
| `src/core/` | Contrat des jeux (`types.ts`), hôte de partie (`host.ts`), hasard, texte |
| `src/games/deduction/` | Moteur des jeux d'imposteur (`engine.ts`), IA (`ai.ts`), plateau (`Board.tsx`) |
| `src/games/imposteur.ts`, `autres-deduction.ts` | Imposteur + Question piège, Caméléon, Espion, Artiste, Faux fan |
| `src/games/{devine,roles,mensonge,duels,rapides}/` | Autres familles de jeux ; registre dans `src/games/index.ts` |
| `src/content/packs/` | Thèmes (un fichier = un pack) ; `content/extra/` lieux, questions, dilemmes |
| `src/ai/` | Personnalités, voix (synthèse/reconnaissance), IA en ligne (`llm.ts`) |
| `src/net/` | Salon Firebase (`room.ts`), synchro (`controllers.ts`), vocal (`voice.ts`) |
| `src/app/` | Écrans : `Home`, `Catalog`, `Setup`, `GameScreen`, `Online`, `Screens`, navigation `state.ts` |
| `src/ui/` | Composants et styles |
| `.github/workflows/apk.yml` | Construction APK (Capacitor + plugin App pour le bouton retour) |
| `firestore.rules`, `worker/` | Règles Firebase, Worker Cloudflare optionnel |
