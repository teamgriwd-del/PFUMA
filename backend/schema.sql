-- ============================================================
-- PFUMA — Unified Database Schema
-- Covers: Web App (Arnold) + Mobile App (Addy) + Flask API
-- ============================================================

CREATE DATABASE IF NOT EXISTS pfuma;
USE pfuma;

-- ── USERS ────────────────────────────────────────────────────
-- Shared between web + mobile. Populated from the AuthPortal.
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  national_id_number VARCHAR(20),   -- Zimbabwe national ID, e.g. 63-1234567A00 (format-checked, see backend/app.py)
  email         VARCHAR(120),
  role          ENUM('Farmer','Veterinarian','Supplier','Buyer','Police','Admin') NOT NULL,
  org_name      VARCHAR(120),          -- farm/business/practice name
  province      VARCHAR(60),
  district      VARCHAR(60),
  address       VARCHAR(200),
  -- Farmer-specific
  farm_size_ha  DECIMAL(10,2),
  species_farmed VARCHAR(200),         -- comma-separated: Cattle,Goat,...
  -- Vet-specific
  license_number VARCHAR(60),
  speciality     VARCHAR(100),
  -- Supplier/Buyer
  business_reg   VARCHAR(60),
  supply_categories VARCHAR(200),      -- comma-separated
  trading_areas  VARCHAR(200),
  -- Police-specific
  badge_number   VARCHAR(40),
  station        VARCHAR(120),
  jurisdiction_province VARCHAR(60),
  -- Auth & signup verification
  password_hash  VARCHAR(255),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  verified_by    INT NULL,             -- FK → users.id (reviewer: Police/peer Vet, or Admin for a Police applicant)
  requested_by   INT NULL,             -- FK → users.id (existing officer who nominated a new Police account; NULL for every other role)
  verification_notes TEXT,
  id_document_path         VARCHAR(300),  -- national ID upload
  credential_document_path VARCHAR(300),  -- DVS license / business reg / land proof upload
  avatar_seed    VARCHAR(80),
  avatar_url     VARCHAR(300),          -- real uploaded profile picture; falls back to the Dicebear avatar_seed when NULL
  account_status ENUM('active','suspended') NOT NULL DEFAULT 'active',  -- admin moderation (scammers etc.), separate from verification_status
  suspension_reason VARCHAR(300),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (verified_by)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);
-- Upgrades an existing database that predates the Admin role, and/or still
-- has the old 'Retailer' role name instead of 'Buyer'. MODIFY is idempotent
-- (safe to re-run) unlike ADD COLUMN, so no IF NOT EXISTS needed — but if any
-- row still holds 'Retailer' this alone isn't enough (MySQL blanks values
-- outside the new ENUM list rather than erroring); backend/app.py's
-- ensure_schema() runs the real widen → UPDATE → narrow migration for that
-- automatically on every startup, so a fresh manual run of just this file is
-- the only place this simple form is safe.
ALTER TABLE users MODIFY COLUMN role ENUM('Farmer','Veterinarian','Supplier','Buyer','Police','Admin') NOT NULL;

-- ── ANIMALS ──────────────────────────────────────────────────
-- Arnold's web app animal registry, available via API.
CREATE TABLE IF NOT EXISTS animals (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  owner_id       INT NOT NULL,         -- FK → users.id
  name           VARCHAR(80) NOT NULL,
  species        ENUM('Cattle','Goat','Sheep','Pig','Poultry') NOT NULL,
  breed          VARCHAR(80),
  birth_date     DATE,
  tag_id         VARCHAR(40),
  brand_id       VARCHAR(40),
  sire_id        VARCHAR(40),
  dam_id         VARCHAR(40),
  birth_weight   DECIMAL(8,2),
  current_weight DECIMAL(8,2),
  image_url      VARCHAR(300),
  for_sale       BOOLEAN DEFAULT FALSE,
  cost_to_date   DECIMAL(10,2) DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── ANIMAL WEIGHT HISTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  animal_id  INT NOT NULL,
  month_label VARCHAR(20),
  weight_kg  DECIMAL(8,2) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
);

-- ── ANIMAL PHOTOS ────────────────────────────────────────────
-- Extra photos beyond animals.image_url (the cover photo). A listing
-- for a linked animal shows this whole gallery on the marketplace.
CREATE TABLE IF NOT EXISTS animal_photos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  animal_id  INT NOT NULL,
  image_url  VARCHAR(300) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
);

