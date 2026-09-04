import { firebaseConfig } from "./firebase-config.js";
import { animeDB, chooseIntelligentPair, getAiStats } from "./ai-engine.js";
import {
  chooseBotHint, chooseBotVote, botVoteApproval, buildBotDiscussion,
  shouldBotReply, botReplyDelay
} from "./bot-engine.js";

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

let fb,auth,db,currentUser;
let currentRoom=null,currentRoomData=null,isHost=false;
let players=[],bots=[],assignment=null,botAssignments={};
let hints=[],messages=[],voteApprovals=[],voteStatuses=[];
let activeTab="hints", unreadHints=0, unreadChat=0;
let installPrompt=null;
const characterImageCache=new Map();
const INSTALL_SEEN_KEY="anime_imposteur_install_prompt_seen_v1";
let gameInitKey="";
let hostProcessing=false;
let hostReconsiderTimer=null;
let hostBotDiscussionTimer=null;
let hostLastBotReplyToMessageId=null;
let hostBotReplyBusy=false;
let leavingRoom=false;

const unsubs=[];
const localSettings={mode:"auto",difficulty:"hard"};

function cleanup(){
  while(unsubs.length){try{unsubs.pop()()}catch{}}
  clearTimeout(hostReconsiderTimer);
  clearTimeout(hostBotDiscussionTimer);
}

function show(id){
  $$(".screen").forEach(x=>x.classList.remove("active"));
  $("#screen-"+id).classList.add("active");
  window.scrollTo({top:0});
}

function safeName(v){return (String(v||"").trim().slice(0,20)||"Joueur")}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function randomId(prefix="id"){return prefix+"_"+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now())}
function randomCode(){
  const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const n=new Uint32Array(5);crypto.getRandomValues(n);
  return [...n].map(x=>a[x%a.length]).join("");
}
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function toast(title,text=""){
  const el=document.createElement("div");
  el.className="toast";
  el.innerHTML=`<strong>${esc(title)}</strong>${text?`<span>${esc(text)}</span>`:""}`;
  $("#toast-layer").appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},3000);
}


function fallbackCharacterImage(name){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320">
    <rect width="100%" height="100%" fill="#111c2b"/>
    <circle cx="120" cy="115" r="54" fill="#7c3aed"/>
    <circle cx="98" cy="108" r="8" fill="white"/>
    <circle cx="142" cy="108" r="8" fill="white"/>
    <text x="120" y="225" text-anchor="middle" fill="white" font-family="Arial" font-size="18">${String(name||"?").replace(/[&<>]/g,"")}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}

async function getCharacterImage(name){
  if(!name)return null;
  if(characterImageCache.has(name))return characterImageCache.get(name);

  const storageKey="anime_char_img_"+name;
  try{
    const cached=localStorage.getItem(storageKey);
    if(cached){
      characterImageCache.set(name,cached);
      return cached;
    }
  }catch{}

  try{
    const url=`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`;
    const res=await fetch(url,{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error("image api");
    const data=await res.json();
    const image=data?.data?.[0]?.images?.jpg?.image_url || data?.data?.[0]?.images?.webp?.image_url || null;
    if(image){
      characterImageCache.set(name,image);
      try{localStorage.setItem(storageKey,image)}catch{}
      return image;
    }
  }catch(e){
    console.warn("Character image unavailable:",name,e);
  }

  const fallback=fallbackCharacterImage(name);
  characterImageCache.set(name,fallback);
  return fallback;
}

async function setCharacterPhoto(imgEl,name){
  if(!imgEl)return;
  imgEl.src=await getCharacterImage(name);
  imgEl.alt=name||"Personnage";
}

function maybeOfferInstallOnce(){
  if(localStorage.getItem(INSTALL_SEEN_KEY)==="1")return;
  if(window.matchMedia?.("(display-mode: standalone)")?.matches)return;

  // Show after the user has actually entered a room, not on the landing page.
  setTimeout(()=>{
    if(localStorage.getItem(INSTALL_SEEN_KEY)==="1")return;
    $("#install-modal")?.classList.remove("hidden");
  },900);
}

async function initFirebase(){
  if(!firebaseConfig){
    $("#fatal-config").classList.remove("hidden");
    $("#fatal-config").innerHTML="<strong>Firebase non configuré.</strong><span>Relance le déploiement automatique V6.</span>";
    return;
  }
  try{
    const appMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
    const authMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
    const fsMod=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
    const app=appMod.initializeApp(firebaseConfig);
    auth=authMod.getAuth(app);db=fsMod.getFirestore(app);fb={authMod,fsMod};
    authMod.onAuthStateChanged(auth,async user=>{
      if(!user){
        try{await authMod.signInAnonymously(auth)}catch(e){
          $("#fatal-config").classList.remove("hidden");
          $("#fatal-config").innerHTML=`<strong>Connexion Firebase impossible.</strong><span>${esc(e.message)}</span>`;
        }
        return;
      }
      currentUser=user;
      $("#connection-dot").classList.add("online");
      const saved=localStorage.getItem("anime_room");
      if(saved) resumeRoom(saved).catch(()=>localStorage.removeItem("anime_room"));
    });
  }catch(e){
    $("#fatal-config").classList.remove("hidden");
    $("#fatal-config").innerHTML=`<strong>Firebase ne charge pas.</strong><span>${esc(e.message)}</span>`;
  }
}
async function ensureUserReady(){
  if(currentUser && fb && db)return currentUser;

  toast("Connexion…","Initialisation de Firebase.");

  // Laisse le chargement dynamique de Firebase / Auth finir sur mobile lent.
  for(let i=0;i<40;i++){
    if(currentUser && fb && db)return currentUser;
    await new Promise(r=>setTimeout(r,250));
  }

  // Dernière tentative explicite d'authentification anonyme.
  if(auth && fb?.authMod){
    try{
      const cred=await fb.authMod.signInAnonymously(auth);
      currentUser=cred.user;
      if(currentUser && db)return currentUser;
    }catch(e){
      console.error("Anonymous auth failed",e);
      throw new Error("Connexion Firebase impossible : "+(e.code||e.message||"auth"));
    }
  }

  throw new Error("Firebase n'est pas encore prêt. Vérifie Internet puis réessaie.");
}

async function createRoom({solo=false}={}){
  const btn=solo?$("#solo-room-btn"):$("#create-room-btn");
  const oldText=btn?.textContent||"";
  if(btn){
    btn.disabled=true;
    btn.textContent=solo?"Préparation des IA…":"Création…";
  }

  try{
    await ensureUserReady();

    const name=safeName($("#home-name").value);
    localStorage.setItem("imposteur_name",name);

    const {doc,getDoc,setDoc,serverTimestamp}=fb.fsMod;
    let code=null;

    for(let i=0;i<12;i++){
      const c=randomCode();
      const candidate=await getDoc(doc(db,"rooms",c));
      if(!candidate.exists()){
        code=c;
        break;
      }
    }
    if(!code)throw new Error("Impossible de générer un code de salle.");

    await setDoc(doc(db,"rooms",code),{
      hostUid:currentUser.uid,
      status:"lobby",
      gameNo:0,
      hintRound:0,
      turnIndex:0,
      order:[],
      hiddenHints:false,
      reconsiderSeconds:15,
      createdAt:serverTimestamp()
    });

    await setDoc(doc(db,"rooms",code,"players",currentUser.uid),{
      name,
      type:"human",
      score:0,
      joinedAt:serverTimestamp()
    });

    // Affiche immédiatement le Lobby, puis branche les listeners.
    currentRoom=code;
    $("#room-code").textContent=code;
    $("#game-room-code").textContent=code;
    show("lobby");

    await enterRoom(code);

    if(solo){
      await fillBots(4);
      toast("Mode solo prêt","4 IA ont rejoint.");
    }else{
      toast("Salle créée",`Code : ${code}`);
    }
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=oldText;
    }
  }
}

async function joinRoom(){
  const btn=$("#join-room-btn");
  const oldText=btn?.textContent||"";
  if(btn){
    btn.disabled=true;
    btn.textContent="Connexion…";
  }

  try{
    await ensureUserReady();

    const code=$("#join-code").value.trim().toUpperCase();
    if(code.length!==5)throw new Error("Le code doit contenir 5 caractères.");

    const name=safeName($("#home-name").value);
    localStorage.setItem("imposteur_name",name);

    const {doc,getDoc,setDoc,serverTimestamp}=fb.fsMod;
    const room=await getDoc(doc(db,"rooms",code));
    if(!room.exists())throw new Error("Salle introuvable.");

    await setDoc(doc(db,"rooms",code,"players",currentUser.uid),{
      name,
      type:"human",
      score:0,
      joinedAt:serverTimestamp()
    },{merge:true});

    show("lobby");
    await enterRoom(code);
    toast("Salle rejointe",code);
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=oldText;
    }
  }
}

