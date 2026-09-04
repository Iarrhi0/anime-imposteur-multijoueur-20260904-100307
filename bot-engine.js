// IA locale de jeu : indices, discussion et déduction.
// Aucun service payant ni clé API.

const KEYWORDS = {
  "Itachi Uchiha":["Calme","Frère","Illusion","Sacrifice","Prodige","Corbeau","Clan","Génie","Yeux","Secret"],
  "Levi Ackerman":["Rapide","Précision","Capitaine","Lame","Soldat","Froid","Élite","Discipline","Propre","Petit"],
  "Kakashi Hatake":["Masque","Œil","Professeur","Copieur","Éclair","Calme","Ninja","Génie","Livre","Chidori"],
  "Satoru Gojo":["Yeux","Professeur","Infini","Blanc","Génie","Calme","Puissant","Bandeau","Six","Domaine"],
  "Shanks":["Rouge","Empereur","Sabre","Cicatrice","Pirate","Haki","Calme","Barbe","Bras","Capitaine"],
  "Gildarts Clive":["Rouge","Mage","Cicatrice","Voyageur","Puissant","Père","Calme","Vétéran","Destruction","Guilde"],
  "Sosuke Aizen":["Illusion","Calme","Capitaine","Manipulation","Génie","Trahison","Élégant","Plan","Hypnose","Chef"],
  "Sasuke Uchiha":["Clan","Œil","Vengeance","Foudre","Frère","Calme","Prodige","Noir","Épée","Rival"],
  "Megumi Fushiguro":["Ombre","Invocation","Clan","Calme","Prodige","Noir","Réservé","Chimères","Domaine","Loups"],
  "Kurapika":["Clan","Yeux","Vengeance","Chaîne","Calme","Prodige","Rouge","Serment","Intelligent","Survivant"],
  "Light Yagami":["Génie","Justice","Cahier","Secret","Étudiant","Manipulation","Dieu","Plan","Calme","Nom"],
  "Lelouch Lamperouge":["Génie","Empereur","Geass","Secret","Étudiant","Manipulation","Plan","Œil","Chef","Masque"],
  "Giyu Tomioka":["Calme","Sabre","Eau","Pilier","Froid","Rapide","Silencieux","Élite","Devoir","Survivant"],
  "Byakuya Kuchiki":["Calme","Noble","Sabre","Capitaine","Élégant","Froid","Clan","Rapide","Pétales","Devoir"],
  "Chrollo Lucilfer":["Calme","Chef","Livre","Voleur","Génie","Noir","Manipulation","Troupe","Secret","Élégant"],
  "Katsuki Bakugo":["Explosion","Rival","Fier","Colère","Prodige","Rapide","Héros","Blond","Puissant","Compétitif"],
  "Vegeta":["Prince","Rival","Fier","Saiyan","Colère","Prodige","Puissant","Transformation","Combat","Orgueil"],
  "Monkey D. Luffy":["Pirate","Chapeau","Capitaine","Élastique","Liberté","Sourire","Rêve","Haki","Ami","Empereur"],
  "Naruto Uzumaki":["Ninja","Hokage","Renard","Clone","Rêve","Ami","Orange","Rasengan","Chef","Déterminé"],
  "Goku":["Saiyan","Combat","Transformation","Naïf","Puissant","Kamehameha","Héros","Rapide","Faim","Entraînement"],
  "Natsu Dragneel":["Feu","Dragon","Mage","Combat","Naïf","Puissant","Guilde","Ami","Faim","Énergique"],
  "Roronoa Zoro":["Sabre","Épéiste","Vert","Loyal","Puissant","Trois","Cicatrice","Dormeur","BrasDroit","Endurance"],
  "Erza Scarlet":["Sabre","Armure","Rouge","Mage","Puissante","Élite","Guilde","Discipline","Armes","Autorité"],
  "Hisoka":["Carte","Clown","Combat","Sourire","Cruel","Bungee","Imprévisible","Magicien","Puissant","Provocateur"],
  "Donquixote Doflamingo":["Rose","Fil","Sourire","Cruel","Pirate","Chef","Manipulation","Lunettes","Puissant","Roi"],
  "Ryomen Sukuna":["Roi","Fléau","Cruel","Puissant","Domaine","Marques","Arrogant","Légendaire","Découpe","Calme"],
  "Madara Uchiha":["Légendaire","Uchiha","Guerre","Œil","Puissant","Plan","Calme","Chef","Armure","Domination"],
  "Dabi":["Feu","Bleu","Brûlure","Secret","Famille","Vilain","Froid","Cicatrice","Vengeance","Noir"],
  "Obito Uchiha":["Masque","Œil","Uchiha","Secret","Cicatrice","Espace","Plan","Guerre","Amour","Manipulation"],
  "Kyojuro Rengoku":["Feu","Pilier","Sabre","Sourire","Héros","Flamme","Mentor","Puissant","Sacrifice","Énergique"],
  "All Might":["Héros","Symbole","Sourire","Puissant","Mentor","Professeur","Force","Paix","Blond","Sacrifice"],
  "Tanjiro Kamado":["Sabre","Eau","Feu","Frère","Gentil","Démon","Odeur","Déterminé","Famille","Héros"],
  "Izuku Midoriya":["Héros","Vert","Analyse","Gentil","Déterminé","Héritage","Puissant","Étudiant","Mentor","Force"],
  "Shigeo Kageyama (Mob)":["Psychique","Calme","Élève","Puissant","Émotion","Télékinésie","Discret","Normal","Cent","Gentil"],
  "Kusuo Saiki":["Psychique","Calme","Élève","Puissant","Télékinésie","Discret","Normal","Lunettes","Secret","Télépathie"],
  "Jiraiya":["Ninja","Mentor","Crapaud","Voyageur","Livre","Sage","Blanc","Espion","Puissant","Drôle"],
  "Kisuke Urahara":["Mentor","Chapeau","Scientifique","Calme","Génie","Sabre","Secret","Boutique","Puissant","Drôle"],
  "Killua Zoldyck":["Blanc","Électricité","Assassin","Famille","Rapide","Prodige","Calme","Ami","Jeune","Griffe"],
  "Shoto Todoroki":["Glace","Feu","Famille","Prodige","Calme","Cicatrice","Étudiant","Héros","Réservé","Bicolore"],
  "Ken Kaneki":["Goule","Masque","Blanc","Noir","Transformation","Livre","Traumatisme","Puissant","Calme","Œil"],
  "Eren Yeager":["Titan","Liberté","Transformation","Guerre","Colère","Héros","Traumatisme","Chef","Déterminé","Mur"]
};

