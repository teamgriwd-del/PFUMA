# Platform Overview

## What it is

PFUMA/INGCEBO ("Pfuma" is Shona for wealth; "Ingcebo" is the Ndebele equivalent) is a multi-role
web + mobile platform that turns livestock ownership, health history, and sale history into a
**verifiable digital record** instead of paper, memory, or a stranger's word. It connects the
people who actually touch that record in real life — the farmer, the vet, the supplier, the buyer,
a bank/insurer, and the police — into one shared system, and puts a hard structural gate (police
clearance) in front of the one transaction that gets abused most: an undocumented sale of stolen
or disputed livestock.

It was built for and first shown at the Zimbabwe Agricultural Show 2026, but the platform is not
about agricultural shows — it is a **verified-asset-record-and-marketplace pattern** applied to
livestock. That pattern (register an asset → attach expert/authority sign-off → gate resale behind
verification → let a third party check the record) is the reusable part, and it is what should
carry over when this project is pitched somewhere other than an agric show. See
[EVENT_ADAPTATION_GUIDE.md](EVENT_ADAPTATION_GUIDE.md) for how to reframe it for a different
audience (e.g. a POTRAZ innovation/tech competition, where the judges care about the software
architecture and social impact more than they care about cattle specifically).

## The problem it addresses

- Livestock is frequently a rural family's largest store of wealth, and the least protected asset
  they own.
- Ownership, health history, vaccinations and past sales are tracked on paper, by memory, or not
  at all — a record that can be lost, forged, or never have existed.
- Disease (Theileriosis/"January Disease" in the Zimbabwean context) spreads faster than paper
  record-keeping can respond to it.
- Stock theft and ownership disputes have no fast, credible evidence trail.
- Buyers have no way to verify an animal's health/ownership history before paying.
- Without verifiable ownership and health records, livestock wealth is hard to use as loan
  collateral — this is why a bank/insurer role (`Institution`) exists in the platform, not just
  farmer/vet/police.

The generalizable version of this problem statement — useful when pitching outside agriculture —
is: **"proof of a valuable asset's history doesn't currently exist in a form a third party can
trust, and the professionals who create that history (vets, officers, institutions) have no shared
system to record it in."**

## Current build status (as of 2026-09-17)

- **Live in production** on GRIWD's own VPS — real HTTPS web app, installable PWA, and a
  permanently-hosted Android APK (not an expiring Expo build link).
- Full role-based auth (bcrypt + JWT), per-owner data scoping, document upload/verification at
  signup, admin moderation tooling.
- Native Expo/React Native mobile app at close to full feature parity with the web app.
- A researched (not lawyer-certified) legal compliance mapping for every headline feature, cited
  from ZimLII, FAOLEX, CVSZ, Veritas, and the Consumer Council — see
  [COMPLIANCE_AND_LEGAL.md](COMPLIANCE_AND_LEGAL.md).

## Scope: software only

PFUMA/INGCEBO is a software platform (web app, mobile app, backend). It has no hardware
component. Do not describe, pitch or budget any hardware or IoT for it — see the root
`CLAUDE.md`.

## What's new since the last full documentation pass

The root README and `agric-show-2026/PITCH_GUIDE.md` still describe an earlier five-role version of the product. The
platform has grown past that. Current roles and features (detailed in
[FEATURES_AND_ROLES.md](FEATURES_AND_ROLES.md)) include:

- An **`Institution`** role (bank/insurer) that looks up and flags livestock valuation
  certificates for loan-collateral purposes — this is the "livestock wealth as usable collateral"
  piece of the pitch made real, not just claimed.
- **Farmer cooperatives** (create/join/leave, shared dip-tank scheduling, group vet requests).
- A **national outbreak-reporting and verification workflow**, with a field-vs-national officer
  tier distinction (`officer_tier`), separate from the original per-case vet consult flow.
- **Feed Analyzer** with a dry-season feed budget tool, and a standalone **Trading Journal**.
- Automated **livestock market-rate scanning** feeding into herd valuation, rather than a static
  number.
- The **`Buyer`** role name in the schema/UI (root docs still say "Retailer" — that's the stale
  term).

## Where things live in the repo

The project root is not yet reorganized around "platform vs. event," so this documentation folder
is intentionally the first artifact that treats it that way. See
[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) for the actual file layout.
