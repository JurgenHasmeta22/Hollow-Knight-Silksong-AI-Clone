"""Imports "The Hushed Gallery" art drop (Area G) into assets/img as webp, like the rest of the game art.

Usage: python tools/import_hushed_art.py [enemies folder] [other assets folder]
       (defaults: <repo>/Enemies and <repo>/Other ASSETS)
Needs: pip install pillow numpy

Input (all JPEG, AI generated, so the greens are uneven and the edges are noisy):
  Enemies/Enemy-13..17.jpg   green-screen pose sheets: Hushling, Shroud Drifter, Stilt Mourner, Gallows Reacher, Shade Brute
  Other ASSETS/*.jpg         backdrops, tile, props, objects, the Silent Key, the Last Door and the Long Mourner portrait

What it does
  * keys the green out with a *local* background estimate (the green drifts across the image) and un-mixes the edge
    pixels, so the dark outlines and the thin veil threads keep no green tint,
  * wipes the caption strips and the ground line that two of the sheets came with, cuts every pose out and packs one
    transparent atlas per enemy (assets/img/sprites/<enemy>.webp),
  * trims and scales every prop / object (state pairs such as gate / gate_open keep exactly the same registration),
  * crops the backdrops, makes the stone tile seamless, gives the mid layer a transparency the game can blend,
  * merges the new `images` and `sprites` entries into assets/manifest.js (everything else is kept as it is).

Sprite frame = [x, y, w, h, anchorX, anchorY]. The anchor is the body centre on the lowest point of the pose, except for
the poses that hang from the ceiling (top centre). `scale` is game px per atlas px, picked so each creature has the size
the art prompts ask for relative to the hero hitbox (56 px tall).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from import_mourner_art import components

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'assets' / 'img'
EXT = '.webp'
QUALITY = 85
HERO_H = 56  # BW.PHYS.h

# ---------------------------------------------------------------------------------------------------------------------
# enemies: id -> sheet, poses in sheet order, animations (name -> (pose names, fps)), size reference
# `ref` = (pose, height in game px): every pose of that creature shares one scale, taken from this pose
# `wipe_below` = y (in sheet px) under which everything is caption text; `ground_line` = a baseline drawn under the poses
# `hang` = poses anchored by their top (ceiling) instead of their lowest point
# ---------------------------------------------------------------------------------------------------------------------
ENEMIES = {
    'hushling': dict(
        sheet='Enemy-13.jpg',
        poses=['idle', 'crawl_a', 'crawl_b', 'tell', 'strike', 'dazed'],
        anims={'idle': (['idle'], 1), 'crawl': (['crawl_a', 'crawl_b'], 9), 'tell': (['tell'], 1),
               'lunge': (['strike'], 1), 'dazed': (['dazed'], 1)},
        ref=('crawl_a', HERO_H * 0.72),  # small and low: well under the hero's height
    ),
    'drifter': dict(
        sheet='Enemy-14.jpg',
        poses=['drift_a', 'drift_b', 'tell', 'strike', 'dazed'],
        anims={'drift': (['drift_a', 'drift_b'], 3), 'tell': (['tell'], 1), 'dive': (['strike'], 1),
               'dazed': (['dazed'], 1)},
        ref=('drift_a', HERO_H * 1.6),
        wipe_below=610,
    ),
    'stilt': dict(
        sheet='Enemy-15.jpg',
        poses=['idle', 'walk_a', 'walk_b', 'tell', 'strike', 'recover'],
        anims={'idle': (['idle'], 1), 'walk': (['walk_a', 'walk_b'], 4), 'tell': (['tell'], 1),
               'reach': (['strike'], 1), 'recover': (['recover'], 1)},
        ref=('idle', HERO_H * 1.6),
    ),
    'reacher': dict(
        sheet='Enemy-16.jpg',
        poses=['hang', 'tell', 'drop', 'landed', 'dazed'],
        anims={'hang': (['hang'], 1), 'tell': (['tell'], 1), 'drop': (['drop'], 1), 'landed': (['landed'], 1),
               'dazed': (['dazed'], 1)},
        ref=('hang', HERO_H * 1.9),
        hang=['hang', 'tell'],
    ),
    'brute': dict(
        sheet='Enemy-17.jpg',
        poses=['idle', 'walk_a', 'walk_b', 'tell', 'strike', 'dazed'],
        anims={'idle': (['idle'], 1), 'walk': (['walk_a', 'walk_b'], 3), 'tell': (['tell'], 1),
               'slam': (['strike'], 1), 'dazed': (['dazed'], 1)},
        ref=('idle', HERO_H * 1.4),
        wipe_below=1168,
        ground_line=True,
    ),
}

# props and objects: output name -> (source file, folder under assets/img, height in px, keying mode)
# a state pair (`pair`) is cut with the union of both bounding boxes and one scale, so swapping the two never jumps
PROPS = {
    'deco_hg_veil': ('deco_hg_veil.jpg', 'props', 520, None),
    'deco_hg_statue': ('deco_hg_statue.jpg', 'props', 520, 'flood'),  # green fading to white: flood from the border
    'deco_hg_bell': ('deco_hg_bell.jpg', 'props', 340, None),
    'deco_hg_masks': ('deco_hg_masks.jpg', 'props', 300, None),
    'deco_hg_candles': ('deco_hg_candles.jpg', 'props', 320, None),
    'deco_hg_maskpile': ('deco_hg_maskpile.jpg', 'props', 260, None),
    'deco_hg_window': ('deco_hg_window.jpg', 'props', 620, None),
    'deco_hg_pillar': ('deco_hg_pillar.jpg', 'props', 480, None),
    'obj_hg_tablet': ('obj_hg_tablet.jpg', 'props', 300, None),
    'item_silentkey': ('item_silentkey.jpg', 'props', 192, None),
    'obj_hg_bier': ('obj_hg_bier.jpg', 'obj', 300, None),
    'obj_hg_keyaltar': ('obj_hg_keyaltar.jpg', 'obj', 420, None),
}
PAIRS = {
    ('obj_hg_lantern', 'obj_hg_lantern_lit'): ('obj_hg_lantern.jpg', 'obj_hg_lantern_lit.jpg', 'props', 300),
    ('obj_hg_gate', 'obj_hg_gate_open'): ('obj_hg_gate.jpg', 'obj_hg_gate_open.jpg', 'obj', 760),
    ('obj_lastdoor', 'obj_lastdoor_open'): ('obj_lastdoor.jpg', 'obj_lastdoor_open.jpg', 'obj', 880),
}


# ---------------------------------------------------------------------------------------------------------------------
# keying
# ---------------------------------------------------------------------------------------------------------------------
def spill_of(a):
    return a[..., 1] - np.maximum(a[..., 0], a[..., 2])


def bg_field(a, spill, block=32):
    """Per-pixel estimate of the green background colour: the mean of the surely-background pixels of every block,
    holes filled from their neighbours and smoothed up to full size. The generator's green is never flat."""
    h, w = spill.shape
    border = np.concatenate([spill[:8].ravel(), spill[-8:].ravel(), spill[:, :8].ravel(), spill[:, -8:].ravel()])
    sure = spill > 0.8 * np.median(border)
    gh, gw = -(-h // block), -(-w // block)
    pad = ((0, gh * block - h), (0, gw * block - w))
    m = np.pad(sure, pad).reshape(gh, block, gw, block)
    cnt = m.sum((1, 3)).astype(np.float32)
    grid = np.zeros((gh, gw, 3), np.float32)

    for c in range(3):
        ch = np.pad(a[..., c] * sure, pad).reshape(gh, block, gw, block)
        grid[..., c] = ch.sum((1, 3)) / np.maximum(cnt, 1)

    known = cnt >= 24

    for _ in range(gh + gw):  # fill the blocks that hold no background from their neighbours
        if known.all():
            break

        acc = np.zeros_like(grid)
        n = np.zeros((gh, gw), np.float32)

        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(known, (dy, dx), (0, 1))
            g = np.roll(grid, (dy, dx), (0, 1))
            acc += g * k[..., None]
            n += k

        take = ~known & (n > 0)
        grid[take] = acc[take] / n[take][:, None]
        known = known | take

    field = np.empty((h, w, 3), np.float32)

    for c in range(3):
        up = Image.fromarray(grid[..., c], 'F').resize((gw * block, gh * block), Image.BILINEAR)
        field[..., c] = np.asarray(up)[:h, :w]

    return field


def key_green(im):
    """Soft chroma key with un-mixing:  obs = a*fg + (1-a)*bg  with a bg that follows the local green."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    spill = spill_of(a)
    bg = bg_field(a, spill)
    bg_spill = np.maximum(spill_of(bg), 20.0)

    alpha = np.clip(1.0 - spill / bg_spill, 0.0, 1.0)
    alpha = np.where(alpha < 0.08, 0.0, np.clip((alpha - 0.08) / 0.84, 0.0, 1.0))

    fg = np.clip((a - (1.0 - alpha[..., None]) * bg) / np.maximum(alpha, 0.05)[..., None], 0, 255)
    edge = alpha < 0.999

    # whatever green is left on the soft edge is spill: pull it back to the red / blue level
    fg[..., 1] = np.where(edge, np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) + 4.0), fg[..., 1])

    return np.dstack([fg, alpha * 255.0]).clip(0, 255).astype(np.uint8)


def box3(m):
    """3x3 box blur of a float mask (edge pixels replicated)."""
    p = np.pad(m, 1, mode='edge')

    return sum(p[dy:dy + m.shape[0], dx:dx + m.shape[1]] for dy in range(3) for dx in range(3)) / 9.0


def key_flood(im):
    """For a backdrop that is green in places and fades to white: everything that looks like background AND is
    connected to the image border goes. Hard edge, one pixel eroded and softened, which is fine for a dark object."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    spill = spill_of(a)
    bgish = (spill > 25) | ((a.min(-1) > 190) & (spill < 40))
    lab = components(bgish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])

    fg = ~bg
    core = fg.copy()

    core[1:] &= fg[:-1]
    core[:-1] &= fg[1:]
    core[:, 1:] &= fg[:, :-1]
    core[:, :-1] &= fg[:, 1:]

    alpha = box3(core.astype(np.float32))
    alpha = np.where(alpha < 0.12, 0.0, alpha)

    # the 1 px ring keeps some of the old background colour: take the darkest neighbour instead
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    darkest = np.min([p[dy:dy + a.shape[0], dx:dx + a.shape[1]] for dy in range(3) for dx in range(3)], axis=0)
    ring = (alpha > 0) & (alpha < 1)
    rgb = np.where(ring[..., None], darkest, a)

    return np.dstack([rgb, alpha * 255.0]).clip(0, 255).astype(np.uint8)


