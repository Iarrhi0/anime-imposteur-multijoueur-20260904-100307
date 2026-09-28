const GROUPS=[
  {name:"Akatsuki",type:"organisation",anime:"Naruto",clues:["Organisation criminelle","Manteaux noirs à nuages rouges","Ninjas renégats","Membres très puissants"],examples:["Itachi","Pain","Kisame","Deidara"]},
  {name:"Équipage du Chapeau de paille",type:"organisation",anime:"One Piece",clues:["Équipage pirate","Capitaine très célèbre","Chaque membre a un rôle","Voyage vers un trésor légendaire"],examples:["Luffy","Zoro","Nami","Sanji"]},
  {name:"Phantom Troupe",type:"organisation",anime:"Hunter x Hunter",clues:["Groupe criminel","Araignée comme symbole","Membres numérotés","Utilisateurs de Nen"],examples:["Chrollo","Feitan","Machi","Nobunaga"]},
  {name:"Hashira",type:"organisation",anime:"Demon Slayer",clues:["Élite d'une organisation","Chaque membre maîtrise un style","Combattent des démons","Titre très prestigieux"],examples:["Rengoku","Giyu","Shinobu","Mitsuri"]},
  {name:"Survey Corps",type:"organisation",anime:"Attack on Titan",clues:["Corps militaire","Exploration extérieure","Équipement de mobilité","Affronte des géants"],examples:["Levi","Erwin","Hange","Mikasa"]},
  {name:"Gotei 13",type:"organisation",anime:"Bleach",clues:["Organisation militaire","Divisée en divisions","Chaque division a un capitaine","Protège le monde des âmes"],examples:["Byakuya","Hitsugaya","Kenpachi","Shunsui"]},
  {name:"League of Villains",type:"organisation",anime:"My Hero Academia",clues:["Groupe d'antagonistes","Pouvoirs très différents","Opposés aux héros","Organisation évolutive"],examples:["Shigaraki","Dabi","Toga","Twice"]},
  {name:"Famille Zoldyck",type:"famille",anime:"Hunter x Hunter",clues:["Famille célèbre","Métier dangereux","Enfants entraînés très jeunes","Résidence isolée"],examples:["Killua","Illumi","Silva","Zeno"]},
  {name:"Uchiha",type:"clan",anime:"Naruto",clues:["Clan célèbre","Pouvoir oculaire","Affinité avec le feu","Histoire tragique"],examples:["Sasuke","Itachi","Madara","Obito"]},
  {name:"Saiyans",type:"race",anime:"Dragon Ball",clues:["Race guerrière","Transformations","Grande puissance","Origine extraterrestre"],examples:["Goku","Vegeta","Gohan","Broly"]},
  {name:"Shinigami",type:"classe",anime:"Bleach",clues:["Liés aux âmes","Utilisent des sabres spéciaux","Peuvent avoir un Bankai","Protègent l'équilibre"],examples:["Ichigo","Rukia","Byakuya","Toshiro"]},
  {name:"Exorcistes",type:"classe",anime:"Jujutsu Kaisen",clues:["Combattent des malédictions","Utilisent une énergie spéciale","Techniques individuelles","École spécialisée"],examples:["Gojo","Yuji","Megumi","Nobara"]},
  {name:"Pirates",type:"classe",anime:"One Piece",clues:["Voyagent en mer","Équipages","Primes possibles","Cherchent liberté ou trésors"],examples:["Luffy","Shanks","Law","Blackbeard"]},
  {name:"Ninjas",type:"classe",anime:"Naruto",clues:["Missions","Techniques spéciales","Villages cachés","Rangs et équipes"],examples:["Naruto","Kakashi","Sasuke","Minato"]},
  {name:"Professeurs / mentors",type:"trait",anime:"Multi-anime",clues:["Guident les héros","Très expérimentés","Souvent plus puissants qu'ils en ont l'air","Transmettent des techniques"],examples:["Kakashi","Gojo","Urahara","All Might"]},
  {name:"Personnages aux cheveux longs",type:"trait",anime:"Multi-anime",clues:["Trait physique visible","Présent dans beaucoup d'univers","Peut concerner héros ou méchants","La coiffure est le point commun"],examples:["Madara","Neji","Sesshomaru","Boa Hancock"]},
  {name:"Personnages aux cheveux blancs",type:"trait",anime:"Multi-anime",clues:["Couleur de cheveux claire","Très reconnaissables","Souvent associés à un pouvoir important","Présents dans plusieurs shonen"],examples:["Gojo","Kakashi","Killua","Inuyasha"]},
  {name:"Personnages masqués",type:"trait",anime:"Multi-anime",clues:["Visage partiellement caché","Identité parfois mystérieuse","Design reconnaissable","Souvent liés au combat"],examples:["Kakashi","Obito","Ken Kaneki","Tobi"]},
  {name:"Épéistes",type:"trait",anime:"Multi-anime",clues:["Arme blanche principale","Combat rapproché","Techniques de lame","Très présents dans les shonen"],examples:["Zoro","Giyu","Byakuya","Erza"]},
  {name:"Rivaux du héros",type:"trait",anime:"Multi-anime",clues:["Relation compétitive","Progressent en parallèle du protagoniste","Souvent très populaires","Peuvent devenir alliés"],examples:["Vegeta","Sasuke","Bakugo","Yuno"]},
  {name:"Antagonistes charismatiques",type:"trait",anime:"Multi-anime",clues:["Opposés aux héros","Grande présence","Plans ou idéologie marquants","Très populaires"],examples:["Aizen","Madara","Doflamingo","Chrollo"]},
  {name:"Génies / stratèges",type:"trait",anime:"Multi-anime",clues:["Intelligence exceptionnelle","Plans complexes","Analyse rapide","Combat pas toujours basé sur la force"],examples:["Light","Lelouch","L","Shikamaru"]},
  {name:"Pouvoirs oculaires",type:"trait",anime:"Multi-anime",clues:["Les yeux jouent un rôle majeur","Pouvoir visuel","Design reconnaissable","Souvent rare ou héréditaire"],examples:["Sasuke","Gojo","Kurapika","Lelouch"]},
  {name:"Utilisateurs de feu",type:"trait",anime:"Multi-anime",clues:["Pouvoir élémentaire","Attaques chaudes","Très visuel","Présent dans plusieurs univers"],examples:["Natsu","Ace","Rengoku","Endeavor"]},
  {name:"Utilisateurs de glace",type:"trait",anime:"Multi-anime",clues:["Pouvoir élémentaire froid","Gel ou glace","Attaques à distance possibles","Design souvent bleu/blanc"],examples:["Todoroki","Hitsugaya","Gray","Esdeath"]},
  {name:"Personnages avec transformation",type:"trait",anime:"Multi-anime",clues:["Changent de forme","Puissance accrue","Transformation souvent iconique","Peut être contrôlée ou subie"],examples:["Goku","Eren","Kaneki","Ichigo"]},
  {name:"Héros très optimistes",type:"trait",anime:"Multi-anime",clues:["Énergie positive","Inspirent leurs alliés","Refusent d'abandonner","Souvent protagonistes"],examples:["Luffy","Naruto","Asta","Tanjiro"]},
  {name:"Personnages très calmes",type:"trait",anime:"Multi-anime",clues:["Parlent peu","Contrôle émotionnel","Souvent tactiques","Présence sérieuse"],examples:["Levi","Giyu","Itachi","Megumi"]},
  {name:"Personnages avec cicatrice",type:"trait",anime:"Multi-anime",clues:["Marque physique visible","Souvent liée au passé","Design reconnaissable","Héros ou antagonistes"],examples:["Shanks","Tanjiro","Todoroki","Scar"]},
  {name:"Capitaines / commandants",type:"trait",anime:"Multi-anime",clues:["Dirigent une équipe","Autorité","Grande expérience","Responsabilité élevée"],examples:["Levi","Byakuya","Yami","Shanks"]},
  {name:"Assassins",type:"trait",anime:"Multi-anime",clues:["Entraînement létal","Discrétion ou précision","Passé souvent sombre","Compétences de combat élevées"],examples:["Killua","Akame","Illumi","Toji"]},
  {name:"Scientifiques / inventeurs",type:"trait",anime:"Multi-anime",clues:["Intelligence technique","Recherche ou inventions","Technologie ou expériences","Souvent utiles au groupe"],examples:["Bulma","Urahara","Senku","Mayuri"]},
  {name:"Personnages royaux",type:"trait",anime:"Multi-anime",clues:["Titre noble ou royal","Responsabilité politique","Héritage","Statut élevé"],examples:["Vegeta","Lelouch","Boa Hancock","Mereoleona"]},
  {name:"Personnages liés à un démon",type:"trait",anime:"Multi-anime",clues:["Présence d'une entité dangereuse","Pouvoir intérieur ou pacte","Conflit de contrôle","Source de puissance"],examples:["Naruto","Yuji","Denji","Asta"]},
  {name:"Personnages qui cachent leur identité",type:"trait",anime:"Multi-anime",clues:["Alias ou masque","Double vie","Secret important","Révélation marquante"],examples:["Obito","Lelouch","Light","Dabi"]},
  {name:"Frères / sœurs importants",type:"trait",anime:"Multi-anime",clues:["Lien familial central","Relation complexe","Influence l'histoire","Peut être allié ou rival"],examples:["Itachi","Sasuke","Tanjiro","Nezuko"]},
  {name:"Personnages avec lunettes",type:"trait",anime:"Multi-anime",clues:["Accessoire visuel","Trait de design","Présent chez héros et mentors","Souvent associé à intelligence ou style"],examples:["Kabuto","Uryu","Maes Hughes","Kobayashi"]},
  {name:"Personnages très rapides",type:"trait",anime:"Multi-anime",clues:["Vitesse exceptionnelle","Combat rapide","Réflexes élevés","Difficiles à suivre"],examples:["Minato","Killua","Levi","Zenitsu"]},
  {name:"Personnages qui utilisent l'électricité",type:"trait",anime:"Multi-anime",clues:["Pouvoir de foudre","Attaques électriques","Vitesse possible","Effets lumineux"],examples:["Killua","Sasuke","Kakashi","Laxus"]},
  {name:"Personnages liés aux livres",type:"trait",anime:"Multi-anime",clues:["Livre ou cahier important","Objet central","Lecture ou écriture","Pouvoir ou connaissance"],examples:["Light","Chrollo","Jiraiya","Levy"]},
  {name:"Personnages à double nature",type:"trait",anime:"Multi-anime",clues:["Deux identités ou formes","Conflit intérieur","Transformation ou secret","Évolution importante"],examples:["Kaneki","Ichigo","Eren","Denji"]}
];

