import { firebaseConfig } from "./firebase-config.js";
import { animeDB, chooseIntelligentPair, getAiStats } from "./ai-engine.js?v=7.1";
import {
  chooseAdaptiveBotHint, chooseBotVote, botVoteApproval,
  buildBotDiscussion, shouldBotReply, botReplyDelay, resetBotMemory
} from "./bot-engine.js?v=7.1";

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

const BOT_PROFILES=[
  {name:"Sakura",difficulty:"Normal"},
  {name:"Kira",difficulty:"Difficile"},
  {name:"Ren",difficulty:"Difficile"},
  {name:"Yuki",difficulty:"Normal"},
  {name:"Shiro",difficulty:"Expert"},
  {name:"Aiko",difficulty:"Normal"}
];

const HEARTBEAT_MS=10000;
const HOST_LEASE_MS=30000;
const OFFLINE_DROP_MS=70000;
const PROPOSAL_TIMEOUT_MS=30000;
const INSTALL_SEEN_KEY="anime_imposteur_install_prompt_seen_v1";

let fb,auth,db,currentUser;
let currentRoom=null,currentRoomData=null,isHost=false;
let players=[],bots=[],assignment=null,botAssignments={};
let hints=[],messages=[],voteApprovals=[],voteStatuses=[];
let activeTab="hints",unreadHints=0,unreadChat=0;
let installPrompt=null,leavingRoom=false,currentScreen="home";

let roomUnsubs=[],gameUnsubs=[],botAssignmentsUnsub=null;
let heartbeatTimer=null,hostLeaseTimer=null,hostClaimTimer=null,hostTickTimer=null;
let reconsiderClientTimer=null,hostTickRunning=false;
let botTurnTimers=new Map(),botMessageQueue=[],botQueueBusy=false;
let collectionReady={hints:false,messages:false,approvals:false,voteStatus:false};
let lastHintIds=new Set(),lastMessageIds=new Set();
const characterImageCache=new Map();
const localSettings={mode:"auto",difficulty:"hard"};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const safeName=v=>(String(v||"").trim().slice(0,20)||"Joueur");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>Date.now();
function randomId(prefix="id"){return `${prefix}_${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now()}`}
function randomCode(){
  const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",n=new Uint32Array(5);crypto.getRandomValues(n);
  return [...n].map(x=>a[x%a.length]).join("");
}
function shuffle(arr){
  const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
function toast(title,text=""){
  const layer=$("#toast-layer");if(!layer)return;
  const el=document.createElement("div");el.className="toast";
  el.innerHTML=`<strong>${esc(title)}</strong>${text?`<span>${esc(text)}</span>`:""}`;
  layer.appendChild(el);requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),200)},2500);
}
function patchText(sel,v){const el=$(sel);if(el&&el.textContent!==String(v??""))el.textContent=String(v??"")}
function patchHTML(sel,v){const el=$(sel);if(el&&el.__html!==v){el.innerHTML=v;el.__html=v}}
function show(id){
  if(currentScreen===id)return;
  $$(".screen").forEach(x=>x.classList.remove("active"));
  $("#screen-"+id)?.classList.add("active");currentScreen=id;
}

let renderQueued=false;
function scheduleRender(){
  if(renderQueued)return;renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;renderAll()});
}
function cleanupTimers(){
  [heartbeatTimer,hostLeaseTimer,hostClaimTimer].forEach(clearInterval);
  [hostTickTimer,reconsiderClientTimer].forEach(clearTimeout);
  heartbeatTimer=hostLeaseTimer=hostClaimTimer=hostTickTimer=reconsiderClientTimer=null;
  for(const t of botTurnTimers.values())clearTimeout(t);
  botTurnTimers.clear();botMessageQueue=[];botQueueBusy=false;
}
function cleanupListeners(){
  while(roomUnsubs.length){try{roomUnsubs.pop()()}catch{}}
  while(gameUnsubs.length){try{gameUnsubs.pop()()}catch{}}
  if(botAssignmentsUnsub){try{botAssignmentsUnsub()}catch{};botAssignmentsUnsub=null}
}
function cleanupRoom(){
  cleanupTimers();cleanupListeners();
  hints=[];messages=[];voteApprovals=[];voteStatuses=[];
  lastHintIds.clear();lastMessageIds.clear();
  collectionReady={hints:false,messages:false,approvals:false,voteStatus:false};
}

async function initFirebase(){
  if(!firebaseConfig){
    $("#fatal-config").classList.remove("hidden");
    $("#fatal-config").innerHTML="<strong>Firebase non configuré.</strong><span>Relance le déploiement V7.1.</span>";
    return;
  }
  try{
    const appMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
    const authMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
    const fsMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
    const app=appMod.initializeApp(firebaseConfig);
    auth=authMod.getAuth(app);db=fsMod.getFirestore(app);fb={authMod,fsMod};
    authMod.onAuthStateChanged(auth,async user=>{
      if(!user){try{await authMod.signInAnonymously(auth)}catch(e){toast("Firebase",e.message)};return}
      currentUser=user;$("#connection-dot").classList.add("online");
      const saved=localStorage.getItem("anime_room");
      if(saved)resumeRoom(saved).catch(()=>localStorage.removeItem("anime_room"));
    });
  }catch(e){
    $("#fatal-config").classList.remove("hidden");
    $("#fatal-config").innerHTML=`<strong>Firebase ne charge pas.</strong><span>${esc(e.message)}</span>`;
  }
}
async function ensureUserReady(){
  if(currentUser&&fb&&db)return currentUser;
  toast("Connexion…","Initialisation.");
  for(let i=0;i<40;i++){if(currentUser&&fb&&db)return currentUser;await sleep(250)}
  throw new Error("Firebase n’est pas prêt.");
}

function participants(){return [...players,...bots]}
function rosterParticipant(id){
  return participants().find(p=>p.id===id)
    || (currentRoomData?.roster||[]).find(p=>p.id===id)
    || null;
}
function participantById(id){return rosterParticipant(id)}
function gameOrder(){return currentRoomData?.order||[]}
function activeIds(){return currentRoomData?.activeIds?.length?currentRoomData.activeIds:gameOrder()}
function activeOrder(){const a=new Set(activeIds());return gameOrder().filter(id=>a.has(id))}
function activeParticipants(){return activeOrder().map(id=>rosterParticipant(id)).filter(Boolean)}
function currentGameHints(){return hints.filter(h=>h.gameNo===currentRoomData?.gameNo)}
function trancheHints(){return currentGameHints().filter(h=>h.round===currentRoomData?.hintRound)}
function trancheGiven(){return new Set(trancheHints().map(h=>h.playerId))}
function voteVoterIds(){return activeOrder()}
function voteCandidateIds(){return currentRoomData?.voteCandidates?.length?currentRoomData.voteCandidates:activeOrder()}
function currentVoteRound(){return currentRoomData?.voteRound||1}
function voteStatusMap(){
  const r=currentVoteRound();
  return new Map(voteStatuses.filter(v=>(v.voteRound||1)===r).map(v=>[v.playerId,v]));
}
function reconsiderEndMs(){
  const x=currentRoomData?.reconsiderEndsAt;
  if(x?.toMillis)return x.toMillis();
  if(typeof x==="number")return x;
  return 0;
}

