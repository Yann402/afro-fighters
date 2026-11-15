"""Atelier commun aux combattants : construit le corps, la tête et les mains, puis fournit
les outils pour poser la tenue. Chaque script de personnage ne décrit que ce qui lui est propre."""
import os, math
import bpy
import numpy as np
from mathutils import Vector
from .forge import *
from . import human
from .human import srgb, Proportions

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class Fighter:
    def __init__(self, name, proportions, skin, skin_dark, lip, hair=None, hair_color=(16, 12, 11), brow_color=(16, 12, 11),
                 head=None, hands=('grip', 'grip'), iris=(60, 34, 18), body_tris=9000, beard=None):
        reset_scene()
        self.name = name
        self.p = p = proportions
        self.SKIN, self.SKIN_DARK, self.LIP = srgb(*skin), srgb(*skin_dark), srgb(*lip)
        self.arm = build_armature(name, human.skeleton(p))
        self.objects = [self.arm]
        self.mats = {}
        skin_mat = self.mat('peau', rough=0.62)
        self.body = human.body(p, tris=body_tris)
        paint(self.body, self.SKIN, cavity=0.5, gradient=(0.0, 1.6, 0.86, 1.04))
        assign(self.body, skin_mat)
        bad = skin_to(self.body, self.arm)
        if bad: raise RuntimeError(f'{bad} sommets du corps sans poids')
        self.objects.append(self.body)
        # tête
        self.head, self.eye_pos = human.head(p, **(head or {}))
        self.hs = self.head['scale']; self.ez = self.head['eye_z']
        self.pivot = Vector((0, 0.005, p.head_z)); self.z0 = p.head_z + 0.1
        ez = self.ez
        rules = [
            (near((0, -0.122, ez - 0.075), (0.04, 0.026, 0.026), soft=0.45), self.LIP),
            (near((0.044, -0.1, ez), (0.034, 0.03, 0.02), soft=0.9), self.SKIN_DARK), (near((-0.044, -0.1, ez), (0.034, 0.03, 0.02), soft=0.9), self.SKIN_DARK),
        ]
        if beard:   # barbe courte : mâchoire et menton
            rules.append((lambda co: np.clip((ez - 0.07 - co[:, 2]) / 0.015, 0, 1) * np.clip((-co[:, 1] + 0.035) / 0.03, 0, 1) * np.clip((co[:, 2] - (ez - 0.2)) / 0.02, 0, 1) * (1 - near((0, -0.122, ez - 0.075), (0.045, 0.03, 0.022), soft=0.3)(co)), srgb(*beard)))
        if hair == 'short':
            rules.append((lambda co: np.clip(((co[:, 2] - (ez + 0.075)) + np.clip(co[:, 1], 0, 1) * 0.9 - np.clip(-co[:, 1] - 0.06, 0, 1) * 0.5) / 0.012, 0, 1), srgb(*hair_color)))
        paint(self.head, self.SKIN, rules=rules, cavity=0.6, cavity_scale=110)
        assign(self.head, skin_mat); attach(self.head, self.arm, 'head'); self.objects.append(self.head)
        lids = human.eyelids(self.eye_pos, self.SKIN_DARK, scale=self.hs); self.rigid(lids, 'head', skin_mat)
        eyes = human.eyes(self.eye_pos, iris=iris); self.rigid(eyes, 'head', self.mat('yeux', rough=0.25))
        c = Clay()
        for s in (1, -1): c.hull([((s * 0.02, -0.122, ez + 0.027), 0.0055), ((s * 0.054, -0.118, ez + 0.036), 0.0065), ((s * 0.074, -0.1, ez + 0.03), 0.004)])
        brows = c.to_object('sourcils'); shade_smooth(brows); paint(brows, srgb(*brow_color), cavity=0); self.rigid(brows, 'head', skin_mat)
        for (s, S), pose in zip(((1, 'L'), (-1, 'R')), hands):
            h = human.hand(p, s, 'hand' + S, pose=pose)
            paint(h, self.SKIN, cavity=0.55, cavity_scale=120); self.rigid(h, 'hand' + S, skin_mat)
        self.skin_surface = Surface(self.body); self.head_surface = Surface(self.head)

    # ── utilitaires
    def mat(self, name, **kw):
        if name not in self.mats: self.mats[name] = material(name, **kw)
        return self.mats[name]

    def H(self, x, y, z):
        """Point de la tête exprimé avant son grossissement."""
        return tuple(self.pivot + (Vector((x, y, z)) - self.pivot) * self.hs)

    def rigid(self, ob, bone, mat=None):
        if mat: assign(ob, mat)
        attach(ob, self.arm, bone); self.objects.append(ob)
        return ob

    def soft(self, ob, mat=None):
        if mat: assign(ob, mat)
        cloth(ob, self.body, self.arm); self.objects.append(ob)
        return ob

    def piece(self, clay, name, voxel, tris, base, rules=(), mat='pelage', bone=None, smooth=3, cavity=0.5, cs=70, gradient=None, soft=False, rough=0.95):
        ob = clay.to_object(name)
        fuse(ob, voxel=voxel, smooth=smooth, smooth_factor=0.5, tris=tris)
        ob.data.validate()
        paint(ob, base, rules=rules, cavity=cavity, cavity_scale=cs, gradient=gradient)
        assign(ob, self.mat(mat, rough=rough) if isinstance(mat, str) else mat)
        if soft: cloth(ob, self.body, self.arm)
        elif bone: attach(ob, self.arm, bone)
        self.objects.append(ob)
        return ob

    def beads(self, points, radius, colors, name, bone):
        ob = beads(points, radius, colors, name)
        return self.rigid(ob, bone, self.mat('perles', rough=0.32))

    def ring_on_skin(self, n, rx, ry, z, cy=0.0, offset=0.008, drop=0.0, surface=None):
        """Points d'un collier ou d'une ceinture, posés sur la peau. drop : descente à l'avant."""
        pts = [(x, y, z - drop * max(0.0, math.cos(a))) for x, y, z, a in ellipse(n, rx, ry, z, cy=cy)]
        return (surface or self.skin_surface).snap_all(pts, offset)

    def limb_ring(self, center, axis, radius, n):
        axis = Vector(axis).normalized()
        u = axis.cross(Vector((0, 1, 0)));  u = u.normalized() if u.length > 1e-4 else Vector((1, 0, 0))
        v = axis.cross(u)
        return [tuple(Vector(center) + (u * math.cos(2 * math.pi * i / n) + v * math.sin(2 * math.pi * i / n)) * radius) for i in range(n)]

    def finish(self, out=None):
        out = out or os.path.join(ROOT, 'assets', 'models', self.name.lower() + '.glb')
        export_glb(out, self.objects)
        tris = sum(tri_count(o) for o in self.objects if o.type == 'MESH')
        print(f'exporté : {out} — {round(os.path.getsize(out) / 1024)} Ko, {tris} triangles, {len(self.objects) - 1} pièces')
        return out
