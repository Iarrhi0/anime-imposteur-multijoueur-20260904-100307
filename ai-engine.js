// Anime Imposteur — moteur IA local de similarité
// Aucun appel API : le moteur fonctionne directement dans le navigateur.
// Il combine une base de connaissances, des pondérations, des règles de qualité
// et une mémoire anti-répétition.

export const animeDB = [
  "Naruto",
  "One Piece",
  "Jujutsu Kaisen",
  "Attack on Titan",
  "Bleach",
  "Fairy Tail",
  "Hunter x Hunter",
  "My Hero Academia",
  "Demon Slayer",
  "Dragon Ball",
  "Death Note",
  "Code Geass",
  "Tokyo Ghoul",
  "Black Clover",
  "Mob Psycho 100",
  "Saiki Kusuo"
];

const C = (anime, name, popularity, appearance, personality, role, combat, story, aura) => ({
  anime, name, popularity,
  traits: { appearance, personality, role, combat, story, aura }
});

export const characters = [
  // NARUTO
  C("Naruto","Naruto Uzumaki",100,
    ["cheveux clairs","cheveux hérissés","visage jeune","silhouette athlétique"],
    ["énergique","optimiste","têtu","protecteur","sociable"],
    ["héros principal","leader","rivalité importante","symbole d'espoir"],
    ["combat rapproché","grande endurance","transformations","puissance croissante"],
    ["enfance difficile","solitude","progression majeure","protège ses proches"],
    ["charismatique","inspire les autres","déterminé"]),
  C("Naruto","Sasuke Uchiha",100,
    ["cheveux noirs","cheveux hérissés","regard sombre","silhouette mince","tenue sombre"],
    ["calme","réservé","froid","orgueilleux","protecteur discret"],
    ["rival du héros","prodige","héritier d'un clan","anti-héros"],
    ["grande vitesse","combat tactique","pouvoir oculaire","techniques familiales","précision"],
    ["clan massacré","vengeance","traumatisme familial","quête solitaire"],
    ["intimidant","mystérieux","réputation exceptionnelle"]),
  C("Naruto","Kakashi Hatake",100,
    ["cheveux clairs","cheveux hérissés","visage partiellement caché","accessoire sur les yeux","silhouette mince"],
    ["calme","détendu","sarcastique","observateur","protecteur"],
    ["mentor","professeur","élite","ancien prodige"],
    ["grande vitesse","combat rapproché","pouvoir oculaire","techniques complexes","analyse tactique"],
    ["passé tragique","pertes proches","responsabilité","protège les jeunes"],
    ["charismatique","intimidant quand sérieux","réputation exceptionnelle"]),
  C("Naruto","Itachi Uchiha",100,
    ["cheveux noirs","visage fin","regard froid","silhouette mince","apparence élégante"],
    ["calme","réservé","froid","très intelligent","secret","contrôle émotionnel"],
    ["prodige","membre d'un clan","personnage ambigu","protecteur caché"],
    ["pouvoir oculaire","illusion","grande vitesse","précision","combat tactique"],
    ["clan massacré","sacrifice","double jeu","passé tragique","porte un lourd secret"],
    ["mystérieux","intimidant","réputation exceptionnelle","aura calme"]),
  C("Naruto","Madara Uchiha",98,
    ["cheveux noirs","cheveux longs","regard intense","silhouette imposante"],
    ["calme","dominateur","arrogant","très intelligent","calculateur"],
    ["antagoniste majeur","chef légendaire","figure historique"],
    ["pouvoir oculaire","puissance écrasante","combat tactique","grande endurance"],
    ["plan à long terme","guerre","rivalité historique","vision du monde radicale"],
    ["intimidant","légendaire","confiance absolue"]),
  C("Naruto","Obito Uchiha",96,
    ["cheveux noirs","cicatrices","visage marqué","masque ou identité cachée"],
    ["secret","calculateur","émotionnel","déterminé","protecteur dans le passé"],
    ["antagoniste majeur","identité cachée","ancien héros"],
    ["pouvoir oculaire","espace-temps","combat tactique","manipulation"],
    ["passé tragique","perte d'un proche","radicalisation","double identité"],
    ["mystérieux","intimidant","imprévisible"]),
  C("Naruto","Jiraiya",98,
    ["cheveux clairs","cheveux longs","adulte","apparence excentrique","silhouette robuste"],
    ["détendu","humoristique","sociable","observateur","protecteur"],
    ["mentor","maître expérimenté","espion","figure respectée"],
    ["techniques complexes","combat tactique","grande polyvalence","invocations"],
    ["voyageur","protège les jeunes","quête d'information","passé avec le héros"],
    ["charismatique","semble moins sérieux qu'il ne l'est","réputation exceptionnelle"]),
  C("Naruto","Gaara",96,
    ["cheveux courts","regard sombre","visage jeune","silhouette mince"],
    ["calme","réservé","froid","protecteur","solitaire"],
    ["chef","ancien antagoniste","allié important"],
    ["défense exceptionnelle","combat à distance","contrôle d'élément","grande puissance"],
    ["enfance difficile","solitude","traumatisme","transformation psychologique"],
    ["intimidant","aura calme","respecté"]),

  // ONE PIECE
  C("One Piece","Monkey D. Luffy",100,
    ["cheveux noirs","visage jeune","silhouette mince","tenue simple","accessoire iconique"],
    ["énergique","optimiste","têtu","sociable","protecteur"],
    ["héros principal","leader","capitaine","symbole de liberté"],
    ["combat rapproché","grande endurance","transformations","puissance croissante"],
    ["enfance difficile","rêve immense","progression majeure","protège ses proches"],
    ["charismatique","inspire les autres","imprévisible"]),
  C("One Piece","Roronoa Zoro",100,
    ["cheveux courts","silhouette athlétique","cicatrices","tenue de combattant"],
    ["calme","réservé","têtu","loyal","sérieux"],
    ["bras droit","épéiste","combattant d'élite"],
    ["épée","combat rapproché","grande endurance","précision","puissance physique"],
    ["entraînement intense","rêve de devenir le meilleur","loyauté extrême"],
    ["intimidant","déterminé","réputation exceptionnelle"]),
  C("One Piece","Sanji",99,
    ["cheveux clairs","silhouette mince","apparence élégante","visage adulte"],
    ["calme hors provocation","sociable","protecteur","humoristique","fier"],
    ["cuisinier","combattant d'élite","bras droit officieux"],
    ["combat rapproché","grande vitesse","combat aux jambes","précision"],
    ["famille difficile","sacrifice","loyauté","protège ses proches"],
    ["charismatique","élégant","déterminé"]),
  C("One Piece","Shanks",100,
    ["cheveux chauds","barbe légère","cicatrices","homme mûr","vêtements de voyageur","silhouette robuste"],
    ["détendu","sociable","humoristique","calme","protecteur"],
    ["chef","vétéran","figure légendaire","mentor indirect"],
    ["puissance écrasante","combat rapproché","épée","intimidation","maîtrise avancée"],
    ["voyageur","apparitions rares","protège les jeunes","passé mystérieux"],
    ["charismatique","intimidant quand sérieux","réputation exceptionnelle","présence écrasante"]),
  C("One Piece","Donquixote Doflamingo",97,
    ["cheveux clairs","sourire marqué","apparence excentrique","silhouette grande"],
    ["arrogant","cruel","calculateur","provocateur","imprévisible"],
    ["antagoniste majeur","chef","manipulateur"],
    ["combat à distance","contrôle","grande vitesse","puissance élevée"],
    ["passé familial difficile","domination","planification"],
    ["charismatique","intimidant","sourire inquiétant"]),
  C("One Piece","Portgas D. Ace",99,
    ["cheveux noirs","silhouette athlétique","visage jeune","tenue légère"],
    ["énergique","protecteur","fier","sociable","loyal"],
    ["frère du héros","combattant d'élite","figure aimée"],
    ["feu","combat rapproché","grande puissance","grande endurance"],
    ["famille complexe","sacrifice","protège ses proches"],
    ["charismatique","chaleureux","respecté"]),

  // JUJUTSU KAISEN
  C("Jujutsu Kaisen","Satoru Gojo",100,
    ["cheveux clairs","cheveux hérissés","accessoire sur les yeux","visage partiellement caché","silhouette mince"],
    ["détendu","sarcastique","humoristique","très intelligent","protecteur"],
    ["mentor","professeur","élite","prodige"],
    ["pouvoir oculaire","grande vitesse","combat rapproché","techniques complexes","analyse tactique"],
    ["protège les jeunes","responsabilité","conflit avec son organisation"],
    ["charismatique","intimidant quand sérieux","réputation exceptionnelle","confiance élevée"]),
  C("Jujutsu Kaisen","Megumi Fushiguro",99,
    ["cheveux noirs","cheveux hérissés","regard sombre","silhouette mince","tenue sombre"],
    ["calme","réservé","froid","protecteur discret","très intelligent"],
    ["élève prodige","héritier d'un clan","allié du héros"],
    ["invocations","techniques familiales","combat tactique","précision","grande polyvalence"],
    ["famille difficile","responsabilité","protège ses proches"],
    ["mystérieux","aura calme","potentiel exceptionnel"]),
  C("Jujutsu Kaisen","Yuji Itadori",100,
    ["cheveux courts","visage jeune","silhouette athlétique"],
    ["énergique","optimiste","sociable","protecteur","empathique"],
    ["héros principal","élève","réceptacle"],
    ["combat rapproché","puissance physique","grande endurance","puissance croissante"],
    ["traumatisme","protège les proches","responsabilité lourde"],
    ["charismatique","déterminé","chaleureux"]),
  C("Jujutsu Kaisen","Ryomen Sukuna",100,
    ["cheveux courts","regard intense","marques corporelles","silhouette athlétique"],
    ["arrogant","cruel","dominateur","calculateur","calme"],
    ["antagoniste majeur","figure légendaire","roi ou souverain"],
    ["puissance écrasante","combat rapproché","techniques complexes","grande vitesse"],
    ["figure historique","domination","mépris des faibles"],
    ["intimidant","légendaire","confiance absolue","présence écrasante"]),
  C("Jujutsu Kaisen","Toji Fushiguro",98,
    ["cheveux noirs","silhouette athlétique","cicatrices","visage adulte"],
    ["calme","froid","calculateur","peu bavard","confiant"],
    ["assassin","combattant d'élite","père complexe"],
    ["combat rapproché","armes blanches","grande vitesse","précision","puissance physique"],
    ["famille difficile","mercenaire","passé sombre"],
    ["intimidant","efficace","présence dangereuse"]),

  // ATTACK ON TITAN
  C("Attack on Titan","Levi Ackerman",100,
    ["cheveux noirs","regard froid","silhouette compacte","visage adulte","tenue militaire"],
    ["calme","réservé","froid","peu bavard","contrôle émotionnel","protecteur discret"],
    ["combattant d'élite","chef d'escouade","vétéran"],
    ["grande vitesse","armes blanches","précision","combat rapproché","analyse tactique"],
    ["passé tragique","pertes proches","sacrifice","sens du devoir","survivant"],
    ["intimidant","réputation exceptionnelle","aura calme","respecté"]),
  C("Attack on Titan","Eren Yeager",100,
    ["cheveux foncés","visage jeune","silhouette athlétique","regard intense"],
    ["déterminé","émotionnel","protecteur","radical","secret"],
    ["héros principal","anti-héros","figure centrale"],
    ["transformation","combat rapproché","grande endurance","puissance croissante"],
    ["traumatisme","pertes proches","radicalisation","quête de liberté"],
    ["charismatique","intimidant","déterminé"]),
  C("Attack on Titan","Mikasa Ackerman",99,
    ["cheveux noirs","regard froid","silhouette athlétique","tenue militaire"],
    ["calme","réservé","protecteur","peu bavard","loyal"],
    ["combattante d'élite","alliée principale"],
    ["grande vitesse","armes blanches","précision","combat rapproché"],
    ["perte familiale","traumatisme","loyauté extrême"],
    ["intimidant","efficace","respectée"]),
  C("Attack on Titan","Erwin Smith",98,
    ["cheveux clairs","homme mûr","tenue militaire","posture droite"],
    ["calme","très intelligent","calculateur","déterminé","charismatique"],
    ["chef","stratège","commandant"],
    ["analyse tactique","leadership de combat","planification"],
    ["sacrifice","objectif supérieur","porte la responsabilité des morts"],
    ["charismatique","respecté","présence de leader"]),
  C("Attack on Titan","Reiner Braun",98,
    ["cheveux clairs","silhouette robuste","visage adulte","tenue militaire"],
    ["calme","protecteur","secret","tourmenté","loyal"],
    ["soldat","double identité","antagoniste puis personnage ambigu"],
    ["transformation","puissance physique","grande endurance","combat rapproché"],
    ["double jeu","traumatisme","culpabilité","mission lourde"],
    ["respecté","solide","tourmenté"]),

  // BLEACH
  C("Bleach","Sosuke Aizen",100,
    ["cheveux foncés","visage fin","regard calme","apparence élégante","silhouette mince"],
    ["calme","très intelligent","calculateur","secret","contrôle émotionnel","arrogant"],
    ["antagoniste majeur","chef","ancien mentor ou supérieur","manipulateur"],
    ["illusion","manipulation de la perception","combat tactique","grande vitesse","techniques complexes"],
    ["double jeu","plan à long terme","trahison","porte un grand secret"],
    ["charismatique","intimidant","aura calme","confiance absolue"]),
  C("Bleach","Byakuya Kuchiki",99,
    ["cheveux noirs","visage fin","apparence élégante","regard froid","posture droite"],
    ["calme","réservé","froid","contrôle émotionnel","discipliné"],
    ["chef","noble","membre d'un clan","combattant d'élite"],
    ["grande vitesse","épée","précision","techniques complexes","combat tactique"],
    ["devoir familial","conflit entre règles et émotions","protège ses proches"],
    ["élégant","intimidant","respecté","aura calme"]),
  C("Bleach","Kisuke Urahara",99,
    ["cheveux clairs","adulte","apparence excentrique","accessoire couvrant partiellement le visage","tenue atypique"],
    ["détendu","humoristique","très intelligent","secret","observateur"],
    ["mentor","scientifique","ancien chef","expert"],
    ["techniques complexes","combat tactique","grande polyvalence","analyse tactique"],
    ["porte des secrets","protège les jeunes","planification","passé avec l'organisation"],
    ["charismatique","semble moins sérieux qu'il ne l'est","mystérieux"]),
  C("Bleach","Ichigo Kurosaki",100,
    ["cheveux chauds","cheveux hérissés","visage jeune","silhouette athlétique"],
    ["protecteur","déterminé","réservé","loyal","têtu"],
    ["héros principal","épéiste","protecteur"],
    ["épée","grande vitesse","transformations","puissance croissante","combat rapproché"],
    ["famille importante","protège ses proches","double nature"],
    ["charismatique","déterminé","réputation croissante"]),
  C("Bleach","Rukia Kuchiki",98,
    ["cheveux noirs","silhouette mince","visage jeune","tenue d'organisation"],
    ["calme","réservé","protecteur","discipliné","loyal"],
    ["alliée principale","membre d'un clan","combattante"],
    ["épée","précision","techniques élémentaires","combat tactique"],
    ["devoir familial","sacrifice","protège ses proches"],
    ["élégante","déterminée","respectée"]),

  // FAIRY TAIL
  C("Fairy Tail","Gildarts Clive",96,
    ["cheveux chauds","barbe légère","cicatrices","homme mûr","vêtements de voyageur","silhouette robuste"],
    ["détendu","sociable","humoristique","calme","protecteur"],
    ["vétéran","figure légendaire","mentor indirect","combattant d'élite"],
    ["puissance écrasante","combat rapproché","maîtrise avancée","grande endurance"],
    ["voyageur","apparitions rares","protège les jeunes","passé mystérieux"],
    ["charismatique","intimidant quand sérieux","réputation exceptionnelle","présence écrasante"]),
  C("Fairy Tail","Erza Scarlet",99,
    ["cheveux longs","silhouette athlétique","armure ou tenue de combattant","apparence élégante"],
    ["calme","sérieux","discipliné","protecteur","loyal"],
    ["combattante d'élite","chef officieux","épéiste"],
    ["épée","armes blanches","grande endurance","précision","grande polyvalence"],
    ["passé tragique","protège ses proches","entraînement intense"],
    ["intimidante","respectée","déterminée"]),
  C("Fairy Tail","Natsu Dragneel",100,
    ["cheveux hérissés","visage jeune","silhouette athlétique","tenue simple"],
    ["énergique","optimiste","têtu","sociable","protecteur"],
    ["héros principal","combattant","rivalité importante"],
    ["feu","combat rapproché","grande endurance","puissance croissante","transformations"],
    ["famille mystérieuse","protège ses proches","progression majeure"],
    ["charismatique","déterminé","imprévisible"]),
  C("Fairy Tail","Gray Fullbuster",98,
    ["cheveux noirs","visage jeune","silhouette athlétique","tenue sombre"],
    ["calme","réservé","protecteur","rival du héros","sérieux"],
    ["allié principal","rival","combattant"],
    ["glace","combat tactique","combat rapproché","grande polyvalence"],
    ["passé tragique","mentor perdu","rivalité importante"],
    ["déterminé","froid en combat","loyal"]),

  // HUNTER X HUNTER
  C("Hunter x Hunter","Killua Zoldyck",100,
    ["cheveux clairs","visage jeune","silhouette mince","apparence innocente"],
    ["calme","réservé","très intelligent","protecteur","sarcastique"],
    ["prodige","héritier d'une famille","allié principal"],
    ["grande vitesse","combat rapproché","précision","assassinat","électricité"],
    ["famille difficile","enfance violente","quête de liberté","protège son ami"],
    ["innocent en apparence","dangereux quand sérieux","potentiel exceptionnel"]),
  C("Hunter x Hunter","Kurapika",99,
    ["cheveux clairs","visage fin","silhouette mince","regard sérieux"],
    ["calme","réservé","très intelligent","froid","déterminé"],
    ["survivant d'un clan","vengeur","stratège"],
    ["pouvoir oculaire","combat tactique","précision","techniques conditionnelles"],
    ["clan massacré","vengeance","obsession","protège ses amis"],
    ["mystérieux","intimidant quand sérieux","déterminé"]),
  C("Hunter x Hunter","Hisoka",99,
    ["apparence excentrique","sourire marqué","silhouette grande","visage adulte"],
    ["imprévisible","provocateur","calculateur","cruel","confiant"],
    ["antagoniste récurrent","combattant d'élite","solitaire"],
    ["combat tactique","grande vitesse","techniques complexes","précision"],
    ["cherche les adversaires forts","objectifs personnels"],
    ["charismatique","sourire inquiétant","dangereux"]),
  C("Hunter x Hunter","Chrollo Lucilfer",98,
    ["cheveux noirs","visage fin","regard calme","apparence élégante","silhouette mince"],
    ["calme","très intelligent","calculateur","secret","contrôle émotionnel"],
    ["chef","antagoniste majeur","leader d'un groupe dangereux"],
    ["techniques complexes","combat tactique","grande polyvalence","manipulation"],
    ["passé mystérieux","planification","loyauté au groupe"],
    ["charismatique","intimidant","aura calme","mystérieux"]),
  C("Hunter x Hunter","Gon Freecss",99,
    ["cheveux hérissés","visage jeune","silhouette athlétique","tenue simple"],
    ["énergique","optimiste","têtu","sociable","protecteur"],
    ["héros principal","aventurier","ami loyal"],
    ["combat rapproché","grande endurance","puissance croissante","transformation"],
    ["quête familiale","progression majeure","protège ses proches"],
    ["chaleureux","déterminé","imprévisible"]),

  // MY HERO ACADEMIA
  C("My Hero Academia","All Might",100,
    ["cheveux clairs","silhouette très robuste","sourire marqué","apparence héroïque"],
    ["optimiste","protecteur","charismatique","sociable","courageux"],
    ["mentor","symbole d'espoir","héros légendaire","professeur"],
    ["puissance physique","combat rapproché","puissance écrasante","grande vitesse"],
    ["porte un héritage","sacrifice","protège les jeunes","déclin physique"],
    ["charismatique","inspire les autres","réputation exceptionnelle","présence héroïque"]),
  C("My Hero Academia","Katsuki Bakugo",100,
    ["cheveux clairs","cheveux hérissés","regard agressif","silhouette athlétique"],
    ["arrogant","énergique","fier","compétitif","protecteur discret"],
    ["rival du héros","prodige","élève d'élite"],
    ["explosions","combat rapproché","grande vitesse","combat tactique"],
    ["rivalité importante","progression personnelle","apprend le respect"],
    ["intimidant","déterminé","confiance élevée"]),
  C("My Hero Academia","Shoto Todoroki",100,
    ["cheveux clairs","visage jeune","regard froid","silhouette mince","marque au visage"],
    ["calme","réservé","froid","protecteur","peu bavard"],
    ["prodige","héritier d'une famille","élève d'élite"],
    ["feu","glace","combat tactique","grande puissance"],
    ["famille difficile","enfance violente","traumatisme familial","quête identitaire"],
    ["aura calme","potentiel exceptionnel","respecté"]),
  C("My Hero Academia","Izuku Midoriya",100,
    ["cheveux foncés","visage jeune","silhouette athlétique","apparence peu intimidante"],
    ["optimiste","protecteur","très intelligent","empathique","déterminé"],
    ["héros principal","élève","héritier d'un pouvoir"],
    ["combat rapproché","analyse tactique","puissance croissante","grande vitesse"],
    ["enfance difficile","héritage","protège les autres","progression majeure"],
    ["inspire les autres","déterminé","chaleureux"]),
  C("My Hero Academia","Shota Aizawa",98,
    ["cheveux foncés","visage fatigué","accessoire sur les yeux","silhouette mince","tenue sombre"],
    ["calme","sarcastique","réservé","protecteur","observateur"],
    ["mentor","professeur","combattant d'élite"],
    ["pouvoir oculaire","combat rapproché","capture","analyse tactique"],
    ["protège les jeunes","responsabilité","passé difficile"],
    ["intimidant quand sérieux","aura calme","respecté"]),
  C("My Hero Academia","Dabi",99,
    ["cheveux foncés","cicatrices","visage marqué","silhouette mince","tenue sombre"],
    ["calme","froid","cruel","secret","provocateur"],
    ["antagoniste majeur","identité cachée","membre d'une famille importante"],
    ["feu","combat à distance","grande puissance"],
    ["famille difficile","traumatisme familial","radicalisation","identité cachée"],
    ["intimidant","mystérieux","dangereux"]),

  // DEMON SLAYER
  C("Demon Slayer","Giyu Tomioka",100,
    ["cheveux foncés","regard froid","silhouette mince","tenue d'organisation","visage adulte"],
    ["calme","réservé","froid","peu bavard","protecteur discret"],
    ["combattant d'élite","mentor indirect","pilier"],
    ["épée","grande vitesse","précision","combat rapproché","technique spécialisée"],
    ["passé tragique","pertes proches","culpabilité","sens du devoir"],
    ["aura calme","respecté","intimidant"]),
  C("Demon Slayer","Tanjiro Kamado",100,
    ["cheveux foncés","visage jeune","silhouette athlétique","marque au visage"],
    ["optimiste","protecteur","empathique","déterminé","sociable"],
    ["héros principal","épéiste","protecteur familial"],
    ["épée","combat rapproché","techniques élémentaires","grande endurance"],
    ["famille massacrée","quête familiale","protège sa sœur","progression majeure"],
    ["chaleureux","déterminé","inspire les autres"]),
  C("Demon Slayer","Kyojuro Rengoku",100,
    ["cheveux chauds","regard intense","silhouette athlétique","apparence héroïque"],
    ["optimiste","énergique","protecteur","charismatique","courageux"],
    ["mentor temporaire","combattant d'élite","pilier"],
    ["épée","feu","combat rapproché","grande puissance"],
    ["sacrifice","protège les jeunes","héritage familial"],
    ["charismatique","inspire les autres","réputation exceptionnelle"]),
  C("Demon Slayer","Muzan Kibutsuji",100,
    ["cheveux foncés","apparence élégante","visage adulte","regard froid"],
    ["calme","cruel","calculateur","arrogant","dominateur"],
    ["antagoniste majeur","chef","figure originelle"],
    ["transformation","régénération","puissance écrasante","contrôle"],
    ["plan à long terme","domination","peur de la mort"],
    ["intimidant","charismatique","présence écrasante"]),

  // DRAGON BALL
  C("Dragon Ball","Goku",100,
    ["cheveux noirs","cheveux hérissés","silhouette athlétique","tenue de combattant"],
    ["énergique","optimiste","sociable","protecteur","naïf"],
    ["héros principal","combattant légendaire","rivalité importante"],
    ["combat rapproché","transformations","grande vitesse","puissance croissante","puissance écrasante"],
    ["progression majeure","protège la planète","quête de combats forts"],
    ["charismatique","déterminé","réputation exceptionnelle"]),
  C("Dragon Ball","Vegeta",100,
    ["cheveux noirs","cheveux hérissés","regard agressif","silhouette athlétique"],
    ["arrogant","fier","compétitif","réservé","protecteur discret"],
    ["rival du héros","prince","combattant légendaire"],
    ["combat rapproché","transformations","grande vitesse","puissance écrasante"],
    ["rivalité importante","progression personnelle","famille importante"],
    ["intimidant","confiance élevée","réputation exceptionnelle"]),
  C("Dragon Ball","Gohan",99,
    ["cheveux foncés","visage jeune","silhouette athlétique","apparence peu intimidante"],
    ["calme","réservé","protecteur","empathique","très intelligent"],
    ["héritier","combattant prodige","étudiant ou intellectuel"],
    ["combat rapproché","transformations","puissance cachée","puissance croissante"],
    ["famille importante","préfère une vie normale","protège ses proches"],
    ["doux hors combat","dangereux quand sérieux","potentiel exceptionnel"]),
  C("Dragon Ball","Broly",98,
    ["cheveux noirs","silhouette très robuste","regard intense","apparence de combattant"],
    ["calme au repos","émotionnel","peu bavard","protecteur","instable sous pression"],
    ["combattant légendaire","prodige de puissance"],
    ["puissance physique","transformations","puissance écrasante","grande endurance"],
    ["famille difficile","isolement","puissance difficile à contrôler"],
    ["intimidant","présence écrasante","potentiel exceptionnel"]),

  // DEATH NOTE / CODE GEASS / TOKYO GHOUL / BLACK CLOVER / MOB / SAIKI
  C("Death Note","Light Yagami",100,
    ["cheveux foncés","visage fin","silhouette mince","apparence élégante","look d'étudiant"],
    ["calme","très intelligent","calculateur","secret","arrogant"],
    ["héros antagoniste","double identité","stratège"],
    ["manipulation","planification","pouvoir conditionnel","guerre psychologique"],
    ["double vie","désir de changer le monde","radicalisation","porte un grand secret"],
    ["charismatique","confiance absolue","apparence irréprochable"]),
  C("Death Note","L",100,
    ["cheveux noirs","silhouette mince","visage jeune","apparence atypique"],
    ["calme","très intelligent","observateur","réservé","excentrique"],
    ["détective","rival du héros","stratège"],
    ["analyse tactique","déduction","guerre psychologique","planification"],
    ["obsession pour une enquête","vie secrète"],
    ["mystérieux","intimidant intellectuellement","réputation exceptionnelle"]),
  C("Code Geass","Lelouch Lamperouge",100,
    ["cheveux foncés","visage fin","silhouette mince","apparence élégante","look d'étudiant"],
    ["calme","très intelligent","calculateur","secret","charismatique"],
    ["héros anti-héros","double identité","chef","stratège"],
    ["manipulation","pouvoir oculaire","pouvoir conditionnel","planification","guerre psychologique"],
    ["double vie","désir de changer le monde","sacrifice","porte un grand secret"],
    ["charismatique","confiance élevée","présence de leader"]),
  C("Tokyo Ghoul","Ken Kaneki",100,
    ["cheveux foncés ou clairs","visage jeune","silhouette mince","regard sombre"],
    ["calme","réservé","protecteur","tourmenté","secret"],
    ["héros principal","anti-héros","figure centrale"],
    ["transformation","régénération","combat rapproché","puissance croissante"],
    ["traumatisme","radicalisation","double nature","pertes proches"],
    ["mystérieux","intimidant quand sérieux","tourmenté"]),
  C("Black Clover","Asta",99,
    ["cheveux clairs","cheveux hérissés","visage jeune","silhouette athlétique"],
    ["énergique","optimiste","têtu","protecteur","sociable"],
    ["héros principal","outsider","rivalité importante"],
    ["épée","combat rapproché","grande endurance","puissance croissante"],
    ["enfance difficile","rêve immense","progression majeure","travail acharné"],
    ["déterminé","inspire les autres","bruyant"]),
  C("Black Clover","Yami Sukehiro",98,
    ["cheveux noirs","homme mûr","silhouette robuste","tenue sombre"],
    ["détendu","sarcastique","calme","protecteur","peu conventionnel"],
    ["chef","mentor","combattant d'élite"],
    ["épée","combat rapproché","grande puissance","analyse tactique"],
    ["protège les jeunes","vétéran","responsabilité"],
    ["intimidant quand sérieux","charismatique","réputation exceptionnelle"]),
  C("Mob Psycho 100","Shigeo Kageyama (Mob)",97,
    ["cheveux noirs","visage neutre","silhouette mince","apparence banale","look d'étudiant"],
    ["calme","réservé","peu bavard","empathique","veut une vie normale"],
    ["héros principal","élève","prodige psychique"],
    ["pouvoir psychique","télékinésie","puissance cachée","puissance écrasante"],
    ["contrôle émotionnel","progression personnelle","cherche une vie normale"],
    ["peu intimidant en apparence","dangereux quand sérieux","potentiel exceptionnel"]),
  C("Saiki Kusuo","Kusuo Saiki",97,
    ["cheveux colorés","visage neutre","silhouette mince","apparence banale","look d'étudiant"],
    ["calme","réservé","peu bavard","très intelligent","veut une vie normale"],
    ["héros principal","élève","prodige psychique"],
    ["pouvoir psychique","télékinésie","techniques multiples","puissance écrasante"],
    ["contrôle de ses pouvoirs","cherche une vie normale","cache ses capacités"],
    ["peu intimidant en apparence","mystérieux","potentiel exceptionnel"])
];