def key(im, mode=None):
    return drop_specks(key_flood(im) if mode == 'flood' else key_green(im))


# ---------------------------------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------------------------------
def dilate(m, n):
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]
        g[:-1] |= m[1:]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g

    return m


def drop_specks(rgba, step=4, near=80):
    """JPEG noise leaves faint specks far from the object that would inflate the bounding box. Keep the big pieces and
    whatever lies within `near` px of them (chips, flames, glow), clear the rest. Works on a coarse mask for speed."""
    a = rgba[..., 3]
    lab = components(a[::step, ::step] > 40)
    ids, cnt = np.unique(lab[lab > 0], return_counts=True)
    main = np.isin(lab, ids[cnt >= 0.1 * cnt.max()])
    keep = np.unique(lab[dilate(main, near // step)])
    keep = np.isin(lab, keep[keep > 0])
    full = np.repeat(np.repeat(dilate(keep, 3), step, 0), step, 1)[:a.shape[0], :a.shape[1]]

    rgba[..., 3] = np.where(full, a, 0)

    return rgba


def bbox(rgba, pad=2, thr=8):
    ys, xs = np.where(rgba[..., 3] > thr)

    return (max(0, xs.min() - pad), max(0, ys.min() - pad),
            min(rgba.shape[1], xs.max() + 1 + pad), min(rgba.shape[0], ys.max() + 1 + pad))


def fit_height(im, h):
    if im.height <= h:  # never upscale
        return im

    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def save(im, folder, name, quality=QUALITY):
    out = IMG / folder / (name + EXT)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=quality, method=6, alpha_quality=100)
    print('wrote', out.relative_to(ROOT).as_posix(), im.size, f'{out.stat().st_size // 1024} KB')

    return f'assets/img/{folder}/{name}{EXT}'


def smoothstep(x, e0, e1):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)

    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------------------------------------------------
# backdrops, tile, portrait
# ---------------------------------------------------------------------------------------------------------------------
def import_backdrops(src, manifest):
    far = Image.open(src / 'bg_gallery_far.jpg').convert('RGB')
    far = far.resize((1920, round(far.height * 1920 / far.width)), Image.LANCZOS)
    manifest['bg_gallery_far'] = save(far, 'bg', 'gallery_far', 82)

    # the painting of the realm has a black strip along the bottom: crop it
    realm = Image.open(src / 'bg_gallery_realm.jpg').convert('RGB')
    rows = np.asarray(realm).astype(np.float32).mean((1, 2))
    bottom = int(np.where(rows > 12)[0].max()) + 1 - 2

    realm = realm.crop((0, 0, realm.width, bottom))
    realm = realm.resize((1920, round(realm.height * 1920 / realm.width)), Image.LANCZOS)
    manifest['bg_gallery_realm'] = save(realm, 'bg', 'gallery_realm', 84)

    # the mid layer came as an opaque scene inside a green frame, not as a cut-out: crop the frame and let the very dark
    # voids (veil interiors, the far end of the hall) show the far backdrop through, since the game tiles this at 0.85
    mid = np.asarray(Image.open(src / 'bg_gallery_mid.jpg').convert('RGB')).astype(np.float32)
    frame = spill_of(mid) > 120
    ys, xs = np.where(~frame)
    x0, x1, y0, y1 = xs.min() + 4, xs.max() - 3, ys.min(), ys.max() - 3
    crop = mid[y0:y1, x0:x1]
    lum = crop @ np.array([0.299, 0.587, 0.114], np.float32)
    alpha = 0.5 + 0.5 * smoothstep(lum, 4.0, 34.0)
    rgba = Image.fromarray(np.dstack([crop, alpha * 255.0]).clip(0, 255).astype(np.uint8), 'RGBA')

    rgba = rgba.resize((1600, round(rgba.height * 1600 / rgba.width)), Image.LANCZOS)
    manifest['bg_gallery_mid'] = save(rgba, 'bg', 'gallery_mid', 82)

    # the brick tile already wraps cleanly (checked by rolling it by half: bricks and mortar line up across the seam), so
    # mirroring a patch, like the fortress tile needed, would only add a visible symmetry. Just bring it to 512.
    tex = Image.open(src / 'tex_gallery.jpg').convert('RGB')
    manifest['tex_gallery'] = save(tex.resize((512, 512), Image.LANCZOS), 'tex', 'gallery')

    portrait = Image.open(src / 'portrait_mourner.jpg').convert('RGB')
    portrait = portrait.resize((round(portrait.width * 1200 / portrait.height), 1200), Image.LANCZOS)
    manifest['portrait_mourner'] = save(portrait, 'bg', 'portrait_mourner', 84)


# ---------------------------------------------------------------------------------------------------------------------
# props and objects
# ---------------------------------------------------------------------------------------------------------------------
def import_props(src, manifest):
    for name, (file, folder, height, mode) in PROPS.items():
        rgba = key(Image.open(src / file), mode)
        im = Image.fromarray(rgba, 'RGBA').crop(bbox(rgba))

        manifest[name] = save(fit_height(im, height), folder, name)

    for (name_a, name_b), (file_a, file_b, folder, height) in PAIRS.items():
        ka = key(Image.open(src / file_a))
        kb = key(Image.open(src / file_b))
        ba, bb = bbox(ka), bbox(kb)
        box = (min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3]))
        k = min(1.0, height / (box[3] - box[1]))
        size = (max(1, round((box[2] - box[0]) * k)), max(1, round((box[3] - box[1]) * k)))

        for name, rgba in ((name_a, ka), (name_b, kb)):
            im = Image.fromarray(rgba, 'RGBA').crop(box).resize(size, Image.LANCZOS)

            manifest[name] = save(im, folder, name)


