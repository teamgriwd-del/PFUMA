# PFUMA — National Impact & Legal Compliance
# Team GRIWD | Zimbabwe Agricultural Show 2026
# Prepared: 2026-07-17

---

## EXECUTIVE SUMMARY

PFUMA is not just a farm-management app — it is a digital layer over the real, legally-defined process Zimbabwe already uses to keep livestock trade honest and disease under control: ownership proof, veterinary inspection, and police clearance before a sale. PFUMA digitizes that process end-to-end across five stakeholders — **Farmer, Veterinarian, Supplier, Retailer, Police** — instead of leaving it to paper records, word-of-mouth, and informal trust.

Every legal claim in this document is grounded in the research collected in [`compliance/`](compliance/), which cites primary and secondary Zimbabwean legal sources (ZimLII, law.co.zw, FAOLEX, CVSZ, ZRP statements, Consumer Council of Zimbabwe, and others). Where a specific detail could not be independently confirmed from a primary source, `compliance/` says so explicitly rather than presenting it as settled fact — see Section 3.

---

## SECTION 1 — BENEFIT TO THE COUNTRY AND COMMUNITY

### 1.1 Disease control at national scale
January Disease (Theileriosis) alone has killed over **500,000 cattle in Zimbabwe since 2016**. PFUMA's Diagnostics engine and AI assistant (Jinda) give farmers an early-warning tool covering Foot and Mouth Disease, Anthrax, January Disease, Lumpy Skin Disease, African Swine Fever, Peste des Petits Ruminants, and more — across cattle, pigs, sheep, and goats. Province/district tagging on vet cases builds exactly the kind of regional surveillance data the Department of Veterinary Services (DVS) needs for contact tracing during an outbreak.

### 1.2 Cutting into stock theft
Cattle rustling is a serious, organized problem in Zimbabwe — recent police action led to **over 3,400 arrests** in a single crackdown. PFUMA makes police clearance a *structural gate*, not an optional courtesy: no livestock listing goes live on the Marketplace until an officer verifies ownership/brand papers and issues a movement-permit reference. This protects honest sellers and buyers alike from unknowingly ending up on the wrong side of a stock theft charge — under Zimbabwean law, even an unknowing buyer of stolen stock risks being treated as a receiver of stolen goods.

### 1.3 Financial inclusion for communal farmers
The signup flow accepts the **full range of legitimate Zimbabwean land-tenure documents** — title deed, 99-year lease, offer letter, A1/A2 permit, or a communal land allocation letter — rather than only formal title deeds, which would exclude the majority of communal farmers. Livestock is often a rural family's largest store of wealth; formalizing that ownership through verified profiles, brand/tag records, and a clean sale history makes it easier to access credit, trade fairly, and prove ownership when it matters most.

### 1.4 Access to veterinary care and formal markets
The Vet Messenger and DVS hotline directory connect remote farmers to CVSZ-registered veterinarians and regional government offices they might otherwise struggle to reach. The Marketplace gives farmers a transparent, documented sales channel instead of relying entirely on informal buyers who can lowball an isolated seller with no visibility into fair market price.

### 1.5 Economic ripple effects
Livestock is a core rural livelihood in Zimbabwe. Fewer disease deaths, less theft, better price discovery, and easier access to vets and suppliers all compound into real household income growth — a measurable community outcome, not just a technology showcase.

---

## SECTION 2 — HOW PFUMA COMPLIES WITH ZIMBABWEAN LAW

