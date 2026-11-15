# Journal des versions

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

### Ajouts
- 79 tests automatisés (`npm test`) : fuzz avec invariants, couverture des coups, boucle, équilibrage, déterminisme.
- Rapport d'équilibrage reproductible (`npm run balance`).
- Test d'endurance dans un vrai navigateur (`npm run soak`).
- Mesures de performances en jeu : touche **F3** ou `?perf=1`.

## 1.0.0-beta — Version de référence
Import du ZIP d'origine, sans modification (commit `0ce78dc`).
