#!/usr/bin/env python
"""Seed a full set of demo accounts and livestock for a live PFUMA demo.

Built for standing at an expo stand and walking an official through the
whole platform: two farmers in every one of Zimbabwe's ten provinces, each
with a real herd of cattle and goats, a vet and a police officer per
province, a senior (national-tier) officer, and one supplier and one buyer
trading nationwide. On top of the accounts it seeds the transactions the
demo actually walks through — listings waiting on police clearance,
cleared listings on the marketplace, past sales with bids and trust
ratings, cooperative dip rounds, supplier orders.

Everything here is fabricated. No animal, person, national ID, badge or
licence number below belongs to anyone real.

    python seed_demo_data.py                 # create what's missing
    python seed_demo_data.py --reset         # wipe demo data, then create
    python seed_demo_data.py --purge         # wipe demo data, create nothing
    python seed_demo_data.py --summary       # just report what's there

Reads the same PFUMA_DB_* environment variables the backend does, so on the
VPS run it with run_pfuma_backend.ps1's env already set.

Demo data is tagged by `users.avatar_seed = 'pfuma-demo-2026'`, which no
real signup ever sets (see register() in app.py) and which nothing in
either UI renders. --purge deletes exactly the rows carrying that marker,
and the foreign keys cascade the rest (animals, listings, clearances,
bids, orders, ratings), so a real account can never be caught by it.
"""
import argparse
import datetime
import json
import os
import random
import shutil
import sys

import pymysql

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import protocols  # noqa: E402  (same directory, needs the path above)

# ── constants ────────────────────────────────────────────────────────────
DEMO_MARKER = 'pfuma-demo-2026'
DEMO_PASSWORD = 'Pfuma2026!'
# bcrypt of DEMO_PASSWORD, the same shared demo hash schema.sql's seed rows
# use. Hardcoded so this runs without bcrypt installed and so a re-seed
# produces byte-identical rows. Never reuse it for a real account.
DEMO_PASSWORD_HASH = '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG'

HERE = os.path.dirname(os.path.abspath(__file__))
ASSET_DIR = os.path.join(HERE, 'demo_assets', 'animals')
UPLOAD_ANIMAL_DIR = os.path.join(HERE, 'uploads', 'animals', 'demo')
# Served publicly by get_photo() in app.py — category 'animals' is in
# PUBLIC_PHOTO_CATEGORIES, and its filename is a `path:` converter so the
# demo/ subdirectory resolves fine.
PHOTO_URL_PREFIX = '/uploads/animals/demo/'

TODAY = datetime.date.today()

# Phone numbers live in one reserved block so they're recognisable at a
# glance and can't be confused with a real registration: 0782 RR PP NN
# (RR role, PP province, NN sequence). Every demo login is this number
# plus DEMO_PASSWORD.
ROLE_CODE = {'Farmer': '10', 'Veterinarian': '20', 'Police': '30',
             'Senior': '39', 'Supplier': '40', 'Buyer': '50'}


def phone(role, province_no, seq):
    return f'0782{ROLE_CODE[role]}{province_no:02d}{seq:02d}'


# ── the ten provinces ────────────────────────────────────────────────────
# district lists match src/components/IntelAI/AuthPortal.jsx's DISTRICTS, so
# a demo account's district is always one the signup form would have offered.
# `id_code` is the leading district code of a Zimbabwe national ID; `lang`
# picks the name pool, since Matabeleland and Bulawayo names should read
# Ndebele and the rest Shona.
PROVINCES = [
    dict(no=1, name='Mashonaland West', abbr='MW', id_code='58', lang='sn',
         districts=['Zvimba', 'Chegutu', 'Makonde'], town='Chinhoyi',
         station='Chegutu Police Station', dip='Nyabira Dip Tank'),
    dict(no=2, name='Mashonaland Central', abbr='MC', id_code='68', lang='sn',
         districts=['Bindura', 'Mazowe', 'Guruve'], town='Bindura',
         station='Bindura Police Station', dip='Chiweshe Dip Tank'),
    dict(no=3, name='Mashonaland East', abbr='ME', id_code='42', lang='sn',
         districts=['Marondera', 'Murehwa', 'Goromonzi'], town='Marondera',
         station='Marondera Police Station', dip='Chihota Dip Tank'),
    dict(no=4, name='Matabeleland North', abbr='MN', id_code='13', lang='nd',
         districts=['Lupane', 'Tsholotsho', 'Nkayi'], town='Lupane',
         station='Lupane Police Station', dip='Gwayi Dip Tank'),
    dict(no=5, name='Matabeleland South', abbr='MS', id_code='21', lang='nd',
         districts=['Gwanda', 'Insiza', 'Matobo'], town='Gwanda',
         station='Gwanda Police Station', dip='Guyu Dip Tank'),
    dict(no=6, name='Midlands', abbr='MD', id_code='29', lang='sn',
         districts=['Gweru', 'Kwekwe', 'Shurugwi'], town='Gweru',
         station='Gweru Central Police Station', dip='Lower Gweru Dip Tank'),
    dict(no=7, name='Manicaland', abbr='MA', id_code='75', lang='sn',
         districts=['Makoni', 'Mutare', 'Nyanga'], town='Mutare',
         station='Mutare Central Police Station', dip='Rusape Dip Tank'),
    dict(no=8, name='Masvingo', abbr='MV', id_code='47', lang='sn',
         districts=['Masvingo', 'Gutu', 'Chivi'], town='Masvingo',
         station='Masvingo Central Police Station', dip='Mushandike Dip Tank'),
    dict(no=9, name='Harare', abbr='HR', id_code='63', lang='sn',
         districts=['Seke Rural', 'Harare Urban', 'Epworth'], town='Harare',
         station='Harare Central Police Station', dip='Seke Dip Tank'),
    dict(no=10, name='Bulawayo', abbr='BY', id_code='08', lang='nd',
         districts=['Umguza', 'Bulawayo Urban'], town='Bulawayo',
         station='Bulawayo Central Police Station', dip='Umguza Dip Tank'),
]

