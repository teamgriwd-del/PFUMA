# Signup & Verification Requirements — By Role

> Not legal advice. See the [disclaimer](../README.md). This document combines specific legal requirements documented in this folder's law docs with **general, standard Zimbabwean business/regulatory practice** where no specific statute was found. Every item below is marked either **[Legal]** (traceable to a law doc in this folder) or **[Standard practice]** (a reasonable, common-practice inference, not a confirmed statutory mandate) — confirm the latter category with a lawyer/regulator before treating it as a hard legal requirement.

PFUMA has 5 roles: Farmer, Veterinarian, Supplier, Retailer, Police. Each needs different documentation at signup because each carries different legal exposure and trust requirements on the platform.

## 1. Farmer

| Item | Type | Purpose |
|---|---|---|
| National ID (or valid passport) | [Standard practice] | Basic identity verification, matches the name that should appear on any brand certificate/land document |
| Proof of land / farm access — title deed, 99-year lease, offer letter, A1/A2 permit, or communal land allocation letter from village head/district council | [Legal-adjacent — Standard practice] | Zimbabwe's land tenure system recognizes multiple valid document types (freehold title, leasehold, permits, communal allocation); the platform should accept any of these rather than demanding freehold title specifically, since most communal farmers legitimately hold only a permit or allocation letter, not a title deed |
| Livestock brand/tag registration details, where applicable (brand certificate number, dip tank, district) | [Legal] | Required in practice for a farmer to prove ownership and get police clearance for a sale — see [livestock-identification-act.md](laws/livestock-identification-act.md) |
| Contact details (phone, physical location/ward) | [Standard practice] | Needed for DVS/police coordination context and buyer trust |

**Note:** Not requiring land proof at all would let anyone claim to be a farmer; requiring only formal title deeds would exclude the majority of communal farmers who hold permits/allocation letters instead. The verification flow should accept the full range of legitimate Zimbabwean land-tenure documents.

## 2. Veterinarian

| Item | Type | Purpose |
|---|---|---|
| National ID | [Standard practice] | Identity match against the CVSZ register |
| **Council of Veterinary Surgeons of Zimbabwe (CVSZ) registration/practising number** | [Legal] | Only CVSZ-registered persons may legally practise veterinary surgery/medicine in Zimbabwe — see [veterinary-surgeons-act.md](laws/veterinary-surgeons-act.md) |
| Veterinary qualification (degree/diploma) | [Standard practice] | Supporting evidence alongside the CVSZ number |
| Current practising certificate / proof of active (non-lapsed) registration, if CVSZ issues one | [Standard practice — unconfirmed cadence] | We could not confirm from primary sources whether CVSZ registration requires annual renewal; ask the applicant to supply whatever CVSZ currently issues as proof of active status, and ideally cross-check against the CVSZ register directly |

