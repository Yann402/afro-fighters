// Qualité graphique : trois niveaux, et un mode automatique qui descend d'un cran quand la machine peine.
// Le mode automatique ne remonte jamais de lui-même pendant une session (évite les allers-retours visibles).
import { setOutlines } from './render/stylized.js';

export const LEVELS = {
  high: { label: 'Haute', pixelRatio: 2, shadows: 2048, outlines: true },
  medium: { label: 'Moyenne', pixelRatio: 1.25, shadows: 1024, outlines: true },
  low: { label: 'Basse', pixelRatio: 1, shadows: 0, outlines: false },
};
const ORDER = ['high', 'medium', 'low'];
const WINDOW = 90;           // images par fenêtre de mesure
const SLOW_MS = 24;          // au-delà (moins de ~42 images/s en moyenne), la fenêtre est « lente »

export class Quality {
  constructor(renderer, keyLight, onChange = null) {
    this.renderer = renderer; this.key = keyLight; this.onChange = onChange;
    this.mode = 'auto'; this.level = 'high';
    this.sum = 0; this.n = 0; this.slowWindows = 0; this.downgrades = 0;
    this.apply('high');
  }

  setMode(mode) {
    this.mode = mode; this.slowWindows = 0; this.sum = 0; this.n = 0;
    this.apply(mode === 'auto' ? 'high' : mode);
  }

  apply(level) {
    const L = LEVELS[level]; this.level = level;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = L.shadows > 0;
    this.key.castShadow = L.shadows > 0;
    if (L.shadows > 0 && this.key.shadow.mapSize.x !== L.shadows) {
      this.key.shadow.mapSize.set(L.shadows, L.shadows);
      if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    }
    setOutlines(L.outlines);
    this.onChange?.(level);
  }

  // À appeler à chaque image pendant un combat, avec la durée de l'image en millisecondes.
  frame(ms) {
    if (this.mode !== 'auto' || this.level === 'low') return;
    if (ms > 250) return;                       // retour d'un onglet en arrière-plan : pas une mesure
    this.sum += ms; this.n++;
    if (this.n < WINDOW) return;
    const avg = this.sum / this.n; this.sum = 0; this.n = 0;
    this.slowWindows = avg > SLOW_MS ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2) {
      this.slowWindows = 0; this.downgrades++;
      this.apply(ORDER[ORDER.indexOf(this.level) + 1]);
    }
  }

  get label() { return this.mode === 'auto' ? `Automatique (${LEVELS[this.level].label.toLowerCase()})` : LEVELS[this.level].label; }
}