# Two farmers per province, named to match the region.
FARMER_NAMES = {
    1:  [('Tendai Marufu', 'Marufu Family Farm'), ('Rudo Chigumba', 'Chigumba Livestock')],
    2:  [('Farai Madziva', 'Madziva Ranch'), ('Chiedza Runyowa', 'Runyowa Cattle Co.')],
    3:  [('Takudzwa Mabika', 'Mabika Beef Farm'), ('Nyasha Kamusoko', 'Kamusoko Family Herd')],
    4:  [('Sibusiso Nyoni', 'Nyoni Cattle Post'), ('Nomsa Tshuma', 'Tshuma Goat Project')],
    5:  [('Nkosana Mathema', 'Mathema Ranching'), ('Lindiwe Masuku', 'Masuku Livestock')],
    6:  [('Simbarashe Mhaka', 'Mhaka Mixed Farm'), ('Vimbai Zinyemba', 'Zinyemba Herds')],
    7:  [('Tatenda Mavhunga', 'Mavhunga Highland Farm'), ('Panashe Rusike', 'Rusike Beef')],
    8:  [('Munashe Chidziva', 'Chidziva Cattle Ranch'), ('Anesu Nyamutswa', 'Nyamutswa Farm')],
    9:  [('Tafadzwa Mangwiro', 'Mangwiro Peri-Urban Farm'), ('Shingai Dembetembe', 'Dembetembe Dairy & Beef')],
    10: [('Mthokozisi Hadebe', 'Hadebe Livestock'), ('Sindisiwe Gumede', 'Gumede Goat Farm')],
}

# One DVS veterinarian per province.
VET_NAMES = {
    1:  ('Dr Kudzai Mupfumira', 'Tick-borne Diseases'),
    2:  ('Dr Blessing Chitepo', 'Herd Health & Production'),
    3:  ('Dr Tinashe Goto', 'Reproductive Health'),
    4:  ('Dr Bongani Mguni', 'Foot & Mouth Control'),
    5:  ('Dr Zanele Khumalo', 'Small Stock Medicine'),
    6:  ('Dr Tapiwa Gumbo', 'Epidemiology'),
    7:  ('Dr Chipo Mutasa', 'Tick-borne Diseases'),
    8:  ('Dr Simbarashe Zvobgo', 'Nutrition & Metabolic Disease'),
    9:  ('Dr Rutendo Chirwa', 'Dairy Herd Health'),
    10: ('Dr Melusi Sithole', 'Abattoir & Meat Inspection'),
}

# One ZRP Stock Theft Unit officer per province.
POLICE_NAMES = {
    1:  ('Insp. Never Zvavamwe', 'ZRP-STU-1058'),
    2:  ('Sgt. Tonderai Shamu', 'ZRP-STU-1068'),
    3:  ('Insp. Memory Chiweshe', 'ZRP-STU-1042'),
    4:  ('Sgt. Khumbulani Dube', 'ZRP-STU-1013'),
    5:  ('Insp. Thandiwe Ncube', 'ZRP-STU-1021'),
    6:  ('Sgt. Edmore Chirimuuta', 'ZRP-STU-1029'),
    7:  ('Insp. Pardon Nyakudya', 'ZRP-STU-1075'),
    8:  ('Sgt. Loveness Chivasa', 'ZRP-STU-1047'),
    9:  ('Insp. Tarisai Mhondiwa', 'ZRP-STU-1063'),
    10: ('Sgt. Nkosilathi Mpofu', 'ZRP-STU-1008'),
}

SENIOR = dict(
    full_name='Chief Supt. Wellington Muchemwa',
    badge='ZRP-STU-HQ-001',
    station='ZRP Stock Theft Unit — National Headquarters',
    org='ZRP Stock Theft Unit (National)',
)

SUPPLIER = dict(
    full_name='Sibongile Ndlovu',
    org='Zimvet Agro Supplies (Pvt) Ltd',
    province='Harare', district='Harare Urban',
    business_reg='BP-44821/2022',
    categories='Vaccines,Antibiotics,Antiparasitcs,Feed Supplements,Equipment',
)

BUYER = dict(
    full_name='Tapiwa Chigumba',
    org='Highveld Meats (Pvt) Ltd',
    province='Harare', district='Harare Urban',
    business_reg='BP-51907/2021',
)

# ── animal naming ────────────────────────────────────────────────────────
CATTLE_NAMES = {
    'sn': ['Chiedza', 'Mhembwe', 'Tsvarakadenga', 'Muchaneta', 'Shingi', 'Gore',
           'Chenga', 'Dombo', 'Mvura', 'Simba', 'Rima', 'Mwedzi', 'Zuva',
           'Shava', 'Hondo', 'Tsuro', 'Bhuru', 'Mukoma', 'Rudo', 'Nhamo',
           'Danga', 'Gwara', 'Marara', 'Chidhakwa'],
    'nd': ['Nkosi', 'Bhubesi', 'Ingwe', 'Mnyama', 'Zwelakhe', 'Ndaba', 'Langa',
           'Mvelo', 'Sikhona', 'Jabu', 'Thembi', 'Zodwa', 'Inkunzi', 'Mhlophe',
           'Bomvu', 'Sibanda', 'Mthunzi', 'Khwezi', 'Dumo', 'Zulu',
           'Nyathi', 'Impofu', 'Silo', 'Nkomo'],
}
GOAT_NAMES = {
    'sn': ['Mbudzi', 'Kadhoma', 'Nhopi', 'Chihera', 'Tsitsi', 'Nzou', 'Rukudzo',
           'Musasa', 'Pfumo', 'Gonzo', 'Chipo', 'Hwiza', 'Nyenyedzi', 'Kupa',
           'Mbira', 'Nhanga'],
    'nd': ['Imbuzi', 'Sihle', 'Nolwazi', 'Mpilo', 'Zithule', 'Bhekani', 'Sanele',
           'Nhlanhla', 'Thuli', 'Amahle', 'Musa', 'Lwazi', 'Siphiwe', 'Qhawe',
           'Ayanda', 'Zenzo'],
}

CATTLE_BREEDS = ['Brahman', 'Mashona', 'Nguni', 'Tuli', 'Nkone', 'Hereford',
                 'Angus', 'Simmental', 'Sussex', 'Boran']
GOAT_BREEDS = ['Boer', 'Matabele', 'Kalahari Red', 'Savanna', 'Saanen', 'Toggenburg']
# Indigenous breeds dominate communal herds; the exotics are the minority.
CATTLE_BREED_WEIGHTS = [22, 20, 16, 12, 9, 6, 5, 4, 3, 3]
GOAT_BREED_WEIGHTS = [34, 28, 16, 10, 6, 6]

