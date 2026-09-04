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
  const clean=v=>` ${norm(v).replace(/[^a-z0-9]+/g," ").trim()} `;
  return clean(text).includes(clean(name));
}
function containsAny(text,arr){
  const t=norm(text);return arr.some(x=>t.includes(norm(x)));
}


const SAFE_HINTS=new Set([
  "calme","rapide","puissant","génie","chef","combat","secret","froid",
  "prodige","héros","mentor","clan","sabre","noir","rouge","famille",
  "précision","discipline","intelligent","loyal","réservé"
]);

export function resetBotMemory(){
  memory.clear();
}

export function keywordsFor(character){
  return KEYWORDS[character] || [
    "Calme","Puissant","Rapide","Connu","Sombre","Combat",
    "Génie","Chef","Secret","Élite","Déterminé","Loyal"
  ];
}

function level(diff){
  const d=norm(diff);
  if(d.includes("expert"))return 3;
  if(d.includes("diffic"))return 2;
  return 1;
}

function suspicionScores(botCharacter,hints,participants,botName){
  const own=new Set(keywordsFor(botCharacter).map(norm));
  const scores=new Map();
  participants.forEach(p=>{if(p.name!==botName)scores.set(p.name,0)});

  // Recompute from scratch: the same clue is never counted several times.
  for(const h of hints){
    if(h.playerName===botName || !scores.has(h.playerName))continue;
    const w=norm(h.word);
    let s=own.has(w)?-1.3:1.25;
    if(["classe","cool","style","fort","bien","normal"].includes(w))s+=.75;
    scores.set(h.playerName,(scores.get(h.playerName)||0)+s);
  }
  return [...scores.entries()].sort((a,b)=>b[1]-a[1]);
}

function outsiderChance(character,hints,botName){
  const own=new Set(keywordsFor(character).map(norm));
  const others=hints.filter(h=>h.playerName!==botName);
  if(others.length<3)return .18;
  const mismatch=others.filter(h=>!own.has(norm(h.word))).length/others.length;
  return Math.max(.08,Math.min(.90,.10+mismatch*.76));
}

export function chooseAdaptiveBotHint(
  character,usedWords=[],hints=[],botName="IA",difficulty="Normal"
){
  const used=new Set(usedWords.map(norm));
  const base=keywordsFor(character);
  let available=base.filter(w=>!used.has(norm(w)));
  if(!available.length)available=[...base];

  const lvl=level(difficulty);
  const outsider=outsiderChance(character,hints,botName);

  // A smarter potential impostor becomes deliberately less specific.
  if(lvl>=2 && outsider>.55){
    const safe=available.filter(w=>SAFE_HINTS.has(norm(w)));
    if(safe.length)available=safe;
  }
  if(lvl===3 && available.length>4){
    available=available.slice(0,Math.max(3,available.length-2));
  }
  return pick(available)||"Calme";
}

export function chooseBotVote(
  botId,botCharacter,participants,hints,messages=[],difficulty="Normal"
){
  const me=participants.find(p=>p.id===botId);
  const name=me?.name||"IA";
  const scores=suspicionScores(botCharacter,hints,participants,name);
  const lvl=level(difficulty);
  const chat=new Map();

  if(lvl>=2){
    for(const m of messages.slice(-20)){
      for(const p of participants){
        if(p.id===botId)continue;
        if(mentioned(m.text,p.name)&&/(suspect|imposteur|c.?est|je crois|je pense)/i.test(m.text)){
          chat.set(p.name,(chat.get(p.name)||0)+.35);
        }
      }
    }
  }

  let best=[],max=-Infinity;
  for(const p of participants){
    if(p.id===botId)continue;
    const base=scores.find(x=>x[0]===p.name)?.[1]||0;
    const noise=Math.random()*(lvl===1?1.5:.55);
    const score=base+(chat.get(p.name)||0)+noise;
    if(score>max+.15){max=score;best=[p.id]}
    else if(Math.abs(score-max)<=.15)best.push(p.id);
  }
  return pick(best)||participants.find(p=>p.id!==botId)?.id;
}

export function botVoteApproval(
  botCharacter,hints,messages,botName="IA",difficulty="Normal"
){
  const lvl=level(difficulty);
  const tranches=new Set(hints.map(h=>h.round)).size;
  const outsider=outsiderChance(botCharacter,hints,botName);
  let confidence=.25+Math.min(.36,tranches*.10)+Math.min(.16,hints.length*.012);
  confidence+=lvl===3?.10:lvl===2?.05:0;
  if(outsider>.62)confidence+=.07;
  return Math.random()<Math.min(.90,confidence);
}

