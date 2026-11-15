// Données de jeu des combattants (logique pure, aucune dépendance au rendu).
// Frames : 1 = première frame du coup. Fenêtres de coup [start, end] inclusives.
// reach : portée horizontale devant le combattant ; height : bande verticale depuis les pieds.

const hit = (o) => ({
  kind: 'strike', height: [0.7, 1.7], hitstun: 16, blockstun: 11, push: 0.06,
  knockdown: false, launch: 0.13, hitstop: null, chip: 0.12, ...o,
});

export const CHARACTERS = {
  // ─────────────────────────────── LAAMB (Sénégal)
  modou: {
    id: 'modou',
    name: 'Modou',
    title: 'Le Roc de la Médina',
    culture: 'Lutte sénégalaise · Laamb',
    blurb: 'Lutteur puissant. Saisies, projections et une résistance hors norme.',
    style: 'Grappler',
    stats: { force: 5, vitesse: 2, portee: 2, defense: 5 },
    hp: 1120, defense: 0.93,
    walk: 0.039, backWalk: 0.029,
    jumpV: 0.185, jumpVX: 0.05,
    pushWidth: 0.44,
    idealRange: 0.9,
    throwRange: 1.15,
    dash: { frames: 15, speed: 0.1, backFrames: 18, backSpeed: 0.06, backInvuln: 8 },
    moves: {
      light: {
        id: 'light', name: 'Claque du lutteur', total: 19, cancels: ['medium'],
        hits: [hit({ start: 6, end: 8, reach: [0.15, 1.15], damage: 56, hitstun: 18, blockstun: 12, push: 0.05 })],
      },
      medium: {
        id: 'medium', name: "Coup d'épaule", total: 32, cancels: [],
        advance: 0.5,
        armor: [2, 9],     // encaisse un coup pendant l'élan : c'est l'outil d'approche du lutteur
        motion(f, fr) { f.vx = fr >= 4 && fr <= 12 ? f.facing * (this.advance / 9) : f.vx * 0.6; },
        hits: [hit({ start: 10, end: 13, reach: [0.1, 0.95], height: [0.6, 1.6], damage: 84, hitstun: 22, blockstun: 16, push: 0.1, knockdown: true, launch: 0.12 })],
      },
      heavy: {
        id: 'heavy', name: 'Saisie de la Médina', total: 42, cancels: [],
        // le lutteur plonge vers l'avant : c'est son outil pour franchir la distance
        advance: 0.45,
        motion(f, fr) { f.vx = fr <= 8 ? f.facing * (this.advance / 8) : f.vx * 0.6; },
        hits: [hit({ start: 6, end: 9, kind: 'throw', reach: [0.0, 1.15], height: [0, 1.9], damage: 0 })],
        throwAnim: { length: 52, slamAt: 34, damage: 132, fx: 'slam' },
      },
      air: {
        id: 'air', name: 'Chute du Roc', total: 60, cancels: [],
        hits: [hit({ start: 6, end: 30, reach: [-0.25, 0.85], height: [-0.5, 0.9], damage: 72, hitstun: 19, blockstun: 13 })],
      },
      special: {
        id: 'special', name: 'BÀKK — Défi du Lutteur', special: true, total: 84, cancels: [],
        armor: [1, 34],
        hits: [hit({ start: 37, end: 54, kind: 'throw', reach: [-0.1, 1.1], height: [0, 1.9], damage: 0 })],
        throwAnim: { length: 74, slamAt: 54, damage: 195, fx: 'bigSlam' },
        motion(f, fr) {
          if (fr >= 35 && fr <= 54) f.vx = f.facing * 0.17;
          else f.vx *= 0.7;
        },
        cues: { 8: 'stomp', 20: 'stomp', 30: 'roar', 35: 'dash' },
      },
    },
    special: { name: 'Bàkk', desc: 'Danse de défi du lutteur avec super-armure, puis charge et projection imblocable. Se contre en sautant ou en frappant pendant la charge.' },
  },

  // ─────────────────────────────── ZOULOU (Afrique australe)
  themba: {
    id: 'themba',
    name: 'Themba',
    title: "L'Orage du Veld",
    culture: 'Guerrier zoulou',
    blurb: 'Lance courte iklwa et bouclier isihlangu. Défense solide, pression constante.',
    style: 'Équilibré',
    stats: { force: 4, vitesse: 3, portee: 3, defense: 4 },
    hp: 1000,
    walk: 0.045, backWalk: 0.036,
    jumpV: 0.2, jumpVX: 0.06,
    pushWidth: 0.38,
    idealRange: 1.65,
    throwRange: 0.9,
    dash: { frames: 15, speed: 0.1, backFrames: 17, backSpeed: 0.075, backInvuln: 9 },
    shieldGuard: true,
    moves: {
      light: {
        id: 'light', name: 'Frappe du bouclier', total: 18, cancels: ['medium', 'heavy', 'special'],
        hits: [hit({ start: 5, end: 7, reach: [0.15, 0.98], height: [0.5, 1.85], damage: 42, hitstun: 17, blockstun: 12, push: 0.09 })],
      },
      medium: {
        id: 'medium', name: 'Fauchage', total: 27, cancels: ['heavy', 'special'],
        hits: [hit({ start: 8, end: 10, reach: [0.25, 1.32], height: [0.3, 1.3], damage: 60, hitstun: 20, blockstun: 14, push: 0.07 })],
      },
      heavy: {
        id: 'heavy', name: 'Iklwa', total: 33, cancels: ['special'],
        hits: [hit({ start: 11, end: 14, reach: [0.3, 1.62], height: [0.85, 1.5], damage: 90, hitstun: 23, blockstun: 19, push: 0.07 })],
      },
      throw: {
        id: 'throw', name: 'Renversement au bouclier', total: 32, cancels: [],
        hits: [hit({ start: 6, end: 7, kind: 'throw', reach: [0.0, 0.9], height: [0, 1.9], damage: 0 })],
        throwAnim: { length: 38, slamAt: 22, damage: 105, fx: 'slam' },
      },
      air: {
        id: 'air', name: 'Iklwa plongeante', total: 60, cancels: [],
        hits: [hit({ start: 5, end: 22, reach: [0.05, 1.15], height: [-0.6, 0.9], damage: 66, hitstun: 18 })],
      },
      special: {
        id: 'special', name: 'IMPONDO ZANKOMO — Cornes du Buffle', special: true, total: 80, cancels: [],
        invuln: [1, 12],
        hits: [
          hit({ start: 21, end: 25, reach: [0.0, 1.15], damage: 58, hitstun: 30, blockstun: 16, push: 0.015, chip: 0.25 }),
          hit({ start: 33, end: 37, reach: [0.0, 1.15], damage: 58, hitstun: 30, blockstun: 16, push: 0.015, chip: 0.25 }),
          hit({ start: 45, end: 50, reach: [0.0, 1.25], damage: 118, hitstun: 30, blockstun: 18, push: 0.12, knockdown: true, launch: 0.17, hitstop: 14, chip: 0.25 }),
        ],
        motion(f, fr) {
          if (fr >= 17 && fr <= 50) f.vx = f.facing * 0.15;
          else f.vx *= 0.75;
        },
        cues: { 2: 'warcry', 17: 'dash' },
      },
    },
    special: { name: 'Impondo Zankomo', desc: 'La formation des « cornes du buffle » : charge en triple frappe, épaulé par deux guerriers spectraux.' },
  },

  // ─────────────────────────────── MAASAÏ (Afrique de l'Est)
  lekishon: {
    id: 'lekishon',
    name: 'Lekishon',
    title: 'Le Faucon de la Savane',
    culture: 'Guerrier maasaï',
    blurb: 'Rapide et aérien. Longue lance, massue rungu et sauts prodigieux.',
    style: 'Longue portée',
    stats: { force: 3, vitesse: 5, portee: 5, defense: 2 },
    hp: 960,
    walk: 0.054, backWalk: 0.045,
    jumpV: 0.23, jumpVX: 0.07,
    pushWidth: 0.34,
    idealRange: 1.8,
    throwRange: 0.85,
    dash: { frames: 13, speed: 0.12, backFrames: 16, backSpeed: 0.095, backInvuln: 10 },
    moves: {
      light: {
        id: 'light', name: 'Rungu', total: 18, cancels: ['medium', 'heavy', 'special'],
        hits: [hit({ start: 6, end: 8, reach: [0.2, 1.12], height: [0.8, 1.8], damage: 44, hitstun: 17, blockstun: 11 })],
      },
      medium: {
        id: 'medium', name: 'Revers de hampe', total: 28, cancels: ['heavy', 'special'],
        hits: [hit({ start: 9, end: 11, reach: [0.3, 1.6], height: [0.7, 1.6], damage: 58, hitstun: 20, blockstun: 13, push: 0.08 })],
      },
      heavy: {
        id: 'heavy', name: 'Lance du Faucon', total: 39, cancels: ['special'],
        hits: [hit({ start: 13, end: 16, reach: [0.4, 2.05], height: [0.85, 1.4], damage: 80, hitstun: 22, blockstun: 15, push: 0.07 })],
      },
      throw: {
        id: 'throw', name: 'Balayage de la savane', total: 30, cancels: [],
        hits: [hit({ start: 6, end: 7, kind: 'throw', reach: [0.0, 0.85], height: [0, 1.9], damage: 0 })],
        throwAnim: { length: 32, slamAt: 16, damage: 92, fx: 'slam' },
      },
      air: {
        id: 'air', name: 'Rungu aérien', total: 60, cancels: [],
        hits: [hit({ start: 5, end: 18, reach: [0.0, 1.05], height: [-0.5, 0.85], damage: 56, hitstun: 17 })],
      },
      special: {
        id: 'special', name: 'ADUMU — Danse des Sauts', special: true, total: 112, cancels: [],
        invuln: [1, 40],
        airborneMove: true,
        hits: [hit({ start: 74, end: 86, reach: [-0.55, 0.75], height: [-0.8, 1.1], damage: 195, hitstun: 30, blockstun: 16, push: 0.1, knockdown: true, launch: 0.15, hitstop: 15, chip: 0.25 })],
        motion(f, fr, opp) {
          // 3 sauts verticaux de plus en plus hauts (adumu), puis bond et piqué sur l'adversaire
          const hops = [[1, 20, 0.55], [21, 40, 0.85], [41, 62, 1.25]];
          for (const [a, b, h] of hops) {
            if (fr >= a && fr <= b) {
              const p = (fr - a) / (b - a);
              f.y = Math.sin(p * Math.PI) * h;
              f.vx = 0;
              return;
            }
          }
          if (fr === 63) {
            f.sx = f.x; f.tx = opp.x - f.facing * 0.25;
          }
          if (fr >= 63 && fr <= 73) {
            const p = (fr - 63) / 10;
            f.x = f.sx + (f.tx - f.sx) * p;
            f.y = Math.sin(p * Math.PI * 0.5) * 2.4;
            return;
          }
          if (fr >= 74 && fr <= 86) {
            const p = (fr - 74) / 12;
            f.x += f.facing * 0.012;
            f.y = Math.max(0, 2.4 * (1 - p * p));
            return;
          }
          f.y = 0; f.vx *= 0.7;
        },
        cues: { 1: 'hop', 21: 'hop', 41: 'hop', 63: 'leap', 86: 'impact' },
      },
    },
    special: { name: 'Adumu', desc: 'Les sauts rituels maasaï : trois bonds, puis un piqué de lance qui suit l’adversaire. Invulnérable pendant les deux premiers bonds, à utiliser de loin.' },
  },
};

export const ROSTER = ['modou', 'themba', 'lekishon'];

// Pré-calcul des phases utiles à l'animation et à l'IA
for (const id of ROSTER) {
  const c = CHARACTERS[id];
  if (!c.moves.throw) c.moves.throw = c.moves.heavy; // Modou : la saisie lourde EST la projection
  for (const m of Object.values(c.moves)) {
    m.startup = Math.min(...m.hits.map((h) => h.start));
    m.activeEnd = Math.max(...m.hits.map((h) => h.end));
    m.maxReach = Math.max(...m.hits.map((h) => h.reach[1]));
    m.isThrow = m.hits.every((h) => h.kind === 'throw');
    m.advance = m.advance || 0;
  }
}
