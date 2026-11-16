// Boucle à pas fixe : la simulation avance par pas de `dt` secondes, quel que soit le rythme d'affichage.
//
// Stratégie en cas de surcharge (machine trop lente ou onglet resté en arrière-plan) :
// on ne rattrape jamais plus de `maxSteps` pas par image, ce qui évite la « spirale de rattrapage »
// (plus on est en retard, plus on simule, plus on est en retard). Le temps en excès est abandonné
// et comptabilisé dans `dropped` : le jeu ralentit au lieu de se bloquer.
// La fraction de pas en cours est toujours conservée, donc l'interpolation d'affichage reste continue
// (l'ancienne version remettait l'accumulateur à zéro dès que le plafond était atteint).
export class FixedStep {
  constructor(dt, maxSteps = 5) {
    this.dt = dt;
    this.maxSteps = maxSteps;
    this.acc = 0;
    this.dropped = 0;      // secondes de simulation abandonnées depuis le début
    this.overloads = 0;    // nombre d'images où le plafond a été atteint
    this.lastSteps = 0;
  }

  reset() { this.acc = 0; this.lastSteps = 0; }

  // Ajoute `elapsed` secondes et exécute les pas dus. Retourne le nombre de pas exécutés.
  advance(elapsed, step) {
    if (!(elapsed > 0)) { this.lastSteps = 0; return 0; }
    this.acc += elapsed;
    const cap = this.maxSteps * this.dt;
    if (this.acc >= cap + this.dt) {
      const frac = this.acc % this.dt;
      this.dropped += this.acc - cap - frac;
      this.overloads++;
      this.acc = cap + frac;
    }
    let n = 0;
    // 1e-9 : tolérance d'arrondi pour ne pas perdre un pas quand acc vaut « presque » dt
    while (this.acc + 1e-9 >= this.dt && n < this.maxSteps) {
      this.acc -= this.dt;
      n++;
      step();
    }
    if (this.acc < 0) this.acc = 0;
    this.lastSteps = n;
    return n;
  }

  // Position dans le pas en cours, entre 0 et 1, pour interpoler l'affichage.
  get alpha() { return Math.min(1, this.acc / this.dt); }
}
