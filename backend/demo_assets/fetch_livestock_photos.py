"""One-off: pull freely-licensed breed photos off Wikimedia Commons into
PFUMA's committed demo asset folder, and write the attribution file that
the CC BY-SA licences require.

Run once from the repo root. The seed script (backend/seed_demo_data.py)
copies what this produces into backend/uploads/animals/demo/ so the
platform serves the photos itself instead of hot-linking a CDN — the
demo has to survive a bad conference Wi-Fi connection.
"""
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

OUT_DIR = os.path.join('backend', 'demo_assets', 'animals')
UA = 'PFUMA-demo-asset-fetch/1.0 (https://github.com/teamgriwd-del/PFUMA; teamgriwd@gmail.com)'
TARGET_W, TARGET_H = 800, 600

# Hand-curated rather than search-driven: a plain Commons search for
# "Tuli cattle" or "Afrikaner cattle" returns rugby players and colonial
# maps, so every file below was eyeballed first. Indigenous Zimbabwean
# breeds (Mashona, Nkone, Matabele goat) have no breed-tagged photos on
# Commons, so they use Wiki Loves Africa uploads actually shot in
# Zimbabwe — which look more like what a farmer at the booth owns anyway.
#
# A `None` slot is a photo that downloaded fine but was cut after looking
# at it (animal too distant, shot through a fence, too dark to read).
# It stays here as a hole rather than being deleted so the survivors keep
# the numbering they already have on disk.
BREED_FILES = {
    ('Cattle', 'Brahman'): [
        'Brahman Heifer.jpg',
        'Brahman cattle 2.JPG',
        'Brahman cattle SB024.jpg',
        'Brahman cattle in Costa Rica.jpg',
    ],
    ('Cattle', 'Nguni'): [
        'Nguni Cows.jpg',
        'Nguni cattle.jpg',
        'Nguni (17853268560).jpg',
        'Mkhaya Game Reserve banner Nguni cattle.jpg',
    ],
    ('Cattle', 'Mashona'): [
        'Cattle inkomo.jpg',
        'Cattle or bhuru.jpg',
        'Cattle in a traditional kraal.jpg',
    ],
    ('Cattle', 'Nkone'): [
        'Cow in the kraal.jpg',
        'Isibaya senkomo.jpg',
    ],
    ('Cattle', 'Tuli'): [
        'Tuli Bull Calf.jpg',
        'CSIRO ScienceImage 107 Tuli Bull.jpg',
    ],
    ('Cattle', 'Boran'): [
        None,  # dropped: animal lost in dry grass
        'Boran cattle in Kenya.jpg',
    ],
    ('Cattle', 'Hereford'): [
        'Hereford cattle Big Sur May 2011 001.jpg',
        'Hereford bull large.jpg',
        'Hereford Calf Portrait, SC, Vic, 13.10.2007 edit.jpg',
    ],
    ('Cattle', 'Angus'): [
        'Aberdeen Angus bull - geograph.org.uk - 546924.jpg',
        'Aberdeen-Angus Cattle - geograph.org.uk - 563174.jpg',
        'Aberdeen angus heifer cattle with herd of cattle in background.-.jpg',
    ],
    ('Cattle', 'Simmental'): [
        'Simmental at Tioga PA county fair.jpg',
        'Simmental cattle - CO2v01-22619964.jpg',
    ],
    ('Cattle', 'Sussex'): [
        'Sussex cattle - geograph.org.uk - 730144.jpg',
        'Sussex cow.JPG',
    ],
    ('Goat', 'Boer'): [
        'Boer goat.jpg',
        'Boer goat444.jpg',
        'Boer Goat (49944899088).jpg',
        'Boer goat with ear tag.jpg',
    ],
    ('Goat', 'Matabele'): [
        'Farm goat feeding.jpg',
        None,  # dropped: shot through a chain-link fence
        'Goats Breeding.jpg',
    ],
    ('Goat', 'Kalahari Red'): [
        'Kalahari Red Goat, April 2023.jpg',
        'Kalahari Red Herde.jpg',
        'Kalahari red Bock.jpg',
    ],
    ('Goat', 'Saanen'): [
        'Saanen goat standing.jpg',
        'Saanen goat-04287.jpg',
        'Saanen goats.jpg',
    ],
    ('Goat', 'Toggenburg'): [
        'Toggenburg Dairy Goat.jpg',
        'Toggenburger Goat.jpg',
        'Mature Toggenburg Doe in Winter.jpg',
    ],
    ('Goat', 'Savanna'): [
        'Two Savanna goats standing near a water trough.jpg',
        'Red Sokoto Goats by Buhari Habibu.jpg',
    ],
}


