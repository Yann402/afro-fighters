// Instrumentation des performances.
// Affichage : touche F3, ou ?perf=1 dans l'adresse. Lecture par programme : window.__afro.perf.snapshot().
//
// Ce qui est mesuré :
//  - images par seconde et durée des images (moyenne, 95e centile, maximum) sur une fenêtre glissante ;
//  - temps processeur passé dans la simulation et dans l'appel de rendu (le temps du processeur
//    graphique n'est pas mesurable depuis une page web) ;
//  - ressources graphiques vivantes (géométries, textures, programmes), appels de dessin, triangles ;
//  - mémoire JavaScript (Chrome et Edge uniquement : performance.memory n'existe pas dans Firefox) ;
//  - temps de simulation abandonné par la boucle à pas fixe.
const WINDOW = 240;

export class Perf {
  constructor(renderer, loop) {
    this.renderer = renderer;
    this.loop = loop;
    this.frames = new Float32Array(WINDOW);
    this.n = 0; this.i = 0;
    this.simMs = 0; this.renderMs = 0;
    this.heapPeak = 0;
    this.totalFrames = 0;
    this.worstFrame = 0;
    this.visible = false;
    this.el = null;
    this.lastPaint = 0;
    this.info = { calls: 0, triangles: 0 };
  }

  frame(ms) {
    this.frames[this.i] = ms; this.i = (this.i + 1) % WINDOW; this.n = Math.min(WINDOW, this.n + 1);
    this.totalFrames++;
    if (this.totalFrames > 30 && ms > this.worstFrame) this.worstFrame = ms;
    const mem = performance.memory;
    if (mem && mem.usedJSHeapSize > this.heapPeak) this.heapPeak = mem.usedJSHeapSize;
  }

  // lissage exponentiel des temps processeur
  sim(ms) { this.simMs += (ms - this.simMs) * 0.1; }
  render(ms) {
    this.renderMs += (ms - this.renderMs) * 0.1;
    const r = this.renderer.info.render;
    this.info.calls = r.calls; this.info.triangles = r.triangles;
  }

  snapshot() {
    const a = Array.from(this.frames.subarray(0, this.n)).sort((x, y) => x - y);
    const avg = a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
    const mem = performance.memory;
    const info = this.renderer.info;
    return {
      fps: avg ? +(1000 / avg).toFixed(1) : 0,
      frameMs: { avg: +avg.toFixed(2), p95: +(a[Math.floor(a.length * 0.95)] || 0).toFixed(2), max: +(a[a.length - 1] || 0).toFixed(2), worstSinceStart: +this.worstFrame.toFixed(2) },
      cpuMs: { sim: +this.simMs.toFixed(3), render: +this.renderMs.toFixed(3) },
      gpu: { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : 0, drawCalls: this.info.calls, triangles: this.info.triangles },
      heapMB: mem ? { used: +(mem.usedJSHeapSize / 1048576).toFixed(1), peak: +(this.heapPeak / 1048576).toFixed(1) } : null,
      loop: { droppedSec: +this.loop.dropped.toFixed(3), overloads: this.loop.overloads },
      frames: this.totalFrames,
    };
  }

  resetPeaks() { this.heapPeak = 0; this.worstFrame = 0; this.n = 0; this.i = 0; }

  toggle(on = !this.visible) {
    this.visible = on;
    if (on && !this.el) {
      this.el = document.createElement('pre');
      this.el.id = 'perf';
      document.getElementById('app').appendChild(this.el);
    }
    if (this.el) this.el.style.display = on ? 'block' : 'none';
  }

  paint(now) {
    if (!this.visible || now - this.lastPaint < 250) return;
    this.lastPaint = now;
    const s = this.snapshot();
    this.el.textContent =
      `${s.fps} img/s   image ${s.frameMs.avg} ms (95 % < ${s.frameMs.p95} · max ${s.frameMs.max})\n` +
      `processeur  simulation ${s.cpuMs.sim} ms · rendu ${s.cpuMs.render} ms\n` +
      `graphique   ${s.gpu.geometries} géométries · ${s.gpu.textures} textures · ${s.gpu.programs} programmes\n` +
      `            ${s.gpu.drawCalls} appels de dessin · ${s.gpu.triangles} triangles\n` +
      (s.heapMB ? `mémoire JS  ${s.heapMB.used} Mo (pic ${s.heapMB.peak} Mo)\n` : 'mémoire JS  non mesurable dans ce navigateur\n') +
      `boucle      ${s.loop.droppedSec} s abandonnées · ${s.loop.overloads} surcharges`;
  }
}
