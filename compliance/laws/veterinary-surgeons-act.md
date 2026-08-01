# Veterinary Surgeons Act [Chapter 27:15]

> Not legal advice. See the [disclaimer](../README.md).

## What it is

The Veterinary Surgeons Act (originally 1973, current citation Chapter 27:15, amended 2001) regulates who may legally practise veterinary surgery and medicine in Zimbabwe. It consolidates and amends the law relating to the registration and functioning of veterinary surgeons, and for that purpose establishes the **Council of Veterinary Surgeons of Zimbabwe (CVSZ)**.

## The Council of Veterinary Surgeons of Zimbabwe (CVSZ)

Per Section 5 of the Act (as summarized in sources reviewed), the Council is composed of six members:
- **Four members** elected by registered veterinary surgeons.
- **Two members** appointed by the Minister responsible for agriculture — specifically the Chief Director in the Directorate of Veterinary Services, and a qualified legal practitioner.

The Council's mandate is to regulate the veterinary profession and improve veterinary services in Zimbabwe. To do this, the Act requires the Council to:
- **Appoint a Veterinary Surgeons Registrar.**
- **Maintain a Veterinary Surgeons Register** — the official record of who is legally entitled to practise.

The Act's implementation is supported by subsidiary regulations covering areas such as embryo transfer technicians, professional conduct, laboratory technologists, and registration qualifications — meaning veterinary-adjacent roles (not just surgeons) have their own regulatory sub-frameworks.

## Who may legally practise

To practise veterinary surgery/medicine in Zimbabwe, a person must be **registered on the Veterinary Surgeons Register** maintained by the CVSZ. Practising while unregistered is the kind of offence this Act exists to prevent, though we were not able to independently confirm the exact current penalty wording from primary text (see caveats below).

## What a "verified vet" should be able to show

Based on the structure of the Act and standard professional-registration practice in Zimbabwe, a genuine, currently-licensed veterinarian should be able to produce:

- **Proof of registration with the Council of Veterinary Surgeons of Zimbabwe** — a registration/practising number that can, in principle, be checked against the CVSZ register.
- **Their veterinary qualification** (degree/diploma from a recognized veterinary school).
- **A current practising certificate/annual renewal**, if the Council operates an annual renewal system (common in professional-council models in Zimbabwe and the region) — **confirm directly with CVSZ whether renewal is annual and what the current certificate looks like**, as we could not independently confirm the renewal cadence from primary source text.
- **National identification** matching the name on the register.

## What this means for PFUMA

- The **Veterinarian** signup flow should require a **CVSZ registration/licence number** plus supporting ID, and ideally a manual or semi-automated cross-check against the CVSZ register before the account is marked "verified vet" (see [signup-verification-requirements.md](signup-verification-requirements.md)).
- Any diagnosis, treatment recommendation, or medicine dispensing guidance surfaced by a Vet account in-app should be understood by users as coming from someone who is supposed to be CVSZ-registered — the platform should make "verified" badge status meaningful, not cosmetic.
- The AI assistant, when asked "is this a real vet," should explain that legitimate practice requires CVSZ registration and should not itself attempt to confirm registration status — that check belongs to the platform's verification process, ideally corroborated with CVSZ directly.
- Related professional roles referenced in the Act's subsidiary regulations (e.g. embryo transfer technicians, laboratory technologists) may be relevant if PFUMA later supports more specialized professional roles — flagged here for future scope, not needed for the current 5-role model.

## What we could not verify with confidence

- We were not able to access the primary text of the Act directly (source pages returned 403/connection errors to our tooling), so the Section 5 council-composition detail above is drawn from a secondary summarization of the Act and should be checked against ZimLII or Veritas Zimbabwe's primary text before being cited as an exact section reference.
- We could not confirm the exact current registration fee, renewal cadence, or penalty for unregistered practice from a primary source — **confirm directly with CVSZ** (https://cvsz.org/).

## Sources

- [Veterinary Surgeons Act — ZimLII](https://zimlii.org/akn/zw/act/1973/36/eng@2016-12-31)
- [Veterinary Surgeons Act [Chapter 27:15] — ECOLEX](https://www.ecolex.org/details/legislation/veterinary-surgeons-act-chapter-2715-lex-faoc083835/)
- [About Us — Council of Veterinary Surgeons of Zimbabwe (CVSZ)](https://cvsz.org/index.php/elementor-56/)
- [Zimbabwe — Statutory law — Animal health — SWM Programme legal hub](https://www.swm-programme.info/en/legal-hub/zimbabwe/animal-health)
- [Veterinary Surgeons Act — Parliament of Zimbabwe (acts list)](http://www.parlzim.gov.zw/acts-list/veterinary-surgeons-act-27-15)
