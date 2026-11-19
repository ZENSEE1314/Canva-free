#!/usr/bin/env python3
"""Build the Artvas element packs in public/elements/ from open-licensed npm packages.

Sources (download with `npm pack` into a folder and pass it as the first argument):
  - @lobehub/fluent-emoji-3d@1.1.0  (Microsoft Fluent Emoji 3D, MIT)
  - @iconify-json/noto@1.2.10       (Google Noto Emoji, Apache-2.0)
  - lucide-static@1.76.0            (Lucide icons, ISC)

Usage: python3 scripts/build-elements.py <folder-with-extracted-packages>
"""
import base64
import json
import os
import sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'elements')
os.makedirs(OUT, exist_ok=True)

FLUENT = os.path.join(SRC, 'lobehub-fluent-emoji-3d-1.1.0', 'package', 'assets')
NOTO = os.path.join(SRC, 'iconify-json-noto-1.2.10', 'package')
LUCIDE = os.path.join(SRC, 'lucide-static-1.76.0', 'package')

SKIN = ('1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff')
CAT_KEYS = {
    'Smileys & Emotion': 'smileys',
    'People & Body': 'people',
    'Animals & Nature': 'nature',
    'Food & Drink': 'food',
    'Activities': 'activities',
    'Travel & Places': 'travel',
    'Objects': 'objects',
    'Symbols': 'symbols',
}
PEOPLE_KEEP = ('hand', 'thumbs', 'clapping', 'folded', 'waving', 'ok-hand', 'victory', 'crossed-fingers', 'love-you',
               'call-me', 'flexed', 'writing', 'raised-fist', 'oncoming-fist', 'index-pointing', 'pinched', 'eyes', 'brain',
               'heart-hands', 'palms', 'handshake', 'footprints', 'speaking-head', 'busts', 'bust-in')
LIMIT = {'smileys': 90, 'people': 50, 'nature': 140, 'food': 130, 'activities': 85, 'travel': 150, 'objects': 200, 'symbols': 90}

chars = json.load(open(os.path.join(NOTO, 'chars.json')))
meta = json.load(open(os.path.join(NOTO, 'metadata.json')))
name_cat = {}
for cat, names in meta['categories'].items():
    for n in names:
        name_cat[n] = CAT_KEYS.get(cat)


def noto_name(code):
    for k in (code, code.replace('-fe0f', ''), code + '-fe0f'):
        if k in chars:
            return chars[k]
    return None


def keep(name, cat):
    if not cat or any(t in name for t in ('skin-tone',)):
        return False
    if cat == 'people':
        return any(t in name for t in PEOPLE_KEEP)
    return True


# ---- Fluent 3D (webp images)
groups = {}
for f in sorted(os.listdir(FLUENT)):
    code = f.rsplit('.', 1)[0]
    if any(s in code for s in SKIN):
        continue
    name = noto_name(code)
    if not name:
        continue
    cat = name_cat.get(name)
    if not keep(name, cat):
        continue
    g = groups.setdefault(cat, [])
    if len(g) >= LIMIT[cat]:
        continue
    data = open(os.path.join(FLUENT, f), 'rb').read()
    g.append({'n': name.replace('-', ' '), 'd': 'data:image/webp;base64,' + base64.b64encode(data).decode()})
for cat, items in groups.items():
    json.dump(items, open(os.path.join(OUT, f'3d-{cat}.json'), 'w'), separators=(',', ':'))
print('3d', {k: len(v) for k, v in groups.items()})

# ---- Noto (flat colour SVG stickers)
icons = json.load(open(os.path.join(NOTO, 'icons.json')))
W, H = icons.get('width', 128), icons.get('height', 128)
ng = {}
for name, ic in icons['icons'].items():
    cat = name_cat.get(name)
    if not keep(name, cat):
        continue
    body = ic['body']
    if len(body) > 12000:  # skip very heavy drawings
        continue
    g = ng.setdefault(cat, [])
    if len(g) >= LIMIT[cat]:
        continue
    w, h = ic.get('width', W), ic.get('height', H)
    g.append({'n': name.replace('-', ' '), 's': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 4}" height="{h * 4}">{body}</svg>'})
for cat, items in ng.items():
    json.dump(items, open(os.path.join(OUT, f'flat-{cat}.json'), 'w'), separators=(',', ':'))
print('flat', {k: len(v) for k, v in ng.items()})

# ---- Lucide icons (vector nodes)
nodes = json.load(open(os.path.join(LUCIDE, 'icon-nodes.json')))
json.dump(nodes, open(os.path.join(OUT, 'icons.json'), 'w'), separators=(',', ':'))
print('icons', len(nodes))

open(os.path.join(OUT, 'LICENSES.txt'), 'w').write("""Artvas element packs include artwork from:
- Microsoft Fluent Emoji (3D) - MIT License - https://github.com/microsoft/fluentui-emoji (via @lobehub/fluent-emoji-3d)
- Google Noto Emoji - Apache License 2.0 - https://github.com/googlefonts/noto-emoji (via @iconify-json/noto)
- Lucide icons - ISC License - https://lucide.dev
""")