-- ── HEALTH AUDIT LOG ─────────────────────────────────────────
-- Tracks vaccinations, treatments, diagnostics per animal.
CREATE TABLE IF NOT EXISTS health_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  animal_id   INT NOT NULL,
  animal_name VARCHAR(80),
  event_type  VARCHAR(200) NOT NULL,   -- e.g. 'FMD Vaccine', 'Diagnostic: FMD'
  notes       TEXT,
  performed_by INT,                    -- FK → users.id (vet/farmer)
  event_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- when it was actually done (backdatable)
  next_due_date DATE NULL,             -- farmer/vet-set or auto-computed next occurrence (recurring items: dips, annual boosters)
  FOREIGN KEY (animal_id)    REFERENCES animals(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id)   ON DELETE SET NULL
);

-- ── MEDICINE INVENTORY ───────────────────────────────────────
-- Per-farm medicine cabinet, tracks stock levels.
CREATE TABLE IF NOT EXISTS medicine_inventory (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  owner_id     INT NOT NULL,           -- FK → users.id (farmer)
  medicine_name VARCHAR(120) NOT NULL,
  stock        DECIMAL(10,2) DEFAULT 0,
  unit         VARCHAR(20) DEFAULT 'ml',
  min_stock    DECIMAL(10,2) DEFAULT 0,
  supplier     VARCHAR(100),
  price_usd    DECIMAL(10,2),
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── MARKETPLACE LISTINGS ──────────────────────────────────────
-- Addy's marketplace — covers both livestock (linked to animals)
-- and agri-produce/feed. animal_id is NULL for non-livestock items.
-- Livestock listings start 'pending_clearance' and only become
-- 'available' once Police clears the matching sale_clearances row.
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,           -- FK → users.id (seller)
  animal_id    INT,                    -- FK → animals.id (NULL for feed/produce)
  product_name VARCHAR(120) NOT NULL,
  category     ENUM('livestock','feed','produce','medicine','equipment') DEFAULT 'livestock',
  price        DECIMAL(10,2) NOT NULL,
  unit         VARCHAR(30) DEFAULT 'head',
  quantity     DECIMAL(10,2) DEFAULT 1,
  location     VARCHAR(120),
  description  TEXT,
  photo_url    VARCHAR(300),          -- uploaded listing photo, served from /uploads/listings/<file>
  status       ENUM('pending_clearance','available','sold','withdrawn') DEFAULT 'available',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sold_at      TIMESTAMP NULL,        -- set when a bid is accepted; feeds the real price-trend chart
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL
);

