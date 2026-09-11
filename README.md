# PFUMA/INGCEBO - Enterprise Agri-Health Intelligence

*pfuma* — the Shona word for wealth. For a rural family, that wealth is standing in the kraal. PFUMA/INGCEBO is the system that protects it.

PFUMA/INGCEBO is a comprehensive, enterprise-grade livestock health and management platform specifically tailored for Zimbabwean farmers and veterinarians. Built for the Zimbabwe Agricultural Show, it provides digital tools to enhance productivity, automate health compliance, and provide rapid emergency response.

## 📊 The Problem

Livestock is often a rural family's largest store of wealth. It is also the least protected asset they own.

- **500,000+** cattle lost to disease (Theileriosis / "January Disease") since 2016 — most of it preventable if caught early.
- **3,400+** arrests in a single stock-theft crackdown operation.
- **0** verifiable digital records — police can't clear a sale they have no visibility into, and a buyer can't check a story he's only been told.
- **Paper trail, not a real one.** Ownership, health history, vaccination records and past sales are tracked on paper, by memory, or not at all — a record that can be lost, forged, or simply never existed in the first place.
- **No way to verify livestock history.** A buyer has no way to confirm an animal's health record, vaccination status, or true ownership before paying — they're trusting a stranger's word, not a record.
- **Ownership disputes with no evidence.** If a cow is stolen or its ownership is disputed, a farmer has no fast, credible way to prove it's really his.
- **Informal, undocumented sales channels.** Farmers relying on word-of-mouth buyers get lowballed with no visibility into fair market price, and have no documented sale history to fall back on.
- **Livestock wealth is illiquid.** Without verified ownership and health records, that wealth is hard to use as proof of value when a farmer needs credit.

The gap isn't goodwill — it's proof.

## 👑 The PFUMA/INGCEBO Experience

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

### 8. Agri Marketplace
Livestock, feed, medicine and equipment listings in one feed.
- **Verified suppliers only** — feed, medicine and vaccine listings come from suppliers vetted at signup.
- **Livestock listings gated by clearance** — an animal-backed listing stays `pending_clearance` and invisible to buyers until police verify ownership/brand papers.
- Buyers see a record, not a stranger's word — the vet's health note and the police clearance travel with the sale.

### 9. PFUMA/INGCEBO Messenger
Direct in-app chat connecting every role — farmers, vets, suppliers and buyers — across Zimbabwe, filterable by role (Vets / Suppliers / Farmers / Buyers) so a farmer can go straight to the DVS officer or supplier they need instead of a phone call and a guess.

## 🐄 The Journey of One Animal

| Step | What happens |
|---|---|
| **1. Register** | The farmer records breed, weight, tag ID, brand mark and dip-tank details. No brand on record is flagged as a risk before any sale. |
| **2. Track** | Weight, vaccinations, weaning and gestation run on countdowns. Overdue, due-today and upcoming are colour-coded, not remembered. |
| **3. Treat** | The farmer messages a vet in-app. The vet reviews, treats, and can order medicine from a supplier — three roles, one system. |
| **4. Clear** | The listing opens as `pending_clearance`. An officer verifies ownership and brand papers and issues a movement-permit number. |
| **5. Sell** | Only now can buyers see it. The vet's health record and the police clearance travel with the sale. |

**The headline feature:** the sale cannot go live until an officer clears it. That gate lives in the software, not in a policy document — which is exactly why it doesn't get skipped.

Every registered animal also gets a **Health Passport** — verified digital pedigree and medical record, photos, identity details (name, ear tag, owner brand, breed, age/species), and an **estimated market value** computed from weight, species and health-record history.

## ⚖️ Built on Zimbabwean Law

Every headline feature maps to a specific Act — researched, cited, and in the repo (`compliance/`) for anyone who wants to check it. This is researched and cited, not a lawyer-certified audit; sources are ZimLII, FAOLEX, CVSZ, Veritas and the Consumer Council, and where a detail couldn't be confirmed, the research says so plainly instead of guessing.

| What PFUMA/INGCEBO enforces | The law it operationalizes |
|---|---|
| Listings start `pending_clearance`; an officer verifies ownership and brand papers and issues a movement-permit number | Stock Theft Prevention Act [9:18] |
| Vet signup requires a CVSZ registration number, peer-reviewed by an already-verified vet | Veterinary Surgeons Act [27:15] |
| Animal records capture brand mark, tag ID and dip-tank; "no brand on record" is flagged before a sale | Brands Act + Livestock Identification Regs |
| Jinda pushes toward DVS or police reporting when a notifiable-disease pattern appears | Animal Health Act [19:01] |
| Cross-district sales prompt for a DVS veterinary movement permit alongside police clearance | The "two-gate" movement process |
| Retailer signup requires acknowledging disclosure, fixed pricing and the statutory right of return | Consumer Protection Act [14:44] |

## 🌾 What This Changes

| For | The change |
|---|---|
| **The Farmer** | Ownership he can prove, disease caught early, and a fair, documented sales channel instead of an isolated lowball offer. Verified profiles and clean sale history also make livestock wealth easier to borrow against. |
| **The Veterinarian** | Fewer wasted trips and real outbreak visibility. Province and district tagging builds exactly the regional surveillance data DVS needs for contact tracing. |
| **Suppliers and Retailers** | A direct channel to the farmers who need their stock, and buyers who are no longer one bad purchase away from a receiving-stolen-goods charge. |
| **Police and DVS** | Clearance stops being a paper courtesy and becomes a structural gate. Officers review from a queue instead of chasing paperwork on foot. |
| **The Country** | Fewer disease deaths, less theft, better price discovery and easier access to credit compound into real rural household income — a measurable outcome, not a technology showcase. |

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
The mobile app talks to Flask over Wi-Fi, so two things must be right or you'll get **"Could not reach the PFUMA/INGCEBO API. Check that Flask is running and API in config.js points to your PC's IP":**

1. **`app\config.js` → `API`** must be set to *this PC's current Wi-Fi IPv4*, e.g. `http://192.168.2.32:5000`. Find it by running `ipconfig` (the `.bat` also prints it on launch). **This changes when you switch networks** — update that one line when it does.
2. **Flask must listen on all interfaces.** `backend/app.py` runs `app.run(host='0.0.0.0', ...)` — do not change it back to the default `127.0.0.1`, or only the PC (not the phone) can reach it.
3. Phone and PC must be on the **same Wi-Fi network**, and Windows Firewall must allow Python through (allow it if prompted the first time).

### What each window is
| Window | What it runs | Address |
|--------|--------------|---------|
| PFUMA/INGCEBO MySQL | XAMPP MariaDB | localhost:3306 |
| PFUMA/INGCEBO Backend | Flask API (`py app.py`) | http://localhost:5000 |
| PFUMA/INGCEBO Frontend | Vite web dev server | (Vite prints the URL) |
| PFUMA/INGCEBO Expo | Expo mobile dev server | (scan QR in Expo Go) |

If the MySQL window says **"port in use,"** that's harmless — the database is already running.

## 🌍 Target Market
Specifically designed for the **Zimbabwean agricultural landscape**, bridging the gap between traditional farming wisdom and modern enterprise technology.

**Inclusive by design:** signup accepts title deeds, 99-year leases, A1/A2 permits, and communal land allocation letters — so communal farmers are not excluded by paperwork.

---
© 2026 PFUMA/INGCEBO - Team GRIWD (Arnold T. Mapindu · Adrianny Jaliele) — Zimbabwe Agricultural Show 2026, presented with TelOne Centre for Learning
