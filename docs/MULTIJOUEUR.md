# Multijoueur en ligne — étude d'architecture

Rien n'est construit. Ce document compare les options et propose une trajectoire, avec ce que le code
actuel apporte déjà. Les coûts cités sont des ordres de grandeur à confirmer au moment du choix.

## Le problème propre aux jeux de combat
Un coup se joue en quelques images (6 à 13 ici, soit 100 à 220 ms). Un aller-retour réseau prend
couramment 40 à 150 ms. Attendre l'entrée de l'adversaire avant d'afficher rend le jeu mou ; ne pas
l'attendre oblige à corriger après coup.

## Options de synchronisation
| Approche | Principe | Avantages | Inconvénients |
|---|---|---|---|
| Délai d'entrée | Les deux jeux retardent toutes les entrées de quelques images et avancent ensemble | Simple, pas de correction visible | Chaque joueur ressent le retard en permanence ; se fige à la moindre perte de paquets |
| **Retour en arrière (rollback)** | Chaque jeu avance tout de suite en devinant l'entrée adverse (« il continue ce qu'il faisait ») ; si l'entrée reçue diffère, il revient en arrière et rejoue | Réactivité locale intacte ; standard du genre | Demande une simulation déterministe et copiable ; corrections visibles si la latence est forte |
| Serveur autoritaire | Le serveur simule, les clients affichent | Triche très difficile | Latence ressentie sur ses propres actions, serveurs à payer en continu |

**Recommandation : retour en arrière, en pair à pair**, avec un petit délai d'entrée fixe (2 images) pour
réduire les corrections.

## Ce que le code apporte déjà
| Prérequis du retour en arrière | État |
|---|---|
| Simulation séparée du rendu | Fait : `src/sim/` n'importe rien du rendu |
| Pas fixe | Fait : 60 pas par seconde (`src/core/fixedStep.js`) |
| Déterminisme | Fait et testé : mêmes entrées, même déroulement ; aucun hasard ni horloge dans `src/sim/` |
| État copiable et restaurable | Fait et testé : `Match.saveState()` / `loadState()`, passe par JSON, 900 images rejouées à l'identique |
| Entrées compactes | Fait : neuf actions tenues ou pressées par image, soit deux octets |

Reste à écrire : la boucle de retour en arrière (tampon d'états, prédiction, rejeu), la séparation entre
événements « définitifs » et « prédits » pour les sons et les effets, et le transport réseau. Une copie
d'état pèse 1,4 Ko en JSON sans l'historique de perception de l'IA (inutile en ligne), 17 Ko avec ; une
représentation binaire serait à prévoir pour rejouer 8 images par image.

Point de vigilance : le déterminisme repose sur les calculs en virgule flottante de JavaScript, identiques
entre navigateurs conformes pour les opérations de base, mais `Math.sin` et `Math.cos` peuvent différer
d'un moteur à l'autre. La simulation n'en utilise que dans l'Adumu de Lekishon : à remplacer par une table.

## Transport et services nécessaires
| Besoin | Solution | Coût indicatif |
|---|---|---|
| Liaison entre deux joueurs | WebRTC (canal de données non fiable et non ordonné) | Gratuit en pair à pair |
| Mise en relation initiale | Petit serveur de signalisation (WebSocket) | Hébergement gratuit ou quelques euros par mois |
| Traversée des box et pare-feu | Serveur STUN public ; serveur relais TURN pour 10 à 20 % des connexions | TURN payant à l'usage : poste de coût principal |
| Comptes et sauvegarde en ligne | Service d'authentification et base de données hébergés | Paliers gratuits suffisants au départ |
| Matchmaking, classements | Fonctions serveur et base de données | Idem, puis selon la fréquentation |

La sauvegarde en ligne est préparée : `Progress` ne dépend que d'une interface de stockage
(`getItem`, `setItem`, `removeItem`) et sait fusionner, valider et mettre à niveau une sauvegarde.

## Déconnexions
Détection par absence de paquets (1 à 2 s), pause courte avec tentative de reprise, puis défaite par
abandon pour celui qui est parti. En classé, un taux d'abandon élevé doit être pénalisé.

## Triche
En pair à pair, chaque joueur exécute la simulation : il peut la modifier.
- Désaccord : les deux clients s'échangent une empreinte de l'état toutes les secondes ; un écart interrompt le match.
- Classé : chaque client envoie au serveur la liste des entrées du match, signée. Le serveur rejoue le match
  (la simulation tourne dans Node, comme les tests) et ne valide le résultat que si les deux récits concordent.
- Ce qui reste possible : robots d'entrée (réflexes parfaits), ralentissement volontaire. À traiter par
  détection statistique, plus tard.
- Les récompenses actuelles sont locales et visuelles : une sauvegarde modifiée ne nuit à personne. En ligne,
  la progression classée devra être tenue par le serveur.

## Données personnelles et sécurité
Comptes = données personnelles : politique de confidentialité, suppression de compte, mots de passe jamais
gérés soi-même (fournisseur d'identité). En pair à pair, chaque joueur voit l'adresse IP de l'autre : à
signaler, ou à éviter en imposant le relais. Aucune clé ne doit se trouver dans le code du navigateur.

## Trajectoire proposée
1. Retour en arrière en local (deux simulations dans la même page, latence simulée) : valide la boucle sans réseau.
2. Parties privées par code d'invitation : signalisation et WebRTC, sans compte.
3. Comptes et sauvegarde en ligne.
4. Matchmaking, puis classement avec validation des matchs par le serveur.

Chaque étape demandera ton accord : elles créent une infrastructure, des coûts ou des données personnelles.
