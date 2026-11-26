"""Imports the "Long Mourner" boss art (two green-screen pose sheets) into assets/img/sprites/mourner.webp.

Usage: python tools/import_mourner_art.py <sheet A: phase one, 12 poses> <sheet B: phase two, 8 poses>
Needs: pip install pillow numpy

The sheets are green-screen JPEGs with a caption under every pose. This script
  * keys the green out with proper un-mixing (soft edges, no green tint on the veil threads),
  * wipes the caption strips and the ceiling line the "cling" pose hangs from,
  * cuts every pose out (splitting poses that touch, gathering loose threads onto the nearest body),
  * scales sheet B to match sheet A (by mask size), packs one transparent webp atlas,
  * merges `atlas_mourner` and the `mourner_<pose>` sprites into assets/manifest.js.

Sprite frame = [x, y, w, h, anchorX, anchorY, maskX, maskY]. The anchor is the body centre on the lowest point of the
pose (top centre for `cling`, which hangs from the ceiling); the mask point is where the pale glow is drawn.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / 'assets' / 'img' / 'sprites' / 'mourner.webp'
SCALE = 1.045  # game px per atlas px: the idle pose ends up about 300 px tall in the arena
# poses that rest on a body, not on their feet: the anchor sits on the lowest row at least this many px wide, so thin
# trailing arm lines don't hold a lying body up in the air
GROUND_MASS = {'fallen': 100}

A_NAMES = ['idle', 'walk', 'reach_tell', 'reach_strike', 'reach_recover', 'needle_tell',
           'needle_plant', 'veil_tell', 'veil_cast', 'scuttle', 'stagger', 'fallen']
B_NAMES = ['rise', 'hush', 'cling', 'drop', 'land', 'pounce', 'embrace_tell', 'embrace_strike']

# y ranges of the caption strips under each row of poses (everything inside them is text), and the row split
SHEETS = {
    'A': dict(names=A_NAMES, split=360, labels=[(350, 392), (702, 745)]),
    'B': dict(names=B_NAMES, split=450, labels=[(440, 480), (850, 896)]),
}


def key_green(im):
    """Soft chroma key with un-mixing: an edge pixel is  obs = a*fg + (1-a)*bg,  so the foreground colour is recovered
    instead of keeping a green tint (matters for the semi-transparent veil threads)."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    bg = np.median(a[spill > 140], axis=0)
    spill_bg = float(bg[1] - max(bg[0], bg[2]))

    alpha = np.clip(1.0 - spill / spill_bg, 0.0, 1.0)
    alpha = np.where(alpha < 0.08, 0.0, np.clip((alpha - 0.08) / 0.84, 0.0, 1.0))

    fg = np.clip((a - (1.0 - alpha[..., None]) * bg[None, None, :]) / np.maximum(alpha, 0.05)[..., None], 0, 255)
    edge = alpha < 0.999

    # any green left on the soft edge is spill: pull it back to the red / blue level
    fg[..., 1] = np.where(edge, np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) + 4.0), fg[..., 1])

    return np.dstack([fg, alpha * 255.0]).clip(0, 255).astype(np.uint8)


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


def erode(m, k):
    for _ in range(k):
        e = m.copy()
        e[1:] &= m[:-1]
        e[:-1] &= m[1:]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        m = e

    return m


def split_component(lab, comp_id, new_ids):
    """Cut one merged component into its two biggest bodies: erode to break the thin neck, then grow both back
    pixel by pixel (each pixel goes to whichever body reaches it first)."""
    comp = lab == comp_id
    l2 = components(erode(comp, 6))
    ids, counts = np.unique(l2[l2 > 0], return_counts=True)
    top = ids[np.argsort(-counts)[:2]]
    cur = np.zeros(lab.shape, np.int8)

    cur[l2 == top[0]] = 1
    cur[l2 == top[1]] = 2

    for _ in range(400):
        grown = cur.copy()

        for sh in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = np.roll(cur, sh, axis=(0, 1))
            take = comp & (grown == 0) & (nb > 0)
            grown[take] = nb[take]

        if (grown == cur).all():
            break

        cur = grown

    lab[comp] = 0
    lab[cur == 1] = new_ids[0]
    lab[cur == 2] = new_ids[1]

    return lab


def stats(lab):
    info = {}

    for i in np.unique(lab[lab > 0]):
        ys, xs = np.where(lab == i)
        info[i] = dict(n=len(xs), x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max(), cx=xs.mean(), cy=ys.mean())

    return info


