import os
import re
import functools
import datetime

from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pymysql
import bcrypt
import jwt

app = Flask(__name__)
CORS(app)

# ── CONFIG ───────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('PFUMA_SECRET_KEY')
if not SECRET_KEY:
    SECRET_KEY = 'dev-insecure-secret-change-me'
    print("[WARNING] PFUMA_SECRET_KEY not set - using an insecure dev default. "
          "Set the PFUMA_SECRET_KEY environment variable before deploying.")

TOKEN_TTL_HOURS = 24 * 7  # 1 week

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_DOC_EXT = {'.pdf', '.jpg', '.jpeg', '.png'}

# Roles that are not self-service — provisioned by an existing Police officer.
ADMIN_PROVISIONED_ROLES = {'Police'}

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
        host='localhost',
        user='root',
        password='',
        database='pfuma',
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


# ── HEALTH CHECK ──────────────────────────────────────────────
@app.route('/')
def home():
    return jsonify({"message": "PFUMA API is running ✅", "version": "3.0"})


# ── AUTHENTICATION ───────────────────────────────────────────────
@app.route('/auth/register', methods=['POST'])
def register():
    d = request.form
    role = d.get('role', 'Farmer')
    if role in ADMIN_PROVISIONED_ROLES:
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
                   "FROM users WHERE verification_status=%s AND role != 'Veterinarian' ORDER BY created_at ASC", (status,))
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
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("""
        INSERT INTO animals (owner_id, name, species, breed, birth_date, tag_id, brand_id,
            sire_id, dam_id, birth_weight, current_weight, image_url, for_sale)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        g.current_user['id'], d['name'], d['species'], d.get('breed', ''),
        d.get('birth_date') or d.get('birthDate'), d.get('tag_id') or d.get('tagId', ''),
        d.get('brand_id') or d.get('brandId', ''), d.get('sire_id') or d.get('sireId', ''),
        d.get('dam_id') or d.get('damId', ''),
        d.get('birth_weight') or d.get('birthWeight', 0),
        d.get('current_weight') or d.get('currentWeight', 0),
        d.get('image_url') or d.get('imageUrl', ''), d.get('for_sale', False)
    ))
    animal_id = c.lastrowid
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


@app.route('/health-events', methods=['POST'])
@require_auth
@require_role('Farmer', 'Veterinarian')
def add_health_event():
    d = request.json
    db = get_db()
    c = db.cursor()
    c.execute("SELECT owner_id FROM animals WHERE id = %s", (d['animal_id'],))
    animal = c.fetchone()
    if not animal:
        db.close(); return jsonify({"error": "Animal not found"}), 404
    if g.current_user['role'] == 'Farmer' and animal['owner_id'] != g.current_user['id']:
        db.close(); return jsonify({"error": "You can only log events for your own animals"}), 403
    c.execute("""
        INSERT INTO health_events (animal_id, animal_name, event_type, notes, performed_by)
        VALUES (%s,%s,%s,%s,%s)
    """, (d['animal_id'], d.get('animal_name', ''), d['event_type'], d.get('notes', ''), g.current_user['id']))
    db.commit()
    event_id = c.lastrowid
    db.close()
    return jsonify({"id": event_id, "message": "Health event logged ✅"})


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
    d = request.json
    category = d.get('category', 'livestock')
    animal_id = d.get('animal_id')

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

    if needs_clearance:
        c.execute("""
            INSERT INTO sale_clearances (animal_id, listing_id, seller_id, status)
            VALUES (%s,%s,%s,'pending')
        """, (animal_id, listing_id, g.current_user['id']))

    db.commit()
    db.close()
    return jsonify({
        "id": listing_id,
        "status": status,
        "message": "Listing submitted for police clearance ✅" if needs_clearance else "Listing added ✅"
    })


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
    c.execute("""
        INSERT INTO sale_clearances (animal_id, listing_id, seller_id, status)
        VALUES (%s,%s,%s,'pending')
    """, (d['animal_id'], d.get('listing_id'), g.current_user['id']))
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


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
