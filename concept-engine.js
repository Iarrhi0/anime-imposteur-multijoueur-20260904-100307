import { getOnlineCharacterPool } from "./online-character-engine.js?v=9.0.0";

const RECENT_KEY="anime_imposteur_recent_concepts_v1";
const RECENT_PAIR_KEY="anime_imposteur_recent_concept_pairs_v1";

const PACKS=[
  {
    anime:"Death Note",
    concepts:[
      {name:"Light Yagami",kind:"character",emoji:"🧠",keywords:["Kira","Génie","Secret","Justice","Manipulation"],links:["Death Note","Pomme","Kira","Ryuk","L"]},
      {name:"L Lawliet",kind:"character",emoji:"🕵️",keywords:["Détective","Génie","Enquête","Justice","Secret"],links:["Light Yagami","Task Force","Kira"]},
      {name:"Ryuk",kind:"character",emoji:"👹",keywords:["Shinigami","Pomme","Death Note","Observation","Mort"],links:["Pomme","Death Note","Light Yagami","Monde des Shinigami"]},
      {name:"Misa Amane",kind:"character",emoji:"🖤",keywords:["Kira","Shinigami","Yeux","Célébrité","Amour"],links:["Light Yagami","Yeux de Shinigami","Death Note","Kira"]},
      {name:"Death Note",kind:"object",emoji:"📓",keywords:["Mort","Nom","Secret","Kira","Shinigami"],links:["Light Yagami","Ryuk","Misa Amane","Kira","Yeux de Shinigami"]},
      {name:"Pomme",kind:"object",emoji:"🍎",keywords:["Ryuk","Objet","Shinigami","Tentations","Death Note"],links:["Ryuk","Light Yagami","Death Note"]},
      {name:"Yeux de Shinigami",kind:"power",emoji:"👁️",keywords:["Yeux","Nom","Mort","Shinigami","Pouvoir"],links:["Misa Amane","Death Note","Ryuk"]},
      {name:"Kira",kind:"identity",emoji:"⚖️",keywords:["Justice","Mort","Secret","Enquête","Death Note"],links:["Light Yagami","L Lawliet","Misa Amane","Death Note","Task Force"]},
      {name:"Task Force",kind:"group",emoji:"🚔",keywords:["Police","Enquête","Kira","Justice","Groupe"],links:["L Lawliet","Kira","Light Yagami"]},
      {name:"Monde des Shinigami",kind:"place",emoji:"🌑",keywords:["Shinigami","Mort","Ryuk","Monde","Sombre"],links:["Ryuk","Death Note"]}
    ]
  },
  {
    anime:"Naruto",
    concepts:[
      {name:"Naruto Uzumaki",kind:"character",emoji:"🍥",keywords:["Ninja","Hokage","Kurama","Rasengan","Déterminé"],links:["Rasengan","Kurama","Konoha","Hokage"]},
      {name:"Sasuke Uchiha",kind:"character",emoji:"⚡",keywords:["Uchiha","Sharingan","Chidori","Vengeance","Ninja"],links:["Sharingan","Chidori","Itachi Uchiha","Konoha"]},
      {name:"Kakashi Hatake",kind:"character",emoji:"🥷",keywords:["Ninja","Sharingan","Chidori","Mentor","Konoha"],links:["Sharingan","Chidori","Konoha","Naruto Uzumaki","Sasuke Uchiha"]},
      {name:"Itachi Uchiha",kind:"character",emoji:"🐦‍⬛",keywords:["Uchiha","Sharingan","Akatsuki","Secret","Sacrifice"],links:["Sharingan","Akatsuki","Sasuke Uchiha"]},
      {name:"Sharingan",kind:"power",emoji:"👁️",keywords:["Yeux","Uchiha","Genjutsu","Copie","Pouvoir"],links:["Sasuke Uchiha","Itachi Uchiha","Kakashi Hatake"]},
      {name:"Rasengan",kind:"power",emoji:"🌀",keywords:["Jutsu","Chakra","Naruto","Technique","Rotation"],links:["Naruto Uzumaki","Hokage"]},
      {name:"Chidori",kind:"power",emoji:"⚡",keywords:["Foudre","Jutsu","Sasuke","Kakashi","Technique"],links:["Sasuke Uchiha","Kakashi Hatake"]},
      {name:"Akatsuki",kind:"group",emoji:"☁️",keywords:["Organisation","Ninja","Criminel","Secret","Puissant"],links:["Itachi Uchiha","Sharingan"]},
      {name:"Konoha",kind:"place",emoji:"🍃",keywords:["Village","Ninja","Hokage","Feuille","Maison"],links:["Naruto Uzumaki","Sasuke Uchiha","Kakashi Hatake","Hokage"]},
      {name:"Kurama",kind:"entity",emoji:"🦊",keywords:["Renard","Bijû","Chakra","Naruto","Puissant"],links:["Naruto Uzumaki","Konoha"]},
      {name:"Hokage",kind:"title",emoji:"🔥",keywords:["Chef","Village","Konoha","Ninja","Responsabilité"],links:["Naruto Uzumaki","Konoha","Rasengan"]}
    ]
  },
  {
    anime:"One Piece",
    concepts:[
      {name:"Monkey D. Luffy",kind:"character",emoji:"🏴‍☠️",keywords:["Pirate","Haki","Chapeau","Liberté","Fruit du Démon"],links:["Chapeau de paille","Haki","Fruit du Démon","Grand Line","One Piece"]},
      {name:"Roronoa Zoro",kind:"character",emoji:"⚔️",keywords:["Épéiste","Pirate","Sabre","Haki","Loyal"],links:["Haki","Équipage du Chapeau de paille","Grand Line"]},
      {name:"Sanji",kind:"character",emoji:"🍳",keywords:["Cuisinier","Pirate","Haki","Jambes","Équipage"],links:["Haki","Équipage du Chapeau de paille","Grand Line"]},
      {name:"Shanks",kind:"character",emoji:"🟥",keywords:["Empereur","Pirate","Haki","Sabre","Mentor"],links:["Haki","Chapeau de paille","Grand Line","One Piece"]},
      {name:"Fruit du Démon",kind:"power",emoji:"🍈",keywords:["Pouvoir","Mer","Pirate","Transformation","Rare"],links:["Monkey D. Luffy","Grand Line"]},
      {name:"Haki",kind:"power",emoji:"✨",keywords:["Volonté","Combat","Pirate","Pouvoir","Empereur"],links:["Monkey D. Luffy","Roronoa Zoro","Sanji","Shanks"]},
      {name:"Chapeau de paille",kind:"object",emoji:"👒",keywords:["Luffy","Shanks","Pirate","Symbole","Équipage"],links:["Monkey D. Luffy","Shanks","Équipage du Chapeau de paille"]},
      {name:"Équipage du Chapeau de paille",kind:"group",emoji:"☠️",keywords:["Pirate","Équipage","Amitié","Voyage","Luffy"],links:["Monkey D. Luffy","Roronoa Zoro","Sanji","Chapeau de paille","Grand Line"]},
      {name:"Grand Line",kind:"place",emoji:"🌊",keywords:["Mer","Voyage","Pirate","Danger","One Piece"],links:["Monkey D. Luffy","Shanks","Équipage du Chapeau de paille","One Piece"]},
      {name:"One Piece",kind:"object",emoji:"💰",keywords:["Trésor","Pirate","Grand Line","Rêve","Liberté"],links:["Monkey D. Luffy","Shanks","Grand Line"]},
      {name:"Marine",kind:"group",emoji:"⚓",keywords:["Justice","Gouvernement","Mer","Pirate","Soldat"],links:["Grand Line"]}
    ]
  },
  {
    anime:"Jujutsu Kaisen",
    concepts:[
      {name:"Satoru Gojo",kind:"character",emoji:"🕶️",keywords:["Professeur","Six Yeux","Infini","Exorciste","Domaine"],links:["Six Yeux","Extension de territoire","Énergie occulte","École d'exorcisme"]},
      {name:"Yuji Itadori",kind:"character",emoji:"🥊",keywords:["Élève","Sukuna","Énergie occulte","Black Flash","Exorciste"],links:["Sukuna","Black Flash","Énergie occulte","École d'exorcisme"]},
      {name:"Megumi Fushiguro",kind:"character",emoji:"🐺",keywords:["Élève","Invocation","Ombre","Exorciste","Domaine"],links:["Extension de territoire","Énergie occulte","École d'exorcisme"]},
      {name:"Ryomen Sukuna",kind:"character",emoji:"👹",keywords:["Fléau","Roi","Domaine","Puissant","Yuji"],links:["Yuji Itadori","Extension de territoire","Énergie occulte","Fléau"]},
      {name:"Six Yeux",kind:"power",emoji:"👁️",keywords:["Yeux","Gojo","Perception","Pouvoir","Rare"],links:["Satoru Gojo","Énergie occulte"]},
      {name:"Extension de territoire",kind:"power",emoji:"🌀",keywords:["Domaine","Technique","Exorciste","Fléau","Pouvoir"],links:["Satoru Gojo","Ryomen Sukuna","Megumi Fushiguro","Énergie occulte"]},
      {name:"Énergie occulte",kind:"power",emoji:"💜",keywords:["Pouvoir","Exorciste","Fléau","Technique","Combat"],links:["Satoru Gojo","Yuji Itadori","Megumi Fushiguro","Ryomen Sukuna","Black Flash"]},
      {name:"Black Flash",kind:"power",emoji:"⚫",keywords:["Combat","Impact","Énergie occulte","Yuji","Technique"],links:["Yuji Itadori","Énergie occulte"]},
      {name:"École d'exorcisme",kind:"place",emoji:"🏫",keywords:["École","Exorciste","Élève","Gojo","Tokyo"],links:["Satoru Gojo","Yuji Itadori","Megumi Fushiguro"]},
      {name:"Fléau",kind:"entity",emoji:"👻",keywords:["Malédiction","Énergie occulte","Monstre","Danger","Exorciste"],links:["Ryomen Sukuna","Énergie occulte"]}
    ]
  },
  {
    anime:"Demon Slayer",
    concepts:[
      {name:"Tanjiro Kamado",kind:"character",emoji:"🎴",keywords:["Demon Slayer","Sabre","Respiration","Famille","Nezuko"],links:["Nezuko Kamado","Sabre Nichirin","Respiration","Demon Slayer Corps"]},
      {name:"Nezuko Kamado",kind:"character",emoji:"🎋",keywords:["Démon","Famille","Tanjiro","Sang","Protection"],links:["Tanjiro Kamado","Muzan Kibutsuji","Démon"]},
      {name:"Kyojuro Rengoku",kind:"character",emoji:"🔥",keywords:["Hashira","Flamme","Sabre","Mentor","Demon Slayer"],links:["Hashira","Respiration","Sabre Nichirin","Demon Slayer Corps"]},
      {name:"Giyu Tomioka",kind:"character",emoji:"🌊",keywords:["Hashira","Eau","Sabre","Calme","Demon Slayer"],links:["Hashira","Respiration","Sabre Nichirin","Demon Slayer Corps"]},
      {name:"Sabre Nichirin",kind:"object",emoji:"🗡️",keywords:["Sabre","Démon","Demon Slayer","Arme","Respiration"],links:["Tanjiro Kamado","Kyojuro Rengoku","Giyu Tomioka","Demon Slayer Corps"]},
      {name:"Respiration",kind:"power",emoji:"🌬️",keywords:["Technique","Sabre","Demon Slayer","Élément","Combat"],links:["Tanjiro Kamado","Kyojuro Rengoku","Giyu Tomioka","Hashira"]},
      {name:"Hashira",kind:"title",emoji:"🏯",keywords:["Élite","Demon Slayer","Pilier","Puissant","Respiration"],links:["Kyojuro Rengoku","Giyu Tomioka","Demon Slayer Corps","Respiration"]},
      {name:"Demon Slayer Corps",kind:"group",emoji:"⚔️",keywords:["Démon","Organisation","Sabre","Hashira","Mission"],links:["Tanjiro Kamado","Kyojuro Rengoku","Giyu Tomioka","Hashira","Sabre Nichirin"]},
      {name:"Muzan Kibutsuji",kind:"character",emoji:"🩸",keywords:["Démon","Chef","Sang","Immortel","Antagoniste"],links:["Nezuko Kamado","Démon"]},
      {name:"Démon",kind:"entity",emoji:"👺",keywords:["Sang","Monstre","Muzan","Nuit","Demon Slayer"],links:["Muzan Kibutsuji","Nezuko Kamado","Demon Slayer Corps"]}
    ]
  },
  {
    anime:"Attack on Titan",
    concepts:[
      {name:"Eren Yeager",kind:"character",emoji:"🧱",keywords:["Titan","Liberté","Mur","Survey Corps","Transformation"],links:["Titan","Titan Originel","Survey Corps","Murs"]},
      {name:"Mikasa Ackerman",kind:"character",emoji:"🧣",keywords:["Soldat","Survey Corps","Eren","ODM","Élite"],links:["Eren Yeager","Survey Corps","Équipement ODM"]},
      {name:"Levi Ackerman",kind:"character",emoji:"⚔️",keywords:["Capitaine","Survey Corps","ODM","Élite","Titan"],links:["Survey Corps","Équipement ODM","Titan"]},
      {name:"Armin Arlert",kind:"character",emoji:"📚",keywords:["Stratège","Survey Corps","Titan","Intelligence","Ami"],links:["Survey Corps","Titan","Eren Yeager"]},
      {name:"Titan",kind:"entity",emoji:"👣",keywords:["Géant","Transformation","Mur","Danger","Marley"],links:["Eren Yeager","Levi Ackerman","Titan Originel","Murs","Marley"]},
      {name:"Titan Originel",kind:"power",emoji:"👑",keywords:["Titan","Pouvoir","Eren","Mémoire","Coordonnée"],links:["Eren Yeager","Titan"]},
      {name:"Survey Corps",kind:"group",emoji:"🪽",keywords:["Soldat","Exploration","Titan","ODM","Mur"],links:["Eren Yeager","Mikasa Ackerman","Levi Ackerman","Armin Arlert","Équipement ODM"]},
      {name:"Équipement ODM",kind:"object",emoji:"🪝",keywords:["Mobilité","Soldat","Titan","Lame","Vitesse"],links:["Mikasa Ackerman","Levi Ackerman","Survey Corps"]},
      {name:"Murs",kind:"place",emoji:"🧱",keywords:["Humanité","Titan","Protection","Ville","Secret"],links:["Eren Yeager","Titan"]},
      {name:"Marley",kind:"place",emoji:"🏳️",keywords:["Guerre","Titan","Nation","Ennemi","Soldat"],links:["Titan"]}
    ]
  },
  {
    anime:"Dragon Ball",
    concepts:[
      {name:"Goku",kind:"character",emoji:"🐉",keywords:["Saiyan","Kamehameha","Combat","Super Saiyan","Héros"],links:["Kamehameha","Super Saiyan","Dragon Balls","Senzu","Vegeta"]},
      {name:"Vegeta",kind:"character",emoji:"👑",keywords:["Saiyan","Prince","Super Saiyan","Rival","Combat"],links:["Goku","Super Saiyan","Dragon Balls","Senzu"]},
      {name:"Gohan",kind:"character",emoji:"📖",keywords:["Saiyan","Super Saiyan","Puissance","Famille","Étudiant"],links:["Goku","Super Saiyan","Dragon Balls"]},
      {name:"Frieza",kind:"character",emoji:"🟣",keywords:["Empereur","Ennemi","Transformation","Espace","Saiyan"],links:["Goku","Vegeta","Dragon Balls"]},
      {name:"Dragon Balls",kind:"object",emoji:"🟠",keywords:["Vœu","Shenron","Boules","Dragon","Quête"],links:["Goku","Vegeta","Gohan","Frieza","Shenron"]},
      {name:"Shenron",kind:"entity",emoji:"🐲",keywords:["Dragon","Vœu","Dragon Balls","Invocation","Magie"],links:["Dragon Balls"]},
      {name:"Super Saiyan",kind:"power",emoji:"💛",keywords:["Saiyan","Transformation","Puissance","Combat","Aura"],links:["Goku","Vegeta","Gohan"]},
      {name:"Kamehameha",kind:"power",emoji:"💥",keywords:["Énergie","Technique","Goku","Combat","Rayon"],links:["Goku"]},
      {name:"Senzu",kind:"object",emoji:"🫘",keywords:["Soin","Combat","Haricot","Énergie","Récupération"],links:["Goku","Vegeta"]},
      {name:"Capsule Corp",kind:"group",emoji:"🏢",keywords:["Technologie","Bulma","Capsule","Science","Vegeta"],links:["Vegeta"]}
    ]
  },
  {
    anime:"Bleach",
    concepts:[
      {name:"Ichigo Kurosaki",kind:"character",emoji:"🟧",keywords:["Shinigami","Zanpakuto","Bankai","Hollow","Protecteur"],links:["Zanpakuto","Bankai","Hollow","Soul Society","Shinigami"]},
      {name:"Rukia Kuchiki",kind:"character",emoji:"❄️",keywords:["Shinigami","Zanpakuto","Soul Society","Glace","Devoir"],links:["Zanpakuto","Soul Society","Shinigami","Ichigo Kurosaki"]},
      {name:"Sosuke Aizen",kind:"character",emoji:"🪞",keywords:["Shinigami","Illusion","Hollow","Soul Society","Manipulation"],links:["Soul Society","Hollow","Shinigami","Hueco Mundo"]},
      {name:"Kisuke Urahara",kind:"character",emoji:"🎩",keywords:["Shinigami","Scientifique","Zanpakuto","Mentor","Secret"],links:["Zanpakuto","Shinigami","Soul Society","Ichigo Kurosaki"]},
      {name:"Zanpakuto",kind:"object",emoji:"🗡️",keywords:["Sabre","Shinigami","Âme","Bankai","Combat"],links:["Ichigo Kurosaki","Rukia Kuchiki","Kisuke Urahara","Bankai","Shinigami"]},
      {name:"Bankai",kind:"power",emoji:"⚔️",keywords:["Zanpakuto","Shinigami","Puissance","Libération","Combat"],links:["Ichigo Kurosaki","Zanpakuto","Shinigami"]},
      {name:"Soul Society",kind:"place",emoji:"🏯",keywords:["Âme","Shinigami","Monde","Ordre","Capitaine"],links:["Rukia Kuchiki","Sosuke Aizen","Kisuke Urahara","Shinigami"]},
      {name:"Hollow",kind:"entity",emoji:"👺",keywords:["Masque","Âme","Monstre","Hueco Mundo","Shinigami"],links:["Ichigo Kurosaki","Sosuke Aizen","Hueco Mundo"]},
      {name:"Shinigami",kind:"title",emoji:"☠️",keywords:["Âme","Zanpakuto","Soul Society","Combat","Devoir"],links:["Ichigo Kurosaki","Rukia Kuchiki","Sosuke Aizen","Kisuke Urahara","Zanpakuto","Bankai"]},
      {name:"Hueco Mundo",kind:"place",emoji:"🌙",keywords:["Hollow","Désert","Monde","Masque","Ennemi"],links:["Hollow","Sosuke Aizen"]}
    ]
  },
  {
    anime:"My Hero Academia",
    concepts:[
      {name:"Izuku Midoriya",kind:"character",emoji:"🟢",keywords:["Héros","One For All","UA","Étudiant","Déterminé"],links:["One For All","UA High","All Might","Pro Hero"]},
      {name:"Katsuki Bakugo",kind:"character",emoji:"💣",keywords:["Héros","Explosion","UA","Rival","Étudiant"],links:["UA High","Izuku Midoriya","Pro Hero"]},
      {name:"Shoto Todoroki",kind:"character",emoji:"🔥",keywords:["Héros","Glace","Feu","UA","Étudiant"],links:["UA High","Pro Hero","Endeavor"]},
      {name:"All Might",kind:"character",emoji:"💪",keywords:["Héros","One For All","Mentor","Symbole","Pro Hero"],links:["One For All","Izuku Midoriya","Pro Hero","UA High"]},
      {name:"Endeavor",kind:"character",emoji:"🔥",keywords:["Héros","Feu","Pro Hero","Famille","Puissant"],links:["Shoto Todoroki","Pro Hero"]},
      {name:"Alter",kind:"power",emoji:"✨",keywords:["Pouvoir","Héros","Vilain","Individualité","Combat"],links:["One For All","Pro Hero","League of Villains"]},
      {name:"One For All",kind:"power",emoji:"⚡",keywords:["Pouvoir","Héros","Héritage","Force","All Might"],links:["Izuku Midoriya","All Might","Alter"]},
      {name:"UA High",kind:"place",emoji:"🏫",keywords:["École","Héros","Étudiant","Entraînement","Professeur"],links:["Izuku Midoriya","Katsuki Bakugo","Shoto Todoroki","All Might"]},
      {name:"Pro Hero",kind:"title",emoji:"🦸",keywords:["Héros","Métier","Alter","Justice","Combat"],links:["All Might","Endeavor","Izuku Midoriya","Katsuki Bakugo","Shoto Todoroki"]},
      {name:"League of Villains",kind:"group",emoji:"🦹",keywords:["Vilain","Organisation","Alter","Ennemi","Chaos"],links:["Alter"]}
    ]
  },
  {
    anime:"Hunter x Hunter",
    concepts:[
      {name:"Gon Freecss",kind:"character",emoji:"🎣",keywords:["Hunter","Nen","Aventure","Ami","Déterminé"],links:["Nen","Hunter Exam","Killua Zoldyck","Greed Island"]},
      {name:"Killua Zoldyck",kind:"character",emoji:"⚡",keywords:["Assassin","Nen","Zoldyck","Électricité","Ami"],links:["Nen","Famille Zoldyck","Gon Freecss","Hunter Exam"]},
      {name:"Kurapika",kind:"character",emoji:"⛓️",keywords:["Nen","Chaîne","Vengeance","Phantom Troupe","Clan"],links:["Nen","Phantom Troupe","Hunter Exam"]},
      {name:"Hisoka",kind:"character",emoji:"🃏",keywords:["Nen","Combat","Magicien","Imprévisible","Hunter"],links:["Nen","Hunter Exam","Phantom Troupe"]},
      {name:"Nen",kind:"power",emoji:"💠",keywords:["Aura","Pouvoir","Hunter","Combat","Technique"],links:["Gon Freecss","Killua Zoldyck","Kurapika","Hisoka"]},
      {name:"Hunter Exam",kind:"event",emoji:"🎫",keywords:["Hunter","Épreuve","Danger","Aventure","Examen"],links:["Gon Freecss","Killua Zoldyck","Kurapika","Hisoka"]},
      {name:"Phantom Troupe",kind:"group",emoji:"🕷️",keywords:["Voleur","Organisation","Nen","Araignée","Danger"],links:["Kurapika","Hisoka","Nen"]},
      {name:"Famille Zoldyck",kind:"group",emoji:"🏯",keywords:["Assassin","Famille","Killua","Montagne","Élite"],links:["Killua Zoldyck"]},
      {name:"Greed Island",kind:"place",emoji:"🎮",keywords:["Jeu","Nen","Carte","Aventure","Gon"],links:["Gon Freecss","Nen"]},
      {name:"Chimera Ants",kind:"group",emoji:"🐜",keywords:["Monstre","Nen","Danger","Évolution","Roi"],links:["Nen"]}
    ]
  },
  {
    anime:"Chainsaw Man",
    concepts:[
      {name:"Denji",kind:"character",emoji:"🪚",keywords:["Chainsaw","Devil","Public Safety","Pochita","Chasseur"],links:["Pochita","Chainsaw Devil","Public Safety","Devil Contract"]},
      {name:"Power",kind:"character",emoji:"🩸",keywords:["Blood Devil","Public Safety","Fiend","Sang","Denji"],links:["Blood Devil","Public Safety","Denji"]},
      {name:"Aki Hayakawa",kind:"character",emoji:"🗡️",keywords:["Public Safety","Devil Contract","Chasseur","Vengeance","Denji"],links:["Public Safety","Devil Contract","Gun Devil","Denji"]},
      {name:"Makima",kind:"character",emoji:"👁️",keywords:["Public Safety","Contrôle","Secret","Manipulation","Devil"],links:["Public Safety","Denji","Devil Contract"]},
      {name:"Pochita",kind:"character",emoji:"🐶",keywords:["Chainsaw","Devil","Denji","Contrat","Cœur"],links:["Denji","Chainsaw Devil","Devil Contract"]},
      {name:"Chainsaw Devil",kind:"entity",emoji:"🪚",keywords:["Devil","Chainsaw","Denji","Pochita","Puissant"],links:["Denji","Pochita"]},
      {name:"Blood Devil",kind:"entity",emoji:"🩸",keywords:["Devil","Sang","Power","Fiend","Pouvoir"],links:["Power"]},
      {name:"Public Safety",kind:"group",emoji:"🏢",keywords:["Chasseur","Devil","Organisation","Mission","Tokyo"],links:["Denji","Power","Aki Hayakawa","Makima"]},
      {name:"Devil Contract",kind:"concept",emoji:"🤝",keywords:["Contrat","Devil","Pouvoir","Prix","Chasseur"],links:["Denji","Aki Hayakawa","Makima","Pochita"]},
      {name:"Gun Devil",kind:"entity",emoji:"🔫",keywords:["Devil","Danger","Vengeance","Arme","Catastrophe"],links:["Aki Hayakawa"]}
    ]
  },
  {
    anime:"Solo Leveling",
    concepts:[
      {name:"Sung Jinwoo",kind:"character",emoji:"🖤",keywords:["Hunter","Shadow","System","Level","Monarch"],links:["Shadow Army","System","Dungeon","Igris","Beru","Monarch"]},
      {name:"Cha Hae-In",kind:"character",emoji:"⚔️",keywords:["Hunter","Épée","Guild","Puissante","Jinwoo"],links:["Hunter Guild","Dungeon","Sung Jinwoo"]},
      {name:"Shadow Army",kind:"group",emoji:"🌑",keywords:["Shadow","Invocation","Jinwoo","Armée","Monarch"],links:["Sung Jinwoo","Igris","Beru","Monarch"]},
      {name:"System",kind:"concept",emoji:"🖥️",keywords:["Level","Quête","Jinwoo","Statistique","Pouvoir"],links:["Sung Jinwoo","Dungeon"]},
      {name:"Dungeon",kind:"place",emoji:"🚪",keywords:["Monstre","Hunter","Gate","Danger","Raid"],links:["Sung Jinwoo","Cha Hae-In","System","Gate"]},
      {name:"Gate",kind:"place",emoji:"🌀",keywords:["Dungeon","Monstre","Hunter","Portail","Raid"],links:["Dungeon","Hunter Guild"]},
      {name:"Hunter Guild",kind:"group",emoji:"🛡️",keywords:["Hunter","Raid","Dungeon","Groupe","Classe"],links:["Cha Hae-In","Gate","Dungeon"]},
      {name:"Igris",kind:"character",emoji:"🛡️",keywords:["Shadow","Chevalier","Jinwoo","Armée","Épée"],links:["Sung Jinwoo","Shadow Army"]},
      {name:"Beru",kind:"character",emoji:"🐜",keywords:["Shadow","Monstre","Jinwoo","Armée","Puissant"],links:["Sung Jinwoo","Shadow Army"]},
      {name:"Monarch",kind:"title",emoji:"👑",keywords:["Puissance","Shadow","Jinwoo","Guerre","Souverain"],links:["Sung Jinwoo","Shadow Army"]}
    ]
  }
];