const WEIGHTS = {
  appearance: 0.29,
  personality: 0.18,
  role: 0.13,
  combat: 0.15,
  story: 0.12,
  aura: 0.13
};

const CATEGORY_LABELS = {
  appearance: "apparence",
  personality: "personnalité",
  role: "rôle",
  combat: "combat",
  story: "histoire",
  aura: "aura"
};

const expertPairs = [
  ["Kakashi Hatake","Satoru Gojo",95,[
    "cheveux très clairs et dressés","yeux cachés par un accessoire","pouvoir oculaire majeur",
    "professeurs de jeunes combattants","mentors très protecteurs","attitude détendue et sarcastique",
    "combattants d'élite","vitesse et corps-à-corps","analyse tactique","deviennent intimidants quand ils sont sérieux"
  ]],
  ["Levi Ackerman","Itachi Uchiha",91,[
    "cheveux noirs","regard froid","silhouette relativement fine","très calmes et peu bavards",
    "contrôle émotionnel","combattants d'élite","vitesse et précision","passé tragique",
    "pertes de proches","sens du devoir","réputation exceptionnelle"
  ]],
  ["Shanks","Gildarts Clive",94,[
    "hommes mûrs","cheveux dans des tons chauds","barbe légère","cicatrices visibles",
    "vêtements de voyageur","attitude très détendue","personnalité sociable",
    "vétérans extrêmement puissants","apparitions rares mais marquantes","réputation légendaire",
    "présence écrasante lorsqu'ils deviennent sérieux"
  ]],
  ["Sosuke Aizen","Itachi Uchiha",92,[
    "cheveux foncés","visage fin","regard calme","personnalité froide et contrôlée",
    "intelligence exceptionnelle","intentions cachées","double jeu","pouvoirs liés à la perception",
    "illusions","combat tactique","secrets majeurs dans leur histoire"
  ]],
  ["Sasuke Uchiha","Megumi Fushiguro",91,[
    "cheveux noirs hérissés","regard sombre","silhouette mince","tenues sombres",
    "personnalité réservée","jeunes prodiges","héritage familial important",
    "techniques de lignée","combat tactique","protecteurs malgré leur froideur"
  ]],
  ["Sasuke Uchiha","Kurapika",93,[
    "jeunes prodiges","personnalité froide et réservée","clan massacré","vengeance centrale",
    "pouvoirs oculaires","héritage de clan","obsession pouvant les isoler",
    "combat très tactique","amis qui tentent de les protéger de leur vengeance"
  ]],
  ["Light Yagami","Lelouch Lamperouge",96,[
    "jeunes hommes brillants","cheveux foncés","apparence élégante","vie d'étudiant",
    "double identité","intelligence stratégique exceptionnelle","manipulation",
    "pouvoir secret avec conditions","désir de changer le monde","plans à plusieurs étapes",
    "moralité de plus en plus ambiguë"
  ]],
  ["Byakuya Kuchiki","Itachi Uchiha",88,[
    "cheveux noirs","visage fin","apparence élégante","regard froid",
    "émotions fortement contenues","membres de clans importants","devoir familial",
    "combattants extrêmement précis","grande vitesse","respectés et craints"
  ]],
  ["Giyu Tomioka","Levi Ackerman",90,[
    "cheveux foncés","visage fermé","peu bavards","personnalité froide",
    "combattants d'élite","armes blanches","grande vitesse","précision",
    "passé marqué par de nombreuses pertes","culpabilité","fort sens du devoir"
  ]],
  ["Killua Zoldyck","Shoto Todoroki",87,[
    "jeunes prodiges","apparence claire","personnalité froide et réservée",
    "familles extrêmement puissantes","enfance difficile","pression familiale",
    "talent naturel exceptionnel","progression émotionnelle","protecteurs de leurs amis"
  ]],
  ["Kisuke Urahara","Jiraiya",88,[
    "adultes excentriques","apparence peu sérieuse au premier regard","humour",
    "mentors","très grande intelligence","combattants expérimentés",
    "énorme quantité d'informations","techniques très polyvalentes","secrets importants",
    "protègent les jeunes héros"
  ]],
  ["Ken Kaneki","Eren Yeager",89,[
    "jeunes hommes ordinaires au départ","transformation en créature",
    "traumatisme majeur","pertes de proches","évolution psychologique sombre",
    "radicalisation","double nature","deviennent des figures centrales et menaçantes"
  ]],
  ["Sosuke Aizen","Chrollo Lucilfer",91,[
    "cheveux sombres","visage calme","apparence élégante","personnalité très contrôlée",
    "chefs charismatiques","groupes de combattants dangereux","intelligence stratégique",
    "pouvoirs complexes","manipulation","objectifs difficiles à lire"
  ]],
  ["Katsuki Bakugo","Vegeta",90,[
    "regard agressif","personnalité explosive","orgueil immense","rival du héros",
    "obsession de dépasser quelqu'un","combattants d'élite","grande puissance",
    "progression personnelle","apprennent progressivement le respect"
  ]],
  ["Monkey D. Luffy","Naruto Uzumaki",89,[
    "héros principaux très connus","énergique et optimiste","têtus","grands rêves",
    "enfance difficile","protègent farouchement leurs amis","rassemblent les autres",
    "puissance croissante","transformations","leadership naturel"
  ]],
  ["Goku","Natsu Dragneel",88,[
    "cheveux hérissés","personnalité énergique","optimistes","aiment combattre",
    "combat rapproché","transformations ou power-ups","grande endurance",
    "puissance croissante","protègent leurs proches","comportement parfois naïf"
  ]],
  ["Roronoa Zoro","Erza Scarlet",86,[
    "épéistes très connus","silhouettes athlétiques","discipline","loyauté",
    "armes blanches","grande endurance","précision","combattants d'élite",
    "présence intimidante","fort sens du devoir envers leur groupe"
  ]],
  ["Donquixote Doflamingo","Hisoka",87,[
    "apparence excentrique","sourire inquiétant","provocateurs","cruels",
    "très confiants","combattants très dangereux","techniques complexes",
    "goût du jeu psychologique","imprévisibles"
  ]],
  ["Madara Uchiha","Ryomen Sukuna",88,[
    "figures légendaires","confiance absolue","arrogance","présence écrasante",
    "puissance disproportionnée","combattants extrêmement expérimentés",
    "mépris des faibles","aura intimidante","antagonistes majeurs"
  ]],
  ["Obito Uchiha","Dabi",85,[
    "corps ou visage fortement marqués","identité longtemps dissimulée",
    "passé familial ou affectif traumatique","radicalisation","antagonistes",
    "liens personnels forts avec les héros","personnalité devenue froide",
    "secrets importants sur leur identité"
  ]],
  ["Kyojuro Rengoku","All Might",88,[
    "apparence héroïque","personnalité énergique et positive","grands sourires",
    "protecteurs","mentors","figures admirées","très puissants",
    "inspirent les jeunes","sacrifice pour protéger les autres"
  ]],
  ["Tanjiro Kamado","Izuku Midoriya",87,[
    "jeunes héros","apparence peu intimidante","très empathiques","protecteurs",
    "déterminés","progression par l'entraînement","analyse en combat",
    "fort désir de sauver les autres","héritage ou pouvoir qui évolue"
  ]],
  ["Shigeo Kageyama (Mob)","Kusuo Saiki",92,[
    "lycéens à l'apparence banale","visage très neutre","personnalité réservée",
    "peu bavards","pouvoirs psychiques","télékinésie","puissance écrasante",
    "veulent surtout une vie normale","cachent ou contrôlent leurs capacités"
  ]],
  ["Shota Aizawa","Kakashi Hatake",86,[
    "professeurs","visage partiellement masqué ou yeux souvent couverts",
    "attitude fatiguée et détendue","sarcasme","protecteurs",
    "combattants très techniques","analyse tactique","mentors de jeunes héros"
  ]],
  ["Shota Aizawa","Satoru Gojo",84,[
    "professeurs","pouvoir lié aux yeux","accessoire sur les yeux",
    "mentors protecteurs","combattants d'élite","grande intelligence tactique",
    "personnalités peu conventionnelles"
  ]],
  ["Gohan","Shigeo Kageyama (Mob)",86,[
    "apparence douce et peu intimidante","personnalité calme","réservés",
    "grande intelligence ou sérieux scolaire","puissance cachée immense",
    "préfèrent une vie normale au combat","deviennent terrifiants quand ils libèrent leur puissance"
  ]],
  ["Yami Sukehiro","Kakashi Hatake",84,[
    "mentors expérimentés","attitude détendue","sarcasme","combattants d'élite",
    "grande intelligence de combat","protègent leurs jeunes",
    "deviennent très sérieux lorsque la situation l'exige"
  ]],
  ["Asta","Naruto Uzumaki",86,[
    "héros bruyants et très déterminés","enfance difficile","rêve immense",
    "têtus","progressent grâce au travail","protègent leurs proches",
    "rassemblent les autres","outsiders devenus puissants"
  ]]
];

