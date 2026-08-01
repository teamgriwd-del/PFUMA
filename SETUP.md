# PFUMA — Project Setup Guide

Two people, three apps — this guide gets everything running.

---

## What's in this repo

```
PFUMA/
├── src/          ← Arnold's React web app (Vite + Tailwind)
├── app/          ← Addy's React Native mobile app (Expo)
├── backend/      ← Shared Flask API + MySQL database
│   ├── app.py        API server (30+ endpoints)
│   └── schema.sql    Full database schema + seed data
└── dist/         ← Built web app (ready to deploy)
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Python | 3.10+ | https://python.org |
| XAMPP (MySQL) | Any | https://apachefriends.org |
| Expo Go (phone) | Latest | App Store / Play Store |

---

## Step 1 — Start MySQL (XAMPP)

Open XAMPP Control Panel and click **Start** next to MySQL.
Or run from command line:
```
C:\xampp\mysql\bin\mysqld.exe
```

---

## Step 2 — Create the database

Run once to set up all tables and demo data:
```bash
C:\xampp\mysql\bin\mysql.exe -u root < backend/schema.sql
```

---

## Step 3 — Start the Flask API

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Set a real `PFUMA_SECRET_KEY` environment variable before running this anywhere other than your own machine — without it, the API falls back to an insecure dev default and prints a warning.

API runs at: **http://localhost:5000**

Test it: open http://localhost:5000 in your browser — you should see:
```json
{"message": "PFUMA API is running ✅", "version": "3.0"}
```

**Demo login password for every seeded account:** `Pfuma2026!` (phone number is the login identifier, e.g. `+263 77 100 0001` for Arnold).

---

## Step 4 — Run the React web app (Arnold's)

```bash
cd ..           # back to PFUMA root
npm install
npm run dev
```

Web app runs at: **http://localhost:5173**

---

## Step 5 — Run the Expo mobile app (Addy's)

```bash
cd app
npm install
npx expo start
```

- Press **W** to open in browser
- Press **A** for Android emulator
- Scan the QR code with **Expo Go** on your phone

> If testing on a physical device, change `API` in the screen files from
> `http://localhost:5000` to your PC's local IP (e.g. `http://192.168.1.x:5000`)

---

## Authentication

Every endpoint except `/`, `/auth/register`, `/auth/login`, `/feed`, and `/feed/search` requires a `Authorization: Bearer <token>` header. Get a token from `/auth/login`, or by registering via `/auth/register` (multipart/form-data — see `AuthPortal.jsx` for the field list). New accounts start `verification_status: 'pending'` and are reviewed by Police (or, for Vet applicants, an existing verified Vet) before most write actions unlock.

## API Endpoints

| Method | Route | What it does |
|---|---|---|
| GET | `/` | Health check |
| POST | `/auth/register` | Create an account (multipart/form-data incl. ID/credential documents) |
| POST | `/auth/login` | `{phone, password}` → JWT + user record |
| GET | `/auth/me` | Current user, from the token |
| GET/PATCH | `/verifications`, `/verifications/:user_id` | Signup review queue (Police, or a verified Vet reviewing Vet applicants) |
| GET | `/documents/:user_id/:doctype` | Serve an uploaded ID/credential document (owner, Police, or reviewing Vet only) |
| GET | `/users` | Directory search — response is redacted per viewer/role |
| POST | `/users` | Police-only: provision another Police account |
| GET/POST | `/animals` | Your own animals (Vet/Police see across farms) |
| PATCH | `/animals/:id/sale` | Toggle for-sale status (owner only) |
| GET/POST | `/health-events` | Health audit log |
| GET | `/inventory/:owner_id` | Medicine cabinet (owner or Vet only) |
| PATCH | `/inventory/:id/deduct` | Administer medicine & deduct stock |
| GET/POST | `/listings` | Marketplace listings — livestock tied to an animal start `pending_clearance` |
| GET/PATCH/POST | `/clearances`, `/clearances/:id` | Police sale-clearance queue |
| POST | `/listings/:id/bid`, GET `/listings/:id/bids` | Bidding — blocked until a livestock listing is cleared |
| GET/POST | `/feed` | Feed types for analyzer (public, no auth) |
| GET | `/feed/search?q=maize` | Search feed by name or species (public) |
| GET | `/cases` | Vet cases / consultations, scoped by role |
| GET | `/dashboard/:user_id` | Dashboard stats (your own, or any user's if you're Police) |

---

## Database Tables

| Table | Owner | Purpose |
|---|---|---|
| `users` | Shared | All 5 roles: Farmer, Vet, Supplier, Retailer, Police — with password hash + verification status |
| `animals` | Arnold | Herd registry with pedigree |
| `weight_history` | Arnold | Weight tracking per animal |
| `health_events` | Arnold | Vaccinations, treatments, diagnostics |
| `medicine_inventory` | Arnold | Per-farm medicine cabinet |
| `vet_cases` | Arnold | Vet Messenger cases |
| `messages` | Arnold | Messages within cases |
| `marketplace_listings` | Addy | Livestock + feed + produce for sale |
| `feed_types` | Addy | Feed Analyzer nutritional database |
| `sale_clearances` | Shared | Police sign-off on a livestock sale before it's listed |
| `bids` | Shared | Offers placed on a marketplace listing |

---

## Data Alignment — Key Fields

**User object** (shared between web + mobile):
```json
{
  "id": 1,
  "full_name": "Arnold Mapindu",
  "phone": "+263 77 100 0001",
  "email": "arnold@example.com",
  "role": "Farmer",
  "org_name": "Mapindu Family Farm",
  "province": "Mashonaland West",
  "district": "Zvimba"
}
```

**Animal listing** (web app → marketplace):
When a farmer toggles `forSale=true` on an animal, call `PATCH /animals/:id/sale`
— this auto-creates a marketplace listing with `category='livestock'`.

**Feed Analyzer** (mobile → web):
Feed types are in the shared `feed_types` table. The web app's Lifecycle section
can use `GET /feed` to show recommended feeds per species.

---

## Who built what

| Section | Builder |
|---|---|
| Web app (React + Vite) | Arnold |
| Mobile app (Expo + React Native) | Addy |
| Flask API | Addy (extended by Arnold) |
| MySQL schema | Arnold (aligned from both) |
| Disease Detection, Vet Messenger, Lifecycle, Herd Registry | Arnold |
| Dashboard, Marketplace, Feed Analyzer screens | Addy |
