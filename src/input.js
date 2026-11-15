// Entrées joueur : clavier (positions physiques → fonctionne en AZERTY et QWERTY) + manettes (API Gamepad).
// Mapping manette PS4/PS5 (« standard ») :
//   □ coup léger · △ coup lourd · ○ spécial (R2 aussi) · ✕ saut · L1/R1 garde · Options pause
//   menus : ✕ valider · ○ retour · croix directionnelle / stick gauche naviguer

const KEYMAP = {
  // déplacements : ZQSD (AZERTY) = WASD (QWERTY) via event.code, + flèches
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'guard',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'guard',
  Space: 'up',
  KeyJ: 'light', KeyK: 'heavy', KeyL: 'special',
  KeyU: 'light', KeyI: 'heavy', KeyO: 'special',
  ShiftLeft: 'guard', ShiftRight: 'guard',
};

const ACTIONS = ['left', 'right', 'up', 'down', 'guard', 'light', 'heavy', 'special'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.prevHeld = {};
    this.menuQueue = [];
    this.padIndex = null;
    this.padPrev = {};
    this.onPadChange = null;
    this.lastDevice = 'keyboard';
    this.latch = {};

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.menuKey(e.code)) e.preventDefault(); return; }
      this.lastDevice = 'keyboard';
      this.keys.add(e.code);
      const act = KEYMAP[e.code];
      if (act) this.latch[act] = true;
      const m = this.menuKey(e.code);
      if (m) this.menuQueue.push({ a: m, code: e.code });
      if (KEYMAP[e.code] || m) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.onPadChange?.(true, e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex === e.gamepad.index) this.padIndex = null;
      this.onPadChange?.(false, e.gamepad.id);
    });
  }

  menuKey(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowUp': case 'KeyW': return 'up';
      case 'ArrowDown': case 'KeyS': return 'down';
      case 'Enter': case 'Space': case 'KeyJ': return 'confirm';
      case 'Escape': case 'Backspace': case 'KeyK': return 'back';
      case 'KeyP': return 'pause';
      default: return null;
    }
  }

  getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.padIndex != null && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) if (p && p.connected) { this.padIndex = p.index; return p; }
    return null;
  }

  // À appeler une fois par frame d'affichage : génère les événements de menu depuis la manette
  pollMenu() {
    const pad = this.getPad();
    if (!pad) return;
    const b = (i) => !!pad.buttons[i]?.pressed;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const now = {
      up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6,
      confirm: b(0), back: b(1), pause: b(9),
    };
    for (const k in now) {
      if (now[k] && !this.padPrev[k]) { this.menuQueue.push({ a: k, code: 'pad' }); this.lastDevice = 'pad'; }
    }
    this.padPrev = now;
  }

  takeMenu() { const q = this.menuQueue; this.menuQueue = []; return q; }

  // État de combat du joueur 1 (clavier + manette fusionnés)
  read() {
    const held = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    for (const code of this.keys) { const a = KEYMAP[code]; if (a) held[a] = true; }
    const pad = this.getPad();
    if (pad) {
      const b = (i) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (b(14) || ax < -0.4) held.left = true;
      if (b(15) || ax > 0.4) held.right = true;
      if (b(12) || ay < -0.65 || b(0)) held.up = true;
      if (b(4) || b(5) || b(13) || ay > 0.65) held.guard = true;
      if (b(2)) held.light = true;
      if (b(3)) held.heavy = true;
      if (b(1) || b(7)) held.special = true;
      if (pad.buttons.some((x) => x.pressed) || Math.abs(ax) > 0.4 || Math.abs(ay) > 0.4) this.lastDevice = 'pad';
    }
    const pressed = {};
    for (const a of ['light', 'heavy', 'special', 'up']) pressed[a] = (held[a] && !this.prevHeld[a]) || !!this.latch[a];
    for (const a of ['left', 'right', 'guard']) if (this.latch[a]) held[a] = true;
    this.latch = {};
    this.prevHeld = { ...held };
    return { held, pressed };
  }

  rumble(strength = 0.5, ms = 120) {
    const pad = this.getPad();
    const act = pad?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 1.2) }).catch(() => {});
    }
  }
}
