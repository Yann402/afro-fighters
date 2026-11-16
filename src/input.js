// Entrées des joueurs : clavier (positions physiques des touches, donc AZERTY et QWERTY) et manettes (API Gamepad).
//
// Trois jeux de commandes reconfigurables :
//   solo : un joueur, deux zones du clavier acceptées (ZQSD ou flèches)
//   p1 / p2 : deux joueurs sur le même clavier (p1 à gauche, p2 à droite)
// Manette (disposition « standard », PS4/PS5) : □ léger · △ moyen · ○ lourd · R1/R2 spécial · L1 garde · L2 ruée · ✕ saut
export const ACTIONS = ['left', 'right', 'up', 'guard', 'light', 'medium', 'heavy', 'special', 'dash'];
export const ACTION_LABELS = { left: 'Gauche', right: 'Droite', up: 'Saut', guard: 'Garde', light: 'Coup léger', medium: 'Coup moyen', heavy: 'Coup lourd', special: 'Pouvoir spécial', dash: 'Ruée / esquive' };

export const DEFAULT_BINDINGS = {
  solo: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp', 'Space'], guard: ['KeyS', 'ArrowDown', 'ShiftLeft'], light: ['KeyJ'], medium: ['KeyK'], heavy: ['KeyL'], special: ['KeyI'], dash: ['KeyO'] },
  p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], guard: ['KeyS'], light: ['KeyF'], medium: ['KeyG'], heavy: ['KeyH'], special: ['KeyT'], dash: ['KeyR'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], guard: ['ArrowDown'], light: ['KeyJ'], medium: ['KeyK'], heavy: ['KeyL'], special: ['KeyI'], dash: ['KeyO'] },
};
const PAD = { light: [2], medium: [3], heavy: [1], special: [5, 7], guard: [4], dash: [6], up: [0, 12], left: [14], right: [15] };
export const PAD_LABELS = { left: '←', right: '→', up: '✕', guard: 'L1', light: '□', medium: '△', heavy: '○', special: 'R1', dash: 'L2' };
const DOUBLE_TAP_MS = 240;
const clone = (o) => JSON.parse(JSON.stringify(o));