const expertMap = new Map();

function pairKey(a, b) {
  return [a, b].sort((x,y)=>x.localeCompare(y)).join("|||");
}

for (const [a,b,score,details] of expertPairs) {
  expertMap.set(pairKey(a,b), {score, details});
}

function intersection(a, b) {
  const bs = new Set(b);
  return a.filter(x => bs.has(x));
}

function categorySimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  const common = intersection(a,b).length;
  return common / Math.min(a.length,b.length);
}

function evaluatePair(a, b) {
  const byCategory = {};
  let weighted = 0;
  let commonCount = 0;
  let covered = 0;

  for (const cat of Object.keys(WEIGHTS)) {
    const common = intersection(a.traits[cat], b.traits[cat]);
    byCategory[cat] = common;
    commonCount += common.length;
    if (common.length) covered++;
    weighted += categorySimilarity(a.traits[cat], b.traits[cat]) * WEIGHTS[cat];
  }

  const curated = expertMap.get(pairKey(a.name,b.name));
  let score = Math.round(weighted * 100);

  // Bonus de cohérence : plusieurs catégories couvertes valent mieux
  // qu'une seule catégorie avec de nombreux tags.
  score += Math.max(0, covered - 2) * 3;

  // Les duos vérifiés manuellement servent de calibration experte.
  if (curated) score = Math.max(score, curated.score);

  score = Math.min(99, score);

  const genericDetails = [];
  for (const [cat, values] of Object.entries(byCategory)) {
    values.forEach(v => genericDetails.push(`${CATEGORY_LABELS[cat]} : ${v}`));
  }

  const sharedDetails = curated
    ? curated.details
    : genericDetails.slice(0, 12);

  return {
    a: {anime:a.anime, name:a.name},
    b: {anime:b.anime, name:b.name},
    score,
    commonCount: curated ? Math.max(commonCount, curated.details.length) : commonCount,
    coveredCategories: covered,
    appearanceCommon: byCategory.appearance.length,
    personalityCommon: byCategory.personality.length,
    sharedDetails,
    curated: Boolean(curated)
  };
}

