# Mesures

| Fichier | Contenu | Portée |
|---|---|---|
| `equilibrage-v1.1.txt` | 1 800 matchs IA contre IA (`npm run balance`) | Simulation pure, indépendante de la machine |
| `endurance-v1.1.txt` / `.json` | 8 matchs enchaînés dans Chrome (`npm run soak`) | **Stabilité** en rendu logiciel |

## Ce que valent les mesures d'endurance
Elles ont été relevées dans Chrome sans interface, avec un rendu **logiciel** (Mesa llvmpipe, sans carte
graphique). Elles prouvent l'absence de fuite et d'erreur sur la durée : nombre de géométries et de
textures stable, mémoire JavaScript stable, aucune erreur de page.

Elles ne disent rien des performances sur du vrai matériel. Les 4 images par seconde relevées sont celles
du rendu logiciel. **Aucune mesure de performances matérielles n'existe à ce jour.**

Pour en obtenir : lancer le jeu sur la machine cible, appuyer sur **F3** pendant un combat et relever les
lignes affichées. La dernière ligne indique le moteur de rendu et signale un rendu logiciel le cas échéant.

## Lecture du « jeu aérien » dans le rapport d'équilibrage
- *Attaque sautée réussie* : part des sauts d'un combattant où son attaque aérienne a touché.
- *Sauts adverses contrés au sol* : part des sauts de l'adversaire interrompus par un coup porté depuis
  le sol, comptée une fois par saut. Une version antérieure comptait aussi les coups portés à un adversaire
  déjà projeté en l'air, d'où des taux supérieurs à 100 %.