async function resumeRoom(code){
  if(!currentUser||currentRoom)return;
  const {doc,getDoc}=fb.fsMod;
  const [room,me]=await Promise.all([
    getDoc(doc(db,"rooms",code)),
    getDoc(doc(db,"rooms",code,"players",currentUser.uid))
  ]);
  if(room.exists()&&me.exists())await enterRoom(code);
}

async function enterRoom(code){
  cleanup();
  currentRoom=code;localStorage.setItem("anime_room",code);maybeOfferInstallOnce();
  $("#room-code").textContent=code;$("#game-room-code").textContent=code;
  const {doc,collection,onSnapshot}=fb.fsMod;

  unsubs.push(onSnapshot(doc(db,"rooms",code),snap=>{
    if(!snap.exists()){if(!leavingRoom)toast("Salle fermée");resetHome();return}
    const prev=currentRoomData;
    currentRoomData=snap.data();
    isHost=currentRoomData.hostUid===currentUser.uid;
    renderRoomRole();
    routeByStatus(prev);
    renderGameHeader();
    if(isHost)hostTick().catch(console.error);
  }));

  unsubs.push(onSnapshot(collection(db,"rooms",code,"players"),snap=>{
    players=snap.docs.map(d=>({id:d.id,...d.data(),bot:false}));
    renderLobbyPlayers();renderGamePlayers();renderScores();
    if(isHost)hostTick().catch(console.error);
  }));
  unsubs.push(onSnapshot(collection(db,"rooms",code,"bots"),snap=>{
    bots=snap.docs.map(d=>({id:d.id,...d.data(),bot:true}));
    renderLobbyPlayers();renderGamePlayers();renderScores();
    if(isHost)hostTick().catch(console.error);
  }));
  unsubs.push(onSnapshot(collection(db,"rooms",code,"hints"),snap=>{
    const oldIds=new Set(hints.map(x=>x.id));
    hints=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.gameNo===currentRoomData?.gameNo);
    hints.sort((a,b)=>(a.round-b.round)||(a.orderIndex-b.orderIndex));
    renderHints();
    for(const h of hints)if(!oldIds.has(h.id)&&gameInitKey){
      if(activeTab!=="hints"){unreadHints++;renderBadges()}
      toast(`${h.playerName} a donné un indice`,h.revealed?`« ${h.word} »`:"Indice enregistré");
    }
    if(isHost)hostTick().catch(console.error);
  }));
  unsubs.push(onSnapshot(collection(db,"rooms",code,"messages"),snap=>{
    const oldIds=new Set(messages.map(x=>x.id));
    messages=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.gameNo===currentRoomData?.gameNo);
    messages.sort((a,b)=>(a.createdMs||0)-(b.createdMs||0));
    renderMessages();
    for(const m of messages)if(!oldIds.has(m.id)&&gameInitKey&&m.playerId!==currentUser.uid){
      if(activeTab!=="chat"&&currentRoomData?.status!=="postvote"){unreadChat++;renderBadges()}
      toast(`${m.playerName}`,m.text.slice(0,48));
    }
    if(isHost)maybeBotDiscuss().catch(console.error);
  }));
  unsubs.push(onSnapshot(collection(db,"rooms",code,"voteApprovals"),snap=>{
    voteApprovals=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.token===currentRoomData?.voteRequestToken);
    renderVoteRequest();
    if(isHost)hostTick().catch(console.error);
  }));
  unsubs.push(onSnapshot(collection(db,"rooms",code,"voteStatus"),snap=>{
    voteStatuses=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.gameNo===currentRoomData?.gameNo);
    renderVoting();
    if(isHost)hostTick().catch(console.error);
  }));
  unsubs.push(onSnapshot(doc(db,"rooms",code,"assignments",currentUser.uid),snap=>{
    assignment=snap.exists()?snap.data():null;renderCharacter();
  }));

  // Host-only bot assignments
  if(isHost) subscribeBotAssignments();
}

function subscribeBotAssignments(){
  if(!currentRoom||!fb)return;
  const {collection,onSnapshot}=fb.fsMod;
  const unsub=onSnapshot(collection(db,"rooms",currentRoom,"botAssignments"),snap=>{
    botAssignments={};
    snap.docs.forEach(d=>botAssignments[d.id]=d.data());
    if(isHost)hostTick().catch(console.error);
  });
  unsubs.push(unsub);
}