function normalized(word){
  return String(word||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

export function keywordsFor(character){
  return KEYWORDS[character] || ["Calme","Puissant","Rapide","Connu","Sombre","Combat","Génie","Chef"];
}

export function chooseBotHint(character, usedWords=[]){
  const used = new Set(usedWords.map(normalized));
  const pool = keywordsFor(character);
  const fresh = pool.filter(w=>!used.has(normalized(w)));
  const choice = (fresh.length?fresh:pool)[Math.floor(Math.random()*(fresh.length?fresh.length:pool.length))];
  return choice || "Calme";
}

export function chooseBotVote(botId, botCharacter, participants, hints){
  const ownWords = new Set(keywordsFor(botCharacter).map(normalized));
  const byPlayer = new Map();

  for(const p of participants){
    if(p.id===botId) continue;
    byPlayer.set(p.id,{score:0,count:0});
  }

  for(const h of hints){
    if(!byPlayer.has(h.playerId)) continue;
    const item = byPlayer.get(h.playerId);
    item.count++;
    // Un mot proche du propre personnage paraît moins suspect.
    item.score += ownWords.has(normalized(h.word)) ? -2 : 2;
  }

  let best = [];
  let max = -Infinity;
  for(const [id,v] of byPlayer){
    const noise = Math.random()*1.6;
    const s = v.score + noise;
    if(s>max+.2){max=s;best=[id];}
    else if(Math.abs(s-max)<=.2){best.push(id);}
  }

  if(!best.length){
    best = participants.filter(p=>p.id!==botId).map(p=>p.id);
  }
  return best[Math.floor(Math.random()*best.length)];
}

export function botVoteApproval(botCharacter, hints){
  // Plus il y a d'indices, plus une IA accepte de voter.
  const rounds = new Set(hints.map(h=>h.round)).size;
  let chance = .42 + Math.min(.35, hints.length*.025) + Math.min(.15, rounds*.05);
  if(keywordsFor(botCharacter).length>6) chance += .03;
  return Math.random() < Math.min(.9,chance);
}

export function buildBotDiscussion(botName, botCharacter, hints, messages){
  const own = new Set(keywordsFor(botCharacter).map(normalized));
  const foreign = hints.filter(h=>!own.has(normalized(h.word)));
  const recent = hints.slice(-6);
  const pool = [];

  if(foreign.length){
    const h = foreign[foreign.length-1];
    pool.push(`Pourquoi « ${h.word} » ? J'ai du mal à relier cet indice au mien.`);
    pool.push(`Je trouve « ${h.word} » assez suspect, mais je veux une explication avant de voter.`);
  }

  if(recent.length){
    const h = recent[Math.floor(Math.random()*recent.length)];
    pool.push(`L'indice « ${h.word} » peut avoir plusieurs sens. Explique un peu sans révéler ton personnage.`);
  }

  pool.push(
    "Je préfère encore écouter les explications avant de proposer un vote.",
    "Il y a au moins un indice qui me paraît beaucoup plus général que les autres.",
    "Je ne suis pas encore sûr de qui ment. Une nouvelle manche d'indices peut aider.",
    "Je regarde surtout si les explications correspondent vraiment aux mots donnés."
  );

  return pool[Math.floor(Math.random()*pool.length)];
}
