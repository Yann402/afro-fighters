// Progression du joueur et réglages : sauvegarde locale automatique, versionnée et tolérante aux pannes.
//
// Architecture prévue pour une future sauvegarde en ligne : Progress ne connaît qu'un « stockage »
// offrant getItem / setItem / removeItem. Aujourd'hui c'est localStorage ; demain, un stockage distant
// (compte joueur) pourra s'y substituer ou s'y ajouter sans toucher au reste du jeu.
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'afrofighters.save';
export const BACKUP_KEY = 'afrofighters.save.bak';

export const OUTFITS = {
  modou: [{ id: 'classique', name: 'Classique', tint: '#ffffff' }, { id: 'or', name: 'Or du Cayor', tint: '#ffd27a' }, { id: 'nuit', name: 'Nuit de Dakar', tint: '#8ea2e0' }],
  themba: [{ id: 'classique', name: 'Classique', tint: '#ffffff' }, { id: 'braise', name: 'Braise', tint: '#ff9d7c' }, { id: 'ombre', name: 'Ombre du Veld', tint: '#9c9c9c' }],
  lekishon: [{ id: 'classique', name: 'Classique', tint: '#ffffff' }, { id: 'savane', name: 'Savane', tint: '#ffcf6e' }, { id: 'indigo', name: 'Indigo', tint: '#8f93ff' }],
};
export const ARENAS = [{ id: 'crepuscule', name: 'Crépuscule' }, { id: 'nuit', name: 'Nuit aux torches' }, { id: 'aube', name: 'Aube' }];

// Récompenses par niveau. Purement visuelles : aucune ne modifie le combat.
export const UNLOCKS = [
  { level: 2, type: 'outfit', char: 'modou', id: 'or' },
  { level: 3, type: 'outfit', char: 'themba', id: 'braise' },
  { level: 4, type: 'outfit', char: 'lekishon', id: 'savane' },
  { level: 5, type: 'arena', id: 'nuit' },
  { level: 6, type: 'outfit', char: 'modou', id: 'nuit' },
  { level: 7, type: 'outfit', char: 'themba', id: 'ombre' },
  { level: 8, type: 'outfit', char: 'lekishon', id: 'indigo' },
  { level: 9, type: 'arena', id: 'aube' },
];
export const MAX_LEVEL = 20;
export const xpForLevel = (level) => 150 * (level - 1) * level / 2;          // expérience totale requise pour atteindre un niveau
export function levelForXp(xp) { let l = 1; while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++; return l; }
const XP = { win: { facile: 60, normal: 100, difficile: 160 }, loss: 25, perfect: 40, streak: 10 };
const CHARS = ['modou', 'themba', 'lekishon'];

export function unlockLabel(u) {
  if (u.type === 'arena') return `Ambiance d'arène : ${ARENAS.find((a) => a.id === u.id).name}`;
  const name = { modou: 'Modou', themba: 'Themba', lekishon: 'Lekishon' }[u.char];
  return `Tenue de ${name} : ${OUTFITS[u.char].find((o) => o.id === u.id).name}`;
}

export function defaultSave() {
  const byChar = {}; const outfits = {}; const selOutfits = {};
  for (const c of CHARS) { byChar[c] = { matches: 0, wins: 0, losses: 0 }; outfits[c] = ['classique']; selOutfits[c] = 'classique'; }
  return {
    version: SAVE_VERSION,
    profile: { xp: 0, level: 1 },
    stats: { matches: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, perfects: 0, fastestWinSec: null, byChar, byDifficulty: { facile: { wins: 0, losses: 0 }, normal: { wins: 0, losses: 0 }, difficile: { wins: 0, losses: 0 } }, versusMatches: 0, trainingSessions: 0 },
    unlocked: { outfits, arenas: ['crepuscule'] },
    selected: { outfits: selOutfits, arena: 'crepuscule', char: 'modou', difficulty: 'normal' },
    settings: { muted: false, quality: 'auto', bindings: null },
  };
}

// Mises à niveau successives d'anciennes sauvegardes. Chaque étape fait passer d'une version à la suivante.
const MIGRATIONS = {
  // v1 (prototype) : { version: 1, wins, losses, xp } -> v2
  1: (old) => {
    const s = defaultSave();
    s.profile.xp = Math.max(0, Number(old.xp) || 0);
    s.stats.wins = Math.max(0, Number(old.wins) || 0);
    s.stats.losses = Math.max(0, Number(old.losses) || 0);
    s.stats.matches = s.stats.wins + s.stats.losses;
    return s;
  },
};

// Répare une sauvegarde : complète les champs manquants, écarte les valeurs invalides, recalcule ce qui se déduit.
function sanitize(input) {
  const base = defaultSave();
  const merge = (def, val) => {
    if (Array.isArray(def)) return Array.isArray(val) ? val.filter((x) => typeof x === 'string') : def;
    if (def !== null && typeof def === 'object') {
      const out = {};
      for (const k of Object.keys(def)) out[k] = merge(def[k], val && typeof val === 'object' ? val[k] : undefined);
      return out;
    }
    if (val === undefined || val === null) return def;
    if (typeof def === 'number') return Number.isFinite(val) && val >= 0 ? val : def;
    if (def === null) return val;                      // champ libre (ex. fastestWinSec, bindings)
    return typeof val === typeof def ? val : def;
  };
  const s = merge(base, input);
  s.settings.bindings = input && input.settings && typeof input.settings.bindings === 'object' ? input.settings.bindings : null;
  s.stats.fastestWinSec = input && input.stats && Number.isFinite(input.stats.fastestWinSec) ? input.stats.fastestWinSec : null;
  s.version = SAVE_VERSION;
  s.profile.level = levelForXp(s.profile.xp);
  // les déblocages se déduisent du niveau : une sauvegarde modifiée à la main ne peut pas en inventer
  for (const c of CHARS) s.unlocked.outfits[c] = ['classique'];
  s.unlocked.arenas = ['crepuscule'];
  for (const u of UNLOCKS) if (u.level <= s.profile.level) grant(s, u);
  for (const c of CHARS) if (!s.unlocked.outfits[c].includes(s.selected.outfits[c])) s.selected.outfits[c] = 'classique';
  if (!s.unlocked.arenas.includes(s.selected.arena)) s.selected.arena = 'crepuscule';
  if (!CHARS.includes(s.selected.char)) s.selected.char = 'modou';
  if (!['facile', 'normal', 'difficile'].includes(s.selected.difficulty)) s.selected.difficulty = 'normal';
  if (!['auto', 'high', 'medium', 'low'].includes(s.settings.quality)) s.settings.quality = 'auto';
  return s;
}

