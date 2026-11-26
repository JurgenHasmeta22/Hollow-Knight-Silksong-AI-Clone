"""Imports the Faceless Ronin's two pose sheets into assets/img/sprites/ronin.webp.

Usage: python tools/import_ronin_art.py [--preview out.png]
Reads tools/art/ronin_normal.jpg (sheet A, the sword-and-cloak moveset) and tools/art/ronin_transform.jpg (sheet B,
the transformation moveset, with a caption under some rows).
Needs: pip install pillow numpy

The sheets are dark-grey JPEGs (no alpha), so this script
  * finds the flat grey background (about rgb 34,34,34) and floods it out, keeping the figure's own dark cloth
    (enclosed pockets of bright or textured pixels stay opaque; big flat grey pockets between limbs go transparent),
  * softens the edge with an alpha ramp and un-mixes the grey from the edge colour so no grey halo is left,
  * assigns every connected piece to the pose rectangle that holds its centre (this drops the captions, and the
    neighbouring pose's trailing cloak), then crops each pose,
  * scales every pose by PACK and shelf-packs them into one transparent webp atlas,
  * merges `atlas_ronin` and one `ronin_<pose>` sprite per pose into assets/manifest.js.

Sprite frame = [x, y, w, h, anchorX, anchorY]. The anchor is the point on the ground under the figure: the horizontal
centre of mass of the lowest quarter of the body, on its lowest solid row (stray wisps and sparks below do not count).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'tools' / 'art'
ATLAS = ROOT / 'assets' / 'img' / 'sprites' / 'ronin.webp'
MANIFEST = ROOT / 'assets' / 'manifest.js'

PACK = 0.55  # atlas px per sheet px
SCALE = 0.40  # game px per atlas px: the idle pose ends up about 100 px tall in the world (the Weaver is 78)
BG = np.array([34.0, 34.0, 34.0])

# pose rectangles on each sheet: name -> (x0, y0, x1, y1) in sheet px. A piece belongs to the rectangle holding its centre.
SHEET_A = {
    'idle_a': (39, 30, 310, 430),
    'ready': (335, 55, 572, 430),
    'draw': (582, 100, 868, 430),
    'breath': (898, 55, 1105, 430),
    'crouch': (1138, 145, 1392, 432),
    'walk': (1398, 65, 1650, 432),
    'run1': (36, 468, 296, 812),
    'run2': (305, 488, 582, 790),
    'run3': (590, 500, 885, 795),
    'run4': (825, 535, 1152, 800),
    'jump': (1156, 448, 1400, 812),
    'midair': (1400, 468, 1672, 805),
    'dive': (440, 725, 690, 935),
    'tumble': (40, 880, 305, 1100),
    'slam': (318, 860, 612, 1165),
    'airslash': (605, 880, 895, 1145),
    'hurt': (895, 880, 1128, 1195),
    'knock': (1128, 885, 1405, 1135),
    'pound': (1405, 770, 1660, 1010),
    'lying': (1370, 1005, 1665, 1185),
    'kneel': (36, 1240, 302, 1612),
    'meditate': (340, 1245, 640, 1592),
    'drink': (648, 1245, 852, 1622),
    'swordup': (896, 1235, 1140, 1622),
    'taunt': (1160, 1245, 1392, 1622),
    'idle_b': (1415, 1235, 1650, 1622),
    'crumple': (36, 1775, 302, 2002),
    'crawl': (315, 1775, 645, 2002),
    'dead': (648, 1880, 1052, 2062),
    'ash': (1070, 1838, 1455, 2022),
    'stand_c': (1415, 1655, 1652, 2052),
    'slash1': (28, 2058, 392, 2512),
    'slash2': (404, 2088, 932, 2512),
    'slash3': (920, 2088, 1372, 2512),
    'stand_d': (1336, 2098, 1662, 2525),
}

SHEET_B = {
    'charge': (20, 100, 312, 432),
    'speed': (318, 115, 602, 432),
    'cross': (598, 55, 985, 432),
    'tornado': (972, 78, 1205, 432),
    'flame': (1200, 8, 1392, 432),
    'gburst': (1392, 8, 1696, 432),
    'spikes': (1400, 488, 1696, 805),
    'focus': (18, 830, 305, 1192),
    'aura': (308, 808, 622, 1192),
    'float': (624, 795, 882, 1192),
    'absorb': (878, 805, 1122, 1192),
    'unleash': (1118, 795, 1372, 1192),
    'transformed': (1358, 815, 1675, 1192),
    'clone': (18, 1288, 405, 1602),
    'clash': (408, 1288, 880, 1602),
    'barrage': (880, 1288, 1352, 1602),
    'whirl': (1352, 1288, 1696, 1602),
    'grab': (18, 1668, 410, 2026),
    'erupt': (408, 1668, 702, 2026),
    'void': (700, 1685, 1135, 2026),
    'illusion': (1108, 1735, 1402, 2026),
    'giant': (1398, 1675, 1696, 2026),
    'burst': (930, 2088, 1350, 2512),
    'return': (1338, 2098, 1672, 2487),
}

# regions wiped before cutting: a sword swing that belongs to no pose, and the like (sheet px)
DROP_A = [(1100, 1660, 1478, 1800)]
# the caption strips under the labelled rows of sheet B
DROP_B = [(0, 1196, 1696, 1264), (0, 1604, 1696, 1650), (0, 2030, 1696, 2072), (0, 2490, 1696, 2528)]

SHEETS = [('ronin_normal.jpg', SHEET_A, DROP_A), ('ronin_transform.jpg', SHEET_B, DROP_B)]


def components(mask):
    """8-connected components by run-length union-find. Returns an int label image (0 = background)."""
    h, w = mask.shape
    parent = [0]
    prev = []
    lab = np.zeros((h, w), np.int32)

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]

        return i

    for y in range(h):
        row = mask[y]

        if not row.any():
            prev = []
            continue

        d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        cur = []

        for x0, x1 in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            rid = None

            for px0, px1, pid in prev:
                if px0 < x1 + 1 and px1 > x0 - 1:
                    if rid is None:
                        rid = find(pid)
                    elif find(pid) != rid:
                        parent[find(pid)] = rid

            if rid is None:
                parent.append(len(parent))
                rid = len(parent) - 1

            cur.append((x0, x1, rid))
            lab[y, x0:x1] = rid

        prev = cur

    roots = np.array([find(i) for i in range(len(parent))])

    return roots[lab] * (lab > 0)


def dilate(m, k):
    for _ in range(k):
        d = m.copy()
        d[1:] |= m[:-1]
        d[:-1] |= m[1:]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d

    return m


def key_sheet(path):
    """Returns an RGBA array: the grey background is transparent, everything else is un-mixed from it."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    d = np.abs(rgb - BG).max(axis=2)

    # flat grey: close to the background colour AND smooth (dark cloth is textured and hatched, so it never qualifies)
    gray = np.pad(rgb.mean(axis=2), 1, mode='edge')
    nb = np.stack([gray[y:y + rgb.shape[0], x:x + rgb.shape[1]] for y in range(3) for x in range(3)])
    flat = (nb.max(axis=0) - nb.min(axis=0)) < 9
    bgl = (d < 11) & flat

    # big flat pockets are background (the gap between the legs, inside an arc); small ones are cloth detail
    lab = components(bgl)
    ids, counts = np.unique(lab[lab > 0], return_counts=True)
    big = np.zeros(len(ids) + 1, bool)
    big_ids = ids[counts >= 220]
    background = np.isin(lab, big_ids)

    # soft edge: alpha ramps with the distance from the grey, but only next to the background
    near = dilate(background, 3)
    ramp = np.clip((d - 6.0) / 20.0, 0.0, 1.0)
    alpha = np.where(background, 0.0, np.where(near, ramp, 1.0))

    # un-mix the grey from the soft edge so no grey fringe is left
    a3 = np.maximum(alpha, 0.05)[..., None]
    fg = np.clip((rgb - (1.0 - alpha[..., None]) * BG) / a3, 0, 255)
    fg = np.where((alpha < 0.999)[..., None], fg, rgb)

    return np.dstack([fg, alpha * 255.0]).clip(0, 255).astype(np.uint8)


