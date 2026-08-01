# PFUMA Compliance & Reference Library

This folder is the source-of-truth reference material used to:

1. Show in-app guidance to users (Farmers, Veterinarians, Suppliers, Retailers, Police) about what is legally/practically required to keep, move, and sell livestock in Zimbabwe.
2. Be summarized into the AI assistant's knowledge base so it can answer questions like "what do I need to sell my cattle?" or "is this rash a notifiable disease?" with grounded, sourced answers.
3. Define what each user role must provide at signup so the platform can verify identity and credentials before granting role-specific access.

## Important disclaimer

**This is informational content, not legal or veterinary advice.** It is written to guide product UX copy and the AI assistant's knowledge base, based on publicly available legislation summaries, government/NGO sources, and international animal-health references (FAO, WOAH). Zimbabwean statutes are periodically amended by Statutory Instrument, and this content may not reflect the very latest amendment, fee, or form. Where an exact section number or current form/fee could not be confirmed from an accessible source, that is flagged explicitly in the relevant document rather than invented.

Before relying on any of this for a real transaction, dispute, prosecution, or medical/veterinary emergency, users should:

- Confirm current requirements with the **Department of Veterinary Services (DVS)**, Ministry of Lands, Agriculture, Fisheries, Water and Rural Development.
- Confirm current requirements with the **Zimbabwe Republic Police (ZRP)**, particularly the Anti-Stock Theft Unit, for clearance/movement matters.
- Consult a **qualified Zimbabwean lawyer** for anything with legal consequences (ownership disputes, criminal exposure, contracts).
- Consult a **registered veterinary surgeon** (Council of Veterinary Surgeons of Zimbabwe) for any actual animal health diagnosis or treatment decision.

## Contents

### Laws
- [`laws/animal-health-act.md`](laws/animal-health-act.md) — Animal Health Act [Chapter 19:01]: disease control, reporting duties, quarantine powers.
- [`laws/livestock-identification-act.md`](laws/livestock-identification-act.md) — Branding, tagging, and identification requirements for cattle, sheep, and goats.
- [`laws/stock-theft-act.md`](laws/stock-theft-act.md) — Stock Theft Prevention Act [Chapter 9:18]: what it criminalizes, ownership proof, why police clearance matters.
- [`laws/livestock-movement-permits.md`](laws/livestock-movement-permits.md) — Moving/transporting/trading livestock across districts and provinces: DVS movement permits, dip-tank and quarantine considerations.
- [`laws/veterinary-surgeons-act.md`](laws/veterinary-surgeons-act.md) — Veterinary Surgeons Act [Chapter 27:15]: who may legally practice as a vet, Council of Veterinary Surgeons of Zimbabwe (CVSZ) registration.
- [`laws/consumer-protection-retailers.md`](laws/consumer-protection-retailers.md) — Consumer Protection Act [Chapter 14:44] as it applies to retailers of livestock and agri-produce.

### Species
- [`species/cattle.md`](species/cattle.md)
- [`species/pigs.md`](species/pigs.md)
- [`species/sheep.md`](species/sheep.md)
- [`species/goats.md`](species/goats.md)

Each species doc covers: legal requirements to own/keep/sell, a common-diseases table, basic diagnosis guidance (vet call vs. routine care), and typical vaccination/dipping schedule pointers for Zimbabwean conditions.

### Signup & verification
- [`signup-verification-requirements.md`](signup-verification-requirements.md) — What documents/credentials PFUMA should require and verify for each of the 5 roles at signup: Farmer, Veterinarian, Supplier, Retailer, Police.

## How to use this in-app

- Show relevant species + law excerpts contextually (e.g., a Farmer listing cattle for sale sees the cattle doc's "legal requirements" section and a link to the movement-permits doc).
- Feed these files (or a periodically-regenerated summary of them) into the AI assistant's retrieval/knowledge base so answers cite the same sources listed here.
- Treat every "Sources" section at the bottom of each doc as the citation list to surface to users who tap "where does this come from?".

## Maintenance note

Zimbabwean livestock/agriculture regulation is actively evolving (e.g., the national RFID cattle identification rollout, digital movement permits, land title deed programme). Re-verify this folder's content against DVS and ZRP guidance at least annually, or whenever the AI assistant surfaces a user-reported discrepancy.
