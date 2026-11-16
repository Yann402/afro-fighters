// Poses et animation procédurale.
// Toutes les valeurs sont des angles (radians) « lisibles » :
//  *ShF = bras levé vers l'avant, *ShA = bras écarté, *El = coude plié, *W = poignet,
//  *Hip = cuisse vers l'avant, *Knee = genou plié, lean = buste penché en avant, twist = rotation du buste,
//  fall = bascule de tout le corps (négatif = en arrière), rootY = décalage vertical.
export const KEYS = ['rootY', 'fall', 'turn', 'lean', 'twist', 'side', 'head',
  'rShF', 'rShA', 'rEl', 'rW', 'lShF', 'lShA', 'lEl', 'lW',
  'rHip', 'rKnee', 'lHip', 'lKnee', 'spread'];

export const ZERO = Object.fromEntries(KEYS.map((k) => [k, 0]));
const P = (o) => ({ ...ZERO, ...o });

export function mix(a, b, t) {
  const o = {};
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}
const add = (a, d) => { const o = { ...a }; for (const k in d) o[k] = (o[k] || 0) + d[k]; return o; };
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ───────────────────────────── Bibliothèque par personnage
export const POSES = {
  modou: {
    stance: P({ rootY: -0.13, lean: 0.38, twist: -0.25, turn: -0.15, head: -0.25, rShF: 0.95, rShA: 0.45, rEl: 0.75, lShF: 1.1, lShA: 0.4, lEl: 0.55, lHip: 0.5, lKnee: 0.65, rHip: -0.2, rKnee: 0.55, spread: 0.2 }),
    guard: P({ rootY: -0.16, lean: 0.45, twist: -0.1, turn: -0.1, head: -0.1, rShF: 1.2, rShA: 0.15, rEl: 1.9, lShF: 1.3, lShA: 0.1, lEl: 1.9, lHip: 0.45, lKnee: 0.7, rHip: -0.2, rKnee: 0.6, spread: 0.22 }),
    light: {
      wind: P({ rootY: -0.12, lean: 0.25, twist: 0.35, turn: 0.1, rShF: 0.6, rShA: 0.9, rEl: 1.4, lShF: 1.0, lShA: 0.3, lEl: 0.8, lHip: 0.45, lKnee: 0.5, rHip: -0.25, rKnee: 0.5, spread: 0.2 }),
      strike: P({ rootY: -0.15, lean: 0.5, twist: -0.6, turn: -0.35, rShF: 1.55, rShA: 0.1, rEl: 0.15, rW: -0.5, lShF: 0.4, lShA: 0.5, lEl: 1.2, lHip: 0.75, lKnee: 0.7, rHip: -0.4, rKnee: 0.3, spread: 0.2 }),
    },
    heavy: { // saisie : les deux bras plongent vers l'avant
      wind: P({ rootY: -0.25, lean: 0.55, twist: 0, head: -0.3, rShF: 0.6, rShA: 0.8, rEl: 0.6, lShF: 0.6, lShA: 0.8, lEl: 0.6, lHip: 0.6, lKnee: 0.9, rHip: -0.1, rKnee: 0.8, spread: 0.3 }),
      strike: P({ rootY: -0.3, lean: 0.85, twist: 0, head: -0.5, rShF: 1.6, rShA: 0.25, rEl: 0.3, lShF: 1.6, lShA: 0.25, lEl: 0.3, lHip: 1.0, lKnee: 1.0, rHip: -0.45, rKnee: 0.4, spread: 0.2 }),
    },
    medium: { // coup d'épaule : l'épaule gauche en avant, bras ramassés
      wind: P({ rootY: -0.22, lean: 0.3, twist: 0.5, turn: 0.2, head: -0.2, rShF: 0.3, rShA: 0.5, rEl: 1.6, lShF: 0.5, lShA: 0.3, lEl: 1.9, lHip: 0.5, lKnee: 0.9, rHip: -0.1, rKnee: 0.8, spread: 0.25 }),
      strike: P({ rootY: -0.18, lean: 0.75, twist: -0.75, turn: -0.35, head: -0.45, rShF: -0.2, rShA: 0.6, rEl: 1.2, lShF: 0.7, lShA: 0.15, lEl: 2.1, lHip: 1.0, lKnee: 0.8, rHip: -0.6, rKnee: 0.25, spread: 0.2 }),
    },
    air: {
      wind: P({ lean: -0.2, rShF: 2.6, rShA: 0.4, rEl: 0.5, lShF: 2.6, lShA: 0.4, lEl: 0.5, rHip: 0.8, rKnee: 1.4, lHip: 0.8, lKnee: 1.4 }),
      strike: P({ lean: 0.7, rShF: 1.2, rShA: 0.9, rEl: 0.2, lShF: 1.2, lShA: 0.9, lEl: 0.2, rHip: 0.3, rKnee: 0.4, lHip: 0.3, lKnee: 0.4 }),
    },
    win: (t) => {
      const s = Math.sin(t * 0.12);
      return P({ rootY: -0.05 + Math.abs(s) * 0.04, lean: -0.2, head: -0.3, rShF: 0.2, rShA: 1.45, rEl: 1.9, lShF: 0.2, lShA: 1.45, lEl: 1.9, lHip: s > 0 ? 0.9 : 0.1, lKnee: s > 0 ? 1.2 : 0.2, rHip: 0.05, rKnee: 0.1, spread: 0.15 });
    },
  },

  themba: {
    stance: P({ rootY: -0.08, lean: 0.15, twist: -0.45, turn: -0.25, head: 0.0, lShF: 0.9, lShA: 0.2, lEl: 1.25, rShF: 0.25, rShA: 0.7, rEl: 1.9, rW: 0.6, lHip: 0.38, lKnee: 0.4, rHip: -0.32, rKnee: 0.3, spread: 0.14 }),
    guard: P({ rootY: -0.14, lean: 0.25, twist: -0.6, turn: -0.3, head: 0.15, lShF: 1.25, lShA: 0.05, lEl: 0.9, rShF: 0.1, rShA: 0.5, rEl: 1.7, rW: 0.5, lHip: 0.45, lKnee: 0.55, rHip: -0.35, rKnee: 0.45, spread: 0.18 }),
    light: { // coup de bouclier : poussée du bras gauche
      wind: P({ rootY: -0.1, lean: 0.05, twist: -0.8, turn: -0.4, lShF: 0.6, lShA: 0.1, lEl: 1.6, rShF: 0.2, rShA: 0.7, rEl: 1.9, rW: 0.6, lHip: 0.35, lKnee: 0.4, rHip: -0.35, rKnee: 0.35, spread: 0.14 }),
      strike: P({ rootY: -0.12, lean: 0.4, twist: -0.2, turn: -0.1, lShF: 1.5, lShA: 0.05, lEl: 0.4, rShF: 0.3, rShA: 0.7, rEl: 1.9, rW: 0.6, lHip: 0.75, lKnee: 0.5, rHip: -0.45, rKnee: 0.25, spread: 0.14 }),
    },
    heavy: { // iklwa : estoc de la lance courte
      wind: P({ rootY: -0.1, lean: 0.0, twist: -0.95, turn: -0.45, lShF: 1.1, lShA: 0.1, lEl: 1.2, rShF: -0.4, rShA: 0.4, rEl: 1.5, rW: 1.2, lHip: 0.3, lKnee: 0.4, rHip: -0.4, rKnee: 0.4, spread: 0.14 }),
      strike: P({ rootY: -0.17, lean: 0.45, twist: 0.35, turn: 0.1, lShF: 0.5, lShA: 0.5, lEl: 1.4, rShF: 1.5, rShA: 0.1, rEl: 0.05, rW: 1.55, lHip: 0.85, lKnee: 0.65, rHip: -0.5, rKnee: 0.2, spread: 0.14 }),
    },
    medium: { // fauchage : la lance balaie au ras du sol
      wind: P({ rootY: -0.2, lean: 0.25, twist: 0.7, turn: 0.2, lShF: 1.1, lShA: 0.1, lEl: 1.2, rShF: 0.2, rShA: 1.0, rEl: 0.9, rW: 1.9, lHip: 0.5, lKnee: 0.8, rHip: -0.3, rKnee: 0.7, spread: 0.16 }),
      strike: P({ rootY: -0.36, lean: 0.6, twist: -0.6, turn: -0.3, lShF: 0.9, lShA: 0.3, lEl: 1.4, rShF: 0.75, rShA: 0.0, rEl: 0.15, rW: 1.5, lHip: 1.05, lKnee: 1.25, rHip: -0.6, rKnee: 0.55, spread: 0.16 }),
    },
    air: {
      wind: P({ lean: -0.1, lShF: 1.0, lEl: 1.2, rShF: 2.4, rShA: 0.3, rEl: 0.6, rW: 1.6, rHip: 0.9, rKnee: 1.5, lHip: 0.9, lKnee: 1.5 }),
      strike: P({ lean: 0.55, lShF: 0.9, lEl: 1.0, rShF: 1.1, rShA: 0.2, rEl: 0.05, rW: 2.4, rHip: 0.5, rKnee: 0.6, lHip: 0.4, lKnee: 0.5 }),
    },
    win: (t) => {
      const s = Math.sin(t * 0.14);
      return P({ rootY: -0.04 + Math.abs(s) * 0.05, lean: -0.1, head: -0.25, twist: -0.2, lShF: 0.6, lShA: 0.5, lEl: 1.3, rShF: 2.9, rShA: 0.3, rEl: 0.25, rW: 0.0, lHip: s > 0.3 ? 1.1 : 0.15, lKnee: s > 0.3 ? 1.2 : 0.2, rHip: -0.05, rKnee: 0.1, spread: 0.1 });
    },
  },

  lekishon: {
    stance: P({ rootY: -0.04, lean: 0.06, twist: -0.3, turn: -0.15, head: 0, rShF: 0.35, rShA: 0.25, rEl: 1.35, rW: 1.35, lShF: 0.45, lShA: 0.25, lEl: 1.0, lW: 0.6, lHip: 0.3, lKnee: 0.25, rHip: -0.22, rKnee: 0.2, spread: 0.1 }),
    guard: P({ rootY: -0.1, lean: 0.12, twist: -0.4, turn: -0.2, head: 0.1, rShF: 0.9, rShA: 0.1, rEl: 1.4, rW: 1.6, lShF: 1.1, lShA: 0.1, lEl: 1.7, lW: 0.6, lHip: 0.35, lKnee: 0.4, rHip: -0.25, rKnee: 0.35, spread: 0.12 }),
    light: { // rungu : coup de massue de la main gauche
      wind: P({ rootY: -0.06, lean: -0.05, twist: 0.25, turn: 0.05, rShF: 0.35, rShA: 0.25, rEl: 1.35, rW: 1.35, lShF: 2.3, lShA: 0.3, lEl: 1.4, lW: 0.6, lHip: 0.3, lKnee: 0.3, rHip: -0.25, rKnee: 0.25, spread: 0.1 }),
      strike: P({ rootY: -0.1, lean: 0.35, twist: -0.6, turn: -0.3, rShF: 0.3, rShA: 0.35, rEl: 1.2, rW: 1.35, lShF: 1.2, lShA: 0.1, lEl: 0.1, lW: 0.3, lHip: 0.55, lKnee: 0.4, rHip: -0.35, rKnee: 0.2, spread: 0.1 }),
    },
    heavy: { // lance : grande fente
      wind: P({ rootY: -0.06, lean: -0.1, twist: -1.0, turn: -0.5, rShF: 0.1, rShA: 0.3, rEl: 1.6, rW: 1.6, lShF: 0.9, lShA: 0.3, lEl: 0.5, lW: 0, lHip: 0.2, lKnee: 0.25, rHip: -0.3, rKnee: 0.3, spread: 0.1 }),
      strike: P({ rootY: -0.28, lean: 0.55, twist: 0.4, turn: 0.15, rShF: 1.55, rShA: 0.05, rEl: 0.0, rW: 1.57, lShF: -0.5, lShA: 0.4, lEl: 0.2, lHip: 1.15, lKnee: 1.1, rHip: -0.7, rKnee: 0.1, spread: 0.08 }),
    },
    medium: { // revers de hampe : la lance tourne à l'horizontale
      wind: P({ rootY: -0.08, lean: 0.05, twist: 0.9, turn: 0.35, rShF: 0.9, rShA: 0.9, rEl: 1.3, rW: 0.3, lShF: 0.6, lShA: 0.3, lEl: 1.2, lW: 0.6, lHip: 0.3, lKnee: 0.35, rHip: -0.25, rKnee: 0.3, spread: 0.1 }),
      strike: P({ rootY: -0.14, lean: 0.3, twist: -0.85, turn: -0.4, rShF: 1.35, rShA: -0.2, rEl: 0.25, rW: 0.2, lShF: 0.2, lShA: 0.5, lEl: 1.0, lW: 0.6, lHip: 0.7, lKnee: 0.55, rHip: -0.45, rKnee: 0.2, spread: 0.1 }),
    },
    air: {
      wind: P({ lean: -0.15, rShF: 0.4, rEl: 1.3, rW: 1.3, lShF: 2.6, lEl: 1.3, lW: 0.6, rHip: 0.7, rKnee: 1.3, lHip: 0.7, lKnee: 1.3 }),
      strike: P({ lean: 0.5, rShF: 0.4, rEl: 1.3, rW: 1.3, lShF: 1.0, lEl: 0.1, lW: 0.3, rHip: 0.4, rKnee: 0.5, lHip: 0.3, lKnee: 0.5 }),
    },
    win: (t) => { // adumu : sauts verticaux, corps droit
      const ph = (t % 34) / 34;
      const up = Math.sin(ph * Math.PI);
      return P({ rootY: up * 0.45 - 0.02, lean: 0, head: -0.1 * up, rShF: 0.15, rShA: 0.05, rEl: 0.6, rW: 1.0, lShF: 0.05, lShA: 0.08, lEl: 0.1, lW: 0.6, lHip: 0.0, lKnee: (1 - up) * 0.35, rHip: 0, rKnee: (1 - up) * 0.35, spread: 0.02 });
    },
  },
};

