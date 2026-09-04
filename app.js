import { firebaseConfig } from "./firebase-config.js";

const animeDB = [
  "Naruto","One Piece","Jujutsu Kaisen","Demon Slayer","Dragon Ball",
  "Hunter x Hunter","Attack on Titan","Bleach","Fairy Tail","My Hero Academia"
];

const pairDB = [
  ["Naruto","Naruto","Naruto","Minato","easy"],
  ["Naruto","Sasuke","Naruto","Itachi","easy"],
  ["Naruto","Kakashi","Naruto","Obito","normal"],
  ["Naruto","Itachi","Naruto","Madara","hard"],
  ["One Piece","Luffy","One Piece","Ace","easy"],
  ["One Piece","Zoro","One Piece","Mihawk","normal"],
  ["One Piece","Sanji","One Piece","Zoro","easy"],
  ["Jujutsu Kaisen","Gojo","Jujutsu Kaisen","Toji","normal"],
  ["Jujutsu Kaisen","Yuji","Jujutsu Kaisen","Yuta","hard"],
  ["Demon Slayer","Tanjiro","Demon Slayer","Giyu","normal"],
  ["Dragon Ball","Goku","Dragon Ball","Vegeta","easy"],
  ["Hunter x Hunter","Gon","Hunter x Hunter","Killua","easy"],
  ["Attack on Titan","Eren","Attack on Titan","Reiner","normal"],
  ["Bleach","Ichigo","Bleach","Renji","normal"],
  ["Fairy Tail","Natsu","Fairy Tail","Gray","easy"],
  ["My Hero Academia","Deku","My Hero Academia","Bakugo","easy"],

  ["Naruto","Kakashi","Jujutsu Kaisen","Gojo","easy"],
  ["Naruto","Naruto","One Piece","Luffy","easy"],
  ["Naruto","Sasuke","Hunter x Hunter","Killua","normal"],
  ["Naruto","Itachi","Attack on Titan","Levi","hard"],
  ["One Piece","Zoro","Fairy Tail","Erza","normal"],
  ["Dragon Ball","Goku","One Piece","Luffy","normal"],
  ["Demon Slayer","Tanjiro","My Hero Academia","Deku","normal"],
  ["Naruto","Minato","Jujutsu Kaisen","Gojo","hard"]
];

const botProfiles = [
  {name:"Yuki",difficulty:"Normal"},
  {name:"Kira",difficulty:"Difficile"},
  {name:"Shiro",difficulty:"Expert"},
  {name:"Aiko",difficulty:"Normal"},
  {name:"Ren",difficulty:"Difficile"}
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let fb = null;
let auth = null;
let db = null;
let currentUser = null;
let currentRoom = null;
let currentRoomData = null;
let players = [];
let bots = [];
let isHost = false;
let unsubRoom = null;
let unsubPlayers = null;
let unsubBots = null;
let unsubAssignment = null;

const localSettings = {
  mode:"auto",
  difficulty:"normal"
};

function show(id){
  $$(".screen").forEach(x=>x.classList.remove("active"));
  $("#screen-"+id).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"),1800);
}

function safeName(s){
  return (String(s||"").trim().slice(0,20) || "Joueur");
}

function randomCode(){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out="";
  crypto.getRandomValues(new Uint32Array(5)).forEach(n=>out+=alphabet[n%alphabet.length]);
  return out;
}

function randomId(prefix="id"){
  if(crypto.randomUUID) return prefix+"_"+crypto.randomUUID();
  return prefix+"_"+Math.random().toString(36).slice(2)+Date.now().toString(36);
}

async function initFirebase(){
  if(!firebaseConfig){
    $("#fatal-config").classList.remove("hidden");
    $("#create-room-btn").disabled=true;
    $("#join-room-btn").disabled=true;
    return;
  }

  try{
    const appMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");

    const app = appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);

    fb = {authMod,fsMod};

    authMod.onAuthStateChanged(auth, async user=>{
      if(user){
        currentUser=user;
        $("#connection-dot").classList.add("online");
      }else{
        try{
          const cred=await authMod.signInAnonymously(auth);
          currentUser=cred.user;
          $("#connection-dot").classList.add("online");
        }catch(err){
          console.error(err);
          $("#fatal-config").classList.remove("hidden");
          $("#fatal-config").innerHTML="<strong>Firebase Authentication refuse la connexion.</strong><span>"+escapeHtml(err.message)+"</span>";
        }
      }
    });
  }catch(err){
    console.error(err);
    $("#fatal-config").classList.remove("hidden");
    $("#fatal-config").innerHTML="<strong>Impossible de charger Firebase.</strong><span>"+escapeHtml(err.message)+"</span>";
  }
}