function grant(s, u) {
  if (u.type === 'arena') { if (!s.unlocked.arenas.includes(u.id)) s.unlocked.arenas.push(u.id); } else if (!s.unlocked.outfits[u.char].includes(u.id)) s.unlocked.outfits[u.char].push(u.id);
}

export function parseSave(text) {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.version)) throw new Error('format inconnu');
  if (raw.version > SAVE_VERSION) throw new Error('sauvegarde issue d\'une version plus récente du jeu');
  let data = raw;
  for (let v = raw.version; v < SAVE_VERSION; v++) {
    if (!MIGRATIONS[v]) throw new Error(`pas de mise à niveau depuis la version ${v}`);
    data = MIGRATIONS[v](data);
  }
  return sanitize(data);
}

export class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

export class Progress {
  constructor(storage) {
    this.storage = storage;
    this.status = 'new';       // new | loaded | migrated | recovered (copie de secours) | reset (illisible)
    this.data = defaultSave();
    this.load();
  }

  load() {
    const read = (key) => { try { return this.storage.getItem(key); } catch { return null; } };
    const main = read(SAVE_KEY);
    if (main === null) { this.status = read(BACKUP_KEY) ? this.tryBackup() : 'new'; return this.status; }
    try {
      const version = JSON.parse(main).version;
      this.data = parseSave(main);
      this.status = version < SAVE_VERSION ? 'migrated' : 'loaded';
      if (this.status === 'migrated') this.save();
    } catch {
      this.status = this.tryBackup();
    }
    return this.status;
  }

  tryBackup() {
    try {
      const bak = this.storage.getItem(BACKUP_KEY);
      if (bak !== null) { this.data = parseSave(bak); this.save(); return 'recovered'; }
    } catch { /* copie de secours illisible elle aussi */ }
    this.data = defaultSave();
    return 'reset';
  }

  // Écrit la sauvegarde, puis la copie de secours. Retourne false si le stockage refuse (navigation privée, quota).
  save() {
    try {
      const text = JSON.stringify(this.data);
      const previous = this.storage.getItem(SAVE_KEY);
      if (previous !== null) { try { parseSave(previous); this.storage.setItem(BACKUP_KEY, previous); } catch { /* ne pas écraser une bonne copie par une mauvaise */ } }
      this.storage.setItem(SAVE_KEY, text);
      return true;
    } catch { return false; }
  }

  // Enregistre un match contre l'ordinateur. Retourne ce qu'il rapporte.
  recordMatch({ char, difficulty, result, perfect = false, seconds = null }) {
    const d = this.data, st = d.stats;
    const before = d.profile.level;
    let xp = 0;
    st.matches++; st.byChar[char].matches++;
    if (result === 'win') {
      st.wins++; st.byChar[char].wins++; st.byDifficulty[difficulty].wins++;
      st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
      xp = XP.win[difficulty] + Math.min(5, st.streak - 1) * XP.streak;
      if (perfect) { st.perfects++; xp += XP.perfect; }
      if (seconds !== null && (st.fastestWinSec === null || seconds < st.fastestWinSec)) st.fastestWinSec = Math.round(seconds);
    } else if (result === 'loss') {
      st.losses++; st.byChar[char].losses++; st.byDifficulty[difficulty].losses++; st.streak = 0; xp = XP.loss;
    } else { st.draws++; st.streak = 0; xp = XP.loss; }
    d.profile.xp += xp;
    d.profile.level = levelForXp(d.profile.xp);
    const unlocks = UNLOCKS.filter((u) => u.level > before && u.level <= d.profile.level);
    for (const u of unlocks) grant(d, u);
    this.save();
    return { xp, levelBefore: before, level: d.profile.level, unlocks };
  }

  recordVersus() { this.data.stats.versusMatches++; this.save(); }
  recordTraining() { this.data.stats.trainingSessions++; this.save(); }

  get level() { return this.data.profile.level; }
  // progression dans le niveau en cours, de 0 à 1
  get levelProgress() {
    const l = this.level; if (l >= MAX_LEVEL) return 1;
    return (this.data.profile.xp - xpForLevel(l)) / (xpForLevel(l + 1) - xpForLevel(l));
  }
  outfit(char) { return OUTFITS[char].find((o) => o.id === this.data.selected.outfits[char]) || OUTFITS[char][0]; }

  export() { return JSON.stringify(this.data, null, 1); }
  import(text) { this.data = parseSave(text); this.save(); return this.data; }
  reset() { this.data = defaultSave(); try { this.storage.removeItem(BACKUP_KEY); } catch { /* sans importance */ } this.save(); }
}
