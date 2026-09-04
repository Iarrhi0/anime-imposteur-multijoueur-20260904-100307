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


function uniquePick(botName, choices){
  const mem=getMem(botName);
  const usable=choices.filter(Boolean).filter(x=>!mem.lastReplies.includes(x));
  const pool=usable.length?usable:choices.filter(Boolean);
  if(!pool.length)return null;
  const reply=pick(pool);
  mem.lastReplies=[reply,...mem.lastReplies].slice(0,12);
  return reply;
}

function playerHintMap(hints){
  const map=new Map();
  for(const h of hints){
    if(!map.has(h.playerName))map.set(h.playerName,[]);
    map.get(h.playerName).push(h);
  }
  return map;
}

function latestHintOf(hints,name){
  return [...hints].reverse().find(h=>h.playerName===name);
}

function findMostQuestionableHint(botName,botCharacter,hints){
  const own=new Set(keywordsFor(botCharacter).map(norm));
  const others=hints.filter(h=>h.playerName!==botName);

  let best=null;
  let bestScore=-Infinity;

  for(const h of others){
    let score=0;
    const w=norm(h.word);
    if(!own.has(w))score+=2;
    if(String(h.word||"").length<=4)score+=.4;
    if(["classe","cool","fort","bien","style","rapide","calme","noir","puissant"].includes(w))score+=.8;

    if(score>bestScore){
      best=h;
      bestScore=score;
    }
  }

  return best;
}

function clipHuman(text,maxWords=24){
  const parts=String(text||"").trim().split(/\s+/);
  return parts.slice(0,maxWords).join(" ");
}

function explicitTargetName(text,participants=[]){
  const t=norm(text);
  return participants.find(p=>t.includes(norm(p.name)))?.name||null;
}

function looksLikeDefenseDemand(text,botName){
  const t=norm(text);
  const n=norm(botName);
  return (
    t.includes(n) &&
    (
      /defend/.test(t) ||
      /repond/.test(t) ||
      /explique/.test(t) ||
      /argument/.test(t) ||
      /tu dis rien/.test(t) ||
      /tu ne dis rien/.test(t)
    )
  );
}

function looksLikeAccusation(text,botName){
  const t=norm(text);
  const n=norm(botName);
  return (
    t.includes(n) &&
    (
      /c.?est .*imposteur/.test(t) ||
      /c.?est .*suspect/.test(t) ||
      /je crois que c.?est/.test(t) ||
      /je pense que c.?est/.test(t) ||
      /je vote/.test(t) ||
      /suspect/.test(t) ||
      /imposteur/.test(t)
    )
  );
}