MEDICINES = [
    ('Oxytetracycline (LA)', 'ml', 500, 100, 24.50),
    ('Albendazole 10%', 'ml', 1000, 250, 14.00),
    ('Buparvaquone', 'ml', 120, 40, 86.00),
    ('Amitraz Dip Concentrate', 'ml', 2000, 500, 32.00),
    ('Multivitamin Injection', 'ml', 250, 60, 18.75),
    ('Ivermectin 1%', 'ml', 500, 120, 27.00),
]

SUPPLIER_STOCK = [
    ('Blanthax (Anthrax/Blackleg) Vaccine — 50 dose', 'medicine', 46.00, 'vial', 120,
     'DVS-registered combined anthrax and blackleg vaccine. Cold chain maintained end to end.'),
    ('FMD Vaccine — 25 dose', 'medicine', 88.00, 'vial', 60,
     'Trivalent SAT foot-and-mouth vaccine for use under DVS supervision in control zones.'),
    ('Brucellosis S19 Vaccine — 20 dose', 'medicine', 52.00, 'vial', 45,
     'Heifer calfhood vaccination, 4-8 months. Refrigerated dispatch countrywide.'),
    ('Pulpy Kidney Vaccine — 100ml', 'medicine', 21.50, 'bottle', 150,
     'Enterotoxaemia cover for goats and sheep. Booster annually.'),
    ('Amitraz Dip Concentrate — 1L', 'medicine', 32.00, 'litre', 200,
     'Tick control for plunge dip or spray race. Dilution chart supplied.'),
    ('Oxytetracycline LA — 100ml', 'medicine', 24.50, 'bottle', 180,
     'Long-acting broad spectrum antibiotic. Withdrawal period on label.'),
    ('Beef Grower Pellets — 50kg', 'feed', 29.00, 'bag', 400,
     '16% protein pellet for growing steers on veld supplementation.'),
    ('Survival Meal — 50kg', 'feed', 23.50, 'bag', 500,
     'Dry season survival ration. Keeps condition on breeding cows through October.'),
    ('Cattle Crush Panel Set', 'equipment', 340.00, 'set', 12,
     'Galvanised crush panels and headgate for safe restraint at vaccination.'),
    ('Ear Tag Applicator + 100 Tags', 'equipment', 68.00, 'set', 75,
     'Numbered tags matching the herd register format used in this platform.'),
]


# ── small helpers ────────────────────────────────────────────────────────
def national_id(province, serial, letter):
    """Fabricated but correctly-shaped Zimbabwe national ID — the format
    normalize_zw_national_id() in app.py accepts."""
    return f'{province["id_code"]}-{serial:07d}{letter}{province["id_code"]}'


def weighted_choice(rng, items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def log(msg):
    print(msg, flush=True)


def connect():
    return pymysql.connect(
        host=os.environ.get('PFUMA_DB_HOST', 'localhost'),
        port=int(os.environ.get('PFUMA_DB_PORT', '3306')),
        user=os.environ.get('PFUMA_DB_USER', 'root'),
        password=os.environ.get('PFUMA_DB_PASSWORD', ''),
        database=os.environ.get('PFUMA_DB_NAME', 'pfuma'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
    )


# ── photos ───────────────────────────────────────────────────────────────
def install_photos():
    """Copy the committed demo photos into the uploads tree the API serves
    from. backend/uploads/ is gitignored (it's runtime user data), so the
    assets ship in backend/demo_assets/ and land here at seed time — which
    also means a fresh VPS gets them without a separate upload step."""
    manifest_path = os.path.join(ASSET_DIR, 'manifest.json')
    if not os.path.exists(manifest_path):
        sys.exit(f'missing {manifest_path} — run demo_assets/fetch_livestock_photos.py first')
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)

    os.makedirs(UPLOAD_ANIMAL_DIR, exist_ok=True)
    by_breed, copied = {}, 0
    for key, files in manifest.items():
        species, breed = key.split('|', 1)
        urls = []
        for name in files:
            src = os.path.join(ASSET_DIR, name)
            if not os.path.exists(src):
                continue
            dst = os.path.join(UPLOAD_ANIMAL_DIR, name)
            if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src):
                shutil.copy2(src, dst)
                copied += 1
            urls.append(PHOTO_URL_PREFIX + name)
        if urls:
            by_breed[(species, breed)] = urls
    log(f'  photos: {sum(len(v) for v in by_breed.values())} available '
        f'({copied} copied into uploads/animals/demo/)')
    return by_breed


# ── purge ────────────────────────────────────────────────────────────────
def purge(db):
    """Delete every demo row. Only users carrying DEMO_MARKER are targeted;
    animals, listings, clearances, bids, orders, co-op rows and ratings all
    hang off those users by a cascading foreign key, so they go with them."""
    c = db.cursor()
    c.execute("SELECT COUNT(*) AS n FROM users WHERE avatar_seed = %s", (DEMO_MARKER,))
    n = c.fetchone()['n']
    if not n:
        log('  nothing to purge')
        return 0
    # cooperatives.created_by cascades, but a co-op could in principle hold a
    # non-demo member; the member rows cascade from that side too, so the
    # cooperative row itself is the only thing to remove explicitly.
    c.execute("DELETE FROM users WHERE avatar_seed = %s", (DEMO_MARKER,))
    db.commit()
    log(f'  purged {n} demo accounts and everything hanging off them')
    return n


# ── users ────────────────────────────────────────────────────────────────
def insert_user(c, **f):
    c.execute("""
        INSERT INTO users
          (full_name, phone, national_id_number, email, role, org_name, province,
           district, address, farm_size_ha, species_farmed, license_number,
           speciality, business_reg, supply_categories, trading_areas,
           badge_number, station, jurisdiction_province, officer_tier,
           password_hash, verification_status, verified_by, avatar_seed)
        VALUES (%(full_name)s,%(phone)s,%(national_id_number)s,%(email)s,%(role)s,
                %(org_name)s,%(province)s,%(district)s,%(address)s,%(farm_size_ha)s,
                %(species_farmed)s,%(license_number)s,%(speciality)s,%(business_reg)s,
                %(supply_categories)s,%(trading_areas)s,%(badge_number)s,%(station)s,
                %(jurisdiction_province)s,%(officer_tier)s,%(password_hash)s,
                'verified',%(verified_by)s,%(avatar_seed)s)
    """, {
        'full_name': f['full_name'], 'phone': f['phone'],
        'national_id_number': f.get('national_id_number'), 'email': f.get('email'),
        'role': f['role'], 'org_name': f.get('org_name'), 'province': f.get('province'),
        'district': f.get('district'), 'address': f.get('address'),
        'farm_size_ha': f.get('farm_size_ha'), 'species_farmed': f.get('species_farmed'),
        'license_number': f.get('license_number'), 'speciality': f.get('speciality'),
        'business_reg': f.get('business_reg'), 'supply_categories': f.get('supply_categories'),
        'trading_areas': f.get('trading_areas'), 'badge_number': f.get('badge_number'),
        'station': f.get('station'), 'jurisdiction_province': f.get('jurisdiction_province'),
        'officer_tier': f.get('officer_tier', 'field'),
        'password_hash': DEMO_PASSWORD_HASH, 'verified_by': f.get('verified_by'),
        'avatar_seed': DEMO_MARKER,
    })
    return c.lastrowid