function uniquePick(botName,choices){
  const mem=getMem(botName);
  const clean=choices.filter(Boolean);
  const fresh=clean.filter(x=>!mem.lastReplies.includes(x));
  const reply=pick(fresh.length?fresh:clean);
  if(!reply)return null;
  mem.lastReplies=[reply,...mem.lastReplies].slice(0,14);
  return reply;
}
function latestHint(hints,name){
  return [...hints].reverse().find(h=>h.playerName===name);
}
function questionableHint(botName,character,hints){
  const own=new Set(keywordsFor(character).map(norm));
  let best=null,max=-Infinity;
  for(const h of hints){
    if(h.playerName===botName)continue;
    let s=own.has(norm(h.word))?-1:1.3;
    if(["classe","cool","style","fort","bien","normal"].includes(norm(h.word)))s+=.8;
    if(s>max){max=s;best=h}
  }
  return best;
}
function defense(botName,character,hints){
  const mine=latestHint(hints,botName);
  const weak=questionableHint(botName,character,hints);
  if(!mine){
    return uniquePick(botName,[
      "Attendez mon indice avant de m’accuser.",
      "Je n’ai même pas encore joué. Jugez après mon indice.",
      "Vous m’accusez avant mon tour."
    ]);
  }
  if(weak){
    return uniquePick(botName,[
      `Je me défends : mon « ${mine.word} » est cohérent. « ${weak.word} » de ${weak.playerName} me paraît plus vague.`,
      `Pourquoi moi ? J’ai donné « ${mine.word} ». ${weak.playerName} doit surtout expliquer « ${weak.word} ».`,
      `Mon « ${mine.word} » tient. Le « ${weak.word} » de ${weak.playerName} me convainc moins.`,
      `Je ne suis pas d’accord. « ${mine.word} » a une logique ; « ${weak.word} » est bien moins précis.`
    ]);
  }
  return uniquePick(botName,[
    `Mon indice « ${mine.word} » a une logique. Je ne peux pas en dire beaucoup plus.`,
    `Pourquoi moi ? « ${mine.word} » n’est pas un mot au hasard.`,
    `Je me défends : « ${mine.word} » colle à mon personnage.`
  ]);
}

