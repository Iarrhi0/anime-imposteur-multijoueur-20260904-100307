import { getOnlineCharacterPool } from "./online-character-engine.js?v=9.0.0";

function norm(v){
  return String(v||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function shuffle(a){
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}

function clueLabel(trait){
  const clean=String(trait||"").trim();
  if(!clean)return null;
  return clean.charAt(0).toUpperCase()+clean.slice(1);
}

function buildClues(c){
  const clues=[];
  const add=(label,value)=>{
    if(!value)return;
    const text=`${label} : ${value}`;
    if(!clues.includes(text))clues.push(text);
  };

  const role=(c.traits?.role||[])[0];
  const personality=(c.traits?.personality||[])[0];
  const combat=(c.traits?.combat||[])[0];
  const story=(c.traits?.story||[])[0];
  const appearance=(c.traits?.appearance||[])[0];
  const aura=(c.traits?.aura||[])[0];

  add("Rôle",clueLabel(role));
  add("Personnalité",clueLabel(personality));
  add("Combat / pouvoir",clueLabel(combat));
  add("Histoire",clueLabel(story));
  add("Apparence",clueLabel(appearance));
  add("Aura",clueLabel(aura));
  add("Anime",c.anime);

  return clues;
}

function acceptedAnswers(c){
  const full=norm(c.name);
  const tokens=full.split(" ").filter(x=>x.length>=3);
  const set=new Set([full]);
  if(tokens.length>=2){
    set.add(tokens[0]);
    set.add(tokens[tokens.length-1]);
  }
  return set;
}

export async function newGuessCharacterChallenge({difficulty="normal"}={}){
  const pool=await getOnlineCharacterPool();
  if(!pool?.length)throw new Error("Catalogue de personnages indisponible.");

  const minFav=difficulty==="easy"?2500:difficulty==="hard"?500:1200;
  let candidates=pool.filter(c=>Number(c.favourites||0)>=minFav && c.imageUrl);
  if(candidates.length<20)candidates=pool.filter(c=>c.imageUrl);
  const character=candidates[Math.floor(Math.random()*candidates.length)];

  let clues=buildClues(character);
  clues=shuffle(clues);

  // L'anime apparaît plus tôt en facile et plus tard en difficile.
  const animeIndex=clues.findIndex(x=>x.startsWith("Anime :"));
  if(animeIndex>=0){
    const animeClue=clues.splice(animeIndex,1)[0];
    if(difficulty==="easy")clues.splice(Math.min(1,clues.length),0,animeClue);
    else if(difficulty==="normal")clues.splice(Math.min(3,clues.length),0,animeClue);
    else clues.push(animeClue);
  }

  const startingClues=difficulty==="easy"?3:difficulty==="hard"?1:2;
  const maxAttempts=difficulty==="easy"?7:difficulty==="hard"?5:6;

  return {
    id:`guess_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    character:{
      id:character.id,
      name:character.name,
      anime:character.anime,
      imageUrl:character.imageUrl,
      favourites:character.favourites||0
    },
    clues,
    revealed:Math.min(startingClues,clues.length),
    attempts:0,
    maxAttempts,
    solved:false,
    finished:false,
    difficulty
  };
}

export function submitCharacterGuess(challenge,input){
  if(!challenge||challenge.finished)return {correct:false,finished:true};
  const guess=norm(input);
  if(!guess)return {correct:false,finished:false,empty:true};

  challenge.attempts+=1;
  const answers=acceptedAnswers(challenge.character);
  const correct=answers.has(guess);

  if(correct){
    challenge.solved=true;
    challenge.finished=true;
    challenge.revealed=challenge.clues.length;
    return {correct:true,finished:true};
  }

  if(challenge.attempts>=challenge.maxAttempts){
    challenge.finished=true;
    challenge.revealed=challenge.clues.length;
    return {correct:false,finished:true};
  }

  challenge.revealed=Math.min(challenge.clues.length,challenge.revealed+1);
  return {correct:false,finished:false};
}

export function revealGuessHint(challenge){
  if(!challenge||challenge.finished)return challenge;
  challenge.revealed=Math.min(challenge.clues.length,challenge.revealed+1);
  return challenge;
}

export function guessCharacterSuggestions(pool,query,limit=8){
  const q=norm(query);
  if(!q)return [];
  return (pool||[])
    .filter(c=>norm(c.name).includes(q))
    .slice(0,limit)
    .map(c=>c.name);
}