async function createRoom({solo=false}={}){
  await ensureUserReady();
  const btn=solo?$("#solo-room-btn"):$("#create-room-btn"),old=btn.textContent;
  btn.disabled=true;btn.textContent=solo?"Préparation…":"Création…";
  try{
    const name=safeName($("#home-name").value);localStorage.setItem("imposteur_name",name);
    const {doc,getDoc,setDoc,serverTimestamp,Timestamp}=fb.fsMod;
    let code=null;
    for(let i=0;i<12;i++){const c=randomCode();if(!(await getDoc(doc(db,"rooms",c))).exists()){code=c;break}}
    if(!code)throw new Error("Impossible de générer la salle.");

    await setDoc(doc(db,"rooms",code),{
      hostUid:currentUser.uid,hostLeaseUntil:Timestamp.fromMillis(now()+HOST_LEASE_MS),
      status:"lobby",gameNo:0,hintRound:0,turnIndex:0,order:[],roster:[],activeIds:[],
      hiddenHints:false,reconsiderSeconds:15,voteProposal:null,voteRound:0,
      voteStage:null,voteCandidates:[],reconsiderEndsAt:null,result:null,createdAt:serverTimestamp()
    });
    await setDoc(doc(db,"rooms",code,"players",currentUser.uid),{
      name,type:"human",score:0,online:true,lastSeenMs:now(),joinedAt:serverTimestamp()
    });
    if(solo){
      for(const p of BOT_PROFILES.slice(0,4)){
        await setDoc(doc(db,"rooms",code,"bots",randomId("bot")),{
          ...p,type:"bot",score:0,joinedAt:serverTimestamp()
        });
      }
    }
    await enterRoom(code);toast(solo?"Mode solo prêt":"Salle créée",solo?"4 IA sont prêtes.":`Code : ${code}`);
  }finally{btn.disabled=false;btn.textContent=old}
}
async function joinRoom(){
  await ensureUserReady();
  const btn=$("#join-room-btn"),old=btn.textContent;btn.disabled=true;btn.textContent="Connexion…";
  try{
    const code=$("#join-code").value.trim().toUpperCase();
    if(code.length!==5)throw new Error("Le code doit contenir 5 caractères.");
    const {doc,getDoc,setDoc,serverTimestamp}=fb.fsMod;
    const room=await getDoc(doc(db,"rooms",code));if(!room.exists())throw new Error("Salle introuvable.");
    const meRef=doc(db,"rooms",code,"players",currentUser.uid),me=await getDoc(meRef);
    if(room.data().status!=="lobby"&&!me.exists())throw new Error("Cette partie a déjà commencé.");
    await setDoc(meRef,{
      name:safeName($("#home-name").value),type:"human",online:true,lastSeenMs:now(),
      ...(me.exists()?{}:{score:0,joinedAt:serverTimestamp()})
    },{merge:true});
    await enterRoom(code);toast("Salle rejointe",code);
  }finally{btn.disabled=false;btn.textContent=old}
}
async function resumeRoom(code){
  if(!currentUser||currentRoom)return;
  const {doc,getDoc}=fb.fsMod;
  const [r,m]=await Promise.all([getDoc(doc(db,"rooms",code)),getDoc(doc(db,"rooms",code,"players",currentUser.uid))]);
  if(r.exists()&&m.exists())await enterRoom(code);
}

async function enterRoom(code){
  cleanupRoom();currentRoom=code;localStorage.setItem("anime_room",code);
  patchText("#room-code",code);patchText("#game-room-code",code);maybeOfferInstallOnce();
  const {doc,collection,onSnapshot}=fb.fsMod;

  roomUnsubs.push(onSnapshot(doc(db,"rooms",code),snap=>{
    if(!snap.exists()){if(!leavingRoom)toast("Salle fermée");resetHome();return}
    const prev=currentRoomData;currentRoomData=snap.data();
    const wasHost=isHost;isHost=currentRoomData.hostUid===currentUser.uid;

    if(isHost&&!wasHost){subscribeBotAssignments();startHostLease()}
    if(!isHost&&wasHost){stopHostLease();unsubscribeBotAssignments()}
    if(!isHost)startHostClaimWatcher();

    if(currentRoomData.gameNo!==prev?.gameNo){
      resetBotMemory();subscribeGameData(currentRoomData.gameNo||0);
      activeTab="hints";unreadHints=unreadChat=0;
    }
    if((currentRoomData.voteRound||0)!==(prev?.voteRound||0)){
      if($("#vote-choices"))$("#vote-choices").dataset.selectedId="";
    }
    if(prev?.status!==currentRoomData.status&&currentRoomData.status==="voting")toast("Vote accepté","Le vote commence.");
    if(prev?.status!==currentRoomData.status&&currentRoomData.status==="postvote")toast("Résultat","La discussion reste ouverte.");
    if((currentRoomData.voteRound||1)>(prev?.voteRound||1)&&currentRoomData.status==="voting")toast("Égalité","Nouveau vote entre les ex æquo.");

    scheduleRender();scheduleHostTick();armVoteTimer();
  }));

  roomUnsubs.push(onSnapshot(collection(db,"rooms",code,"players"),snap=>{
    players=snap.docs.map(d=>({id:d.id,...d.data(),bot:false}));scheduleRender();scheduleHostTick();
  }));
  roomUnsubs.push(onSnapshot(collection(db,"rooms",code,"bots"),snap=>{
    bots=snap.docs.map(d=>({id:d.id,...d.data(),bot:true}));scheduleRender();scheduleHostTick();
  }));
  roomUnsubs.push(onSnapshot(doc(db,"rooms",code,"assignments",currentUser.uid),snap=>{
    assignment=snap.exists()?snap.data():null;renderCharacter();
  }));
  startHeartbeat();startHostClaimWatcher();
}

function subscribeGameData(gameNo){
  while(gameUnsubs.length){try{gameUnsubs.pop()()}catch{}}
  hints=[];messages=[];voteApprovals=[];voteStatuses=[];lastHintIds.clear();lastMessageIds.clear();
  collectionReady={hints:false,messages:false,approvals:false,voteStatus:false};
  if(!gameNo)return;
  const {collection,onSnapshot,query,where}=fb.fsMod;

  gameUnsubs.push(onSnapshot(query(collection(db,"rooms",currentRoom,"hints"),where("gameNo","==",gameNo)),snap=>{
    const next=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.round-b.round)||(a.orderIndex-b.orderIndex)||(a.createdMs-b.createdMs));
    if(collectionReady.hints){
      for(const h of next)if(!lastHintIds.has(h.id)){if(activeTab!=="hints"){unreadHints++;renderBadges()}toast(h.playerName,h.revealed?`« ${h.word} »`:"Indice enregistré")}
    }
    hints=next;lastHintIds=new Set(next.map(x=>x.id));collectionReady.hints=true;scheduleRender();scheduleHostTick();
  }));

  gameUnsubs.push(onSnapshot(query(collection(db,"rooms",currentRoom,"messages"),where("gameNo","==",gameNo)),snap=>{
    const next=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdMs||0)-(b.createdMs||0));
    const fresh=[];
    if(collectionReady.messages){
      for(const m of next){
        if(!lastMessageIds.has(m.id)&&m.playerId!==currentUser.uid){
          if(activeTab!=="chat"){unreadChat++;renderBadges()}toast(m.playerName,m.text.slice(0,48));
        }
        if(!lastMessageIds.has(m.id)&&!String(m.playerId).startsWith("bot_"))fresh.push(m);
      }
    }
    messages=next;lastMessageIds=new Set(next.map(x=>x.id));collectionReady.messages=true;
    fresh.forEach(enqueueBotMessage);scheduleRender();
  }));

  gameUnsubs.push(onSnapshot(query(collection(db,"rooms",currentRoom,"voteApprovals"),where("gameNo","==",gameNo)),snap=>{
    voteApprovals=snap.docs.map(d=>({id:d.id,...d.data()}));collectionReady.approvals=true;scheduleRender();scheduleHostTick();
  }));
  gameUnsubs.push(onSnapshot(query(collection(db,"rooms",currentRoom,"voteStatus"),where("gameNo","==",gameNo)),snap=>{
    voteStatuses=snap.docs.map(d=>({id:d.id,...d.data()}));collectionReady.voteStatus=true;scheduleRender();scheduleHostTick();
  }));
}