def check_phone_clash(c, phones):
    """Refuse to run if a real account already holds one of the demo numbers.
    Econet really does issue 078 numbers, so the reserved block is a
    convention, not a guarantee — better to stop than to collide."""
    c.execute(
        "SELECT phone, role, full_name FROM users "
        " WHERE phone IN (%s) AND (avatar_seed IS NULL OR avatar_seed <> %s)"
        % (','.join(['%s'] * len(phones)), '%s'),
        (*phones, DEMO_MARKER))
    clashes = c.fetchall()
    if clashes:
        for row in clashes:
            log(f'  !! {row["phone"]} is already {row["full_name"]} ({row["role"]})')
        sys.exit('aborting: a real account holds a demo phone number — '
                 'change the reserved block in ROLE_CODE/phone() first')


def seed_users(c, rng):
    users = {'police': {}, 'vet': {}, 'farmers': {}}

    senior_phone = phone('Senior', 0, 1)
    senior_id = insert_user(
        c, full_name=SENIOR['full_name'], phone=senior_phone,
        national_id_number='63-2100001W00', email='sthq@zrp.gov.zw', role='Police',
        org_name=SENIOR['org'], province='Harare', district='Harare Urban',
        badge_number=SENIOR['badge'], station=SENIOR['station'],
        jurisdiction_province='Harare', officer_tier='national')
    users['senior'] = senior_id
    log(f'  senior officer: {SENIOR["full_name"]}  {senior_phone}')

    for p in PROVINCES:
        name, badge = POLICE_NAMES[p['no']]
        pid = insert_user(
            c, full_name=name, phone=phone('Police', p['no'], 1),
            national_id_number=national_id(p, 3000000 + p['no'], 'P'),
            email=f'stu.{p["abbr"].lower()}@zrp.gov.zw', role='Police',
            org_name='ZRP Stock Theft Unit', province=p['name'],
            district=p['districts'][0], badge_number=badge, station=p['station'],
            jurisdiction_province=p['name'], verified_by=senior_id)
        users['police'][p['no']] = pid

    for p in PROVINCES:
        name, speciality = VET_NAMES[p['no']]
        vid = insert_user(
            c, full_name=name, phone=phone('Veterinarian', p['no'], 1),
            national_id_number=national_id(p, 4000000 + p['no'], 'V'),
            email=f'{name.split()[-1].lower()}@dvs.gov.zw', role='Veterinarian',
            org_name=f'DVS {p["name"]}', province=p['name'], district=p['districts'][0],
            address=f'Provincial Veterinary Office, {p["town"]}',
            license_number=f'DVS-ZIM-2026-{p["no"]:04d}', speciality=speciality,
            verified_by=users['police'][p['no']])
        users['vet'][p['no']] = vid

    for p in PROVINCES:
        users['farmers'][p['no']] = []
        for i, (name, org) in enumerate(FARMER_NAMES[p['no']]):
            district = p['districts'][i % len(p['districts'])]
            fid = insert_user(
                c, full_name=name, phone=phone('Farmer', p['no'], i + 1),
                national_id_number=national_id(p, 1000000 + p['no'] * 100 + i, 'F'),
                email=f'{name.split()[0].lower()}.{name.split()[-1].lower()}@example.co.zw',
                role='Farmer', org_name=org, province=p['name'], district=district,
                address=f'{org}, Ward {rng.randint(3, 24)}, {district}',
                farm_size_ha=rng.choice([12, 18, 24, 35, 40, 55, 70, 90, 120]),
                species_farmed='Cattle,Goat', verified_by=users['police'][p['no']])
            users['farmers'][p['no']].append(fid)

    all_provinces = ','.join(p['name'] for p in PROVINCES)
    users['supplier'] = insert_user(
        c, full_name=SUPPLIER['full_name'], phone=phone('Supplier', 0, 1),
        national_id_number='63-5500001S00',
        email='sales@zimvetagro.co.zw', role='Supplier', org_name=SUPPLIER['org'],
        province=SUPPLIER['province'], district=SUPPLIER['district'],
        address='14 Coventry Road, Workington, Harare',
        business_reg=SUPPLIER['business_reg'], supply_categories=SUPPLIER['categories'],
        trading_areas=all_provinces, verified_by=senior_id)
    users['buyer'] = insert_user(
        c, full_name=BUYER['full_name'], phone=phone('Buyer', 0, 1),
        national_id_number='63-6600001B00',
        email='procurement@highveldmeats.co.zw', role='Buyer', org_name=BUYER['org'],
        province=BUYER['province'], district=BUYER['district'],
        address='Stand 402, Willowvale Industrial Area, Harare',
        business_reg=BUYER['business_reg'], trading_areas=all_provinces,
        verified_by=senior_id)

    log(f'  accounts: {len(PROVINCES) * 2} farmers, {len(PROVINCES)} vets, '
        f'{len(PROVINCES)} police, 1 senior, 1 supplier, 1 buyer')
    return users


