# Refonte artistique — stratégie et état

**État (version 1.3)** : la chaîne Blender est en place et les trois combattants sont modélisés. Blender
(`bpy` 5.3.0) a été installé avec accord, dans un environnement isolé. Ce qui suit est le plan d'origine ;
ce qui reste à faire figure dans `FEUILLE-DE-ROUTE.md`.

Direction retenue : **stylisé haut de gamme**. Ce document dit ce qui est réalisable avec les outils
réellement disponibles, et ce qui ne l'est pas.

## Ce dont je dispose, vérifié
| Capacité | État |
|---|---|
| Code, shaders, textures procédurales, Three.js | Disponible |
| Rendu de contrôle dans un vrai navigateur (captures) | Disponible, sans carte graphique (lent, mais fidèle) |
| Blender | **Absent.** Installable comme module Python (`bpy` 5.3) dans mon espace de travail distant : gratuit, rien sur ta machine. Demande ton accord |
| Génération 3D ou d'images par IA | **Aucun outil de ce type dans cette session** |
| Téléchargement de ressources | Limité à GitHub et aux registres de paquets. Mixamo est inaccessible (compte Adobe requis) |

## Approche proposée
1. **Chaîne de production automatisée avec Blender** (`tools/art/`) : des scripts génèrent les corps
   (surfaces de subdivision, visages sculptés par déformation), les vêtements, les bijoux et les armes,
   posent le squelette et les poids de peau, calculent les textures (occlusion, relief), et exportent en GLB.
   Tout est rejouable : modifier un script régénère le personnage.
2. **Rendu stylisé dans le jeu** : matériaux à dégradés peints, lumière de contour, liseré de silhouette,
   ombres douces, post-traitement léger (halo, étalonnage).
3. **Animation** : squelette unique pour les trois combattants, poses clés avec cinématique inverse
   (pieds ancrés au sol), anticipation et suivi du mouvement, tissus et tresses animés par ressorts.
4. **Arène** : architecture soudano-sahélienne (banco, toron), public varié et animé, éclairage du crépuscule retravaillé.
5. **Interface** : typographie et motifs propres au jeu, barres et menus animés.

Si tu refuses l'installation de Blender : même plan, avec des maillages générés par mes propres scripts
(surfaces implicites, export GLB écrit à la main). C'est faisable, mais le résultat sera moins fin sur les
visages et les tissus.

## Ce que cette approche ne donnera pas
Des personnages au niveau d'un sculpteur 3D professionnel, ni des animations issues de capture de mouvement.
Le résultat visé : des silhouettes lisses et lisibles, des tenues détaillées, un rendu cohérent, loin des
blocs actuels. Chaque étape sera montrée en captures avant d'être généralisée aux trois combattants.

## Ordre de travail
Prototype sur **Themba** (le plus complexe : bouclier, lance, plumes, fourrure), validation par captures,
puis Modou et Lekishon avec la même chaîne, puis arène, effets et interface.