function difficultyRules(difficulty) {
  if (difficulty === "hard") {
    return {
      minScore: 82,
      maxScore: 99,
      minCommon: 6,
      minCategories: 4,
      requireCuratedOrStrong: true
    };
  }
  if (difficulty === "easy") {
    return {
      minScore: 50,
      maxScore: 73,
      minCommon: 3,
      minCategories: 2,
      requireCuratedOrStrong: false
    };
  }
  return {
    minScore: 68,
    maxScore: 86,
    minCommon: 4,
    minCategories: 3,
    requireCuratedOrStrong: false
  };
}

export function buildCandidates({
  difficulty="hard",
  allowedAnime=animeDB,
  mix=true,
  popularityMin=96
} = {}) {
  const allowed = new Set(allowedAnime);
  const pool = characters.filter(c =>
    c.popularity >= popularityMin && allowed.has(c.anime)
  );

  const rules = difficultyRules(difficulty);
  const out = [];

  for (let i=0;i<pool.length;i++) {
    for (let j=i+1;j<pool.length;j++) {
      const a=pool[i], b=pool[j];
      if (!mix && a.anime !== b.anime) continue;

      const ev = evaluatePair(a,b);

      // En difficile, priorité aux duos explicitement vérifiés ou aux
      // rapprochements très forts générés par la base de connaissances.
      const strongGenerated =
        ev.score >= 86 &&
        ev.commonCount >= 8 &&
        ev.coveredCategories >= 4 &&
        (ev.appearanceCommon + ev.personalityCommon) >= 2;

      if (rules.requireCuratedOrStrong && !(ev.curated || strongGenerated)) continue;
      if (ev.score < rules.minScore || ev.score > rules.maxScore) continue;
      if (ev.commonCount < rules.minCommon) continue;
      if (ev.coveredCategories < rules.minCategories && !ev.curated) continue;

      // Évite les rapprochements basés uniquement sur "puissant".
      if (!ev.curated && (ev.appearanceCommon + ev.personalityCommon) < 1) continue;

      out.push(ev);
    }
  }

  return out.sort((x,y)=>y.score-x.score);
}