function ensureUser(){
  if(!currentUser){
    toast("Connexion Firebase en cours…");
    return false;
  }
  return true;
}

async function createRoom(){
  if(!ensureUser()) return;

  const name=safeName($("#home-name").value);
  localStorage.setItem("imposteur_name",name);

  const {doc,getDoc,setDoc,serverTimestamp}=fb.fsMod;

  let code;
  for(let i=0;i<10;i++){
    const candidate=randomCode();
    const ref=doc(db,"rooms",candidate);
    const snap=await getDoc(ref);
    if(!snap.exists()){code=candidate;break;}
  }
  if(!code){toast("Impossible de créer un code.");return;}

  await setDoc(doc(db,"rooms",code),{
    hostUid:currentUser.uid,
    status:"lobby",
    round:0,
    createdAt:serverTimestamp()
  });

  await setDoc(doc(db,"rooms",code,"players",currentUser.uid),{
    name,
    type:"human",
    joinedAt:serverTimestamp()
  });

  await enterRoom(code);
}

async function joinRoom(){
  if(!ensureUser()) return;

  const code=$("#join-code").value.trim().toUpperCase();
  if(code.length<4){toast("Entre le code du salon.");return;}

  const name=safeName($("#home-name").value);
  localStorage.setItem("imposteur_name",name);

  const {doc,getDoc,setDoc,serverTimestamp}=fb.fsMod;
  const roomRef=doc(db,"rooms",code);
  const snap=await getDoc(roomRef);

  if(!snap.exists()){toast("Salon introuvable.");return;}
  if(snap.data().status!=="lobby"){toast("La partie a déjà commencé.");return;}

  await setDoc(doc(db,"rooms",code,"players",currentUser.uid),{
    name,
    type:"human",
    joinedAt:serverTimestamp()
  });

  await enterRoom(code);
}

async function enterRoom(code){
  cleanupListeners();
  currentRoom=code;
  $("#room-code").textContent=code;
  show("lobby");

  const {doc,collection,onSnapshot}=fb.fsMod;

  unsubRoom=onSnapshot(doc(db,"rooms",code),snap=>{
    if(!snap.exists()){
      toast("Le salon a été supprimé.");
      resetToHome();
      return;
    }
    currentRoomData=snap.data();
    isHost=currentRoomData.hostUid===currentUser.uid;
    renderRole();

    if(currentRoomData.status==="game"){
      show("secret");
      subscribeAssignment();
    }else{
      show("lobby");
      if(unsubAssignment){unsubAssignment();unsubAssignment=null;}
      resetSecretCard();
    }
  });

  unsubPlayers=onSnapshot(collection(db,"rooms",code,"players"),snap=>{
    players=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderPlayers();
  });

  unsubBots=onSnapshot(collection(db,"rooms",code,"bots"),snap=>{
    bots=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderPlayers();
  });
}

function renderRole(){
  $("#host-panel").classList.toggle("hidden",!isHost);
  $("#guest-wait").classList.toggle("hidden",isHost);
  $("#my-role-pill").textContent=isHost?"👑 Hôte":"Joueur";
  $("#host-game-controls").classList.toggle("hidden",!isHost);
}

function renderPlayers(){
  const box=$("#players-list");
  box.innerHTML="";
  const all=[
    ...players.map(p=>({...p,bot:false})),
    ...bots.map(p=>({...p,bot:true}))
  ];

  $("#player-count").textContent=`${all.length} joueur${all.length>1?"s":""}`;

  all.forEach(p=>{
    const hostMark=!p.bot && currentRoomData?.hostUid===p.id;
    const me=!p.bot && p.id===currentUser?.uid;
    const row=document.createElement("div");
    row.className="player-row";
    row.innerHTML=`
      <div class="avatar ${p.bot?"bot":""}">${p.bot?"🤖":escapeHtml((p.name||"?")[0].toUpperCase())}</div>
      <div class="player-meta">
        <div class="player-name">${escapeHtml(p.name||"Joueur")}</div>
        <div class="player-sub">${p.bot?"IA locale":hostMark?"👑 Hôte":me?"Toi":"Joueur"}</div>
      </div>
      ${isHost&&p.bot?`<button class="remove-bot" data-remove-bot="${p.id}">×</button>`:`<div class="status-ok">✓</div>`}
    `;
    box.appendChild(row);
  });

  $("#start-game-btn").disabled=all.length<3;
  $("#start-game-btn").textContent=all.length<3?"3 joueurs minimum":"Commencer la partie";
}