function subscribeBotAssignments(){
  if(botAssignmentsUnsub||!isHost)return;
  botAssignmentsUnsub=fb.fsMod.onSnapshot(fb.fsMod.collection(db,"rooms",currentRoom,"botAssignments"),snap=>{
    botAssignments={};snap.docs.forEach(d=>botAssignments[d.id]=d.data());scheduleHostTick();
  });
}
function unsubscribeBotAssignments(){if(botAssignmentsUnsub){try{botAssignmentsUnsub()}catch{};botAssignmentsUnsub=null}botAssignments={}}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  const beat=()=>fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"players",currentUser.uid),{online:true,lastSeenMs:now()},{merge:true}).catch(()=>{});
  beat();heartbeatTimer=setInterval(beat,HEARTBEAT_MS);
}
function markOffline(){
  if(!currentRoom||!currentUser||!fb)return;
  fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"players",currentUser.uid),{online:false,lastSeenMs:now()},{merge:true}).catch(()=>{});
}
function startHostLease(){clearInterval(hostLeaseTimer);renewHostLease();hostLeaseTimer=setInterval(renewHostLease,HEARTBEAT_MS)}
function stopHostLease(){clearInterval(hostLeaseTimer);hostLeaseTimer=null}
async function renewHostLease(){
  if(!isHost)return;
  await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
    hostLeaseUntil:fb.fsMod.Timestamp.fromMillis(now()+HOST_LEASE_MS)
  }).catch(()=>{});
}
function startHostClaimWatcher(){
  if(hostClaimTimer)return;
  hostClaimTimer=setInterval(()=>tryClaimHost().catch(()=>{}),5000);
}
async function tryClaimHost(){
  if(!currentRoomData||isHost||!currentUser)return;
  const until=currentRoomData.hostLeaseUntil?.toMillis?.()||0;if(until>now())return;
  const ref=fb.fsMod.doc(db,"rooms",currentRoom);
  await fb.fsMod.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())return;
    const d=snap.data(),lease=d.hostLeaseUntil?.toMillis?.()||0;if(lease>now())return;
    tx.update(ref,{hostUid:currentUser.uid,hostLeaseUntil:fb.fsMod.Timestamp.fromMillis(now()+HOST_LEASE_MS)});
  });
}

function scheduleHostTick(delay=50){
  if(!isHost||hostTickTimer)return;
  hostTickTimer=setTimeout(()=>{hostTickTimer=null;hostTick().catch(console.error)},delay);
}
async function hostTick(){
  if(!isHost||hostTickRunning||!currentRoomData)return;hostTickRunning=true;
  try{await hostNormalizeActive();await hostProcessTurn();await hostProcessProposal();await hostProcessVoting()}
  finally{hostTickRunning=false}
}
async function hostNormalizeActive(){
  if(!["playing","voting"].includes(currentRoomData.status))return;
  const cur=activeIds();if(!cur.length)return;
  const next=cur.filter(id=>{
    const p=rosterParticipant(id);if(!p)return false;
    if(p.bot)return bots.some(b=>b.id===id);
    const live=players.find(x=>x.id===id);
    return !!live&&now()-(live.lastSeenMs||0)<OFFLINE_DROP_MS;
  });
  if(next.length===cur.length&&next.every((x,i)=>x===cur[i]))return;
  await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
    activeIds:next,voteCandidates:voteCandidateIds().filter(id=>next.includes(id))
  });
}

async function startGame(){
  if(!isHost)return;
  const humans=players.filter(p=>now()-(p.lastSeenMs||0)<OFFLINE_DROP_MS);
  const all=[...humans,...bots];if(all.length<3)return toast("3 participants minimum");
  const pair=chooseIntelligentPair({difficulty:localSettings.difficulty,allowedAnime:selectedAnime(),mix:$("#mix-anime").checked,popularityMin:96});
  if(!pair)return toast("Aucun duo disponible");
  const reverse=Math.random()<.5,majority=reverse?pair.b:pair.a,outsider=reverse?pair.a:pair.b;
  const impostor=all[Math.floor(Math.random()*all.length)],gameNo=(currentRoomData.gameNo||0)+1;
  const order=shuffle(all.map(p=>p.id)),roster=all.map(p=>({id:p.id,name:p.name,bot:!!p.bot,score:p.score||0}));
  botAssignments={};
  await Promise.all(all.map(p=>{
    const char=p.id===impostor.id?outsider:majority;
    if(p.bot){botAssignments[p.id]={...char,gameNo};return fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"botAssignments",p.id),{...char,gameNo})}
    return fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"assignments",p.id),{...char,gameNo});
  }));
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"secrets","current"),{gameNo,impostorId:impostor.id,majority,outsider,pairScore:pair.score||0});
  await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
    status:"playing",gameNo,hintRound:1,turnIndex:0,order,roster,activeIds:order,
    hiddenHints:$("#hidden-hints").checked,reconsiderSeconds:Number($("#reconsider-seconds").value||15),
    voteProposal:null,voteRound:0,voteStage:null,voteCandidates:[],reconsiderEndsAt:null,result:null
  });
  cleanupOldData(gameNo).catch(()=>{});
}
async function cleanupOldData(gameNo){
  if(gameNo<3)return;
  const cols=["hints","messages","voteApprovals","votes","voteStatus"];
  let batch=fb.fsMod.writeBatch(db),n=0;
  for(const c of cols){
    const snap=await fb.fsMod.getDocs(fb.fsMod.collection(db,"rooms",currentRoom,c));
    for(const d of snap.docs)if((d.data().gameNo||0)<gameNo-1){
      batch.delete(fb.fsMod.doc(db,"rooms",currentRoom,c,d.id));n++;
      if(n>=400){await batch.commit();batch=fb.fsMod.writeBatch(db);n=0}
    }
  }
  if(n)await batch.commit();
}

