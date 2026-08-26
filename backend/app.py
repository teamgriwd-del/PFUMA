import os
import re
import json
import glob
import math
import random
import secrets
import functools
import datetime

from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename
import pymysql
import bcrypt
import jwt

import protocols

app = Flask(__name__)

# ── CONFIG ───────────────────────────────────────────────────────
# PFUMA_ENV gates every production-only hardening default below. Anything
# reachable from the internet MUST run with PFUMA_ENV=production set —
# treat "forgot to set this" as the expected failure mode and default
# every check to the safe (locked-down) behaviour, not the convenient one.
IS_PRODUCTION = os.environ.get('PFUMA_ENV', 'development').lower() == 'production'

SECRET_KEY = os.environ.get('PFUMA_SECRET_KEY')
if not SECRET_KEY:
    if IS_PRODUCTION:
        raise RuntimeError(
            "PFUMA_SECRET_KEY is not set. Refusing to start in production without it — "
            "this key signs every login session; a guessable or shared default lets "
            "anyone forge a session for any account, including Admin."
        )
    # Local dev only: a fresh random secret per process. Unlike a hardcoded
    # string, this is never the same value twice and is never sitting in
    # the (public) repo, so it can't be used to forge tokens — the only
    # cost is that restarting the dev server invalidates existing sessions.
    SECRET_KEY = secrets.token_hex(32)
    print("[WARNING] PFUMA_SECRET_KEY not set — using a random one-time dev secret. "
          "Sessions won't survive a restart. Set PFUMA_SECRET_KEY before deploying.")

TOKEN_TTL_HOURS = 24 * 7  # 1 week

# CORS: restrict to known frontend origins in production; permissive for
# local dev across the usual Vite/Expo ports so nothing here blocks testing.
_default_dev_origins = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:8081,http://localhost:19006"
)
_allowed_origins = os.environ.get('PFUMA_ALLOWED_ORIGINS', _default_dev_origins).split(',')
CORS(app, resources={r"/*": {"origins": [o.strip() for o in _allowed_origins if o.strip()]}})

# Cap request/upload size so a huge file can't fill the disk or exhaust
# memory — one animal/listing photo or ID document, generously sized.
app.config['MAX_CONTENT_LENGTH'] = 15 * 1024 * 1024  # 15 MB

limiter = Limiter(get_remote_address, app=app, storage_uri="memory://", default_limits=[])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_DOC_EXT = {'.pdf', '.jpg', '.jpeg', '.png'}
ALLOWED_IMG_EXT = {'.jpg', '.jpeg', '.png', '.webp'}
# Messenger attachments — images plus common documents (a health passport
# scan, a movement permit) since a chat attachment isn't always a photo.
ALLOWED_ATTACHMENT_EXT = ALLOWED_IMG_EXT | {'.pdf', '.doc', '.docx'}

# Roles that are not self-service — provisioned by an existing Police officer.
ADMIN_PROVISIONED_ROLES = {'Police'}

# Self-signup only ever creates these roles. Anything else (Police — see
# above — or the hidden Admin oversight role) is rejected with the same
# generic message, so probing the API with an unexpected role value never
# confirms whether that role even exists.
ALLOWED_SELF_SIGNUP_ROLES = {'Farmer', 'Veterinarian', 'Supplier', 'Retailer'}

# Stock photo used only when a Farmer skips the photo-upload step — mirrors
# src/App.jsx's IMAGE_BY_SPECIES so web/mobile show the same fallback.
SPECIES_STOCK_IMAGES = {
    'Cattle': 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&q=80&w=800',
    'Goat':   'https://images.unsplash.com/photo-1524024973431-2ad916746881?auto=format&fit=crop&q=80&w=800',
    'Sheep':  'https://images.unsplash.com/photo-1484557985045-edf25e08da73?auto=format&fit=crop&q=80&w=800',
    'Pig':    'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800',
}

# ── ZIMBABWE-SPECIFIC FORMAT VALIDATION ─────────────────────────────
# Mobile prefixes per POTRAZ's national numbering plan: Econet 077/078,
# NetOne 071, Telecel 073. Accepts local (077...) or international
# (+263 77... / 26377...) form and normalises to the local 0-prefixed form.
ZW_MOBILE_PREFIXES = ('071', '073', '077', '078')


def normalize_zw_phone(raw):
    """Returns the normalized '0XXXXXXXXX' form of a Zimbabwean mobile
    number, or None if it isn't a recognized Zimbabwean mobile format.
    Landlines (province area codes, not 07x-mobile) are out of scope —
    PFUMA accounts are expected to be reachable by SMS/call for
    verification, same as the rest of the signup flow."""
    digits = re.sub(r'\D', '', raw or '')
    if digits.startswith('263'):
        digits = '0' + digits[3:]
    elif digits.startswith('0'):
        pass
    elif len(digits) == 9:
        digits = '0' + digits
    if len(digits) != 10 or not digits.startswith(ZW_MOBILE_PREFIXES):
        return None
    return digits


# Zimbabwe national ID format: NN-NNNNNNN L NN (district code - serial -
# check letter - citizenship code), e.g. "63-1234567A00". Serial length
# varies 4-7 digits across older/newer IDs. This checks STRUCTURE only —
# the check-letter's underlying computation isn't publicly documented
# anywhere we could verify, so we deliberately don't pretend to validate
# it mathematically; format-checking still catches typos and made-up
# numbers, and Police/Vet reviewers cross-check the uploaded ID photo
# against the typed number during verification.
ZW_ID_RE = re.compile(r'^(\d{2})[\s-]?(\d{4,7})[\s-]?([A-Za-z])[\s-]?(\d{2})$')


def normalize_zw_national_id(raw):
    """Returns the canonical 'NN-NNNNNNNL NN' form, or None if the input
    doesn't match the Zimbabwe national ID structure."""
    if not raw:
        return None
    m = ZW_ID_RE.match(raw.strip())
    if not m:
        return None
    district, serial, letter, citizenship = m.groups()
    return f"{district}-{serial}{letter.upper()}{citizenship}"