-- ── SALE CLEARANCES ───────────────────────────────────────────
-- Police sign-off that a livestock sale's papers (ownership, brand,
-- movement permit) are legitimate before the listing goes live.
CREATE TABLE IF NOT EXISTS sale_clearances (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  animal_id     INT NOT NULL,
  listing_id    INT,
  seller_id     INT NOT NULL,
  status        ENUM('pending','cleared','rejected') DEFAULT 'pending',
  movement_permit_number VARCHAR(80),
  officer_id    INT,                   -- FK → users.id (Police, once resolved)
  notes         TEXT,
  -- Traditional-authority attestation. In communal areas a sale is cleared by
  -- the village head (Sabuku) or chief (Mambo) BEFORE police verify it. The
  -- leader gets no account — the seller records the clearance and the officer
  -- verifies it, which is how it already works on paper.
  -- Commercial farms on title deed have no traditional authority, so
  -- 'not_applicable' with a reason is a valid, explicit answer.
  leader_clearance ENUM('attested','not_applicable') NULL,
  leader_type      ENUM('Sabuku','Mambo') NULL,
  leader_name      VARCHAR(120),
  leader_village   VARCHAR(120),        -- village / ward the leader presides over
  leader_cleared_on DATE,
  leader_reference VARCHAR(80),         -- reference on the written clearance, if any
  leader_document_path VARCHAR(300),    -- photo of the written clearance
  leader_na_reason VARCHAR(200),        -- why no traditional clearance applies
  officer_photo_path VARCHAR(300),      -- photo of the animal taken by the officer at clearance
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at   TIMESTAMP NULL,
  FOREIGN KEY (animal_id)  REFERENCES animals(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  FOREIGN KEY (seller_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Upgrades a database that predates traditional-authority attestation.
-- MariaDB supports ADD COLUMN IF NOT EXISTS; plain MySQL (production) does
-- not — see the note further down. app.py's ensure_schema() is authoritative.
ALTER TABLE sale_clearances
  ADD COLUMN IF NOT EXISTS leader_clearance ENUM('attested','not_applicable') NULL,
  ADD COLUMN IF NOT EXISTS leader_type      ENUM('Sabuku','Mambo') NULL,
  ADD COLUMN IF NOT EXISTS leader_name      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS leader_village   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS leader_cleared_on DATE,
  ADD COLUMN IF NOT EXISTS leader_reference VARCHAR(80),
  ADD COLUMN IF NOT EXISTS leader_document_path VARCHAR(300),
  ADD COLUMN IF NOT EXISTS leader_na_reason VARCHAR(200);

-- ── MARKETPLACE BIDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  listing_id  INT NOT NULL,
  bidder_id   INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  message     VARCHAR(300),
  status      ENUM('pending','accepted','declined') DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  FOREIGN KEY (bidder_id)  REFERENCES users(id) ON DELETE CASCADE
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
-- Real events a user needs to know about (a bid came in, a bid they placed
-- was accepted, ...). related_user_id is set whenever the notification is
-- "about" another person, so the UI can offer "Message them" straight into
-- PFUMA Messenger instead of making the user go find that person again.
CREATE TABLE IF NOT EXISTS notifications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,            -- FK → users.id (recipient)
  type            VARCHAR(40) NOT NULL,    -- 'bid_placed', 'bid_accepted', 'med_recommendation', ...
  title           VARCHAR(150) NOT NULL,
  message         VARCHAR(300) NOT NULL,
  related_user_id INT NULL,                -- FK → users.id (the other party, if any)
  listing_id      INT NULL,                -- FK → marketplace_listings.id
  animal_id       INT NULL,                -- FK → animals.id
  read_at         TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)         REFERENCES users(id)                 ON DELETE CASCADE,
  FOREIGN KEY (related_user_id) REFERENCES users(id)                 ON DELETE SET NULL,
  FOREIGN KEY (listing_id)      REFERENCES marketplace_listings(id)  ON DELETE SET NULL,
  FOREIGN KEY (animal_id)       REFERENCES animals(id)                ON DELETE SET NULL
);
CREATE INDEX idx_notifications_user_time ON notifications (user_id, created_at DESC);

-- ── MEDICATION RECOMMENDATIONS ───────────────────────────────
-- A vet recommends a specific medicine/dose to a farmer for one of their
-- animals; the farmer administers it from their own cabinet. This is the
-- clinical direction real veterinary practice runs in (vet prescribes,
-- farmer/owner administers under that guidance) — the farmer no longer
-- self-selects a medicine and dose with no vet involved.
CREATE TABLE IF NOT EXISTS medication_recommendations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  animal_id      INT NOT NULL,
  farmer_id      INT NOT NULL,             -- FK → users.id (the animal's owner, denormalized for a fast farmer-side query)
  vet_id         INT NOT NULL,             -- FK → users.id (Veterinarian who recommended it)
  medicine_name  VARCHAR(120) NOT NULL,    -- matches DOSAGE_RATES / medicine_inventory naming
  dose_ml        DECIMAL(8,2) NOT NULL,
  frequency      VARCHAR(100),
  notes          TEXT,
  status         ENUM('pending','administered','declined') DEFAULT 'pending',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  administered_at TIMESTAMP NULL,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (vet_id)    REFERENCES users(id)   ON DELETE CASCADE
);
CREATE INDEX idx_medrec_animal ON medication_recommendations (animal_id, status);
CREATE INDEX idx_medrec_farmer ON medication_recommendations (farmer_id, status);

-- ── VET CASES / MESSAGES ─────────────────────────────────────
-- Vet Messenger cases from the web app. Also used by mobile.
CREATE TABLE IF NOT EXISTS vet_cases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id    INT NOT NULL,           -- FK → users.id
  vet_id       INT,                    -- FK → users.id (assigned vet)
  animal_id    INT,
  category     ENUM('Emergency','Vaccination','Trade Certification','General') DEFAULT 'General',
  subject      VARCHAR(200) NOT NULL,
  province     VARCHAR(60),
  district     VARCHAR(60),
  priority     ENUM('Critical','Routine') DEFAULT 'Routine',
  status       ENUM('Pending','EMERGENCY','Certified','Closed') DEFAULT 'Pending',
  certificate_issued BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (vet_id)    REFERENCES users(id)   ON DELETE SET NULL,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT NOT NULL,
  sender_id   INT,                     -- NULL = system/auto-response
  sender_role ENUM('Farmer','Vet','System') DEFAULT 'Farmer',
  message     TEXT NOT NULL,
  sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)   REFERENCES vet_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)     ON DELETE SET NULL
);