**Verification recommendation:** Treat the CVSZ number as the load-bearing credential. Where possible, PFUMA should cross-check submitted numbers against the CVSZ register (https://cvsz.org/) manually or via any API/lookup CVSZ may offer, rather than trusting the number at face value, since a "verified vet" badge implies real legal standing to other users.

## 3. Supplier

(A Supplier here is understood as a business supplying livestock, feed, veterinary medicines/products, or related agri-inputs into the marketplace — distinct from a Retailer who sells finished livestock/produce to end consumers.)

| Item | Type | Purpose |
|---|---|---|
| National ID of the responsible/registering individual | [Standard practice] | Identity of the accountable person behind the business account |
| Business registration (BP number from ZIMRA, and/or company/PBC registration under the Companies and Other Business Entities Act [Chapter 24:31]) | [Standard practice] | ZIMRA Business Partner (BP) number registration is required within 30 days of a business starting to trade, per sources reviewed; this is the standard way to confirm a Zimbabwean business is formally registered |
| **Medicines Control Authority of Zimbabwe (MCAZ) licence — specifically a Veterinary Medicines General Dealers Permit (VMGD)** — required only if the Supplier deals in veterinary medicines/pharmaceutical animal-health products | [Legal, conditional] | MCAZ regulates veterinary medicines in Zimbabwe through a registration/dossier process and general dealer permits; a Supplier of ordinary feed/equipment would **not** need this, but a Supplier of medicines/vaccines/acaricides would |
| Any relevant trading licence for the specific goods supplied (e.g. an acaricide/pesticide dealer licence, if distinct from MCAZ scope) | [Standard practice, conditional] | Not independently confirmed in detail during research — flag for the Supplier to declare what they supply, and route to the correct licence check based on that declaration |

**Verification recommendation:** Make the signup flow branch on "what do you supply?" — a feed/equipment supplier needs only ID + BP number; a veterinary-medicines supplier should additionally be asked for their MCAZ VMGD licence number before being allowed to list medicine/pharmaceutical products.

## 4. Retailer

| Item | Type | Purpose |
|---|---|---|
| National ID of the responsible individual | [Standard practice] | Identity of the accountable person |
| Business registration (BP number, and/or Companies and Other Business Entities Act registration, or Private Business Corporation for small operators) | [Standard practice] | Same registration logic as Suppliers; a Private Business Corporation (PBC) is specifically designed as a low-cost registration option for small Zimbabwean businesses, relevant to many agri-retailers |
| Acknowledgement/acceptance of Consumer Protection Act obligations (disclosure, pricing, no blanket "no refund" policies) | [Legal] | A Retailer account should explicitly confirm understanding of these obligations before listing — see [consumer-protection-retailers.md](laws/consumer-protection-retailers.md) |

## 5. Police

This is explicitly **platform-internal verification**, not self-service — the Police role exists to represent the real-world clearance function (see [stock-theft-act.md](laws/stock-theft-act.md), [livestock-movement-permits.md](laws/livestock-movement-permits.md)), and a fraudulent "Police" account would be uniquely damaging (fake clearances enabling stock theft).

| Item | Type | Purpose |
|---|---|---|
| National ID | [Standard practice] | Baseline identity |
| **Service/force number** | [Standard practice] | Zimbabwe Republic Police (ZRP) service members carry individual service numbers; this is the natural equivalent of a professional registration number for this role |
| **Badge number** | [Standard practice] | Additional identifier, cross-checkable in person/administratively |
| **Station attachment** (which police station/district the officer is attached to) | [Standard practice] | Needed to route clearance requests appropriately and to allow offline verification through the chain of command at that station |
| **Manual/out-of-band vetting** — e.g. a verification call or letter to the named station, rather than pure self-service signup | [Standard practice — strongly recommended] | Given documented real-world corruption risk around cattle clearance fees and forged paperwork (see [stock-theft-act.md](laws/stock-theft-act.md) sources), PFUMA should not grant the Police role purely on submitted documents — this account type should be seeded or manually approved by platform admins after independent confirmation, not self-service like the other four roles |

## Cross-cutting recommendation

For all roles, PFUMA should:
- Store the exact document/number submitted (not just a "verified: yes/no" flag) so a dispute or later audit can trace back what was checked.
- Periodically re-verify credentials that can lapse (vet registration renewal, business registration renewal) rather than treating verification as a one-time gate.
- Make clear to users which roles are self-service-verified (Farmer, Vet, Supplier, Retailer — verified against submitted documents) versus manually vetted (Police), so trust expectations are accurate.

## What we could not verify with confidence

- CVSZ practising-certificate renewal cadence (annual or otherwise) — confirm with CVSZ.
- Whether a specific additional trading licence (beyond MCAZ, for medicine suppliers) applies to non-medicine agri-input suppliers (e.g. general acaricides/pesticides) — confirm with the relevant regulator (likely still MCAZ or the Ministry of Agriculture, but not independently confirmed here).
- Exact current ZRP internal process for how a real police clearance/verification request would be authenticated back to a specific officer — this document recommends manual vetting as a principle; the operational mechanics should be worked out directly with ZRP or a pilot police partner, not assumed from public sources.

## Sources

- [Zimbabwe Company Registration — AfriSetup](https://afrisetup.com/zimbabwe/services/zimbabwe-company-registration/)
- [Navigating Company Registration in Zimbabwe — Lucent Consultancy](https://lucent.co.zw/regulations/navigating-company-registration-in-zimbabwe-a-concise-guide/)
- [Company registration in Zimbabwe: All you need to know — Numeri](https://numeri.co.zw/company-registration-in-zimbabwe-all-you-need-to-know/)
- [Understanding types of business entities registrable in Zimbabwe — Business Times](https://businesstimes.co.zw/understanding-types-of-business-entities-registrable-in-zimbabwe/)
- [Medicines Control Authority of Zimbabwe (MCAZ)](https://www.mcaz.co.zw/)
- [How to Register — MCAZ](https://www.mcaz.co.zw/how-to-register/)
- [Licensing — MCAZ](https://www.mcaz.co.zw/licensing-and-enforcement/licensing/)
- [About Us — Council of Veterinary Surgeons of Zimbabwe (CVSZ)](https://cvsz.org/index.php/elementor-56/)
- [All you need to know about the land title deeds programme — Herald Online](https://www.heraldonline.co.zw/all-you-need-to-know-about-the-land-title-deeds-programme/)
- [Understanding Zimbabwe's Land Title Deeds: Benefits and Eligibility](https://news.zanupfpatriots.com/index.php/2025/02/08/understanding-zimbabwes-land-title-deeds-benefits-and-eligibility/)
- [Zimbabwe Republic Police — Anti Stock Theft](https://zrp.gov.zw/?p=7403)
- [Cops face arrest for demanding cattle clearance fees — Bulawayo24 News](https://bulawayo24.com/news/national/246551)
- [Zimbabwe police officers accused of forging paperwork to help cattle thieves thrive — Viewfinder](https://viewfinder.org.za/zimbabwe-police-officers-accused-of-forging-paperwork-to-help-cattle-thieves-thrive/)
