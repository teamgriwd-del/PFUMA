# PFUMA - Enterprise Agri-Health Intelligence

PFUMA is a comprehensive, enterprise-grade livestock health and management platform specifically tailored for Zimbabwean farmers and veterinarians. Built for the Zimbabwe Agricultural Show, it provides digital tools to enhance productivity, automate health compliance, and provide rapid emergency response.

## 👑 The PFUMA Experience

### 1. Jinda: The AI Farm Assistant
A state-of-the-art AI assistant trained on a vast knowledge base of Zimbabwean livestock protocols.
- **NLP Engine:** Handles natural language queries from non-technical users.
- **Smart Navigation:** Responds to commands like "Take me to the marketplace" or "Take me home."
- **Deep Knowledge:** Trained on January Disease (Theileriosis), Anthrax, and Cattle Gestation/Weaning standards.
- **Herd Analytics:** Instantly calculates herd size and health trends via chat.

### 2. Enterprise Diagnostics (Weighted Engine)
Advanced diagnostic system with weighted symptom matching.
- **Weighted Logic:** Differentiates between Primary and Secondary symptoms.
- **Action Plans:** Provides multi-step procedures for commercial farm management.
- **Zim Focus:** Specific training on regional threats common in Mashonaland, Matabeleland, and Midlands.

### 3. Health & Compliance (Lifecycle Engine)
A full-lifecycle system ensuring commercial compliance.
- **Automated Lifecycle:** Real-time countdowns for weaning and gestation.
- **Digital Audit Log:** Permanent, timestamped records of every vaccination and treatment.
- **Compliance Tracking:** Color-coded status for Overdue, Due Today, and Upcoming tasks.

### 4. Veterinary Advisory Portal
Structured ticketing system localized for Zimbabwe.
- **Regional Surveillance:** Location tagging by Province and District for national disease tracking.
- **Direct Hotlines:** Instant access to Department of Veterinary Services (DVS) regional offices.

### 5. Police Oversight & Sale Clearance
A fifth stakeholder role modelling real-world livestock-trade law enforcement.
- **Signup Verification Queue:** Police review Farmer/Supplier/Retailer applications (Vets are peer-reviewed by an existing verified vet); Police accounts are provisioned out-of-band, not self-service.
- **Sale Clearance Queue:** Every livestock marketplace listing tied to a registered animal starts `pending_clearance` and stays invisible to buyers until an officer verifies ownership/brand papers and issues a movement permit number.
- **Document Verification at Signup:** Every role uploads an ID document plus a role-specific credential (DVS license, business registration, land proof, etc.) — see `compliance/signup-verification-requirements.md`.

### 6. Compliance Knowledge Base
Researched, cited reference material — not legal advice — covering Zimbabwean livestock law and species-specific health requirements for Cattle, Pigs, Sheep, and Goats. See the [`compliance/`](compliance/) folder. Jinda draws on a condensed version of this to answer "what do I need to legally keep/sell X" questions in-chat.

### 7. Real Authentication & Role-Based Access Control
- **Password auth (bcrypt) + JWT sessions** — no endpoint is open to an unauthenticated caller except health-check, login, register, and public feed reference data.
- **Per-owner data scoping** — a Farmer only ever sees their own animals/health records/inventory; Vets and Police get oversight visibility; the AI companion is role-aware and refuses to discuss another user's data.
- **Uploaded documents** are stored outside the web root and served only to the document's owner or an authorized reviewer.

## 🛠️ Technical Stack
- **Frontend:** React (Vite) + Tailwind CSS v4
- **Backend:** Flask + PyMySQL, bcrypt password hashing, PyJWT sessions
- **Visualization:** Recharts (Historical Trends & Herd Analytics)
- **Intelligence:** Custom NLP Logic (Jinda Engine), role-aware, sourced from `compliance/`

## 🚀 Running Locally

The whole stack launches from **`run_project.bat`** (double-click it, or run it from a terminal in this folder). It starts the database, backend, web frontend, and Expo mobile app in separate windows.

### One-time setup
1. **Install backend Python deps:** `py -m pip install -r backend\requirements.txt`
2. **Install web deps (root):** `npm install`
3. **Install mobile deps (`app\`):** `cd app && npm install`
4. **Database:** MySQL/MariaDB comes from **XAMPP** (`C:\xampp\mysql`). The schema is created automatically the first time by loading `backend\schema.sql`:
   ```
   "C:\xampp\mysql\bin\mysql.exe" -u root < backend\schema.sql
   ```
   This creates the `pfuma` database (user `root`, empty password — matches `get_db()` in `backend/app.py`).

### Connecting the phone (Expo) to the backend — IMPORTANT
The mobile app talks to Flask over Wi-Fi, so two things must be right or you'll get **"Could not reach the PFUMA API. Check that Flask is running and API in config.js points to your PC's IP":**

1. **`app\config.js` → `API`** must be set to *this PC's current Wi-Fi IPv4*, e.g. `http://192.168.2.32:5000`. Find it by running `ipconfig` (the `.bat` also prints it on launch). **This changes when you switch networks** — update that one line when it does.
2. **Flask must listen on all interfaces.** `backend/app.py` runs `app.run(host='0.0.0.0', ...)` — do not change it back to the default `127.0.0.1`, or only the PC (not the phone) can reach it.
3. Phone and PC must be on the **same Wi-Fi network**, and Windows Firewall must allow Python through (allow it if prompted the first time).

### What each window is
| Window | What it runs | Address |
|--------|--------------|---------|
| PFUMA MySQL | XAMPP MariaDB | localhost:3306 |
| PFUMA Backend | Flask API (`py app.py`) | http://localhost:5000 |
| PFUMA Frontend | Vite web dev server | (Vite prints the URL) |
| PFUMA Expo | Expo mobile dev server | (scan QR in Expo Go) |

If the MySQL window says **"port in use,"** that's harmless — the database is already running.

## 🌍 Target Market
Specifically designed for the **Zimbabwean agricultural landscape**, bridging the gap between traditional farming wisdom and modern enterprise technology.

---
© 2026 PFUMA - Team GRIWD (Zimbabwe Agricultural Show)