| PFUMA Feature | Law It Operationalizes | Reference |
|---|---|---|
| Police sale-clearance workflow — listings start `pending_clearance`, only go live once an officer verifies ownership/brand papers and issues a movement-permit number | **Stock Theft Prevention Act [Chapter 9:18]** — mirrors the real-world ownership → vet inspection → police clearance sequence required before a legal cattle sale | [stock-theft-act.md](compliance/laws/stock-theft-act.md) |
| Veterinarian signup requires a CVSZ registration/licence number; Vet applicants are peer-reviewed by an existing verified vet | **Veterinary Surgeons Act [Chapter 27:15]** — only persons registered with the Council of Veterinary Surgeons of Zimbabwe (CVSZ) may legally practise veterinary medicine | [veterinary-surgeons-act.md](compliance/laws/veterinary-surgeons-act.md) |
| Farmer animal records capture brand mark, tag ID, and dip-tank details; "no brand on record" is flagged as a risk signal before a sale | **Livestock Identification framework** (Brands Act + Animal Health (Livestock Identification) Regulations) — unbranded cattle are effectively unclaimable if stolen, and police cannot lawfully clear the sale of an unbranded animal | [livestock-identification-act.md](compliance/laws/livestock-identification-act.md) |
| AI assistant nudges Farmers/Vets toward DVS/police reporting when a notifiable-disease pattern is flagged, rather than "wait and see" | **Animal Health Act [Chapter 19:01]** — the owner of an animal suspected of a notifiable disease has a legal duty to report it to a DVS officer or police officer | [animal-health-act.md](compliance/laws/animal-health-act.md) |
| Cross-district sale prompts for DVS Veterinary Movement Permit alongside police clearance | Same Act, operationalized as the **"two-gate" process** (veterinary inspection + police clearance) required to move cattle any meaningful distance | [livestock-movement-permits.md](compliance/laws/livestock-movement-permits.md) |
| Retailer signup requires acknowledging Consumer Protection Act obligations; no blanket "no refund" listings permitted | **Consumer Protection Act [Chapter 14:44]** — mandatory disclosure in plain language, a visible fixed price, and a statutory right to return defective goods within 6 months | [consumer-protection-retailers.md](compliance/laws/consumer-protection-retailers.md) |
| Role-based signup document requirements (ID + role-specific credential for every role); Police accounts are manually provisioned, not self-service | Cross-cutting recommendation drawn from all six laws above — see full per-role breakdown | [signup-verification-requirements.md](compliance/signup-verification-requirements.md) |
| Password hashing (bcrypt), JWT-authenticated sessions, per-owner data scoping, documents stored outside the web root and served only to the owner or an authorized reviewer | General data-protection good practice underpinning every obligation above — none of the legal safeguards mean anything if the underlying data isn't secured | *(platform architecture, not a specific statute)* |

---

## SECTION 3 — METHODOLOGY & HONEST LIMITATIONS

This document and the underlying `compliance/` research were compiled by researching primary and secondary Zimbabwean legal sources (ZimLII, law.co.zw, FAOLEX, ECOLEX, CVSZ, Veritas Zimbabwe, Consumer Council of Zimbabwe) alongside international veterinary references (WOAH, FAO). It is **researched and citable, not a lawyer-certified compliance audit**.

Specifically flagged as unconfirmed in the underlying research, and worth stating plainly rather than glossing over:
- Exact current section numbers for several Acts (primary-text PDFs were not machine-readable to our research tooling in every case; secondary legal-commentary sources were used and clearly marked as such).
- Current fine "levels" under the Standard Scale of Fines Act, which are periodically adjusted.
- Whether nationwide RFID cattle tagging is already a hard legal mandate everywhere, or still a phased rollout — this varies by district and should be confirmed with DVS.
- CVSZ's exact practising-certificate renewal cadence.

**Recommendation before any formal submission or claim of "legal compliance" to a regulator or partner:** have a Zimbabwean lawyer or the relevant regulator (DVS, CVSZ, ZRP, Consumer Council of Zimbabwe) review the specific claims in Section 2 against current primary legislation. This document is designed to demonstrate that PFUMA was **built with the real legal framework in mind from day one** — which is itself a meaningful differentiator for a Zimbabwe Agricultural Show submission — while being honest that "researched" and "certified" are not the same thing.

---

*PFUMA — Team GRIWD | teamgriwd@gmail.com*
*Zimbabwe Agricultural Show 2026*