def get_db():
    return pymysql.connect(
        host=os.environ.get('PFUMA_DB_HOST', 'localhost'),
        port=int(os.environ.get('PFUMA_DB_PORT', '3306')),
        user=os.environ.get('PFUMA_DB_USER', 'root'),
        password=os.environ.get('PFUMA_DB_PASSWORD', ''),
        database=os.environ.get('PFUMA_DB_NAME', 'pfuma'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )


def ensure_schema():
    """Creates tables added after the first release, if they don't already
    exist. CREATE TABLE IF NOT EXISTS is a no-op against an up-to-date
    database, so this is safe to run on every startup — it exists so a
    production database doesn't need a manual schema.sql re-import (and the
    credentials that would require) just to pick up a new feature's tables.
    Mirrors the full DDL in schema.sql; keep both in sync."""
    db = get_db()
    c = db.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          user_id         INT NOT NULL,
          type            VARCHAR(40) NOT NULL,
          title           VARCHAR(150) NOT NULL,
          message         VARCHAR(300) NOT NULL,
          related_user_id INT NULL,
          listing_id      INT NULL,
          animal_id       INT NULL,
          read_at         TIMESTAMP NULL,
          created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id)         REFERENCES users(id)                 ON DELETE CASCADE,
          FOREIGN KEY (related_user_id) REFERENCES users(id)                 ON DELETE SET NULL,
          FOREIGN KEY (listing_id)      REFERENCES marketplace_listings(id)  ON DELETE SET NULL,
          FOREIGN KEY (animal_id)       REFERENCES animals(id)               ON DELETE SET NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS animal_photos (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          animal_id  INT NOT NULL,
          image_url  VARCHAR(300) NOT NULL,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS geofences (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          owner_id    INT NOT NULL,
          name        VARCHAR(120) NOT NULL,
          center_lat  DECIMAL(9,6) NOT NULL,
          center_lon  DECIMAL(9,6) NOT NULL,
          radius_m    INT NOT NULL,
          created_by  INT NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id)   REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS medication_recommendations (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          animal_id      INT NOT NULL,
          farmer_id      INT NOT NULL,
          vet_id         INT NOT NULL,
          medicine_name  VARCHAR(120) NOT NULL,
          dose_ml        DECIMAL(8,2) NOT NULL,
          frequency      VARCHAR(100),
          notes          TEXT,
          status         ENUM('pending','administered','declined') DEFAULT 'pending',
          created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          administered_at TIMESTAMP NULL,
          FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
          FOREIGN KEY (farmer_id) REFERENCES users(id)   ON DELETE CASCADE,
          FOREIGN KEY (vet_id)    REFERENCES users(id)   ON DELETE CASCADE
        )
    """)

    # Column-level upgrades for tables that already existed on some deployed
    # database (CREATE TABLE IF NOT EXISTS is a no-op against those, so a
    # column added after first release never lands without this).
    #
    # `ADD COLUMN IF NOT EXISTS` is a MariaDB-only extension — plain MySQL
    # (which is what's actually running here) rejects it outright with a
    # syntax error, which silently no-opped every one of these on every
    # startup until this was caught. Checking information_schema first and
    # only running a plain ALTER when the column is truly missing works on
    # both engines.
    def add_column_if_missing(table, column, ddl):
        c.execute("""
            SELECT COUNT(*) AS n FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = %s AND column_name = %s
        """, (table, column))
        if c.fetchone()['n'] == 0:
            try:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")
            except Exception as e:
                print(f"[WARNING] could not add {table}.{column}: {e}")

    add_column_if_missing('sale_clearances', 'leader_clearance', "leader_clearance ENUM('attested','not_applicable') NULL")
    add_column_if_missing('sale_clearances', 'leader_type', "leader_type ENUM('Sabuku','Mambo') NULL")
    add_column_if_missing('sale_clearances', 'leader_name', "leader_name VARCHAR(120)")
    add_column_if_missing('sale_clearances', 'leader_village', "leader_village VARCHAR(120)")
    add_column_if_missing('sale_clearances', 'leader_cleared_on', "leader_cleared_on DATE")
    add_column_if_missing('sale_clearances', 'leader_reference', "leader_reference VARCHAR(80)")
    add_column_if_missing('sale_clearances', 'leader_document_path', "leader_document_path VARCHAR(300)")
    add_column_if_missing('sale_clearances', 'leader_na_reason', "leader_na_reason VARCHAR(200)")

    add_column_if_missing('users', 'account_status', "account_status ENUM('active','suspended') NOT NULL DEFAULT 'active'")
    add_column_if_missing('users', 'suspension_reason', "suspension_reason VARCHAR(300)")
    add_column_if_missing('users', 'avatar_url', "avatar_url VARCHAR(300)")
    add_column_if_missing('users', 'requested_by', "requested_by INT NULL")

    add_column_if_missing('marketplace_listings', 'photo_url', "photo_url VARCHAR(300)")
    add_column_if_missing('marketplace_listings', 'sold_at', "sold_at TIMESTAMP NULL")

    add_column_if_missing('health_events', 'next_due_date', "next_due_date DATE")

    add_column_if_missing('conversation_messages', 'attachment_url', "attachment_url VARCHAR(300)")
    add_column_if_missing('conversation_messages', 'attachment_name', "attachment_name VARCHAR(150)")

    db.commit()
    db.close()


try:
    ensure_schema()
except Exception as e:
    # Don't crash the whole API over a schema bootstrap failure — the app is
    # still useful for everything that doesn't touch these two new tables,
    # and this is loud in the logs either way.
    print(f"[WARNING] ensure_schema() failed: {e}")


# ── AUTH HELPERS ─────────────────────────────────────────────────
def issue_token(user):
    payload = {
        'user_id': user['id'],
        'role': user['role'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header[len('Bearer '):]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired — please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid session token"}), 401

        db = get_db()
        c = db.cursor()
        c.execute("SELECT * FROM users WHERE id = %s", (payload['user_id'],))
        user = c.fetchone()
        db.close()
        if not user:
            return jsonify({"error": "User no longer exists"}), 401
        if user['account_status'] == 'suspended':
            return jsonify({"error": "This account has been suspended.", "reason": user.get('suspension_reason')}), 403
        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def require_role(*roles):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if g.current_user['role'] not in roles:
                return jsonify({"error": f"This action requires one of: {', '.join(roles)}"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(fn):
    """Like require_role('Admin'), but returns a generic 404 instead of a
    403 — the whole point of the hidden Admin role is that a non-admin (or
    someone probing the API) can't tell /admin/* exists at all, let alone
    that it's gated behind a role called Admin."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if g.current_user['role'] != 'Admin':
            return jsonify({"error": "Not found"}), 404
        return fn(*args, **kwargs)
    return wrapper


def require_verified(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if g.current_user['verification_status'] != 'verified':
            return jsonify({"error": "Your account is still pending verification. This action is unlocked once Police/DVS review is complete."}), 403
        return fn(*args, **kwargs)
    return wrapper


def public_user_view(user, requester):
    """Redacts a user row to what `requester` is allowed to see about `user`."""
    is_self = requester and requester['id'] == user['id']
    is_police = requester and requester['role'] == 'Police'
    is_reviewing_vet = (
        requester and requester['role'] == 'Veterinarian'
        and requester['verification_status'] == 'verified'
        and user['role'] == 'Veterinarian'
    )
    full_access = is_self or is_police or is_reviewing_vet

    base = {
        'id': user['id'], 'full_name': user['full_name'], 'role': user['role'],
        'org_name': user['org_name'], 'province': user['province'], 'district': user['district'],
        'avatar_url': user.get('avatar_url'),
    }
    # Business-facing roles publish contact info as part of their function on the
    # platform; Farmers and Police do not (contact happens via listings/messenger).
    if user['role'] in ('Veterinarian', 'Supplier', 'Retailer'):
        base['phone'] = user['phone']
        base['speciality'] = user.get('speciality')
        base['supply_categories'] = user.get('supply_categories')
        base['trading_areas'] = user.get('trading_areas')

    if full_access:
        base.update({
            'phone': user['phone'], 'email': user['email'], 'address': user['address'],
            'farm_size_ha': user.get('farm_size_ha'), 'species_farmed': user.get('species_farmed'),
            'license_number': user.get('license_number'), 'business_reg': user.get('business_reg'),
            'badge_number': user.get('badge_number'), 'station': user.get('station'),
            'jurisdiction_province': user.get('jurisdiction_province'),
            'verification_status': user.get('verification_status'),
            'verification_notes': user.get('verification_notes'),
            'created_at': str(user.get('created_at')),
        })
    return base


def save_upload(file_storage, user_id, doctype):
    """Saves an uploaded document under uploads/<user_id>/<doctype><ext> and
    returns the relative path stored in the DB."""
    if not file_storage or not file_storage.filename:
        return None
    ext = os.path.splitext(secure_filename(file_storage.filename))[1].lower()
    if ext not in ALLOWED_DOC_EXT:
        raise ValueError(f"Unsupported file type '{ext}' — use PDF, JPG, or PNG")
    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{doctype}{ext}"
    file_storage.save(os.path.join(user_dir, filename))
    return f"{user_id}/{filename}"


def save_photo(file_storage, category, entity_id, allowed_ext=None, suffix=None):
    """Saves an uploaded animal/listing/attachment/avatar photo under
    uploads/<category>/<entity_id><ext> (or <entity_id>_<suffix><ext> when a
    suffix is given, so one animal can carry more than one photo without
    each new upload overwriting the last) and returns the relative path
    stored in the DB (served publicly, unlike save_upload's private
    id/credential documents). allowed_ext defaults to images only; pass a
    wider set (e.g. ALLOWED_ATTACHMENT_EXT) for callers that accept
    documents too."""
    if not file_storage or not file_storage.filename:
        return None
    allowed_ext = allowed_ext or ALLOWED_IMG_EXT
    ext = os.path.splitext(secure_filename(file_storage.filename))[1].lower()
    if ext not in allowed_ext:
        raise ValueError(f"Unsupported file type '{ext}' — use {', '.join(sorted(e.lstrip('.').upper() for e in allowed_ext))}")
    category_dir = os.path.join(UPLOAD_DIR, category)
    os.makedirs(category_dir, exist_ok=True)
    filename = f"{entity_id}_{suffix}{ext}" if suffix else f"{entity_id}{ext}"
    file_storage.save(os.path.join(category_dir, filename))
    return f"{category}/{filename}"


def animal_photos(c, animal_id):
    """Every extra photo for one animal, in display order."""
    c.execute("SELECT id, image_url FROM animal_photos WHERE animal_id=%s ORDER BY sort_order, id", (animal_id,))
    return c.fetchall()


def animal_photo_urls(c, animal, animal_id=None):
    """The full gallery for one animal: animal_photos rows, falling back to
    the cover image_url alone when no extra photos have been added yet —
    never an empty gallery for an animal that does have a cover photo."""
    urls = [p['image_url'] for p in animal_photos(c, animal_id or animal['id'])]
    if not urls and animal.get('image_url'):
        urls = [animal['image_url']]
    return urls


def create_notification(c, user_id, ntype, title, message, related_user_id=None, listing_id=None, animal_id=None):
    """Writes one real notification row. Call with the same cursor/connection
    as the triggering write so it commits in the same transaction — a
    notification that outlives the event it describes (or vanishes with it
    on rollback) would be worse than not having one."""
    c.execute("""
        INSERT INTO notifications (user_id, type, title, message, related_user_id, listing_id, animal_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (user_id, ntype, title, message, related_user_id, listing_id, animal_id))


# ── HEALTH CHECK ──────────────────────────────────────────────
@app.route('/')
def home():
    return jsonify({"message": "PFUMA API is running ✅", "version": "3.0"})


# ── AUTHENTICATION ───────────────────────────────────────────────
@app.route('/auth/register', methods=['POST'])
@limiter.limit("10 per hour")
def register():
    d = request.form
    role = d.get('role', 'Farmer')
    if role not in ALLOWED_SELF_SIGNUP_ROLES:
        return jsonify({"error": "Police accounts are provisioned by an existing verified officer, not self-service. Contact ZRP/DVS liaison."}), 403

    full_name = d.get('full_name', '').strip()
    phone_raw = d.get('phone', '').strip()
    national_id_raw = d.get('national_id_number', '').strip()
    password = d.get('password', '')
    if not full_name or not phone_raw or len(password) < 8:
        return jsonify({"error": "full_name, phone, and a password of at least 8 characters are required"}), 400

    phone = normalize_zw_phone(phone_raw)
    if not phone:
        return jsonify({"error": "Enter a valid Zimbabwean mobile number (Econet 077/078, NetOne 071, or Telecel 073), e.g. 077 123 4567 or +263 77 123 4567."}), 400

    national_id = None
    if national_id_raw:
        national_id = normalize_zw_national_id(national_id_raw)
        if not national_id:
            return jsonify({"error": "National ID number doesn't match the Zimbabwe format, e.g. 63-1234567A00 (district-serial-checkletter-citizenship code)."}), 400
    elif role not in ADMIN_PROVISIONED_ROLES:
        return jsonify({"error": "National ID number is required for signup verification."}), 400

    db = get_db()
    c = db.cursor()
    # One phone number can hold a separate account per role — a real person
    # is often a Farmer *and* a Supplier, say — each with its own password,
    # since a phone number identifies a person, not a single account. What's
    # not allowed is two accounts with the *same* phone and the *same* role,
    # which would just be an ambiguous duplicate at login time.
    c.execute("SELECT id FROM users WHERE phone = %s AND role = %s", (phone, role))
    if c.fetchone():
        db.close()
        return jsonify({"error": f"You already have a {role} account with this phone number. Log in, or sign up with a different role."}), 409

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    c.execute("""
        INSERT INTO users (full_name, phone, national_id_number, email, role, org_name, province, district, address,
            farm_size_ha, species_farmed, license_number, speciality, business_reg, supply_categories,
            trading_areas, password_hash, verification_status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
    """, (
        full_name, phone, national_id, d.get('email', ''), role,
        d.get('org_name', ''), d.get('province', ''), d.get('district', ''), d.get('address', ''),
        d.get('farm_size_ha') or None, d.get('species_farmed', ''),
        d.get('license_number', ''), d.get('speciality', ''),
        d.get('business_reg', ''), d.get('supply_categories', ''), d.get('trading_areas', ''),
        password_hash,
    ))
    user_id = c.lastrowid

    try:
        id_path = save_upload(request.files.get('id_document'), user_id, 'id')
        cred_path = save_upload(request.files.get('credential_document'), user_id, 'credential')
        if id_path or cred_path:
            c.execute("UPDATE users SET id_document_path=%s, credential_document_path=%s WHERE id=%s",
                      (id_path, cred_path, user_id))
    except ValueError as e:
        db.rollback(); db.close()
        return jsonify({"error": str(e)}), 400

    db.commit()
    c.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = c.fetchone()
    db.close()
    return jsonify({
        "token": issue_token(user),
        "user": public_user_view(user, user),
        "message": "Account created — pending verification review before you get full access."
    }), 201


@app.route('/auth/login', methods=['POST'])
@limiter.limit("15 per 5 minutes")
def login():
    d = request.json or {}
    phone = normalize_zw_phone(d.get('phone', '')) or d.get('phone', '').strip()
    password = d.get('password', '')
    db = get_db()
    c = db.cursor()
    # A phone number can hold one account per role (see register()), so more
    # than one row can share this phone — the password is what picks which
    # role account to log into, not the phone alone.
    c.execute("SELECT * FROM users WHERE phone = %s", (phone,))
    candidates = c.fetchall()
    db.close()
    user = next(
        (u for u in candidates if u['password_hash'] and bcrypt.checkpw(password.encode(), u['password_hash'].encode())),
        None
    )
    if not user:
        return jsonify({"error": "Invalid phone number or password"}), 401
    if user['account_status'] == 'suspended':
        return jsonify({"error": "This account has been suspended.", "reason": user.get('suspension_reason')}), 403
    return jsonify({"token": issue_token(user), "user": public_user_view(user, user)})


@app.route('/auth/me', methods=['GET'])
@require_auth
def me():
    return jsonify(public_user_view(g.current_user, g.current_user))


# ── SIGNUP VERIFICATION QUEUE ─────────────────────────────────────
@app.route('/verifications', methods=['GET'])
@require_auth
def get_verifications():
    requester = g.current_user
    status = request.args.get('status', 'pending')
    db = get_db()
    c = db.cursor()
    if requester['role'] == 'Police' and requester['verification_status'] == 'verified':
        # Police-role applicants are excluded — only Admin can resolve those
        # (see resolve_verification), so listing them here would show a
        # pending officer with no action this viewer is allowed to take.
        c.execute("SELECT id, full_name, role, org_name, province, id_document_path, credential_document_path, created_at "
                   "FROM users WHERE verification_status=%s AND role NOT IN ('Veterinarian','Admin','Police') ORDER BY created_at ASC", (status,))
    elif requester['role'] == 'Veterinarian' and requester['verification_status'] == 'verified':
        c.execute("SELECT id, full_name, role, org_name, province, id_document_path, credential_document_path, created_at "
                   "FROM users WHERE verification_status=%s AND role='Veterinarian' AND id != %s ORDER BY created_at ASC",
                   (status, requester['id']))
    else:
        db.close()
        return jsonify({"error": "Only Police (or a verified Veterinarian reviewing peers) can view this queue"}), 403
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/verifications/<int:user_id>', methods=['PATCH'])
@require_auth
def resolve_verification(user_id):
    requester = g.current_user
    d = request.json or {}
    verification_status = d.get('verification_status')
    if verification_status not in ('verified', 'rejected'):
        return jsonify({"error": "verification_status must be 'verified' or 'rejected'"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT role FROM users WHERE id=%s", (user_id,))
    target = c.fetchone()
    if not target:
        db.close(); return jsonify({"error": "User not found"}), 404

    # A Police applicant can only be resolved by Admin — a fellow officer
    # approving their own peer is exactly the unilateral-fraud path this is
    # meant to close, so it's carved out of the general Police branch below
    # even though Police otherwise reviews every other role's signups.
    authorized = (
        requester['role'] == 'Admin' or
        (requester['role'] == 'Police' and requester['verification_status'] == 'verified'
         and target['role'] not in ('Veterinarian', 'Police')) or
        (requester['role'] == 'Veterinarian' and requester['verification_status'] == 'verified' and target['role'] == 'Veterinarian')
    )
    if not authorized:
        db.close(); return jsonify({"error": "You are not authorized to review this applicant"}), 403

    c.execute("UPDATE users SET verification_status=%s, verified_by=%s, verification_notes=%s WHERE id=%s",
              (verification_status, requester['id'], d.get('verification_notes'), user_id))
    db.commit()
    db.close()
    return jsonify({"verification_status": verification_status, "message": f"Applicant {verification_status} ✅"})


@app.route('/documents/<int:user_id>/<doctype>', methods=['GET'])
@require_auth
def get_document(user_id, doctype):
    if doctype not in ('id', 'credential'):
        return jsonify({"error": "doctype must be 'id' or 'credential'"}), 400
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    c.execute("SELECT role, id_document_path, credential_document_path FROM users WHERE id=%s", (user_id,))
    target = c.fetchone()
    db.close()
    if not target:
        return jsonify({"error": "User not found"}), 404

    allowed = (
        requester['id'] == user_id or
        requester['role'] == 'Police' or
        (requester['role'] == 'Veterinarian' and requester['verification_status'] == 'verified' and target['role'] == 'Veterinarian')
    )
    if not allowed:
        return jsonify({"error": "Not authorized to view this document"}), 403

    path = target['id_document_path'] if doctype == 'id' else target['credential_document_path']
    if not path:
        return jsonify({"error": "No document on file"}), 404
    # path is stored as "<user_id>/<filename>" — serve relative to UPLOAD_DIR only.
    directory, filename = os.path.split(path)
    return send_from_directory(os.path.join(UPLOAD_DIR, directory), filename)


# Animal/listing photos — publicly viewable (unlike the private id/credential
# documents above), same as a stock product photo would be on any marketplace.
@app.route('/uploads/<category>/<path:filename>', methods=['GET'])
def get_photo(category, filename):
    if category not in ('animals', 'listings', 'avatars'):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(os.path.join(UPLOAD_DIR, category), filename)


# Message attachments are private conversation content (not a public
# marketplace photo) and their filenames are just <message_id><ext> —
# trivially guessable sequential ids — so unlike get_photo above, this
# requires auth and checks the requester actually took part in the
# conversation that message belongs to.
@app.route('/attachments/<int:msg_id>', methods=['GET'])
@require_auth
def get_attachment(msg_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT conversation_id, attachment_url FROM conversation_messages WHERE id=%s", (msg_id,))
    msg = c.fetchone()
    if not msg or not msg['attachment_url']:
        db.close(); return jsonify({"error": "Not found"}), 404
    conv = _conversation_participant_or_404(c, msg['conversation_id'], g.current_user['id'])
    db.close()
    if not conv:
        return jsonify({"error": "Not found"}), 404
    # Saved as "<msg_id><ext>" by save_photo(); attachment_url is the stable
    # /attachments/<id> route, not the filename, so the real extension is
    # looked up on disk rather than assumed.
    matches = glob.glob(os.path.join(UPLOAD_DIR, 'attachments', f'{msg_id}.*'))
    if not matches:
        return jsonify({"error": "Not found"}), 404
    directory, filename = os.path.split(matches[0])
    return send_from_directory(directory, filename)


# ── USERS ─────────────────────────────────────────────────────
@app.route('/users', methods=['GET'])
@require_auth
def get_users():
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    role = request.args.get('role')
    province = request.args.get('province')
    q = request.args.get('q', '')
    sql = "SELECT * FROM users WHERE 1=1"
    params = []
    if role:
        sql += " AND role = %s"; params.append(role)
    if province:
        sql += " AND province = %s"; params.append(province)
    if q:
        # Matches name, business/farm name, province, or phone — phone match
        # uses the same digit-normalization as signup so "077 123 4567",
        # "+263771234567" etc. all find the same account.
        q_digits = re.sub(r'\D', '', q)
        sql += " AND (full_name LIKE %s OR org_name LIKE %s OR province LIKE %s"
        params += [f'%{q}%', f'%{q}%', f'%{q}%']
        if q_digits:
            sql += " OR phone LIKE %s"
            params.append(f'%{q_digits}%')
        sql += ")"
    # Police officers aren't listed in the general directory — they're reached
    # only through the clearance/verification workflow, not public search.
    if requester['role'] != 'Police':
        sql += " AND role != 'Police'"
    # Admin is never listed here for anyone, including other admins — the
    # hidden oversight role has its own dedicated /admin/* endpoints.
    sql += " AND role != 'Admin'"
    c.execute(sql, params)
    users = c.fetchall()
    db.close()
    return jsonify([public_user_view(u, requester) for u in users])


@app.route('/users', methods=['POST'])
@require_auth
@require_role('Police')
@require_verified
def create_user():
    """An existing officer nominates a new Police account (Police signups
    are not self-service). This does NOT verify the account — a single
    officer being able to unilaterally mint other verified officer accounts
    is exactly the fraud risk this closes. The account sits pending, with
    requested_by recording who nominated them, until PFUMA Admin reviews
    and approves it via PATCH /verifications/<id> (see resolve_verification,
    which only allows Admin to resolve a Police applicant, not another
    officer)."""
    d = request.json or {}
    full_name = (d.get('full_name') or '').strip()
    if not full_name:
        return jsonify({"error": "full_name is required"}), 400

    phone = normalize_zw_phone(d.get('phone', ''))
    if not phone:
        return jsonify({"error": "Enter a valid Zimbabwean mobile number (Econet 077/078, NetOne 071, or Telecel 073), e.g. 077 123 4567."}), 400

    national_id = normalize_zw_national_id(d.get('national_id_number', ''))
    if not national_id:
        return jsonify({"error": "National ID number doesn't match the Zimbabwe format, e.g. 63-1234567A00."}), 400

    if not (d.get('badge_number') or '').strip():
        return jsonify({"error": "badge_number is required for a Police account"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM users WHERE phone = %s", (phone,))
    if c.fetchone():
        db.close()
        return jsonify({"error": "An account with this phone number already exists"}), 409

    password_hash = bcrypt.hashpw((d.get('password') or os.urandom(8).hex()).encode(), bcrypt.gensalt()).decode()
    c.execute("""
        INSERT INTO users (full_name, phone, national_id_number, email, role, org_name, province, district, address,
            badge_number, station, jurisdiction_province, password_hash, verification_status, requested_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending',%s)
    """, (
        full_name, phone, national_id, d.get('email', ''), d.get('role', 'Police'),
        d.get('org_name', ''), d.get('province', ''), d.get('district', ''), d.get('address', ''),
        d.get('badge_number', ''), d.get('station', ''), d.get('jurisdiction_province', ''),
        password_hash, g.current_user['id'],
    ))
    db.commit()
    user_id = c.lastrowid
    db.close()
    return jsonify({"id": user_id, "message": "Officer nomination submitted — pending PFUMA Admin approval before this account can log in."})


@app.route('/users/<int:user_id>', methods=['GET'])
@require_auth
def get_user(user_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = c.fetchone()
    db.close()
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user['role'] == 'Police' and g.current_user['role'] != 'Police' and g.current_user['id'] != user_id:
        return jsonify({"error": "User not found"}), 404
    return jsonify(public_user_view(user, g.current_user))


@app.route('/users/me/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    photo = request.files.get('photo')
    if not photo or not photo.filename:
        return jsonify({"error": "No photo uploaded"}), 400
    try:
        rel_path = save_photo(photo, 'avatars', g.current_user['id'])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    db = get_db()
    c = db.cursor()
    c.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (f"/uploads/{rel_path}", g.current_user['id']))
    db.commit()
    db.close()
    return jsonify({"avatar_url": f"/uploads/{rel_path}", "message": "Profile picture updated ✅"})


@app.route('/users/me', methods=['PATCH'])
@require_auth
def update_own_profile():
    """A user's registered name is exactly what Police/DVS checked against
    their ID document to grant verification — changing it invalidates that
    check, so it forces the account back to 'pending' and re-locks anything
    gated by @require_verified (listing on the marketplace, etc.) until an
    officer reviews it again under the new name."""
    d = request.json or {}
    new_name = (d.get('full_name') or '').strip()
    if not new_name:
        return jsonify({"error": "full_name is required"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT full_name, verification_status FROM users WHERE id=%s", (g.current_user['id'],))
    current = c.fetchone()
    name_changed = new_name != current['full_name']
    if name_changed and current['verification_status'] == 'verified':
        c.execute("UPDATE users SET full_name=%s, verification_status='pending' WHERE id=%s", (new_name, g.current_user['id']))
    else:
        c.execute("UPDATE users SET full_name=%s WHERE id=%s", (new_name, g.current_user['id']))
    db.commit()
    c.execute("SELECT * FROM users WHERE id=%s", (g.current_user['id'],))
    user = c.fetchone()
    db.close()
    return jsonify({
        "user": public_user_view(user, user),
        "message": "Name updated — your account needs to be re-verified before this change is trusted." if name_changed and current['verification_status'] == 'verified' else "Name updated ✅"
    })


# ── MESSENGER (real conversations, any verified user to any other) ──────
def _conversation_participant_or_404(c, conversation_id, requester_id):
    c.execute("SELECT * FROM conversations WHERE id=%s", (conversation_id,))
    conv = c.fetchone()
    if not conv or requester_id not in (conv['user_a_id'], conv['user_b_id']):
        return None
    return conv


@app.route('/conversations', methods=['GET'])
@require_auth
def get_conversations():
    me = g.current_user['id']
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT * FROM conversations WHERE user_a_id=%s OR user_b_id=%s
        ORDER BY last_message_at DESC
    """, (me, me))
    convs = c.fetchall()
    result = []
    for conv in convs:
        other_id = conv['user_b_id'] if conv['user_a_id'] == me else conv['user_a_id']
        c.execute("SELECT * FROM users WHERE id=%s", (other_id,))
        other = c.fetchone()
        if not other:
            continue
        c.execute("""
            SELECT message, sender_id, sent_at FROM conversation_messages
            WHERE conversation_id=%s ORDER BY sent_at DESC LIMIT 1
        """, (conv['id'],))
        last = c.fetchone()
        c.execute("""
            SELECT COUNT(*) as n FROM conversation_messages
            WHERE conversation_id=%s AND sender_id!=%s AND read_at IS NULL
        """, (conv['id'], me))
        unread = c.fetchone()['n']
        result.append({
            **conv,
            "other_user": public_user_view(other, g.current_user),
            "last_message": last['message'] if last else None,
            "last_message_is_own": bool(last and last['sender_id'] == me),
            "unread_count": unread,
        })
    db.close()
    return jsonify(result)


@app.route('/conversations/<int:conversation_id>/contact', methods=['GET'])
@require_auth
def get_conversation_contact(conversation_id):
    """The other participant's contact details — phone included, even for a
    Farmer talking to a Farmer, which public_user_view() otherwise redacts.
    Scoped narrowly: only visible to someone who is actually a participant
    in THIS conversation with them, i.e. they're already directly connected
    and arranging something (a sale, a consult) that needs a phone number —
    not a general directory lookup."""
    me = g.current_user['id']
    db = get_db()
    c = db.cursor()
    conv = _conversation_participant_or_404(c, conversation_id, me)
    if not conv:
        db.close(); return jsonify({"error": "Conversation not found"}), 404
    other_id = conv['user_b_id'] if conv['user_a_id'] == me else conv['user_a_id']
    c.execute("SELECT * FROM users WHERE id=%s", (other_id,))
    other = c.fetchone()
    db.close()
    if not other:
        return jsonify({"error": "User not found"}), 404
    view = public_user_view(other, g.current_user)
    view['phone'] = other['phone']
    view['email'] = other['email']
    view['address'] = other['address']
    return jsonify(view)


@app.route('/conversations', methods=['POST'])
@require_auth
def create_conversation():
    """Starts (or, for a plain General chat, reuses) a conversation with
    another verified user. Any verified user can message any other verified
    user directly — PFUMA's roles work together, this isn't role-gated."""
    d = request.json or {}
    me = g.current_user['id']
    other_id = d.get('other_user_id')
    if not other_id or int(other_id) == me:
        return jsonify({"error": "other_user_id is required and must not be yourself"}), 400

    subject = (d.get('subject') or '').strip() or None
    category = d.get('category') or 'General'
    animal_id = d.get('animal_id') or None

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id, verification_status FROM users WHERE id=%s", (other_id,))
    other = c.fetchone()
    if not other:
        db.close(); return jsonify({"error": "User not found"}), 404
    if other['verification_status'] != 'verified':
        db.close(); return jsonify({"error": "That account isn't verified yet — you can message them once they're verified."}), 403

    if category == 'General':
        c.execute("""
            SELECT * FROM conversations
            WHERE category='General' AND ((user_a_id=%s AND user_b_id=%s) OR (user_a_id=%s AND user_b_id=%s))
            LIMIT 1
        """, (me, other_id, other_id, me))
        existing = c.fetchone()
        if existing:
            db.close()
            return jsonify({"id": existing['id'], "reused": True})

    c.execute("""
        INSERT INTO conversations (user_a_id, user_b_id, subject, category, animal_id)
        VALUES (%s,%s,%s,%s,%s)
    """, (me, other_id, subject, category, animal_id))
    conv_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": conv_id, "reused": False}), 201


@app.route('/conversations/<int:conversation_id>/messages', methods=['GET'])
@require_auth
def get_conversation_messages(conversation_id):
    me = g.current_user['id']
    db = get_db()
    c = db.cursor()
    conv = _conversation_participant_or_404(c, conversation_id, me)
    if not conv:
        db.close(); return jsonify({"error": "Conversation not found"}), 404

    c.execute("""
        SELECT * FROM conversation_messages WHERE conversation_id=%s ORDER BY sent_at ASC
    """, (conversation_id,))
    msgs = c.fetchall()
    c.execute("""
        UPDATE conversation_messages SET read_at=NOW()
        WHERE conversation_id=%s AND sender_id!=%s AND read_at IS NULL
    """, (conversation_id, me))
    db.commit()
    db.close()
    return jsonify(msgs)


@app.route('/conversations/<int:conversation_id>/messages', methods=['POST'])
@require_auth
def send_conversation_message(conversation_id):
    me = g.current_user['id']
    # multipart (attachment) and plain JSON bodies are both accepted — a
    # message can be text-only, attachment-only (like WhatsApp), or both.
    d = request.form if request.form else (request.json or {})
    attachment = request.files.get('attachment')
    text = (d.get('message') or '').strip()[:2000]
    if not text and not (attachment and attachment.filename):
        return jsonify({"error": "message or an attachment is required"}), 400

    db = get_db()
    c = db.cursor()
    conv = _conversation_participant_or_404(c, conversation_id, me)
    if not conv:
        db.close(); return jsonify({"error": "Conversation not found"}), 404

    c.execute("""
        INSERT INTO conversation_messages (conversation_id, sender_id, message) VALUES (%s,%s,%s)
    """, (conversation_id, me, text))
    msg_id = c.lastrowid

    if attachment and attachment.filename:
        try:
            save_photo(attachment, 'attachments', msg_id, allowed_ext=ALLOWED_ATTACHMENT_EXT)
            c.execute("UPDATE conversation_messages SET attachment_url=%s, attachment_name=%s WHERE id=%s",
                      (f"/attachments/{msg_id}", secure_filename(attachment.filename), msg_id))
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400

    c.execute("UPDATE conversations SET last_message_at=NOW() WHERE id=%s", (conversation_id,))
    db.commit()
    c.execute("SELECT * FROM conversation_messages WHERE id=%s", (msg_id,))
    msg = c.fetchone()
    db.close()
    return jsonify(msg), 201


# ── ANIMALS ───────────────────────────────────────────────────
@app.route('/animals', methods=['GET'])
@require_auth
def get_animals():
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    for_sale = request.args.get('for_sale')
    sql = """
        SELECT a.*, u.full_name as owner_name, u.phone as owner_phone, u.province as owner_province
        FROM animals a JOIN users u ON a.owner_id = u.id WHERE 1=1
    """
    params = []
    # Oversight roles (Vet, Police) can see across farms; everyone else only
    # ever sees their own herd — animal/health data is private by default.
    if requester['role'] not in ('Veterinarian', 'Police'):
        sql += " AND a.owner_id = %s"; params.append(requester['id'])
    if for_sale is not None:
        sql += " AND a.for_sale = %s"; params.append(1 if for_sale == 'true' else 0)
    sql += " ORDER BY a.created_at DESC"
    c.execute(sql, params)
    animals = c.fetchall()
    for a in animals:
        c.execute("SELECT month_label, weight_kg FROM weight_history WHERE animal_id = %s ORDER BY id", (a['id'],))
        a['weight_history'] = c.fetchall()
        a['photos'] = animal_photo_urls(c, a)
        # Marketplace status of this animal's most recent listing (if any) —
        # lets the UI show a clear SOLD / pending-clearance badge and block
        # re-listing an animal that's already sold or already active.
        c.execute("""SELECT status FROM marketplace_listings
                      WHERE animal_id=%s AND status IN ('pending_clearance','available','sold')
                      ORDER BY created_at DESC LIMIT 1""", (a['id'],))
        row = c.fetchone()
        a['marketplace_status'] = row['status'] if row else None
    db.close()
    return jsonify(animals)


@app.route('/animals', methods=['POST'])
@require_auth
@require_role('Farmer')
@require_verified
def add_animal():
    # multipart (photo upload) and plain JSON (no photo) bodies are both
    # accepted — request.form is empty for a JSON body, so fall back to it.
    d = request.form if request.form else (request.json or {})
    photo = request.files.get('photo')
    extra_photos = request.files.getlist('photos')
    db = get_db()
    c = db.cursor()
    species = d['species']
    fallback_image = SPECIES_STOCK_IMAGES.get(species, SPECIES_STOCK_IMAGES['Cattle'])
    c.execute("""
        INSERT INTO animals (owner_id, name, species, breed, birth_date, tag_id, brand_id,
            sire_id, dam_id, birth_weight, current_weight, image_url, for_sale)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        g.current_user['id'], d['name'], species, d.get('breed', ''),
        d.get('birth_date') or d.get('birthDate'), d.get('tag_id') or d.get('tagId', ''),
        d.get('brand_id') or d.get('brandId', ''), d.get('sire_id') or d.get('sireId', ''),
        d.get('dam_id') or d.get('damId', ''),
        d.get('birth_weight') or d.get('birthWeight', 0),
        d.get('current_weight') or d.get('currentWeight', 0),
        fallback_image, d.get('for_sale', False)
    ))
    animal_id = c.lastrowid

    if photo and photo.filename:
        try:
            rel_path = save_photo(photo, 'animals', animal_id)
            cover_url = f"/uploads/{rel_path}"
            c.execute("UPDATE animals SET image_url=%s WHERE id=%s", (cover_url, animal_id))
            c.execute("INSERT INTO animal_photos (animal_id, image_url, sort_order) VALUES (%s,%s,0)", (animal_id, cover_url))
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400

    # Extra photos beyond the cover — same "register with several pictures
    # already attached" flow the marketplace gallery needs, available from
    # first registration rather than only as a later add-on.
    for i, f in enumerate(extra_photos, start=1):
        if not f or not f.filename:
            continue
        try:
            rel_path = save_photo(f, 'animals', animal_id, suffix=f"{i}_{secrets.token_hex(3)}")
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400
        c.execute("INSERT INTO animal_photos (animal_id, image_url, sort_order) VALUES (%s,%s,%s)",
                   (animal_id, f"/uploads/{rel_path}", i))

    bw = d.get('birth_weight') or d.get('birthWeight', 0)
    if bw:
        c.execute("INSERT INTO weight_history (animal_id, month_label, weight_kg) VALUES (%s,'Initial',%s)", (animal_id, bw))
    db.commit()
    db.close()
    return jsonify({"id": animal_id, "message": "Animal registered ✅"})


@app.route('/animals/<int:animal_id>/sale', methods=['PATCH'])
@require_auth
def toggle_sale(animal_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id = %s", (animal_id,))
    row = c.fetchone()
    if not row:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if row['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only list your own animals"}), 403
    c.execute("""SELECT status FROM marketplace_listings
                  WHERE animal_id=%s AND status IN ('pending_clearance','available','sold')
                  ORDER BY created_at DESC LIMIT 1""", (animal_id,))
    existing = c.fetchone()
    if existing and existing['status'] == 'sold':
        db.close(); return jsonify({"error": "This animal has already been sold."}), 409
    c.execute("UPDATE animals SET for_sale = NOT for_sale WHERE id = %s", (animal_id,))
    db.commit()
    c.execute("SELECT for_sale FROM animals WHERE id = %s", (animal_id,))
    row = c.fetchone()
    db.close()
    return jsonify({"for_sale": bool(row['for_sale']), "message": "Listing status updated ✅"})


@app.route('/animals/<int:animal_id>/photos', methods=['GET'])
@require_auth
def get_animal_photos_route(animal_id):
    db = get_db(); c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if animal['owner_id'] != g.current_user['id'] and g.current_user['role'] not in ('Veterinarian', 'Police'):
        db.close(); return jsonify({"error": "Not authorized"}), 403
    photos = animal_photos(c, animal_id)
    db.close()
    return jsonify(photos)


@app.route('/animals/<int:animal_id>/photos', methods=['POST'])
@require_auth
@require_role('Farmer')
def add_animal_photos_route(animal_id):
    db = get_db(); c = db.cursor()
    c.execute("SELECT owner_id, image_url FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only add photos to your own animals"}), 403

    files = request.files.getlist('photos')
    if not files and 'photo' in request.files:
        files = [request.files['photo']]
    files = [f for f in files if f and f.filename]
    if not files:
        db.close(); return jsonify({"error": "No photos provided"}), 400

    c.execute("SELECT COUNT(*) AS n FROM animal_photos WHERE animal_id=%s", (animal_id,))
    next_order = c.fetchone()['n']
    saved = []
    for i, f in enumerate(files):
        try:
            rel_path = save_photo(f, 'animals', animal_id, suffix=f"{next_order + i}_{secrets.token_hex(3)}")
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400
        url = f"/uploads/{rel_path}"
        c.execute("INSERT INTO animal_photos (animal_id, image_url, sort_order) VALUES (%s,%s,%s)",
                   (animal_id, url, next_order + i))
        saved.append({"id": c.lastrowid, "image_url": url})
        if not animal['image_url']:
            c.execute("UPDATE animals SET image_url=%s WHERE id=%s", (url, animal_id))
            animal['image_url'] = url
    db.commit()
    db.close()
    return jsonify({"photos": saved, "message": f"{len(saved)} photo(s) added ✅"})


@app.route('/animals/<int:animal_id>/photos/<int:photo_id>', methods=['DELETE'])
@require_auth
@require_role('Farmer')
def delete_animal_photo_route(animal_id, photo_id):
    db = get_db(); c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal or animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Not authorized"}), 403
    c.execute("DELETE FROM animal_photos WHERE id=%s AND animal_id=%s", (photo_id, animal_id))
    db.commit()
    db.close()
    return jsonify({"message": "Photo removed ✅"})


# ── IOT DEVICES ───────────────────────────────────────────────
# Pairing bookkeeping for physical collars/base stations — see IOT_HARDWARE_GUIDE.md
# for how a farmer physically sets up the hardware and finds their device's serial.
@app.route('/iot-devices', methods=['GET'])
@require_auth
def get_iot_devices():
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT d.*, a.name AS animal_name, a.species
        FROM iot_devices d LEFT JOIN animals a ON d.animal_id = a.id
        WHERE d.owner_id = %s ORDER BY d.paired_at DESC
    """, (g.current_user['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/iot-devices/pair', methods=['POST'])
@require_auth
@require_role('Farmer')
def pair_iot_device():
    d = request.json
    serial = (d.get('device_serial') or '').strip()
    if not serial:
        return jsonify({"error": "device_serial is required"}), 400
    device_type = d.get('device_type', 'collar')
    if device_type not in ('collar', 'base_station'):
        return jsonify({"error": "device_type must be 'collar' or 'base_station'"}), 400
    # A base station sits at the farmhouse, not on an animal — animal_id
    # never applies to it regardless of what the client sends.
    animal_id = d.get('animal_id') if device_type == 'collar' else None

    db = get_db()
    c = db.cursor()
    if animal_id:
        c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
        animal = c.fetchone()
        if not animal or animal['owner_id'] != g.current_user['id']:
            db.close(); return jsonify({"error": "You can only pair a device to your own animal"}), 403

    c.execute("SELECT owner_id FROM iot_devices WHERE device_serial=%s", (serial,))
    existing = c.fetchone()
    if existing:
        db.close()
        if existing['owner_id'] == g.current_user['id']:
            return jsonify({"error": "You've already paired this device"}), 409
        return jsonify({"error": "This device serial is already claimed by another account"}), 409

    c.execute("INSERT INTO iot_devices (device_serial, device_type, animal_id, owner_id) VALUES (%s,%s,%s,%s)",
              (serial, device_type, animal_id, g.current_user['id']))
    device_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": device_id, "device_type": device_type, "message": "Device paired ✅"})


@app.route('/iot-devices/<int:device_id>', methods=['PATCH'])
@require_auth
def update_iot_device(device_id):
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id, device_type FROM iot_devices WHERE id=%s", (device_id,))
    device = c.fetchone()
    if not device:
        db.close(); return jsonify({"error": "Device not found"}), 404
    if device['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only manage your own devices"}), 403
    if device['device_type'] == 'base_station':
        db.close(); return jsonify({"error": "A base station isn't attached to an animal"}), 400

    animal_id = d.get('animal_id')
    if animal_id:
        c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
        animal = c.fetchone()
        if not animal or animal['owner_id'] != g.current_user['id']:
            db.close(); return jsonify({"error": "You can only pair a device to your own animal"}), 403

    c.execute("UPDATE iot_devices SET animal_id=%s WHERE id=%s", (animal_id, device_id))
    db.commit()
    db.close()
    return jsonify({"message": "Device updated ✅"})


# Telemetry intake for real base-station hardware (see base_station.ino).
# Authenticated by device serial rather than a user JWT, since firmware can't
# hold a farmer's login session. The base station's own serial (X-Station-ID
# header) must be paired, AND the collar's serial (JSON "id" field) must
# separately be paired — each device is claimed independently in the app.
def _store_iot_reading():
    d = request.json or {}
    station_id = request.headers.get('X-Station-ID') or d.get('station_id')
    collar_id = d.get('id')
    if not collar_id:
        return jsonify({"error": "Missing collar id"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM iot_devices WHERE device_serial=%s", (station_id,))
    station = c.fetchone()
    if not station:
        db.close()
        return jsonify({"error": "Unrecognized base station — pair this device serial in the app first"}), 404

    c.execute("SELECT id FROM iot_devices WHERE device_serial=%s", (collar_id,))
    collar = c.fetchone()
    if not collar:
        db.close()
        return jsonify({"error": "Unrecognized collar — pair this device serial in the app first"}), 404

    c.execute("""
        INSERT INTO iot_readings
            (device_id, temp_c, heart_rate, latitude, longitude, gps_accuracy,
             activity, move_mag, in_zone, battery_pct, fever_alert, theft_alert,
             packet_no, rssi)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        collar['id'], d.get('temp'), d.get('hr'), d.get('lat'), d.get('lon'), d.get('gpsAcc'),
        d.get('activity'), d.get('move'), bool(d.get('inZone')), d.get('batt'),
        bool(d.get('fever')), bool(d.get('theft')), d.get('pkt'), d.get('rssi'),
    ))
    db.commit()
    db.close()
    return jsonify({"received": True})


# The reverse proxy in front of this app strips the /api prefix before
# forwarding, so a station POSTing to https://host/api/iot/telemetry arrives
# here as /iot/telemetry - which is also the convention every other route in
# this file follows. Both paths are registered so the endpoint works through
# the proxy and when the app is hit directly on its own port.
@app.route('/iot/telemetry', methods=['POST'])
@app.route('/api/iot/telemetry', methods=['POST'])
@limiter.limit("60 per minute")
def ingest_telemetry():
    return _store_iot_reading()


@app.route('/iot/alert', methods=['POST'])
@app.route('/api/iot/alert', methods=['POST'])
@limiter.limit("60 per minute")
def ingest_alert():
    return _store_iot_reading()


# Real reading history for the app's IoT Monitor tab. Falls back to the
# built-in demo simulator (HardwareSimulation.jsx) on the frontend when an
# animal has no paired device or no recent readings.
@app.route('/animals/<int:animal_id>/iot-readings', methods=['GET'])
@require_auth
def get_iot_readings(animal_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if g.current_user['role'] not in ('Veterinarian', 'Police', 'Admin') and animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Not authorized to view this animal's readings"}), 403

    limit = min(int(request.args.get('limit', 20)), 100)
    c.execute("""
        SELECT r.* FROM iot_readings r
        JOIN iot_devices d ON r.device_id = d.id
        WHERE d.animal_id = %s
        ORDER BY r.received_at DESC LIMIT %s
    """, (animal_id, limit))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


# Default fallback zone (Zimbabwe Agricultural Show grounds, Harare) used
# only when a farmer has no geofence configured yet.
DEFAULT_GEOFENCE = {"name": "Demo Safe Zone", "center_lat": -17.8216, "center_lon": 31.0233, "radius_m": 500}


def _latest_geofence(owner_id):
    db = get_db(); c = db.cursor()
    c.execute("SELECT * FROM geofences WHERE owner_id=%s ORDER BY created_at DESC LIMIT 1", (owner_id,))
    row = c.fetchone()
    db.close()
    return row


@app.route('/animals/<int:animal_id>/geofence', methods=['GET'])
@require_auth
def get_animal_geofence(animal_id):
    db = get_db(); c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    db.close()
    if not animal:
        return jsonify({"error": "Animal not found"}), 404
    if g.current_user['role'] not in ('Veterinarian', 'Police', 'Admin') and animal['owner_id'] != g.current_user['id']:
        return jsonify({"error": "Not authorized to view this animal's geofence"}), 403

    zone = _latest_geofence(animal['owner_id'])
    if not zone:
        return jsonify({**DEFAULT_GEOFENCE, "is_default": True})
    return jsonify({
        "id": zone['id'], "name": zone['name'],
        "center_lat": float(zone['center_lat']), "center_lon": float(zone['center_lon']),
        "radius_m": zone['radius_m'], "is_default": False,
    })


# ── HEALTH EVENTS ─────────────────────────────────────────────
@app.route('/animals/<int:animal_id>/health', methods=['GET'])
@require_auth
def get_health(animal_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id = %s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if g.current_user['role'] not in ('Veterinarian', 'Police') and animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Not authorized to view this animal's health records"}), 403
    c.execute("SELECT * FROM health_events WHERE animal_id = %s ORDER BY event_date DESC", (animal_id,))
    events = c.fetchall()
    db.close()
    return jsonify(events)


@app.route('/health-events', methods=['GET'])
@require_auth
def list_health_events():
    """The farmer's (or vet's) real, persisted health/compliance audit log —
    what the dashboard's 'Recent Activity' should read from, instead of
    client-only state that resets on every refresh."""
    db = get_db()
    c = db.cursor()
    if g.current_user['role'] == 'Veterinarian':
        c.execute("""
            SELECT he.* FROM health_events he
            WHERE he.performed_by = %s
            ORDER BY he.event_date DESC LIMIT 200
        """, (g.current_user['id'],))
    else:
        c.execute("""
            SELECT he.* FROM health_events he
            JOIN animals a ON he.animal_id = a.id
            WHERE a.owner_id = %s
            ORDER BY he.event_date DESC LIMIT 200
        """, (g.current_user['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/health-events', methods=['POST'])
@require_auth
@require_role('Farmer', 'Veterinarian')
def add_health_event():
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id, name FROM animals WHERE id = %s", (d['animal_id'],))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if g.current_user['role'] == 'Farmer' and animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only log events for your own animals"}), 403

    next_due_date = d.get('next_due_date') or None
    event_date = (d.get('event_date') or '').strip()  # lets a farmer backdate "when it actually happened"

    if event_date:
        c.execute("""
            INSERT INTO health_events (animal_id, animal_name, event_type, notes, performed_by, event_date, next_due_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (d['animal_id'], animal['name'], d['event_type'], d.get('notes', ''), g.current_user['id'], event_date, next_due_date))
    else:
        c.execute("""
            INSERT INTO health_events (animal_id, animal_name, event_type, notes, performed_by, next_due_date)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (d['animal_id'], animal['name'], d['event_type'], d.get('notes', ''), g.current_user['id'], next_due_date))
    event_id = c.lastrowid

    # Logging the shot is what closes the case — the ladder never has to be
    # unwound by hand, and a trade lockout lifts the moment the animal is
    # actually vaccinated. Matching is on the protocol name the case was
    # opened under, the same prefix rule the schedule UI uses.
    resolved = []
    c.execute("""SELECT id, vaccine_name, trade_locked FROM compliance_cases
                  WHERE animal_id = %s AND stage NOT IN ('resolved','waived')""", (d['animal_id'],))
    for case in c.fetchall():
        if not d['event_type'].lower().startswith(case['vaccine_name'].lower()):
            continue
        c.execute("""UPDATE compliance_cases
                        SET stage='resolved', trade_locked=FALSE, stage_due=NULL,
                            deferred_until=NULL, resolved_at=NOW(), resolved_event_id=%s
                      WHERE id=%s""", (event_id, case['id']))
        _log_action(c, case['id'], 'resolved', g.current_user['id'], g.current_user['role'],
                    f"{d['event_type']} logged — requirement met.")
        if case['trade_locked']:
            _log_action(c, case['id'], 'unlocked', g.current_user['id'], g.current_user['role'],
                        'Trade lockout lifted automatically once the vaccination was recorded.')
        resolved.append(case['vaccine_name'])

    db.commit()
    c.execute("SELECT * FROM health_events WHERE id = %s", (event_id,))
    event = c.fetchone()
    db.close()
    msg = "Health event logged ✅"
    if resolved:
        msg += f" — compliance case closed for {', '.join(resolved)}, this animal can trade again."
    return jsonify({"id": event_id, "message": msg, "event": event, "resolved_cases": resolved})


# ── VACCINATION COMPLIANCE ────────────────────────────────────
# Missing a mandatory shot opens a case that a vet follows up on, rather than
# just colouring a dashboard card red. See backend/protocols.py for the ladder
# and schema.sql for why the penalty is a per-animal trade lockout and not a
# fine. The short version: a smallholder who cannot get the vaccine has not
# committed an offence, so the escape hatch (declaring a blocker) is one tap
# away at every stage and costs nothing.

def _log_action(c, case_id, action, actor_id=None, actor_role=None, notes=''):
    c.execute("""
        INSERT INTO compliance_actions (case_id, action, actor_id, actor_role, notes)
        VALUES (%s,%s,%s,%s,%s)
    """, (case_id, action, actor_id, actor_role, (notes or '')[:400]))


def _due_occurrences(animal, events, today):
    """Every enforceable dose that is past due for one animal, with the date
    it fell due.

    A dose counts as due when either:
      - it has never been logged and the animal is old enough for it, or
      - the last logged dose carried a next_due_date that has now passed.

    Age alone is deliberately not enough — that would flag an animal that was
    vaccinated on time, forever.
    """
    out = []
    birth = animal.get('birth_date')
    if not birth:
        return out  # no birth date, no schedule to measure against
    if isinstance(birth, datetime.datetime):
        birth = birth.date()

    for v in protocols.enforceable_vaccines(animal['species']):
        first_due = birth + datetime.timedelta(days=v['age'])
        matching = sorted(
            [e for e in events if (e['event_type'] or '').lower().startswith(v['name'].lower())],
            key=lambda e: e['event_date'], reverse=True
        )
        if not matching:
            if today > first_due:
                out.append((v['name'], first_due))
            continue

        last = matching[0]
        nxt = last.get('next_due_date')
        if not nxt and v['interval_days']:
            # Logged without a next date — fall back to the protocol interval
            # so an annual booster doesn't silently stop being tracked.
            last_date = last['event_date']
            if isinstance(last_date, datetime.datetime):
                last_date = last_date.date()
            nxt = last_date + datetime.timedelta(days=v['interval_days'])
        if isinstance(nxt, datetime.datetime):
            nxt = nxt.date()
        if nxt and today > nxt:
            out.append((v['name'], nxt))
    return out


def sync_compliance(db, owner_id=None, province=None):
    """Open cases for newly-overdue doses and auto-advance stale ones.

    This runs on read (whenever a farmer or vet opens their compliance view)
    rather than on a scheduler, because this deployment has no job runner. It
    is idempotent — uniq_case_occurrence stops duplicate cases, and each stage
    only advances once its grace period has actually elapsed.
    """
    today = datetime.date.today()
    c = db.cursor()

    sql = """SELECT a.id, a.name, a.species, a.birth_date, a.owner_id,
                    u.province, u.district
             FROM animals a JOIN users u ON a.owner_id = u.id
             WHERE u.role = 'Farmer'"""
    params = []
    if owner_id:
        sql += " AND a.owner_id = %s"; params.append(owner_id)
    if province:
        sql += " AND u.province = %s"; params.append(province)
    c.execute(sql, params)
    animals = c.fetchall()

    for a in animals:
        c.execute("""SELECT event_type, event_date, next_due_date
                     FROM health_events WHERE animal_id = %s""", (a['id'],))
        events = c.fetchall()
        for vaccine_name, due_date in _due_occurrences(a, events, today):
            c.execute("""
                INSERT IGNORE INTO compliance_cases
                    (animal_id, owner_id, vaccine_name, species, due_date,
                     stage, stage_due, province, district)
                VALUES (%s,%s,%s,%s,%s,'reminder',%s,%s,%s)
            """, (a['id'], a['owner_id'], vaccine_name, a['species'], due_date,
                  today + datetime.timedelta(days=protocols.GRACE_DAYS['reminder']),
                  a['province'], a['district']))
            if c.rowcount:
                _log_action(c, c.lastrowid, 'opened',
                            notes=f"{vaccine_name} fell due {due_date} and has not been logged.")

    # A deferral that has run its course comes back as a live case — at the
    # stage it was paused from, never straight to a penalty.
    c.execute("""
        UPDATE compliance_cases
           SET stage = 'vet_followup', deferred_until = NULL,
               stage_due = DATE_ADD(CURDATE(), INTERVAL %s DAY)
         WHERE stage = 'deferred' AND deferred_until IS NOT NULL AND deferred_until < CURDATE()
    """, (protocols.GRACE_DAYS['vet_followup'],))

    # Auto-advance is capped at pulling a vet in. Everything past that
    # (notice, lockout) needs a human decision — see PATCH /compliance/cases.
    for stage, nxt in protocols.AUTO_ADVANCE.items():
        c.execute("""SELECT id FROM compliance_cases
                     WHERE stage = %s AND stage_due IS NOT NULL AND stage_due < CURDATE()""", (stage,))
        for row in c.fetchall():
            c.execute("""UPDATE compliance_cases
                            SET stage = %s, stage_due = DATE_ADD(CURDATE(), INTERVAL %s DAY)
                          WHERE id = %s""",
                      (nxt, protocols.GRACE_DAYS.get(nxt, 14), row['id']))
            _log_action(c, row['id'], 'escalated',
                        notes=f"No response within the {stage} grace period — raised to {nxt}.")
    db.commit()


def _case_row_sql():
    return """
        SELECT cc.*, a.name AS animal_name, a.tag_id, a.image_url,
               u.full_name AS owner_name, u.phone AS owner_phone,
               v.full_name AS vet_name
        FROM compliance_cases cc
        JOIN animals a ON cc.animal_id = a.id
        JOIN users u   ON cc.owner_id  = u.id
        LEFT JOIN users v ON cc.vet_id = v.id
    """


def animal_trade_block(c, animal_id):
    """Why this animal can't be traded right now, or None if it can.

    Called by the listing and clearance paths — a locked animal must not
    reach the marketplace, but a vet's conditional clearance overrides the
    lock so a farmer who needs the cash can still sell.
    """
    c.execute("""
        SELECT vaccine_name, due_date FROM compliance_cases
         WHERE animal_id = %s AND stage = 'penalty'
           AND trade_locked = TRUE AND conditional_clearance = FALSE
    """, (animal_id,))
    rows = c.fetchall()
    if not rows:
        return None
    names = ', '.join(r['vaccine_name'] for r in rows)
    return (f"This animal is under a vaccination trade lockout ({names}). "
            f"Log the outstanding vaccination — or ask your vet for a conditional "
            f"clearance — and the lockout lifts immediately.")


@app.route('/compliance/cases', methods=['GET'])
@require_auth
def list_compliance_cases():
    """Farmer: my own open cases. Vet: the follow-up queue for my province."""
    role = g.current_user['role']
    db = get_db()
    try:
        if role == 'Farmer':
            sync_compliance(db, owner_id=g.current_user['id'])
            where, params = " WHERE cc.owner_id = %s", [g.current_user['id']]
        elif role in ('Veterinarian', 'Police', 'Admin'):
            province = g.current_user.get('province')
            sync_compliance(db, province=province)
            where, params = " WHERE cc.province = %s", [province]
        else:
            return jsonify({"error": "Not authorized to view compliance cases"}), 403

        stage = request.args.get('stage')
        if stage:
            where += " AND cc.stage = %s"; params.append(stage)
        elif request.args.get('include_resolved') != 'true':
            where += " AND cc.stage NOT IN ('resolved','waived')"
        animal_id = request.args.get('animal_id')
        if animal_id:
            where += " AND cc.animal_id = %s"; params.append(animal_id)

        c = db.cursor()
        c.execute(_case_row_sql() + where + """
            ORDER BY FIELD(cc.stage,'penalty','notice','vet_followup','reminder','deferred','resolved','waived'),
                     cc.due_date ASC
            LIMIT 300
        """, params)
        cases = c.fetchall()
        for case in cases:
            c.execute("""SELECT ca.*, u.full_name AS actor_name
                           FROM compliance_actions ca
                           LEFT JOIN users u ON ca.actor_id = u.id
                          WHERE ca.case_id = %s ORDER BY ca.created_at""", (case['id'],))
            case['actions'] = c.fetchall()
        return jsonify(cases)
    finally:
        db.close()


@app.route('/compliance/cases/<int:case_id>/defer', methods=['POST'])
@require_auth
@require_role('Farmer')
def defer_compliance_case(case_id):
    """The 'I can't comply' path.

    Declaring a real blocker pauses the case, carries no penalty, and routes
    it to whoever can clear the obstruction. This is not an admission — it is
    how a farmer reports that the system, not they, is the thing that failed.
    """
    d = request.json or {}
    reason = d.get('reason')
    if reason not in protocols.BLOCKER_ROUTING:
        return jsonify({"error": "Choose a reason you cannot vaccinate right now"}), 400

    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT * FROM compliance_cases WHERE id = %s", (case_id,))
        case = c.fetchone()
        if not case:
            return jsonify({"error": "Case not found"}), 404
        if case['owner_id'] != g.current_user['id']:
            return jsonify({"error": "Not your case"}), 403
        if case['stage'] in ('resolved', 'waived'):
            return jsonify({"error": "This case is already closed"}), 400

        routed_to = protocols.BLOCKER_ROUTING[reason]
        notes = (d.get('notes') or '').strip()[:300]

        # Past the self-service allowance the blocker still stands and still
        # blocks a penalty — but a vet has to agree to the next pause.
        auto_pause = case['defer_count'] < protocols.MAX_SELF_DEFERRALS and case['stage'] != 'penalty'
        if auto_pause:
            until = datetime.date.today() + datetime.timedelta(days=protocols.DEFER_DAYS[reason])
            c.execute("""
                UPDATE compliance_cases
                   SET stage='deferred', blocker_reason=%s, blocker_notes=%s,
                       deferred_until=%s, stage_due=NULL, defer_count=defer_count+1,
                       routed_to=%s
                 WHERE id=%s
            """, (reason, notes, until, routed_to, case_id))
        else:
            c.execute("""
                UPDATE compliance_cases
                   SET blocker_reason=%s, blocker_notes=%s, routed_to=%s,
                       defer_count=defer_count+1
                 WHERE id=%s
            """, (reason, notes, routed_to, case_id))
        _log_action(c, case_id, 'deferred', g.current_user['id'], 'Farmer',
                    f"Blocker declared: {reason}. {notes}")

        # Route it. A blocker nobody acts on is just a delay with extra steps,
        # so each reason lands in a queue that already exists in the app.
        if routed_to == 'vet_dispatch':
            c.execute("""SELECT cm.cooperative_id FROM cooperative_members cm
                          WHERE cm.user_id = %s LIMIT 1""", (g.current_user['id'],))
            coop = c.fetchone()
            if coop:
                c.execute("""
                    INSERT INTO cooperative_vet_requests (cooperative_id, requested_by, reason, status)
                    VALUES (%s,%s,%s,'open')
                """, (coop['cooperative_id'], g.current_user['id'],
                      f"Vaccination visit needed — {case['vaccine_name']} outstanding "
                      f"(no vet access reported). {notes}"))

        db.commit()
        c.execute(_case_row_sql() + " WHERE cc.id = %s", (case_id,))
        return jsonify({
            "case": c.fetchone(),
            "paused": bool(auto_pause),
            "routed_to": routed_to,
            "message": ("Recorded. The clock is paused and this has been sent on to be unblocked — "
                        "no penalty applies."
                        if auto_pause else
                        "Recorded and sent to your vet. This is your third blocker on this case, "
                        "so a vet needs to approve the next pause — no penalty applies meanwhile."),
        })
    finally:
        db.close()


@app.route('/compliance/cases/<int:case_id>', methods=['PATCH'])
@require_auth
@require_role('Veterinarian')
def act_on_compliance_case(case_id):
    """The vet's decisions on a case.

    Every stage past 'vet_followup' happens here and only here — the system
    proposes, a vet disposes. A lockout is never applied by a timer.
    """
    d = request.json or {}
    action = d.get('action')
    notes = (d.get('notes') or '').strip()[:400]
    valid = ('claim', 'issue_notice', 'apply_lockout', 'accept_deferral',
             'reject_deferral', 'conditional_clearance', 'waive')
    if action not in valid:
        return jsonify({"error": f"action must be one of {', '.join(valid)}"}), 400

    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT * FROM compliance_cases WHERE id = %s", (case_id,))
        case = c.fetchone()
        if not case:
            return jsonify({"error": "Case not found"}), 404
        if case['stage'] in ('resolved',):
            return jsonify({"error": "This case is already resolved"}), 400

        vet_id = g.current_user['id']
        today = datetime.date.today()

        if action == 'claim':
            c.execute("UPDATE compliance_cases SET vet_id=%s WHERE id=%s", (vet_id, case_id))
            _log_action(c, case_id, 'escalated', vet_id, 'Veterinarian', notes or 'Vet took over follow-up.')

        elif action == 'issue_notice':
            if case['stage'] not in ('reminder', 'vet_followup', 'deferred'):
                return jsonify({"error": "A notice only applies to a case still awaiting compliance"}), 400
            if not notes:
                return jsonify({"error": "A formal notice must say what was found on follow-up"}), 400
            c.execute("""UPDATE compliance_cases
                            SET stage='notice', vet_id=%s,
                                stage_due=DATE_ADD(CURDATE(), INTERVAL %s DAY)
                          WHERE id=%s""", (vet_id, protocols.GRACE_DAYS['notice'], case_id))
            _log_action(c, case_id, 'notice_issued', vet_id, 'Veterinarian', notes)

        elif action == 'apply_lockout':
            # Guardrails, in order: only after a notice, only after that
            # notice's grace period has actually run, and never over an
            # unresolved blocker. A supply failure is not non-compliance.
            if case['stage'] != 'notice':
                return jsonify({"error": "A lockout can only follow a formal notice the farmer did not act on"}), 400
            if case['stage_due'] and case['stage_due'] > today:
                return jsonify({"error": f"The notice grace period runs until {case['stage_due']}. "
                                         f"The farmer still has time to comply."}), 400
            if case['blocker_reason'] and not d.get('blocker_reviewed'):
                return jsonify({"error": "This farmer reported a blocker that is still open. "
                                         "Resolve or reject it before locking the animal out of trade."}), 400
            if not notes:
                return jsonify({"error": "Record why the lockout is justified — the farmer can dispute it"}), 400
            c.execute("""UPDATE compliance_cases
                            SET stage='penalty', trade_locked=TRUE, vet_id=%s, stage_due=NULL
                          WHERE id=%s""", (vet_id, case_id))
            _log_action(c, case_id, 'locked', vet_id, 'Veterinarian', notes)
            # Pull any live listing for this animal back off the market.
            c.execute("""UPDATE marketplace_listings SET status='pending_clearance'
                          WHERE animal_id=%s AND status='available'""", (case['animal_id'],))

        elif action == 'accept_deferral':
            if not case['blocker_reason']:
                return jsonify({"error": "No blocker has been reported on this case"}), 400
            days = int(d.get('days') or protocols.DEFER_DAYS.get(case['blocker_reason'], 30))
            c.execute("""UPDATE compliance_cases
                            SET stage='deferred', trade_locked=FALSE, vet_id=%s,
                                deferred_until=DATE_ADD(CURDATE(), INTERVAL %s DAY), stage_due=NULL
                          WHERE id=%s""", (vet_id, days, case_id))
            _log_action(c, case_id, 'defer_accepted', vet_id, 'Veterinarian',
                        notes or f"Blocker accepted — paused {days} days.")
            if case['trade_locked']:
                _log_action(c, case_id, 'unlocked', vet_id, 'Veterinarian', 'Lockout lifted with the deferral.')

        elif action == 'reject_deferral':
            if not notes:
                return jsonify({"error": "Say why the reported blocker was not accepted"}), 400
            c.execute("""UPDATE compliance_cases
                            SET stage='vet_followup', vet_id=%s, blocker_reason=NULL,
                                deferred_until=NULL,
                                stage_due=DATE_ADD(CURDATE(), INTERVAL %s DAY)
                          WHERE id=%s""", (vet_id, protocols.GRACE_DAYS['vet_followup'], case_id))
            _log_action(c, case_id, 'defer_rejected', vet_id, 'Veterinarian', notes)

        elif action == 'conditional_clearance':
            # Lets a farmer sell a locked animal on condition it is vaccinated
            # at the point of sale — the cash-flow release valve that keeps the
            # lockout from being ruinous for someone with one beast to sell.
            if not notes:
                return jsonify({"error": "Record the condition attached to this clearance"}), 400
            c.execute("""UPDATE compliance_cases
                            SET conditional_clearance=TRUE, vet_id=%s WHERE id=%s""", (vet_id, case_id))
            _log_action(c, case_id, 'conditional_clearance', vet_id, 'Veterinarian', notes)

        elif action == 'waive':
            if not notes:
                return jsonify({"error": "Record why this requirement does not apply"}), 400
            c.execute("""UPDATE compliance_cases
                            SET stage='waived', trade_locked=FALSE, vet_id=%s,
                                resolved_at=NOW(), stage_due=NULL
                          WHERE id=%s""", (vet_id, case_id))
            _log_action(c, case_id, 'waived', vet_id, 'Veterinarian', notes)

        db.commit()
        c.execute(_case_row_sql() + " WHERE cc.id = %s", (case_id,))
        return jsonify({"case": c.fetchone(), "message": "Case updated ✅"})
    finally:
        db.close()


@app.route('/compliance/summary', methods=['GET'])
@require_auth
def compliance_summary():
    """Counts for the dashboard cards, without shipping every case row."""
    role = g.current_user['role']
    db = get_db()
    try:
        if role == 'Farmer':
            sync_compliance(db, owner_id=g.current_user['id'])
            where, params = "cc.owner_id = %s", [g.current_user['id']]
        elif role in ('Veterinarian', 'Police', 'Admin'):
            sync_compliance(db, province=g.current_user.get('province'))
            where, params = "cc.province = %s", [g.current_user.get('province')]
        else:
            return jsonify({"error": "Not authorized"}), 403
        c = db.cursor()
        c.execute(f"""SELECT cc.stage, COUNT(*) AS n FROM compliance_cases cc
                       WHERE {where} GROUP BY cc.stage""", params)
        by_stage = {r['stage']: r['n'] for r in c.fetchall()}
        c.execute(f"""SELECT COUNT(*) AS n FROM compliance_cases cc
                       WHERE {where} AND cc.trade_locked = TRUE
                         AND cc.conditional_clearance = FALSE""", params)
        locked = c.fetchone()['n']
        return jsonify({
            "by_stage": by_stage,
            "open": sum(v for k, v in by_stage.items() if k not in ('resolved', 'waived')),
            "trade_locked": locked,
        })
    finally:
        db.close()


# ── ANIMAL LIFECYCLE TIMELINE ─────────────────────────────────
# One animal's whole recorded life in date order: born, registered here,
# every vaccination and treatment, illnesses picked up by diagnosis or by a
# fever alert on the collar, feed rations planned, weights taken, compliance
# steps, and finally its passage through the market.
#
# The data already existed — it was just scattered across eight tables and
# only ever surfaced as a flat list of health events, so nobody could see an
# animal's history as a history.

def _iso(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.isoformat(sep=' ', timespec='seconds')
    return str(v)


def _classify_health_event(event_type):
    """Sorts a health_events row into a lane the timeline can filter on.

    event_type is free text written by whatever screen logged it, so this
    reads the prefixes those screens actually use rather than assuming a
    clean taxonomy: 'Diagnostic: FMD' from Disease Detection, vaccine names
    straight out of HEALTH_PROTOCOLS, and dosage entries from the calculator.
    """
    t = (event_type or '').lower()
    if t.startswith('diagnostic') or 'illness' in t or 'symptom' in t:
        return 'illness'
    if 'vaccine' in t or 'vaccination' in t or t.startswith(('brucellosis', 'anthrax', 'lumpy',
                                                             'fmd', 'cbpp', 'blue tongue',
                                                             'pulpy kidney', 'pasteurella',
                                                             'foot rot', 'swine fever')):
        return 'vaccine'
    if 'dip' in t or 'tick' in t:
        return 'dipping'
    if 'deworm' in t or 'dose' in t or 'treatment' in t or 'injection' in t:
        return 'treatment'
    if 'birth' in t or 'calv' in t or 'pregnan' in t or 'gestation' in t:
        return 'breeding'
    return 'other'


@app.route('/animals/<int:animal_id>/timeline', methods=['GET'])
@require_auth
def animal_timeline(animal_id):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("""SELECT a.*, u.full_name AS owner_name
                       FROM animals a JOIN users u ON a.owner_id = u.id
                      WHERE a.id = %s""", (animal_id,))
        animal = c.fetchone()
        if not animal:
            return jsonify({"error": "Animal not found"}), 404
        if (g.current_user['role'] not in ('Veterinarian', 'Police', 'Admin')
                and animal['owner_id'] != g.current_user['id']):
            return jsonify({"error": "Not authorized to view this animal's record"}), 403

        ev = []

        def add(at, kind, title, detail='', actor=None, meta=None):
            if not at:
                return
            ev.append({"at": _iso(at), "kind": kind, "title": title,
                       "detail": detail, "actor": actor, "meta": meta or {}})

        # ── Origin ──
        add(animal['birth_date'], 'birth', 'Born',
            f"{animal['breed'] or animal['species']}"
            + (f" · birth weight {animal['birth_weight']}kg" if animal['birth_weight'] else ''))
        add(animal['created_at'], 'registration', 'Registered on PFUMA',
            f"Digital identity created"
            + (f" · ear tag {animal['tag_id']}" if animal['tag_id'] else '')
            + (f" · brand {animal['brand_id']}" if animal['brand_id'] else ''),
            actor=animal['owner_name'])

        # ── Health events (vaccines, treatments, diagnoses) ──
        c.execute("""SELECT he.*, u.full_name AS actor_name, u.role AS actor_role
                       FROM health_events he
                       LEFT JOIN users u ON he.performed_by = u.id
                      WHERE he.animal_id = %s""", (animal_id,))
        for e in c.fetchall():
            kind = _classify_health_event(e['event_type'])
            detail = e['notes'] or ''
            if e['next_due_date']:
                detail = (detail + ' · ' if detail else '') + f"next due {e['next_due_date']}"
            add(e['event_date'], kind, e['event_type'], detail,
                actor=e['actor_name'], meta={"role": e['actor_role'], "event_id": e['id']})

        # ── Weight ──
        c.execute("""SELECT month_label, weight_kg, recorded_at FROM weight_history
                      WHERE animal_id = %s ORDER BY id""", (animal_id,))
        for w in c.fetchall():
            add(w['recorded_at'], 'weight', f"Weight recorded — {w['weight_kg']}kg",
                f"Logged as {w['month_label']}" if w['month_label'] else '')

        # ── Nutrition ──
        c.execute("""SELECT fp.*, u.full_name AS actor_name FROM feeding_plans fp
                       LEFT JOIN users u ON fp.owner_id = u.id
                      WHERE fp.animal_id = %s""", (animal_id,))
        for p in c.fetchall():
            try:
                items = json.loads(p['items']) if isinstance(p['items'], str) else (p['items'] or [])
            except (ValueError, TypeError):
                items = []
            feeds = ', '.join(i.get('name', '') for i in items if i.get('name'))
            add(p['created_at'], 'feed', 'Feed ration planned',
                f"{feeds or 'Ration'} · {p['total_protein_g']}g protein, "
                f"{p['total_energy_mj']}MJ ({p['protein_status']}/{p['energy_status']})"
                + (f" · ${p['total_cost_usd']}" if p['total_cost_usd'] else ''),
                actor=p['actor_name'],
                meta={"protein_status": p['protein_status'], "energy_status": p['energy_status']})

        # ── Sensor alerts — an unexpected illness the collar caught first ──
        c.execute("""SELECT r.temp_c, r.heart_rate, r.fever_alert, r.theft_alert, r.received_at
                       FROM iot_readings r JOIN iot_devices d ON r.device_id = d.id
                      WHERE d.animal_id = %s AND (r.fever_alert = TRUE OR r.theft_alert = TRUE)
                      ORDER BY r.received_at DESC LIMIT 50""", (animal_id,))
        for r in c.fetchall():
            if r['fever_alert']:
                add(r['received_at'], 'illness', 'Fever alert from collar',
                    f"{r['temp_c']}°C, heart rate {r['heart_rate']}bpm — flagged by the IoT sensor")
            if r['theft_alert']:
                add(r['received_at'], 'alert', 'Geofence breach alert',
                    'Collar reported the animal outside its grazing zone')

        # ── Vet consultations ──
        c.execute("""SELECT vc.*, u.full_name AS vet_name FROM vet_cases vc
                       LEFT JOIN users u ON vc.vet_id = u.id
                      WHERE vc.animal_id = %s""", (animal_id,))
        for vcase in c.fetchall():
            add(vcase['created_at'], 'vet',
                f"Vet case opened — {vcase['subject']}",
                f"{vcase['category']} · {vcase['priority']} · {vcase['status']}",
                actor=vcase['vet_name'])

        # ── Compliance ──
        c.execute("""SELECT ca.*, cc.vaccine_name, u.full_name AS actor_name
                       FROM compliance_actions ca
                       JOIN compliance_cases cc ON ca.case_id = cc.id
                       LEFT JOIN users u ON ca.actor_id = u.id
                      WHERE cc.animal_id = %s ORDER BY ca.created_at""", (animal_id,))
        compliance_labels = {
            'opened': 'Vaccination overdue',
            'reminded': 'Reminder sent',
            'escalated': 'Raised for vet follow-up',
            'notice_issued': 'Formal notice issued',
            'deferred': 'Farmer reported a blocker',
            'defer_accepted': 'Blocker accepted — clock paused',
            'defer_rejected': 'Blocker not accepted',
            'locked': 'Trade lockout applied',
            'unlocked': 'Trade lockout lifted',
            'conditional_clearance': 'Conditional sale clearance granted',
            'resolved': 'Vaccination logged — case closed',
            'waived': 'Requirement waived',
        }
        for a in c.fetchall():
            add(a['created_at'], 'compliance',
                f"{compliance_labels.get(a['action'], a['action'])} — {a['vaccine_name']}",
                a['notes'] or '', actor=a['actor_name'] or 'PFUMA (automatic)')

        # ── Market ──
        c.execute("""SELECT * FROM marketplace_listings WHERE animal_id = %s""", (animal_id,))
        for l in c.fetchall():
            add(l['created_at'], 'trade', 'Listed on the marketplace',
                f"{l['product_name']} · ${l['price']} · {l['status']}")
            add(l['sold_at'], 'trade', 'Sold', f"{l['product_name']} · ${l['price']}")

        c.execute("""SELECT sc.*, u.full_name AS officer_name FROM sale_clearances sc
                       LEFT JOIN users u ON sc.officer_id = u.id
                      WHERE sc.animal_id = %s""", (animal_id,))
        for sc in c.fetchall():
            add(sc['created_at'], 'trade', 'Sale clearance requested',
                'Submitted to police for ownership and brand verification')
            if sc['resolved_at']:
                add(sc['resolved_at'], 'trade',
                    f"Sale clearance {sc['status']}",
                    (sc['notes'] or '') + (f" · permit {sc['movement_permit_number']}"
                                           if sc['movement_permit_number'] else ''),
                    actor=sc['officer_name'])

        ev.sort(key=lambda x: x['at'], reverse=True)
        return jsonify({
            "animal": {
                "id": animal['id'], "name": animal['name'], "species": animal['species'],
                "breed": animal['breed'], "tag_id": animal['tag_id'],
                "birth_date": _iso(animal['birth_date']),
                "registered_at": _iso(animal['created_at']),
                "owner_name": animal['owner_name'],
            },
            "events": ev,
        })
    finally:
        db.close()


# ── MEDICINE INVENTORY ────────────────────────────────────────
@app.route('/inventory/<int:owner_id>', methods=['GET'])
@require_auth
def get_inventory(owner_id):
    if g.current_user['id'] != owner_id and g.current_user['role'] != 'Veterinarian':
        return jsonify({"error": "Not authorized to view this medicine cabinet"}), 403
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM medicine_inventory WHERE owner_id = %s", (owner_id,))
    items = c.fetchall()
    db.close()
    return jsonify(items)


@app.route('/inventory/<int:item_id>/deduct', methods=['PATCH'])
@require_auth
def deduct_inventory(item_id):
    d = request.json
    dose = float(d.get('dose', 0))
    db = get_db()
    c = db.cursor()
    c.execute("SELECT stock, owner_id FROM medicine_inventory WHERE id = %s", (item_id,))
    row = c.fetchone()
    if not row:
        db.close(); return jsonify({"error": "Item not found"}), 404
    if row['owner_id'] != g.current_user['id'] and g.current_user['role'] != 'Veterinarian':
        db.close(); return jsonify({"error": "Not authorized to update this medicine cabinet"}), 403
    new_stock = max(0, float(row['stock']) - dose)
    c.execute("UPDATE medicine_inventory SET stock = %s WHERE id = %s", (new_stock, item_id))
    db.commit()
    db.close()
    return jsonify({"new_stock": new_stock, "message": f"{dose}ml deducted ✅"})


# ── MEDICATION RECOMMENDATIONS ──────────────────────────────────
# The clinical direction runs vet → farmer: a Veterinarian recommends a
# medicine/dose for a specific animal, and the farmer administers it from
# their own cabinet against that recommendation — replacing the earlier
# calculator where a farmer picked any medicine and dosed themselves with
# no vet involved at all.
@app.route('/medication-recommendations', methods=['POST'])
@require_auth
@require_role('Veterinarian')
@require_verified
def create_medication_recommendation():
    d = request.json or {}
    animal_id = d.get('animal_id')
    medicine_name = (d.get('medicine_name') or '').strip()
    dose_ml = d.get('dose_ml')
    if not animal_id or not medicine_name or dose_ml in (None, ''):
        return jsonify({"error": "animal_id, medicine_name, and dose_ml are required"}), 400
    try:
        dose_ml = float(dose_ml)
    except (TypeError, ValueError):
        return jsonify({"error": "dose_ml must be a number"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404

    c.execute("""
        INSERT INTO medication_recommendations
            (animal_id, farmer_id, vet_id, medicine_name, dose_ml, frequency, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (animal_id, animal['owner_id'], g.current_user['id'], medicine_name, dose_ml,
          d.get('frequency', ''), d.get('notes', '')))
    rec_id = c.lastrowid

    c.execute("SELECT name FROM animals WHERE id=%s", (animal_id,))
    animal_name = (c.fetchone() or {}).get('name', 'your animal')
    create_notification(
        c, animal['owner_id'], 'med_recommendation',
        f"Vet recommendation for {animal_name}",
        f"{g.current_user['full_name']} recommended {medicine_name} ({dose_ml}ml) for {animal_name}.",
        related_user_id=g.current_user['id'], animal_id=animal_id,
    )

    db.commit()
    db.close()
    return jsonify({"id": rec_id, "message": "Recommendation sent to the farmer ✅"}), 201


@app.route('/medication-recommendations', methods=['GET'])
@require_auth
def get_medication_recommendations():
    """Farmers see recommendations for their own animals (optionally
    filtered to one via ?animal_id=); vets see the ones they personally
    made; Police get none of this — not their concern."""
    requester = g.current_user
    animal_id = request.args.get('animal_id')
    db = get_db()
    c = db.cursor()
    sql = """
        SELECT mr.*, a.name AS animal_name, v.full_name AS vet_name, f.full_name AS farmer_name
        FROM medication_recommendations mr
        JOIN animals a ON mr.animal_id = a.id
        JOIN users v   ON mr.vet_id = v.id
        JOIN users f   ON mr.farmer_id = f.id
        WHERE 1=1
    """
    params = []
    if requester['role'] == 'Veterinarian':
        sql += " AND mr.vet_id = %s"; params.append(requester['id'])
    else:
        sql += " AND mr.farmer_id = %s"; params.append(requester['id'])
    if animal_id:
        sql += " AND mr.animal_id = %s"; params.append(animal_id)
    sql += " ORDER BY mr.created_at DESC"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/medication-recommendations/<int:rec_id>/administer', methods=['PATCH'])
@require_auth
def administer_medication_recommendation(rec_id):
    """Farmer marks a recommendation administered — deducts the
    recommended dose from their cabinet and logs it to the animal's health
    record, same real effects the old self-serve calculator had, just
    triggered by the vet's dose instead of the farmer's own pick."""
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM medication_recommendations WHERE id=%s", (rec_id,))
    rec = c.fetchone()
    if not rec:
        db.close(); return jsonify({"error": "Recommendation not found"}), 404
    if rec['farmer_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Only the farmer this was recommended to can administer it"}), 403
    if rec['status'] != 'pending':
        db.close(); return jsonify({"error": "This recommendation is no longer pending"}), 409

    c.execute("SELECT id, stock FROM medicine_inventory WHERE owner_id=%s AND medicine_name=%s",
               (g.current_user['id'], rec['medicine_name']))
    item = c.fetchone()
    if not item:
        db.close(); return jsonify({"error": f"{rec['medicine_name']} is not in your Medicine Cabinet"}), 409
    if float(item['stock']) < float(rec['dose_ml']):
        db.close(); return jsonify({"error": f"Insufficient stock — only {float(item['stock']):.1f}ml left"}), 409

    c.execute("UPDATE medicine_inventory SET stock = stock - %s WHERE id = %s", (rec['dose_ml'], item['id']))
    c.execute("UPDATE medication_recommendations SET status='administered', administered_at=NOW() WHERE id=%s", (rec_id,))

    c.execute("SELECT name FROM animals WHERE id=%s", (rec['animal_id'],))
    animal_name = (c.fetchone() or {}).get('name', '')
    c.execute("""
        INSERT INTO health_events (animal_id, animal_name, event_type, notes, performed_by)
        VALUES (%s,%s,%s,%s,%s)
    """, (rec['animal_id'], animal_name, f"Treatment: {rec['medicine_name']}",
          f"{rec['dose_ml']}ml administered per vet recommendation #{rec_id}", g.current_user['id']))

    db.commit()
    db.close()
    return jsonify({"message": f"{rec['dose_ml']}ml of {rec['medicine_name']} administered ✅"})


# ── MARKETPLACE ───────────────────────────────────────────────
def _attach_listing_photos(c, listings):
    """Fills in `photo_url` (single, for old clients) and `photos` (the
    full gallery, for new ones) on each listing in place.

    A livestock listing's photo used to come only from an optional upload
    made at listing-creation time — decoupled from the animal's own
    registration photo, so a seller who registered their animal with a
    picture (the common case) but skipped the separate listing-photo
    upload (also common, since it was marked optional) ended up with a
    listing that showed no picture at all on the marketplace, even though
    a picture of that exact animal existed in the database the whole time.
    For an animal-linked listing, the animal's photo gallery is now the
    source of truth; an explicitly-uploaded listing photo is prepended
    ahead of it rather than discarded."""
    for l in listings:
        if l.get('animal_id'):
            c.execute("SELECT image_url FROM animals WHERE id=%s", (l['animal_id'],))
            animal = c.fetchone() or {}
            gallery = animal_photo_urls(c, animal, animal_id=l['animal_id'])
            if l.get('photo_url') and l['photo_url'] not in gallery:
                gallery = [l['photo_url']] + gallery
            l['photos'] = gallery
            if not l.get('photo_url') and gallery:
                l['photo_url'] = gallery[0]
        else:
            l['photos'] = [l['photo_url']] if l.get('photo_url') else []


@app.route('/listings', methods=['GET'])
@require_auth
def get_listings():
    db = get_db()
    c = db.cursor()
    category = request.args.get('category')
    q = request.args.get('q', '')
    sql = """
        SELECT ml.*, u.full_name as seller_name, u.phone, u.province as seller_province
        FROM marketplace_listings ml JOIN users u ON ml.user_id = u.id
        WHERE ml.status = 'available'
    """
    params = []
    if category:
        sql += " AND ml.category = %s"; params.append(category)
    if q:
        sql += " AND ml.product_name LIKE %s"; params.append(f'%{q}%')
    sql += " ORDER BY ml.created_at DESC"
    c.execute(sql, params)
    listings = c.fetchall()
    _attach_listing_photos(c, listings)
    db.close()
    return jsonify(listings)


@app.route('/listings/mine', methods=['GET'])
@require_auth
def get_my_listings():
    """A seller's own listings at every stage of the lifecycle — pending
    clearance, live, sold, withdrawn — not just the 'available' ones the
    public marketplace shows. Lets a seller manage what they've posted
    without hunting for it inside the public feed."""
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT ml.*, u.full_name as seller_name, u.phone, u.province as seller_province
        FROM marketplace_listings ml JOIN users u ON ml.user_id = u.id
        WHERE ml.user_id = %s
        ORDER BY ml.created_at DESC
    """, (g.current_user['id'],))
    listings = c.fetchall()
    _attach_listing_photos(c, listings)
    db.close()
    return jsonify(listings)


@app.route('/listings', methods=['POST'])
@require_auth
@require_verified
def add_listing():
    d = request.form if request.form else (request.json or {})
    photo = request.files.get('photo')
    category = d.get('category', 'livestock')
    animal_id = d.get('animal_id') or None

    # Livestock listings exist to carry a verified digital passport — one
    # without a linked, owned animal record would skip police clearance
    # below entirely (needs_clearance is keyed off animal_id being set),
    # so a real animal_id is mandatory here, not just checked when present.
    if category == 'livestock' and not animal_id:
        return jsonify({"error": "A livestock listing must be linked to one of your registered animals"}), 400

    if animal_id:
        db = get_db(); c = db.cursor()
        c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
        animal = c.fetchone()
        # An animal under a vaccination trade lockout does not reach the
        # market. This is the whole penalty — there is no fine — and it is
        # scoped to the one animal, so the seller's other stock, feed and
        # produce listings are untouched.
        block = animal_trade_block(c, animal_id) if animal else None
        # An animal that's already sold, or already has a listing awaiting
        # clearance / live on the marketplace, must not be listed again —
        # otherwise a sold animal could be re-posted and traded a second time.
        c.execute("""SELECT status FROM marketplace_listings
                      WHERE animal_id=%s AND status IN ('pending_clearance','available','sold')
                      ORDER BY created_at DESC LIMIT 1""", (animal_id,))
        existing = c.fetchone()
        db.close()
        if not animal or animal['owner_id'] != g.current_user['id']:
            return jsonify({"error": "You can only list your own animals"}), 403
        if block:
            return jsonify({"error": block, "trade_locked": True}), 409
        if existing and existing['status'] == 'sold':
            return jsonify({"error": "This animal has already been sold and cannot be listed again."}), 409
        if existing:
            return jsonify({"error": "This animal already has an active marketplace listing."}), 409

    # Livestock listings tied to a specific animal must clear police review
    # (ownership/brand papers checked) before they're visible on the marketplace.
    needs_clearance = category == 'livestock' and animal_id
    status = 'pending_clearance' if needs_clearance else 'available'

    db = get_db()
    c = db.cursor()
    c.execute("""
        INSERT INTO marketplace_listings
            (user_id, animal_id, product_name, category, price, unit, quantity, location, description, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        g.current_user['id'], animal_id, d['product_name'],
        category, d['price'], d.get('unit', 'head'),
        d.get('quantity', 1), d.get('location', ''), d.get('description', ''), status
    ))
    listing_id = c.lastrowid

    if photo and photo.filename:
        try:
            rel_path = save_photo(photo, 'listings', listing_id)
            c.execute("UPDATE marketplace_listings SET photo_url=%s WHERE id=%s", (f"/uploads/{rel_path}", listing_id))
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400

    if needs_clearance:
        try:
            att = _leader_attestation(d)
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400
        c.execute("""
            INSERT INTO sale_clearances
                (animal_id, listing_id, seller_id, status,
                 leader_clearance, leader_type, leader_name, leader_village,
                 leader_cleared_on, leader_reference, leader_na_reason)
            VALUES (%s,%s,%s,'pending',%s,%s,%s,%s,%s,%s,%s)
        """, (animal_id, listing_id, g.current_user['id']) + att)

    db.commit()
    db.close()
    return jsonify({
        "id": listing_id,
        "status": status,
        "message": "Listing submitted for police clearance ✅" if needs_clearance else "Listing added ✅"
    })


def _leader_attestation(d):
    """Reads the traditional-authority attestation off a request payload.

    In communal areas a Sabuku (village head) or Mambo (chief) clears a sale
    before the police do. They hold no account here — the seller records the
    clearance and the officer verifies it, mirroring the paper process.
    A commercial farm on title deed has no traditional authority, so
    'not_applicable' plus a reason is a valid answer, not a missing one.
    """
    mode = (d.get('leader_clearance') or '').strip() or None
    if mode not in (None, 'attested', 'not_applicable'):
        raise ValueError("leader_clearance must be 'attested' or 'not_applicable'")
    if mode == 'attested':
        if not (d.get('leader_name') or '').strip():
            raise ValueError("Name of the Sabuku or Mambo who cleared the sale is required")
        if (d.get('leader_type') or '') not in ('Sabuku', 'Mambo'):
            raise ValueError("leader_type must be 'Sabuku' or 'Mambo'")
    if mode == 'not_applicable' and not (d.get('leader_na_reason') or '').strip():
        raise ValueError("Give a reason why no traditional clearance applies")
    return (
        mode,
        d.get('leader_type') or None,
        (d.get('leader_name') or '').strip() or None,
        (d.get('leader_village') or '').strip() or None,
        d.get('leader_cleared_on') or None,
        (d.get('leader_reference') or '').strip() or None,
        (d.get('leader_na_reason') or '').strip() or None,
    )


# ── SALE CLEARANCES ─────────────────────────────────────────────
@app.route('/clearances', methods=['GET'])
@require_auth
@require_role('Police')
@require_verified
def get_clearances():
    db = get_db()
    c = db.cursor()
    status = request.args.get('status')
    sql = """
        SELECT sc.*, a.name AS animal_name, a.species, a.tag_id, a.brand_id,
               ml.product_name, u.full_name AS seller_name, u.phone AS seller_phone
        FROM sale_clearances sc
        JOIN animals a ON sc.animal_id = a.id
        JOIN users u   ON sc.seller_id = u.id
        LEFT JOIN marketplace_listings ml ON sc.listing_id = ml.id
        WHERE 1=1
    """
    params = []
    if status:
        sql += " AND sc.status = %s"; params.append(status)
    sql += " ORDER BY sc.created_at ASC"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/clearances', methods=['POST'])
@require_auth
def create_clearance():
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id=%s", (d['animal_id'],))
    animal = c.fetchone()
    if not animal or animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only request clearance for your own animals"}), 403
    try:
        att = _leader_attestation(d)
    except ValueError as e:
        db.close(); return jsonify({"error": str(e)}), 400
    c.execute("""
        INSERT INTO sale_clearances
            (animal_id, listing_id, seller_id, status,
             leader_clearance, leader_type, leader_name, leader_village,
             leader_cleared_on, leader_reference, leader_na_reason)
        VALUES (%s,%s,%s,'pending',%s,%s,%s,%s,%s,%s,%s)
    """, (d['animal_id'], d.get('listing_id'), g.current_user['id']) + att)
    clearance_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": clearance_id, "message": "Clearance requested ✅"})


@app.route('/clearances/<int:clearance_id>', methods=['PATCH'])
@require_auth
@require_role('Police')
@require_verified
def resolve_clearance(clearance_id):
    d = request.json
    status = d.get('status')
    if status not in ('cleared', 'rejected'):
        return jsonify({"error": "status must be 'cleared' or 'rejected'"}), 400

    db = get_db()
    c = db.cursor()

    # A sale cannot be cleared until the traditional-authority step has been
    # answered — either a Sabuku/Mambo attestation, or an explicit reason why
    # none applies. Rejecting is always allowed; only approval is gated.
    if status == 'cleared':
        c.execute("SELECT leader_clearance, animal_id FROM sale_clearances WHERE id=%s", (clearance_id,))
        row = c.fetchone()
        if not row:
            db.close(); return jsonify({"error": "Clearance not found"}), 404
        if not row['leader_clearance']:
            db.close()
            return jsonify({"error": "No Sabuku or Mambo clearance on record for this sale. "
                                     "Ask the seller to record it, or to state why none applies, "
                                     "before you clear the listing."}), 409
        # Second gate on the same lockout the listing path enforces — a case
        # can reach 'penalty' after a listing was already submitted, and a
        # movement permit for an unvaccinated animal is exactly what the
        # vaccination requirement exists to prevent.
        block = animal_trade_block(c, row['animal_id'])
        if block:
            db.close()
            return jsonify({"error": block, "trade_locked": True}), 409

    c.execute("""
        UPDATE sale_clearances
        SET status=%s, movement_permit_number=%s, officer_id=%s, notes=%s, resolved_at=NOW()
        WHERE id=%s
    """, (status, d.get('movement_permit_number'), g.current_user['id'], d.get('notes'), clearance_id))

    c.execute("SELECT listing_id FROM sale_clearances WHERE id=%s", (clearance_id,))
    row = c.fetchone()
    if row and row['listing_id']:
        new_listing_status = 'available' if status == 'cleared' else 'withdrawn'
        c.execute("UPDATE marketplace_listings SET status=%s WHERE id=%s", (new_listing_status, row['listing_id']))

    db.commit()
    db.close()
    return jsonify({"status": status, "message": f"Sale {status} ✅"})


# ── MARKETPLACE BIDS ─────────────────────────────────────────────
@app.route('/listings/<int:listing_id>/bid', methods=['POST'])
@require_auth
@require_verified
def place_bid(listing_id):
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT status, category, product_name, user_id FROM marketplace_listings WHERE id=%s", (listing_id,))
    listing = c.fetchone()
    if not listing:
        db.close(); return jsonify({"error": "Listing not found"}), 404
    if listing['category'] == 'livestock' and listing['status'] != 'available':
        db.close()
        return jsonify({"error": "This listing has not been cleared by police yet — bidding is disabled until clearance is granted."}), 409

    c.execute("""
        INSERT INTO bids (listing_id, bidder_id, amount, message)
        VALUES (%s,%s,%s,%s)
    """, (listing_id, g.current_user['id'], d['amount'], d.get('message', '')))
    bid_id = c.lastrowid

    create_notification(
        c, listing['user_id'], 'bid_placed',
        f"New offer on {listing['product_name']}",
        f"{g.current_user['full_name']} offered USD {float(d['amount']):,.2f}.",
        related_user_id=g.current_user['id'], listing_id=listing_id,
    )

    db.commit()
    db.close()
    return jsonify({"id": bid_id, "message": "Bid submitted ✅"})


@app.route('/listings/<int:listing_id>/bids', methods=['GET'])
@require_auth
def get_bids(listing_id):
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    c.execute("SELECT user_id FROM marketplace_listings WHERE id=%s", (listing_id,))
    listing = c.fetchone()
    if not listing:
        db.close(); return jsonify({"error": "Listing not found"}), 404
    sql = """
        SELECT b.*, u.full_name AS bidder_name, u.phone AS bidder_phone
        FROM bids b JOIN users u ON b.bidder_id = u.id
        WHERE b.listing_id = %s
    """
    params = [listing_id]
    # Only the listing owner or Police see every bid; a bidder sees just their own.
    if requester['id'] != listing['user_id'] and requester['role'] != 'Police':
        sql += " AND b.bidder_id = %s"; params.append(requester['id'])
    sql += " ORDER BY b.created_at DESC"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/bids/mine', methods=['GET'])
@require_auth
def get_my_bids():
    """Real recent-bids feed for the current user (e.g. the Retailer
    Dashboard's "Recent Bids" panel) — bids they've personally placed,
    newest first."""
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT b.*, l.product_name, l.animal_id
        FROM bids b JOIN marketplace_listings l ON b.listing_id = l.id
        WHERE b.bidder_id = %s
        ORDER BY b.created_at DESC
        LIMIT 10
    """, (g.current_user['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/listings/<int:listing_id>/bids/<int:bid_id>/accept', methods=['PATCH'])
@require_auth
def accept_bid(listing_id, bid_id):
    """Seller accepts a bid: that bid is marked accepted, every other
    pending bid on the listing is declined, and the listing is closed out
    as sold at the accepted price. This is the only place a listing ever
    becomes 'sold' — needed so the price-trend chart reflects real sales."""
    db = get_db()
    c = db.cursor()
    c.execute("SELECT user_id, status, product_name FROM marketplace_listings WHERE id=%s", (listing_id,))
    listing = c.fetchone()
    if not listing:
        db.close(); return jsonify({"error": "Listing not found"}), 404
    if listing['user_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Only the listing owner can accept a bid"}), 403
    if listing['status'] == 'sold':
        db.close(); return jsonify({"error": "This listing is already sold"}), 409

    c.execute("SELECT id, amount, status, bidder_id FROM bids WHERE id=%s AND listing_id=%s", (bid_id, listing_id))
    bid = c.fetchone()
    if not bid:
        db.close(); return jsonify({"error": "Bid not found"}), 404
    if bid['status'] != 'pending':
        db.close(); return jsonify({"error": "This bid is no longer pending"}), 409

    c.execute("UPDATE bids SET status='accepted' WHERE id=%s", (bid_id,))
    c.execute("UPDATE bids SET status='declined' WHERE listing_id=%s AND id!=%s AND status='pending'", (listing_id, bid_id))
    c.execute("UPDATE marketplace_listings SET status='sold', price=%s, sold_at=NOW() WHERE id=%s", (bid['amount'], listing_id))

    # Both sides of the sale get a real notification, each carrying the
    # other party's user id so the frontend can drop them straight into a
    # PFUMA Messenger conversation instead of just showing text.
    c.execute("SELECT full_name FROM users WHERE id=%s", (bid['bidder_id'],))
    buyer_name = (c.fetchone() or {}).get('full_name', 'The buyer')
    create_notification(
        c, listing['user_id'], 'bid_accepted',
        f"Sold: {listing['product_name']}",
        f"You accepted {buyer_name}'s offer of USD {float(bid['amount']):,.2f}.",
        related_user_id=bid['bidder_id'], listing_id=listing_id,
    )
    create_notification(
        c, bid['bidder_id'], 'bid_accepted',
        f"Offer accepted: {listing['product_name']}",
        f"Your offer of USD {float(bid['amount']):,.2f} was accepted — message the seller to arrange collection.",
        related_user_id=listing['user_id'], listing_id=listing_id,
    )

    db.commit()
    db.close()
    return jsonify({"message": "Bid accepted — listing marked sold ✅"})


# ── NOTIFICATIONS ─────────────────────────────────────────────────
@app.route('/notifications', methods=['GET'])
@require_auth
def get_notifications():
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 50
    """, (g.current_user['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/notifications/<int:notif_id>/read', methods=['PATCH'])
@require_auth
def mark_notification_read(notif_id):
    db = get_db()
    c = db.cursor()
    c.execute("UPDATE notifications SET read_at=NOW() WHERE id=%s AND user_id=%s AND read_at IS NULL",
               (notif_id, g.current_user['id']))
    db.commit()
    db.close()
    return jsonify({"message": "Marked read"})


@app.route('/notifications/read-all', methods=['PATCH'])
@require_auth
def mark_all_notifications_read():
    db = get_db()
    c = db.cursor()
    c.execute("UPDATE notifications SET read_at=NOW() WHERE user_id=%s AND read_at IS NULL", (g.current_user['id'],))
    db.commit()
    db.close()
    return jsonify({"message": "All marked read"})


@app.route('/listings/price-trend', methods=['GET'])
@require_auth
def listings_price_trend():
    """Average sold price per month for livestock, last 6 months — real
    data only (no chart until sales actually happen)."""
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT DATE_FORMAT(sold_at, '%Y-%m') AS month, AVG(price) AS avg_price, COUNT(*) AS sales
        FROM marketplace_listings
        WHERE category = 'livestock' AND status = 'sold' AND sold_at IS NOT NULL
          AND sold_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY month
        ORDER BY month ASC
    """)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


# ── COOPERATIVES ───────────────────────────────────────────────
# A communal farmer's real shared dip tank / grazing association — a
# Farmer belongs to at most one (mirrors the real "one dip tank" constraint).
@app.route('/cooperatives', methods=['POST'])
@require_auth
@require_role('Farmer')
def create_cooperative():
    d = request.json or {}
    if not (d.get('name') or '').strip():
        return jsonify({"error": "name is required"}), 400
    province = (d.get('province') or g.current_user.get('province') or '').strip()
    if not province:
        return jsonify({"error": "province is required"}), 400
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM cooperative_members WHERE user_id=%s", (g.current_user['id'],))
    if c.fetchone():
        db.close(); return jsonify({"error": "You're already in a cooperative — leave it first to create or join another"}), 409
    c.execute("""
        INSERT INTO cooperatives (name, description, province, district, dip_tank_location, created_by)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (d['name'], d.get('description', ''), province, d.get('district', ''), d.get('dip_tank_location', ''), g.current_user['id']))
    coop_id = c.lastrowid
    c.execute("INSERT INTO cooperative_members (cooperative_id, user_id, role) VALUES (%s,%s,'admin')", (coop_id, g.current_user['id']))
    db.commit()
    db.close()
    return jsonify({"id": coop_id, "message": "Cooperative created ✅"})


@app.route('/cooperatives', methods=['GET'])
@require_auth
def list_cooperatives():
    province = request.args.get('province') or g.current_user.get('province')
    district = request.args.get('district')
    db = get_db()
    c = db.cursor()
    sql = """
        SELECT co.*, COUNT(cm.id) AS member_count
        FROM cooperatives co LEFT JOIN cooperative_members cm ON cm.cooperative_id = co.id
        WHERE 1=1
    """
    params = []
    if province:
        sql += " AND co.province = %s"; params.append(province)
    if district:
        sql += " AND co.district = %s"; params.append(district)
    sql += " GROUP BY co.id ORDER BY co.name"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/cooperatives/<int:coop_id>/join', methods=['POST'])
@require_auth
@require_role('Farmer')
def join_cooperative(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM cooperatives WHERE id=%s", (coop_id,))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Cooperative not found"}), 404
    c.execute("SELECT id FROM cooperative_members WHERE user_id=%s", (g.current_user['id'],))
    if c.fetchone():
        db.close(); return jsonify({"error": "You're already in a cooperative — leave it first to join another"}), 409
    c.execute("INSERT INTO cooperative_members (cooperative_id, user_id) VALUES (%s,%s)", (coop_id, g.current_user['id']))
    db.commit()
    db.close()
    return jsonify({"message": "Joined ✅"})


@app.route('/cooperatives/<int:coop_id>/leave', methods=['POST'])
@require_auth
def leave_cooperative(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("DELETE FROM cooperative_members WHERE cooperative_id=%s AND user_id=%s", (coop_id, g.current_user['id']))
    db.commit()
    changed = c.rowcount
    db.close()
    if not changed:
        return jsonify({"error": "You're not a member of this cooperative"}), 404
    return jsonify({"message": "Left cooperative ✅"})


@app.route('/cooperatives/mine', methods=['GET'])
@require_auth
def my_cooperative():
    db = get_db()
    c = db.cursor()
    c.execute("SELECT cooperative_id FROM cooperative_members WHERE user_id=%s", (g.current_user['id'],))
    membership = c.fetchone()
    if not membership:
        db.close(); return jsonify(None)
    c.execute("SELECT * FROM cooperatives WHERE id=%s", (membership['cooperative_id'],))
    coop = c.fetchone()
    c.execute("""
        SELECT u.id, u.full_name, u.org_name, u.phone, cm.role, cm.joined_at,
               (SELECT COUNT(*) FROM animals a WHERE a.owner_id = u.id) AS animal_count
        FROM cooperative_members cm JOIN users u ON cm.user_id = u.id
        WHERE cm.cooperative_id = %s
        ORDER BY cm.role DESC, u.full_name
    """, (coop['id'],))
    coop['members'] = c.fetchall()
    db.close()
    return jsonify(coop)


@app.route('/cooperatives/<int:coop_id>/dip-schedule', methods=['POST'])
@require_auth
def add_dip_schedule(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT role FROM cooperative_members WHERE cooperative_id=%s AND user_id=%s", (coop_id, g.current_user['id']))
    membership = c.fetchone()
    if not membership or membership['role'] != 'admin':
        db.close(); return jsonify({"error": "Only a cooperative admin can schedule a dip"}), 403
    d = request.json or {}
    if not d.get('scheduled_date'):
        db.close(); return jsonify({"error": "scheduled_date is required"}), 400
    c.execute("""
        INSERT INTO cooperative_dip_schedule (cooperative_id, scheduled_date, notes, created_by)
        VALUES (%s,%s,%s,%s)
    """, (coop_id, d['scheduled_date'], d.get('notes', ''), g.current_user['id']))
    db.commit()
    entry_id = c.lastrowid
    db.close()
    return jsonify({"id": entry_id, "message": "Dip day scheduled ✅"})


@app.route('/cooperatives/<int:coop_id>/dip-schedule', methods=['GET'])
@require_auth
def get_dip_schedule(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM cooperative_members WHERE cooperative_id=%s AND user_id=%s", (coop_id, g.current_user['id']))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Not a member of this cooperative"}), 403
    c.execute("""
        SELECT ds.*, u.full_name AS created_by_name FROM cooperative_dip_schedule ds
        JOIN users u ON ds.created_by = u.id
        WHERE ds.cooperative_id = %s AND ds.scheduled_date >= CURDATE()
        ORDER BY ds.scheduled_date ASC
    """, (coop_id,))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


# ── COOPERATIVE VET REQUESTS ──────────────────────────────────────
@app.route('/cooperatives/<int:coop_id>/vet-requests', methods=['POST'])
@require_auth
def create_vet_request(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM cooperative_members WHERE cooperative_id=%s AND user_id=%s", (coop_id, g.current_user['id']))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Not a member of this cooperative"}), 403
    d = request.json or {}
    if not (d.get('reason') or '').strip():
        db.close(); return jsonify({"error": "reason is required"}), 400
    c.execute("""
        INSERT INTO cooperative_vet_requests (cooperative_id, requested_by, reason, preferred_date)
        VALUES (%s,%s,%s,%s)
    """, (coop_id, g.current_user['id'], d['reason'], d.get('preferred_date') or None))
    db.commit()
    req_id = c.lastrowid
    db.close()
    return jsonify({"id": req_id, "message": "Vet request posted ✅"})


@app.route('/cooperatives/<int:coop_id>/vet-requests', methods=['GET'])
@require_auth
def get_coop_vet_requests(coop_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM cooperative_members WHERE cooperative_id=%s AND user_id=%s", (coop_id, g.current_user['id']))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Not a member of this cooperative"}), 403
    c.execute("""
        SELECT vr.*, u.full_name AS requested_by_name, v.full_name AS vet_name
        FROM cooperative_vet_requests vr
        JOIN users u ON vr.requested_by = u.id
        LEFT JOIN users v ON vr.vet_id = v.id
        WHERE vr.cooperative_id = %s
        ORDER BY vr.created_at DESC
    """, (coop_id,))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/vet-requests', methods=['GET'])
@require_auth
@require_role('Veterinarian')
def list_vet_requests():
    province = request.args.get('province') or g.current_user.get('province')
    status = request.args.get('status', 'open')
    db = get_db()
    c = db.cursor()
    sql = """
        SELECT vr.*, co.name AS cooperative_name, co.province, co.district, co.dip_tank_location,
               u.full_name AS requested_by_name
        FROM cooperative_vet_requests vr
        JOIN cooperatives co ON vr.cooperative_id = co.id
        JOIN users u ON vr.requested_by = u.id
        WHERE 1=1
    """
    params = []
    if province:
        sql += " AND co.province = %s"; params.append(province)
    if status:
        sql += " AND vr.status = %s"; params.append(status)
    sql += " ORDER BY vr.created_at DESC"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/vet-requests/<int:req_id>/claim', methods=['PATCH'])
@require_auth
@require_role('Veterinarian')
def claim_vet_request(req_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT status FROM cooperative_vet_requests WHERE id=%s", (req_id,))
    row = c.fetchone()
    if not row:
        db.close(); return jsonify({"error": "Request not found"}), 404
    if row['status'] != 'open':
        db.close(); return jsonify({"error": f"This request is already {row['status']}"}), 409
    c.execute("UPDATE cooperative_vet_requests SET status='claimed', vet_id=%s WHERE id=%s", (g.current_user['id'], req_id))
    db.commit()
    db.close()
    return jsonify({"message": "Request claimed ✅"})


@app.route('/vet-requests/<int:req_id>/complete', methods=['PATCH'])
@require_auth
@require_role('Veterinarian')
def complete_vet_request(req_id):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT status, vet_id FROM cooperative_vet_requests WHERE id=%s", (req_id,))
    row = c.fetchone()
    if not row:
        db.close(); return jsonify({"error": "Request not found"}), 404
    if row['vet_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Only the vet who claimed this can mark it complete"}), 403
    if row['status'] != 'claimed':
        db.close(); return jsonify({"error": f"Request must be claimed first (currently {row['status']})"}), 409
    c.execute("UPDATE cooperative_vet_requests SET status='completed', completed_at=NOW() WHERE id=%s", (req_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Request marked complete ✅"})


# ── OUTBREAKS ──────────────────────────────────────────────────
# Visible to every user in the affected province — a real safety warning,
# not just Vet/Police oversight. Only Vet/Police can file or update one.
@app.route('/outbreaks', methods=['POST'])
@require_auth
@require_role('Veterinarian', 'Police')
def report_outbreak():
    d = request.json or {}
    if not (d.get('disease_name') or '').strip():
        return jsonify({"error": "disease_name is required"}), 400
    province = (d.get('province') or g.current_user.get('province') or '').strip()
    if not province:
        return jsonify({"error": "province is required"}), 400
    db = get_db()
    c = db.cursor()
    c.execute("""
        INSERT INTO outbreaks (disease_name, district, province, details, affected_farms, animals_at_risk, reported_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (
        d['disease_name'], d.get('district', ''), province, d.get('details', ''),
        d.get('affected_farms', 0), d.get('animals_at_risk', ''), g.current_user['id']
    ))
    outbreak_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": outbreak_id, "message": "Outbreak reported ✅"})


@app.route('/outbreaks', methods=['GET'])
@require_auth
def get_outbreaks():
    province = request.args.get('province') or g.current_user.get('province')
    status = request.args.get('status', 'active')
    db = get_db()
    c = db.cursor()
    sql = """
        SELECT o.*, u.full_name AS reported_by_name
        FROM outbreaks o JOIN users u ON o.reported_by = u.id
        WHERE 1=1
    """
    params = []
    if province:
        sql += " AND o.province = %s"; params.append(province)
    if status:
        sql += " AND o.status = %s"; params.append(status)
    sql += " ORDER BY o.created_at DESC"
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/outbreaks/<int:outbreak_id>', methods=['PATCH'])
@require_auth
@require_role('Veterinarian', 'Police')
def update_outbreak(outbreak_id):
    d = request.json or {}
    status = d.get('status')
    if status not in ('active', 'contained', 'resolved'):
        return jsonify({"error": "status must be active, contained, or resolved"}), 400
    db = get_db()
    c = db.cursor()
    c.execute("SELECT reported_by FROM outbreaks WHERE id=%s", (outbreak_id,))
    row = c.fetchone()
    if not row:
        db.close(); return jsonify({"error": "Outbreak not found"}), 404
    if row['reported_by'] != g.current_user['id'] and g.current_user['role'] != 'Police':
        db.close(); return jsonify({"error": "Only the reporting officer or Police can update this"}), 403
    resolved_at = "NOW()" if status in ('contained', 'resolved') else "NULL"
    c.execute(f"UPDATE outbreaks SET status=%s, resolved_at={resolved_at} WHERE id=%s", (status, outbreak_id))
    db.commit()
    db.close()
    return jsonify({"message": "Outbreak updated ✅"})


# ── VETERINARIAN OVERSIGHT ───────────────────────────────────────
@app.route('/vet/farm-registry', methods=['GET'])
@require_auth
@require_role('Veterinarian')
def vet_farm_registry():
    province = g.current_user.get('province')
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT u.id, u.full_name, u.org_name, u.province, u.verification_status,
               COUNT(a.id) AS animal_count
        FROM users u LEFT JOIN animals a ON a.owner_id = u.id
        WHERE u.role = 'Farmer' AND u.province = %s
        GROUP BY u.id
        ORDER BY u.full_name
    """, (province,))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


@app.route('/vet/reporting-health', methods=['GET'])
@require_auth
@require_role('Veterinarian')
def vet_reporting_health():
    province = g.current_user.get('province')
    db = get_db()
    c = db.cursor()
    c.execute("SELECT COUNT(*) AS total FROM users WHERE role='Farmer' AND province=%s", (province,))
    total_farmers = c.fetchone()['total']
    rows = []
    for i in range(6, -1, -1):
        c.execute("""
            SELECT COUNT(DISTINCT a.owner_id) AS reporting
            FROM health_events he
            JOIN animals a ON he.animal_id = a.id
            JOIN users u ON a.owner_id = u.id
            WHERE u.role = 'Farmer' AND u.province = %s
              AND DATE(he.event_date) = DATE(DATE_SUB(NOW(), INTERVAL %s DAY))
        """, (province, i))
        reporting = c.fetchone()['reporting']
        pct = round((reporting / total_farmers) * 100) if total_farmers else 0
        rows.append({
            "day": (datetime.datetime.now() - datetime.timedelta(days=i)).strftime('%a'),
            "sync": pct,
        })
    db.close()
    return jsonify(rows)


@app.route('/vet/cert-queue', methods=['GET'])
@require_auth
@require_role('Veterinarian')
def vet_cert_queue():
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT COUNT(DISTINCT c.id) AS total
        FROM conversations c
        JOIN conversation_messages cm ON cm.conversation_id = c.id
        WHERE c.category = 'Trade Certification'
          AND (c.user_a_id = %s OR c.user_b_id = %s)
          AND cm.sender_id != %s AND cm.read_at IS NULL
    """, (g.current_user['id'], g.current_user['id'], g.current_user['id']))
    total = c.fetchone()['total']
    db.close()
    return jsonify({"pending": total})


# ── ORDERS (Supplier fulfillment) ─────────────────────────────────
@app.route('/orders', methods=['POST'])
@require_auth
@require_role('Farmer')
@require_verified
def place_order():
    d = request.json or {}
    listing_id = d.get('listing_id')
    quantity = d.get('quantity')
    if not listing_id or not quantity or float(quantity) <= 0:
        return jsonify({"error": "listing_id and a positive quantity are required"}), 400
    db = get_db()
    c = db.cursor()
    c.execute("SELECT user_id, category FROM marketplace_listings WHERE id=%s", (listing_id,))
    listing = c.fetchone()
    if not listing:
        db.close(); return jsonify({"error": "Listing not found"}), 404
    if listing['category'] not in ('medicine', 'equipment'):
        db.close(); return jsonify({"error": "Orders are only for medicine/equipment listings — use a bid for livestock or feed"}), 400
    c.execute("""
        INSERT INTO orders (listing_id, farmer_id, supplier_id, quantity)
        VALUES (%s,%s,%s,%s)
    """, (listing_id, g.current_user['id'], listing['user_id'], quantity))
    order_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": order_id, "message": "Order placed ✅"})


@app.route('/orders/mine', methods=['GET'])
@require_auth
def get_my_orders():
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    if requester['role'] == 'Supplier':
        c.execute("""
            SELECT o.*, l.product_name, u.full_name AS farmer_name
            FROM orders o
            JOIN marketplace_listings l ON o.listing_id = l.id
            JOIN users u ON o.farmer_id = u.id
            WHERE o.supplier_id = %s
            ORDER BY o.created_at DESC
        """, (requester['id'],))
    else:
        c.execute("""
            SELECT o.*, l.product_name, u.full_name AS supplier_name
            FROM orders o
            JOIN marketplace_listings l ON o.listing_id = l.id
            JOIN users u ON o.supplier_id = u.id
            WHERE o.farmer_id = %s
            ORDER BY o.created_at DESC
        """, (requester['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify(rows)


def _advance_order(order_id, from_status, to_status, timestamp_col):
    db = get_db()
    c = db.cursor()
    c.execute("SELECT supplier_id, status FROM orders WHERE id=%s", (order_id,))
    order = c.fetchone()
    if not order:
        db.close(); return jsonify({"error": "Order not found"}), 404
    if order['supplier_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Only the supplier can update this order"}), 403
    if order['status'] != from_status:
        db.close(); return jsonify({"error": f"Order must be {from_status} first (currently {order['status']})"}), 409
    c.execute(f"UPDATE orders SET status=%s, {timestamp_col}=NOW() WHERE id=%s", (to_status, order_id))
    db.commit()
    db.close()
    return jsonify({"message": f"Order marked {to_status} ✅"})


@app.route('/orders/<int:order_id>/dispatch', methods=['PATCH'])
@require_auth
@require_role('Supplier')
def dispatch_order(order_id):
    return _advance_order(order_id, 'pending', 'dispatched', 'dispatched_at')


@app.route('/orders/<int:order_id>/deliver', methods=['PATCH'])
@require_auth
@require_role('Supplier')
def deliver_order(order_id):
    return _advance_order(order_id, 'dispatched', 'delivered', 'delivered_at')


@app.route('/supplier/demand', methods=['GET'])
@require_auth
@require_role('Supplier')
def supplier_demand():
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT YEARWEEK(created_at, 3) AS yw, MIN(DATE(created_at)) AS week_start, COUNT(*) AS orders
        FROM orders
        WHERE supplier_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 6 WEEK)
        GROUP BY yw
        ORDER BY yw ASC
    """, (g.current_user['id'],))
    rows = c.fetchall()
    db.close()
    return jsonify([{"week": r['week_start'].strftime('%b %d'), "orders": r['orders']} for r in rows])


@app.route('/supplier/fulfillment-rate', methods=['GET'])
@require_auth
@require_role('Supplier')
def supplier_fulfillment_rate():
    db = get_db()
    c = db.cursor()
    c.execute("""
        SELECT status, COUNT(*) AS total FROM orders
        WHERE supplier_id = %s AND status IN ('dispatched','delivered','cancelled')
        GROUP BY status
    """, (g.current_user['id'],))
    counts = {r['status']: r['total'] for r in c.fetchall()}
    db.close()
    resolved = counts.get('dispatched', 0) + counts.get('delivered', 0) + counts.get('cancelled', 0)
    if resolved == 0:
        return jsonify({"rate": None, "message": "No resolved orders yet"})
    rate = round((counts.get('delivered', 0) / resolved) * 100)
    return jsonify({"rate": rate})


# ── FEED ANALYZER ─────────────────────────────────────────────
# Nutrition reference data — public, not user-specific, so no auth required.
@app.route('/feed', methods=['GET'])
def get_all_feeds():
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM feed_types")
    feeds = c.fetchall()
    db.close()
    return jsonify(feeds)


@app.route('/feed/search', methods=['GET'])
def search_feed():
    q = request.args.get('q', '')
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM feed_types WHERE name LIKE %s OR suitable_for LIKE %s", (f'%{q}%', f'%{q}%'))
    results = c.fetchall()
    db.close()
    return jsonify(results)


# Ration Builder — this is what makes Feed Analyzer more than a nutrition
# lookup table: it computes what THIS animal actually needs (species +
# live weight + age → daily protein/energy target, standard maintenance
# formulas scaled by growth stage) and prices a chosen ration against real
# PFUMA Marketplace listings, not generic numbers.
RATION_SUPPORTED_SPECIES = {'Cattle', 'Goat'}

# Maintenance requirement coefficients per kg^0.75 of live weight.
# Goats need slightly more CP and less ME per unit metabolic weight than
# cattle — standard small-ruminant vs. large-ruminant maintenance ratios.
_MAINTENANCE = {
    'Cattle': {'energy_mj': 0.50, 'protein_g': 3.5},
    'Goat':   {'energy_mj': 0.45, 'protein_g': 3.8},
}

# Growth-stage multiplier on top of maintenance — young growing stock need
# substantially more energy/protein per kg bodyweight than mature animals.
def _life_stage(birth_date):
    if not birth_date:
        return 'adult', 1.0
    if isinstance(birth_date, str):
        birth_date = datetime.date.fromisoformat(birth_date)
    age_months = (datetime.date.today() - birth_date).days / 30.44
    if age_months < 6:
        return 'young', 1.8
    if age_months < 18:
        return 'growing', 1.4
    return 'adult', 1.0


def _compute_requirement(species, weight_kg):
    coef = _MAINTENANCE.get(species, _MAINTENANCE['Cattle'])
    metabolic_weight = float(weight_kg) ** 0.75
    return coef['energy_mj'] * metabolic_weight, coef['protein_g'] * metabolic_weight


def _nutrient_status(total, target):
    if target <= 0:
        return 'balanced'
    ratio = total / target
    if ratio < 0.9:
        return 'deficient'
    if ratio > 1.15:
        return 'excess'
    return 'balanced'


def _best_market_price(db_cursor, feed_name):
    """Cheapest live 'available' Marketplace listing whose product name
    matches this feed — real local pricing instead of a generic number."""
    db_cursor.execute("""
        SELECT ml.id AS listing_id, ml.price, ml.unit, u.full_name AS supplier_name, u.province
        FROM marketplace_listings ml
        JOIN users u ON u.id = ml.user_id
        WHERE ml.category = 'feed' AND ml.status = 'available' AND ml.product_name LIKE %s
        ORDER BY ml.price ASC LIMIT 1
    """, (f'%{feed_name}%',))
    return db_cursor.fetchone()


def _load_animal_for_ration(c, animal_id):
    c.execute("SELECT id, owner_id, name, species, current_weight, birth_date FROM animals WHERE id = %s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        return None, (jsonify({"error": "Animal not found"}), 404)
    if g.current_user['role'] not in ('Veterinarian', 'Police', 'Admin') and animal['owner_id'] != g.current_user['id']:
        return None, (jsonify({"error": "You can only build rations for your own animals"}), 403)
    if animal['species'] not in RATION_SUPPORTED_SPECIES:
        return None, (jsonify({"error": f"Ration planning currently supports Cattle and Goat only (this animal is {animal['species']})"}), 400)
    if not animal['current_weight']:
        return None, (jsonify({"error": "This animal has no recorded weight yet — add one in Herd Management first"}), 400)
    return animal, None


@app.route('/feed/requirements', methods=['GET'])
@require_auth
def feed_requirements():
    animal_id = request.args.get('animal_id')
    if not animal_id:
        return jsonify({"error": "animal_id is required"}), 400
    db = get_db()
    c = db.cursor()
    animal, error = _load_animal_for_ration(c, animal_id)
    if error:
        db.close()
        return error

    life_stage, stage_mult = _life_stage(animal['birth_date'])
    energy_mj, protein_g = _compute_requirement(animal['species'], animal['current_weight'])
    db.close()
    return jsonify({
        "animal_id": animal['id'],
        "animal_name": animal['name'],
        "species": animal['species'],
        "weight_kg": float(animal['current_weight']),
        "life_stage": life_stage,
        "stage_multiplier": stage_mult,
        "target_energy_mj": round(energy_mj * stage_mult, 2),
        "target_protein_g": round(protein_g * stage_mult, 2),
    })


@app.route('/feed/prices', methods=['GET'])
def feed_prices():
    """Feed reference data enriched with live Marketplace pricing, so a
    farmer sees what each feed actually costs from real PFUMA suppliers
    right now, not just its nutrient content."""
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM feed_types")
    feeds = c.fetchall()
    for feed in feeds:
        listing = _best_market_price(c, feed['name'])
        feed['market_price'] = listing
    db.close()
    return jsonify(feeds)


@app.route('/feed/plan', methods=['POST'])
@require_auth
def create_feed_plan():
    d = request.json or {}
    animal_id = d.get('animal_id')
    items_in = d.get('items') or []
    if not animal_id or not items_in:
        return jsonify({"error": "animal_id and at least one feed item are required"}), 400

    db = get_db()
    c = db.cursor()
    animal, error = _load_animal_for_ration(c, animal_id)
    if error:
        db.close()
        return error

    life_stage, stage_mult = _life_stage(animal['birth_date'])
    energy_mj, protein_g = _compute_requirement(animal['species'], animal['current_weight'])
    target_energy_mj = round(energy_mj * stage_mult, 2)
    target_protein_g = round(protein_g * stage_mult, 2)

    feed_ids = [i['feed_type_id'] for i in items_in if i.get('feed_type_id')]
    if not feed_ids:
        db.close()
        return jsonify({"error": "No valid feed items supplied"}), 400
    placeholders = ','.join(['%s'] * len(feed_ids))
    c.execute(f"SELECT * FROM feed_types WHERE id IN ({placeholders})", feed_ids)
    feed_lookup = {f['id']: f for f in c.fetchall()}

    line_items, total_protein_g, total_energy_mj, total_cost = [], 0.0, 0.0, 0.0
    for i in items_in:
        feed = feed_lookup.get(i.get('feed_type_id'))
        qty_kg = float(i.get('qty_kg') or 0)
        if not feed or qty_kg <= 0:
            continue
        item_protein_g = qty_kg * 1000 * (float(feed['protein_percent'] or 0) / 100)
        item_energy_mj = qty_kg * float(feed['energy_mj'] or 0)
        listing = _best_market_price(c, feed['name'])
        unit_cost = float(listing['price']) if listing else None
        line_cost = round(unit_cost * qty_kg, 2) if unit_cost is not None else 0.0
        total_protein_g += item_protein_g
        total_energy_mj += item_energy_mj
        total_cost += line_cost
        line_items.append({
            "feed_type_id": feed['id'],
            "name": feed['name'],
            "qty_kg": qty_kg,
            "protein_g": round(item_protein_g, 1),
            "energy_mj": round(item_energy_mj, 1),
            "unit_cost_usd": unit_cost,
            "line_cost_usd": line_cost,
            "priced": listing is not None,
            "supplier_name": listing['supplier_name'] if listing else None,
        })

    if not line_items:
        db.close()
        return jsonify({"error": "No valid feed items supplied"}), 400

    protein_status = _nutrient_status(total_protein_g, target_protein_g)
    energy_status = _nutrient_status(total_energy_mj, target_energy_mj)

    c.execute("""
        INSERT INTO feeding_plans
          (animal_id, owner_id, species, weight_kg, life_stage, target_protein_g, target_energy_mj,
           items, total_protein_g, total_energy_mj, total_cost_usd, protein_status, energy_status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        animal['id'], animal['owner_id'], animal['species'], animal['current_weight'], life_stage,
        target_protein_g, target_energy_mj, json.dumps(line_items),
        round(total_protein_g, 1), round(total_energy_mj, 1), round(total_cost, 2),
        protein_status, energy_status,
    ))
    plan_id = c.lastrowid
    # Feeds the animal's running cost-to-date, which the Herd view already
    # displays but had nothing populating it until now.
    c.execute("UPDATE animals SET cost_to_date = cost_to_date + %s WHERE id = %s", (round(total_cost, 2), animal['id']))
    db.commit()
    db.close()

    return jsonify({
        "id": plan_id,
        "animal_id": animal['id'],
        "animal_name": animal['name'],
        "species": animal['species'],
        "weight_kg": float(animal['current_weight']),
        "life_stage": life_stage,
        "target_protein_g": target_protein_g,
        "target_energy_mj": target_energy_mj,
        "total_protein_g": round(total_protein_g, 1),
        "total_energy_mj": round(total_energy_mj, 1),
        "total_cost_usd": round(total_cost, 2),
        "protein_status": protein_status,
        "energy_status": energy_status,
        "items": line_items,
        "created_at": datetime.datetime.now().isoformat(),
    }), 201


@app.route('/feed/plans', methods=['GET'])
@require_auth
def list_feed_plans():
    animal_id = request.args.get('animal_id')
    db = get_db()
    c = db.cursor()
    if animal_id:
        animal, error = _load_animal_for_ration(c, animal_id)
        if error:
            db.close()
            return error
        c.execute("SELECT * FROM feeding_plans WHERE animal_id = %s ORDER BY created_at DESC", (animal_id,))
    else:
        c.execute("SELECT * FROM feeding_plans WHERE owner_id = %s ORDER BY created_at DESC LIMIT 50", (g.current_user['id'],))
    plans = c.fetchall()
    db.close()
    for p in plans:
        p['items'] = json.loads(p['items'])
    return jsonify(plans)


# ── DASHBOARD ─────────────────────────────────────────────────
@app.route('/dashboard/<int:user_id>', methods=['GET'])
@require_auth
def get_dashboard(user_id):
    if user_id != g.current_user['id'] and g.current_user['role'] != 'Police':
        return jsonify({"error": "Not authorized to view this dashboard"}), 403
    db = get_db()
    c = db.cursor()
    c.execute("SELECT COUNT(*) as total FROM animals WHERE owner_id = %s", (user_id,))
    animals_count = c.fetchone()['total']
    c.execute("SELECT COUNT(*) as total FROM marketplace_listings WHERE user_id = %s AND status = 'available'", (user_id,))
    listings_count = c.fetchone()['total']
    c.execute("SELECT COUNT(*) as total FROM messages WHERE case_id IN (SELECT id FROM vet_cases WHERE farmer_id = %s)", (user_id,))
    messages_count = c.fetchone()['total']
    c.execute("SELECT SUM(current_weight * 1.5 + 500) as total_value FROM animals WHERE owner_id = %s", (user_id,))
    row = c.fetchone()
    total_value = float(row['total_value'] or 0)
    db.close()
    return jsonify({
        "animals":      animals_count,
        "listings":     listings_count,
        "messages":     messages_count,
        "total_value":  total_value
    })


# ── VET CASES ─────────────────────────────────────────────────
@app.route('/cases', methods=['GET'])
@require_auth
def get_cases():
    requester = g.current_user
    db = get_db()
    c = db.cursor()
    sql = """
        SELECT vc.*, u.full_name as farmer_name, u.phone as farmer_phone,
               a.name as animal_name
        FROM vet_cases vc
        JOIN users u ON vc.farmer_id = u.id
        LEFT JOIN animals a ON vc.animal_id = a.id
        WHERE 1=1
    """
    params = []
    if requester['role'] == 'Farmer':
        sql += " AND vc.farmer_id = %s"; params.append(requester['id'])
    elif requester['role'] == 'Veterinarian':
        sql += " AND (vc.vet_id = %s OR vc.vet_id IS NULL)"; params.append(requester['id'])
    elif requester['role'] != 'Police':
        db.close()
        return jsonify({"error": "Not authorized to view cases"}), 403
    c.execute(sql, params)
    cases = c.fetchall()
    db.close()
    return jsonify(cases)


# ── ADMIN (hidden platform oversight — see require_admin above) ─────
@app.route('/admin/users', methods=['GET'])
@require_auth
@require_admin
def admin_list_users():
    role = request.args.get('role')
    province = request.args.get('province')
    verification_status = request.args.get('verification_status')
    q = request.args.get('q', '')
    # requested_by is only ever set for a Police applicant (an existing
    # officer nominating a new one) — surfacing who vouched for them is the
    # whole point of routing officer approval through Admin.
    sql = """
        SELECT u.*, r.full_name AS requested_by_name, r.badge_number AS requested_by_badge
        FROM users u LEFT JOIN users r ON u.requested_by = r.id
        WHERE 1=1
    """
    params = []
    if role:
        sql += " AND u.role = %s"; params.append(role)
    if province:
        sql += " AND u.province = %s"; params.append(province)
    if verification_status:
        sql += " AND u.verification_status = %s"; params.append(verification_status)
    if q:
        q_digits = re.sub(r'\D', '', q)
        sql += " AND (u.full_name LIKE %s OR u.org_name LIKE %s OR u.province LIKE %s"
        params += [f'%{q}%', f'%{q}%', f'%{q}%']
        if q_digits:
            sql += " OR u.phone LIKE %s"
            params.append(f'%{q_digits}%')
        sql += ")"
    sql += " ORDER BY u.created_at DESC"
    db = get_db()
    c = db.cursor()
    c.execute(sql, params)
    rows = c.fetchall()
    db.close()
    # Full oversight view — deliberately not run through public_user_view(),
    # unlike the client-facing /users directory.
    for r in rows:
        r.pop('password_hash', None)
    return jsonify(rows)


@app.route('/admin/users/<int:user_id>/status', methods=['PATCH'])
@require_auth
@require_admin
def admin_set_user_status(user_id):
    d = request.json or {}
    new_status = d.get('status')
    if new_status not in ('active', 'suspended'):
        return jsonify({"error": "status must be 'active' or 'suspended'"}), 400
    if user_id == g.current_user['id']:
        return jsonify({"error": "You can't suspend your own account"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id, role FROM users WHERE id=%s", (user_id,))
    target = c.fetchone()
    if not target:
        db.close(); return jsonify({"error": "User not found"}), 404
    if target['role'] == 'Admin' and new_status == 'suspended':
        db.close(); return jsonify({"error": "Admin accounts can't be suspended from here"}), 400

    reason = d.get('reason', '').strip() or None if new_status == 'suspended' else None
    c.execute("UPDATE users SET account_status=%s, suspension_reason=%s WHERE id=%s", (new_status, reason, user_id))
    db.commit()
    db.close()
    return jsonify({"message": f"Account {new_status}"})


@app.route('/admin/users/<int:user_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_delete_user(user_id):
    """Permanently removes an account and everything tied to it — animals,
    listings, health records, messages, cooperative membership, IoT devices —
    via the ON DELETE CASCADE relationships already defined in schema.sql.
    This cannot be undone (suspend is the reversible alternative for a
    scammer/abuse case where the record itself still has value); reserve
    this for junk/duplicate/test signups a user asked to be rid of."""
    if user_id == g.current_user['id']:
        return jsonify({"error": "You can't delete your own account"}), 400

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id, role, full_name FROM users WHERE id=%s", (user_id,))
    target = c.fetchone()
    if not target:
        db.close(); return jsonify({"error": "User not found"}), 404
    if target['role'] == 'Admin':
        db.close(); return jsonify({"error": "Admin accounts can't be deleted from here"}), 400

    c.execute("DELETE FROM users WHERE id=%s", (user_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"{target['full_name']}'s account was permanently deleted"})


@app.route('/admin/listings/<int:listing_id>/status', methods=['PATCH'])
@require_auth
@require_admin
def admin_set_listing_status(listing_id):
    d = request.json or {}
    new_status = d.get('status')
    if new_status not in ('withdrawn', 'available'):
        return jsonify({"error": "status must be 'withdrawn' or 'available'"}), 400
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM marketplace_listings WHERE id=%s", (listing_id,))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Listing not found"}), 404
    c.execute("UPDATE marketplace_listings SET status=%s WHERE id=%s", (new_status, listing_id))
    db.commit()
    db.close()
    return jsonify({"message": f"Listing {new_status}"})


@app.route('/admin/trends', methods=['GET'])
@require_auth
@require_admin
def admin_trends():
    db = get_db()
    c = db.cursor()

    c.execute("SELECT role, COUNT(*) AS total FROM users WHERE role != 'Admin' GROUP BY role")
    users_by_role = c.fetchall()

    c.execute("SELECT COUNT(*) AS total FROM animals")
    total_animals = c.fetchone()['total']

    c.execute("SELECT category, COUNT(*) AS total FROM marketplace_listings GROUP BY category")
    listings_by_category = c.fetchall()

    c.execute("SELECT status, COUNT(*) AS total FROM orders GROUP BY status")
    orders_by_status = c.fetchall()

    c.execute("SELECT status, COUNT(*) AS total FROM outbreaks GROUP BY status")
    outbreaks_by_status = c.fetchall()

    c.execute("SELECT COUNT(*) AS total FROM cooperatives")
    total_cooperatives = c.fetchone()['total']

    c.execute("""
        SELECT YEARWEEK(created_at, 3) AS yw, MIN(DATE(created_at)) AS week_start, COUNT(*) AS signups
        FROM users WHERE role != 'Admin' AND created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
        GROUP BY yw ORDER BY yw ASC
    """)
    signups_per_week = [{"week": r['week_start'].strftime('%b %d'), "signups": r['signups']} for r in c.fetchall()]

    c.execute("""
        SELECT YEARWEEK(created_at, 3) AS yw, MIN(DATE(created_at)) AS week_start, COUNT(*) AS animals
        FROM animals WHERE created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
        GROUP BY yw ORDER BY yw ASC
    """)
    animals_per_week = [{"week": r['week_start'].strftime('%b %d'), "animals": r['animals']} for r in c.fetchall()]

    db.close()
    return jsonify({
        "users_by_role": users_by_role,
        "total_animals": total_animals,
        "listings_by_category": listings_by_category,
        "orders_by_status": orders_by_status,
        "outbreaks_by_status": outbreaks_by_status,
        "total_cooperatives": total_cooperatives,
        "signups_per_week": signups_per_week,
        "animals_per_week": animals_per_week,
    })


@app.route('/admin/activity', methods=['GET'])
@require_auth
@require_admin
def admin_activity():
    db = get_db()
    c = db.cursor()

    c.execute("SELECT id, full_name, role, created_at FROM users WHERE role != 'Admin' ORDER BY created_at DESC LIMIT 20")
    signups = [{"type": "signup", "at": r['created_at'], "text": f"{r['full_name']} joined as {r['role']}"} for r in c.fetchall()]

    c.execute("""
        SELECT l.id, l.product_name, l.category, u.full_name, l.created_at
        FROM marketplace_listings l JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC LIMIT 20
    """)
    listings = [{"type": "listing", "at": r['created_at'], "text": f"{r['full_name']} listed \"{r['product_name']}\" ({r['category']})"} for r in c.fetchall()]

    c.execute("""
        SELECT o.id, o.disease_name, o.province, u.full_name, o.created_at
        FROM outbreaks o JOIN users u ON o.reported_by = u.id
        ORDER BY o.created_at DESC LIMIT 20
    """)
    outbreak_reports = [{"type": "outbreak", "at": r['created_at'], "text": f"{r['full_name']} reported {r['disease_name']} in {r['province']}"} for r in c.fetchall()]

    c.execute("""
        SELECT co.id, co.name, co.province, u.full_name, co.created_at
        FROM cooperatives co JOIN users u ON co.created_by = u.id
        ORDER BY co.created_at DESC LIMIT 20
    """)
    cooperatives = [{"type": "cooperative", "at": r['created_at'], "text": f"{r['full_name']} started \"{r['name']}\" in {r['province']}"} for r in c.fetchall()]

    db.close()
    feed = signups + listings + outbreak_reports + cooperatives
    feed.sort(key=lambda x: x['at'], reverse=True)
    return jsonify(feed[:50])


# ── ADMIN IOT DEMO CONTROL ────────────────────────────────────────
# Show-floor backup plan: the real CN-01/BS-01 hardware isn't finished, so
# instead of leaving the IoT tab dark for the exhibit, an admin drives it
# by hand from here. Every push lands in the same `iot_readings` table a
# real base station would write to, tagged to a dedicated "SIM-<animal_id>"
# virtual collar (never a farmer's real paired device) — so the ordinary
# Farmer/Vet/Police IoT dashboard picks it up through its normal "live
# reading" path with zero special-casing on that side.
METERS_PER_DEG_LAT = 110540

def _meters_per_deg_lon(lat):
    return 111320 * math.cos(math.radians(lat))

DIRECTION_OFFSETS = {
    'N': (1, 0), 'S': (-1, 0), 'E': (0, 1), 'W': (0, -1),
    'NE': (1, 1), 'NW': (1, -1), 'SE': (-1, 1), 'SW': (-1, -1),
}


@app.route('/admin/iot/targets', methods=['GET'])
@require_auth
@require_admin
def admin_iot_targets():
    db = get_db(); c = db.cursor()
    c.execute("""
        SELECT a.id AS animal_id, a.name AS animal_name, a.species,
               u.id AS owner_id, u.full_name AS owner_name
        FROM animals a JOIN users u ON a.owner_id = u.id
        ORDER BY u.full_name, a.name
    """)
    rows = c.fetchall()
    db.close()
    farmers = {}
    for r in rows:
        f = farmers.setdefault(r['owner_id'], {"owner_id": r['owner_id'], "owner_name": r['owner_name'], "animals": []})
        f['animals'].append({"id": r['animal_id'], "name": r['animal_name'], "species": r['species']})
    return jsonify(list(farmers.values()))


@app.route('/admin/iot/geofence/<int:owner_id>', methods=['GET'])
@require_auth
@require_admin
def admin_get_geofence(owner_id):
    zone = _latest_geofence(owner_id)
    if not zone:
        return jsonify({**DEFAULT_GEOFENCE, "is_default": True})
    return jsonify({
        "id": zone['id'], "name": zone['name'],
        "center_lat": float(zone['center_lat']), "center_lon": float(zone['center_lon']),
        "radius_m": zone['radius_m'], "is_default": False,
    })


@app.route('/admin/iot/geofence', methods=['POST'])
@require_auth
@require_admin
def admin_set_geofence():
    d = request.json or {}
    owner_id = d.get('owner_id')
    name = (d.get('name') or 'Demo Safe Zone').strip()[:120]
    try:
        center_lat = float(d['center_lat']); center_lon = float(d['center_lon']); radius_m = int(d['radius_m'])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "center_lat, center_lon, radius_m are required numbers"}), 400
    if not owner_id or radius_m <= 0:
        return jsonify({"error": "owner_id is required and radius_m must be positive"}), 400

    db = get_db(); c = db.cursor()
    c.execute("SELECT id FROM users WHERE id=%s", (owner_id,))
    if not c.fetchone():
        db.close(); return jsonify({"error": "Farmer not found"}), 404
    c.execute("""
        INSERT INTO geofences (owner_id, name, center_lat, center_lon, radius_m, created_by)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (owner_id, name, center_lat, center_lon, radius_m, g.current_user['id']))
    zone_id = c.lastrowid
    db.commit(); db.close()
    return jsonify({"id": zone_id, "message": "Geofence saved ✅"})


@app.route('/admin/iot/simulate', methods=['POST'])
@require_auth
@require_admin
def admin_iot_simulate():
    d = request.json or {}
    animal_id = d.get('animal_id')
    if not animal_id:
        return jsonify({"error": "animal_id is required"}), 400

    db = get_db(); c = db.cursor()
    c.execute("SELECT id, owner_id, name FROM animals WHERE id=%s", (animal_id,))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404

    sim_serial = f"SIM-{animal_id}"
    c.execute("SELECT id FROM iot_devices WHERE device_serial=%s", (sim_serial,))
    device = c.fetchone()
    if not device:
        c.execute(
            "INSERT INTO iot_devices (device_serial, device_type, animal_id, owner_id) VALUES (%s,'collar',%s,%s)",
            (sim_serial, animal_id, animal['owner_id'])
        )
        device_id = c.lastrowid
    else:
        device_id = device['id']

    zone = _latest_geofence(animal['owner_id'])
    center_lat = float(zone['center_lat']) if zone else DEFAULT_GEOFENCE['center_lat']
    center_lon = float(zone['center_lon']) if zone else DEFAULT_GEOFENCE['center_lon']
    radius_m = zone['radius_m'] if zone else DEFAULT_GEOFENCE['radius_m']

    c.execute("""
        SELECT latitude, longitude, temp_c, heart_rate, battery_pct FROM iot_readings
        WHERE device_id=%s ORDER BY received_at DESC LIMIT 1
    """, (device_id,))
    last = c.fetchone()
    lat = float(last['latitude']) if last and last['latitude'] is not None else center_lat
    lon = float(last['longitude']) if last and last['longitude'] is not None else center_lon
    temp = float(last['temp_c']) if last and last['temp_c'] is not None else 38.5
    hr = int(last['heart_rate']) if last and last['heart_rate'] is not None else 72
    battery = int(last['battery_pct']) if last and last['battery_pct'] is not None else 88

    direction = d.get('direction')
    step_m = float(d.get('step_m', 20))
    if direction == 'reset':
        lat, lon = center_lat, center_lon
    elif direction == 'random':
        lat += (random.uniform(-1, 1) * step_m) / METERS_PER_DEG_LAT
        lon += (random.uniform(-1, 1) * step_m) / _meters_per_deg_lon(center_lat)
    elif direction in DIRECTION_OFFSETS:
        d_lat, d_lon = DIRECTION_OFFSETS[direction]
        lat += (d_lat * step_m) / METERS_PER_DEG_LAT
        lon += (d_lon * step_m) / _meters_per_deg_lon(center_lat)

    if d.get('temp_c') is not None:
        temp = float(d['temp_c'])
    if d.get('heart_rate') is not None:
        hr = int(d['heart_rate'])
    if d.get('battery_pct') is not None:
        battery = int(d['battery_pct'])
    battery = max(0, min(100, battery))

    dx = (lon - center_lon) * _meters_per_deg_lon(center_lat)
    dy = (lat - center_lat) * METERS_PER_DEG_LAT
    distance_m = math.sqrt(dx * dx + dy * dy)
    in_zone = distance_m <= radius_m

    fever_alert = bool(d.get('fever')) or temp > 40.2
    theft_alert = bool(d.get('theft')) or not in_zone
    activity = d.get('activity') or ('Elevated' if hr > 95 else 'Resting' if hr < 65 else 'Normal')

    c.execute("""
        INSERT INTO iot_readings
            (device_id, temp_c, heart_rate, latitude, longitude, gps_accuracy,
             activity, move_mag, in_zone, battery_pct, fever_alert, theft_alert,
             packet_no, rssi)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        device_id, round(temp, 1), hr, lat, lon, 4.5,
        activity, int(step_m), in_zone, battery, fever_alert, theft_alert,
        None, random.randint(-85, -55),
    ))
    db.commit(); db.close()

    return jsonify({
        "message": "Reading pushed ✅", "animal_name": animal['name'],
        "latitude": lat, "longitude": lon, "distance_from_center_m": round(distance_m, 1),
        "in_zone": in_zone, "temp_c": round(temp, 1), "heart_rate": hr, "battery_pct": battery,
        "fever_alert": fever_alert, "theft_alert": theft_alert,
    })


if __name__ == '__main__':
    # Debug mode's interactive Werkzeug debugger allows remote code
    # execution on any unhandled exception — never on in production.
    # In production this file also isn't the entrypoint: run behind a
    # real WSGI server (gunicorn) and a reverse proxy terminating TLS,
    # not Flask's own dev server.
    app.run(host='0.0.0.0', debug=not IS_PRODUCTION, port=int(os.environ.get('PORT', 5000)))