async function hostProcessTurn(){
  if(currentRoomData.status!=="playing")return;
  const order=activeOrder();if(!order.length)return;
  const given=trancheGiven();

  if(order.every(id=>given.has(id))){
    if(currentRoomData.hiddenHints){
      const batch=fb.fsMod.writeBatch(db);
      trancheHints().filter(h=>!h.revealed).forEach(h=>batch.update(fb.fsMod.doc(db,"rooms",currentRoom,"hints",h.id),{revealed:true}));
      await batch.commit();
    }
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{hintRound:(currentRoomData.hintRound||1)+1,turnIndex:0});
    return;
  }

  let idx=currentRoomData.turnIndex||0;if(idx>=order.length)idx=0;
  let guard=0;while(guard<order.length&&given.has(order[idx])){idx=(idx+1)%order.length;guard++}
  if(idx!==(currentRoomData.turnIndex||0)){await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{turnIndex:idx});return}

  const id=order[idx],p=rosterParticipant(id);if(!p||!p.bot||trancheHints().some(h=>h.playerId===id))return;
  const key=`${currentRoomData.gameNo}_${currentRoomData.hintRound}_${id}`;if(botTurnTimers.has(key))return;
  const timer=setTimeout(async()=>{
    botTurnTimers.delete(key);
    if(!isHost||currentRoomData?.status!=="playing"||activeOrder()[currentRoomData.turnIndex]!==id)return;
    let a=botAssignments[id];
    if(!a){const snap=await fb.fsMod.getDoc(fb.fsMod.doc(db,"rooms",currentRoom,"botAssignments",id));if(snap.exists()){a=snap.data();botAssignments[id]=a}}
    if(!a)return scheduleHostTick(400);
    const b=bots.find(x=>x.id===id);
    const word=chooseAdaptiveBotHint(a.name,currentGameHints().map(h=>h.word),currentGameHints(),b?.name||p.name,b?.difficulty||"Normal");
    await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"hints",`g${currentRoomData.gameNo}_r${currentRoomData.hintRound}_${id}`),{
      gameNo:currentRoomData.gameNo,round:currentRoomData.hintRound,playerId:id,playerName:p.name,word,
      revealed:!currentRoomData.hiddenHints,orderIndex:currentRoomData.turnIndex,createdMs:now()
    });
  },550+Math.floor(Math.random()*900));
  botTurnTimers.set(key,timer);
}

async function sendHint(){
  if(currentRoomData?.status!=="playing")return toast("Indices indisponibles","Le vote est en cours.");
  const order=activeOrder(),p=rosterParticipant(order[currentRoomData.turnIndex||0]);
  if(!p)return toast("Synchronisation","Le tour se prépare.");
  if(p.id!==currentUser.uid)return toast("Pas encore ton tour",`C’est à ${p.name}.`);
  const word=$("#hint-input").value.trim();
  if(!word||/\s/.test(word))return toast("Un seul mot","Écris un seul mot.");
  if(trancheHints().some(h=>h.playerId===currentUser.uid))return toast("Déjà envoyé","Attends la tranche suivante.");
  if(currentGameHints().some(h=>norm(h.word)===norm(word)))return toast("Mot déjà utilisé","Choisis un autre mot.");
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"hints",`g${currentRoomData.gameNo}_r${currentRoomData.hintRound}_${currentUser.uid}`),{
    gameNo:currentRoomData.gameNo,round:currentRoomData.hintRound,playerId:currentUser.uid,
    playerName:participantById(currentUser.uid)?.name||"Joueur",word,revealed:!currentRoomData.hiddenHints,
    orderIndex:currentRoomData.turnIndex||0,createdMs:now()
  });
  $("#hint-input").value="";
}
async function sendMessage(text,playerId=currentUser.uid,playerName=null){
  text=String(text||"").trim().slice(0,300);if(!text)return;
  if(!["playing","voting","postvote"].includes(currentRoomData?.status))return;
  await fb.fsMod.addDoc(fb.fsMod.collection(db,"rooms",currentRoom,"messages"),{
    gameNo:currentRoomData.gameNo,playerId,playerName:playerName||participantById(playerId)?.name||"Joueur",
    text,createdMs:now()
  });
}

async function proposeVote(){
  if(currentRoomData?.status!=="playing")return;
  if(currentRoomData.voteProposal?.state==="open")return toast("Vote déjà proposé");
  const proposal={token:randomId("vote"),by:currentUser.uid,byName:participantById(currentUser.uid)?.name||"Joueur",createdMs:now(),state:"open"};
  const ref=fb.fsMod.doc(db,"rooms",currentRoom);
  await fb.fsMod.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())throw new Error("Salle fermée");
    const d=snap.data();if(d.status!=="playing"||d.voteProposal?.state==="open")throw new Error("Vote indisponible");
    tx.update(ref,{voteProposal:proposal});
  });
  await answerVoteRequest("yes",proposal.token);
  toast("Vote proposé","Les indices continuent pendant la décision.");
}
async function answerVoteRequest(decision,token=currentRoomData?.voteProposal?.token){
  if(!token)return;
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteApprovals",`${token}_${currentUser.uid}`),{
    gameNo:currentRoomData.gameNo,token,playerId:currentUser.uid,playerName:participantById(currentUser.uid)?.name||"Joueur",decision,createdMs:now()
  });
}
async function hostProcessProposal(){
  if(currentRoomData.status!=="playing")return;
  const p=currentRoomData.voteProposal;if(!p)return;
  if(p.state==="rejected"){
    if(now()-(p.closedMs||0)>3000)await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{voteProposal:null});
    return;
  }
  if(p.state!=="open")return;
  const voters=activeOrder();
  for(const b of bots.filter(x=>voters.includes(x.id))){
    if(voteApprovals.some(a=>a.token===p.token&&a.playerId===b.id))continue;
    const a=botAssignments[b.id];if(!a)continue;
    const yes=botVoteApproval(a.name,currentGameHints(),messages,b.name,b.difficulty);
    await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteApprovals",`${p.token}_${b.id}`),{
      gameNo:currentRoomData.gameNo,token:p.token,playerId:b.id,playerName:b.name,decision:yes?"yes":"no",createdMs:now()
    });
  }
  const a=voteApprovals.filter(x=>x.token===p.token&&voters.includes(x.playerId)),yes=a.filter(x=>x.decision==="yes").length;
  if(yes>voters.length/2){
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
      status:"voting",voteProposal:{...p,state:"accepted",closedMs:now()},
      voteRound:1,voteStage:"collecting",voteCandidates:[...voters],reconsiderEndsAt:null
    });return;
  }
  if(voters.every(id=>a.some(x=>x.playerId===id))||now()-p.createdMs>PROPOSAL_TIMEOUT_MS){
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{voteProposal:{...p,state:"rejected",closedMs:now()}});
  }
}

function voteDocId(playerId){return `g${currentRoomData.gameNo}_v${currentVoteRound()}_${playerId}`}
async function writeMyVote(targetId){
  if(currentRoomData?.status!=="voting"||!["collecting","reconsider"].includes(currentRoomData.voteStage))return toast("Vote figé");
  if(!voteCandidateIds().includes(targetId))return;
  const id=voteDocId(currentUser.uid),base={
    gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:currentUser.uid,targetId,submitted:true,confirmed:false,updatedMs:now()
  };
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",id),base,{merge:true});
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",id),{
    gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:currentUser.uid,
    playerName:participantById(currentUser.uid)?.name||"Joueur",submitted:true,confirmed:false,updatedMs:now()
  },{merge:true});
}
async function confirmMyVote(){
  if(currentRoomData?.status!=="voting"||currentRoomData.voteStage!=="confirming")return;
  const id=voteDocId(currentUser.uid),ref=fb.fsMod.doc(db,"rooms",currentRoom,"votes",id),snap=await fb.fsMod.getDoc(ref);
  if(!snap.exists())return toast("Vote manquant","Aucun vote initial.");
  await fb.fsMod.setDoc(ref,{confirmed:true,updatedMs:now()},{merge:true});
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",id),{
    gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:currentUser.uid,
    playerName:participantById(currentUser.uid)?.name||"Joueur",submitted:true,confirmed:true,updatedMs:now()
  },{merge:true});
}