function shuffle(a){
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}

const RECENT_KEY="anime_guess_group_recent_v1";

function recent(){
  try{const x=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}
}
function remember(name){
  try{
    const r=recent();
    localStorage.setItem(RECENT_KEY,JSON.stringify([name,...r.filter(x=>x!==name)].slice(0,24)));
  }catch{}
}

export function allGuessGroups(){return GROUPS.map(x=>({...x}))}

export function newGuessGroupChallenge({difficulty="normal"}={}){
  const used=new Set(recent().slice(0,16));
  const pool=GROUPS.filter(g=>!used.has(g.name));
  const group=(pool.length?pool:GROUPS)[Math.floor(Math.random()*(pool.length?pool.length:GROUPS.length))];
  remember(group.name);

  let clues=shuffle([...group.clues]);
  if(group.anime!=="Multi-anime")clues.push("Univers : "+group.anime);
  else clues.push("Univers : plusieurs anime");

  const startingClues=difficulty==="easy"?3:difficulty==="hard"?1:2;
  const maxAttempts=difficulty==="easy"?7:difficulty==="hard"?5:6;

  return {
    id:"group_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    group:{...group},
    clues,
    revealed:Math.min(startingClues,clues.length),
    attempts:0,
    maxAttempts,
    solved:false,
    finished:false,
    difficulty
  };
}

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

export function submitGroupGuess(challenge,input){
  if(!challenge||challenge.finished)return {correct:false,finished:true};
  const guess=norm(input);
  if(!guess)return {correct:false,finished:false,empty:true};

  challenge.attempts+=1;
  const target=norm(challenge.group.name);
  const correct=guess===target || target.includes(guess) || guess.includes(target);

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

export function revealGroupHint(challenge){
  if(!challenge||challenge.finished)return challenge;
  challenge.revealed=Math.min(challenge.clues.length,challenge.revealed+1);
  return challenge;
}