function routeByStatus(prev){
  const s=currentRoomData.status;
  if(s==="lobby"){show("lobby");gameInitKey="";return}
  show("game");
  if(!gameInitKey||gameInitKey!==`${currentRoomData.gameNo}`){
    gameInitKey=`${currentRoomData.gameNo}`;unreadHints=unreadChat=0;renderBadges();
    activeTab="hints";setGameTab("hints",false);
  }
  const voting=s==="voting";
  $("#voting-panel").classList.toggle("hidden",!voting);
  $("#result-panel").classList.toggle("hidden",s!=="postvote");
  $("#vote-request-panel").classList.toggle("hidden",s!=="vote_request");
  $("#game-hints-panel").classList.toggle("hidden",voting||s==="postvote"||activeTab!=="hints");
  $("#game-chat-panel").classList.toggle("hidden",voting||s==="postvote"||activeTab!=="chat");
  $("#propose-vote-btn").classList.toggle("hidden",voting||s==="postvote"||s==="vote_request");
  $("#host-next-game").classList.toggle("hidden",!(isHost&&s==="postvote"));
  if(s==="postvote"){renderResult();renderMessages();renderScores()}
  if(voting)renderVoting();
  if(prev?.status!==s){
    if(s==="vote_request")toast("Vote proposé","Plus de 50 % doivent accepter.");
    if(s==="voting")toast("Le vote commence","On voit qui a voté, pas son choix.");
    if(s==="postvote")toast("Résultat disponible","La discussion reste ouverte.");
  }
}

function renderRoomRole(){
  $("#host-panel").classList.toggle("hidden",!isHost);
  $("#guest-wait").classList.toggle("hidden",isHost);
  $("#my-role-pill").textContent=isHost?"👑 Hôte":"Joueur";
}

function participants(){
  return [...players,...bots];
}
function participantById(id){return participants().find(p=>p.id===id)}
function orderedParticipants(){
  const map=new Map(participants().map(p=>[p.id,p]));
  return (currentRoomData?.order||[]).map(id=>map.get(id)).filter(Boolean);
}

function renderLobbyPlayers(){
  const all=participants();
  $("#player-count").textContent=`${all.length} joueur${all.length>1?"s":""}`;
  $("#players-list").innerHTML=all.map(p=>{
    const host=!p.bot&&p.id===currentRoomData?.hostUid;
    const me=!p.bot&&p.id===currentUser?.uid;
    return `<div class="player-row">
      <div class="avatar ${p.bot?"bot":""}">${p.bot?"🤖":esc((p.name||"?")[0].toUpperCase())}</div>
      <div class="player-meta">
        <div class="player-name">${esc(p.name)}</div>
        <div class="player-sub">${p.bot?"IA":host?"👑 Hôte":me?"Toi":"À distance"}</div>
      </div>
      ${isHost&&p.bot?`<button class="remove-bot" data-remove-bot="${p.id}">×</button>`:`<span class="status-ok">●</span>`}
    </div>`
  }).join("");
  $("#start-game-btn").disabled=all.length<3;
  $("#start-game-btn").textContent=all.length<3?"3 participants minimum":"Commencer la partie";
}

function renderGamePlayers(){
  if(!currentRoomData)return;
  const order=orderedParticipants();const current=order[currentRoomData.turnIndex]?.id;
  $("#game-players").innerHTML=participants().map(p=>`<div class="game-player ${current===p.id&&currentRoomData.status==="playing"?"turn":""}">
    <div class="avatar ${p.bot?"bot":""}">${p.bot?"🤖":esc((p.name||"?")[0])}</div>
    <div class="game-player-name">${esc(p.name)}</div>
  </div>`).join("");
}

function renderGameHeader(){
  if(!currentRoomData)return;
  $("#game-round-label").textContent=`Partie ${currentRoomData.gameNo||0} • Manche ${currentRoomData.hintRound||0}`;
  const labels={playing:"Indices / Discussion",vote_request:"Proposition de vote",voting:"Vote",postvote:"Résultat"};
  $("#phase-label").textContent=labels[currentRoomData.status]||currentRoomData.status;
  renderTurn();
}

async function renderCharacter(){
  const visible=$("#toggle-character-btn").dataset.visible==="1";
  const wrap=$("#character-photo-wrap");
  const img=$("#character-photo");

  if(!assignment){
    $("#character-name").textContent="••••••";
    $("#character-anime").textContent="Secret";
    wrap?.classList.add("hidden");
    return;
  }

  $("#character-name").textContent=visible?assignment.name:"••••••";
  $("#character-anime").textContent=visible?assignment.anime:"Secret";

  if(visible){
    wrap?.classList.remove("hidden");
    await setCharacterPhoto(img,assignment.name);
  }else{
    wrap?.classList.add("hidden");
    if(img)img.removeAttribute("src");
  }
}

function renderTurn(){
  if(!currentRoomData||currentRoomData.status!=="playing")return;
  const order=orderedParticipants();
  const p=order[currentRoomData.turnIndex];
  const complete=currentRoomData.turnIndex>=order.length;
  $("#next-hint-round-btn").classList.toggle("hidden",!(isHost&&complete));
  if(complete){
    $("#turn-box").innerHTML=`<strong>Tout le monde a joué.</strong><small>Discutez, proposez un vote ou l’hôte peut lancer une nouvelle manche d’indices.</small>`;
    $("#hint-composer").classList.add("hidden");
    return;
  }
  $("#turn-box").innerHTML=`<small>C’EST AU TOUR DE</small><strong>${esc(p?.name||"...")}</strong><small>${p?.id===currentUser.uid?"Donne un seul mot.":"En attente de son indice…"}</small>`;
  $("#hint-composer").classList.toggle("hidden",p?.id!==currentUser.uid);
}

function currentGameHints(){return hints.filter(h=>h.gameNo===currentRoomData?.gameNo)}
function renderHints(){
  const data=currentGameHints().filter(h=>h.revealed||h.playerId===currentUser?.uid||isHost);
  $("#hint-count").textContent=data.length;
  $("#hints-list").innerHTML=data.length?data.map(h=>`<div class="hint-row">
    <b>${esc(h.playerName)}</b><strong>${h.revealed?esc(h.word):"••••"}</strong><span>M${h.round}</span>
  </div>`).join(""):`<div class="player-sub">Aucun indice pour le moment.</div>`;
  renderTurn();
}

function renderMessages(){
  const list=currentRoomData?.status==="postvote"?$("#post-chat-list"):$("#chat-list");
  if(!list)return;
  const data=messages.filter(m=>m.gameNo===currentRoomData?.gameNo);
  list.innerHTML=data.map(m=>`<div class="message ${m.playerId===currentUser?.uid?"me":""}">
    <div class="who">${esc(m.playerName)}</div><div class="body">${esc(m.text)}</div>
  </div>`).join("");
  list.scrollTop=list.scrollHeight;
}