-- ── PFUMA MESSENGER (real direct messaging, any verified user to any
-- other) ─────────────────────────────────────────────────────────
-- Distinct from vet_cases/messages above (an older, narrower farmer<->vet
-- case-ticket concept that was never wired to a route). A conversation is
-- a thread between two users, optionally tagged with a subject/category
-- (e.g. a farmer's "Emergency" or "Trade Certification" message to a vet
-- carries that context) — but the underlying mechanism is general-purpose:
-- any verified user can message any other verified user directly.
CREATE TABLE IF NOT EXISTS conversations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_a_id        INT NOT NULL,        -- conversation creator
  user_b_id        INT NOT NULL,        -- the person they messaged
  subject          VARCHAR(200),
  category         ENUM('Emergency','Vaccination','Trade Certification','General') DEFAULT 'General',
  animal_id        INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_a_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations (user_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations (user_b_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id  INT NOT NULL,
  sender_id        INT NOT NULL,
  message          TEXT NOT NULL,       -- may be '' when the message is attachment-only
  attachment_url   VARCHAR(300),        -- private route (/attachments/<id>), not a public /uploads path
  attachment_name  VARCHAR(150),        -- original filename, for non-image display
  sent_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at          TIMESTAMP NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id)          ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_time ON conversation_messages (conversation_id, sent_at);

-- ── COOPERATIVES ───────────────────────────────────────────────
-- Communal farmers coordinate through a real shared dip tank / grazing
-- association, not as isolated individuals — this models that group so
-- "when do we dip" and "can a vet see all of us at once" are real
-- features instead of word-of-mouth.
CREATE TABLE IF NOT EXISTS cooperatives (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  province    VARCHAR(60) NOT NULL,
  district    VARCHAR(60),
  dip_tank_location VARCHAR(150),
  created_by  INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooperative_members (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cooperative_id INT NOT NULL,
  user_id        INT NOT NULL,
  role           ENUM('admin','member') DEFAULT 'member',
  joined_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member (cooperative_id, user_id),
  FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooperative_dip_schedule (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cooperative_id INT NOT NULL,
  scheduled_date DATE NOT NULL,
  notes          TEXT,
  created_by     INT NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)     REFERENCES users(id)        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooperative_vet_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cooperative_id INT NOT NULL,
  requested_by   INT NOT NULL,
  reason         TEXT NOT NULL,
  preferred_date DATE,
  status         ENUM('open','claimed','completed') DEFAULT 'open',
  vet_id         INT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at   TIMESTAMP NULL,
  FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vet_id)         REFERENCES users(id) ON DELETE SET NULL
);

-- ── OUTBREAKS ──────────────────────────────────────────────────
-- Disease outbreak reports filed by a Vet or Police officer. Visible to
-- every user in the affected province (a real safety warning), not just
-- Vet/Police oversight — see /outbreaks GET.
CREATE TABLE IF NOT EXISTS outbreaks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  disease_name    VARCHAR(120) NOT NULL,
  district        VARCHAR(80),
  province        VARCHAR(60) NOT NULL,
  status          ENUM('active','contained','resolved') DEFAULT 'active',
  details         TEXT,
  affected_farms  INT DEFAULT 0,
  animals_at_risk VARCHAR(60),
  reported_by     INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at     TIMESTAMP NULL,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ── ORDERS (Supplier fulfillment) ────────────────────────────────
-- A Farmer ordering medicine/equipment from a Supplier's marketplace
-- listing — distinct from the livestock `bids` table (an order is a fixed
-- quantity request, not a price negotiation).
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  listing_id    INT NOT NULL,
  farmer_id     INT NOT NULL,
  supplier_id   INT NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL,
  status        ENUM('pending','dispatched','delivered','cancelled') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TIMESTAMP NULL,
  delivered_at  TIMESTAMP NULL,
  FOREIGN KEY (listing_id)  REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── FEED TYPES (Addy's Feed Analyzer) ────────────────────────
CREATE TABLE IF NOT EXISTS feed_types (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  category         ENUM('protein','energy','roughage','mineral','mixed') DEFAULT 'mixed',
  protein_percent  DECIMAL(5,2),
  energy_mj        DECIMAL(6,2),
  fibre_percent    DECIMAL(5,2),
  calcium_percent  DECIMAL(5,2),
  phosphorus_percent DECIMAL(5,2),
  description      TEXT,
  suitable_for     VARCHAR(200)         -- comma-separated species
);

-- ── FEEDING PLANS (Ration Builder) ────────────────────────────
-- A saved ration for one real animal: server computes the animal's daily
-- protein/energy requirement from its species+weight+age, prices each feed
-- item against live PFUMA Marketplace listings where possible, and stores
-- the verdict so a farmer can track ration cost/quality over time instead
-- of just browsing a static nutrition table.
CREATE TABLE IF NOT EXISTS feeding_plans (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  animal_id         INT NOT NULL,
  owner_id          INT NOT NULL,
  species           VARCHAR(20) NOT NULL,
  weight_kg         DECIMAL(8,2) NOT NULL,
  life_stage        VARCHAR(20) NOT NULL,
  target_protein_g  DECIMAL(8,2) NOT NULL,
  target_energy_mj  DECIMAL(8,2) NOT NULL,
  items             JSON NOT NULL,          -- [{feed_type_id, name, qty_kg, protein_g, energy_mj, unit_cost_usd, line_cost_usd, priced}]
  total_protein_g   DECIMAL(8,2) NOT NULL,
  total_energy_mj   DECIMAL(8,2) NOT NULL,
  total_cost_usd    DECIMAL(10,2) NOT NULL DEFAULT 0,
  protein_status    ENUM('deficient','balanced','excess') NOT NULL,
  energy_status     ENUM('deficient','balanced','excess') NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_feeding_plans_animal (animal_id)
);

-- ── IOT DEVICES ────────────────────────────────────────────────
-- Physical collar/base-station pairing: a farmer claims a device by
-- its printed serial number from the app's IoT tab.
CREATE TABLE IF NOT EXISTS iot_devices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_serial VARCHAR(60) NOT NULL UNIQUE,
  device_type   ENUM('collar','base_station') NOT NULL DEFAULT 'collar',
  animal_id     INT,                   -- FK → animals.id (collars only — NULL for base stations, and NULL until attached for an unattached collar)
  owner_id      INT NOT NULL,          -- FK → users.id (farmer who paired it)
  paired_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id)  REFERENCES users(id)   ON DELETE CASCADE
);

