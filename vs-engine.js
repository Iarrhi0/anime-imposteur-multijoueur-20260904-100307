const POOLS={
  characters:[
    "Naruto Uzumaki","Monkey D. Luffy","Ichigo Kurosaki","Goku","Satoru Gojo","Kakashi Hatake",
    "Levi Ackerman","Itachi Uchiha","Madara Uchiha","Sasuke Uchiha","Vegeta","Katsuki Bakugo",
    "Tanjiro Kamado","Eren Yeager","Ken Kaneki","Killua Zoldyck","Shoto Todoroki","Asta",
    "Yami Sukehiro","Sosuke Aizen","Chrollo Lucilfer","Roronoa Zoro","Sanji","Kyojuro Rengoku",
    "Giyu Tomioka","Hisoka","Doflamingo","Ryomen Sukuna","Sung Jinwoo","Denji"
  ],
  groups:[
    "Akatsuki","Phantom Troupe","Équipage du Chapeau de paille","Hashira","Survey Corps","Gotei 13",
    "League of Villains","Famille Zoldyck","Uchiha","Saiyans","Shinigami","Exorcistes"
  ],
  powers:[
    "Sharingan","Six Yeux","Bankai","Extension de territoire","Haki","Nen","One For All",
    "Super Saiyan","Rasengan","Chidori","Respiration","Titan Originel","Devil Fruit","Shadow Army"
  ],
  concepts:[
    "Death Note","Dragon Balls","Chapeau de paille","Sabre Nichirin","Équipement ODM","Zanpakuto",
    "Pomme de Ryuk","Senzu","Pochita","System de Solo Leveling","Masque de Kakashi","Anneau Akatsuki"
  ]
};

const RECENT="anime_vs_recent_v1";
function key(a,b){return [a,b].sort().join("|||")}
function recent(){try{const x=JSON.parse(localStorage.getItem(RECENT)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function remember(k){try{const r=recent();localStorage.setItem(RECENT,JSON.stringify([k,...r.filter(x=>x!==k)].slice(0,120)))}catch{}}

function randomPair(list){
  const used=new Set(recent().slice(0,80));
  const candidates=[];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const k=key(list[i],list[j]);
    if(!used.has(k))candidates.push([list[i],list[j]]);
  }
  const pool=candidates.length?candidates:(()=>{const x=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)x.push([list[i],list[j]]);return x})();
  const pair=pool[Math.floor(Math.random()*pool.length)];
  remember(key(pair[0],pair[1]));
  return pair;
}

export function newVsPrompt(){
  const kinds=Object.keys(POOLS);
  const kind=kinds[Math.floor(Math.random()*kinds.length)];
  const [a,b]=randomPair(POOLS[kind]);
  const question={
    characters:"Qui défendrais-tu dans ce VS ?",
    groups:"Quel groupe est le plus redoutable ?",
    powers:"Quel pouvoir choisirais-tu ?",
    concepts:"Quel élément est le plus iconique ?"
  }[kind];

  return {
    id:"vs_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    kind,
    question,
    a,
    b
  };
}

export function vsStats(){
  const combinations={};
  let total=0;
  for(const [k,list] of Object.entries(POOLS)){
    combinations[k]=list.length*(list.length-1)/2;
    total+=combinations[k];
  }
  return {total,combinations};
}