# ── animals ──────────────────────────────────────────────────────────────
def herd_for_farmer(rng, p, farmer_no, tag_counter):
    """A herd of 6-9 head, cattle-heavy with a goat flock alongside — the
    mixed smallholder pattern the platform is built around."""
    size = rng.randint(6, 9)
    n_goats = rng.randint(2, max(2, size // 2))
    n_cattle = size - n_goats

    cattle_pool = CATTLE_NAMES[p['lang']][:]
    goat_pool = GOAT_NAMES[p['lang']][:]
    rng.shuffle(cattle_pool)
    rng.shuffle(goat_pool)

    herd = []
    for i in range(n_cattle):
        age_days = rng.randint(200, 2600)
        birth = TODAY - datetime.timedelta(days=age_days)
        birth_weight = round(rng.uniform(27, 39), 1)
        # roughly 0.55 kg/day to a mature plateau, with animal-to-animal spread
        mature = rng.uniform(390, 640)
        current = round(min(mature, birth_weight + age_days * rng.uniform(0.45, 0.62)), 1)
        herd.append(dict(
            name=cattle_pool[i % len(cattle_pool)], species='Cattle',
            breed=weighted_choice(rng, CATTLE_BREEDS, CATTLE_BREED_WEIGHTS),
            birth_date=birth, birth_weight=birth_weight, current_weight=current,
            tag_id=f'ZW-{p["abbr"]}-{next(tag_counter):05d}',
        ))
    for i in range(n_goats):
        age_days = rng.randint(120, 1500)
        birth = TODAY - datetime.timedelta(days=age_days)
        birth_weight = round(rng.uniform(2.4, 4.1), 1)
        mature = rng.uniform(30, 68)
        current = round(min(mature, birth_weight + age_days * rng.uniform(0.045, 0.075)), 1)
        herd.append(dict(
            name=goat_pool[i % len(goat_pool)], species='Goat',
            breed=weighted_choice(rng, GOAT_BREEDS, GOAT_BREED_WEIGHTS),
            birth_date=birth, birth_weight=birth_weight, current_weight=current,
            tag_id=f'ZW-{p["abbr"]}-{next(tag_counter):05d}',
        ))
    return herd


def weight_points(rng, a):
    """Six-ish weighings from birth to now, so the growth chart on the animal
    page has a real curve behind it rather than two endpoints."""
    span = (TODAY - a['birth_date']).days
    n = 6 if span > 400 else 4
    out = []
    for k in range(1, n + 1):
        frac = k / n
        d = a['birth_date'] + datetime.timedelta(days=int(span * frac))
        # growth decelerates, so interpolate on a curve rather than a line
        w = a['birth_weight'] + (a['current_weight'] - a['birth_weight']) * (frac ** 0.72)
        out.append((d.strftime('%b'), round(w * rng.uniform(0.98, 1.02), 1), d))
    out[-1] = (out[-1][0], a['current_weight'], TODAY)
    return out


def administrable(species):
    """Every protocol item that is actually a shot someone gives, whether or
    not it's mandatory.

    Not the same set as protocols.enforceable_vaccines(), and the difference
    matters here. The backend only opens a compliance case for a *mandatory*
    item, but the farmer dashboard counts every vaccine in the species
    protocol as overdue if it was never logged (see overdueVaccines in
    src/App.jsx, over HEALTH_PROTOCOLS in healthData.js). Seeding only the
    mandatory ones left every goat owner showing a red "overdue vaccines"
    tile for Foot Rot and Deworming, which are optional. So log the lot; the
    one dose deliberately left out below is a mandatory one, so it still
    opens a real case.
    """
    return [v for v in protocols.PROTOCOLS.get(species, []) if v['enforceable']]


def vaccination_history(a, skip_vaccine=None):
    """The doses this animal should already have on file.

    Mirrors _due_occurrences() in app.py: for each protocol item, log the most
    recent occurrence with next_due_date set ahead of today, so a seeded
    animal reads as up to date on the farmer's dashboard and in the vet's
    queue alike. Pass skip_vaccine to deliberately leave one outstanding —
    sync_compliance() then opens a real case for it on the next read, which
    is what gives the compliance queue something genuine to show.
    """
    events = []
    for v in administrable(a['species']):
        if v['name'] == skip_vaccine:
            continue
        first_due = a['birth_date'] + datetime.timedelta(days=v['age'])
        if first_due > TODAY:
            continue  # not old enough yet — nothing is overdue either
        if not v['interval_days']:
            events.append((v['name'], first_due, None))  # one-off, never recurs
            continue
        last = first_due
        while last + datetime.timedelta(days=v['interval_days']) <= TODAY:
            last += datetime.timedelta(days=v['interval_days'])
        events.append((v['name'], last, last + datetime.timedelta(days=v['interval_days'])))
    return events


def seed_animals(c, rng, users, photos):
    tag_counters = {}
    animals = {}   # farmer_id -> [ (animal_id, dict) ]
    photo_cursor = {}
    total = 0

    for p in PROVINCES:
        counter = iter(range(rng.randint(140, 900), 99999))
        tag_counters[p['no']] = counter
        vet_id = users['vet'][p['no']]

        for farmer_no, fid in enumerate(users['farmers'][p['no']]):
            initials = ''.join(w[0] for w in FARMER_NAMES[p['no']][farmer_no][0].split()[:2])
            brand = f'{initials.upper()}-{p["abbr"]}'
            herd = herd_for_farmer(rng, p, farmer_no, counter)
            animals[fid] = []

            # One beast in the second farmer's herd per province is left a
            # dose short, so the compliance ladder has live cases to show.
            # It's a head of cattle rather than a goat because cattle carry
            # five enforceable protocol items to a goat's two, which makes
            # the escalation easier to walk an official through.
            # The oldest beast specifically: the last protocol item (CBPP)
            # only falls due at twelve months, so a yearling would have
            # nothing outstanding yet and the province would quietly end up
            # with no case at all.
            overdue = None
            if farmer_no == 1:
                cattle = [a for a in herd if a['species'] == 'Cattle']
                overdue = min(cattle, key=lambda x: x['birth_date']) if cattle else None

            for idx, a in enumerate(herd):
                pool = photos.get((a['species'], a['breed'])) or []
                if pool:
                    k = photo_cursor.get((a['species'], a['breed']), 0)
                    image_url = pool[k % len(pool)]
                    photo_cursor[(a['species'], a['breed'])] = k + 1
                else:
                    image_url = None
                a['image_url'] = image_url

                c.execute("""
                    INSERT INTO animals
                      (owner_id, name, species, breed, birth_date, tag_id, brand_id,
                       birth_weight, current_weight, image_url, for_sale, cost_to_date)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,%s)
                """, (fid, a['name'], a['species'], a['breed'], a['birth_date'],
                      a['tag_id'], brand, a['birth_weight'], a['current_weight'],
                      image_url, round(rng.uniform(40, 260), 2)))
                aid = c.lastrowid
                a['id'] = aid
                animals[fid].append(a)
                total += 1

                for label, kg, on in weight_points(rng, a):
                    c.execute("""INSERT INTO weight_history
                                   (animal_id, month_label, weight_kg, recorded_at)
                                 VALUES (%s,%s,%s,%s)""", (aid, label, kg, on))

                skip = None
                if overdue is not None and a is overdue:
                    enforceable = protocols.enforceable_vaccines(a['species'])
                    if enforceable:
                        skip = enforceable[-1]['name']
                        a['overdue'] = skip
                for vname, done_on, next_due in vaccination_history(a, skip_vaccine=skip):
                    c.execute("""
                        INSERT INTO health_events
                          (animal_id, animal_name, event_type, notes, performed_by,
                           event_date, next_due_date)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                    """, (aid, a['name'], vname,
                          f'Administered at {p["dip"]} during the {p["name"]} round.',
                          vet_id, datetime.datetime.combine(
                              done_on, datetime.time(rng.randint(8, 15), rng.choice([0, 15, 30, 45]))),
                          next_due))

    log(f'  animals: {total} head across {len(PROVINCES) * 2} herds, '
        f'with weight history and protocol vaccination records')
    return animals


# ── marketplace, clearances, trade ───────────────────────────────────────
def price_for(rng, a):
    if a['species'] == 'Cattle':
        return round(float(a['current_weight']) * rng.uniform(1.45, 1.95), -1) or 450
    return round(float(a['current_weight']) * rng.uniform(1.6, 2.4) + 18, 0)


def seed_market(c, rng, users, animals):
    counts = dict(available=0, pending=0, sold=0, bids=0, clearances=0)
    sold_deals = []

    for p in PROVINCES:
        officer = users['police'][p['no']]
        vet_id = users['vet'][p['no']]
        for farmer_no, fid in enumerate(users['farmers'][p['no']]):
            herd = animals[fid]
            # Never list the animal deliberately left short of a dose. Once
            # the compliance ladder reaches a lockout the real API refuses
            # that listing outright (animal_trade_block), so seeding one
            # would misrepresent how the lockout behaves.
            sellable = [a for a in herd if not a.get('overdue')]
            listable = [a for a in sellable if a['species'] == 'Cattle'][:4] or sellable[:4]
            rng.shuffle(listable)

            plan = [('available', 1), ('pending', 1)] if farmer_no == 0 else [('available', 1), ('sold', 1)]
            i = 0
            for kind, n in plan:
                for _ in range(n):
                    if i >= len(listable):
                        break
                    a = listable[i]; i += 1
                    price = price_for(rng, a)
                    title = f'{a["name"]} — {a["breed"]} {a["species"]}'
                    age_months = (TODAY - a['birth_date']).days // 30
                    desc = (f'{age_months // 12}y {age_months % 12}m {a["breed"]} '
                            f'{"bull" if rng.random() < 0.5 else "heifer"}, {a["current_weight"]}kg. '
                            f'Full vaccination record on the digital passport. '
                            f'Dipped at {p["dip"]}. Tag {a["tag_id"]}.')
                    location = f'{FARMER_NAMES[p["no"]][farmer_no][1]}, {p["name"]}'

                    if kind == 'sold':
                        ago = rng.randint(14, 120)
                        when = TODAY - datetime.timedelta(days=ago)
                        c.execute("""
                            INSERT INTO marketplace_listings
                              (user_id, animal_id, product_name, category, price, unit,
                               quantity, location, description, status, photo_url,
                               created_at, sold_at)
                            VALUES (%s,%s,%s,'livestock',%s,'head',1,%s,%s,'sold',%s,%s,%s)
                        """, (fid, a['id'], title, price, location, desc, a.get('image_url'),
                              when - datetime.timedelta(days=9), when))
                        lid = c.lastrowid
                        c.execute("UPDATE animals SET for_sale = FALSE WHERE id = %s", (a['id'],))
                        c.execute("""
                            INSERT INTO bids (listing_id, bidder_id, amount, message, status, created_at)
                            VALUES (%s,%s,%s,%s,'accepted',%s)
                        """, (lid, users['buyer'], price,
                              'Cleared paperwork checked — we will collect from the dip tank.',
                              when - datetime.timedelta(days=2)))
                        counts['bids'] += 1
                        counts['sold'] += 1
                        sold_deals.append((lid, fid, when))
                        status_for_clearance = 'cleared'
                    elif kind == 'available':
                        c.execute("""
                            INSERT INTO marketplace_listings
                              (user_id, animal_id, product_name, category, price, unit,
                               quantity, location, description, status, photo_url, created_at)
                            VALUES (%s,%s,%s,'livestock',%s,'head',1,%s,%s,'available',%s,%s)
                        """, (fid, a['id'], title, price, location, desc, a.get('image_url'),
                              TODAY - datetime.timedelta(days=rng.randint(2, 21))))
                        lid = c.lastrowid
                        c.execute("UPDATE animals SET for_sale = TRUE WHERE id = %s", (a['id'],))
                        counts['available'] += 1
                        status_for_clearance = 'cleared'
                        if rng.random() < 0.55:
                            c.execute("""
                                INSERT INTO bids (listing_id, bidder_id, amount, message, status, created_at)
                                VALUES (%s,%s,%s,%s,'pending',%s)
                            """, (lid, users['buyer'], round(price * rng.uniform(0.88, 0.99), 0),
                                  rng.choice([
                                      'Interested. Can your vet confirm the last FMD date?',
                                      'We can collect this week if the clearance is through.',
                                      'Offering below asking — we are taking four head this round.',
                                  ]), TODAY - datetime.timedelta(days=rng.randint(0, 5))))
                            counts['bids'] += 1
                    else:  # pending clearance
                        c.execute("""
                            INSERT INTO marketplace_listings
                              (user_id, animal_id, product_name, category, price, unit,
                               quantity, location, description, status, photo_url, created_at)
                            VALUES (%s,%s,%s,'livestock',%s,'head',1,%s,%s,'pending_clearance',%s,%s)
                        """, (fid, a['id'], title, price, location, desc, a.get('image_url'),
                              TODAY - datetime.timedelta(days=rng.randint(0, 4))))
                        lid = c.lastrowid
                        counts['pending'] += 1
                        status_for_clearance = 'pending'

                    # The clearance record that goes with it. Communal-area
                    # sellers carry a village-head attestation; the one
                    # commercial farm per province is 'not_applicable'.
                    communal = farmer_no == 0 or p['name'] not in ('Harare', 'Bulawayo')
                    if communal:
                        leader = ('attested', rng.choice(['Sabuku', 'Mambo']),
                                  rng.choice(['Sabuku Mudzingwa', 'Mambo Nembire', 'Sabuku Ncube',
                                              'Mambo Chiweshe', 'Sabuku Dube', 'Mambo Marange']),
                                  f'Ward {rng.randint(3, 24)} Village, {p["districts"][farmer_no % len(p["districts"])]}',
                                  TODAY - datetime.timedelta(days=rng.randint(3, 25)),
                                  f'TA/{p["abbr"]}/{rng.randint(100, 999)}', None)
                    else:
                        leader = ('not_applicable', None, None, None, None, None,
                                  'Commercial farm held on title deed — no traditional authority applies.')

                    resolved = None
                    permit = None
                    if status_for_clearance == 'cleared':
                        resolved = datetime.datetime.combine(
                            TODAY - datetime.timedelta(days=rng.randint(1, 12)),
                            datetime.time(rng.randint(9, 16), 0))
                        permit = f'DVS-MP-2026-{rng.randint(10000, 99999)}'

                    c.execute("""
                        INSERT INTO sale_clearances
                          (animal_id, listing_id, seller_id, status, movement_permit_number,
                           officer_id, notes, leader_clearance, leader_type, leader_name,
                           leader_village, leader_cleared_on, leader_reference, leader_na_reason,
                           livestock_register_no, dip_tank_name, clearance_register_no,
                           vet_officer_id, not_stolen_certified, created_at, resolved_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (a['id'], lid, fid, status_for_clearance, permit,
                          officer if status_for_clearance == 'cleared' else None,
                          ('Ownership and brand verified against the ZRP stock register. '
                           'Cleared for sale.') if status_for_clearance == 'cleared'
                          else 'Awaiting officer inspection at the dip tank.',
                          leader[0], leader[1], leader[2], leader[3], leader[4], leader[5], leader[6],
                          f'LR/{p["abbr"]}/{rng.randint(1000, 9999)}', p['dip'],
                          f'CR/{p["abbr"]}/2026/{rng.randint(100, 999)}' if status_for_clearance == 'cleared' else None,
                          vet_id, status_for_clearance == 'cleared',
                          TODAY - datetime.timedelta(days=rng.randint(2, 20)), resolved))
                    counts['clearances'] += 1

    log('  marketplace: {available} cleared livestock listings, {pending} awaiting '
        'police clearance, {sold} past sales, {bids} bids, {clearances} clearance '
        'records'.format(**counts))
    return sold_deals


def seed_supplier_trade(c, rng, users):
    listing_ids = []
    for name, category, price, unit, qty, desc in SUPPLIER_STOCK:
        c.execute("""
            INSERT INTO marketplace_listings
              (user_id, product_name, category, price, unit, quantity, location,
               description, status, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'available',%s)
        """, (users['supplier'], name, category, price, unit, qty,
              'Harare — delivers countrywide', desc,
              TODAY - datetime.timedelta(days=rng.randint(5, 60))))
        listing_ids.append((c.lastrowid, name, price))

    orders = []
    for p in PROVINCES:
        fid = users['farmers'][p['no']][rng.randint(0, 1)]
        lid, name, price = rng.choice(listing_ids)
        delivered = rng.random() < 0.6
        placed = TODAY - datetime.timedelta(days=rng.randint(6, 45))
        c.execute("""
            INSERT INTO orders (listing_id, farmer_id, supplier_id, quantity, status,
                                created_at, dispatched_at, delivered_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (lid, fid, users['supplier'], rng.randint(1, 6),
              'delivered' if delivered else rng.choice(['pending', 'dispatched']),
              placed,
              placed + datetime.timedelta(days=2) if delivered else None,
              placed + datetime.timedelta(days=5) if delivered else None))
        if delivered:
            orders.append((c.lastrowid, fid))

    for p in PROVINCES:
        for fid in users['farmers'][p['no']]:
            for name, unit, stock, minimum, price in rng.sample(MEDICINES, rng.randint(2, 4)):
                c.execute("""
                    INSERT INTO medicine_inventory
                      (owner_id, medicine_name, stock, unit, min_stock, supplier, price_usd)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (fid, name, round(stock * rng.uniform(0.15, 1.1)), unit, minimum,
                      SUPPLIER['org'], price))

    log(f'  supplier: {len(listing_ids)} product listings, {len(orders)} delivered '
        f'orders (of {len(PROVINCES)} placed), farmer medicine cabinets stocked')
    return orders


def seed_cooperatives(c, rng, users):
    coop_names = {
        'sn': '{town} District Livestock Cooperative',
        'nd': '{town} Stockowners Association',
    }
    n_requests = 0
    for p in PROVINCES:
        members = users['farmers'][p['no']]
        c.execute("""
            INSERT INTO cooperatives (name, description, province, district,
                                      dip_tank_location, created_by, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (coop_names[p['lang']].format(town=p['town']),
              f'Pooled dipping, vaccination rounds and joint marketing for smallholder '
              f'cattle and goat keepers around {p["town"]}.',
              p['name'], p['districts'][0], p['dip'], members[0],
              TODAY - datetime.timedelta(days=rng.randint(200, 900))))
        coop_id = c.lastrowid
        for i, fid in enumerate(members):
            c.execute("""INSERT INTO cooperative_members (cooperative_id, user_id, role)
                         VALUES (%s,%s,%s)""", (coop_id, fid, 'admin' if i == 0 else 'member'))
        for weeks_out in (-2, 2, 6):
            c.execute("""INSERT INTO cooperative_dip_schedule
                           (cooperative_id, scheduled_date, notes, created_by)
                         VALUES (%s,%s,%s,%s)""",
                      (coop_id, TODAY + datetime.timedelta(weeks=weeks_out),
                       f'Plunge dip at {p["dip"]}. Bring the herd register — tags are '
                       f'checked against the platform at the race.', members[0]))
        status = rng.choice(['open', 'claimed', 'completed'])
        c.execute("""
            INSERT INTO cooperative_vet_requests
              (cooperative_id, requested_by, reason, preferred_date, status, vet_id,
               created_at, completed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (coop_id, members[0],
              rng.choice([
                  'Group anthrax/blackleg round for the whole ward before the rains.',
                  'Several calves showing tick-borne symptoms after the last dip.',
                  'Pregnancy diagnosis and herd health check for 40 cows.',
              ]),
              TODAY + datetime.timedelta(days=rng.randint(5, 30)), status,
              None if status == 'open' else users['vet'][p['no']],
              TODAY - datetime.timedelta(days=rng.randint(3, 20)),
              TODAY - datetime.timedelta(days=rng.randint(1, 3)) if status == 'completed' else None))
        n_requests += 1
    log(f'  cooperatives: {len(PROVINCES)} co-ops with members, dip rounds '
        f'and {n_requests} vet requests')


def seed_ratings(c, rng, users, sold_deals, orders):
    """Trust ratings on deals that actually completed — the same shape
    _rateable_deals() in app.py allows, so nothing here is a rating the
    platform itself would not have permitted."""
    n = 0
    comments_buyer = [
        'Papers were in order and the animal matched the passport exactly.',
        'Straightforward seller. Weighed as described at the scale.',
        'Clearance was already through when we arrived — no waiting.',
    ]
    comments_seller = [
        'Paid on collection as agreed.',
        'Professional buyer, transport arranged on time.',
        'Fair price and quick payment.',
    ]
    for lid, fid, _when in sold_deals:
        c.execute("""INSERT IGNORE INTO user_ratings
                       (rater_id, ratee_id, context_type, context_id, stars, comment)
                     VALUES (%s,%s,'sale',%s,%s,%s)""",
                  (users['buyer'], fid, lid, rng.choice([4, 5, 5, 5]), rng.choice(comments_buyer)))
        n += c.rowcount
        c.execute("""INSERT IGNORE INTO user_ratings
                       (rater_id, ratee_id, context_type, context_id, stars, comment)
                     VALUES (%s,%s,'sale',%s,%s,%s)""",
                  (fid, users['buyer'], lid, rng.choice([4, 5, 5]), rng.choice(comments_seller)))
        n += c.rowcount
    for order_id, fid in orders:
        c.execute("""INSERT IGNORE INTO user_ratings
                       (rater_id, ratee_id, context_type, context_id, stars, comment)
                     VALUES (%s,%s,'order',%s,%s,%s)""",
                  (fid, users['supplier'], order_id, rng.choice([3, 4, 5, 5]),
                   rng.choice(['Cold chain held, vaccine arrived usable.',
                               'Delivered to the growth point on time.',
                               'Good price but delivery took longer than quoted.'])))
        n += c.rowcount
    log(f'  ratings: {n} on completed deals')


def seed_notifications(c, users):
    """A handful of unread notifications so the bell isn't empty on first
    login. Only the buyer's own bids, which every account here can see."""
    c.execute("""
        INSERT INTO notifications (user_id, type, title, message, related_user_id, listing_id)
        SELECT ml.user_id, 'bid_placed', 'New bid on your listing',
               CONCAT('A buyer offered $', FORMAT(b.amount, 0), ' for ', ml.product_name),
               b.bidder_id, ml.id
          FROM bids b JOIN marketplace_listings ml ON b.listing_id = ml.id
         WHERE b.status = 'pending' AND b.bidder_id = %s
    """, (users['buyer'],))
    log(f'  notifications: {c.rowcount} pending-bid alerts')


# ── summary ──────────────────────────────────────────────────────────────
def summary(db):
    c = db.cursor()
    c.execute("""SELECT role, COUNT(*) n FROM users
                  WHERE avatar_seed = %s GROUP BY role ORDER BY role""", (DEMO_MARKER,))
    rows = c.fetchall()
    if not rows:
        log('no demo data present')
        return
    log('demo accounts:')
    for r in rows:
        log(f'   {r["role"]:<15} {r["n"]}')
    for label, sql in [
        ('animals', "SELECT COUNT(*) n FROM animals a JOIN users u ON a.owner_id=u.id WHERE u.avatar_seed=%s"),
        ('listings', "SELECT COUNT(*) n FROM marketplace_listings m JOIN users u ON m.user_id=u.id WHERE u.avatar_seed=%s"),
        ('clearances', "SELECT COUNT(*) n FROM sale_clearances s JOIN users u ON s.seller_id=u.id WHERE u.avatar_seed=%s"),
        ('health events', "SELECT COUNT(*) n FROM health_events h JOIN animals a ON h.animal_id=a.id JOIN users u ON a.owner_id=u.id WHERE u.avatar_seed=%s"),
    ]:
        c.execute(sql, (DEMO_MARKER,))
        log(f'   {label:<15} {c.fetchone()["n"]}')


def print_logins():
    log('')
    log(f'Every demo account signs in with the password:  {DEMO_PASSWORD}')
    log('')
    log(f'  {"Province":<21} {"Farmer 1":<12} {"Farmer 2":<12} {"Vet":<12} Police')
    for p in PROVINCES:
        log(f'  {p["name"]:<21} {phone("Farmer", p["no"], 1):<12} '
            f'{phone("Farmer", p["no"], 2):<12} {phone("Veterinarian", p["no"], 1):<12} '
            f'{phone("Police", p["no"], 1)}')
    log('')
    log(f'  Senior officer (national)   {phone("Senior", 0, 1)}')
    log(f'  Supplier                    {phone("Supplier", 0, 1)}')
    log(f'  Buyer                       {phone("Buyer", 0, 1)}')


# ── main ─────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--reset', action='store_true', help='delete existing demo data first')
    ap.add_argument('--purge', action='store_true', help='delete demo data and stop')
    ap.add_argument('--summary', action='store_true', help='report what is seeded and stop')
    ap.add_argument('--seed', type=int, default=20260928,
                    help='RNG seed — the same value reproduces the same herds')
    args = ap.parse_args()

    db = connect()
    try:
        if args.summary:
            summary(db)
            return
        if args.purge or args.reset:
            log('purging demo data...')
            purge(db)
            if args.purge:
                return

        c = db.cursor()
        c.execute("SELECT COUNT(*) n FROM users WHERE avatar_seed = %s", (DEMO_MARKER,))
        if c.fetchone()['n']:
            log('demo data is already present — run with --reset to rebuild it')
            summary(db)
            print_logins()
            return

        rng = random.Random(args.seed)
        log('seeding demo data...')
        photos = install_photos()

        wanted = [phone('Senior', 0, 1), phone('Supplier', 0, 1), phone('Buyer', 0, 1)]
        for p in PROVINCES:
            wanted += [phone('Police', p['no'], 1), phone('Veterinarian', p['no'], 1),
                       phone('Farmer', p['no'], 1), phone('Farmer', p['no'], 2)]
        check_phone_clash(c, wanted)

        users = seed_users(c, rng)
        animals = seed_animals(c, rng, users, photos)
        sold_deals = seed_market(c, rng, users, animals)
        orders = seed_supplier_trade(c, rng, users)
        seed_cooperatives(c, rng, users)
        seed_ratings(c, rng, users, sold_deals, orders)
        seed_notifications(c, users)
        db.commit()
        log('done.')
        print_logins()
    finally:
        db.close()


if __name__ == '__main__':
    main()
