import { chooseIntelligentPair, animeDB } from "./ai-engine.js?v=10.0.2";
import { chooseOnlineIntelligentPair } from "./online-character-engine.js?v=10.0.2";
import { chooseUniverseConceptPair } from "./concept-engine.js?v=10.0.2";
import { chooseAdaptiveBotHint, chooseBotVote, buildBotDiscussion, resetBotMemory } from "./bot-engine.js?v=10.0.2";

const BOTS=[
  {id:"bot_yuki",name:"Yuki",difficulty:"Normal"},
  {id:"bot_sakura",name:"Sakura",difficulty:"Normal"},
  {id:"bot_kira",name:"Kira",difficulty:"Difficile"},
  {id:"bot_shiro",name:"Shiro",difficulty:"Expert"}
];

function shuffle(arr){
  const x=[...arr];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}
function norm(v){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function validWord(v){
  const w=String(v||"").trim();
  if(!w||/\s/.test(w))return null;
  return w.slice(0,24);
}
async function choosePair(settings={}){
  const difficulty=settings.difficulty||"hard";
  const allowedAnime=settings.allowedAnime||null;
  const variant=settings.variant||"mixed";
  let pair=null;

  try{
    const chosen=variant==="mixed"?(Math.random()<.48?"universe":"similar"):variant;
    if(chosen==="universe"){
      pair=await chooseUniverseConceptPair({difficulty,allowedAnime});
    }
    if(!pair){
      pair=await chooseOnlineIntelligentPair({
        difficulty,
        allowedAnime,
        mix:true
      });
    }
  }catch{}

  if(!pair){
    pair=chooseIntelligentPair({
      difficulty,
      allowedAnime:allowedAnime?.length?allowedAnime:animeDB,
      mix:true,
      popularityMin:90
    });
  }
  return pair;
}

export async function createLocalSoloSession({playerName="Joueur",difficulty="hard",variant="mixed",allowedAnime=null}={}){
  resetBotMemory();
  const pair=await choosePair({difficulty,variant,allowedAnime});
  if(!pair)throw new Error("Aucun duo de personnages disponible.");

  const human={id:"local_human",name:String(playerName||"Joueur").slice(0,20),bot:false,difficulty:"Humain"};
  const participants=[human,...BOTS.map(x=>({...x,bot:true}))];
  const reverse=Math.random()<.5;
  const majority=reverse?pair.b:pair.a;
  const outsider=reverse?pair.a:pair.b;
  const impostor=participants[Math.floor(Math.random()*participants.length)];

  const assignments={};
  for(const p of participants){
    assignments[p.id]={...(p.id===impostor.id?outsider:majority)};
  }

  return {
    id:"solo_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    participants,
    assignments,
    majority,
    outsider,
    impostorId:impostor.id,
    pairScore:pair.score||0,
    sharedDetails:pair.sharedDetails||[],
    round:1,
    hints:[],
    messages:[],
    votes:[],
    phase:"hints",
    result:null,
    playerName:human.name,
    difficulty,
    variant
  };
}

export function submitSoloHint(session,input){
  if(!session||session.phase!=="hints")return {ok:false,error:"Les indices ne sont pas disponibles."};
  const word=validWord(input);
  if(!word)return {ok:false,error:"Écris un seul mot."};

  if(session.hints.some(h=>norm(h.word)===norm(word))){
    return {ok:false,error:"Ce mot a déjà été utilisé."};
  }

  const human=session.participants[0];
  session.hints.push({
    id:"h_"+Date.now()+"_human",
    round:session.round,
    playerId:human.id,
    playerName:human.name,
    word
  });

  const used=session.hints.map(h=>h.word);
  for(const bot of session.participants.filter(p=>p.bot)){
    const char=session.assignments[bot.id];
    const botWord=chooseAdaptiveBotHint(
      char,
      used,
      session.hints,
      bot.name,
      bot.difficulty
    );
    used.push(botWord);
    session.hints.push({
      id:"h_"+Date.now()+"_"+bot.id,
      round:session.round,
      playerId:bot.id,
      playerName:bot.name,
      word:botWord
    });
  }

  session.phase="discussion";
  session.messages.push({
    id:"system_"+Date.now(),
    playerId:"system",
    playerName:"Jeu",
    text:"Tous les indices sont posés. Discutez ou passez au vote."
  });

  generateBotDiscussion(session,"Qui vous semble suspect ?");
  return {ok:true};
}

export function addSoloMessage(session,text){
  if(!session||!["discussion","hints"].includes(session.phase))return;
  const clean=String(text||"").trim().slice(0,240);
  if(!clean)return;

  session.messages.push({
    id:"m_"+Date.now()+"_human",
    playerId:"local_human",
    playerName:session.playerName,
    text:clean
  });
  generateBotDiscussion(session,clean);
}

function generateBotDiscussion(session,seedText){
  const seed={
    id:"seed_"+Date.now(),
    playerId:"local_human",
    playerName:session.playerName,
    text:seedText
  };
  const working=[...session.messages,seed];
  const bots=shuffle(session.participants.filter(p=>p.bot)).slice(0,Math.random()<.5?2:3);

  for(const bot of bots){
    const text=buildBotDiscussion(
      bot.name,
      session.assignments[bot.id],
      session.hints,
      working,
      session.participants,
      {phase:session.phase,tranche:session.round,difficulty:bot.difficulty}
    );
    if(text){
      const msg={
        id:"m_"+Date.now()+"_"+bot.id+"_"+Math.random().toString(36).slice(2),
        playerId:bot.id,
        playerName:bot.name,
        text
      };
      session.messages.push(msg);
      working.push(msg);
    }
  }
}

export function nextSoloRound(session){
  if(!session||session.phase==="result")return;
  session.round+=1;
  session.phase="hints";
}

export function startSoloVote(session){
  if(!session||session.hints.length<5)return {ok:false,error:"Fais au moins une manche d’indices avant de voter."};
  session.phase="vote";
  return {ok:true};
}

export function resolveSoloVote(session,targetId){
  if(!session||session.phase!=="vote")return {ok:false,error:"Le vote n’est pas disponible."};
  if(!targetId||targetId==="local_human")return {ok:false,error:"Choisis une IA."};

  const participants=session.participants;
  const votes=[{
    voterId:"local_human",
    voterName:session.playerName,
    targetId
  }];

  for(const bot of participants.filter(p=>p.bot)){
    const choice=chooseBotVote(
      bot.id,
      session.assignments[bot.id],
      participants,
      session.hints,
      session.messages,
      bot.difficulty
    );
    votes.push({voterId:bot.id,voterName:bot.name,targetId:choice});
  }

  const counts={};
  for(const v of votes)counts[v.targetId]=(counts[v.targetId]||0)+1;
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const top=ranked[0]?.[1]||0;
  const leaders=ranked.filter(x=>x[1]===top).map(x=>x[0]);
  const eliminated=leaders.length===1?leaders[0]:null;
  const impostorFound=eliminated===session.impostorId;
  const humanIsImpostor=session.impostorId==="local_human";
  const playerWon=humanIsImpostor?!impostorFound:impostorFound;

  session.votes=votes;
  session.phase="result";
  session.result={
    eliminated,
    tie:!eliminated,
    impostorFound,
    humanIsImpostor,
    playerWon,
    counts
  };
  return {ok:true,result:session.result};
}

export function soloPublicState(session){
  if(!session)return null;
  const human=session.participants[0];
  return {
    player:human,
    assignment:session.assignments[human.id],
    participants:session.participants,
    hints:session.hints,
    messages:session.messages,
    phase:session.phase,
    round:session.round,
    result:session.result,
    impostorId:session.impostorId,
    majority:session.majority,
    outsider:session.outsider,
    votes:session.votes
  };
}