-- ── IOT READINGS ───────────────────────────────────────────────
-- Real telemetry from a paired physical collar, as decoded by the base
-- station firmware and posted to /api/iot/telemetry or /api/iot/alert.
-- Distinct from the app's built-in demo simulator (HardwareSimulation.jsx),
-- which is used whenever a device has no real readings yet.
CREATE TABLE IF NOT EXISTS iot_readings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  device_id    INT NOT NULL,          -- FK → iot_devices.id (the collar)
  temp_c       DECIMAL(4,1),
  heart_rate   INT,
  latitude     DECIMAL(9,6),
  longitude    DECIMAL(9,6),
  gps_accuracy DECIMAL(5,1),
  activity     VARCHAR(20),
  move_mag     INT,
  in_zone      BOOLEAN,
  battery_pct  INT,
  fever_alert  BOOLEAN DEFAULT FALSE,
  theft_alert  BOOLEAN DEFAULT FALSE,
  packet_no    INT,
  rssi         INT,                   -- LoRa signal strength in dBm, as seen by the base station
  received_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_iot_readings_device_time ON iot_readings (device_id, received_at DESC);

-- ── GEOFENCES ──────────────────────────────────────────────────
-- A farmer's safe-zone boundary. One farmer can have several rows over
-- time (e.g. redrawn for a show demo); the most recent one per owner_id
-- is treated as the active zone everywhere it's read.
CREATE TABLE IF NOT EXISTS geofences (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  owner_id    INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  center_lat  DECIMAL(9,6) NOT NULL,
  center_lon  DECIMAL(9,6) NOT NULL,
  radius_m    INT NOT NULL,
  created_by  INT NULL,          -- admin/user who drew this zone, if known
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);


