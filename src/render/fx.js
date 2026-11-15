import * as THREE from 'three';
import { softDotTex } from './textures.js';

// Système d'effets : particules (étincelles, poussière, aura), ondes de choc, images rémanentes.
const MAX = 1400;

// Une image rémanente d'un modèle à squelette possède sa propre copie des os (et leur texture).
function freeSkeletons(obj) { obj.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose(); }); }

export class FX {
  constructor(scene) {
    this.scene = scene;
    const tex = softDotTex();
    this.tex = tex;
    // une seule géométrie d'anneau, partagée par toutes les ondes de choc
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    const mkMat = (blending) => new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 420 }, premul: { value: blending === THREE.AdditiveBlending ? 1 : 0 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float scale;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor;
        uniform float premul;
        void main(){ vec4 t=texture2D(map,gl_PointCoord); if(t.a<0.02) discard;
          if (premul > 0.5) { gl_FragColor=vec4(vColor*t.a, t.a); }
          else { float a = t.a * clamp(max(vColor.r, max(vColor.g, vColor.b)) * 1.3, 0.0, 1.0) * 0.55; gl_FragColor=vec4(normalize(vColor + 0.0001) * 1.25, a); } }`,
      transparent: true, depthWrite: false, blending,
    });
    // deux couches : additive (lumière) et normale (poussière)
    this.glowLayer = this.makeLayer(mkMat(THREE.AdditiveBlending));
    this.dustLayer = this.makeLayer(mkMat(THREE.NormalBlending));
    this.rings = [];
    this.ghosts = [];
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ghostMatBlue = new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  makeLayer(material) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(geo, material);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    this.scene.add(pts);
    return { pts, geo, pos, col, size, list: [] };
  }

  spawn(layer, n, o) {
    const L = layer === 'dust' ? this.dustLayer : this.glowLayer;
    for (let i = 0; i < n && L.list.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const dir = o.dir ?? null;
      let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, vz = (Math.random() - 0.5) * sp * 0.8;
      if (dir) { vx = dir[0] * sp + (Math.random() - 0.5) * (o.spread ?? 1); vy = dir[1] * sp + (Math.random() - 0.5) * (o.spread ?? 1); vz = (Math.random() - 0.5) * (o.spread ?? 1); }
      if (o.up) vy = Math.abs(vy) * o.up;
      const c = o.colors[Math.floor(Math.random() * o.colors.length)];
      L.list.push({
        x: o.x + (Math.random() - 0.5) * (o.jitter ?? 0.1), y: o.y + (Math.random() - 0.5) * (o.jitter ?? 0.1), z: (o.z ?? 0.3) + (Math.random() - 0.5) * (o.jitterZ ?? 0.2),
        vx, vy, vz, life: (o.life ?? 0.4) * (0.6 + Math.random() * 0.6), age: 0,
        size: (o.size ?? 0.15) * (0.6 + Math.random() * 0.8), grow: o.grow ?? 0,
        r: c[0], g: c[1], b: c[2], grav: o.grav ?? 0, drag: o.drag ?? 2.5,
      });
    }
  }

  ring(x, y, color, max = 2.5, life = 0.45, ground = true) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    if (ground) { mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.03, 0); }
    else mesh.position.set(x, y, 0.4);
    this.scene.add(mesh);
    this.rings.push({ mesh, age: 0, life, max });
  }

  // Image rémanente : copie figée du combattant qui s'estompe
  afterimage(view, blue = false, offset = null, life = 0.3, opacity = null) {
    const clone = view.snapshot();
    const mat = (blue ? this.ghostMatBlue : this.ghostMat).clone();
    if (opacity != null) mat.opacity = opacity;
    clone.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
    if (offset) clone.position.add(offset);
    this.scene.add(clone);
    this.ghosts.push({ obj: clone, mat, age: 0, life, base: mat.opacity });
  }

  // ─── Effets prêts à l'emploi
  hit(x, y, heavy, special) {
    const n = heavy ? 40 : 22;
    this.spawn('glow', n, { x, y, speed: heavy ? 7 : 5, life: 0.28, size: heavy ? 0.22 : 0.16, colors: [[1, 0.95, 0.7], [1, 0.7, 0.25], [1, 0.45, 0.15]], drag: 6 });
    this.spawn('glow', 1, { x, y, speed: 0, life: 0.12, size: heavy ? 1.6 : 1.0, colors: [[1, 0.9, 0.7]] });
    this.ring(x, y, special ? '#ffcf5a' : '#fff1c8', heavy ? 1.6 : 1.0, 0.22, false);
  }

  block(x, y, shield) {
    this.spawn('glow', 18, { x, y, speed: 4.5, life: 0.22, size: 0.13, colors: shield ? [[1, 0.95, 0.85], [0.95, 0.8, 0.55]] : [[0.6, 0.85, 1], [0.9, 0.97, 1]], drag: 7 });
    this.ring(x, y, shield ? '#ffe6b0' : '#9fd6ff', 0.8, 0.18, false);
  }

  dust(x, amount = 12, power = 1.5) {
    this.spawn('dust', amount, { x, y: 0.08, z: 0, speed: power, up: 0.6, life: 0.7, size: 0.35, grow: 1.5, colors: [[0.78, 0.6, 0.4], [0.68, 0.5, 0.32], [0.85, 0.7, 0.5]], drag: 3, jitter: 0.4, jitterZ: 0.6 });
  }

  slam(x, big) {
    this.dust(x, big ? 60 : 30, big ? 4 : 2.6);
    this.ring(x, 0, big ? '#ffcf6a' : '#f0d7a0', big ? 4.5 : 2.4, big ? 0.6 : 0.4);
    if (big) {
      this.ring(x, 0, '#ff8a3c', 3.2, 0.5);
      this.spawn('glow', 40, { x, y: 0.2, speed: 6, up: 1, life: 0.6, size: 0.18, colors: [[1, 0.8, 0.3], [1, 0.55, 0.2]], grav: 9, drag: 1.5 });
    }
  }

  aura(x, y, colors, n = 3) {
    this.spawn('glow', n, { x, y, dir: [0, 1], speed: 2.2, spread: 0.6, life: 0.6, size: 0.12, colors, jitter: 0.8, jitterZ: 0.5, drag: 0.5 });
  }

  update(dt) {
    for (const L of [this.glowLayer, this.dustLayer]) {
      let w = 0;
      for (let i = 0; i < L.list.length; i++) {
        const p = L.list[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
        const k = 1 - p.age / p.life;
        L.pos[w * 3] = p.x; L.pos[w * 3 + 1] = p.y; L.pos[w * 3 + 2] = p.z;
        L.col[w * 3] = p.r * k; L.col[w * 3 + 1] = p.g * k; L.col[w * 3 + 2] = p.b * k;
        L.size[w] = p.size * (1 + p.grow * (1 - k));
        L.list[w++] = p;
      }
      L.list.length = w;
      L.geo.setDrawRange(0, w);
      L.geo.attributes.position.needsUpdate = true;
      L.geo.attributes.color.needsUpdate = true;
      L.geo.attributes.size.needsUpdate = true;
    }
    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const p = r.age / r.life;
      if (p >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); return false; }
      const s = 0.2 + (r.max) * (1 - (1 - p) * (1 - p));
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.85 * (1 - p);
      return true;
    });
    this.ghosts = this.ghosts.filter((g) => {
      g.age += dt;
      const p = g.age / g.life;
      if (p >= 1) { this.scene.remove(g.obj); g.mat.dispose(); freeSkeletons(g.obj); return false; }
      g.mat.opacity = g.base * (1 - p);
      return true;
    });
  }

  // Retire tous les effets en cours et libère ce qu'ils possèdent : un matériau par anneau et par
  // image rémanente. La géométrie d'anneau est partagée ; celles des images rémanentes
  // appartiennent au combattant copié. Aucune des deux n'est libérée ici.
  clear() {
    for (const L of [this.glowLayer, this.dustLayer]) { L.list.length = 0; L.geo.setDrawRange(0, 0); }
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.material.dispose(); }
    for (const g of this.ghosts) { this.scene.remove(g.obj); g.mat.dispose(); freeSkeletons(g.obj); }
    this.rings = []; this.ghosts = [];
  }

  // Libération complète (fermeture du jeu ou rechargement du moteur).
  dispose() {
    this.clear();
    for (const L of [this.glowLayer, this.dustLayer]) { this.scene.remove(L.pts); L.geo.dispose(); L.pts.material.dispose(); }
    this.ringGeo.dispose(); this.tex.dispose();
    this.ghostMat.dispose(); this.ghostMatBlue.dispose();
  }
}