function armVoteTimer(){
  clearTimeout(reconsiderClientTimer);
  if(currentRoomData?.status!=="voting"||currentRoomData.voteStage!=="reconsider")return;
  const delay=Math.max(50,reconsiderEndMs()-now()+80);
  reconsiderClientTimer=setTimeout(()=>advanceVoteAfterTimer().catch(console.error),delay);
}
async function advanceVoteAfterTimer(){
  if(currentRoomData?.status!=="voting"||currentRoomData.voteStage!=="reconsider")return;
  if(now()<reconsiderEndMs())return armVoteTimer();
  const ref=fb.fsMod.doc(db,"rooms",currentRoom);
  await fb.fsMod.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())return;
    const d=snap.data(),end=d.reconsiderEndsAt?.toMillis?.()??d.reconsiderEndsAt??0;
    if(d.status==="voting"&&d.voteStage==="reconsider"&&end<=now())tx.update(ref,{voteStage:"confirming"});
  });
}

async function hostProcessVoting(){
  if(currentRoomData.status!=="voting")return;
  const stage=currentRoomData.voteStage,voters=voteVoterIds(),sm=voteStatusMap();
  if(stage==="collecting"){
    for(const b of bots.filter(x=>voters.includes(x.id))){
      if(sm.get(b.id)?.submitted)continue;
      const a=botAssignments[b.id];if(!a)continue;
      const target=chooseBotVote(b.id,a.name,voteCandidateIds().map(id=>rosterParticipant(id)).filter(Boolean),currentGameHints(),messages,b.difficulty);
      if(!target)continue;
      const id=`g${currentRoomData.gameNo}_v${currentVoteRound()}_${b.id}`;
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",id),{
        gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:b.id,targetId:target,submitted:true,confirmed:false,updatedMs:now()
      });
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",id),{
        gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:b.id,playerName:b.name,submitted:true,confirmed:false,updatedMs:now()
      });
    }
    const latest=voteStatusMap();
    if(voters.every(id=>latest.get(id)?.submitted)){
      const end=fb.fsMod.Timestamp.fromMillis(now()+(currentRoomData.reconsiderSeconds||15)*1000);
      await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{voteStage:"reconsider",reconsiderEndsAt:end});
    }
    return;
  }
  if(stage==="reconsider"){armVoteTimer();return}
  if(stage==="confirming"){
    for(const b of bots.filter(x=>voters.includes(x.id))){
      if(sm.get(b.id)?.confirmed)continue;
      const id=`g${currentRoomData.gameNo}_v${currentVoteRound()}_${b.id}`;
      const vote=await fb.fsMod.getDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",id));if(!vote.exists())continue;
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",id),{confirmed:true,updatedMs:now()},{merge:true});
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",id),{
        gameNo:currentRoomData.gameNo,voteRound:currentVoteRound(),playerId:b.id,playerName:b.name,submitted:true,confirmed:true,updatedMs:now()
      },{merge:true});
    }
    const latest=voteStatusMap();
    if(voters.every(id=>latest.get(id)?.confirmed))await resolveVote();
  }
}
async function resolveVote(){
  const [votesSnap,secretSnap]=await Promise.all([
    fb.fsMod.getDocs(fb.fsMod.collection(db,"rooms",currentRoom,"votes")),
    fb.fsMod.getDoc(fb.fsMod.doc(db,"rooms",currentRoom,"secrets","current"))
  ]);
  const secret=secretSnap.data();if(!secret)return;
  const voters=new Set(voteVoterIds()),round=currentVoteRound();
  const valid=votesSnap.docs.map(d=>d.data()).filter(v=>v.gameNo===currentRoomData.gameNo&&(v.voteRound||1)===round&&v.confirmed&&voters.has(v.playerId));
  const counts={};valid.forEach(v=>counts[v.targetId]=(counts[v.targetId]||0)+1);
  if(!Object.keys(counts).length)return;
  const max=Math.max(...Object.values(counts)),leaders=Object.keys(counts).filter(id=>counts[id]===max);

  if(leaders.length>1){
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
      voteRound:round+1,voteStage:"collecting",voteCandidates:leaders,reconsiderEndsAt:null
    });return;
  }

  const eliminated=leaders[0],normalsWin=eliminated===secret.impostorId,batch=fb.fsMod.writeBatch(db);
  if(normalsWin){
    for(const p of activeParticipants().filter(x=>x.id!==secret.impostorId)){
      batch.update(fb.fsMod.doc(db,"rooms",currentRoom,p.bot?"bots":"players",p.id),{score:(p.score||0)+1});
    }
  }else{
    const p=participantById(secret.impostorId);
    if(p)batch.update(fb.fsMod.doc(db,"rooms",currentRoom,p.bot?"bots":"players",p.id),{score:(p.score||0)+1});
  }
  batch.update(fb.fsMod.doc(db,"rooms",currentRoom),{
    status:"postvote",voteStage:null,reconsiderEndsAt:null,
    result:{winner:normalsWin?"normal":"impostor",impostorId:secret.impostorId,eliminatedId:eliminated,majority:secret.majority,outsider:secret.outsider}
  });
  await batch.commit();
}

function enqueueBotMessage(m){
  if(!isHost||!m||String(m.playerId).startsWith("bot_")||!["playing","voting","postvote"].includes(currentRoomData?.status))return;
  botMessageQueue.push(m);processBotQueue();
}
async function processBotQueue(){
  if(botQueueBusy||!isHost)return;
  const msg=botMessageQueue.shift();if(!msg)return;botQueueBusy=true;
  try{
    const available=bots.filter(b=>botAssignments[b.id]),named=available.filter(b=>{
      const clean=v=>` ${norm(v).replace(/[^a-z0-9]+/g," ").trim()} `;
      return clean(msg.text).includes(clean(b.name));
    });
    const pool=named.length?named:available.filter(b=>shouldBotReply(b.name,msg,messages,b.difficulty));
    if(pool.length){
      const b=pool[Math.floor(Math.random()*pool.length)],a=botAssignments[b.id];
      await sleep(botReplyDelay(b.name,msg,b.difficulty));
      if(isHost&&["playing","voting","postvote"].includes(currentRoomData?.status)){
        const text=buildBotDiscussion(b.name,a.name,currentGameHints(),messages,activeParticipants(),{
          phase:currentRoomData.status,tranche:currentRoomData.hintRound||1,difficulty:b.difficulty
        });
        if(text)await sendMessage(text,b.id,b.name);
      }
    }
  }catch(e){console.warn(e)}
  finally{botQueueBusy=false;if(botMessageQueue.length)setTimeout(processBotQueue,80)}
}