# ---------------------------------------------------------------------------------------------------------------------
# enemy pose sheets
# ---------------------------------------------------------------------------------------------------------------------
def cut_sheet(path, cfg):
    rgba = key_green(Image.open(path))
    h, w = rgba.shape[:2]
    names = cfg['poses']
    big = w > 2000  # the 2752 px sheets are twice the linear size of the 1376 px ones

    if 'wipe_below' in cfg:  # caption text under the poses
        rgba[cfg['wipe_below']:, :, 3] = 0

    mask = rgba[..., 3] > 100

    if cfg.get('ground_line'):
        # a thin dark baseline runs under all the poses and glues them together: clear the rows where it lies, but
        # only in the columns where it is thin (a fist or a foot standing on it is thicker and stays)
        rows = mask.sum(axis=1)
        line_rows = np.where(rows > w * 0.8)[0]  # the bodies together never fill more than ~60% of a row

        if len(line_rows):
            y0, y1 = line_rows.min() - 1, line_rows.max() + 2
            band = mask[max(0, y0 - 8):y1 + 8]
            thick = band.sum(axis=0) > (y1 - y0) + 12
            clear = ~thick

            rgba[y0:y1, clear, 3] = 0
            mask[y0:y1, clear] = False

    lab = components(mask)
    ids, counts = np.unique(lab[lab > 0], return_counts=True)
    order = np.argsort(-counts)
    seeds = [int(ids[i]) for i in order[:len(names)]]

    if len(seeds) < len(names) or counts[order[len(names) - 1]] < (1500 if big else 400):
        raise SystemExit(f'{path.name}: could not find {len(names)} separate poses')

    pts = {s: np.stack(np.where(lab == s)[::-1], 1)[::3] for s in seeds}
    owner = {s: s for s in seeds}
    reach = 0.12 * w

    for i in ids:  # loose bits (stars, fingertips, threads) join the nearest body
        i = int(i)

        if i in owner:
            continue

        p = np.stack(np.where(lab == i)[::-1], 1)[::2]

        if len(p) == 0:
            continue

        dist = {s: np.sqrt(((p[:, None, :] - pts[s][None, ::4, :]) ** 2).sum(-1)).min() for s in seeds}
        best = min(dist, key=dist.get)

        if dist[best] <= reach:
            owner[i] = best

    stats = {s: np.where(lab == s)[1].mean() for s in seeds}
    seeds.sort(key=lambda s: stats[s])  # one row of poses: left to right

    out = {}

    for s, name in zip(seeds, names):
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
        out[name] = Image.fromarray(crop, 'RGBA')

    return out


