import { voiceConfig } from "./voice-config.js?v=8.6.0";

const STUN_SERVERS = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
  { urls: "stun:stun.l.google.com:19302" }
];

const VOICE_HEARTBEAT_MS = 10000;
const VOICE_STALE_MS = 35000;
const MAX_VOICE_HUMANS = 6;

function makeId(prefix="voice"){
  const id = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now();
  return `${prefix}_${id}`;
}

export class VoiceEngine {
  constructor({onChange=()=>{}, toast=()=>{}}={}){
    this.onChange=onChange;
    this.toast=toast;
    this.db=null;
    this.fs=null;
    this.roomId=null;
    this.uid=null;
    this.name="Joueur";
    this.sessionId=null;
    this.stream=null;
    this.joined=false;
    this.joining=false;
    this.muted=false;
    this.members=new Map();
    this.peers=new Map();
    this.pendingCandidates=new Map();
    this.memberUnsub=null;
    this.inboxUnsub=null;
    this.heartbeatTimer=null;
    this.iceServers=[...STUN_SERVERS];
  }

  setFirebase({db,fsMod}){
    this.db=db;
    this.fs=fsMod;
  }

  getState(){
    const fresh=[...this.members.values()]
      .filter(m=>Date.now()-(m.lastSeenMs||0)<VOICE_STALE_MS)
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));
    return {
      joined:this.joined,
      joining:this.joining,
      muted:this.muted,
      members:fresh,
      peerStates:[...this.peers.entries()].map(([uid,p])=>({uid,state:p.pc.connectionState||p.pc.iceConnectionState||"new"})),
      hasTurn:this.iceServers.some(x=>String(Array.isArray(x.urls)?x.urls.join(","):x.urls).startsWith("turn"))
    };
  }

  emit(){
    try{this.onChange(this.getState())}catch{}
  }

  async loadIceServers(authToken=""){
    this.iceServers=[...STUN_SERVERS];
    const url=String(voiceConfig.turnCredentialsUrl||"").trim();
    if(!url)return;
    try{
      const r=await fetch(url,{cache:"no-store",credentials:"omit",headers:authToken?{Authorization:`Bearer ${authToken}`}:{}});
      if(!r.ok)throw new Error(`TURN HTTP ${r.status}`);
      const d=await r.json();
      const extra=Array.isArray(d)?d:(d.iceServers||d.ice_servers||[]);
      if(Array.isArray(extra)&&extra.length)this.iceServers=[...STUN_SERVERS,...extra];
    }catch(e){
      console.warn("TURN credentials unavailable",e);
      this.toast("Vocal","TURN indisponible, connexion directe utilisée.");
    }
  }

  async join({roomId,uid,name,authToken=""}){
    if(this.joined||this.joining)return;
    if(!this.db||!this.fs)throw new Error("Firebase vocal non initialisé.");
    if(!roomId||!uid)throw new Error("Salle vocale indisponible.");
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone non pris en charge.");

    this.joining=true;
    this.roomId=roomId;
    this.uid=uid;
    this.name=String(name||"Joueur").slice(0,20);
    this.sessionId=makeId("session");
    this.emit();

    try{
      await this.loadIceServers(authToken);

      this.stream=await navigator.mediaDevices.getUserMedia({
        audio:{
          echoCancellation:true,
          noiseSuppression:true,
          autoGainControl:true
        },
        video:false
      });

      const existing=await this.fs.getDocs(this.fs.collection(this.db,"rooms",roomId,"voiceMembers"));
      const active=existing.docs
        .map(d=>d.data())
        .filter(m=>Date.now()-(m.lastSeenMs||0)<VOICE_STALE_MS);
      if(active.length>=MAX_VOICE_HUMANS && !active.some(m=>m.uid===uid)){
        this.stopLocalStream();
        throw new Error("Le salon vocal est limité à 6 joueurs.");
      }

      await this.fs.setDoc(
        this.fs.doc(this.db,"rooms",roomId,"voiceMembers",uid),
        {
          uid,
          name:this.name,
          sessionId:this.sessionId,
          muted:false,
          joinedAtMs:Date.now(),
          lastSeenMs:Date.now()
        }
      );

      this.joined=true;
      this.muted=false;
      this.startListeners();
      this.startHeartbeat();
      this.emit();
    }catch(e){
      await this.leave({silent:true});
      throw e;
    }finally{
      this.joining=false;
      this.emit();
    }
  }

  startHeartbeat(){
    clearInterval(this.heartbeatTimer);
    const beat=()=>{
      if(!this.joined||!this.roomId||!this.uid)return;
      this.fs.setDoc(
        this.fs.doc(this.db,"rooms",this.roomId,"voiceMembers",this.uid),
        {uid:this.uid,name:this.name,sessionId:this.sessionId,muted:this.muted,lastSeenMs:Date.now()},
        {merge:true}
      ).catch(()=>{});
    };
    beat();
    this.heartbeatTimer=setInterval(beat,VOICE_HEARTBEAT_MS);
  }

  startListeners(){
    const {collection,onSnapshot,doc,deleteDoc}=this.fs;

    this.memberUnsub=onSnapshot(
      collection(this.db,"rooms",this.roomId,"voiceMembers"),
      snap=>{
        const next=new Map();
        for(const d of snap.docs){
          const m={id:d.id,...d.data()};
          if(Date.now()-(m.lastSeenMs||0)<VOICE_STALE_MS)next.set(d.id,m);
        }
        this.members=next;
        this.syncPeers().catch(console.error);
        this.emit();
      },
      e=>console.warn("voice members",e)
    );

    this.inboxUnsub=onSnapshot(
      collection(this.db,"rooms",this.roomId,"voiceSignals",this.uid,"inbox"),
      snap=>{
        for(const change of snap.docChanges()){
          if(change.type!=="added")continue;
          const ref=doc(this.db,"rooms",this.roomId,"voiceSignals",this.uid,"inbox",change.doc.id);
          this.handleSignal(change.doc.data())
            .catch(e=>console.warn("voice signal",e))
            .finally(()=>deleteDoc(ref).catch(()=>{}));
        }
      },
      e=>console.warn("voice inbox",e)
    );
  }

  async syncPeers(){
    if(!this.joined)return;
    const current=new Set();

    for(const [remoteUid,m] of this.members){
      if(remoteUid===this.uid)continue;
      current.add(remoteUid);

      const old=this.peers.get(remoteUid);
      if(old && old.remoteSession!==m.sessionId)this.closePeer(remoteUid);

      if(!this.peers.has(remoteUid) && String(this.uid)<String(remoteUid)){
        await this.startOffer(remoteUid,m.sessionId).catch(e=>console.warn("voice offer",e));
      }
    }

    for(const remoteUid of [...this.peers.keys()]){
      if(!current.has(remoteUid))this.closePeer(remoteUid);
    }
  }

  async createPeer(remoteUid,remoteSession){
    const previous=this.peers.get(remoteUid);
    if(previous)return previous;

    const pc=new RTCPeerConnection({iceServers:this.iceServers});
    const entry={pc,remoteSession};

    this.peers.set(remoteUid,entry);
    for(const track of this.stream?.getTracks?.()||[])pc.addTrack(track,this.stream);

    pc.onicecandidate=e=>{
      if(!e.candidate)return;
      this.sendSignal(remoteUid,"candidate",e.candidate.toJSON?.()||e.candidate).catch(()=>{});
    };

    pc.ontrack=e=>{
      const stream=e.streams?.[0] || new MediaStream([e.track]);
      this.attachRemoteAudio(remoteUid,stream);
    };

    pc.onconnectionstatechange=()=>{
      this.emit();
      if(["failed","closed"].includes(pc.connectionState)){
        this.closePeer(remoteUid);
        if(this.joined && this.members.has(remoteUid) && String(this.uid)<String(remoteUid)){
          setTimeout(()=>this.startOffer(remoteUid,this.members.get(remoteUid)?.sessionId).catch(()=>{}),1200);
        }
      }
    };

    return entry;
  }

  async startOffer(remoteUid,remoteSession){
    if(!this.joined||!remoteSession)return;
    const entry=await this.createPeer(remoteUid,remoteSession);
    const offer=await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    await this.sendSignal(remoteUid,"offer",entry.pc.localDescription);
  }

  async sendSignal(remoteUid,type,payload){
    if(!this.joined)return;
    const target=this.members.get(remoteUid);
    if(!target?.sessionId)return;

    await this.fs.addDoc(
      this.fs.collection(this.db,"rooms",this.roomId,"voiceSignals",remoteUid,"inbox"),
      {
        from:this.uid,
        to:remoteUid,
        type,
        payload:JSON.parse(JSON.stringify(payload)),
        fromSession:this.sessionId,
        targetSession:target.sessionId,
        createdMs:Date.now()
      }
    );
  }

  async handleSignal(signal){
    if(!this.joined)return;
    if(signal.to!==this.uid || signal.targetSession!==this.sessionId)return;
    const remoteUid=signal.from;
    if(!remoteUid||remoteUid===this.uid)return;

    const member=this.members.get(remoteUid);
    if(member?.sessionId && signal.fromSession!==member.sessionId)return;

    if(signal.type==="offer"){
      this.closePeer(remoteUid);
      const entry=await this.createPeer(remoteUid,signal.fromSession);
      await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      await this.flushCandidates(remoteUid);
      const answer=await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      await this.sendSignal(remoteUid,"answer",entry.pc.localDescription);
      return;
    }

    let entry=this.peers.get(remoteUid);
    if(!entry)entry=await this.createPeer(remoteUid,signal.fromSession);

    if(signal.type==="answer"){
      if(entry.pc.signalingState!=="stable"){
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        await this.flushCandidates(remoteUid);
      }
      return;
    }

    if(signal.type==="candidate"){
      const c=new RTCIceCandidate(signal.payload);
      if(entry.pc.remoteDescription){
        await entry.pc.addIceCandidate(c).catch(()=>{});
      }else{
        const q=this.pendingCandidates.get(remoteUid)||[];
        q.push(c);this.pendingCandidates.set(remoteUid,q);
      }
    }
  }

  async flushCandidates(remoteUid){
    const entry=this.peers.get(remoteUid);
    if(!entry?.pc.remoteDescription)return;
    const q=this.pendingCandidates.get(remoteUid)||[];
    this.pendingCandidates.delete(remoteUid);
    for(const c of q)await entry.pc.addIceCandidate(c).catch(()=>{});
  }

  attachRemoteAudio(remoteUid,stream){
    let sink=document.querySelector("#voice-audio-sink");
    if(!sink){
      sink=document.createElement("div");
      sink.id="voice-audio-sink";
      sink.hidden=true;
      document.body.appendChild(sink);
    }
    let audio=sink.querySelector(`audio[data-voice-uid="${CSS.escape(remoteUid)}"]`);
    if(!audio){
      audio=document.createElement("audio");
      audio.dataset.voiceUid=remoteUid;
      audio.autoplay=true;
      audio.playsInline=true;
      sink.appendChild(audio);
    }
    if(audio.srcObject!==stream)audio.srcObject=stream;
    audio.play?.().catch(()=>{});
  }

  closePeer(remoteUid){
    const entry=this.peers.get(remoteUid);
    if(entry){try{entry.pc.onicecandidate=null;entry.pc.ontrack=null;entry.pc.close()}catch{}}
    this.peers.delete(remoteUid);
    this.pendingCandidates.delete(remoteUid);
    const audio=document.querySelector(`#voice-audio-sink audio[data-voice-uid="${CSS.escape(remoteUid)}"]`);
    if(audio){try{audio.srcObject=null}catch{};audio.remove()}
    this.emit();
  }

  async toggleMute(){
    if(!this.joined)return;
    this.muted=!this.muted;
    for(const t of this.stream?.getAudioTracks?.()||[])t.enabled=!this.muted;
    await this.fs.setDoc(
      this.fs.doc(this.db,"rooms",this.roomId,"voiceMembers",this.uid),
      {muted:this.muted,lastSeenMs:Date.now()},
      {merge:true}
    ).catch(()=>{});
    this.emit();
  }

  stopLocalStream(){
    for(const t of this.stream?.getTracks?.()||[]){try{t.stop()}catch{}}
    this.stream=null;
  }

  async leave({silent=false}={}){
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer=null;

    if(this.memberUnsub){try{this.memberUnsub()}catch{};this.memberUnsub=null}
    if(this.inboxUnsub){try{this.inboxUnsub()}catch{};this.inboxUnsub=null}

    for(const uid of [...this.peers.keys()])this.closePeer(uid);
    this.stopLocalStream();

    const roomId=this.roomId,uid=this.uid;
    if(roomId&&uid&&this.db&&this.fs){
      await this.fs.deleteDoc(this.fs.doc(this.db,"rooms",roomId,"voiceMembers",uid)).catch(()=>{});
    }

    this.members.clear();
    this.pendingCandidates.clear();
    this.joined=false;
    this.joining=false;
    this.muted=false;
    this.roomId=null;
    this.uid=null;
    this.sessionId=null;
    if(!silent)this.toast("Vocal","Tu as quitté le salon vocal.");
    this.emit();
  }
}