function renderAll(){
  if(!currentRoomData){show("home");return}
  renderRoomRole();routeByStatus();renderLobbyPlayers();renderGameHeader();renderGamePlayers();
  renderHints();renderMessages();renderProposal();renderVoting();renderScores();renderBadges();
  if(currentRoomData.status==="postvote")renderResult();
}
function routeByStatus(){
  const s=currentRoomData.status;if(s==="lobby"){show("lobby");return}show("game");
  const chat=activeTab==="chat",vote=s==="voting",post=s==="postvote";

  $("#game-chat-panel").classList.toggle("hidden",!chat);
  $("#game-hints-panel").classList.toggle("hidden",chat||vote||post);
  $("#voting-panel").classList.toggle("hidden",chat||!vote);
  $("#result-panel").classList.toggle("hidden",chat||!post);

  const proposal=currentRoomData.voteProposal;
  $("#vote-request-panel").classList.toggle("hidden",!(s==="playing"&&proposal));
  $("#propose-vote-btn").classList.toggle("hidden",s!=="playing"||proposal?.state==="open");
  $("#host-next-game").classList.toggle("hidden",!(isHost&&post&&!chat));

  const nav=$('[data-game-tab="hints"] span:nth-child(2)');
  if(nav)nav.textContent=vote?"Vote":post?"Résultat":"Indices";
}
function renderRoomRole(){
  $("#host-panel").classList.toggle("hidden",!isHost);$("#guest-wait").classList.toggle("hidden",isHost);
  patchText("#my-role-pill",isHost?"👑 Hôte":"Joueur");
}
function renderLobbyPlayers(){
  const all=participants();patchText("#player-count",`${all.length} joueur${all.length>1?"s":""}`);
  patchHTML("#players-list",all.map(p=>{
    const host=!p.bot&&p.id===currentRoomData?.hostUid,me=!p.bot&&p.id===currentUser?.uid,online=p.bot||now()-(p.lastSeenMs||0)<OFFLINE_DROP_MS;
    return `<div class="player-row"><div class="avatar ${p.bot?"bot":""}">${p.bot?"🤖":esc((p.name||"?")[0].toUpperCase())}</div>
      <div class="player-meta"><div class="player-name">${esc(p.name)}</div><div class="player-sub">${p.bot?`IA • ${esc(p.difficulty||"Normal")}`:host?"👑 Hôte":me?"Toi":online?"À distance":"Hors ligne"}</div></div>
      ${isHost&&p.bot?`<button class="remove-bot" data-remove-bot="${p.id}">×</button>`:`<span class="${online?"status-ok":"status-off"}">●</span>`}</div>`;
  }).join(""));
  $("#start-game-btn").disabled=all.length<3;$("#start-game-btn").textContent=all.length<3?"3 participants minimum":"Commencer la partie";
}
function renderGameHeader(){
  patchText("#game-round-label",`Partie ${currentRoomData.gameNo||0} • Tranche ${currentRoomData.hintRound||0}`);
  patchText("#tranche-pill",`Tranche ${currentRoomData.hintRound||1}`);
  patchText("#phase-label",{playing:"Indices / Discussion",voting:"Vote / Discussion",postvote:"Résultat / Discussion"}[currentRoomData.status]||currentRoomData.status);
  renderTurn();
}
function renderGamePlayers(){
  const current=activeOrder()[currentRoomData.turnIndex||0],active=new Set(activeIds());
  patchHTML("#game-players",(currentRoomData.roster||[]).map(p=>`<div class="game-player ${current===p.id&&currentRoomData.status==="playing"?"turn":""} ${active.has(p.id)?"":"inactive"}">
    <div class="avatar ${p.bot?"bot":""}">${p.bot?"🤖":esc((p.name||"?")[0])}</div><div class="game-player-name">${esc(p.name)}</div></div>`).join(""));
}
function renderTurn(){
  if(currentRoomData.status!=="playing")return;
  const order=activeOrder(),p=rosterParticipant(order[currentRoomData.turnIndex||0]),given=trancheGiven(),count=order.filter(id=>given.has(id)).length;
  const input=$("#hint-input"),send=$("#send-hint-btn"),note=$("#hint-wait-note"),box=$("#turn-box");input.disabled=false;
  if(!p){
    box.className="turn-banner turn-waiting";box.innerHTML=`<div class="turn-avatar">…</div><div class="turn-copy"><span class="turn-kicker">TRANCHE ${currentRoomData.hintRound||1}</span><strong>Synchronisation…</strong><small>Le tour se prépare.</small></div>`;
    send.disabled=true;send.classList.remove("ready");return;
  }
  const mine=p.id===currentUser.uid;
  box.className=`turn-banner ${mine?"turn-mine":p.bot?"turn-bot":"turn-other"}`;
  box.innerHTML=`<div class="turn-avatar">${p.bot?"🤖":esc((p.name||"?")[0].toUpperCase())}</div><div class="turn-copy">
    <span class="turn-kicker">${mine?"À TON TOUR":`TRANCHE ${currentRoomData.hintRound||1} • ${count}/${order.length}`}</span>
    <strong>${mine?"Donne ton indice":`Tour de ${esc(p.name)}${p.bot?" 🤖":""}`}</strong><small>${mine?"Un mot puis ➤.":p.bot?"L’IA réfléchit…":"En attente de son indice…"}</small></div>`;
  send.disabled=!mine;send.classList.toggle("ready",mine);input.placeholder=mine?"Écris ton indice…":"Prépare ton prochain indice…";
  note.textContent=mine?"Appuie sur ➤ pour envoyer.":"Tu peux préparer ton prochain mot.";
}
function renderHints(){
  const data=currentGameHints().filter(h=>h.revealed||h.playerId===currentUser.uid||isHost);
  patchText("#hint-count",data.length);patchHTML("#hints-list",data.slice(-60).map(h=>`<div class="hint-row"><b>${esc(h.playerName)}</b><strong>${h.revealed?esc(h.word):"••••"}</strong><span>T${h.round}</span></div>`).join("")||`<div class="player-sub">Aucun indice.</div>`);
}
function renderMessages(){
  const list=$("#chat-list");if(!list)return;
  const data=messages.slice(-80),key=data.map(m=>m.id).join(",");
  if(list.__key===key)return;
  const near=list.scrollHeight-list.scrollTop-list.clientHeight<90;
  list.innerHTML=data.map(m=>`<div class="message ${m.playerId===currentUser.uid?"me":""}"><div class="who">${esc(m.playerName)}</div><div class="body">${esc(m.text)}</div></div>`).join("");
  list.__key=key;if(near||!list.__done){list.scrollTop=list.scrollHeight;list.__done=true}
}
function renderProposal(){
  const p=currentRoomData.voteProposal;if(!p||currentRoomData.status!=="playing")return;
  const voters=activeOrder(),a=voteApprovals.filter(x=>x.token===p.token&&voters.includes(x.playerId)),yes=a.filter(x=>x.decision==="yes").length,mine=a.find(x=>x.playerId===currentUser.uid);
  patchText("#vote-request-by",p.state==="rejected"?"Proposition refusée. Les indices continuent.":`${p.byName} propose de voter. Les indices continuent.`);
  $("#vote-request-progress").style.width=`${Math.round(yes/Math.max(1,voters.length)*100)}%`;
  patchText("#vote-request-stats",`${yes}/${voters.length} acceptent • il faut plus de 50 %`);
  if(p.state!=="open")patchHTML("#vote-request-actions",`<div class="player-sub">La partie continue.</div>`);
  else if(mine)patchHTML("#vote-request-actions",`<div class="player-sub">Réponse enregistrée : ${mine.decision==="yes"?"✅ accepter":"❌ continuer"}</div>`);
  else{
    patchHTML("#vote-request-actions",`<button class="yes-btn" id="vote-yes">✅ Voter</button><button class="no-btn" id="vote-no">❌ Continuer</button>`);
    $("#vote-yes")?.addEventListener("click",()=>answerVoteRequest("yes"));$("#vote-no")?.addEventListener("click",()=>answerVoteRequest("no"));
  }
}
function renderVoting(){
  if(currentRoomData.status!=="voting")return;
  const stage=currentRoomData.voteStage||"collecting",sm=voteStatusMap(),mine=sm.get(currentUser.uid);
  patchText("#vote-stage-help",stage==="collecting"?"Choisis ton suspect.":stage==="reconsider"?"Tout le monde a voté : tu peux encore changer d’avis.":"Vote figé : confirme définitivement.");
  $("#vote-timer").classList.toggle("hidden",stage!=="reconsider");if(stage==="reconsider")updateVoteCountdown();
  patchHTML("#vote-status-list",voteVoterIds().map(id=>{const p=rosterParticipant(id),s=sm.get(id),cls=s?.confirmed?"confirmed":s?.submitted?"voted":"";return `<div class="vote-status"><span>${esc(p?.name||"Joueur")}</span><span style="display:flex;gap:5px;align-items:center"><i class="status-dot ${cls}"></i>${s?.confirmed?"Confirmé":s?.submitted?"A voté":"Attente"}</span></div>`}).join(""));
  const selected=$("#vote-choices").dataset.selectedId||"",locked=stage==="confirming";
  patchHTML("#vote-choices",voteCandidateIds().map(id=>`<button class="vote-choice ${selected===id?"selected":""}" data-vote-id="${id}" ${locked?"disabled":""}>${esc(rosterParticipant(id)?.name||"Joueur")}</button>`).join(""));
  if(!locked)$$("[data-vote-id]").forEach(b=>b.addEventListener("click",async()=>{$("#vote-choices").dataset.selectedId=b.dataset.voteId;patchText("#my-vote-label",`Choix actuel : ${rosterParticipant(b.dataset.voteId)?.name||""}`);if(stage==="reconsider"&&mine?.submitted)await writeMyVote(b.dataset.voteId);scheduleRender()}));
  $("#submit-vote-btn").classList.toggle("hidden",stage!=="collecting"||!!mine?.submitted);
  $("#confirm-vote-btn").classList.toggle("hidden",stage!=="confirming"||!!mine?.confirmed);
}
function updateVoteCountdown(){
  if(currentRoomData?.voteStage!=="reconsider")return;
  const n=Math.max(0,Math.ceil((reconsiderEndMs()-now())/1000));patchText("#vote-timer",n);
  if(n<=0)advanceVoteAfterTimer().catch(()=>{});else setTimeout(updateVoteCountdown,250);
}
async function renderResult(){
  const r=currentRoomData.result;if(!r)return;
  const normals=r.winner==="normal";patchText("#result-emoji",normals?"🏆":"😈");patchText("#result-title",normals?"Les joueurs normaux gagnent !":"L’imposteur gagne !");
  patchText("#result-majority-name",r.majority.name);patchText("#result-impostor-name",r.outsider.name);$("#result-images").classList.remove("hidden");
  setCharacterPhoto($("#result-majority-photo"),r.majority.name);setCharacterPhoto($("#result-impostor-photo"),r.outsider.name);
  const imp=participantById(r.impostorId),elim=participantById(r.eliminatedId);
  $("#result-text").innerHTML=normals?`L’imposteur était <b>${esc(imp?.name||"")}</b>.`:`Le groupe a éliminé <b>${esc(elim?.name||"")}</b>.<br><br>L’imposteur était <b>${esc(imp?.name||"")}</b>.`;
}
function renderScores(){patchHTML("#score-list",participants().sort((a,b)=>(b.score||0)-(a.score||0)).map(p=>`<div class="score-row"><span>${esc(p.name)}</span><b>${p.score||0}</b></div>`).join(""))}
function renderBadges(){patchText("#hints-badge",unreadHints);$("#hints-badge").classList.toggle("hidden",!unreadHints);patchText("#chat-badge",unreadChat);$("#chat-badge").classList.toggle("hidden",!unreadChat)}
function setGameTab(tab){
  activeTab=tab;if(tab==="hints")unreadHints=0;else unreadChat=0;
  $$("[data-game-tab]").forEach(b=>b.classList.toggle("active",b.dataset.gameTab===tab));
  renderBadges();scheduleRender();
}