-- ── VACCINATION COMPLIANCE CASES ──────────────────────────────
-- A missed mandatory vaccination is not just a red badge on a dashboard —
-- it opens a case that a vet actually follows up on. The ladder is:
--   reminder → vet_followup → notice → penalty (trade lockout)
-- with a grace period between each stage, and it stops the moment the
-- vaccination is logged (the case auto-resolves in add_health_event).
--
-- The 'deferred' stage is the point of the whole design. Most missed
-- vaccinations in communal areas are not defiance — the vaccine is out of
-- stock, no vet has come through the ward, or there is no cash this month.
-- A farmer declaring a blocker pauses the clock, carries NO penalty, and
-- routes the case to whoever can unblock it (supplier / vet dispatch /
-- cooperative) instead of punishing them for a supply failure.
--
-- The penalty is deliberately NOT a monetary fine: the platform cannot
-- collect one, and fining a peasant farmer for an unavailable vaccine is
-- both unjust and unenforceable. It is a per-ANIMAL trade lockout — that
-- animal cannot be listed or cleared for sale until the shot is logged.
-- Per-animal, so the farmer's other stock, feed and produce still trade.
CREATE TABLE IF NOT EXISTS compliance_cases (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  animal_id       INT NOT NULL,
  owner_id        INT NOT NULL,          -- FK → users.id (farmer), denormalised for queue queries
  vaccine_name    VARCHAR(120) NOT NULL, -- protocol item, e.g. 'FMD Vaccine'
  species         VARCHAR(20),
  due_date        DATE NOT NULL,         -- the date the shot became due
  stage           ENUM('reminder','vet_followup','notice','penalty','deferred','resolved','waived')
                  NOT NULL DEFAULT 'reminder',
  stage_due       DATE NULL,             -- when this stage's grace period expires
  trade_locked    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Vet override: sale allowed on condition the animal is vaccinated at the
  -- point of sale. Lets a distressed farmer raise cash without the herd
  -- going unvaccinated.
  conditional_clearance BOOLEAN NOT NULL DEFAULT FALSE,
  vet_id          INT NULL,              -- FK → users.id (vet handling the follow-up)
  province        VARCHAR(60),           -- copied from owner, so a vet can scope by province
  district        VARCHAR(60),
  -- ── "I can't comply" path ──
  blocker_reason  ENUM('vaccine_unavailable','no_vet_access','financial_hardship','animal_condition','other') NULL,
  blocker_notes   VARCHAR(300),
  deferred_until  DATE NULL,
  defer_count     SMALLINT NOT NULL DEFAULT 0,
  routed_to       ENUM('supplier','vet_dispatch','cooperative','vet_review') NULL,
  opened_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_action_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at     TIMESTAMP NULL,
  resolved_event_id INT NULL,            -- FK → health_events.id (the shot that closed it)
  -- One case per missed occurrence: re-scanning must not open duplicates.
  UNIQUE KEY uniq_case_occurrence (animal_id, vaccine_name, due_date),
  FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (vet_id)    REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_compliance_stage (stage, province),
  INDEX idx_compliance_animal (animal_id)
);

-- Every step of a case, so a lockout can always be explained after the fact
-- (and disputed). This is the evidence trail behind the animal timeline.
CREATE TABLE IF NOT EXISTS compliance_actions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  case_id    INT NOT NULL,
  action     ENUM('opened','reminded','escalated','notice_issued','deferred',
                  'defer_accepted','defer_rejected','locked','unlocked',
                  'conditional_clearance','resolved','waived') NOT NULL,
  actor_id   INT NULL,                   -- NULL = the system (auto-escalation)
  actor_role VARCHAR(20),
  notes      VARCHAR(400),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)  REFERENCES compliance_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_compliance_actions_case (case_id, created_at)
);


-- ── UPGRADES FOR EXISTING DATABASES ───────────────────────────
-- Columns added after the first release. A database created earlier will not
-- pick these up from CREATE TABLE IF NOT EXISTS, and the seed data below
-- references some of them, so re-importing without these would fail.
-- ADD COLUMN IF NOT EXISTS is a MariaDB-only extension — plain MySQL (which
-- is what production actually runs) rejects it with a syntax error, so this
-- block silently no-ops there. backend/app.py's ensure_schema() is the real,
-- portable migration path (checks information_schema before a plain ALTER)
-- and runs automatically on every backend startup — treat these blocks as
-- reference/manual-import-only, not what production actually depends on.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(300),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(300);

ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS photo_url VARCHAR(300),
  ADD COLUMN IF NOT EXISTS sold_at   TIMESTAMP NULL;

ALTER TABLE health_events
  ADD COLUMN IF NOT EXISTS next_due_date DATE;

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS attachment_url  VARCHAR(300),
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(150);

-- ── SEED DATA ─────────────────────────────────────────────────
-- Demo password for every seeded account below: Pfuma2026!
-- (bcrypt hash generated once — do not reuse this hash pattern for real accounts)

-- Demo user: Police (seed admin account — Police signups are not self-service; a real
-- deployment would provision officer accounts out-of-band, e.g. via ZRP/DVS liaison).
-- Inserted first since other seed users reference it as their verifier.
INSERT IGNORE INTO users (id, full_name, phone, national_id_number, email, role, org_name, province, badge_number, station, jurisdiction_province, password_hash, verification_status)
VALUES (5, 'Officer Farai Chikwanha', '0775000005', '63-1000005E00', 'fchikwanha@zrp.gov.zw', 'Police', 'ZRP Stock Theft Unit', 'Mashonaland West', 'ZRP-STU-0231', 'Chegutu Police Station', 'Mashonaland West', '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG', 'verified');

-- Demo user: Farmer Arnold
INSERT IGNORE INTO users (id, full_name, phone, national_id_number, email, role, org_name, province, district, farm_size_ha, species_farmed, password_hash, verification_status, verified_by)
VALUES (1, 'Arnold Mapindu', '0771000001', '63-1000001A05', 'arnold@example.com', 'Farmer', 'Mapindu Family Farm', 'Mashonaland West', 'Zvimba', 50.0, 'Cattle,Goat', '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG', 'verified', 5);