export class Input {
  constructor() {
    this.keys = new Set();
    this.bindings = clone(DEFAULT_BINDINGS);
    this.byCode = {};
    this.slots = {};
    for (const s of ['solo', 'p1', 'p2']) this.slots[s] = { prev: {}, latch: {}, lastTap: { left: -1e9, right: -1e9 }, padPrev: {} };
    this.menuQueue = [];
    this.menuPadPrev = {};
    this.capture = null;         // fonction appelée avec la prochaine touche (reconfiguration)
    this.onPadChange = null;
    this.lastDevice = 'keyboard';
    this.layout = null;          // disposition réelle du clavier, si le navigateur la fournit
    this.index();
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { this.layout = m; }).catch(() => {});

    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        if (e.repeat) return;
        const cb = this.capture; this.capture = null; cb(e.code === 'Escape' ? null : e.code);
        return;
      }
      const menu = this.menuKey(e.code);
      if (e.repeat) { if (menu || this.byCode[e.code]) e.preventDefault(); return; }
      this.lastDevice = 'keyboard';
      this.keys.add(e.code);
      const now = performance.now();
      for (const [slot, action] of this.byCode[e.code] || []) {
        const st = this.slots[slot];
        st.latch[action] = true;
        if (action === 'left' || action === 'right') {
          // double appui sur une direction : ruée (vers l'avant) ou esquive (vers l'arrière)
          if (now - st.lastTap[action] < DOUBLE_TAP_MS) { st.latch.dash = true; st.lastTap[action] = -1e9; } else st.lastTap[action] = now;
        }
      }
      if (menu) this.menuQueue.push({ a: menu, code: e.code });
      if (menu || this.byCode[e.code]) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => this.onPadChange?.(true, e.gamepad.id));
    window.addEventListener('gamepaddisconnected', (e) => this.onPadChange?.(false, e.gamepad.id));
  }

  index() {
    this.byCode = {};
    for (const slot of Object.keys(this.bindings)) for (const action of ACTIONS) for (const code of this.bindings[slot][action] || []) (this.byCode[code] ||= []).push([slot, action]);
  }

  // Applique des commandes personnalisées (issues de la sauvegarde). Les entrées invalides sont ignorées.
  setBindings(custom) {
    this.bindings = clone(DEFAULT_BINDINGS);
    if (custom && typeof custom === 'object') {
      for (const slot of Object.keys(this.bindings)) for (const action of ACTIONS) {
        const v = custom[slot] && custom[slot][action];
        if (Array.isArray(v) && v.length && v.every((c) => typeof c === 'string')) this.bindings[slot][action] = v.slice(0, 3);
      }
    }
    this.index();
  }

  // Attribue une touche à une action ; la retire des autres actions du même jeu de commandes.
  rebind(slot, action, code) {
    for (const a of ACTIONS) this.bindings[slot][a] = this.bindings[slot][a].filter((c) => c !== code);
    this.bindings[slot][action] = [code];
    this.index();
    return clone(this.bindings);
  }

  // Nom lisible d'une touche, selon la disposition réelle du clavier quand elle est connue.
  keyLabel(code) {
    const special = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj droite', Enter: 'Entrée', ControlLeft: 'Ctrl', AltLeft: 'Alt' };
    if (special[code]) return special[code];
    if (this.layout && this.layout.get(code)) return this.layout.get(code).toUpperCase();
    return code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Pavé ');
  }
  label(slot, action) {
    if (this.lastDevice === 'pad' && slot !== 'p1' && slot !== 'p2') return PAD_LABELS[action];
    return (this.bindings[slot][action] || []).slice(0, 2).map((c) => this.keyLabel(c)).join(' / ') || '—';
  }

  menuKey(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowUp': case 'KeyW': return 'up';
      case 'ArrowDown': case 'KeyS': return 'down';
      case 'Enter': case 'Space': return 'confirm';
      case 'Escape': case 'Backspace': return 'back';
      case 'KeyP': return 'pause';
      default: return null;
    }
  }

  pads() { return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((p) => p && p.connected); }
  padFor(slot) { const p = this.pads(); return slot === 'p2' ? p[1] || null : p[0] || null; }

  // Une fois par image : événements de menu venant de n'importe quelle manette.
  pollMenu() {
    const now = { up: false, down: false, left: false, right: false, confirm: false, back: false, pause: false };
    for (const pad of this.pads()) {
      const b = (i) => !!pad.buttons[i]?.pressed; const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      now.up ||= b(12) || ay < -0.6; now.down ||= b(13) || ay > 0.6; now.left ||= b(14) || ax < -0.6; now.right ||= b(15) || ax > 0.6;
      now.confirm ||= b(0); now.back ||= b(1); now.pause ||= b(9);
    }
    for (const k in now) if (now[k] && !this.menuPadPrev[k]) { this.menuQueue.push({ a: k, code: 'pad' }); this.lastDevice = 'pad'; }
    this.menuPadPrev = now;
  }
  takeMenu() { const q = this.menuQueue; this.menuQueue = []; return q; }

  // État de combat d'un jeu de commandes : { held, pressed }. À appeler une fois par pas de simulation.
  read(slot) {
    const st = this.slots[slot], bind = this.bindings[slot];
    const held = {};
    for (const a of ACTIONS) held[a] = (bind[a] || []).some((c) => this.keys.has(c));
    const pad = this.padFor(slot);
    if (pad) {
      const b = (i) => !!pad.buttons[i]?.pressed; const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      for (const a of ACTIONS) if (PAD[a].some(b)) held[a] = true;
      if (ax < -0.4) held.left = true; if (ax > 0.4) held.right = true; if (ay < -0.65) held.up = true; if (ay > 0.65 || b(13)) held.guard = true;
      if (pad.buttons.some((x) => x.pressed) || Math.abs(ax) > 0.4 || Math.abs(ay) > 0.4) this.lastDevice = 'pad';
    }
    const pressed = {};
    for (const a of ['light', 'medium', 'heavy', 'special', 'up', 'dash']) pressed[a] = (held[a] && !st.prev[a]) || !!st.latch[a];
    for (const a of ['left', 'right', 'guard']) if (st.latch[a]) held[a] = true;     // appui bref entre deux pas : non perdu
    st.latch = {}; st.prev = { ...held };
    return { held, pressed };
  }

  clearLatches() { for (const s of Object.values(this.slots)) { s.latch = {}; s.prev = {}; } }

  rumble(slot, strength = 0.5, ms = 120) {
    const act = this.padFor(slot)?.vibrationActuator;
    if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 1.2) }).catch(() => {});
  }
}