// Poses génériques de réaction
const HURT = P({ rootY: -0.06, lean: -0.45, head: -0.45, twist: 0.2, rShF: 0.4, rShA: 0.7, rEl: 0.6, lShF: 0.4, lShA: 0.7, lEl: 0.6, lHip: 0.15, lKnee: 0.35, rHip: -0.35, rKnee: 0.2, spread: 0.18 });
const LAUNCH = P({ rootY: 0, fall: -0.7, lean: -0.3, head: -0.5, rShF: 1.6, rShA: 0.9, rEl: 0.4, lShF: 1.6, lShA: 0.9, lEl: 0.4, lHip: 0.6, lKnee: 0.6, rHip: 0.2, rKnee: 0.8, spread: 0.2 });
const DOWN = (build) => P({ rootY: -(build.thigh + build.shin) + 0.12, fall: -1.5, lean: 0, head: 0.3, rShF: 2.6, rShA: 0.6, rEl: 0.3, lShF: 2.4, lShA: 0.9, lEl: 0.6, lHip: 0.25, lKnee: 0.5, rHip: 0.05, rKnee: 0.15, spread: 0.25 });
const CROUCH = P({ rootY: -0.22, lean: 0.25, lHip: 0.7, lKnee: 1.1, rHip: 0.25, rKnee: 0.9, spread: 0.2 });
const TUCK = P({ lean: 0.2, rHip: 1.1, rKnee: 1.7, lHip: 1.2, lKnee: 1.6, rShF: 0.8, rShA: 0.6, rEl: 1.0, lShF: 0.8, lShA: 0.6, lEl: 1.0 });

