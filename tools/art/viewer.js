// Visionneuse de modèles GLB, avec l'éclairage et les matériaux du jeu.
// Sert au contrôle visuel des modèles générés (tools/art/capture.py) et à l'inspection manuelle.
// Paramètres d'adresse : ?model=../../assets/models/themba.glb&yaw=30&dist=3.2&h=1.0&style=1
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') || '#3a2a26');
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);

scene.add(new THREE.HemisphereLight('#ffd7a8', '#4a2a2a', 1.15));
const key = new THREE.DirectionalLight('#ffb070', 2.6); key.position.set(-3.5, 5, 4.5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1, near: 0.5, far: 20 });
scene.add(key);
const rim = new THREE.DirectionalLight('#7a8cff', 0.9); rim.position.set(3, 2.5, -4); scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: '#b58a5a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const state = { yaw: +(q.get('yaw') || 25), dist: +(q.get('dist') || 4.2), h: +(q.get('h') || 0.95), pitch: +(q.get('pitch') || 4), root: null, ready: false, error: null, stats: null };
function placeCamera() {
  const a = state.yaw * Math.PI / 180, p = state.pitch * Math.PI / 180;
  camera.position.set(Math.sin(a) * Math.cos(p) * state.dist, state.h + Math.sin(p) * state.dist, Math.cos(a) * Math.cos(p) * state.dist);
  camera.lookAt(0, state.h, 0);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

async function load(url) {
  if (state.root) scene.remove(state.root);
  state.ready = false;
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  let tris = 0, meshes = 0, skinned = 0, bones = 0;
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; meshes++; if (o.isSkinnedMesh) skinned++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    if (o.isBone) bones++;
  });
  if (q.get('style') !== '0') {
    try { const m = await import('../../src/render/stylized.js'); m.applyStylized(root); } catch (e) { /* module absent : matériaux d'origine */ }
  }
  scene.add(root);
  state.root = root; state.gltf = gltf;
  state.stats = { triangles: Math.round(tris), meshes, skinned, bones, animations: gltf.animations.length };
  document.getElementById('info').textContent = `${url.split('/').pop()}\n${state.stats.triangles} triangles · ${meshes} maillages · ${bones} os`;
  state.ready = true;
}

renderer.setAnimationLoop(() => { placeCamera(); if (state.onFrame) state.onFrame(); renderer.render(scene, camera); });
window.__viewer = { state, load, scene, camera, renderer, THREE };
load(q.get('model') || '../../assets/models/themba.glb').catch((e) => { state.error = String(e); document.getElementById('info').textContent = 'Erreur : ' + e; });
