import {
  characters as localCharacters,
  chooseIntelligentPair as chooseLocalPair
} from "./ai-engine.js?v=10.0.0";

const ANILIST_ENDPOINT="https://graphql.anilist.co";
const CACHE_KEY="anime_imposteur_online_characters_v1";
const CACHE_TTL_MS=12*60*60*1000;
const RECENT_CHAR_KEY="anime_imposteur_recent_characters_v2";
const RECENT_PAIR_KEY="anime_imposteur_recent_pairs_v2";
const MAX_RECENT_CHARS=80;
const MAX_RECENT_PAIRS=200;

const localByName=new Map(localCharacters.map(c=>[norm(c.name),c]));
let memoryPool=null;

const CATEGORY_WEIGHTS={
  appearance:.12,
  personality:.22,
  role:.24,
  combat:.18,
  story:.14,
  aura:.10
};

const RULES={
  appearance:[
    ["cheveux clairs",/\b(white|silver|blond|blonde|light[- ]?colored) hair\b/i],
    ["cheveux noirs",/\b(black|dark) hair\b/i],
    ["cheveux rouges",/\b(red|crimson|scarlet) hair\b/i],
    ["cheveux longs",/\blong hair\b/i],
    ["cheveux hérissés",/\b(spiky|messy) hair\b/i],
    ["lunettes",/\bglasses|spectacles\b/i],
    ["œil ou regard particulier",/\beye(s)?\b.*\b(power|ability|special|covered|blindfold|patch)\b|\bblindfold|eyepatch\b/i],
    ["cicatrices",/\bscar|scarred\b/i],
    ["apparence imposante",/\b(tall|large|muscular|imposing)\b/i],
    ["apparence jeune",/\b(young|teenage|teenager|student)\b/i]
  ],
  personality:[
    ["calme",/\b(calm|composed|laid[- ]?back|relaxed)\b/i],
    ["réservé",/\b(reserved|quiet|introvert|silent|stoic)\b/i],
    ["énergique",/\b(energetic|lively|hyperactive|boisterous)\b/i],
    ["optimiste",/\b(optimistic|cheerful|positive|bright)\b/i],
    ["sarcastique",/\b(sarcastic|teasing|playful)\b/i],
    ["très intelligent",/\b(genius|intelligent|brilliant|smart|strategist|strategic)\b/i],
    ["calculateur",/\b(cunning|calculating|manipulative|scheming)\b/i],
    ["protecteur",/\b(protective|protects|cares deeply|guardian)\b/i],
    ["loyal",/\b(loyal|devoted|faithful)\b/i],
    ["arrogant",/\b(arrogant|proud|cocky|overconfident)\b/i],
    ["froid",/\b(cold|ruthless|merciless|emotionless)\b/i],
    ["gentil",/\b(kind|gentle|compassionate|empathetic|caring)\b/i],
    ["déterminé",/\b(determined|persistent|tenacious|strong[- ]willed)\b/i],
    ["mystérieux",/\b(mysterious|secretive|enigmatic)\b/i],
    ["excentrique",/\b(eccentric|quirky|odd|unusual)\b/i]
  ],
  role:[
    ["mentor",/\b(mentor|master|sensei|teacher|instructor)\b/i],
    ["professeur",/\b(teacher|instructor|professor|sensei)\b/i],
    ["chef",/\b(captain|commander|leader|chief|head of|guild master)\b/i],
    ["héros principal",/\b(protagonist|main protagonist|main character)\b/i],
    ["antagoniste",/\b(antagonist|villain|enemy)\b/i],
    ["rival",/\b(rival|rivalry)\b/i],
    ["prodige",/\b(prodigy|genius|talented|gifted)\b/i],
    ["assassin",/\b(assassin|hitman|killer)\b/i],
    ["épéiste",/\b(swordsman|swordswoman|swordfighter|samurai)\b/i],
    ["soldat",/\b(soldier|military|warrior|knight)\b/i],
    ["détective",/\b(detective|investigator)\b/i],
    ["scientifique",/\b(scientist|researcher|inventor)\b/i],
    ["roi ou souverain",/\b(king|queen|emperor|empress|ruler|prince|princess)\b/i],
    ["étudiant",/\b(student|school|academy)\b/i],
    ["pirate",/\bpirate\b/i],
    ["ninja",/\b(ninja|shinobi)\b/i],
    ["sorcier ou mage",/\b(sorcerer|mage|wizard|magic user|magician)\b/i]
  ],
  combat:[
    ["épée",/\b(sword|blade|katana|saber)\b/i],
    ["combat rapproché",/\b(hand[- ]to[- ]hand|martial arts|close combat|melee)\b/i],
    ["grande vitesse",/\b(speed|fast|quick|swift)\b/i],
    ["force physique",/\b(strength|strong|powerful|physical power)\b/i],
    ["feu",/\bfire|flame|burn\b/i],
    ["glace",/\bice|frost|freeze\b/i],
    ["foudre",/\blightning|electric|thunder\b/i],
    ["pouvoir psychique",/\bpsychic|telekinesis|esper|telepath\b/i],
    ["illusion",/\billusion|hypnosis|hallucination\b/i],
    ["transformation",/\btransform|transformation|form\b/i],
    ["invocation",/\bsummon|summoning|familiar\b/i],
    ["guérison",/\bheal|healing|regeneration\b/i],
    ["combat tactique",/\btactical|strategy|strategic|analy[sz]e|battle intelligence\b/i],
    ["armes à distance",/\bgun|rifle|pistol|bow|sniper|projectile\b/i]
  ],
  story:[
    ["passé tragique",/\b(tragic|tragedy|trauma|traumatic)\b/i],
    ["vengeance",/\brevenge|vengeance\b/i],
    ["perte de proches",/\b(lost|loss|death of|killed).{0,40}\b(family|friend|brother|sister|mother|father|parents|comrade)\b/i],
    ["famille difficile",/\b(family|father|mother|parents|clan).{0,40}\b(abuse|strict|conflict|problem|difficult|pressure)\b/i],
    ["orphelin ou enfance solitaire",/\borphan|orphaned|alone as a child|lonely childhood\b/i],
    ["identité secrète",/\b(secret identity|hidden identity|double life|alias)\b/i],
    ["sacrifice",/\bsacrifice|sacrificed\b/i],
    ["responsabilité lourde",/\bresponsibility|burden|duty|obligation\b/i],
    ["quête ou grand objectif",/\b(dream|goal|ambition|quest|aims to|wants to become)\b/i]
  ],
  aura:[
    ["charismatique",/\b(charismatic|charisma|admired|respected)\b/i],
    ["intimidant",/\b(intimidating|fearsome|terrifying|frightening)\b/i],
    ["légendaire",/\b(legend|legendary|famous|renowned)\b/i],
    ["présence de leader",/\b(commanding presence|natural leader|leadership)\b/i],
    ["imprévisible",/\b(unpredictable|erratic)\b/i]
  ]
};

