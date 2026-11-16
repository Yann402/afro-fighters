# Journal des versions

## 1.3.0 — Refonte artistique et enrichissement du jeu

### Combattants et rendu (prévu en 1.2)
- Les trois combattants sont des modèles 3D générés par scripts Blender (`tools/art/`), exportés en GLB :
  corps lisses, visages, mains, tenues, bijoux, armes. 33 000 à 42 000 triangles, environ 1 Mo chacun.
- Vêtements souples qui suivent les jambes ; rendu stylisé (lumière de contour, liseré de silhouette).
- Animation par ressort amorti (élan et rebond) ; nouvelles poses pour les nouveaux coups et états.
- Arène : enceinte de banco, public coloré et animé individuellement, trois ambiances (crépuscule, nuit, aube).
- Interface refaite : écran titre, HUD avec jauge de garde, menus animés, profil, options.

### Combat
- Coup moyen pour chaque combattant ; enchaînements léger → moyen → lourd → spécial.
- Ruée vers l'avant, esquive arrière invulnérable un court instant.
- Contre : garde levée juste avant l'impact.
- Jauge de garde : trop de coups bloqués brisent la garde et étourdissent.
- Finition : K.O. porté par un pouvoir spécial. Jongle limitée à quatre coups en l'air.
- IA : enchaînements, esquive des saisies, contres au niveau difficile, punition des adversaires étourdis.

### Modes et progression
- Deux joueurs en local (clavier partagé ou deux manettes).
- Entraînement, liste des coups avec démonstration.
- Progression : expérience, niveaux, statistiques, huit récompenses visuelles (tenues, ambiances).
- Sauvegarde locale automatique, versionnée, avec copie de secours, export et import.
- Touches reconfigurables ; qualité graphique haute, moyenne, basse ou automatique.

### Sécurité
- Une sauvegarde importée fabriquée pouvait exécuter du code JavaScript dans la page : les codes de
  touches sont désormais validés à la lecture, et tout libellé affiché est échappé. Vérifié par un
  test de non-régression et par une attaque rejouée dans le navigateur.

### Technique
- `saveState` / `loadState` : état complet d'un match copiable (préparation du jeu en ligne).
- 112 tests unitaires ; tests navigateur : parcours (50 vérifications), manettes simulées (20), endurance.

### Limites connues
Voir `docs/FEUILLE-DE-ROUTE.md` et `docs/RAPPORT-DE-TESTS.md`.

## 1.1.0 — Stabilisation et qualité technique (branche `feature/afro-fighters-evolution`)

### Problèmes corrigés
- **Blocage définitif en combat.** Quand un coup et une projection touchaient à la même frame, le lanceur
  était interrompu et l'adversaire restait « projeté » jusqu'à la fin du chrono. Mesuré sur la v1.0 :
  38 matchs sur 600 (IA normale) et 75 sur 600 (IA difficile). Désormais le coup l'emporte, et un filet
  de sécurité relâche tout combattant projeté sans lanceur.
- **Fuite de mémoire graphique.** Environ 730 géométries restaient en mémoire à chaque cycle
  match → sélection → titre (84 au départ, 2 199 après 3 cycles). Désormais stable à 96.
- **Adversaire projeté hors de l'arène** près des murs.
- **Projection qui infligeait des dégâts après la fin de la manche.**
- **Boucle de simulation** : l'accumulateur était remis à zéro quand le plafond de 5 pas était atteint,
  ce qui perdait la fraction de pas en cours (saccade d'interpolation). Remplacée par `src/core/fixedStep.js`.
- **Animations de menu et de victoire** dépendantes de la fréquence de l'écran (plus rapides en 144 Hz).
- **IA, anti-aérien** : condition logique ambiguë réécrite ; l'IA frappait dès le décollage adverse, elle
  attend maintenant que l'adversaire soit à portée.

### Équilibrage (détail et mesures : `docs/EQUILIBRAGE.md`)
- Adumu (Lekishon) : invulnérabilité 62 → 40 frames, interruptible pendant le troisième bond.
- Bàkk (Modou) : 245 → 195 dégâts. Saisie de Modou : élan vers l'avant, 135 → 120 dégâts.
- Bouclier de Themba : dégâts d'usure divisés par deux au lieu d'annulés. Iklwa plus sûre en garde.
- Dégâts d'usure des pouvoirs spéciaux : 15–18 % → 25 %.

### Corrections après relecture
- `npm test` exécute bien les 79 tests (le script visait un dossier au lieu des fichiers de test).
- Statistique des anti-aériens : comptée une fois par saut adverse, elle ne peut plus dépasser 100 %.
- Les mesures d'endurance sont étiquetées avec le moteur de rendu détecté.

### Ajouts
- 79 tests automatisés (`npm test`) : fuzz avec invariants, couverture des coups, boucle, équilibrage, déterminisme.
- Rapport d'équilibrage reproductible (`npm run balance`).
- Test d'endurance dans un vrai navigateur (`npm run soak`) : mesure de stabilité en rendu logiciel,
  pas de performances matérielles (voir `docs/mesures/README.md`).
- Mesures de performances en jeu : touche **F3** ou `?perf=1`.

## 1.0.0-beta — Version de référence
Import du ZIP d'origine, sans modification (commit `0ce78dc`).