function loadRecentPairs() {
  try {
    const raw = JSON.parse(localStorage.getItem("anime_imposteur_ai_recent_pairs") || "[]");
    return Array.isArray(raw) ? raw.slice(0,10) : [];
  } catch {
    return [];
  }
}

function rememberPair(p) {
  try {
    const key = pairKey(p.a.name,p.b.name);
    const next = [key, ...loadRecentPairs().filter(x=>x!==key)].slice(0,8);
    localStorage.setItem("anime_imposteur_ai_recent_pairs", JSON.stringify(next));
  } catch {}
}

export function chooseIntelligentPair(options={}) {
  let candidates = buildCandidates(options);

  // Si les filtres sont trop stricts, on baisse légèrement le seuil de popularité,
  // mais on ne descend jamais vers des personnages obscurs.
  if (!candidates.length && (options.popularityMin ?? 96) > 92) {
    candidates = buildCandidates({...options, popularityMin:92});
  }

  if (!candidates.length) return null;

  const recent = new Set(loadRecentPairs());
  const fresh = candidates.filter(p => !recent.has(pairKey(p.a.name,p.b.name)));
  const pool = fresh.length ? fresh : candidates;

  // Tirage pondéré : les meilleures paires restent plus probables,
  // sans rendre le jeu répétitif.
  const weights = pool.map(p => Math.max(1, p.score - 60) ** 1.35);
  const total = weights.reduce((s,x)=>s+x,0);
  let r = Math.random()*total;
  let chosen = pool[0];

  for (let i=0;i<pool.length;i++) {
    r -= weights[i];
    if (r <= 0) {
      chosen = pool[i];
      break;
    }
  }

  rememberPair(chosen);
  return chosen;
}

export function getAiStats(options={}) {
  const candidates = buildCandidates(options);
  const rules = difficultyRules(options.difficulty || "hard");
  return {
    count: candidates.length,
    minShared: rules.minCommon,
    minCategories: rules.minCategories,
    topScore: candidates[0]?.score || 0
  };
}

export function getExpertPreview(limit=20) {
  return expertPairs.slice(0,limit).map(([a,b,score,details])=>({a,b,score,details}));
}
