"""Imports the raw "Ashen Ramparts" art drop into assets/img as webp, like the rest of the game art.

Usage: python tools/import_fortress_art.py <folder with the 5 source PNGs>
Needs: pip install pillow numpy
The source PNGs are no longer kept in the repo (the outputs in assets/ are what the game uses); put new drops in a
scratch folder and point the script at it.

Chroma-green backgrounds are keyed to transparency and the prop sheets are sliced into single sprites.
Also merges the new image entries into assets/manifest.js (the existing entries and sprites are kept as they are).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'assets' / 'img'
EXT = '.webp'
QUALITY = 85


def key_green(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    alpha = np.clip(1.0 - (spill - 35.0) / 70.0, 0.0, 1.0)
    a[..., 3] = np.minimum(a[..., 3], alpha * 255.0)
    # pull green out of the semi-transparent fringe
    fringe = (alpha < 1.0) | (spill > 12.0)
    a[..., 1] = np.where(fringe, np.minimum(g, np.maximum(r, b) + 6.0), g)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def trim(im, pad=2):
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save(im, rel):
    out = IMG / (rel + EXT)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=QUALITY, method=6, alpha_quality=100)
    print('wrote', out.relative_to(ROOT), im.size)
    return 'assets/img/' + rel + EXT


def main(src):
    src = Path(src)
    manifest = {}

    far = Image.open(src / '01_far_background.png').convert('RGB')
    manifest['bg_fortress_far'] = save(far, 'bg/fortress_far')

    mid = Image.open(src / '02_midground_chroma_green.png')
    mid = key_green(mid.crop((0, 8, mid.width, mid.height)))
    manifest['bg_fortress_mid'] = save(mid, 'bg/fortress_mid')

    # seamless square tile: crop a clean patch and mirror it on both axes
    tex = Image.open(src / '03_fortress_stone_texture.png').convert('RGB')
    patch = tex.crop((60, 24, 60 + 232, 24 + 232))
    tile = Image.new('RGB', (464, 464))
    tile.paste(patch, (0, 0))
    tile.paste(patch.transpose(Image.FLIP_LEFT_RIGHT), (232, 0))
    tile.paste(patch.transpose(Image.FLIP_TOP_BOTTOM), (0, 232))
    tile.paste(patch.transpose(Image.ROTATE_180), (232, 232))
    manifest['tex_fortress'] = save(tile, 'tex/fortress')

    sheet = key_green(Image.open(src / 'Fantasy Fortress Asset Sheet.png'))
    props = {
        'banner': (30, 10, 320, 560), 'brazier': (365, 75, 590, 525), 'arch': (620, 15, 1200, 515),
        'spears': (1225, 30, 1600, 505), 'barricade': (10, 555, 545, 895), 'chains': (585, 570, 865, 910),
        'gargoyle': (900, 550, 1185, 905), 'shield': (1225, 545, 1655, 900),
    }
    for name, box in props.items():
        manifest['deco_ft_' + name] = save(trim(sheet.crop(box)), 'props/deco_ft_' + name)

    gothic = Image.open(src / 'Gothic Fortress and Mystical Portal Assets.png')
    manifest['bg_fortress_dusk'] = save(gothic.crop((0, 0, gothic.width, 468)).convert('RGB'), 'bg/fortress_dusk')
    portal = key_green(gothic.crop((140, 470, 730, gothic.height)))
    manifest['deco_ft_portal'] = save(trim(portal), 'props/deco_ft_portal')

    js = ROOT / 'assets' / 'manifest.js'
    raw = js.read_bytes().decode('utf8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    head, body = raw.split('window.BW_MANIFEST = ', 1)
    data = json.loads(body.strip().rstrip(';'))

    data['images'].update(manifest)
    js.write_bytes(
        (head + 'window.BW_MANIFEST = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';' + nl).encode('utf8'))
    print('updated', js.relative_to(ROOT))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