-- Demo user: Vet
INSERT IGNORE INTO users (id, full_name, phone, national_id_number, email, role, org_name, province, license_number, speciality, password_hash, verification_status, verified_by)
VALUES (2, 'Dr T. Moyo', '0772000002', '63-1000002B12', 'tmoyo@dvs.gov.zw', 'Veterinarian', 'DVS Mashonaland West', 'Mashonaland West', 'DVS-ZIM-2024-0045', 'Tick-borne Diseases', '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG', 'verified', 5);

-- Demo user: Supplier
INSERT IGNORE INTO users (id, full_name, phone, national_id_number, role, org_name, province, business_reg, supply_categories, password_hash, verification_status, verified_by)
VALUES (3, 'Chido Ncube', '0773000003', '63-1000003C08', 'Supplier', 'AgroChem Zimbabwe', 'Harare', 'BP-12345/2024', 'Vaccines,Antibiotics,Antiparasitcs', '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG', 'verified', 5);

-- Demo user: Buyer
INSERT IGNORE INTO users (id, full_name, phone, national_id_number, role, org_name, province, business_reg, trading_areas, password_hash, verification_status, verified_by)
VALUES (4, 'ZimAgro Enterprise', '0774000004', '63-1000004D19', 'Buyer', 'ZimAgro Ltd', 'Harare', 'BP-67890/2023', 'Mashonaland West,Midlands,Harare', '$2b$12$ehzt67O363Q.ihnPFIXf5uNgjqwdMcLgcCoYe7RaGV7lCl1uVblHG', 'verified', 5);

-- Demo animals (owned by Arnold)
INSERT IGNORE INTO animals (id, owner_id, name, species, breed, birth_date, tag_id, brand_id, birth_weight, current_weight, for_sale)
VALUES
  (101, 1, 'Bessie',  'Cattle', 'Brahman', '2023-10-15', 'ZIM-882', 'AR-MP', 35, 420, FALSE),
  (102, 1, 'Thunder', 'Cattle', 'Angus',   '2024-05-20', 'ZIM-104', 'AR-MP', 32, 380, TRUE);

-- Weight history for Bessie
INSERT IGNORE INTO weight_history (animal_id, month_label, weight_kg) VALUES
  (101, 'Oct', 35), (101, 'Dec', 85), (101, 'Feb', 150),
  (101, 'Apr', 210), (101, 'Jun', 280), (101, 'Aug', 350), (101, 'Oct', 420);

-- Weight history for Thunder
INSERT IGNORE INTO weight_history (animal_id, month_label, weight_kg) VALUES
  (102, 'May', 32), (102, 'Jul', 90), (102, 'Sep', 160),
  (102, 'Nov', 240), (102, 'Jan', 310), (102, 'Mar', 380);

-- Demo health event
INSERT IGNORE INTO health_events (id, animal_id, animal_name, event_type, performed_by, event_date)
VALUES (1, 101, 'Bessie', 'FMD Vaccine (Annual)', 2, '2026-02-15 10:30:00');

-- Medicine inventory for Arnold
INSERT IGNORE INTO medicine_inventory (id, owner_id, medicine_name, stock, unit, min_stock, supplier, price_usd)
VALUES
  (1, 1, 'Oxytetracycline (LA)', 500, 'ml', 100, 'AgroChem Zim', 25),
  (2, 1, 'Buparvaquone',         120, 'ml', 50,  'VetDirect',    85),
  (3, 1, 'Albendazole',         1000, 'ml', 200, 'AgroChem Zim', 15);

-- Marketplace listing for Thunder (linked to animal) — already cleared for demo purposes
INSERT IGNORE INTO marketplace_listings (id, user_id, animal_id, product_name, category, price, unit, quantity, location, description, status)
VALUES (201, 1, 102, 'Thunder — Angus Cattle', 'livestock', 770, 'head', 1, 'Zvimba, Mashonaland West', 'Healthy 1y 9m Angus bull. DVS certified. Verified health passport.', 'available');

-- Matching sale clearance for Thunder's listing — approved by the demo Police account
INSERT IGNORE INTO sale_clearances (id, animal_id, listing_id, seller_id, status, movement_permit_number, officer_id, notes, resolved_at)
VALUES (14, 102, 201, 1, 'cleared', 'DVS-MP-2026-00417', 5, 'Ownership and brand verified against ZRP stock register. Cleared for sale.', NOW());

-- Marketplace listings from Addy's demo data
INSERT IGNORE INTO marketplace_listings (id, user_id, product_name, category, price, unit, quantity, location, description, status)
VALUES
  (202, 1, 'Soya Bean Meal', 'feed',    0.65, 'kg', 500,  'Harare',    'High quality soya meal', 'available'),
  (203, 1, 'Maize Grain',    'feed',    0.35, 'kg', 1000, 'Bulawayo',  'Fresh maize grain',      'available');