function renderBadges(){
  $("#hints-badge").textContent=unreadHints;$("#hints-badge").classList.toggle("hidden",!unreadHints);
  $("#chat-badge").textContent=unreadChat;$("#chat-badge").classList.toggle("hidden",!unreadChat);
}

function setGameTab(tab,reset=true){
  activeTab=tab;if(reset){if(tab==="hints")unreadHints=0;else unreadChat=0;renderBadges()}
  $$("[data-game-tab]").forEach(b=>b.classList.toggle("active",b.dataset.gameTab===tab));
  if(currentRoomData?.status==="playing"){
    $("#game-hints-panel").classList.toggle("hidden",tab!=="hints");
    $("#game-chat-panel").classList.toggle("hidden",tab!=="chat");
  }
}

function renderVoteRequest(){
  if(!currentRoomData||currentRoomData.status!=="vote_request")return;
  const token=currentRoomData.voteRequestToken;
  const data=voteApprovals.filter(x=>x.token===token);
  const yes=data.filter(x=>x.decision==="yes").length;
  const total=participants().length;
  const pct=Math.round(yes/Math.max(1,total)*100);
  const proposer=participantById(currentRoomData.voteRequestedBy);
  $("#vote-request-by").textContent=`${proposer?.name||"Un joueur"} propose de voter.`;
  $("#vote-request-progress").style.width=pct+"%";
  $("#vote-request-stats").textContent=`${yes}/${total} acceptent • ${pct}% • il faut plus de 50 %`;
  const mine=data.find(x=>x.playerId===currentUser.uid);
  $("#vote-request-actions").innerHTML=mine?"":`<button class="yes-btn" id="vote-yes">✅ Voter</button><button class="no-btn" id="vote-no">❌ Continuer</button>`;
  $("#vote-yes")?.addEventListener("click",()=>answerVoteRequest("yes"));
  $("#vote-no")?.addEventListener("click",()=>answerVoteRequest("no"));
}

function renderVoting(){
  if(!currentRoomData||currentRoomData.status!=="voting")return;
  const stage=currentRoomData.voteStage||"collecting";
  const statusMap=new Map(voteStatuses.map(v=>[v.playerId,v]));
  const myStatus=statusMap.get(currentUser.uid);
  const help=stage==="collecting"?"On voit qui a voté, mais pas son choix.":stage==="reconsider"?"Tout le monde a voté : tu peux encore changer d’avis.":"Le délai est fini : confirme définitivement.";
  $("#vote-stage-help").textContent=help;
  $("#vote-timer").classList.toggle("hidden",stage!=="reconsider");

  if(stage==="reconsider"){
    updateClientCountdown();
  }

  $("#vote-status-list").innerHTML=participants().map(p=>{
    const s=statusMap.get(p.id);const cls=s?.confirmed?"confirmed":s?.submitted?"voted":"";
    return `<div class="vote-status"><span>${esc(p.name)}</span><span style="display:flex;gap:5px;align-items:center"><i class="status-dot ${cls}"></i>${s?.confirmed?"Confirmé":s?.submitted?"A voté":"Attente"}</span></div>`
  }).join("");

  const selected=Number($("#vote-choices").dataset.selectedIndex||-1);
  $("#vote-choices").innerHTML=participants().map((p,i)=>`<button class="vote-choice ${selected===i?"selected":""}" data-vote-id="${p.id}" data-vote-index="${i}">${esc(p.name)}</button>`).join("");
  $$("[data-vote-id]").forEach(b=>b.addEventListener("click",async()=>{
    $("#vote-choices").dataset.selectedIndex=b.dataset.voteIndex;
    $("#vote-choices").dataset.selectedId=b.dataset.voteId;
    $("#my-vote-label").textContent=`Choix actuel : ${participantById(b.dataset.voteId)?.name||""}`;
    renderVoting();
    if(stage==="reconsider"&&myStatus?.submitted)await writeMyVote(b.dataset.voteId,false);
  }));

  $("#submit-vote-btn").classList.toggle("hidden",stage!=="collecting"||!!myStatus?.submitted);
  $("#confirm-vote-btn").classList.toggle("hidden",stage!=="confirming"||!!myStatus?.confirmed);
}

function updateClientCountdown(){
  const end=currentRoomData.reconsiderEndsAt||Date.now();
  const n=Math.max(0,Math.ceil((end-Date.now())/1000));
  $("#vote-timer").textContent=n;
  if(n>0)setTimeout(()=>{if(currentRoomData?.voteStage==="reconsider")updateClientCountdown()},250);
}

async function renderResult(){
  const r=currentRoomData?.result;if(!r)return;
  const normals=r.winner==="normal";
  $("#result-emoji").textContent=normals?"🏆":"😈";
  $("#result-title").textContent=normals?"Les joueurs normaux gagnent !":"L’imposteur gagne !";
  const imp=participantById(r.impostorId);const eliminated=participantById(r.eliminatedId);

  $("#result-majority-name").textContent=r.majority.name;
  $("#result-impostor-name").textContent=r.outsider.name;
  $("#result-images").classList.remove("hidden");
  setCharacterPhoto($("#result-majority-photo"),r.majority.name);
  setCharacterPhoto($("#result-impostor-photo"),r.outsider.name);

  $("#result-text").innerHTML=normals
    ? `L’imposteur était <b>${esc(imp?.name||"")}</b>.`
    : `Le groupe a éliminé <b>${esc(eliminated?.name||"")}</b>, qui n’était pas l’imposteur.<br><br>L’imposteur était <b>${esc(imp?.name||"")}</b>.`;
}

function renderScores(){
  $("#score-list").innerHTML=participants().sort((a,b)=>(b.score||0)-(a.score||0)).map(p=>`<div class="score-row"><span>${esc(p.name)}</span><b>${p.score||0} victoire${(p.score||0)>1?"s":""}</b></div>`).join("");
}

function selectedAnime(){return localSettings.mode==="auto"?animeDB:$$("#anime-grid input:checked").map(x=>x.value)}
function renderAnimeGrid(){
  $("#anime-grid").innerHTML=animeDB.map(a=>`<label class="anime-option"><input type="checkbox" value="${esc(a)}" checked> ${esc(a)}</label>`).join("");
}
function refreshAiStatus(){
  if(!$("#ai-status"))return;
  const stats=getAiStats({difficulty:localSettings.difficulty,allowedAnime:selectedAnime(),mix:$("#mix-anime").checked,popularityMin:96});
  $("#ai-status").textContent=stats.count?`${stats.count} duos validés`:"Aucun duo avec ces filtres";
  $("#ai-details").textContent=`Apparence + personnalité + rôle + combat + histoire + aura • anti-répétition`;
}

