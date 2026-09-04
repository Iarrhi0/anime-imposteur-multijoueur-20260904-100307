// Anime Imposteur V6.4 — IA sociale locale courte et humaine.
// Pas de clé API : logique locale, mémoire légère et réponses contextuelles.

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

const PERSONAS = {
  Sakura:{style:"soft",agree:.62,accuse:.35,emoji:.12},
  Kira:{style:"detective",agree:.45,accuse:.68,emoji:.03},
  Ren:{style:"defensive",agree:.52,accuse:.48,emoji:.06},
  Yuki:{style:"casual",agree:.58,accuse:.42,emoji:.16},
  Shiro:{style:"cold",agree:.40,accuse:.72,emoji:.00},
  Aiko:{style:"friendly",agree:.66,accuse:.30,emoji:.18}
};

const memory = new Map();

function norm(v){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function getMem(name){
  if(!memory.has(name))memory.set(name,{lastReplies:[],suspects:{},lastSeenMessageId:null});
  return memory.get(name);
}
function trimReply(text,maxWords=13){
  const words=String(text).trim().split(/\s+/);
  return words.slice(0,maxWords).join(" ");
}
function addRareEmoji(text,p){
  if(Math.random()>p)return text;
  return text+" "+pick(["🤔","😅","👀"]);
}
function isQuestion(text){return /\?|pourquoi|comment|quoi|quel|quelle/i.test(text||"")}
function mentioned(text,name){
  return norm(text).includes(norm(name));
}
function containsAny(text,arr){
  const t=norm(text);return arr.some(x=>t.includes(norm(x)));
}

export function keywordsFor(character){
  return KEYWORDS[character] || ["Calme","Puissant","Rapide","Connu","Sombre","Combat","Génie","Chef"];
}

export function chooseBotHint(character,usedWords=[]){
  const used=new Set(usedWords.map(norm));
  const pool=keywordsFor(character);
  const fresh=pool.filter(w=>!used.has(norm(w)));
  // Avoid always picking the strongest clue first.
  const slice=(fresh.length?fresh:pool).slice(0,Math.max(3,Math.min(7,(fresh.length||pool.length))));
  return pick(slice)||"Calme";
}

export function chooseBotVote(botId,botCharacter,participants,hints){
  const own=new Set(keywordsFor(botCharacter).map(norm));
  const scores=new Map();

  participants.forEach(p=>{
    if(p.id!==botId)scores.set(p.id,Math.random()*1.2);
  });

  for(const h of hints){
    if(!scores.has(h.playerId))continue;
    let s=scores.get(h.playerId);
    s += own.has(norm(h.word)) ? -1.1 : 1.7;
    scores.set(h.playerId,s);
  }

  let best=null,bestScore=-Infinity;
  for(const [id,s] of scores){
    if(s>bestScore){best=id;bestScore=s}
  }
  return best || participants.find(p=>p.id!==botId)?.id;
}

export function botVoteApproval(botCharacter,hints,botName=""){
  const persona=PERSONAS[botName]||{agree:.52};
  const rounds=new Set(hints.map(h=>h.round)).size;
  const evidence=Math.min(.28,hints.length*.025)+Math.min(.12,rounds*.04);
  return Math.random() < Math.min(.9,persona.agree+evidence);
}

export function buildBotDiscussion(
  botName,
  botCharacter,
  hints,
  messages,
  participants=[],
  context={}
){
  const persona=PERSONAS[botName]||PERSONAS.Yuki;
  const mem=getMem(botName);
  const last=messages[messages.length-1];
  const text=String(last?.text||"").trim();
  const t=norm(text);
  const ownWords=keywordsFor(botCharacter);
  const recentHints=hints.slice(-12);
  const ownHint=[...recentHints].reverse().find(h=>h.playerName===botName);
  const othersHints=recentHints.filter(h=>h.playerName!==botName);

  const roundComplete=context.roundComplete ?? (
    participants.length>0 &&
    new Set(recentHints.map(h=>h.playerId)).size>=participants.length
  );

  for(const h of othersHints){
    const key=h.playerName||h.playerId;
    const mismatch=ownWords.some(w=>norm(w)===norm(h.word)) ? -1 : 1;
    mem.suspects[key]=(mem.suspects[key]||0)+mismatch;
  }

  const suspects=Object.entries(mem.suspects).sort((a,b)=>b[1]-a[1]);
  const topSuspect=suspects[0]?.[0];

  const asksOwnHint =
    /\b(ton|votre)\s+(indice|mot)\b/i.test(text) ||
    /\b(donne|dis|rappelle).*(le tien|ton|votre)\b/i.test(text) ||
    /\bc.?est quoi.*(le tien|ton).*(indice|mot)?/i.test(text) ||
    /\bquel(le)? est.*(ton|votre).*(indice|mot)/i.test(text) ||
    /\btu as mis quoi\b/i.test(text);

  const asksWhy =
    /\bpourquoi\b/i.test(text) &&
    (
      /\bton\b/i.test(text) ||
      (ownHint && t.includes(norm(ownHint.word)))
    );

  const asksSuspect =
    /\b(qui|lequel|laquelle).*(suspect|imposteur)/i.test(text) ||
    /\b(qui).*(tu ).*(suspectes?|soupçonnes?)/i.test(text) ||
    /\btu (penses|crois).*(qui|imposteur)/i.test(text) ||
    /\btu (suspectes?|soupçonnes?)\s+qui/i.test(text);

  const accusation =
    /\b(tu es|t.?es|c.?est toi).*(imposteur|suspect)\b/i.test(text) ||
    /\bje (pense|crois).*(que )?c.?est toi\b/i.test(text);

  const asksVote =
    /\b(on vote|voter|vote maintenant|tu veux voter)\b/i.test(text);

  let sharedWord=null;
  const share=text.match(
    /(?:mon indice|mon mot|le mien)\s*(?:c.?est|est|=|:)?\s*[«"']?([A-Za-zÀ-ÿ-]{2,22})/i
  );
  if(share)sharedWord=share[1];

  // "Donne-moi ton indice" => always answer the actual clue.
  if(asksOwnHint){
    if(ownHint){
      return pick([
        `J’ai mis « ${ownHint.word} ».`,
        `Mon indice, c’est « ${ownHint.word} ».`,
        `J’ai donné « ${ownHint.word} ».`
      ]);
    }
    return "J’ai pas encore donné mon indice.";
  }

  if(asksWhy){
    if(!ownHint)return "J’ai pas encore joué.";
    return pick([
      `Parce que « ${ownHint.word} » colle bien au mien.`,
      `Je voulais rester vague avec « ${ownHint.word} ».`,
      `« ${ownHint.word} » était assez juste sans trop révéler.`
    ]);
  }

  if(sharedWord){
    const close=ownWords.some(w=>norm(w)===norm(sharedWord));
    if(close){
      return pick([
        `« ${sharedWord} », oui ça colle.`,
        `Ton « ${sharedWord} » me paraît logique.`,
        `Oui, « ${sharedWord} » je comprends.`
      ]);
    }
    return pick([
      `« ${sharedWord} », c’est assez vague.`,
      `Je vois l’idée pour « ${sharedWord} ».`,
      `Hmm, « ${sharedWord} »… possible.`
    ]);
  }

  if(asksSuspect){
    if(topSuspect){
      return pick([
        `Pour l’instant, ${topSuspect}.`,
        `Je surveille surtout ${topSuspect}.`,
        `${topSuspect} me paraît le plus louche.`
      ]);
    }
    return "J’ai pas encore de suspect clair.";
  }

  if(accusation){
    return pick([
      "Non, tu me soupçonnes trop vite.",
      "Pourquoi moi ? Mon indice tient.",
      "Je pense que tu te trompes.",
      "Pas moi, regarde les indices."
    ]);
  }

  if(asksVote){
    if(roundComplete){
      return pick([
        "On peut voter si vous voulez.",
        "Oui, là on a assez d’indices.",
        "Moi je peux voter maintenant."
      ]);
    }
    return pick([
      "J’attendrais les autres indices.",
      "Pas encore, tout le monde n’a pas joué.",
      "Je préfère finir les indices d’abord."
    ]);
  }

  if(last && last.playerName!==botName && mentioned(text,botName)){
    return pick(["Oui ?","Quoi ?","Je t’écoute.","Vas-y."]);
  }

  const foreign=[...othersHints].reverse().find(
    h=>!ownWords.some(w=>norm(w)===norm(h.word))
  );

  if(foreign && Math.random()<.50){
    return pick([
      `${foreign.playerName}, explique « ${foreign.word} ».`,
      `« ${foreign.word} », je trouve ça vague.`,
      `${foreign.playerName}, ton indice me fait douter.`
    ]);
  }

  const options=roundComplete
    ? ["J’ai encore un doute.","Je regarde surtout les indices.","Pas facile de trancher.","J’ai quelqu’un en tête."]
    : ["J’attends les autres indices.","Je veux voir les prochains mots.","Pas assez d’indices pour moi.","Je préfère attendre un peu."];

  const filtered=options.filter(x=>!mem.lastReplies.includes(x));
  let reply=pick(filtered.length?filtered:options);
  reply=trimReply(reply,12);
  reply=addRareEmoji(reply,persona.emoji);

  mem.lastReplies=[reply,...mem.lastReplies].slice(0,5);
  return reply;
}

export function shouldBotReply(botName,lastMessage,messages=[]){
  const persona=PERSONAS[botName]||PERSONAS.Yuki;
  if(!lastMessage)return false;

  const text=String(lastMessage.text||"");

  if(mentioned(text,botName))return true;

  const directGameQuestion =
    /\b(ton indice|ton mot|le tien|donne.*indice|dis.*tien|pourquoi|qui.*suspect|qui.*imposteur|on vote|voter)\b/i.test(text);

  if(directGameQuestion)return Math.random()<.80;

  let chance=.16;
  if(isQuestion(text))chance+=.16;
  if(persona.style==="detective")chance+=.05;
  if(persona.style==="casual")chance+=.04;

  return Math.random()<Math.min(.50,chance);
}

export function botReplyDelay(botName,lastMessage){
  const direct=lastMessage && mentioned(lastMessage.text,botName);
  const base=direct?550:900;
  return base + Math.floor(Math.random()*(direct?900:1700));
}
