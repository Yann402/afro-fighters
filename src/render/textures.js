import * as THREE from 'three';

// Textures procédurales (canvas) : aucun fichier image externe nécessaire.
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Shuka maasaï : grand tissu rouge à carreaux
export const shukaTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b3121b'; g.fillRect(0, 0, w, h);
  const bands = [[0, 18, '#5b0a10'], [40, 6, '#1d2a6b'], [70, 26, '#7a0c13'], [120, 6, '#e9a227'], [150, 18, '#5b0a10'], [200, 8, '#1d2a6b']];
  g.globalAlpha = 0.75;
  for (const [p, s, col] of bands) { g.fillStyle = col; g.fillRect(p, 0, s, h); g.fillRect(0, p, w, s); }
  g.globalAlpha = 0.08; g.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}, [2, 2]);

// Ngemb (pagne de lutte) : indigo et blanc
export const ngembTex = () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f2f6b';
  for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
  g.fillStyle = '#c0392b';
  for (let x = 6; x < w; x += 64) g.fillRect(x, 0, 3, h);
  g.globalAlpha = 0.12; g.fillStyle = '#000';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
}, [2, 1]);

// Peau de vache du bouclier isihlangu
export const cowhideTex = () => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#f2ece0'; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i % 3 === 0 ? '#6b3a1e' : '#1b1512';
    g.beginPath();
    const cx = r() * w, cy = r() * h, rad = 30 + r() * 60;
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const rr = rad * (0.6 + r() * 0.5);
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.3);
    }
    g.fill();
  }
  // laçage central caractéristique
  g.fillStyle = '#2a1a10'; g.fillRect(w / 2 - 10, 20, 20, h - 40);
  g.fillStyle = '#f2ece0';
  for (let y = 30; y < h - 30; y += 34) { g.fillRect(w / 2 - 14, y, 28, 12); }
});

// Fourrure de léopard (bandeau umqhele)
export const leopardTex = () => canvasTex(128, 64, (g, w, h) => {
  g.fillStyle = '#c99436'; g.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h;
    g.strokeStyle = '#2a1708'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, 3 + r() * 3, 0, Math.PI * 1.6); g.stroke();
  }
}, [3, 1]);

// Sable de l'arène
export const sandTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? 'rgba(120,80,40,0.18)' : 'rgba(255,230,190,0.16)';
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(110,70,35,0.10)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    g.beginPath(); const y = r() * h; g.moveTo(0, y);
    for (let x = 0; x < w; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
    g.stroke();
  }
}, [6, 6]);

// Motifs géométriques pour les murets et bannières
export const patternTex = (base = '#7a3b1d', a = '#e8c27a', b = '#1b1b1b') => canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = a;
  for (let x = 0; x < w; x += 32) {
    g.beginPath(); g.moveTo(x, h * 0.8); g.lineTo(x + 16, h * 0.2); g.lineTo(x + 32, h * 0.8); g.closePath(); g.fill();
  }
  g.fillStyle = b;
  for (let x = 0; x < w; x += 32) { g.fillRect(x + 13, h * 0.45, 6, 10); }
  g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
}, [8, 1]);

// Dégradé du ciel au crépuscule
export const skyTex = () => canvasTex(16, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0.0, '#1a1236');
  gr.addColorStop(0.35, '#57305a');
  gr.addColorStop(0.55, '#c4553a');
  gr.addColorStop(0.68, '#f1a54a');
  gr.addColorStop(0.75, '#f6c873');
  gr.addColorStop(1.0, '#3a2414');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// Sprite doux (particules)
export const softDotTex = () => canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
