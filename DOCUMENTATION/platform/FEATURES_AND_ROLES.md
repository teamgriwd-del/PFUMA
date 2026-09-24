# Features and Roles

This describes what the platform actually does today, grouped by role and then by cross-cutting
feature. Confirmed against `backend/schema.sql`, `backend/app.py` (143 routes), `src/components/`,
and `app/screens/` — not just the older prose docs.

## Roles

The `users.role` enum (`backend/schema.sql`) is:

**Farmer · Veterinarian · Supplier · Buyer · Police · Admin · Institution**

(The root README and `agric-show-2026/PITCH_GUIDE.md` call the buyer-side role "Retailer" — that name is stale; the schema,
UI, and API all use `Buyer`.)

### Farmer
The primary user. Registers animals (breed, weight, tag ID, brand mark, dip-tank), tracks
vaccination/weaning/gestation on countdowns, lists animals or produce on the marketplace, messages
vets/suppliers, joins a cooperative, uses the feed analyzer and trading journal, and can report a
disease outbreak.

### Veterinarian
Signup requires a CVSZ registration number and peer-review by an already-verified vet. Gets a
caseload/reporting dashboard scoped to their province/district (`vet/farm-registry`,
`vet/reporting-health`), a certificate-issuance queue (`vet/cert-queue`) for animal health
certification and valuation certificates, and can claim/complete vet-consultation requests
(`vet-requests/*`) including cooperative-level requests. Can verify disease outbreak reports.

### Supplier
Lists feed, medicine, vaccine and equipment stock; sees aggregate demand and fulfillment-rate
analytics (`supplier/demand`, `supplier/fulfillment-rate`); fulfills/dispatches marketplace orders.

### Buyer
Sees only marketplace listings that have cleared police verification (and, for livestock, usually
a vet health record). Bids, orders, and tracks purchases (`purchases/mine`, `bids/mine`).

### Police
A dedicated law-enforcement role modelling real Stock Theft Prevention Act clearance. Reviews the
signup-verification queue for Farmer/Supplier/Buyer applicants, reviews the sale-clearance queue
(`clearances/*`) for every livestock listing tied to a registered animal, and issues/rejects
movement permits (`movement-permits/*`) for cross-district sales. Police accounts are **not
self-service** — they're provisioned out-of-band by an existing verified officer, the same way the
real Zimbabwe Republic Police onboards units.

### Institution (bank/insurer)
Looks up an animal's valuation certificate by code (`verify/certificate/<code>`,
`institution/certificates/<code>`), can flag a certificate in their own ledger for
loan-collateral/insurance purposes (`institution/certificates/<code>/flag`), and keeps a
per-institution ledger of every certificate they've looked up (`institution/certificates/mine`).
This is the role that operationalizes "livestock wealth can now be borrowed against" — it isn't
just a talking point in the pitch, there's a real endpoint and ledger behind it.

### Admin (hidden role)
Not discoverable by non-admins (protected routes 404 instead of 403 for non-admins, so the role's
existence isn't even leakable via status codes). Suspends/reactivates users, takes down listings,
resolves ID checks and next-of-kin verification, resets locked-out passwords, sets an officer's
`officer_tier` (field vs. national), reviews outbreak reports and cooperatives, manages
market-rate data, and reviews bulk-import logs (`admin/import`, `admin/import-logs`).

## Cross-cutting features

### Herd Registry / Animal Passport
Every registered animal has a full record: identity, breed, brand mark, tag ID, dip-tank,
ownership, photos, health timeline (`animals/<id>/timeline`), and an estimated market value
computed from weight, species, and health history — fed by the automated market-rate scanner
(`market-rates`, `admin/market-rates/scan`), not a static number.

### Marketplace + Sale Clearance
Listings (`listings`) span livestock, feed, produce, medicine and equipment. A livestock listing
tied to a registered animal starts `pending_clearance` and is invisible to buyers until police
verify ownership/brand papers (`clearances/<id>`) and, for cross-district sales, a DVS movement
permit is issued (`movement-permits/<id>/issue`). Buying flow includes bidding
(`listings/<id>/bid`, `listings/<id>/bids/<id>/accept`), ordering, dispatch and delivery
(`orders/*`), and a price-trend endpoint (`listings/price-trend`).

### Health & Compliance Lifecycle
Automated countdowns for vaccination/weaning/gestation, colour-coded overdue/due-today/upcoming
status, a compliance case system (`compliance/cases`, with a defer action for vets), and
medication recommendations that a vet or farmer can mark administered.

### Outbreak Reporting & Verification
A farmer or vet reports a suspected outbreak (`outbreaks`, POST); a vet or admin verifies it
(`outbreaks/<id>/verify`), which fans out to farmer broadcast notifications
(`broadcasts`/`notifications`) — this is the "regional disease surveillance" feature, now backed
by a real verify-then-notify pipeline rather than just a vet dashboard. Officer visibility is
scoped by region for field-tier officers, national for national-tier (`officer_tier`).

### Farmer Cooperatives
Farmers can create, join, or leave a cooperative (`cooperatives/*`), share a dip-tank schedule
(`cooperatives/<id>/dip-schedule`), and raise group vet requests (`cooperatives/<id>/vet-requests`)
rather than every member individually messaging a vet.

### Feed Analyzer + Trading Journal
Feed requirement lookup, formulation, planning and price search (`feed/*`), including a
**dry-season feed budget** tool that accounts for animals already sold (a real bug — counting
already-sold animals in the budget — was found and fixed here). A separate Trading Journal
(`trading-journal/mine`) tracks a farmer's own sale/purchase history independent of the live
marketplace.

### Valuation Certificates + Institution Ledger
A vet issues a valuation certificate for an animal (`animals/<id>/valuation-certificate`); anyone
with the code can verify it publicly (`verify/certificate/<code>`); an Institution can look it up
and flag it in their own ledger for collateral/insurance purposes. This is the loan-collateral
pathway referenced in the platform overview.

### Vet Messenger / In-app Communication
Direct chat (`conversations/*`) connecting farmers, vets, suppliers and buyers, filterable by role,
so a farmer reaches the right person directly instead of a phone call and a guess.

### Jinda — AI Farm Assistant
Role-aware natural-language assistant (custom NLP, not a hosted LLM integration) that answers
livestock-health and legal-compliance questions ("what do I legally need before I can sell this
animal?"), does smart in-app navigation ("take me to the marketplace"), and calculates herd
analytics via chat. Trained on a condensed version of the `compliance-research/` knowledge base plus
disease/diagnostic protocols (`backend/protocols.py`).

### Real Auth & Access Control
Password auth (bcrypt) + JWT sessions; no endpoint is reachable unauthenticated except
health-check, login, register, and public feed reference data. Per-owner data scoping — a farmer
only ever sees their own animals/records; vets and police get oversight visibility scoped to their
region/tier. Uploaded documents are stored outside the web root and served only to the owner or an
authorized reviewer.