function norm(v){
  return String(v||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}
function read(key){
  try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[]}catch{return []}
}
function write(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
function pairKey(a,b){return [a,b].sort((x,y)=>x.localeCompare(y)).join("|||")}
function common(a,b){
  const bs=new Set((b||[]).map(norm));
  return (a||[]).filter(x=>bs.has(norm(x)));
}
function connected(a,b){
  return (a.links||[]).some(x=>norm(x)===norm(b.name)) || (b.links||[]).some(x=>norm(x)===norm(a.name));
}
function recencyPenalty(name,recent){
  const i=recent.indexOf(name);
  if(i<0)return 1;
  if(i<8)return .04;
  if(i<16)return .18;
  if(i<28)return .45;
  return .75;
}
function difficultyBand(diff){
  if(diff==="easy")return {min:46,max:68,target:57};
  if(diff==="hard")return {min:62,max:82,target:72};
  return {min:54,max:76,target:65};
}
function scorePair(a,b){
  const shared=common(a.keywords,b.keywords);
  const direct=connected(a,b);
  let score=42+shared.length*6+(direct?14:0);
  if(a.kind!==b.kind)score+=3;
  score=Math.max(0,Math.min(86,score));
  return {score,shared,direct};
}
function weightedPick(items){
  const total=items.reduce((s,x)=>s+x.weight,0);
  let r=Math.random()*total;
  for(const item of items){
    r-=item.weight;
    if(r<=0)return item;
  }
  return items[items.length-1];
}
function remember(a,b){
  const chars=read(RECENT_KEY);
  const pairs=read(RECENT_PAIR_KEY);
  write(RECENT_KEY,[a.name,b.name,...chars.filter(x=>x!==a.name&&x!==b.name)].slice(0,48));
  const key=pairKey(a.name,b.name);
  write(RECENT_PAIR_KEY,[key,...pairs.filter(x=>x!==key)].slice(0,72));
}
async function enrichCharacterImages(pair){
  let pool=[];
  try{pool=await getOnlineCharacterPool()}catch{}
  const byName=new Map(pool.map(c=>[norm(c.name),c]));
  for(const side of ["a","b"]){
    const item=pair[side];
    if(item.kind!=="character")continue;
    const online=byName.get(norm(item.name));
    if(online?.imageUrl)item.imageUrl=online.imageUrl;
  }
  return pair;
}

export async function chooseUniverseConceptPair({difficulty="normal",allowedAnime=null}={}){
  const allowed=new Set((allowedAnime||[]).map(norm));
  const recent=read(RECENT_KEY);
  const recentPairs=new Set(read(RECENT_PAIR_KEY));
  const band=difficultyBand(difficulty);
  const candidates=[];

  for(const pack of PACKS){
    if(allowed.size && !allowed.has(norm(pack.anime)))continue;
    const concepts=pack.concepts.map(c=>({...c,anime:pack.anime,source:"concept"}));

    for(let i=0;i<concepts.length;i++){
      for(let j=i+1;j<concepts.length;j++){
        const a=concepts[i],b=concepts[j];
        const ev=scorePair(a,b);
        if(ev.score<band.min||ev.score>band.max)continue;
        if(!ev.direct && ev.shared.length<2)continue;

        const key=pairKey(a.name,b.name);
        if(recentPairs.has(key))continue;

        const novelty=recencyPenalty(a.name,recent)*recencyPenalty(b.name,recent);
        const targetFit=1/(1+Math.abs(ev.score-band.target));
        const relationBoost=ev.direct?1.8:1;
        const mixedType=a.kind!==b.kind?1.35:1;
        const weight=Math.max(.0001,novelty*targetFit*relationBoost*mixedType);

        candidates.push({
          a:{...a,keywords:[...a.keywords]},
          b:{...b,keywords:[...b.keywords]},
          score:ev.score,
          sharedDetails:[
            ...(ev.direct?["relation directe dans le même univers"]:[]),
            ...ev.shared.map(x=>`point commun : ${x}`)
          ],
          online:false,
          conceptPair:true,
          weight
        });
      }
    }
  }

  if(!candidates.length)return null;
  candidates.sort((x,y)=>Math.abs(x.score-band.target)-Math.abs(y.score-band.target));
  const broad=candidates.slice(0,Math.min(120,candidates.length));
  const chosen=weightedPick(broad);
  remember(chosen.a,chosen.b);
  return enrichCharacterImages(chosen);
}

export function conceptEngineStats(){
  let concepts=0;
  let possible=0;
  for(const pack of PACKS){
    concepts+=pack.concepts.length;
    possible+=(pack.concepts.length*(pack.concepts.length-1))/2;
  }
  return {packs:PACKS.length,concepts,rawPairs:possible};
}

export function conceptPacks(){
  return PACKS.map(p=>({anime:p.anime,count:p.concepts.length}));
}
