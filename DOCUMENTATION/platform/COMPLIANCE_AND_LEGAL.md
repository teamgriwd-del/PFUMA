# Compliance and Legal

## Current mapping (Zimbabwean livestock law)

Every headline feature is built to mirror a specific piece of Zimbabwean law, researched and cited
— not a lawyer-certified audit, but real citations (ZimLII, FAOLEX, CVSZ, Veritas, Consumer
Council), documented in full in the [`compliance-research/`](../compliance-research/) folder
(`compliance-research/laws/`, `compliance-research/species/`, `compliance-research/signup-verification-requirements.md`).

| What PFUMA/INGCEBO enforces | The law it operationalizes |
|---|---|
| Listings start `pending_clearance`; an officer verifies ownership and brand papers and issues a movement-permit number | Stock Theft Prevention Act [9:18] |
| Vet signup requires a CVSZ registration number, peer-reviewed by an already-verified vet | Veterinary Surgeons Act [27:15] |
| Animal records capture brand mark, tag ID and dip-tank; "no brand on record" is flagged before a sale | Brands Act + Livestock Identification Regulations |
| Jinda pushes toward DVS or police reporting when a notifiable-disease pattern appears | Animal Health Act [19:01] |
| Cross-district sales prompt for a DVS veterinary movement permit alongside police clearance | The "two-gate" movement process |
| Buyer/retailer signup requires acknowledging disclosure, fixed pricing and the statutory right of return | Consumer Protection Act [14:44] |

This mapping is genuinely load-bearing for the Zimbabwe Agricultural Show pitch and for any future
Zimbabwean agriculture-sector audience (DVS, ZRP, Ministry of Lands/Agriculture). It should stay
exactly as-is for that audience.

## Why this matters beyond agriculture (the generalizable pattern)

The underlying method — **"don't just build a feature, map it to the specific rule/regulator that
already governs this behavior, and cite the source"** — is itself a differentiator worth carrying
into a non-agricultural pitch (e.g. POTRAZ), even though the specific Acts above won't apply.

When repositioning for a different regulator or domain:

1. Identify that domain's equivalent of "the theft/fraud gate" — the one high-risk transaction that
   currently has no enforced verification step (e.g. for a telecom/ICT competition: SIM
   registration fraud, device IMEI provenance, counterfeit-device resale — anything POTRAZ already
   regulates).
2. Find the actual instrument (Act, SI, regulator directive) that already requires that check on
   paper.
3. Show the same thing PFUMA/INGCEBO shows here: the check is enforced *in the software*, not left
   to a paper policy that can be skipped.
4. Cite the source the way `compliance-research/` does — reviewers doing due diligence for an innovation
   competition specifically reward "we checked this against the real law" over "this seems useful."

Don't invent a fake mapping for a new domain just to look thorough — if this platform is pitched
somewhere its actual legal mapping doesn't apply (which is the normal case), be explicit that the
*compliance-by-design method* is what's being demonstrated, using the Zimbabwe livestock case as
the proof-of-concept, rather than implying the same Acts apply.

## Data protection

[`legal-and-privacy/PRIVACY_POLICY.md`](../legal-and-privacy/PRIVACY_POLICY.md) (public-facing) and [`legal-and-privacy/DATA_PROTECTION_INTERNAL.md`](../legal-and-privacy/DATA_PROTECTION_INTERNAL.md) (internal) cover
what's collected, why, and how uploaded ID/credential documents are stored and access-controlled.
These are domain-agnostic (personal data handling, not livestock-specific) and can be reused
largely as-is for a different event's due-diligence questions.
