# 🎭 Imposteur Party — Guide

Application de jeux de société (imposteur, bluff, devinettes) **100 % gratuite** :
- **Solo contre des IA** qui ont chacune une personnalité, bluffent, accusent et se défendent.
- **Un seul téléphone** : le téléphone passe de main en main.
- **Salon en ligne** avec code, **chat vocal** (de téléphone à téléphone) et chat écrit.

---

## 1. Lancer l'application sur ton ordinateur

```bash
npm install
npm run dev
```
Ouvre l'adresse affichée (ex. `http://localhost:5173`). Pour tester sur ton téléphone dans le même Wi-Fi : `npm run dev -- --host`.

## 2. Mettre l'application en ligne gratuitement (GitHub Pages)

1. Envoie ce dossier dans un dépôt GitHub (branche `main`).
2. Sur GitHub : **Settings → Pages → Source : GitHub Actions**.
3. Le fichier `.github/workflows/deploy.yml` publie le site automatiquement à chaque envoi.
4. L'adresse sera du type `https://<ton-pseudo>.github.io/<nom-du-dépôt>/`.

Sur téléphone, ouvre le site puis **« Ajouter à l'écran d'accueil »** : l'application s'installe comme une vraie appli (et marche hors ligne pour le solo).

## 3. Activer le salon en ligne (Firebase, offre gratuite « Spark »)

L'application utilise par défaut ton projet Firebase existant `anime-imposteur-689187` (voir `src/net/firebase-config.ts`).

1. Console Firebase → **Authentication → Sign-in method → Anonyme : activer**.
2. Console Firebase → **Firestore Database** doit exister (c'est déjà le cas pour ton ancienne appli).
3. Publier les règles de sécurité :
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
   Le fichier `firestore.rules` **contient tes anciennes règles + celles de la nouvelle appli** : ton ancienne application continue de fonctionner.
4. Console Firebase → **Authentication → Settings → Authorized domains** : ajoute `<ton-pseudo>.github.io`.

Ce qui passe par Firebase : uniquement la liste des joueurs du salon, l'état de la partie et le chat **pendant** la partie. Tout est effacé quand l'hôte ferme le salon. **Le son du vocal ne passe jamais par Firebase.**

## 4. (Optionnel) Cerveau IA conversationnel + relais vocal — Cloudflare Worker gratuit

Sans rien configurer, les IA utilisent leur **cerveau local** (gratuit, hors ligne, illimité). Le Worker ajoute :
- des IA qui discutent de façon encore plus naturelle (modèle Gemini, offre gratuite de Google) ;
- un relais vocal « TURN » pour les réseaux difficiles (4G, Wi-Fi d'école).

```bash
cd worker
npx wrangler login                       # compte Cloudflare gratuit, sans carte bancaire
npx wrangler secret put GEMINI_API_KEY   # clé gratuite : https://aistudio.google.com/apikey
npx wrangler deploy
```
Copie l'adresse affichée (`https://imposteur-party.<toi>.workers.dev`) dans l'appli : **Réglages → Cerveau IA → Adresse du Worker**, puis « Tester la connexion ».

Relais vocal (optionnel) : dans le tableau de bord Cloudflare → *Realtime → TURN*, crée une clé, puis :
```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_KEY_API_TOKEN
npx wrangler deploy
```
Les quotas gratuits (Gemini, Cloudflare, Firebase) suffisent largement pour jouer entre amis. Ils peuvent évoluer : si un quota est dépassé, l'appli revient automatiquement au cerveau local.

## 5. Les jeux

| Famille | Jeux |
|---|---|
| 🎭 Trouver l'imposteur | L'Imposteur (17 variantes : classique, undercover, aveugle, Mr. White, conscient, faux indice, plusieurs imposteurs, deux équipes, paire cachée, manche piège, emojis, lettre imposée, mots interdits, élimination, chaos, chrono éclair, mode enquêteur), La Question Piège, Le Caméléon, L'Espion du lieu, L'Artiste Imposteur |
| 🧠 Devine mon personnage | Devine mon personnage (20 questions), Le Génie devin, Carte sur le front, Indices progressifs, Lettre par lettre, Emoji Quiz, Qui est-ce ? |
| 🤥 Qui ment ? | Le Faux Fan, 2 vérités 1 mensonge |
| 🐺 Rôles cachés | Loup-Garou (voyante, garde, bouffon, complice) |
| ⚔️ Duels & débats | Qui gagnerait ?, Tu préfères ?, Tier list |
| ⚡ Jeux rapides | Un seul indice (coopératif) |

Options transversales : rebondissements surprise 🌪️, mode émission (présentateur qui parle), campagne solo (12 niveaux), défi du jour, badges, packs de thèmes personnalisés partageables par code.

**Thèmes** : anime (personnages, séries, pouvoirs), films, séries, dessins animés, jeux vidéo, super-héros, football, sport, célébrités, musique, histoire, pays & lieux, nourriture, animaux, métiers, objets, marques… + tes propres packs.

## 6. Les IA

Chaque IA ne voit **que sa propre carte** et ce qui est public (indices, chat). Elle :
- déduit le mot de la majorité à partir des indices, et **se rend compte si c'est elle l'undercover** ;
- bluffe quand elle est imposteur, accuse, se défend, suit ou contredit les autres ;
- lit le chat (y compris ta voix transcrite avec le bouton 🎙️) et te répond quand tu la mentionnes ;
- parle à voix haute (synthèse vocale du navigateur) avec une voix différente par personnalité.

10 personnalités : Parano, Discret, Bluffeur, Leader, Suiveur, Chaotique, Intello, Blagueur, Timide, Compétitif.

## 7. Structure du code

```
src/
  core/      moteur commun (types, hôte de partie, hasard, texte)
  content/   packs de thèmes + lieux, questions, dilemmes
  games/     un module par jeu (règles, vue de chaque joueur, IA, plateau)
  ai/        personnalités, voix, cerveau IA en ligne (optionnel)
  net/       salon Firebase, synchronisation, chat vocal WebRTC
  app/       écrans (accueil, catalogue, réglages, salon, partie…)
  ui/        composants et styles
worker/      Cloudflare Worker (cerveau IA + relais vocal)
```
Ajouter un thème = ajouter un fichier dans `src/content/packs/`. Ajouter un jeu = écrire un module `GameModule` (voir `src/core/types.ts`) et l'ajouter dans `src/games/index.ts`.