function renderAnimeGrid(){
  const grid=$("#anime-grid");
  grid.innerHTML="";
  animeDB.forEach(a=>{
    const l=document.createElement("label");
    l.className="anime-option";
    l.innerHTML=`<input type="checkbox" value="${escapeHtml(a)}" checked><span>${escapeHtml(a)}</span>`;
    grid.appendChild(l);
  });
}

function openBotModal(){
  const box=$("#bot-options");
  box.innerHTML="";
  botProfiles.forEach(b=>{
    const used=bots.some(x=>x.name===b.name);
    const row=document.createElement("div");
    row.className="player-row bot-option";
    row.innerHTML=`
      <div class="avatar bot">🤖</div>
      <div class="player-meta">
        <div class="player-name">${b.name}</div>
        <div class="player-sub">${b.difficulty}</div>
      </div>
      <button class="mini-add" ${used?"disabled":""} data-add-bot="${b.name}" data-bot-difficulty="${b.difficulty}">
        ${used?"Ajoutée":"Ajouter"}
      </button>`;
    box.appendChild(row);
  });
  $("#bot-modal").classList.remove("hidden");
}

async function addBot(name,difficulty){
  if(!isHost||!currentRoom) return;
  const {doc,setDoc,serverTimestamp}=fb.fsMod;
  const id=randomId("bot");
  await setDoc(doc(db,"rooms",currentRoom,"bots",id),{
    name,difficulty,type:"bot",joinedAt:serverTimestamp()
  });
  $("#bot-modal").classList.add("hidden");
}

async function removeBot(id){
  if(!isHost) return;
  const {doc,deleteDoc}=fb.fsMod;
  await deleteDoc(doc(db,"rooms",currentRoom,"bots",id));
}

function selectedAnime(){
  if(localSettings.mode==="auto") return animeDB;
  return $$("#anime-grid input:checked").map(x=>x.value);
}

function choosePair(){
  const allowed=new Set(selectedAnime());
  const mix=$("#mix-anime").checked;

  let candidates=pairDB.filter(([aAnime,a,bAnime,b,diff])=>
    allowed.has(aAnime)&&allowed.has(bAnime)&&diff===localSettings.difficulty&&(mix||aAnime===bAnime)
  );

  if(!candidates.length){
    candidates=pairDB.filter(([aAnime,a,bAnime,b,diff])=>
      allowed.has(aAnime)&&allowed.has(bAnime)&&(mix||aAnime===bAnime)
    );
  }
  if(!candidates.length) return null;

  const p=candidates[Math.floor(Math.random()*candidates.length)];
  return {
    a:{anime:p[0],name:p[1]},
    b:{anime:p[2],name:p[3]}
  };
}

async function startGame(){
  if(!isHost) return;
  const participants=[
    ...players.map(p=>({id:p.id,name:p.name,bot:false})),
    ...bots.map(p=>({id:p.id,name:p.name,bot:true}))
  ];
  if(participants.length<3){toast("Il faut au moins 3 joueurs.");return;}

  const pair=choosePair();
  if(!pair){toast("Aucun duo disponible avec ces réglages.");return;}

  const reverse=Math.random()<0.5;
  const majority=reverse?pair.b:pair.a;
  const outsider=reverse?pair.a:pair.b;
  const impostorIndex=Math.floor(Math.random()*participants.length);
  const round=(currentRoomData?.round||0)+1;

  const {doc,setDoc,updateDoc,serverTimestamp}=fb.fsMod;

  for(let i=0;i<participants.length;i++){
    const p=participants[i];
    const character=i===impostorIndex?outsider:majority;

    if(p.bot){
      await setDoc(doc(db,"rooms",currentRoom,"botAssignments",p.id),{
        ...character,round
      });
    }else{
      await setDoc(doc(db,"rooms",currentRoom,"assignments",p.id),{
        ...character,round
      });
    }
  }

  await updateDoc(doc(db,"rooms",currentRoom),{
    status:"game",
    round,
    startedAt:serverTimestamp()
  });
}