function attackPose(lib, key, f) {
  const m = f.move;
  const set = lib[key] || lib.light;
  const st = lib.stance;
  if (f.mf < m.startup) return mix(st, set.wind, easeOut(clamp01(f.mf / m.startup)));
  if (f.mf <= m.activeEnd) {
    const p = clamp01((f.mf - m.startup + 1) / Math.max(1, m.activeEnd - m.startup + 1));
    return mix(set.wind, set.strike, Math.min(1, 0.65 + p));
  }
  const p = clamp01((f.mf - m.activeEnd) / Math.max(1, m.total - m.activeEnd));
  return mix(set.strike, st, easeInOut(p));
}

// ───────────────────────────── Pouvoirs spéciaux (chorégraphies)
const SPECIALS = {
  modou(f, lib) {
    const fr = f.mf;
    const st = lib.stance;
    if (fr <= 34) { // Bàkk : danse de défi, piétinements et bras levés
      const stompL = fr < 14;
      const lift = Math.sin(clamp01(((fr - 1) % 12) / 11) * Math.PI);
      const base = P({ rootY: -0.1, lean: -0.15, head: -0.35, twist: Math.sin(fr * 0.25) * 0.3, rShF: 0.3, rShA: 1.4, rEl: 1.9, lShF: 0.3, lShA: 1.4, lEl: 1.9, spread: 0.25, lHip: 0.1, lKnee: 0.3, rHip: 0.1, rKnee: 0.3 });
      if (fr < 26) {
        if (stompL) { base.lHip = 0.2 + lift * 1.1; base.lKnee = 0.3 + lift * 1.3; }
        else { base.rHip = 0.2 + lift * 1.1; base.rKnee = 0.3 + lift * 1.3; }
      } else { // rugissement, bras grand ouverts
        base.lean = -0.35; base.head = -0.6; base.rShA = 1.0; base.lShA = 1.0; base.rEl = 0.3; base.lEl = 0.3; base.rShF = 0.6; base.lShF = 0.6;
      }
      return base;
    }
    if (fr <= 54) return lib.heavy.strike;
    return mix(lib.heavy.strike, st, easeInOut(clamp01((fr - 54) / 30)));
  },
  themba(f, lib) {
    const fr = f.mf;
    if (fr <= 16) { // cri de guerre : lance et bouclier brandis
      return P({ rootY: -0.05, lean: -0.3, head: -0.5, twist: -0.2, lShF: 1.0, lShA: 0.6, lEl: 0.9, rShF: 2.9, rShA: 0.2, rEl: 0.2, rW: 0.0, lHip: 0.25, lKnee: 0.2, rHip: -0.15, rKnee: 0.15, spread: 0.2 });
    }
    if (fr <= 50) { // charge : course, estocs successifs
      const run = Math.sin(fr * 0.75);
      const stab = [21, 33, 45].some((h) => fr >= h && fr <= h + 5);
      return P({ rootY: -0.12 + Math.abs(run) * 0.06, lean: 0.55, twist: stab ? 0.3 : -0.5, head: 0.15, lShF: 1.3, lShA: 0.1, lEl: 0.9, rShF: stab ? 1.55 : -0.3, rShA: 0.3, rEl: stab ? 0.05 : 1.5, rW: stab ? 1.55 : 1.2, lHip: 0.3 + run * 0.9, lKnee: 0.6 + Math.max(0, -run) * 1.0, rHip: 0.3 - run * 0.9, rKnee: 0.6 + Math.max(0, run) * 1.0, spread: 0.1 });
    }
    return mix(lib.heavy.strike, lib.stance, easeInOut(clamp01((fr - 50) / 30)));
  },
  lekishon(f, lib) {
    const fr = f.mf;
    if (fr <= 62) { // adumu : corps droit, jambes jointes, impulsions
      const hops = [[1, 20], [21, 40], [41, 62]];
      let p = 0;
      for (const [a, b] of hops) if (fr >= a && fr <= b) p = (fr - a) / (b - a);
      const crouch = p < 0.12 || p > 0.88 ? 0.5 : 0;
      return P({ rootY: -crouch * 0.2, lean: 0.02, head: -0.15, rShF: 0.15, rShA: 0.05, rEl: 0.6, rW: 1.0, lShF: 0.05, lShA: 0.08, lEl: 0.1, lW: 0.6, lHip: crouch * 0.5, lKnee: crouch * 0.9, rHip: crouch * 0.5, rKnee: crouch * 0.9, spread: 0.02 });
    }
    if (fr <= 73) { // bond : lance au-dessus de la tête
      return P({ lean: -0.25, head: -0.2, rShF: 2.8, rShA: 0.2, rEl: 0.4, rW: 1.4, lShF: 1.5, lShA: 0.6, lEl: 0.3, lHip: 1.0, lKnee: 1.6, rHip: 0.6, rKnee: 1.4 });
    }
    if (fr <= 86) { // piqué : lance pointée vers le bas
      return P({ fall: 0.0, lean: 0.95, head: -0.3, rShF: 1.2, rShA: 0.1, rEl: 0.1, rW: 2.9, lShF: 0.4, lShA: 0.8, lEl: 0.4, lHip: 0.2, lKnee: 0.5, rHip: -0.2, rKnee: 0.6 });
    }
    const p = clamp01((fr - 86) / 26);
    return mix(add(CROUCH, { lean: 0.6, rShF: 1.2, rW: 2.4 }), lib.stance, easeInOut(p));
  },
};