const QUERY=`query PopularCharacters($page:Int,$perPage:Int){
  Page(page:$page,perPage:$perPage){
    characters(sort:FAVOURITES_DESC){
      id
      name{full}
      image{large medium}
      description(asHtml:false)
      gender
      age
      favourites
      media(perPage:6,sort:POPULARITY_DESC,type:ANIME){
        edges{
          characterRole
          node{
            id
            title{romaji english}
            genres
            popularity
            averageScore
          }
        }
      }
    }
  }
}`;

function norm(v){
  return String(v||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function cleanText(v){
  return String(v||"")
    .replace(/<br\s*\/?>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\*\*/g," ")
    .replace(/__+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function readJson(key,fallback){
  try{
    const x=JSON.parse(localStorage.getItem(key)||"null");
    return x??fallback;
  }catch{return fallback}
}
function writeJson(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}

function unique(values){
  return [...new Set((values||[]).filter(Boolean))];
}

function tagsFromRules(text,category){
  const rules=RULES[category]||[];
  return rules.filter(([,rx])=>rx.test(text)).map(([label])=>label);
}

function ageGroup(age){
  const m=String(age||"").match(/\d+/);
  if(!m)return null;
  const n=Number(m[0]);
  if(n<=12)return "enfant";
  if(n<=18)return "adolescent";
  if(n<=29)return "jeune adulte";
  if(n<=49)return "adulte";
  return "adulte mûr";
}

function primaryMedia(raw){
  const edges=raw?.media?.edges||[];
  const sorted=[...edges].sort((a,b)=>(b?.node?.popularity||0)-(a?.node?.popularity||0));
  return sorted[0]||null;
}

function profileFromAniList(raw){
  const name=raw?.name?.full?.trim();
  if(!name)return null;

  const mediaEdge=primaryMedia(raw);
  const media=mediaEdge?.node||{};
  const anime=(media.title?.english||media.title?.romaji||"Anime inconnu").trim();
  const text=cleanText(raw.description);
  const local=localByName.get(norm(name));

  const traits={};
  for(const cat of Object.keys(CATEGORY_WEIGHTS)){
    const online=tagsFromRules(text,cat);
    const localTags=local?.traits?.[cat]||[];
    traits[cat]=unique([...localTags,...online]);
  }

  if(mediaEdge?.characterRole==="MAIN")traits.role=unique([...traits.role,"personnage principal"]);
  if(mediaEdge?.characterRole==="SUPPORTING")traits.role=unique([...traits.role,"personnage secondaire important"]);

  const age=ageGroup(raw.age);
  if(age)traits.appearance=unique([...traits.appearance,age]);

  const genres=Array.isArray(media.genres)?media.genres:[];
  const richness=Object.values(traits).reduce((s,a)=>s+a.length,0);

  return {
    id:raw.id,
    name,
    anime,
    imageUrl:raw.image?.large||raw.image?.medium||"",
    favourites:Number(raw.favourites||0),
    gender:raw.gender||"",
    age:raw.age||"",
    characterRole:mediaEdge?.characterRole||"",
    genres,
    traits,
    richness,
    source:"anilist"
  };
}

async function fetchPage(page,perPage=50){
  const r=await fetch(ANILIST_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({query:QUERY,variables:{page,perPage}})
  });
  if(!r.ok)throw new Error(`AniList HTTP ${r.status}`);
  const d=await r.json();
  if(d?.errors?.length)throw new Error(d.errors[0]?.message||"Erreur AniList");
  return d?.data?.Page?.characters||[];
}

function loadCachedPool(){
  const cached=readJson(CACHE_KEY,null);
  if(!cached||!Array.isArray(cached.characters))return null;
  if(Date.now()-Number(cached.savedAt||0)>CACHE_TTL_MS)return null;
  return cached.characters;
}

function savePool(pool){
  writeJson(CACHE_KEY,{savedAt:Date.now(),characters:pool});
}

export async function getOnlineCharacterPool({force=false}={}){
  if(memoryPool&&!force)return memoryPool;
  if(!force){
    const cached=loadCachedPool();
    if(cached?.length){
      memoryPool=cached;
      return memoryPool;
    }
  }

  const pages=await Promise.all([1,2,3,4,5,6].map(p=>fetchPage(p,50)));
  const pool=pages.flat()
    .map(profileFromAniList)
    .filter(Boolean)
    .filter(c=>c.richness>=2)
    .filter(c=>c.favourites>=250);

  const byId=new Map();
  for(const c of pool)byId.set(c.id,c);
  memoryPool=[...byId.values()];
  if(memoryPool.length)savePool(memoryPool);
  return memoryPool;
}

export async function warmOnlineCharacterPool(){
  try{return await getOnlineCharacterPool()}catch{return []}
}

function intersection(a,b){
  const bs=new Set(b||[]);
  return (a||[]).filter(x=>bs.has(x));
}

function categorySimilarity(a,b){
  if(!a?.length||!b?.length)return 0;
  const common=intersection(a,b).length;
  return common/Math.max(2,Math.min(a.length,b.length));
}

function evaluate(a,b){
  const shared={};
  let weighted=0;
  let covered=0;
  let commonCount=0;

  for(const [cat,w] of Object.entries(CATEGORY_WEIGHTS)){
    const common=intersection(a.traits?.[cat],b.traits?.[cat]);
    shared[cat]=common;
    if(common.length)covered++;
    commonCount+=common.length;
    weighted+=categorySimilarity(a.traits?.[cat],b.traits?.[cat])*w;
  }

  if(a.characterRole&&b.characterRole&&a.characterRole===b.characterRole)weighted+=.035;
  if(a.gender&&b.gender&&a.gender===b.gender)weighted+=.015;

  // Une paire doit partager plusieurs dimensions, pas seulement un tag générique.
  let score=Math.round(weighted*100);
  if(covered>=3)score+=5;
  if(covered>=4)score+=4;
  if(commonCount>=6)score+=3;
  score=Math.max(0,Math.min(92,score));

  const labels={
    appearance:"apparence",
    personality:"personnalité",
    role:"rôle",
    combat:"combat/pouvoirs",
    story:"histoire",
    aura:"présence"
  };
  const sharedDetails=[];
  for(const [cat,items] of Object.entries(shared)){
    for(const item of items.slice(0,3))sharedDetails.push(`${labels[cat]} : ${item}`);
  }

  return {score,covered,commonCount,sharedDetails};
}

function bandForDifficulty(difficulty){
  if(difficulty==="easy")return {min:42,max:62,target:53,minCommon:2,minCovered:2};
  if(difficulty==="hard")return {min:66,max:84,target:75,minCommon:4,minCovered:3};
  return {min:55,max:75,target:65,minCommon:3,minCovered:2};
}

const CLUE_ALIAS={
  "cheveux clairs":"Clair",
  "cheveux noirs":"Noir",
  "cheveux rouges":"Rouge",
  "cheveux longs":"Long",
  "cheveux hérissés":"Hérissé",
  "lunettes":"Lunettes",
  "œil ou regard particulier":"Yeux",
  "cicatrices":"Cicatrice",
  "apparence imposante":"Imposant",
  "apparence jeune":"Jeune",
  "calme":"Calme",
  "réservé":"Réservé",
  "énergique":"Énergique",
  "optimiste":"Optimiste",
  "sarcastique":"Sarcastique",
  "très intelligent":"Génie",
  "calculateur":"Calculateur",
  "protecteur":"Protecteur",
  "loyal":"Loyal",
  "arrogant":"Arrogant",
  "froid":"Froid",
  "gentil":"Gentil",
  "déterminé":"Déterminé",
  "mystérieux":"Mystère",
  "excentrique":"Excentrique",
  "mentor":"Mentor",
  "professeur":"Professeur",
  "chef":"Chef",
  "héros principal":"Héros",
  "antagoniste":"Antagoniste",
  "rival":"Rival",
  "prodige":"Prodige",
  "assassin":"Assassin",
  "épéiste":"Épéiste",
  "soldat":"Soldat",
  "détective":"Détective",
  "scientifique":"Scientifique",
  "roi ou souverain":"Roi",
  "étudiant":"Étudiant",
  "pirate":"Pirate",
  "ninja":"Ninja",
  "sorcier ou mage":"Mage",
  "épée":"Sabre",
  "combat rapproché":"Mêlée",
  "grande vitesse":"Rapide",
  "force physique":"Force",
  "feu":"Feu",
  "glace":"Glace",
  "foudre":"Foudre",
  "pouvoir psychique":"Psychique",
  "illusion":"Illusion",
  "transformation":"Transformation",
  "invocation":"Invocation",
  "guérison":"Soin",
  "combat tactique":"Tactique",
  "armes à distance":"Distance",
  "passé tragique":"Tragédie",
  "vengeance":"Vengeance",
  "perte de proches":"Perte",
  "famille difficile":"Famille",
  "orphelin ou enfance solitaire":"Solitude",
  "identité secrète":"Secret",
  "sacrifice":"Sacrifice",
  "responsabilité lourde":"Devoir",
  "quête ou grand objectif":"Objectif",
  "charismatique":"Charisme",
  "intimidant":"Intimidant",
  "légendaire":"Légendaire",
  "présence de leader":"Leader",
  "imprévisible":"Imprévisible",
  "personnage principal":"Héros",
  "personnage secondaire important":"Allié",
  "enfant":"Enfant",
  "adolescent":"Jeune",
  "jeune adulte":"Adulte",
  "adulte":"Adulte",
  "adulte mûr":"Vétéran"
};

function clueKeywords(profile){
  const preferred=["combat","role","appearance","personality","story","aura"];
  const out=[];
  for(const cat of preferred){
    for(const trait of profile?.traits?.[cat]||[]){
      const word=CLUE_ALIAS[trait]||trait;
      if(word&&!out.some(x=>norm(x)===norm(word)))out.push(word);
    }
  }
  return out.slice(0,14);
}

function pairKey(a,b){
  return [a,b].sort((x,y)=>x.localeCompare(y)).join("|||");
}

function recentCharacters(){
  const x=readJson(RECENT_CHAR_KEY,[]);
  return Array.isArray(x)?x.slice(0,MAX_RECENT_CHARS):[];
}
function recentPairs(){
  const x=readJson(RECENT_PAIR_KEY,[]);
  return Array.isArray(x)?x.slice(0,MAX_RECENT_PAIRS):[];
}

function remember(a,b){
  const chars=recentCharacters();
  writeJson(
    RECENT_CHAR_KEY,
    [a.name,b.name,...chars.filter(x=>x!==a.name&&x!==b.name)].slice(0,MAX_RECENT_CHARS)
  );

  const key=pairKey(a.name,b.name);
  const pairs=recentPairs();
  writeJson(
    RECENT_PAIR_KEY,
    [key,...pairs.filter(x=>x!==key)].slice(0,MAX_RECENT_PAIRS)
  );
}

function noveltyWeight(name,recent){
  const i=recent.indexOf(name);
  if(i<0)return 1;
  if(i<4)return .03;
  if(i<8)return .12;
  if(i<14)return .35;
  return .65;
}

function animeAllowed(character,allowedAnime){
  if(!allowedAnime?.length)return true;
  const allowed=allowedAnime.map(norm);
  const anime=norm(character.anime);
  return allowed.some(a=>anime.includes(a)||a.includes(anime));
}

function chooseWeighted(items,weightFn){
  let total=0;
  const weights=items.map(x=>{
    const w=Math.max(.0001,Number(weightFn(x))||0);
    total+=w;
    return w;
  });
  let r=Math.random()*total;
  for(let i=0;i<items.length;i++){
    r-=weights[i];
    if(r<=0)return items[i];
  }
  return items[items.length-1];
}

export async function chooseOnlineIntelligentPair({
  difficulty="normal",
  allowedAnime=null,
  mix=true
}={}){
  let pool;
  try{
    pool=await getOnlineCharacterPool();
  }catch(e){
    console.warn("Online character engine unavailable",e);
    return chooseLocalPair({
      difficulty,
      allowedAnime:allowedAnime?.length?allowedAnime:undefined,
      mix,
      popularityMin:92
    });
  }

  let filtered=pool.filter(c=>animeAllowed(c,allowedAnime));
  if(filtered.length<12)filtered=pool;

  const recentC=recentCharacters();
  const recentP=new Set(recentPairs());
  const band=bandForDifficulty(difficulty);
  const candidates=[];

  for(let i=0;i<filtered.length;i++){
    const a=filtered[i];
    for(let j=i+1;j<filtered.length;j++){
      const b=filtered[j];

      const sameAnime=norm(a.anime)===norm(b.anime);
      if(mix&&sameAnime)continue;
      if(!mix&&!sameAnime)continue;

      const e=evaluate(a,b);
      if(e.score<band.min||e.score>band.max)continue;
      if(e.commonCount<band.minCommon||e.covered<band.minCovered)continue;

      const key=pairKey(a.name,b.name);
      if(recentP.has(key))continue;

      const novelty=noveltyWeight(a.name,recentC)*noveltyWeight(b.name,recentC);
      const targetFit=1/(1+Math.abs(e.score-band.target));
      const popularity=Math.log10(Math.max(10,a.favourites+1))*Math.log10(Math.max(10,b.favourites+1));
      const richness=Math.min(1.3,.65+(a.richness+b.richness)/30);
      const weight=Math.max(.0001,novelty*targetFit*popularity*richness);

      candidates.push({
        a:{
          id:a.id,
          anime:a.anime,
          name:a.name,
          imageUrl:a.imageUrl,
          keywords:clueKeywords(a),
          source:"anilist"
        },
        b:{
          id:b.id,
          anime:b.anime,
          name:b.name,
          imageUrl:b.imageUrl,
          keywords:clueKeywords(b),
          source:"anilist"
        },
        score:e.score,
        commonCount:e.commonCount,
        coveredCategories:e.covered,
        sharedDetails:e.sharedDetails.slice(0,10),
        weight,
        curated:false,
        online:true
      });
    }
  }

  if(!candidates.length){
    return chooseLocalPair({
      difficulty,
      allowedAnime:allowedAnime?.length?allowedAnime:undefined,
      mix,
      popularityMin:92
    });
  }

  // On garde un grand éventail de bonnes paires au lieu de prendre les scores maximum.
  candidates.sort((x,y)=>{
    const ax=Math.abs(x.score-band.target), ay=Math.abs(y.score-band.target);
    return ax-ay || y.weight-x.weight;
  });
  const broadPool=candidates.slice(0,Math.min(240,candidates.length));
  const chosen=chooseWeighted(broadPool,p=>p.weight);
  remember(chosen.a,chosen.b);
  return chosen;
}

export function clearOnlineCharacterHistory(){
  try{
    localStorage.removeItem(RECENT_CHAR_KEY);
    localStorage.removeItem(RECENT_PAIR_KEY);
  }catch{}
}

export function getOnlineEngineInfo(){
  const cached=loadCachedPool();
  return {
    cachedCount:cached?.length||memoryPool?.length||0,
    recentCharacters:recentCharacters().length,
    recentPairs:recentPairs().length
  };
}