def cut_sheet(path, key):
    cfg = SHEETS[key]
    rgba = key_green(Image.open(path))
    mask = rgba[..., 3] > 100
    h, w = mask.shape

    for y0, y1 in cfg['labels']:  # caption text
        mask[y0:y1, :] = False
        rgba[y0:y1, :, 3] = 0

    lab = components(mask)
    info = stats(lab)

    # a thin horizontal bar spanning a lot of width is the ceiling line the cling pose hangs from: cut those rows
    for i, c in info.items():
        if c['n'] < 2500:
            continue

        band = (lab[c['y0']:c['y0'] + 14, :] == i).sum(axis=1)

        for r in np.where(band > 150)[0]:
            rgba[c['y0'] + r, :, 3] = 0
            mask[c['y0'] + r, :] = False

    lab = components(mask)
    info = stats(lab)
    seeds = [i for i in info if info[i]['n'] >= 2500]

    while len(seeds) < len(cfg['names']):  # poses joined by a thin line: split the widest
        widest = max(seeds, key=lambda i: info[i]['x1'] - info[i]['x0'])

        lab = split_component(lab, widest, (int(lab.max()) + 1, int(lab.max()) + 2))
        info = stats(lab)
        seeds = [i for i in info if info[i]['n'] >= 2500]

    pts = {s: np.stack(np.where(lab == s)[::-1], 1)[::3] for s in seeds}
    owner = {s: s for s in seeds}

    for i in info:  # loose threads, fingertips and the like join the nearest body
        if i in owner or info[i]['n'] < 12:
            continue

        p = np.stack(np.where(lab == i)[::-1], 1)[::2]
        dist = {s: np.sqrt(((p[:, None, :] - pts[s][None, ::4, :]) ** 2).sum(-1)).min() for s in seeds}
        best = min(dist, key=dist.get)

        if dist[best] <= 90:
            owner[i] = best

    seeds.sort(key=lambda s: (0 if info[s]['cy'] < cfg['split'] else 1, info[s]['cx']))

    if len(seeds) != len(cfg['names']):
        raise SystemExit(f'sheet {key}: found {len(seeds)} poses, expected {len(cfg["names"])}')

    out = {}

    for s, name in zip(seeds, cfg['names']):
        m = np.isin(lab, [i for i, o in owner.items() if o == s])
        ys, xs = np.where(m)
        x0, x1, y0, y1 = max(0, xs.min() - 3), min(w, xs.max() + 4), max(0, ys.min() - 3), min(h, ys.max() + 4)
        crop = rgba[y0:y1, x0:x1].copy()
        grow = m[y0:y1, x0:x1].copy()

        for _ in range(3):  # keep only this pose (plus its soft edge) so neighbours never leak into the box
            g2 = grow.copy()
            g2[1:] |= grow[:-1]
            g2[:-1] |= grow[1:]
            g2[:, 1:] |= grow[:, :-1]
            g2[:, :-1] |= grow[:, 1:]
            grow = g2

        crop[..., 3] = np.where(grow, crop[..., 3], 0)
        crop[crop[..., 3] == 0, :3] = 0

        # the bone-white mask: the biggest very bright blob
        white = (crop[..., :3].astype(int).min(-1) > 205) & (crop[..., 3] > 200)
        wl = components(white)
        ids, cnt = np.unique(wl[wl > 0], return_counts=True)

        if len(ids):
            wy, wx = np.where(wl == ids[np.argmax(cnt)])
            mpt = (float(wx.mean()), float(wy.mean()))
            mh = float(np.ptp(wy))
        else:
            mpt, mh = (crop.shape[1] / 2, crop.shape[0] * 0.15), 0.0

        ay, ax = np.where(crop[..., 3] > 120)
        out[name] = dict(im=Image.fromarray(crop), body_x=float(ax.mean()), mask=mpt, mask_h=mh)

    return out


def main(a_path, b_path):
    poses = cut_sheet(a_path, 'A')
    poses.update(cut_sheet(b_path, 'B'))

    # sheet B was generated larger than sheet A: bring it to the same size by comparing the mask heights
    k = np.median([poses[n]['mask_h'] for n in A_NAMES]) / np.median([poses[n]['mask_h'] for n in B_NAMES])

    print(f'sheet B scale vs sheet A: {k:.3f}')

    for n in B_NAMES:
        p = poses[n]
        im = p['im']

        p['im'] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        p['body_x'] *= k
        p['mask'] = (p['mask'][0] * k, p['mask'][1] * k)

    # shelf-pack with a 4 px gutter
    names = A_NAMES + B_NAMES
    pad = 4
    width = 2048
    x = y = row_h = 0
    place = {}

    for n in names:
        im = poses[n]['im']

        if x + im.width + pad > width:
            x, y, row_h = 0, y + row_h + pad, 0

        place[n] = (x, y)
        x += im.width + pad
        row_h = max(row_h, im.height)

    atlas = Image.new('RGBA', (width, y + row_h + pad), (0, 0, 0, 0))

    for n in names:
        atlas.alpha_composite(poses[n]['im'], place[n])

    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(ATLAS, 'WEBP', quality=88, method=6, alpha_quality=100)
    print('wrote', ATLAS.relative_to(ROOT), atlas.size, f'{ATLAS.stat().st_size // 1024} KB')

    sprites = {}

    for n in names:
        p, (px, py) = poses[n], place[n]
        im = p['im']

        # anchor: body centre; bottom of the pose (top of the pose for `cling`, which hangs from the ceiling)
        ay = 0.0 if n == 'cling' else float(im.height)

        if n in GROUND_MASS:
            rows = (np.asarray(im)[..., 3] > 120).sum(axis=1)
            ay = float(np.where(rows >= GROUND_MASS[n])[0].max() + 3)

        sprites['mourner_' + n] = {
            'img': 'atlas_mourner',
            'frames': [[px, py, im.width, im.height, round(p['body_x'], 1), round(ay, 1),
                        round(p['mask'][0], 1), round(p['mask'][1], 1)]],
            'ax': 0, 'ay': 0, 'scale': SCALE, 'fps': 1, 'loop': True,
        }

    js = ROOT / 'assets' / 'manifest.js'
    raw = js.read_bytes().decode('utf8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    head, body = raw.split('window.BW_MANIFEST = ', 1)
    data = json.loads(body.strip().rstrip(';'))

    data['images']['atlas_mourner'] = 'assets/img/sprites/mourner.webp'
    data['sprites'] = {k: v for k, v in data['sprites'].items() if not k.startswith('mourner_')}
    data['sprites'].update(sprites)
    js.write_bytes(
        (head + 'window.BW_MANIFEST = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';' + nl).encode('utf8'))
    print('updated', js.relative_to(ROOT), f'({len(sprites)} mourner sprites)')


if __name__ == '__main__':
    main(*sys.argv[1:3])