function selectedAnime(){return localSettings.mode==="auto"?animeDB:$$("#anime-grid input:checked").map(x=>x.value)}
function renderAnimeGrid(){patchHTML("#anime-grid",animeDB.map(a=>`<label class="anime-option"><input type="checkbox" value="${esc(a)}" checked> ${esc(a)}</label>`).join(""))}
function refreshAiStatus(){
  const stats=getAiStats({difficulty:localSettings.difficulty,allowedAnime:selectedAnime(),mix:$("#mix-anime").checked,popularityMin:96});
  patchText("#ai-status",stats.count?`${stats.count} duos vérifiés`:"Aucun duo avec ces filtres");
  patchText("#ai-details","Paires vérifiées manuellement • apparence + personnalité + rôle + combat + histoire.");
}
async function addBot(name,difficulty){if(isHost)await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"bots",randomId("bot")),{name,difficulty,type:"bot",score:0})}
async function fillBots(target=4){if(!isHost)return;const a=BOT_PROFILES.filter(p=>!bots.some(b=>b.name===p.name));for(const p of a.slice(0,Math.max(0,target-bots.length)))await addBot(p.name,p.difficulty)}
async function removeBot(id){if(isHost)await fb.fsMod.deleteDoc(fb.fsMod.doc(db,"rooms",currentRoom,"bots",id))}
function openBotModal(){patchHTML("#bot-options",BOT_PROFILES.map(p=>`<div class="player-row"><div class="avatar bot">🤖</div><div class="player-meta"><div class="player-name">${p.name}</div><div class="player-sub">${p.difficulty}</div></div><button class="mini-btn" data-add-bot="${p.name}" data-diff="${p.difficulty}">Ajouter</button></div>`).join(""));$("#bot-modal").classList.remove("hidden")}