async function addBot(name,difficulty){
  if(!isHost)return;
  const {doc,setDoc,serverTimestamp}=fb.fsMod;
  const id=randomId("bot");
  await setDoc(doc(db,"rooms",currentRoom,"bots",id),{name,difficulty,type:"bot",score:0,joinedAt:serverTimestamp()});
}
async function fillBots(target=4){
  if(!isHost)return;
  const available=BOT_PROFILES.filter(p=>!bots.some(b=>b.name===p.name));
  const need=Math.max(0,target-bots.length);
  for(const p of available.slice(0,need))await addBot(p.name,p.difficulty);
}
async function removeBot(id){
  if(!isHost)return;await fb.fsMod.deleteDoc(fb.fsMod.doc(db,"rooms",currentRoom,"bots",id));
}

function openBotModal(){
  $("#bot-options").innerHTML=BOT_PROFILES.map(p=>`<div class="player-row">
    <div class="avatar bot">🤖</div><div class="player-meta"><div class="player-name">${p.name}</div><div class="player-sub">${p.difficulty}</div></div>
    <button class="mini-btn" data-add-bot="${p.name}" data-diff="${p.difficulty}" ${bots.some(b=>b.name===p.name)?"disabled":""}>Ajouter</button>
  </div>`).join("");
  $("#bot-modal").classList.remove("hidden");
}

async function startGame(){
  if(!isHost)return;
  const all=participants();if(all.length<3){toast("3 participants minimum");return}
  const pair=chooseIntelligentPair({difficulty:localSettings.difficulty,allowedAnime:selectedAnime(),mix:$("#mix-anime").checked,popularityMin:96});
  if(!pair){toast("Aucun duo disponible");return}
  const reverse=Math.random()<.5,majority=reverse?pair.b:pair.a,outsider=reverse?pair.a:pair.b;
  const impostor=all[Math.floor(Math.random()*all.length)];
  const gameNo=(currentRoomData.gameNo||0)+1;
  const order=shuffle(all.map(p=>p.id));
  const {doc,setDoc,updateDoc,serverTimestamp}=fb.fsMod;

  await Promise.all(all.map(p=>{
    const char=p.id===impostor.id?outsider:majority;
    return p.bot
      ? setDoc(doc(db,"rooms",currentRoom,"botAssignments",p.id),{...char,gameNo})
      : setDoc(doc(db,"rooms",currentRoom,"assignments",p.id),{...char,gameNo});
  }));

  await setDoc(doc(db,"rooms",currentRoom,"secrets","current"),{
    gameNo,impostorId:impostor.id,majority,outsider,pairScore:pair.score||0
  });

  await updateDoc(doc(db,"rooms",currentRoom),{
    status:"playing",gameNo,hintRound:1,turnIndex:0,order,
    hiddenHints:$("#hidden-hints").checked,
    reconsiderSeconds:Number($("#reconsider-seconds").value||15),
    voteRequestToken:null,voteRequestedBy:null,voteStage:null,reconsiderEndsAt:null,result:null,
    startedAt:serverTimestamp()
  });
}

async function nextHintRound(){
  if(!isHost||currentRoomData.status!=="playing")return;
  const order=currentRoomData.order||[];if(!order.length)return;
  const rotated=[...order.slice(1),order[0]];
  await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
    hintRound:(currentRoomData.hintRound||1)+1,turnIndex:0,order:rotated
  });
}

async function sendHint(){
  if(currentRoomData.status!=="playing")return;
  const order=orderedParticipants(),p=order[currentRoomData.turnIndex];
  if(p?.id!==currentUser.uid){toast("Ce n’est pas ton tour");return}
  const word=$("#hint-input").value.trim();
  if(!word||/\s/.test(word)){toast("Un seul mot est autorisé");return}
  const already=currentGameHints().some(h=>h.playerId===currentUser.uid&&h.round===currentRoomData.hintRound);
  if(already){toast("Indice déjà envoyé");return}
  if(currentGameHints().some(h=>h.word?.toLowerCase()===word.toLowerCase())){toast("Ce mot a déjà été utilisé");return}
  $("#hint-input").value="";
  const {doc,setDoc,serverTimestamp}=fb.fsMod;
  const id=`g${currentRoomData.gameNo}_r${currentRoomData.hintRound}_${currentUser.uid}`;
  await setDoc(doc(db,"rooms",currentRoom,"hints",id),{
    gameNo:currentRoomData.gameNo,round:currentRoomData.hintRound,playerId:currentUser.uid,
    playerName:participantById(currentUser.uid)?.name||"Joueur",word,
    revealed:!currentRoomData.hiddenHints,orderIndex:currentRoomData.turnIndex,createdAt:serverTimestamp()
  });
}

async function sendMessage(text,post=false,playerId=currentUser.uid,playerName=null){
  text=String(text||"").trim().slice(0,300);if(!text)return;
  const {collection,addDoc,serverTimestamp}=fb.fsMod;
  await addDoc(collection(db,"rooms",currentRoom,"messages"),{
    gameNo:currentRoomData.gameNo,playerId,playerName:playerName||participantById(playerId)?.name||"Joueur",
    text,postVote:post,createdAt:serverTimestamp(),createdMs:Date.now()
  });
}

async function proposeVote(){
  if(!["playing"].includes(currentRoomData.status))return;
  const token=randomId("vote");
  const {doc,setDoc,serverTimestamp}=fb.fsMod;
  await setDoc(doc(db,"rooms",currentRoom,"voteProposals",token),{
    token,gameNo:currentRoomData.gameNo,playerId:currentUser.uid,playerName:participantById(currentUser.uid)?.name||"Joueur",createdAt:serverTimestamp()
  });
  await setDoc(doc(db,"rooms",currentRoom,"voteApprovals",`${token}_${currentUser.uid}`),{
    token,gameNo:currentRoomData.gameNo,playerId:currentUser.uid,playerName:participantById(currentUser.uid)?.name||"Joueur",decision:"yes"
  });
  toast("Vote proposé","En attente de l’hôte et des autres joueurs.");
}

async function answerVoteRequest(decision){
  const token=currentRoomData.voteRequestToken;if(!token)return;
  await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteApprovals",`${token}_${currentUser.uid}`),{
    token,gameNo:currentRoomData.gameNo,playerId:currentUser.uid,playerName:participantById(currentUser.uid)?.name||"Joueur",decision
  });
}