// Les poses de réaction communes gardent l'orientation des armes propre au combattant
// (sinon la lance traverse le corps quand il encaisse un coup).
const grip = (pose, st) => ({ ...pose, rW: st.rW, lW: st.lW });

// ───────────────────────────── Pose cible selon l'état logique
export function targetPose(f, view, match) {
  const id = f.char.id;
  const lib = POSES[id];
  const st = lib.stance;
  const t = f.t;
  const time = view.time;

  switch (f.state) {
    case 'intro': {
      const s = Math.sin(time * 2);
      return add(st, { rootY: s * 0.01, lean: -0.05 });
    }
    case 'idle': case 'land': {
      const breathe = Math.sin(time * (id === 'lekishon' ? 5.5 : 3.2));
      const base = f.state === 'land' && t < 6 ? mix(CROUCH, st, t / 6) : st;
      const bounce = id === 'lekishon' ? Math.abs(breathe) * 0.035 : breathe * 0.012;
      return add(base, { rootY: bounce, lean: breathe * 0.025, rShA: breathe * 0.03, lShA: -breathe * 0.03, lKnee: id === 'lekishon' ? (1 - Math.abs(breathe)) * 0.12 : 0, rKnee: id === 'lekishon' ? (1 - Math.abs(breathe)) * 0.12 : 0 });
    }
    case 'walk': {
      const ph = view.walkPhase;
      const s = Math.sin(ph), c = Math.cos(ph);
      const amp = id === 'modou' ? 0.32 : 0.42;
      return add(st, {
        rootY: Math.abs(c) * 0.035 - 0.015, lHip: s * amp, rHip: -s * amp,
        lKnee: Math.max(0, c) * 0.55, rKnee: Math.max(0, -c) * 0.55,
        lean: f.walkDir > 0 ? 0.06 : -0.06, twist: s * 0.06,
      });
    }
    case 'guard': return lib.guard;
    case 'blockstun': return add(lib.guard, { lean: -0.15, rootY: -0.03 });
    case 'jumpsquat': return mix(st, CROUCH, 0.9);
    case 'air': {
      const k = clamp01((f.vy + 0.05) / 0.25);
      return mix(add(st, { rHip: 0.3, lHip: 0.5, rKnee: 0.7, lKnee: 0.5 }), add(TUCK, { rShF: st.rShF, rEl: st.rEl, rW: st.rW, lShF: st.lShF, lEl: st.lEl, lW: st.lW, lShA: st.lShA, rShA: st.rShA }), k);
    }
    case 'airattack': return attackPose({ ...lib, stance: add(TUCK, { rShF: st.rShF, rEl: st.rEl, rW: st.rW, lShF: st.lShF, lEl: st.lEl, lW: st.lW }) }, 'air', f);
    case 'attack': {
      const m = f.move;
      if (m.special) return SPECIALS[id](f, lib);
      if (m.id === 'throw' && id !== 'modou') return attackPose({ ...lib, throwSet: null }, 'heavyGrab', f) ;
      return attackPose(lib, m.id, f);
    }
    case 'dash': {
      if (f.dashDir > 0) { // ruée : buste en avant, grande foulée
        const s = Math.sin(t * 0.75);
        return add(st, { rootY: -0.1, lean: 0.5, lHip: 0.55 + s * 0.6, rHip: -0.35 - s * 0.6, lKnee: 0.7, rKnee: 0.6, rShF: -0.3, lShF: 0.25 });
      }
      const up = Math.sin(clamp01(t / 14) * Math.PI);   // esquive : petit bond en arrière, buste effacé
      return add(st, { rootY: up * 0.1 - 0.05, lean: -0.32, twist: 0.25, head: 0.15, lHip: 0.5 * up, rHip: 0.2 * up, lKnee: 0.5 + 0.6 * up, rKnee: 0.4 + 0.5 * up });
    }
    case 'parried': { // contré : l'arme est repoussée, le corps bascule en arrière
      const k = clamp01(f.stun / 22);
      return mix(st, P({ rootY: -0.05, lean: -0.5, twist: 0.5, head: -0.5, rShF: 2.2, rShA: 0.9, rEl: 0.5, rW: 0.8, lShF: 0.9, lShA: 1.0, lEl: 0.6, lHip: 0.1, lKnee: 0.3, rHip: -0.45, rKnee: 0.35, spread: 0.2 }), 0.3 + 0.7 * k);
    }
    case 'dizzy': { // garde brisée : le combattant titube
      const s = Math.sin(time * 5), c2 = Math.cos(time * 3.3);
      return P({ rootY: -0.12 + c2 * 0.02, lean: 0.28 + s * 0.08, side: s * 0.14, twist: c2 * 0.15, head: 0.45 + c2 * 0.15, rShF: 0.25 + s * 0.1, rShA: 0.25, rEl: 0.5, rW: 1.0, lShF: 0.2 - s * 0.1, lShA: 0.3, lEl: 0.45, lHip: 0.2 + s * 0.1, lKnee: 0.5, rHip: 0.05 - s * 0.1, rKnee: 0.45, spread: 0.2 });
    }
    case 'hitstun': {
      const k = clamp01(f.stun / 10);
      return mix(st, grip(HURT, st), 0.4 + 0.6 * k);
    }
    case 'launched': case 'ko': {
      if (f.y > 0.02 || f.state === 'launched') {
        const k = clamp01(0.5 - f.vy * 3);
        return mix(grip(LAUNCH, st), grip(add(LAUNCH, { fall: -1.3 }), st), k);
      }
      return DOWN(view.build);
    }
    case 'down': return DOWN(view.build);
    case 'getup': {
      const p = clamp01(t / 22);
      return mix(DOWN(view.build), p < 0.6 ? CROUCH : st, p < 0.6 ? easeInOut(p / 0.6) : easeInOut((p - 0.6) / 0.4));
    }
    case 'throwing': {
      const anim = f.throwData?.anim;
      if (!anim) return st;
      const p = clamp01(t / anim.slamAt);
      const lift = P({ rootY: -0.1, lean: -0.35, head: -0.3, rShF: 2.7, rShA: 0.3, rEl: 0.5, lShF: 2.7, lShA: 0.3, lEl: 0.5, lHip: 0.35, lKnee: 0.4, rHip: -0.2, rKnee: 0.3, spread: 0.25 });
      const slam = P({ rootY: -0.35, lean: 0.95, head: 0.2, rShF: 1.0, rShA: 0.5, rEl: 0.2, lShF: 1.0, lShA: 0.5, lEl: 0.2, lHip: 1.0, lKnee: 1.2, rHip: -0.4, rKnee: 0.8, spread: 0.3 });
      const grab = lib.heavy.strike && id === 'modou' ? lib.heavy.strike : lib.guard;
      if (p < 0.25) return mix(grab, lift, easeOut(p / 0.25));
      if (p < 1) return mix(lift, slam, easeInOut((p - 0.25) / 0.75) ** 2);
      return mix(slam, st, easeInOut(clamp01((t - anim.slamAt) / (anim.length - anim.slamAt))));
    }
    case 'thrown': return grip(add(LAUNCH, { fall: -0.4 }), st);
    case 'win': return lib.win(t);
    case 'lose': return add(HURT, { lean: 0.5, head: 0.5 });
    default: return st;
  }
}