function openLeaveModal(){if(!currentRoom)return;$("#leave-modal").classList.remove("hidden")}
async function leaveRoom(){
  if(leavingRoom)return;leavingRoom=true;
  try{
    const others=players.filter(p=>p.id!==currentUser.uid&&now()-(p.lastSeenMs||0)<OFFLINE_DROP_MS);
    if(isHost&&others.length){
      await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{hostUid:others[0].id,hostLeaseUntil:fb.fsMod.Timestamp.fromMillis(now()+HOST_LEASE_MS)});
      await fb.fsMod.deleteDoc(fb.fsMod.doc(db,"rooms",currentRoom,"players",currentUser.uid));
    }else if(isHost)await fb.fsMod.deleteDoc(fb.fsMod.doc(db,"rooms",currentRoom));
    else await fb.fsMod.deleteDoc(fb.fsMod.doc(db,"rooms",currentRoom,"players",currentUser.uid));
  }catch(e){console.warn(e)}
  finally{$("#leave-modal").classList.add("hidden");resetHome();leavingRoom=false}
}
function resetHome(){
  markOffline();cleanupRoom();currentRoom=null;currentRoomData=null;isHost=false;players=[];bots=[];assignment=null;botAssignments={};
  localStorage.removeItem("anime_room");show("home");
}

function fallbackCharacterImage(name){
  const clean=String(name||"?").replace(/[&<>]/g,""),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="100%" height="100%" fill="#111c2b"/><circle cx="120" cy="115" r="54" fill="#7c3aed"/><text x="120" y="225" text-anchor="middle" fill="white" font-family="Arial" font-size="18">${clean}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
async function getCharacterImage(name){
  if(characterImageCache.has(name))return characterImageCache.get(name);
  const key="anime_char_img_v7_"+name;try{const c=localStorage.getItem(key);if(c){characterImageCache.set(name,c);return c}}catch{}
  try{
    const r=await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`),d=await r.json(),img=d?.data?.[0]?.images?.webp?.image_url||d?.data?.[0]?.images?.jpg?.image_url;
    if(img){characterImageCache.set(name,img);try{localStorage.setItem(key,img)}catch{};return img}
  }catch{}
  return fallbackCharacterImage(name);
}
async function setCharacterPhoto(img,name){if(!img)return;img.onerror=()=>{img.onerror=null;img.src=fallbackCharacterImage(name)};img.src=await getCharacterImage(name)}
async function renderCharacter(){
  const visible=$("#toggle-character-btn").dataset.visible==="1";
  if(!assignment){patchText("#character-name","••••••");patchText("#character-anime","Secret");$("#character-photo-wrap").classList.add("hidden");return}
  patchText("#character-name",visible?assignment.name:"••••••");patchText("#character-anime",visible?assignment.anime:"Secret");
  if(visible){$("#character-photo-wrap").classList.remove("hidden");setCharacterPhoto($("#character-photo"),assignment.name)}else $("#character-photo-wrap").classList.add("hidden");
}

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e});
function maybeOfferInstallOnce(){if(localStorage.getItem(INSTALL_SEEN_KEY)!=="1"&&!window.matchMedia?.("(display-mode: standalone)")?.matches)setTimeout(()=>$("#install-modal").classList.remove("hidden"),900)}
async function installApp(){localStorage.setItem(INSTALL_SEEN_KEY,"1");$("#install-modal").classList.add("hidden");if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else toast("Installation","Menu ⋮ → Installer l’application.")}

$("#create-room-btn").addEventListener("click",()=>createRoom().catch(e=>toast("Création impossible",e.message)));
$("#solo-room-btn").addEventListener("click",()=>createRoom({solo:true}).catch(e=>toast("Mode solo impossible",e.message)));
$("#join-room-btn").addEventListener("click",()=>joinRoom().catch(e=>toast("Connexion impossible",e.message)));
$("#copy-code-btn").addEventListener("click",async()=>{await navigator.clipboard.writeText(currentRoom);toast("Code copié",currentRoom)});
$("#share-room-btn").addEventListener("click",async()=>{const t=`Rejoins ma salle Anime Imposteur : ${currentRoom}`;if(navigator.share)await navigator.share({title:"Anime Imposteur",text:t,url:location.href});else await navigator.clipboard.writeText(t+" "+location.href)});
$("#start-game-btn").addEventListener("click",()=>startGame().catch(e=>toast("Erreur",e.message)));
$("#next-game-btn").addEventListener("click",()=>startGame().catch(e=>toast("Erreur",e.message)));
$("#send-hint-btn").addEventListener("click",()=>sendHint().catch(e=>toast("Erreur",e.message)));
$("#hint-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("#send-hint-btn").click()});
$("#send-chat-btn").addEventListener("click",()=>{const t=$("#chat-input").value;$("#chat-input").value="";sendMessage(t).catch(e=>toast("Erreur",e.message))});
$("#chat-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("#send-chat-btn").click()});
$("#propose-vote-btn").addEventListener("click",()=>proposeVote().catch(e=>toast("Erreur",e.message)));
$("#submit-vote-btn").addEventListener("click",async()=>{const id=$("#vote-choices").dataset.selectedId;if(!id)return toast("Choisis un joueur");await writeMyVote(id);scheduleRender()});
$("#confirm-vote-btn").addEventListener("click",()=>confirmMyVote().catch(e=>toast("Erreur",e.message)));
$("#toggle-character-btn").addEventListener("click",()=>{const v=$("#toggle-character-btn").dataset.visible==="1";$("#toggle-character-btn").dataset.visible=v?"0":"1";$("#toggle-character-btn").textContent=v?"Voir":"Cacher";renderCharacter()});
$("#add-bot-btn").addEventListener("click",openBotModal);$("#fill-bots-btn").addEventListener("click",()=>fillBots(4));
$("#close-bot-modal").addEventListener("click",()=>$("#bot-modal").classList.add("hidden"));
$("#leave-room-btn").addEventListener("click",openLeaveModal);$("#leave-game-btn").addEventListener("click",openLeaveModal);
$("#confirm-leave-btn").addEventListener("click",leaveRoom);$("#cancel-leave-btn").addEventListener("click",()=>$("#leave-modal").classList.add("hidden"));
$("#install-now-btn").addEventListener("click",installApp);$("#install-later-btn").addEventListener("click",()=>{localStorage.setItem(INSTALL_SEEN_KEY,"1");$("#install-modal").classList.add("hidden")});
$("#join-code").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$$("[data-game-tab]").forEach(b=>b.addEventListener("click",()=>setGameTab(b.dataset.gameTab)));
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add-bot]");if(add)addBot(add.dataset.addBot,add.dataset.diff).then(()=>$("#bot-modal").classList.add("hidden"));
  const rem=e.target.closest("[data-remove-bot]");if(rem)removeBot(rem.dataset.removeBot);
  const mode=e.target.closest("[data-mode]")?.dataset.mode;if(mode){localSettings.mode=mode;$$("[data-mode]").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));$("#manual-anime-panel").classList.toggle("hidden",mode!=="manual");refreshAiStatus()}
  const diff=e.target.closest("[data-difficulty]")?.dataset.difficulty;if(diff){localSettings.difficulty=diff;$$("[data-difficulty]").forEach(x=>x.classList.toggle("active",x.dataset.difficulty===diff));refreshAiStatus()}
});
$("#mix-anime").addEventListener("change",refreshAiStatus);$("#anime-grid").addEventListener("change",refreshAiStatus);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")startHeartbeat();else markOffline()});window.addEventListener("pagehide",markOffline);

const savedName=localStorage.getItem("imposteur_name");if(savedName)$("#home-name").value=savedName;
renderAnimeGrid();refreshAiStatus();initFirebase();
if("serviceWorker" in navigator)window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./service-worker.js?v=7.1");r.update().catch(()=>{})}catch{}});