async function writeMyVote(targetId,confirmed=false){
  const {doc,setDoc}=fb.fsMod;
  await setDoc(doc(db,"rooms",currentRoom,"votes",currentUser.uid),{
    gameNo:currentRoomData.gameNo,playerId:currentUser.uid,targetId,submitted:true,confirmed,updatedMs:Date.now()
  },{merge:true});
  await setDoc(doc(db,"rooms",currentRoom,"voteStatus",currentUser.uid),{
    gameNo:currentRoomData.gameNo,playerId:currentUser.uid,playerName:participantById(currentUser.uid)?.name||"Joueur",submitted:true,confirmed
  },{merge:true});
}
async function submitVote(){
  const id=$("#vote-choices").dataset.selectedId;if(!id){toast("Choisis un joueur");return}
  await writeMyVote(id,false);
}
async function confirmVote(){
  let id=$("#vote-choices").dataset.selectedId;
  if(!id){
    const snap=await fb.fsMod.getDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",currentUser.uid));
    id=snap.data()?.targetId;
  }
  if(!id){toast("Choisis ton vote définitif");return}
  await writeMyVote(id,true);
}

async function hostTick(){
  if(!isHost||hostProcessing||!currentRoomData)return;
  hostProcessing=true;
  try{
    await hostEnsureParticipantOrder();
    await hostActivateProposal();
    await hostProcessTurn();
    await hostProcessVoteRequest();
    await hostProcessVoting();
  }finally{hostProcessing=false}
}


async function hostEnsureParticipantOrder(){
  if(!isHost||!currentRoomData)return;
  if(!["playing","vote_request","voting"].includes(currentRoomData.status))return;

  const validIds=new Set(participants().map(p=>p.id));
  const oldOrder=currentRoomData.order||[];
  const cleaned=oldOrder.filter(id=>validIds.has(id));

  // Add any participant that joined/reappeared and is not in the order.
  for(const p of participants()){
    if(!cleaned.includes(p.id))cleaned.push(p.id);
  }

  let nextTurn=currentRoomData.turnIndex||0;
  if(nextTurn>cleaned.length)nextTurn=cleaned.length;

  const changed=
    cleaned.length!==oldOrder.length ||
    cleaned.some((id,i)=>id!==oldOrder[i]) ||
    nextTurn!==(currentRoomData.turnIndex||0);

  if(changed){
    await fb.fsMod.updateDoc(
      fb.fsMod.doc(db,"rooms",currentRoom),
      {order:cleaned,turnIndex:nextTurn}
    );
  }
}

async function hostActivateProposal(){
  if(currentRoomData.status!=="playing")return;
  const {collection,getDocs,doc,updateDoc}=fb.fsMod;
  const snap=await getDocs(collection(db,"rooms",currentRoom,"voteProposals"));
  const props=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.gameNo===currentRoomData.gameNo);
  if(!props.length)return;
  props.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const p=props[0];
  await updateDoc(doc(db,"rooms",currentRoom),{status:"vote_request",voteRequestToken:p.token,voteRequestedBy:p.playerId});
}

async function hostProcessTurn(){
  if(currentRoomData.status!=="playing")return;
  const order=orderedParticipants();const idx=currentRoomData.turnIndex||0;
  if(idx>=order.length)return;
  const p=order[idx];if(!p)return;
  const existing=currentGameHints().find(h=>h.round===currentRoomData.hintRound&&h.playerId===p.id);

  if(p.bot&&!existing){
    const char=botAssignments[p.id];if(!char||char.gameNo!==currentRoomData.gameNo)return;
    const word=chooseBotHint(char.name,currentGameHints().map(h=>h.word));
    const {doc,setDoc,serverTimestamp}=fb.fsMod;
    await setDoc(doc(db,"rooms",currentRoom,"hints",`g${currentRoomData.gameNo}_r${currentRoomData.hintRound}_${p.id}`),{
      gameNo:currentRoomData.gameNo,round:currentRoomData.hintRound,playerId:p.id,playerName:p.name,word,
      revealed:!currentRoomData.hiddenHints,orderIndex:idx,createdAt:serverTimestamp()
    });
    return;
  }
  if(!existing)return;

  const next=idx+1;
  if(next>=order.length&&currentRoomData.hiddenHints){
    const {writeBatch,doc}=fb.fsMod;const batch=writeBatch(db);
    currentGameHints().filter(h=>h.round===currentRoomData.hintRound&&!h.revealed).forEach(h=>batch.update(doc(db,"rooms",currentRoom,"hints",h.id),{revealed:true}));
    await batch.commit();
  }
  await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{turnIndex:next});
}

async function hostProcessVoteRequest(){
  if(currentRoomData.status!=="vote_request")return;
  const token=currentRoomData.voteRequestToken;if(!token)return;
  // Bots answer once.
  for(const b of bots){
    if(voteApprovals.some(x=>x.playerId===b.id&&x.token===token))continue;
    const a=botAssignments[b.id];if(!a)continue;
    const decision=botVoteApproval(a.name,currentGameHints(),b.name)?"yes":"no";
    await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteApprovals",`${token}_${b.id}`),{
      token,gameNo:currentRoomData.gameNo,playerId:b.id,playerName:b.name,decision
    });
  }
  const data=voteApprovals.filter(x=>x.token===token);
  const yes=data.filter(x=>x.decision==="yes").length,total=participants().length;
  if(yes/Math.max(1,total)>.5){
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
      status:"voting",voteStage:"collecting",reconsiderEndsAt:null
    });
  }else if(data.length>=total){
    await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{
      status:"playing",voteRequestToken:null,voteRequestedBy:null
    });
  }
}