def import_enemy(eid, cfg, src, manifest, sprites):
    poses = cut_sheet(src / cfg['sheet'], cfg)
    ref_pose, ref_h = cfg['ref']

    # keep the atlas at most ~4x the in-game size: the sheets are 2-3x bigger than that
    k = min(1.0, 4.0 * ref_h / poses[ref_pose].height)

    for n, im in poses.items():
        poses[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

    scale = ref_h / poses[ref_pose].height

    pad = 4
    width = 2048
    x = y = row_h = 0
    place = {}

    for n in cfg['poses']:
        im = poses[n]

        if x + im.width + pad > width:
            x, y, row_h = 0, y + row_h + pad, 0

        place[n] = (x, y)
        x += im.width + pad
        row_h = max(row_h, im.height)

    atlas = Image.new('RGBA', (width, y + row_h + pad), (0, 0, 0, 0))

    for n in cfg['poses']:
        atlas.alpha_composite(poses[n], place[n])

    atlas = atlas.crop((0, 0, max(px + poses[n].width for n, (px, _) in place.items()) + pad, atlas.height))
    manifest['atlas_' + eid] = save(atlas, 'sprites', eid)

    frame = {}

    for n in cfg['poses']:
        im, (px, py) = poses[n], place[n]
        a = np.asarray(im)[..., 3] > 120
        ax = float(np.where(a)[1].mean())

        if n in cfg.get('hang', []):
            ay = 0.0
        else:
            # lowest row that is more than a hair thin, so a ground crack or a lone trailing thread doesn't hold the
            # pose up in the air
            rows = a.sum(axis=1)
            ay = float(np.where(rows >= max(3, round(0.04 * im.width)))[0].max() + 1)

        frame[n] = [px, py, im.width, im.height, round(ax, 1), round(ay, 1)]

    for anim, (pose_names, fps) in cfg['anims'].items():
        sprites[f'{eid}_{anim}'] = {
            'img': 'atlas_' + eid,
            'frames': [frame[p] for p in pose_names],
            'ax': 0, 'ay': 0, 'scale': round(scale, 5), 'fps': fps, 'loop': True,
        }


# ---------------------------------------------------------------------------------------------------------------------
def main(enemies, other):
    enemies, other = Path(enemies), Path(other)
    manifest, sprites = {}, {}

    import_backdrops(other, manifest)
    import_props(other, manifest)

    for eid, cfg in ENEMIES.items():
        import_enemy(eid, cfg, enemies, manifest, sprites)

    js = ROOT / 'assets' / 'manifest.js'
    raw = js.read_bytes().decode('utf8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    head, body = raw.split('window.BW_MANIFEST = ', 1)
    data = json.loads(body.strip().rstrip(';'))
    own = tuple(e + '_' for e in ENEMIES)

    data['images'].update(manifest)
    data['sprites'] = {k: v for k, v in data['sprites'].items() if not k.startswith(own)}
    data['sprites'].update(sprites)
    js.write_bytes(
        (head + 'window.BW_MANIFEST = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';' + nl).encode('utf8'))
    print('updated', js.relative_to(ROOT).as_posix(), f'({len(manifest)} images, {len(sprites)} sprites)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'Enemies', sys.argv[2] if len(sys.argv) > 2 else ROOT / 'Other ASSETS')