// Saisie générique (Themba / Lekishon) : bras tendus vers l'avant
export function patchGrabPoses() {
  for (const id of ['themba', 'lekishon']) {
    const st = POSES[id].stance;
    POSES[id].heavyGrab = {
      wind: add(st, { lean: 0.2, rShF: 0.9, lShF: 0.9, rEl: 0.8, lEl: 0.8 }),
      strike: add(st, { lean: 0.45, rootY: -0.08, rShF: 1.45 - st.rShF, lShF: 1.45 - st.lShF, rEl: 0.3 - st.rEl, lEl: 0.3 - st.lEl, rShA: 0.15 - st.rShA, lShA: 0.15 - st.lShA }),
    };
  }
}
patchGrabPoses();

// Vitesse de lissage (transitions) selon l'état : plus élevée = plus vif
export function smoothingRate(f) {
  switch (f.state) {
    case 'attack': case 'airattack': {
      const ph = f.phase;
      if (f.move?.special) return 22;
      return ph === 'active' ? 40 : ph === 'startup' ? 26 : 13;
    }
    case 'hitstun': return f.t < 3 ? 45 : 14;
    case 'blockstun': return 30;
    case 'launched': case 'ko': return 16;
    case 'down': return 18;
    case 'throwing': case 'thrown': return 22;
    case 'guard': return 22;
    case 'dash': return 24;
    case 'parried': return f.t < 4 ? 40 : 14;
    case 'dizzy': return 9;
    case 'walk': return 16;
    case 'jumpsquat': return 30;
    default: return 11;
  }
}

// Amortissement du ressort d'animation : plus bas = plus de rebond.
export function dampingRatio(f) {
  switch (f.state) {
    case 'attack': case 'airattack': return f.phase === 'recovery' ? 0.72 : 0.9;
    case 'hitstun': case 'blockstun': case 'parried': return 0.55;
    case 'land': case 'idle': return 0.7;
    case 'dizzy': return 0.6;
    case 'thrown': case 'throwing': case 'launched': case 'ko': case 'down': return 0.95;
    default: return 0.82;
  }
}