export function buildBotDiscussion(
  botName,botCharacter,hints,messages,participants=[],context={}
){
  const last=messages[messages.length-1];
  if(!last)return null;
  const text=String(last.text||"").trim();
  const t=norm(text);
  const mine=latestHint(hints,botName);
  const weak=questionableHint(botName,botCharacter,hints);
  const lvl=level(context.difficulty||"Normal");
  const scores=suspicionScores(botCharacter,hints,participants,botName);
  const suspect=scores[0]?.[0]||weak?.playerName||null;
  const outsider=outsiderChance(botCharacter,hints,botName);
  const direct=mentioned(text,botName);

  const asksOwn=
    /\b(ton|votre)\s+(indice|mot)\b/i.test(text) ||
    /\b(donne|dis|rappelle).*(le tien|ton|votre)\b/i.test(text) ||
    /\btu as mis quoi\b/i.test(text);
  const asksWhy=/\bpourquoi\b/i.test(text)&&(direct||/\bton\b/i.test(text)||(mine&&t.includes(norm(mine.word))));
  const asksSuspect=
    /\b(qui|lequel|laquelle).*(suspect|imposteur)/i.test(text) ||
    /\btu (suspectes?|soupçonnes?)\s+qui/i.test(text) ||
    /\btu (penses|crois).*(qui|imposteur)/i.test(text);
  const asksVote=/\b(on vote|voter|vote maintenant|tu veux voter)\b/i.test(text);
  const asksDefense=direct&&/(defend|défend|repond|répond|explique|argument|tu dis rien|tu ne dis rien|imposteur|suspect|c.?est toi|je crois que c.?est|je pense que c.?est)/i.test(text);

  let sharedWord=null;
  const shared=text.match(/(?:mon indice|mon mot|le mien)\s*(?:c.?est|est|=|:)?\s*[«"']?([A-Za-zÀ-ÿ-]{2,22})/i);
  if(shared)sharedWord=shared[1];

  if(asksDefense){
    if(lvl>=3&&outsider>.62&&mine){
      return uniquePick(botName,[
        defense(botName,botCharacter,hints),
        `Je garde « ${mine.word} ». Je préfère analyser vos indices plutôt que trop révéler le mien.`
      ]);
    }
    return defense(botName,botCharacter,hints);
  }

  if(asksOwn){
    if(mine)return uniquePick(botName,[
      `J’ai mis « ${mine.word} ».`,
      `Mon indice, c’est « ${mine.word} ».`,
      `J’ai donné « ${mine.word} ».`
    ]);
    return uniquePick(botName,["Je n’ai pas encore joué.","Mon tour n’est pas encore passé."]);
  }

  if(asksWhy){
    if(!mine)return "Je n’ai pas encore joué.";
    if(weak&&lvl>=2)return uniquePick(botName,[
      `« ${mine.word} » correspond bien au mien. J’aimerais surtout comprendre « ${weak.word} » de ${weak.playerName}.`,
      `Je voulais rester assez vague avec « ${mine.word} ». « ${weak.word} » me paraît plus étrange.`,
      `« ${mine.word} » a une logique sans trop révéler.`
    ]);
    return uniquePick(botName,[
      `Parce que « ${mine.word} » correspond au mien sans trop révéler.`,
      `Je voulais être juste sans rendre le personnage évident.`
    ]);
  }

  if(sharedWord){
    const own=new Set(keywordsFor(botCharacter).map(norm));
    return own.has(norm(sharedWord))
      ? uniquePick(botName,[`« ${sharedWord} », oui, je comprends.`,`Ton « ${sharedWord} » me paraît cohérent.`])
      : uniquePick(botName,[`« ${sharedWord} », explique ton idée.`,`Je vois moins le lien avec « ${sharedWord} ».`]);
  }

  if(asksSuspect){
    if(suspect){
      const h=latestHint(hints,suspect);
      if(h)return uniquePick(botName,[
        `Pour l’instant ${suspect}. Son « ${h.word} » me paraît moins cohérent.`,
        `Je surveille ${suspect}, surtout à cause de « ${h.word} ».`,
        `${suspect} pour le moment. J’attends une meilleure explication de « ${h.word} ».`
      ]);
      return `Pour l’instant ${suspect}.`;
    }
    return uniquePick(botName,["Je n’ai pas encore de suspect clair.","Pas assez d’éléments pour trancher."]);
  }

  if(asksVote){
    const enough=(context.tranche||1)>=2||hints.length>=participants.length*2;
    return enough
      ? uniquePick(botName,[suspect?`On peut tenter. Je regarde surtout ${suspect}.`:"Oui, on a déjà pas mal d’indices.","Je suis prêt à voter si la majorité veut."])
      : uniquePick(botName,["J’attendrais encore une tranche.","Pas encore. Je veux quelques indices de plus."]);
  }

  for(const p of participants){
    if(p.name===botName)continue;
    if(mentioned(text,p.name)&&/(suspect|imposteur|c.?est|je crois|je pense)/i.test(text)){
      const h=latestHint(hints,p.name);
      if(h&&suspect===p.name)return uniquePick(botName,[
        `Je comprends. Son « ${h.word} » me fait douter aussi.`,
        `Possible. « ${h.word} » est justement un indice faible.`,
        `${p.name} est aussi dans mes suspects à cause de « ${h.word} ».`
      ]);
      if(h)return uniquePick(botName,[
        `Je ne suis pas encore convaincu pour ${p.name}. « ${h.word} » peut se défendre.`,
        `Peut-être, mais « ${h.word} » ne suffit pas pour moi.`
      ]);
    }
  }

  if(direct)return uniquePick(botName,[
    "Oui, je t’écoute.",
    "Vas-y, qu’est-ce qui te paraît suspect ?",
    "Je t’écoute. Tu veux que j’explique quoi ?"
  ]);

  if(lvl>=2&&weak&&Math.random()<.30)return uniquePick(botName,[
    `${weak.playerName}, explique ton « ${weak.word} ».`,
    `Je veux comprendre le « ${weak.word} » de ${weak.playerName}.`,
    `Le « ${weak.word} » de ${weak.playerName} me paraît vague.`
  ]);

  return null;
}

export function shouldBotReply(botName,lastMessage,messages=[],difficulty="Normal"){
  if(!lastMessage)return false;
  const text=String(lastMessage.text||"");
  if(mentioned(text,botName))return true;
  const important=/\b(ton indice|ton mot|le tien|pourquoi|qui.*suspect|qui.*imposteur|on vote|voter|imposteur|suspect)\b/i.test(text);
  if(important)return Math.random()<(level(difficulty)>=2?.76:.58);
  return Math.random()<(level(difficulty)>=3?.22:.13);
}

export function botReplyDelay(botName,lastMessage,difficulty="Normal"){
  const direct=lastMessage&&mentioned(lastMessage.text,botName);
  const lvl=level(difficulty);
  return Math.max(320,(direct?420:700)+Math.floor(Math.random()*(direct?850:1250))-(lvl-1)*80);
}
