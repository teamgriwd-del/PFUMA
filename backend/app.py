import os
import re
import json
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
_default_dev_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://localhost:19006"
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


def save_photo(file_storage, category, entity_id):
    """Saves an uploaded animal/listing photo under uploads/<category>/<entity_id><ext>
    and returns the relative path stored in the DB (served publicly, unlike
    save_upload's private id/credential documents)."""
    if not file_storage or not file_storage.filename:
        return None
    ext = os.path.splitext(secure_filename(file_storage.filename))[1].lower()
    if ext not in ALLOWED_IMG_EXT:
        raise ValueError(f"Unsupported image type '{ext}' — use JPG, PNG, or WEBP")
    category_dir = os.path.join(UPLOAD_DIR, category)
    os.makedirs(category_dir, exist_ok=True)
    filename = f"{entity_id}{ext}"
    file_storage.save(os.path.join(category_dir, filename))
    return f"{category}/{filename}"


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
    c.execute("SELECT id FROM users WHERE phone = %s", (phone,))
    if c.fetchone():
        db.close()
        return jsonify({"error": "An account with this phone number already exists"}), 409

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
    c.execute("SELECT * FROM users WHERE phone = %s", (phone,))
    user = c.fetchone()
    db.close()
    if not user or not user['password_hash'] or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
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
    if requester['role'] == 'Police':
        c.execute("SELECT id, full_name, role, org_name, province, id_document_path, credential_document_path, created_at "
                   "FROM users WHERE verification_status=%s AND role NOT IN ('Veterinarian','Admin') ORDER BY created_at ASC", (status,))
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

    authorized = (
        requester['role'] == 'Admin' or
        (requester['role'] == 'Police' and target['role'] != 'Veterinarian') or
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
    if category not in ('animals', 'listings'):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(os.path.join(UPLOAD_DIR, category), filename)


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
def create_user():
    """Administrative user provisioning — used by Police to create another
    verified officer account (Police signups are not self-service)."""
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
            badge_number, station, jurisdiction_province, password_hash, verification_status, verified_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'verified',%s)
    """, (
        full_name, phone, national_id, d.get('email', ''), d.get('role', 'Police'),
        d.get('org_name', ''), d.get('province', ''), d.get('district', ''), d.get('address', ''),
        d.get('badge_number', ''), d.get('station', ''), d.get('jurisdiction_province', ''),
        password_hash, g.current_user['id'],
    ))
    db.commit()
    user_id = c.lastrowid
    db.close()
    return jsonify({"id": user_id, "message": "Officer account provisioned and verified."})


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
    d = request.json or {}
    text = (d.get('message') or '').strip()[:2000]
    if not text:
        return jsonify({"error": "message is required"}), 400

    db = get_db()
    c = db.cursor()
    conv = _conversation_participant_or_404(c, conversation_id, me)
    if not conv:
        db.close(); return jsonify({"error": "Conversation not found"}), 404

    c.execute("""
        INSERT INTO conversation_messages (conversation_id, sender_id, message) VALUES (%s,%s,%s)
    """, (conversation_id, me, text))
    msg_id = c.lastrowid
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
            c.execute("UPDATE animals SET image_url=%s WHERE id=%s", (f"/uploads/{rel_path}", animal_id))
        except ValueError as e:
            db.commit(); db.close()
            return jsonify({"error": str(e)}), 400

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
    c.execute("UPDATE animals SET for_sale = NOT for_sale WHERE id = %s", (animal_id,))
    db.commit()
    c.execute("SELECT for_sale FROM animals WHERE id = %s", (animal_id,))
    row = c.fetchone()
    db.close()
    return jsonify({"for_sale": bool(row['for_sale']), "message": "Listing status updated ✅"})


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
    animal_id = d.get('animal_id')

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

    c.execute("INSERT INTO iot_devices (device_serial, animal_id, owner_id) VALUES (%s,%s,%s)",
              (serial, animal_id, g.current_user['id']))
    device_id = c.lastrowid
    db.commit()
    db.close()
    return jsonify({"id": device_id, "message": "Device paired ✅"})


@app.route('/iot-devices/<int:device_id>', methods=['PATCH'])
@require_auth
def update_iot_device(device_id):
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM iot_devices WHERE id=%s", (device_id,))
    device = c.fetchone()
    if not device:
        db.close(); return jsonify({"error": "Device not found"}), 404
    if device['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only manage your own devices"}), 403

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


@app.route('/api/iot/telemetry', methods=['POST'])
def ingest_telemetry():
    return _store_iot_reading()


@app.route('/api/iot/alert', methods=['POST'])
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
    if g.current_user['role'] not in ('Veterinarian', 'Police') and animal['owner_id'] != g.current_user['id']:
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
    db.commit()
    event_id = c.lastrowid
    c.execute("SELECT * FROM health_events WHERE id = %s", (event_id,))
    event = c.fetchone()
    db.close()
    return jsonify({"id": event_id, "message": "Health event logged ✅", "event": event})


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


# ── MARKETPLACE ───────────────────────────────────────────────
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

    if animal_id:
        db = get_db(); c = db.cursor()
        c.execute("SELECT owner_id FROM animals WHERE id=%s", (animal_id,))
        animal = c.fetchone(); db.close()
        if not animal or animal['owner_id'] != g.current_user['id']:
            return jsonify({"error": "You can only list your own animals"}), 403

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
        c.execute("SELECT leader_clearance FROM sale_clearances WHERE id=%s", (clearance_id,))
        row = c.fetchone()
        if not row:
            db.close(); return jsonify({"error": "Clearance not found"}), 404
        if not row['leader_clearance']:
            db.close()
            return jsonify({"error": "No Sabuku or Mambo clearance on record for this sale. "
                                     "Ask the seller to record it, or to state why none applies, "
                                     "before you clear the listing."}), 409

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
    c.execute("SELECT status, category FROM marketplace_listings WHERE id=%s", (listing_id,))
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
    c.execute("SELECT user_id, status FROM marketplace_listings WHERE id=%s", (listing_id,))
    listing = c.fetchone()
    if not listing:
        db.close(); return jsonify({"error": "Listing not found"}), 404
    if listing['user_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "Only the listing owner can accept a bid"}), 403
    if listing['status'] == 'sold':
        db.close(); return jsonify({"error": "This listing is already sold"}), 409

    c.execute("SELECT id, amount, status FROM bids WHERE id=%s AND listing_id=%s", (bid_id, listing_id))
    bid = c.fetchone()
    if not bid:
        db.close(); return jsonify({"error": "Bid not found"}), 404
    if bid['status'] != 'pending':
        db.close(); return jsonify({"error": "This bid is no longer pending"}), 409

    c.execute("UPDATE bids SET status='accepted' WHERE id=%s", (bid_id,))
    c.execute("UPDATE bids SET status='declined' WHERE listing_id=%s AND id!=%s AND status='pending'", (listing_id, bid_id))
    c.execute("UPDATE marketplace_listings SET status='sold', price=%s, sold_at=NOW() WHERE id=%s", (bid['amount'], listing_id))
    db.commit()
    db.close()
    return jsonify({"message": "Bid accepted — listing marked sold ✅"})


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
    sql = "SELECT * FROM users WHERE 1=1"
    params = []
    if role:
        sql += " AND role = %s"; params.append(role)
    if province:
        sql += " AND province = %s"; params.append(province)
    if verification_status:
        sql += " AND verification_status = %s"; params.append(verification_status)
    if q:
        q_digits = re.sub(r'\D', '', q)
        sql += " AND (full_name LIKE %s OR org_name LIKE %s OR province LIKE %s"
        params += [f'%{q}%', f'%{q}%', f'%{q}%']
        if q_digits:
            sql += " OR phone LIKE %s"
            params.append(f'%{q_digits}%')
        sql += ")"
    sql += " ORDER BY created_at DESC"
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


if __name__ == '__main__':
    # Debug mode's interactive Werkzeug debugger allows remote code
    # execution on any unhandled exception — never on in production.
    # In production this file also isn't the entrypoint: run behind a
    # real WSGI server (gunicorn) and a reverse proxy terminating TLS,
    # not Flask's own dev server.
    app.run(host='0.0.0.0', debug=not IS_PRODUCTION, port=int(os.environ.get('PORT', 5000)))
