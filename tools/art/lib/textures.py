"""Textures peintes par le calcul (aucune image externe)."""
import numpy as np


def _grain(h, w, amount=0.035, seed=0):
    r = np.random.default_rng(seed)
    return (r.random((h, w, 1)).astype(np.float32) - 0.5) * amount


def cowhide(w=256, h=512):
    """Robe de vache : fond crème, plaques brunes et noires, lacets centraux, bord assombri."""
    v, u = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))
    x, z = v * 2.1, u * 4.2
    n1 = np.sin(x * 1.3 + np.sin(z * 0.9) * 1.6) + np.sin(z * 1.1 + 1.7 + np.sin(x * 0.7) * 1.3) + 0.6 * np.sin((x + z) * 2.3)
    n2 = np.sin(x * 1.1 + 4.0 + np.sin(z * 0.7 + 1.0) * 1.4) + np.sin(z * 0.9 + 0.4 + np.sin(x * 0.9) * 1.2)
    img = np.empty((h, w, 3), dtype=np.float32); img[:] = (0.93, 0.89, 0.8)
    img += _grain(h, w)
    def blend(mask, col):
        m = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - m) + np.array(col, dtype=np.float32) * m
    blend((n1 - 0.55) / 0.12, (0.42, 0.22, 0.11))
    blend((n2 - 1.25) / 0.1, (0.1, 0.075, 0.065))
    lace = (np.abs(np.abs(v) - 0.11) < 0.045) & (np.abs(((u + 1) * 5.5) % 1.0 - 0.5) < 0.3) & (np.abs(u) < 0.78)
    blend(lace.astype(np.float32), (0.12, 0.08, 0.06))
    blend((np.abs(v) - 0.9) / 0.1 * 0.7, (0.3, 0.17, 0.09))
    return np.clip(img, 0, 1)


def stripes(w=256, h=256, base=(0.93, 0.9, 0.82), band=(0.1, 0.16, 0.42), line=(0.7, 0.14, 0.1), n=8):
    """Tissu rayé (pagne de lutte) : larges bandes indigo, fin liseré rouge, trame visible."""
    v, u = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
    img = np.empty((h, w, 3), dtype=np.float32); img[:] = base
    ph = (v * n) % 1.0
    img[ph < 0.42] = band
    img[(ph > 0.66) & (ph < 0.74)] = line
    weave = 0.04 * np.sin(u * h * 1.3)[..., None] * np.sin(v * w * 1.3)[..., None]
    return np.clip(img + weave + _grain(h, w, 0.03, 2), 0, 1)


def shuka(w=256, h=256, n=5):
    """Shuka : rouge profond à carreaux, bandes sombres, filets bleus et dorés."""
    v, u = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
    img = np.empty((h, w, 3), dtype=np.float32); img[:] = (0.7, 0.07, 0.09)
    for axis in (u, v):
        ph = (axis * n) % 1.0
        for lo, hi, col, a in ((0.0, 0.16, (0.3, 0.03, 0.05), 0.7), (0.3, 0.335, (0.1, 0.14, 0.4), 0.85), (0.62, 0.74, (0.42, 0.04, 0.06), 0.6), (0.86, 0.885, (0.9, 0.62, 0.15), 0.8)):
            m = ((ph >= lo) & (ph < hi))[..., None].astype(np.float32) * a
            img[:] = img * (1 - m) + np.array(col, dtype=np.float32) * m
    weave = 0.035 * np.sin(u * h * 1.2)[..., None] * np.sin(v * w * 1.2)[..., None]
    return np.clip(img + weave + _grain(h, w, 0.03, 5), 0, 1)