def cut_poses(rgba, rects):
    """One cut-out per rectangle (a dict name -> RGBA array, sheet-px size, anchor in sheet px).

    A connected piece goes whole to the rectangle holding almost all of it (so a long arc that leaves its rectangle is
    kept). A piece that spans several poses (a trailing cloak that touches the next figure) is split pixel by pixel
    along the rectangle edges. A rectangle may list `excl` boxes: pixels in them never belong to it."""
    a = rgba[..., 3]
    lab = components(a > 40)
    n = int(lab.max()) + 1
    H, W = lab.shape
    ys, xs = np.mgrid[0:H, 0:W]
    area = np.bincount(lab.ravel(), minlength=n)
    cx = np.bincount(lab.ravel(), weights=xs.ravel(), minlength=n) / np.maximum(area, 1)
    cy = np.bincount(lab.ravel(), weights=ys.ravel(), minlength=n) / np.maximum(area, 1)

    order = sorted(rects, key=lambda k: (rects[k][2] - rects[k][0]) * (rects[k][3] - rects[k][1]))

    def box(r):
        return r[:4]

    def excl(r):
        return r[4] if len(r) > 4 else []

    # pixel -> rectangle by position (smallest rectangle first)
    pix = np.zeros((H, W), np.int32)
    names = list(rects)

    for k in reversed(order):
        x0, y0, x1, y1 = box(rects[k])
        sub = np.full((y1 - y0, x1 - x0), names.index(k) + 1, np.int32)

        for ex0, ey0, ex1, ey1 in excl(rects[k]):
            sub[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = 0

        cur = pix[y0:y1, x0:x1]
        pix[y0:y1, x0:x1] = np.where(sub > 0, sub, cur)

    # per piece: how its pixels fall across the rectangles
    owner_whole = {}
    split = set()

    for i in range(1, n):
        if area[i] < 14:
            continue

        m = lab == i
        yy, xx = np.nonzero(m)
        cnt = np.bincount(pix[yy, xx], minlength=len(names) + 1)
        share = cnt[1:] / float(len(yy))

        if share.max() >= 0.9:
            owner_whole[i] = names[int(share.argmax())]
        elif (share >= 0.08).sum() >= 2:
            split.add(i)
        else:
            k = pix[int(cy[i]), int(cx[i])]

            if k:
                owner_whole[i] = names[k - 1]

    out = {}

    for name in rects:
        k = names.index(name) + 1
        ids = [i for i, o in owner_whole.items() if o == name]
        mask = np.isin(lab, ids) if ids else np.zeros((H, W), bool)

        if split:
            sp = np.isin(lab, list(split)) & (pix == k)
            mask = mask | sp

        if not mask.any():
            raise SystemExit('no pixels found for pose ' + name)

        yy, xx = np.nonzero(mask)
        x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        pad = 3
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(mask.shape[1], x1 + pad), min(mask.shape[0], y1 + pad)

        crop = rgba[y0:y1, x0:x1].copy()
        # a soft rim around each kept piece survives (it lies inside the dilation), everything else is cleared
        keep = dilate(mask, 2)[y0:y1, x0:x1]
        crop[..., 3] = np.where(keep, crop[..., 3], 0)

        # anchor: horizontal centre of the lowest solid part of the body, on its lowest well-supported row
        m = crop[..., 3] > 128
        rows = m.sum(axis=1)
        solid_rows = np.nonzero(rows >= max(6, int(rows.max() * 0.06)))[0]
        by = int(solid_rows.max()) + 1
        # the centre of mass of the lowest quarter: between the feet of a figure, in the middle of a tornado's funnel
        band = m[max(0, by - max(8, int((by - solid_rows.min()) * 0.25))):by]
        col = band.sum(axis=0).astype(np.float64)
        ax = float((col * np.arange(len(col))).sum() / col.sum()) if col.sum() else crop.shape[1] / 2.0

        out[name] = (crop, ax, float(by))

    return out


def pack(poses):
    """Shelf-pack scaled poses. Returns the atlas image and name -> frame."""
    items = []

    for name, (crop, ax, ay) in poses.items():
        im = Image.fromarray(crop, 'RGBA')
        w, h = max(1, round(im.width * PACK)), max(1, round(im.height * PACK))
        # resize on premultiplied colour so the transparent edge does not bleed dark fringes
        arr = np.asarray(im).astype(np.float32)
        arr[..., :3] *= arr[..., 3:4] / 255.0
        pm = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA').resize((w, h), Image.LANCZOS)
        p = np.asarray(pm).astype(np.float32)
        p[..., :3] = np.where(p[..., 3:4] > 0, p[..., :3] * 255.0 / np.maximum(p[..., 3:4], 1.0), 0)
        items.append((name, Image.fromarray(p.clip(0, 255).astype(np.uint8), 'RGBA'), ax * PACK, ay * PACK))

    items.sort(key=lambda it: -it[1].height)
    width = 3072
    x = y = row_h = 0
    placed = []

    for name, im, ax, ay in items:
        if x + im.width + 2 > width:
            x, y, row_h = 0, y + row_h + 2, 0

        placed.append((name, im, x, y, ax, ay))
        x += im.width + 2
        row_h = max(row_h, im.height)

    atlas = Image.new('RGBA', (width, y + row_h + 2), (0, 0, 0, 0))
    frames = {}

    for name, im, px, py, ax, ay in placed:
        atlas.paste(im, (px, py))
        frames[name] = [px, py, im.width, im.height, round(ax, 1), round(ay, 1)]

    return atlas, frames


def merge_manifest(frames):
    text = MANIFEST.read_text(encoding='utf-8')
    head, body = text.split('window.BW_MANIFEST = ', 1)
    man = json.loads(body.strip().rstrip(';'))

    man['images']['atlas_ronin'] = 'assets/img/sprites/ronin.webp'

    for k in [k for k in man['sprites'] if k.startswith('ronin_')]:
        del man['sprites'][k]

    for name, fr in frames.items():
        man['sprites']['ronin_' + name] = {
            'img': 'atlas_ronin',
            'frames': [fr],
            'ax': 0,
            'ay': 0,
            'scale': SCALE,
            'fps': 1,
            'loop': False,
        }

    MANIFEST.write_text(head + 'window.BW_MANIFEST = ' + json.dumps(man, separators=(',', ':')) + ';\n', encoding='utf-8')


def main():
    poses = {}

    for fname, rects, drop in SHEETS:
        rgba = key_sheet(ART / fname)

        for x0, y0, x1, y1 in drop:
            rgba[y0:y1, x0:x1, 3] = 0

        got = cut_poses(rgba, rects)

        for name, v in got.items():
            if name in poses:
                raise SystemExit('duplicate pose name ' + name)

            poses[name] = v

        print(fname, len(got), 'poses')

    atlas, frames = pack(poses)

    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(ATLAS, 'WEBP', quality=90, alpha_quality=100, method=6)
    merge_manifest(frames)
    print('atlas', atlas.size, 'poses', len(frames), 'bytes', ATLAS.stat().st_size)

    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        bg = Image.new('RGBA', atlas.size, (92, 120, 96, 255))
        bg.alpha_composite(atlas)
        bg.convert('RGB').save(out)


if __name__ == '__main__':
    main()
