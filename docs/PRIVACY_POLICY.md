# PFUMA Privacy Policy

**Last updated:** [DATE — fill in before publishing]
**Applies to:** the PFUMA web app, mobile app, and API (pfuma.co.zw and associated domains)

This policy explains what information PFUMA collects, why, who can see it, and
what rights you have over it. It is written in plain language on purpose. If
anything here is unclear, contact us at [SUPPORT EMAIL] before you sign up.

This document describes current practice. It has not been reviewed by a
lawyer against the Zimbabwe Data Protection Act [Chapter 11:12] — that
review should happen before this is published as a binding public policy,
not after.

---

## 1. Who this covers

PFUMA has five account types: **Farmers**, **Veterinarians**, **Suppliers**,
**Retailers/Buyers**, and **Police (DVS/ZRP liaison) officers**. What we
collect and who can see it differs by role — see Section 4.

## 2. What we collect

### 2.1 Account information (all roles)
Full name, phone number, role, province/district, and a password (see
Section 6 for how it's stored). Depending on your role, also:

| Role | Additional fields |
|---|---|
| Farmer | National ID number, address, farm size, species farmed |
| Veterinarian | License number, speciality, national ID |
| Supplier / Retailer | Business registration number, supply categories or trading areas |
| Police | Badge number, station, jurisdiction province — **created only by an existing verified officer, never by self-signup** |

### 2.2 Identity documents
Farmers, Veterinarians, Suppliers and Retailers upload a photo of a
national ID and, for professional roles, a credential document (e.g. a
veterinary license or business registration certificate) during signup.
These are used **only** to verify who you are before your account is
activated — a Police officer or a verified peer Veterinarian reviews them.

### 2.3 Animal records
Farmers register animals under their own account: name, species, breed,
birth date, tag/brand ID, weight history, and an optional photo. Each
animal accumulates a **health event log** (vaccinations, dips, treatments,
next-due dates) — this is the "digital passport" the whole platform is
built around.

### 2.4 Marketplace & transaction data
Listings, bids, orders, and — when an animal is sold — a **sale clearance
record** (who cleared it, a movement permit number, the reviewing
officer). This exists specifically to give DVS and Police a legitimate
paper trail for livestock movement and reduce stock theft.

### 2.5 What we do *not* collect
We do not collect precise GPS location, biometric data, payment card
details (PFUMA does not process payments), or data from anyone under 18.
We do not use tracking cookies or third-party analytics/advertising SDKs.

## 3. Why we collect it (purpose)

Every field above exists to support a specific feature — herd registration,
health certification, marketplace clearance, or account verification. We
don't collect data "for later" or sell it. If a field isn't used by a
feature you actually use, it stays empty.

## 4. Who can see your data

Visibility is role-based and enforced in the backend on every request, not
just hidden in the app's UI:

- **You** always see your own full record.
- **Police officers** can see full account details (for verification and
  law-enforcement purposes) and the verification queue for all
  self-service roles.
- **Verified Veterinarians** can see other Veterinarians' credential
  documents (peer review during verification) and a farmer's animal
  health history when treating that animal.
- **Suppliers/Retailers/Farmers** see only the public-facing fields of
  other users (name, role, organisation, province) — never phone, email,
  address, or ID documents unless that user's role makes contact info
  public by design (e.g. a Supplier's phone is visible so farmers can
  order from them).
- **PFUMA administrators** (a small, non-public internal role) can see
  platform-wide records for support, moderation, and reporting — this
  role is never visible to other users and cannot be created through
  self-signup.

We do not sell, rent, or share your data with advertisers. We do not share
it with any third party outside the platform except as described in
Section 8.

## 5. Your animals' data belongs to your operation

Animal records are tied to the registering farmer's account. A DVS
movement clearance references the seller and the buyer for that specific
transaction, visible to the parties involved and to Police/DVS. Animal
health data is not shared with Suppliers or Retailers beyond what's
necessary for a listing (species, breed, weight, sale status).

## 6. How we protect your data

- Passwords are hashed with bcrypt — we never store or can see your
  actual password.
- All API access requires a signed session token (JWT); tokens expire
  automatically after 7 days.
- File uploads (ID documents, photos) are restricted by type and size,
  and identity documents are only readable by you, Police, or a
  reviewing Veterinarian — never publicly listed.
- Login is rate-limited to slow down password-guessing attempts.
- The production system runs over HTTPS; data in transit is encrypted.

No system is perfectly secure. If we discover a data breach affecting
your information, we will notify affected users and, where legally
required, the relevant authority, without undue delay.

## 7. How long we keep data

We keep account and animal records for as long as your account is active,
plus a reasonable period afterward to preserve DVS/Police clearance
history (movement permits and sale clearances are part of a legal record
of livestock provenance, not just app convenience — we do not delete
these on request the way we would a profile photo). If you close your
account, personal contact details are removed from public view; records
required for regulatory/law-enforcement traceability may be retained in
a form that no longer identifies you personally where that's possible.

## 8. Third parties

- **Hosting**: PFUMA's database and API run on infrastructure we
  operate. [FILL IN: hosting provider name/location once finalised.]
- We do not use third-party advertising, analytics, or data-broker
  services.
- We may disclose data to Zimbabwean law enforcement or DVS when legally
  required, or to Police accounts on-platform as part of the ordinary
  verification/clearance workflow described above.

## 9. Your rights

You can ask us to:
- **See** what we hold about you.
- **Correct** inaccurate information.
- **Delete** your account (subject to the retention note in Section 7
  for regulatory records).
- **Export** your animal records.

Contact [SUPPORT EMAIL / WHATSAPP] to make any of these requests.

## 10. Changes to this policy

If this policy changes materially, we'll notify users in-app before the
change takes effect, not just update this file silently.

## 11. Contact

Questions about this policy or your data: [SUPPORT EMAIL], [PHYSICAL/POSTAL
ADDRESS IF REQUIRED BY LAW].