function subscribeAssignment(){
  if(unsubAssignment) return;
  const {doc,onSnapshot}=fb.fsMod;

  unsubAssignment=onSnapshot(doc(db,"rooms",currentRoom,"assignments",currentUser.uid),snap=>{
    if(!snap.exists()) return;
    const data=snap.data();
    $("#secret-player-name").textContent=players.find(p=>p.id===currentUser.uid)?.name||"Joueur";
    $("#character-name").textContent=data.name;
    $("#character-anime").textContent=data.anime;
    resetSecretCard();
  });
}

function resetSecretCard(){
  $("#character-question").classList.remove("hidden");
  $("#character-content").classList.add("hidden");
  $("#reveal-character-btn").classList.remove("hidden");
  $("#hide-character-btn").classList.add("hidden");
}

async function finishRound(){
  if(!isHost) return;
  const {doc,updateDoc}=fb.fsMod;
  await updateDoc(doc(db,"rooms",currentRoom),{status:"lobby"});
}

async function leaveRoom(){
  if(!currentRoom||!currentUser) return resetToHome();
  const {doc,deleteDoc}=fb.fsMod;

  try{
    if(isHost){
      // For MVP: host leaving closes the room document.
      // Subcollections may remain but are inaccessible without room parent.
      await deleteDoc(doc(db,"rooms",currentRoom));
    }else{
      await deleteDoc(doc(db,"rooms",currentRoom,"players",currentUser.uid));
    }
  }catch(e){console.warn(e)}
  resetToHome();
}

function resetToHome(){
  cleanupListeners();
  currentRoom=null;currentRoomData=null;players=[];bots=[];isHost=false;
  show("home");
}

function cleanupListeners(){
  [unsubRoom,unsubPlayers,unsubBots,unsubAssignment].forEach(fn=>{if(fn)try{fn()}catch{}});
  unsubRoom=unsubPlayers=unsubBots=unsubAssignment=null;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

// Events
$("#create-room-btn").addEventListener("click",()=>createRoom().catch(e=>{console.error(e);toast(e.message)}));
$("#join-room-btn").addEventListener("click",()=>joinRoom().catch(e=>{console.error(e);toast(e.message)}));
$("#copy-code-btn").addEventListener("click",async()=>{await navigator.clipboard.writeText(currentRoom||"");toast("Code copié");});
$("#leave-room-btn").addEventListener("click",()=>leaveRoom());
$("#add-bot-btn").addEventListener("click",openBotModal);
$("#close-bot-modal").addEventListener("click",()=>$("#bot-modal").classList.add("hidden"));
$("#start-game-btn").addEventListener("click",()=>startGame().catch(e=>{console.error(e);toast(e.message)}));
$("#reveal-character-btn").addEventListener("click",()=>{
  $("#character-question").classList.add("hidden");
  $("#character-content").classList.remove("hidden");
  $("#reveal-character-btn").classList.add("hidden");
  $("#hide-character-btn").classList.remove("hidden");
});
$("#hide-character-btn").addEventListener("click",resetSecretCard);
$("#back-lobby-btn").addEventListener("click",()=>finishRound().catch(e=>toast(e.message)));

document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add-bot]");
  if(add) addBot(add.dataset.addBot,add.dataset.botDifficulty).catch(err=>toast(err.message));

  const rem=e.target.closest("[data-remove-bot]");
  if(rem) removeBot(rem.dataset.removeBot).catch(err=>toast(err.message));

  const mode=e.target.closest("[data-mode]")?.dataset.mode;
  if(mode){
    localSettings.mode=mode;
    $$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    $("#manual-anime-panel").classList.toggle("hidden",mode!=="manual");
  }

  const diff=e.target.closest("[data-difficulty]")?.dataset.difficulty;
  if(diff){
    localSettings.difficulty=diff;
    $$("[data-difficulty]").forEach(b=>b.classList.toggle("active",b.dataset.difficulty===diff));
  }
});

$("#join-code").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));

const savedName=localStorage.getItem("imposteur_name");
if(savedName) $("#home-name").value=savedName;

renderAnimeGrid();
initFirebase();