async function hostProcessVoting(){
  if(currentRoomData.status!=="voting")return;
  const stage=currentRoomData.voteStage||"collecting";
  const all=participants();

  // Bots vote privately + public status.
  if(stage==="collecting"){
    for(const b of bots){
      if(voteStatuses.some(x=>x.playerId===b.id&&x.submitted))continue;
      const a=botAssignments[b.id];if(!a)continue;
      const target=chooseBotVote(b.id,a.name,all,currentGameHints());
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",b.id),{
        gameNo:currentRoomData.gameNo,playerId:b.id,targetId:target,submitted:true,confirmed:false,updatedMs:Date.now()
      });
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",b.id),{
        gameNo:currentRoomData.gameNo,playerId:b.id,playerName:b.name,submitted:true,confirmed:false
      });
    }
    const submitted=voteStatuses.filter(x=>x.submitted).length;
    if(submitted>=all.length){
      const end=Date.now()+(currentRoomData.reconsiderSeconds||15)*1000;
      await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{voteStage:"reconsider",reconsiderEndsAt:end});
    }
    return;
  }

  if(stage==="reconsider"){
    const end=currentRoomData.reconsiderEndsAt||Date.now();
    clearTimeout(hostReconsiderTimer);
    hostReconsiderTimer=setTimeout(async()=>{
      if(isHost&&currentRoomData?.status==="voting"&&currentRoomData?.voteStage==="reconsider"){
        await fb.fsMod.updateDoc(fb.fsMod.doc(db,"rooms",currentRoom),{voteStage:"confirming"});
      }
    },Math.max(0,end-Date.now()+100));
    return;
  }

  if(stage==="confirming"){
    for(const b of bots){
      const s=voteStatuses.find(x=>x.playerId===b.id);
      if(s?.confirmed)continue;
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"votes",b.id),{confirmed:true},{merge:true});
      await fb.fsMod.setDoc(fb.fsMod.doc(db,"rooms",currentRoom,"voteStatus",b.id),{
        gameNo:currentRoomData.gameNo,playerId:b.id,playerName:b.name,submitted:true,confirmed:true
      },{merge:true});
    }
    const confirmed=voteStatuses.filter(x=>x.confirmed).length;
    if(confirmed>=all.length)await hostResolveVote();
  }
}

async function hostResolveVote(){
  const {collection,getDocs,doc,getDoc,writeBatch}=fb.fsMod;
  const [voteSnap,secretSnap]=await Promise.all([
    getDocs(collection(db,"rooms",currentRoom,"votes")),
    getDoc(doc(db,"rooms",currentRoom,"secrets","current"))
  ]);
  const secret=secretSnap.data();if(!secret||secret.gameNo!==currentRoomData.gameNo)return;
  const votes=voteSnap.docs.map(d=>d.data()).filter(v=>v.gameNo===currentRoomData.gameNo&&v.confirmed);
  const counts={};votes.forEach(v=>counts[v.targetId]=(counts[v.targetId]||0)+1);
  const max=Math.max(...Object.values(counts));
  const leaders=Object.keys(counts).filter(k=>counts[k]===max);
  const eliminated=leaders[Math.floor(Math.random()*leaders.length)];
  const normalsWin=eliminated===secret.impostorId;
  const batch=writeBatch(db);

  if(normalsWin){
    for(const p of participants())if(p.id!==secret.impostorId){
      const ref=doc(db,"rooms",currentRoom,p.bot?"bots":"players",p.id);
      batch.update(ref,{score:(p.score||0)+1});
    }
  }else{
    const p=participantById(secret.impostorId);
    const ref=doc(db,"rooms",currentRoom,p.bot?"bots":"players",p.id);
    batch.update(ref,{score:(p.score||0)+1});
  }

  batch.update(doc(db,"rooms",currentRoom),{
    status:"postvote",voteStage:null,
    result:{winner:normalsWin?"normal":"impostor",impostorId:secret.impostorId,eliminatedId:eliminated,majority:secret.majority,outsider:secret.outsider}
  });
  await batch.commit();
}

async function maybeBotDiscuss(){
  if(!isHost||currentRoomData?.status!=="playing"||!bots.length||hostBotReplyBusy)return;
  clearTimeout(hostBotDiscussionTimer);

  const last=messages[messages.length-1];
  if(!last)return;

  // Never let bots trigger an endless bot-to-bot chain.
  if(String(last.playerId||"").startsWith("bot_"))return;

  const messageId=last.id||`${last.playerId}_${last.createdMs||0}`;
  if(hostLastBotReplyToMessageId===messageId)return;

  const candidates=bots.filter(b=>{
    const a=botAssignments[b.id];
    return a && shouldBotReply(b.name,last,messages);
  });

  if(!candidates.length)return;

  // At most one IA responds to one human message most of the time.
  const b=candidates[Math.floor(Math.random()*candidates.length)];
  const a=botAssignments[b.id];
  const delay=botReplyDelay(b.name,last);

  hostLastBotReplyToMessageId=messageId;
  hostBotReplyBusy=true;

  hostBotDiscussionTimer=setTimeout(async()=>{
    try{
      if(currentRoomData?.status!=="playing")return;
      const text=buildBotDiscussion(
        b.name,
        a.name,
        currentGameHints(),
        messages,
        participants()
      );
      await sendMessage(text,false,b.id,b.name);
    }catch(e){
      console.warn("Bot reply failed",e);
    }finally{
      hostBotReplyBusy=false;
    }
  },delay);
}

function openLeaveModal(){
  if(!currentRoom)return;
  const humanOthers=players.filter(p=>p.id!==currentUser?.uid);
  const txt=isHost
    ? (humanOthers.length
        ? `Tu es l’hôte. Le rôle d’hôte sera transféré à ${humanOthers[0].name} avant ton départ.`
        : `Tu es le dernier joueur humain. La salle sera fermée quand tu partiras.`)
    : `Tu quitteras la salle et tu pourras immédiatement rejoindre une autre partie.`;
  $("#leave-modal-text").textContent=txt;
  $("#leave-modal").classList.remove("hidden");
}

async function leaveRoom(){
  if(leavingRoom)return;
  if(!currentRoom){resetHome();return}

  leavingRoom=true;
  $("#confirm-leave-btn")?.setAttribute("disabled","disabled");

  const roomCode=currentRoom;
  try{
    const {doc,deleteDoc,updateDoc}=fb.fsMod;
    const otherHumans=players
      .filter(p=>p.id!==currentUser.uid)
      .sort((a,b)=>{
        const av=a.joinedAt?.seconds||0;
        const bv=b.joinedAt?.seconds||0;
        return av-bv;
      });

    if(isHost){
      if(otherHumans.length){
        const nextHost=otherHumans[0];

        // L'ancien hôte a encore le droit de modifier la salle à cet instant.
        await updateDoc(doc(db,"rooms",roomCode),{
          hostUid:nextHost.id
        });

        // Ensuite il quitte comme un joueur normal.
        await deleteDoc(doc(db,"rooms",roomCode,"players",currentUser.uid));
        toast("Salle quittée",`${nextHost.name} est maintenant l’hôte.`);
      }else{
        // Pas d'autre humain : marque d'abord la salle fermée.
        // Les sous-collections Firestore peuvent rester, mais plus aucun client
        // ne les utilise car le document de salle est supprimé.
        try{
          await updateDoc(doc(db,"rooms",roomCode),{
            status:"closed",
            closedAtMs:Date.now()
          });
        }catch{}
        await deleteDoc(doc(db,"rooms",roomCode));
        toast("Salle fermée");
      }
    }else{
      await deleteDoc(doc(db,"rooms",roomCode,"players",currentUser.uid));
      toast("Tu as quitté la salle");
    }
  }catch(e){
    console.warn("leaveRoom",e);
    toast("Départ partiel","Retour à l’accueil. Si besoin, la salle se nettoiera automatiquement.");
  }finally{
    leavingRoom=false;
    $("#confirm-leave-btn")?.removeAttribute("disabled");
    $("#leave-modal")?.classList.add("hidden");
    resetHome();
  }
}