-- Past sold livestock (Arnold selling, ZimAgro Buyer buying) so the
-- Buyer Dashboard's real "Recent Bids" and "Price Trend" have something
-- to show out of the box instead of being empty for a first-run demo.
INSERT IGNORE INTO animals (id, owner_id, name, species, breed, birth_date, tag_id, brand_id, birth_weight, current_weight, for_sale)
VALUES
  (103, 1, 'Daisy', 'Cattle', 'Brahman', '2023-02-10', 'ZIM-701', 'AR-MP', 33, 460, FALSE),
  (104, 1, 'Rocky', 'Cattle', 'Angus',   '2023-06-05', 'ZIM-702', 'AR-MP', 31, 440, FALSE),
  (105, 1, 'Storm', 'Cattle', 'Brahman', '2023-09-18', 'ZIM-703', 'AR-MP', 34, 410, FALSE);

INSERT IGNORE INTO marketplace_listings (id, user_id, animal_id, product_name, category, price, unit, quantity, location, description, status, created_at, sold_at)
VALUES
  (301, 1, 103, 'Daisy — Brahman Cattle', 'livestock', 610, 'head', 1, 'Zvimba, Mashonaland West', 'Healthy Brahman cow, DVS certified.', 'sold', NOW() - INTERVAL 3 MONTH, NOW() - INTERVAL 3 MONTH),
  (302, 1, 104, 'Rocky — Angus Cattle',   'livestock', 705, 'head', 1, 'Zvimba, Mashonaland West', 'Healthy Angus bull, DVS certified.',  'sold', NOW() - INTERVAL 2 MONTH, NOW() - INTERVAL 2 MONTH),
  (303, 1, 105, 'Storm — Brahman Cattle', 'livestock', 680, 'head', 1, 'Zvimba, Mashonaland West', 'Healthy Brahman bull, DVS certified.','sold', NOW() - INTERVAL 1 MONTH, NOW() - INTERVAL 1 MONTH);

INSERT IGNORE INTO bids (id, listing_id, bidder_id, amount, message, status, created_at)
VALUES
  (401, 301, 4, 610, 'Interested — can collect this week.', 'accepted', NOW() - INTERVAL 3 MONTH),
  (402, 302, 4, 705, 'Good price, taking it.',               'accepted', NOW() - INTERVAL 2 MONTH),
  (403, 303, 4, 680, 'Deal — sending payment.',               'accepted', NOW() - INTERVAL 1 MONTH);

-- Feed types (for Addy's Feed Analyzer)
INSERT IGNORE INTO feed_types (id, name, category, protein_percent, energy_mj, fibre_percent, calcium_percent, phosphorus_percent, description, suitable_for) VALUES
  (1, 'Soya Bean Meal',     'protein',   45.0, 13.5, 6.0,  0.30, 0.65, 'High protein supplement — ideal for growing cattle and dairy cows.', 'Cattle,Goat'),
  (2, 'Maize Grain',        'energy',    8.5,  14.2, 2.5,  0.03, 0.28, 'Primary energy source in most livestock rations in Zimbabwe.',         'Cattle,Goat,Sheep,Pig'),
  (3, 'Cotton Seed Cake',   'protein',   38.0, 12.8, 12.0, 0.20, 0.90, 'By-product of cotton oil extraction — good rumen buffer for cattle.', 'Cattle'),
  (4, 'Sunflower Cake',     'protein',   32.0, 11.0, 15.0, 0.35, 0.95, 'Lower protein than soya but cost-effective for maintenance rations.', 'Cattle,Goat,Sheep'),
  (5, 'Wheat Bran',         'roughage',  15.5, 11.5, 10.5, 0.12, 1.10, 'Good source of phosphorus and digestible fibre for ruminants.',       'Cattle,Goat,Sheep'),
  (6, 'Dicalcium Phosphate','mineral',   0.0,  0.0,  0.0,  26.0, 18.5, 'Mineral supplement to correct calcium/phosphorus deficiencies.',      'Cattle,Goat,Sheep,Pig'),
  (7, 'Lucerne Hay',        'roughage',  17.5, 9.5,  28.0, 1.50, 0.25, 'Excellent high-protein roughage especially for dairy and young stock.','Cattle,Goat,Sheep'),
  (8, 'Commercial Grower',  'mixed',     18.0, 12.5, 7.0,  0.90, 0.70, 'Ready-mixed ration for growing cattle 6-18 months. Balanced micro-nutrients.','Cattle');
