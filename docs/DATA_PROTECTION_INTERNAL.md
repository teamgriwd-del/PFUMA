# PFUMA — Internal Data Protection & Security Record

**Audience:** PFUMA team only. This is the operational backing document
for `PRIVACY_POLICY.md` — it records *how* we actually implement the
commitments made there, so the team has one place to check before making
changes that touch personal data, and one place to hand an auditor,
investor, or regulator who asks "how do you actually handle this."

**Last updated:** [DATE] · **Owner:** [NAME]

---

## 1. Data inventory

| Data category | Table(s) | Sensitivity | Who can access via API |
|---|---|---|---|
| Account credentials | `users.password_hash` | Critical — never returned by any endpoint | Nobody (write-only; verified via bcrypt, never read back) |
| National ID number | `users.national_id_number` | High (government ID) | Self, Police, reviewing Verified Vet (peers only) |
| ID/credential document scans | `users.id_document_path`, `credential_document_path` → files under `backend/uploads/<user_id>/` | High | Self, Police, reviewing Verified Vet — enforced in `get_document()` |
| Contact info (phone/email/address) | `users.phone/email/address` | Medium | Self, Police always; business roles publish phone as part of their listing function |
| Animal records & health events | `animals`, `health_events` | Medium (commercially sensitive) | Owner, Vet/Police treating/certifying that animal |
| Marketplace/orders/clearances | `marketplace_listings`, `orders`, `sale_clearances` | Medium | Parties to the transaction, Police/DVS |
| Outbreak reports | `outbreaks` | Medium (public-health relevant) | Province-wide visibility to Vet/Police by design |
| Admin account | `users` row with `role='Admin'` | Critical | Nobody — see `require_admin()`; excluded from every directory/search endpoint by name (`AND role != 'Admin'`) |

## 2. Legal basis for collection

Each field in Section 1 exists to support a specific, named feature (see
`PRIVACY_POLICY.md` §3). Before adding any new personal-data field to the
schema, ask: which feature needs this, and can that feature work with
less data? Don't add "might be useful later" fields to `users` or
`animals`.

## 3. Technical controls (as implemented in `backend/app.py`)

- **Password storage**: `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`
  — salted, industry-standard. Verified via `bcrypt.checkpw`, never
  decrypted or logged.
- **Session tokens**: HS256 JWT, `PFUMA_SECRET_KEY` from environment
  (app now **refuses to start** in production without it — see
  `IS_PRODUCTION` gate at the top of `app.py`). 7-day expiry
  (`TOKEN_TTL_HOURS`).
- **Authorization**: every endpoint that touches another user's data
  checks role and/or ownership server-side (`require_auth`,
  `require_role`, and per-endpoint ownership checks like
  `if row['owner_id'] != g.current_user['id']`) — never trusted from the
  client.
- **Field-level redaction**: `public_user_view()` builds an explicit
  allow-list of fields per viewer/role rather than returning a full row
  and trying to strip sensitive ones — safer failure mode (a forgotten
  field defaults to *not* exposed, not exposed-by-accident).
- **File uploads**: extension allow-list (`ALLOWED_DOC_EXT`,
  `ALLOWED_IMG_EXT`), `secure_filename()` on all filenames, size-capped
  at `MAX_CONTENT_LENGTH` (15 MB), served via `send_from_directory`
  (path-traversal safe by construction).
- **Rate limiting**: `/auth/login` (15 / 5 min) and `/auth/register`
  (10 / hour) via `flask-limiter`, per source IP.
- **CORS**: locked to explicit allowed origins in production
  (`PFUMA_ALLOWED_ORIGINS` env var), not wildcard.
- **Transport security**: production deployment must terminate TLS at
  the reverse proxy (see deployment notes) — the API is never served
  over plain HTTP outside local development.

## 4. Data retention & deletion

- **Active accounts**: retained indefinitely while the account is in use.
- **Account closure**: on request, redact personal contact fields
  (phone/email/address/ID document files) from the account row and
  delete the uploaded document files from disk. **Do not** delete
  `sale_clearances` or `orders` rows tied to that account — these are
  the platform's provenance/audit trail for livestock movement and have
  value to other parties (buyers, DVS) independent of the original
  account. If full deletion is legally required, anonymise the FK
  reference rather than deleting the row (keep the transaction record,
  drop the personal identifier).
- **Backups**: [FILL IN once a backup schedule exists — note retention
  period and whether backups are encrypted at rest.]

## 5. Incident response (data breach)

1. Contain: rotate `PFUMA_SECRET_KEY` immediately (invalidates all
   sessions), rotate DB credentials, patch the vulnerability.
2. Assess: which tables/rows were exposed, how many users affected.
3. Notify: affected users without undue delay; if the breach involves
   national ID numbers or ID document scans, treat as high-severity and
   notify sooner rather than batching.
4. Record: what happened, when discovered, remediation taken — keep
   this even after the incident is closed, for accountability.

## 6. Known gaps / accepted risk (as of this writing)

Be honest here — this list is more useful incomplete-and-true than
polished-and-vague:

- No automated backup/restore procedure documented yet for the
  production database.
- No formal legal review of `PRIVACY_POLICY.md` against Zimbabwe's Data
  Protection Act [Chapter 11:12] — do this before treating that
  document as a compliance guarantee.
- `npm audit` still shows moderate-severity vulnerabilities in build
  tooling (Vite/esbuild on web, Expo config-plugins on mobile) — not
  exploitable in the deployed production build, but should be cleared
  via a planned major-version upgrade rather than left indefinitely.
- Admin account credentials were provisioned via direct database
  insert this session, per explicit user instruction, specifically to
  avoid any HTTP code path that could create or expose that role. If
  that account's password is ever suspected compromised, rotate it via
  the same direct-DB method — there is deliberately no "forgot
  password" flow for it.

## 7. Who to contact

Security concerns / suspected breach: [NAME/CONTACT]. This should not be
a shared inbox nobody checks — name an actual owner before going live.