function resetHome(){
  cleanup();
  currentRoom=null;
  currentRoomData=null;
  isHost=false;
  players=[];
  bots=[];
  assignment=null;
  botAssignments={};
  hints=[];
  messages=[];
  voteApprovals=[];
  voteStatuses=[];
  activeTab="hints";
  unreadHints=0;
  unreadChat=0;
  gameInitKey="";
  leavingRoom=false;
  localStorage.removeItem("anime_room");

  $("#toggle-character-btn")?.setAttribute("data-visible","0");
  $("#character-name").textContent="••••••";
  $("#character-anime").textContent="Secret";
  $("#character-photo-wrap")?.classList.add("hidden");

  show("home");
}

// PWA install — proposée une seule fois après première entrée dans une salle.
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  installPrompt=e;
});
window.addEventListener("appinstalled",()=>{
  installPrompt=null;
  localStorage.setItem(INSTALL_SEEN_KEY,"1");
  $("#install-modal")?.classList.add("hidden");
  toast("Application installée");
});
async function installApp(){
  localStorage.setItem(INSTALL_SEEN_KEY,"1");
  $("#install-modal")?.classList.add("hidden");

  if(installPrompt){
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;
    return;
  }

  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  toast("Installation",isiOS
    ?"iPhone : Partager → Sur l’écran d’accueil."
    :"Chrome : menu ⋮ → Installer l’application / Ajouter à l’écran d’accueil.");
}

// Events
$("#create-room-btn").addEventListener("click",()=>createRoom().catch(e=>{console.error(e);toast("Création impossible",e.message)}));
$("#solo-room-btn").addEventListener("click",()=>createRoom({solo:true}).catch(e=>{console.error(e);toast("Mode solo impossible",e.message)}));
$("#join-room-btn").addEventListener("click",()=>joinRoom().catch(e=>{console.error(e);toast("Connexion impossible",e.message)}));
$("#copy-code-btn").addEventListener("click",async()=>{await navigator.clipboard.writeText(currentRoom);toast("Code copié",currentRoom)});
$("#share-room-btn").addEventListener("click",async()=>{const text=`Rejoins ma salle Anime Imposteur : ${currentRoom}`;if(navigator.share)await navigator.share({title:"Anime Imposteur",text,url:location.href});else{await navigator.clipboard.writeText(text+" "+location.href);toast("Invitation copiée")}});
$("#install-now-btn").addEventListener("click",installApp);
$("#install-later-btn").addEventListener("click",()=>{
  localStorage.setItem(INSTALL_SEEN_KEY,"1");
  $("#install-modal").classList.add("hidden");
});
$("#leave-room-btn").addEventListener("click",openLeaveModal);
$("#leave-game-btn").addEventListener("click",openLeaveModal);
$("#confirm-leave-btn").addEventListener("click",()=>leaveRoom().catch(e=>toast("Erreur",e.message)));
$("#cancel-leave-btn").addEventListener("click",()=>$("#leave-modal").classList.add("hidden"));
$("#add-bot-btn").addEventListener("click",openBotModal);
$("#fill-bots-btn").addEventListener("click",()=>fillBots(4));
$("#close-bot-modal").addEventListener("click",()=>$("#bot-modal").classList.add("hidden"));
$("#start-game-btn").addEventListener("click",()=>startGame().catch(e=>toast("Erreur",e.message)));
$("#next-game-btn").addEventListener("click",()=>startGame().catch(e=>toast("Erreur",e.message)));
$("#next-hint-round-btn").addEventListener("click",()=>nextHintRound().catch(e=>toast("Erreur",e.message)));
$("#toggle-character-btn").addEventListener("click",()=>{const v=$("#toggle-character-btn").dataset.visible==="1";$("#toggle-character-btn").dataset.visible=v?"0":"1";$("#toggle-character-btn").textContent=v?"Voir":"Cacher";renderCharacter()});
$("#send-hint-btn").addEventListener("click",()=>sendHint().catch(e=>toast("Erreur",e.message)));
$("#hint-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("#send-hint-btn").click()});
$("#send-chat-btn").addEventListener("click",()=>{const t=$("#chat-input").value;$("#chat-input").value="";sendMessage(t).catch(e=>toast("Erreur",e.message))});
$("#chat-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("#send-chat-btn").click()});
$("#send-post-chat-btn").addEventListener("click",()=>{const t=$("#post-chat-input").value;$("#post-chat-input").value="";sendMessage(t,true).catch(e=>toast("Erreur",e.message))});
$("#post-chat-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("#send-post-chat-btn").click()});
$("#propose-vote-btn").addEventListener("click",()=>proposeVote().catch(e=>toast("Erreur",e.message)));
$("#submit-vote-btn").addEventListener("click",()=>submitVote().catch(e=>toast("Erreur",e.message)));
$("#confirm-vote-btn").addEventListener("click",()=>confirmVote().catch(e=>toast("Erreur",e.message)));
$("#join-code").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$$("[data-game-tab]").forEach(b=>b.addEventListener("click",()=>setGameTab(b.dataset.gameTab)));
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add-bot]");if(add){addBot(add.dataset.addBot,add.dataset.diff).then(()=>$("#bot-modal").classList.add("hidden"))}
  const rem=e.target.closest("[data-remove-bot]");if(rem)removeBot(rem.dataset.removeBot);
  const mode=e.target.closest("[data-mode]")?.dataset.mode;if(mode){localSettings.mode=mode;$$("[data-mode]").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));$("#manual-anime-panel").classList.toggle("hidden",mode!=="manual");refreshAiStatus()}
  const diff=e.target.closest("[data-difficulty]")?.dataset.difficulty;if(diff){localSettings.difficulty=diff;$$("[data-difficulty]").forEach(x=>x.classList.toggle("active",x.dataset.difficulty===diff));refreshAiStatus()}
});
$("#mix-anime").addEventListener("change",refreshAiStatus);
$("#anime-grid").addEventListener("change",refreshAiStatus);

const savedName=localStorage.getItem("imposteur_name");if(savedName)$("#home-name").value=savedName;
renderAnimeGrid();refreshAiStatus();initFirebase();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