def strip_html(s):
    return re.sub(r'<[^>]+>', '', s or '').strip()


def commons_meta(titles):
    """imageinfo for up to 50 File: titles in one call."""
    q = urllib.parse.urlencode({
        'action': 'query',
        'format': 'json',
        'titles': '|'.join('File:' + t for t in titles),
        'prop': 'imageinfo',
        'iiprop': 'url|mime|extmetadata',
        'iiurlwidth': '1200',
    })
    req = urllib.request.Request(
        'https://commons.wikimedia.org/w/api.php?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    out = {}
    for page in data.get('query', {}).get('pages', {}).values():
        if 'imageinfo' not in page:
            continue
        ii = page['imageinfo'][0]
        ext = ii.get('extmetadata') or {}
        out[page['title'][len('File:'):]] = {
            'thumburl': ii.get('thumburl') or ii.get('url'),
            'descurl': ii.get('descriptionurl'),
            'licence': strip_html(ext.get('LicenseShortName', {}).get('value')),
            'author': strip_html(ext.get('Artist', {}).get('value')) or 'Unknown',
        }
    return out


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main():
    if not os.path.isdir('backend'):
        sys.exit('run me from the repo root')
    os.makedirs(OUT_DIR, exist_ok=True)

    all_titles = [t for files in BREED_FILES.values() for t in files if t]
    meta = {}
    for i in range(0, len(all_titles), 40):
        meta.update(commons_meta(all_titles[i:i + 40]))

    manifest, credits, missing = {}, [], []
    for (species, breed), titles in BREED_FILES.items():
        key = f'{species}|{breed}'
        manifest[key] = []
        for n, title in enumerate(titles, 1):
            if title is None:
                continue
            m = meta.get(title)
            if not m or not m['thumburl']:
                missing.append(title)
                continue
            local = f'{slug(species)}-{slug(breed)}-{n:02d}.jpg'
            dest = os.path.join(OUT_DIR, local)
            if not os.path.exists(dest):
                req = urllib.request.Request(m['thumburl'], headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=90) as r:
                    raw = r.read()
                img = Image.open(io.BytesIO(raw)).convert('RGB')
                # centering slightly above middle: the animal is usually in
                # the upper two thirds, the bottom third is usually ground.
                img = ImageOps.fit(img, (TARGET_W, TARGET_H), Image.LANCZOS,
                                   centering=(0.5, 0.45))
                img.save(dest, 'JPEG', quality=78, optimize=True, progressive=True)
            manifest[key].append(local)
            credits.append((local, title, m['descurl'], m['licence'], m['author']))
            print(f'  {local}  <- {title}  [{m["licence"]}]')

    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write('\n')

    with open(os.path.join(OUT_DIR, 'ATTRIBUTION.md'), 'w', encoding='utf-8') as f:
        f.write('# Demo livestock photo credits\n\n')
        f.write('These are the placeholder photos attached to the seeded demo animals\n')
        f.write('(`backend/seed_demo_data.py`). They stand in for real farmer photos so the\n')
        f.write('herd registry and marketplace have something to show at a live demo — no\n')
        f.write('animal below belongs to any PFUMA user.\n\n')
        f.write('All sourced from Wikimedia Commons. Reproduced under the licence named on\n')
        f.write('each row; follow the Commons link for the full licence text and any\n')
        f.write('further conditions.\n\n')
        f.write('| File | Author | Licence | Source |\n|---|---|---|---|\n')
        for local, title, descurl, licence, author in sorted(credits):
            f.write(f'| `{local}` | {author} | {licence} | [{title}]({descurl}) |\n')

    total = sum(len(v) for v in manifest.values())
    print(f'\n{total} photos in {OUT_DIR}')
    if missing:
        print('MISSING (fix BREED_FILES):')
        for t in missing:
            print('  -', t)
        sys.exit(1)


if __name__ == '__main__':
    main()