function argumentativeDefense(botName,botCharacter,hints,participants=[]){
  const ownHint=latestHintOf(hints,botName);
  const weak=findMostQuestionableHint(botName,botCharacter,hints);

  if(!ownHint){
    return uniquePick(botName,[
      "Je n’ai même pas encore joué. Attendez mon indice avant de m’accuser.",
      "Laissez-moi donner mon indice d’abord, après vous pourrez juger.",
      "Vous m’accusez avant mon tour. Attendez au moins mon indice."
    ]);
  }

  if(weak){
    return uniquePick(botName,[
      `Si, je me défends. Mon « ${ownHint.word} » est cohérent ; « ${weak.word} » de ${weak.playerName} est plus vague.`,
      `Pourquoi moi ? J’ai donné « ${ownHint.word} ». Je trouve « ${weak.word} » de ${weak.playerName} plus suspect.`,
      `Mon « ${ownHint.word} » tient. ${weak.playerName}, explique plutôt ton « ${weak.word} ».`,
      `Je me défends : « ${ownHint.word} » colle bien. Le mot « ${weak.word} » me convainc beaucoup moins.`
    ]);
  }

  return uniquePick(botName,[
    `Je me défends : mon indice « ${ownHint.word} » est cohérent avec ce que j’ai.`,
    `Pourquoi moi ? « ${ownHint.word} » n’est pas un indice au hasard.`,
    `Mon indice « ${ownHint.word} » a une vraie logique. Je ne vais pas révéler davantage.`
  ]);
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
  if(!last)return null;

  const text=String(last.text||"").trim();
  const t=norm(text);
  const recentHints=hints.slice(-20);
  const ownHint=latestHintOf(recentHints,botName);
  const weak=findMostQuestionableHint(botName,botCharacter,recentHints);
  const target=explicitTargetName(text,participants);

  // Update suspicion memory from actual clues.
  const ownWords=new Set(keywordsFor(botCharacter).map(norm));
  for(const h of recentHints){
    if(h.playerName===botName)continue;
    const key=h.playerName||h.playerId;
    const mismatch=ownWords.has(norm(h.word)) ? -1 : 1;
    mem.suspects[key]=(mem.suspects[key]||0)+mismatch;
  }

  const suspects=Object.entries(mem.suspects).sort((a,b)=>b[1]-a[1]);
  const topSuspect=suspects[0]?.[0]||weak?.playerName||null;

  const roundComplete=!!context.roundComplete;

  const asksOwnHint =
    /\b(ton|votre)\s+(indice|mot)\b/i.test(text) ||
    /\b(donne|dis|rappelle).*(le tien|ton|votre)\b/i.test(text) ||
    /\btu as mis quoi\b/i.test(text);

  const asksWhy =
    /\bpourquoi\b/i.test(text) &&
    (
      t.includes(norm(botName)) ||
      /\bton\b/i.test(text) ||
      (ownHint && t.includes(norm(ownHint.word)))
    );

  const asksSuspect =
    /\b(qui|lequel|laquelle).*(suspect|imposteur)/i.test(text) ||
    /\btu (suspectes?|soupçonnes?)\s+qui/i.test(text) ||
    /\btu (penses|crois).*(qui|imposteur)/i.test(text);

  const asksVote =
    /\b(on vote|voter|vote maintenant|tu veux voter)\b/i.test(text);

  const directDefense =
    looksLikeDefenseDemand(text,botName) ||
    looksLikeAccusation(text,botName);

  // Human says their own clue.
  let sharedWord=null;
  const shared=text.match(
    /(?:mon indice|mon mot|le mien)\s*(?:c.?est|est|=|:)?\s*[«"']?([A-Za-zÀ-ÿ-]{2,22})/i
  );
  if(shared)sharedWord=shared[1];

  // 1. Direct accusation / demand to defend => ARGUMENT, don't say "Quoi ?"
  if(directDefense){
    return clipHuman(
      argumentativeDefense(botName,botCharacter,recentHints,participants),
      28
    );
  }

  // 2. Asked for own clue.
  if(asksOwnHint){
    if(ownHint){
      return uniquePick(botName,[
        `J’ai mis « ${ownHint.word} ».`,
        `Mon indice, c’est « ${ownHint.word} ».`,
        `J’ai donné « ${ownHint.word} ».`
      ]);
    }
    return uniquePick(botName,[
      "J’ai pas encore donné mon indice.",
      "Pas encore, mon tour n’est pas passé."
    ]);
  }

  // 3. Asked why.
  if(asksWhy){
    if(!ownHint){
      return uniquePick(botName,["J’ai pas encore joué.","Attends mon indice d’abord."]);
    }

    if(weak){
      return clipHuman(uniquePick(botName,[
        `J’ai choisi « ${ownHint.word} » parce que ça colle bien au mien. Je trouve « ${weak.word} » plus difficile à justifier.`,
        `« ${ownHint.word} » a une logique pour moi. Je veux surtout entendre ${weak.playerName} expliquer « ${weak.word} ».`,
        `Je voulais rester vague avec « ${ownHint.word} », sans être hors sujet.`
      ]),26);
    }

    return uniquePick(botName,[
      `Parce que « ${ownHint.word} » correspond bien au mien sans trop révéler.`,
      `Je voulais donner quelque chose de juste sans rendre le personnage évident.`
    ]);
  }

  // 4. Human shares own clue -> react to that exact clue.
  if(sharedWord){
    const close=ownWords.has(norm(sharedWord));
    if(close){
      return uniquePick(botName,[
        `« ${sharedWord} », oui, je vois le rapport.`,
        `Ton « ${sharedWord} » me paraît cohérent.`,
        `Je comprends « ${sharedWord} ». Pour l’instant ça me choque pas.`
      ]);
    }

    return uniquePick(botName,[
      `« ${sharedWord} », j’aimerais bien que tu l’expliques.`,
      `Je vois moins le lien avec « ${sharedWord} ».`,
      `Ton « ${sharedWord} » me paraît assez vague pour l’instant.`
    ]);
  }

  // 5. Ask who bot suspects -> give a reason based on clues.
  if(asksSuspect){
    if(topSuspect){
      const suspectHint=latestHintOf(recentHints,topSuspect);
      if(suspectHint){
        return clipHuman(uniquePick(botName,[
          `Pour l’instant ${topSuspect}. Son « ${suspectHint.word} » me paraît moins cohérent.`,
          `Je surveille ${topSuspect}, surtout à cause de « ${suspectHint.word} ».`,
          `${topSuspect} pour le moment. J’attends une meilleure explication de « ${suspectHint.word} ».`
        ]),22);
      }
      return uniquePick(botName,[
        `Pour l’instant, ${topSuspect}.`,
        `Je surveille surtout ${topSuspect}.`
      ]);
    }
    return uniquePick(botName,[
      "J’ai pas encore assez d’éléments.",
      "Pas de suspect clair pour l’instant."
    ]);
  }

  // 6. Vote discussion.
  if(asksVote){
    if(roundComplete){
      return uniquePick(botName,[
        topSuspect ? `Oui. Si on vote maintenant, je regarde surtout ${topSuspect}.` : "Oui, là on peut voter.",
        "On a assez d’indices pour tenter un vote."
      ]);
    }
    return uniquePick(botName,[
      "Pas encore. Je veux au moins entendre les prochains indices.",
      "J’attendrais encore un peu avant de voter."
    ]);
  }

  // 7. Someone accuses another player. Bot can agree/disagree with a reason.
  if(target && target!==botName && /(c.?est|suspect|imposteur|je crois|je pense)/i.test(text)){
    const th=latestHintOf(recentHints,target);
    if(th){
      const suspicious = topSuspect===target || (weak && weak.playerName===target);
      if(suspicious){
        return clipHuman(uniquePick(botName,[
          `Je comprends. Son « ${th.word} » me fait douter aussi.`,
          `Possible. « ${th.word} » est justement un des indices que je trouve faibles.`,
          `Oui, ${target} est aussi dans mes suspects à cause de « ${th.word} ».`
        ]),22);
      }

      return clipHuman(uniquePick(botName,[
        `Je suis pas encore convaincu pour ${target}. Son « ${th.word} » peut se défendre.`,
        `Peut-être, mais « ${th.word} » ne suffit pas pour moi.`,
        `J’attendrais avant d’accuser ${target}.`
      ]),20);
    }
  }

  // 8. Direct mention with no clear intent: answer naturally, but not "Quoi ?" every time.
  if(mentioned(text,botName)){
    return uniquePick(botName,[
      "Oui, je t’écoute.",
      "Vas-y, dis-moi.",
      "Je t’écoute. Qu’est-ce qui te paraît suspect ?",
      "Oui ? Tu veux que j’explique quoi ?"
    ]);
  }

  // 9. Proactive contextual reaction: ask about an actual clue.
  if(weak && Math.random()<.45){
    return uniquePick(botName,[
      `${weak.playerName}, explique ton « ${weak.word} ».`,
      `Je veux comprendre le « ${weak.word} » de ${weak.playerName}.`,
      `Le « ${weak.word} » de ${weak.playerName} me paraît vague.`
    ]);
  }

  // 10. Otherwise, silence is more human than another generic repeated sentence.
  return null;
}

export function shouldBotReply(botName,lastMessage,messages=[]){
  if(!lastMessage)return false;
  const text=String(lastMessage.text||"");
  const t=norm(text);

  // Always respond if directly named.
  if(mentioned(text,botName))return true;

  // High priority game intents.
  const important =
    /\b(ton indice|ton mot|le tien|pourquoi|qui.*suspect|qui.*imposteur|on vote|voter|imposteur|suspect)\b/i.test(text);

  if(important)return Math.random()<.72;

  // Normal chatter: bots often stay silent.
  return Math.random()<.18;
}

export function botReplyDelay(botName,lastMessage){
  const direct=lastMessage && mentioned(lastMessage.text,botName);
  const base=direct?550:900;
  return base + Math.floor(Math.random()*(direct?900:1700));
}
