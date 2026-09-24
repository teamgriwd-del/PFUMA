# Technical Architecture

## Stack

| Layer | Technology |
|---|---|
| Web frontend | React (Vite) + Tailwind CSS v4, Recharts for analytics |
| Mobile | Native Expo / React Native app (`app/`), near feature-parity with web |
| Backend | Flask + PyMySQL, bcrypt password hashing, PyJWT sessions |
| Database | MySQL/MariaDB (XAMPP locally; MySQL 8.4 in production) |
| AI assistant | Custom rule/NLP engine ("Jinda"), not a hosted LLM API call |

## Repo layout (top level, project root)

```
PFUMA/
├── src/                 # React web app
│   ├── components/      # Admin, AnimalProfile, CertificateVerify, Compliance, Cooperative,
│   │                     #   DiseaseDetection, FeedAnalyzer, HardwareSimulation (dormant),
│   │                     #   HealthManagement, IntelAI (Jinda), Marketplace, SupplierStock,
│   │                     #   TradingJournal, VetCommunication, ui/
│   └── App.jsx, config.js, verify_logic*.js
├── app/                 # Expo/React Native mobile app
│   └── screens/          # ~19 screens mirroring the web components 1:1 by feature
├── backend/
│   ├── app.py            # 143 routes, all business logic
│   ├── protocols.py       # disease/diagnostic knowledge used by Jinda + DiseaseDetection
│   └── schema.sql         # source of truth for the data model
├── hardware/             # IoT hardware design + firmware — dormant, see PLATFORM_OVERVIEW.md
├── DOCUMENTATION/         # ALL non-code material, grouped by topic (see DOCUMENTATION/README.md):
│   ├── platform/          #   these generalized platform docs
│   ├── agric-show-2026/   #   ZAS-specific pitch guide, impact doc, deck, dossier
│   ├── business-and-funding/ # budget, procurement, commercialization requests
│   ├── hardware/          #   IOT_HARDWARE_GUIDE.md + component/breadboard docs
│   ├── posters-and-diagrams/ # poster + wiring-diagram HTML sources, generators, PDFs
│   ├── compliance-research/  # cited Zimbabwean livestock-law research (laws/, species/)
│   ├── legal-and-privacy/ #   PRIVACY_POLICY.md, DATA_PROTECTION_INTERNAL.md
│   ├── setup/             #   SETUP.md (local dev setup)
│   └── brand/, team-tasks/, field-research/
└── run_project.bat        # one-command local dev launcher (DB + backend + web + Expo)
```

## Data model highlights

- `users.role` enum: `Farmer, Veterinarian, Supplier, Buyer, Police, Admin, Institution`.
- `users.account_status` (`active`/`suspended`) is separate from `verification_status`
  (`pending`/`verified`/`rejected`) — suspension is admin moderation (scammers etc.), verification
  is the signup-review pipeline. Don't conflate the two when reasoning about access.
- `officer_tier` (`field`/`national`) scopes a Police/DVS officer's visibility — field officers see
  their own region, national-tier officers see everything (used for outbreak visibility).
- `listings.status` enum: `pending_clearance, available, sold, withdrawn` — the marketplace-gate
  state machine.
- `clearances.status`: `pending, cleared, rejected` — the police review queue itself, separate from
  the listing's own status.
- `movement_permits.status`: `pending, issued, rejected`.
- Institution/valuation-certificate tables (added later): one row per (certificate, institution)
  pair, forming each institution's own ledger — not a shared global table.

**Known schema-deploy gap:** `ensure_schema()` in `backend/app.py` only does column-level
`ALTER TABLE` migrations on a fixed set of pre-existing tables on backend startup — it does **not**
re-run `schema.sql`'s `CREATE TABLE IF NOT EXISTS` statements for tables added after the first
production deploy. Any commit that adds a brand-new table to `schema.sql` needs that table created
manually on the production DB too, or every endpoint touching it 500s in prod while working fine
locally. Diff `SHOW TABLES` on prod against `schema.sql` after any such commit.

## Security model

- Password auth via bcrypt, session via JWT (PyJWT).
- No endpoint is reachable unauthenticated except health-check, `/auth/login`, `/auth/register`,
  and public feed reference data.
- Per-owner data scoping enforced server-side (not just hidden in the UI) — a farmer's own
  animals/health-records/inventory, vets/police get oversight visibility only within their
  region/tier.
- The Admin role is invisible by design: protected admin routes return 404 (not 403) to
  non-admins, so the role's existence can't be inferred from status codes alone.
- Uploaded documents (ID, credentials) are stored outside the web root and served only to the
  document owner or an authorized reviewer.
- `PFUMA_SECRET_KEY` is fail-closed — the backend refuses to start in production without one set
  (an earlier hardcoded fallback in this public repo was a real forgeable-admin-session bug, since
  fixed).
- Rate limiting on `/auth/login`, `/auth/register`, and IoT telemetry endpoints; CORS allow-list;
  `MAX_CONTENT_LENGTH` cap; DB credentials from environment, not hardcoded.

## Running locally

`run_project.bat` launches DB (XAMPP MariaDB), backend (`py app.py`), web (Vite dev server) and
Expo mobile dev server in separate windows. First-time setup and the "phone can't reach the API"
Wi-Fi/IP gotcha are documented in [`DOCUMENTATION/setup/SETUP.md`](../setup/SETUP.md) — that content is dev-environment mechanics,
not event-specific, so it doesn't need duplicating here; just be aware it still applies.

## Production deployment (current live instance)

Deployed on GRIWD's own VPS (Windows Server), not a demo/placeholder host:

- **Web:** served over real Let's Encrypt HTTPS via a `sslip.io` "magic DNS" hostname (a free
  stopgap until a real domain is purchased). Installable as a PWA on Android and iOS (Add to Home
  Screen).
- **Mobile:** Android APK is **re-hosted permanently on the VPS itself**, not linked to Expo's own
  build artifact — Expo's links expire after 14 days, which would break a QR code printed for a
  show. Rebuilding the APK never requires reprinting the QR because the QR points at the VPS URL.
- **Backend:** runs via `waitress` (the VPS is Windows, so not gunicorn) as an NSSM-managed Windows
  service, with Caddy reverse-proxying `/api/*` to it and serving the static web build otherwise.
- **Web deploy gotcha:** Caddy serves `C:\pfuma-web`, which is a **separate directory** from the
  git checkout's own `C:\PFUMA\dist` build output. `git pull` + `npm run build` on the VPS updates
  `dist` but changes nothing the public site serves until it's copied over
  (`robocopy C:\PFUMA\dist C:\pfuma-web /E` — never mirror/delete, since `pfuma-web` also holds the
  permanently-hosted APK). Verify a deploy landed by comparing the `assets/index-*.js` hash in
  `dist/index.html` against what the live site actually returns.
- **Shared-VPS caveat:** this box also runs another live GRIWD project. A hard classifier blocks
  any action that manipulates the shared MySQL service directly; NSSM/`sc query` status is
  sometimes cosmetically wrong (verify with `netstat`/`tasklist` instead).

This deployment detail matters for the "reuse this for another expo" story: the platform doesn't
need a new deployment per event — the same live instance can be demoed at any expo, only the pitch
framing changes (see `EVENT_ADAPTATION_GUIDE.md`).
