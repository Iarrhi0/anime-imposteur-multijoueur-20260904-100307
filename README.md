# Anime Imposteur Multiplayer

Cette version ajoute un vrai lobby multijoueur au site GitHub Pages.

## Fonctionnalités

- Créer un salon
- Code de salon
- Rejoindre depuis plusieurs téléphones
- Synchronisation instantanée des joueurs
- Hôte du salon
- 3 participants minimum
- Ajout de bots IA locaux
- Choix automatique des univers
- Choix manuel des univers
- Mix d'animes
- Difficulté
- 1 seul imposteur
- Distribution secrète
- Chaque utilisateur Firebase ne peut lire que son attribution
- L'hôte peut terminer la manche et revenir au lobby

## Installation

### 1. Firebase

Double-clique sur :

`1_SETUP_FIREBASE.bat`

Le script utilise par défaut le projet déjà créé :

`anime-imposteur-689187`

S'il manque l'activation de l'API Firestore, Microsoft Edge ouvre directement la bonne page.
Clique seulement sur `ACTIVER`, puis reviens dans la fenêtre.

Le script génère ensuite automatiquement `firebase-config.js`.

### 2. GitHub Pages

Double-clique sur :

`2_PUBLISH_GITHUB.bat`

Le script :

- se connecte à GitHub
- crée un dépôt public
- pousse les fichiers
- active GitHub Pages
- lance le workflow
- ouvre GitHub Actions

Le dépôt s'appellera `anime-imposteur-multijoueur`.

## Limite importante

Cette version n'a pas de serveur de confiance.

L'hôte génère les attributions dans son navigateur avant de les écrire dans Firebase.
L'interface ne révèle rien, et les règles Firestore empêchent un joueur de lire
l'attribution d'un autre. Mais un hôte très technique pourrait inspecter la mémoire
de son propre navigateur au moment du tirage.

Pour un jeu entre amis, c'est suffisant. Pour une version compétitive, il faudrait
déplacer le tirage vers une fonction serveur.
