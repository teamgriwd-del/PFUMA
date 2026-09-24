# Event Adaptation Guide

This is the practical how-to for taking PFUMA/INGCEBO to an event other than the Zimbabwe
Agricultural Show — e.g. a POTRAZ innovation/ICT competition, a different agriculture expo, or a
general innovation-drive pitch. The product does not change per event; only the framing does.

## What never changes (the platform is the platform)

- The live deployment (see `TECHNICAL_ARCHITECTURE.md`) — same URL, same APK, same demo accounts,
  regardless of which event you're standing at.
- The core mechanism: **register an asset → attach expert/authority sign-off → gate resale behind
  verification → let a third party check the record.** This is what's actually novel and is what a
  technical judge (POTRAZ) or a domain judge (agriculture) both care about, just phrased
  differently.
- The engineering substance: real auth, real database, real role-based access control, a working
  AI assistant, a live production deployment — not a mockup. This is a strength at *every* kind of
  event and should be stated plainly regardless of audience.

## What changes per event

### 1. The headline problem statement
Pick the problem framing that matches who's judging:

- **Agriculture show / agriculture ministry audience:** lead with livestock theft, disease
  (January Disease), and the farmer's illiquid wealth problem — this is what `README.md` and
  `PITCH_GUIDE.md` already do well.
- **POTRAZ / ICT innovation competition:** lead with the **software/systems problem**, not the
  livestock problem — role-based verification systems, offline-first mobile+web parity, a
  compliance-by-design pattern, an in-house rules-based AI assistant running without a hosted LLM
  dependency (relevant for a telecoms/ICT regulator judging technical merit and local capability).
  Livestock becomes the *case study* that proves the pattern works, not the headline.
- **General innovation drive (mixed judges, business/social-impact focus):** lead with the
  economic story — unlocking livestock as loan collateral via the `Institution` role, national
  disease surveillance data DVS doesn't currently have, reduced police effort per stock-theft case.

### 2. The name and tagline
"Built for the Zimbabwe Agricultural Show" should not appear in materials for a different event.
Use: *"PFUMA/INGCEBO — a verified digital asset-record platform, built and proven on Zimbabwe's
livestock economy."* This is honest (it *was* built for livestock, first shown at the agric show)
without limiting how it's read.

### 3. The compliance/legal angle
See `COMPLIANCE_AND_LEGAL.md` — keep the real Zimbabwean livestock-law citations for an
agriculture/legal audience; for a different regulator (POTRAZ), present the *method*
("map every feature to a real governing rule, cite the source, enforce it in code") rather than
implying the same Acts apply to a different domain.

### 4. The demo script
[`agric-show-2026/PITCH_GUIDE.md`](../agric-show-2026/PITCH_GUIDE.md) is a good template for structure — 10-second hook → problem → 30-second
explainer → role-by-role branch → common objections → call to action — but its content is
agric-show-specific. When adapting it for a new event:

- Rewrite the 10-second hook for that event's problem (don't reuse "cattle in the kraal" verbatim
  for a tech competition).
- Keep the role-by-role branching structure — it works for any multi-stakeholder platform, just
  swap "farmer/vet/police" framing for whatever's relevant if the pitch shifts domain (usually it
  won't shift domain, just audience — POTRAZ judges still care that Farmer/Vet/Police/Institution
  are real, gated roles, they just also want to hear about the architecture).
- Keep "common objections" but reprioritize which ones you lead with — a technical competition
  will probe harder on "is the backend real / is this actually deployed" (answer: yes, and point at
  the live VPS URL) before it asks about smartphone penetration.

### 5. What NOT to claim, regardless of event
- Do not present IoT/collar tracking as a working feature (see `PLATFORM_OVERVIEW.md`) — it is
  dormant, hardware hasn't shipped.
- Do not claim the legal compliance mapping is lawyer-certified — it is researched and cited, say
  exactly that if asked.
- Do not imply the Zimbabwean Acts cited apply outside Zimbabwe or outside livestock if pitching a
  different domain — reframe as "the same method applied to X" (see COMPLIANCE_AND_LEGAL.md).

## Worked example: repositioning for a POTRAZ-style innovation competition

1. **Opening line:** "This is a role-based verification platform — six account types, one shared
   record, with a hard software gate in front of the one transaction that gets abused most. We
   proved it on Zimbabwe's livestock economy because the fraud problem there is large, documented,
   and measurable, but the pattern is domain-general."
2. **What judges will actually probe:** live deployment (show the VPS-hosted HTTPS URL and
   installable PWA/APK), real auth model, database schema, and the AI assistant's design (a
   rules/NLP engine trained on a cited knowledge base — mention this doesn't depend on an external
   hosted LLM, which matters for data-sovereignty-minded judges).
3. **Social/economic impact framing:** the `Institution` role turning verified livestock records
   into loan collateral is a strong "financial inclusion" story for a broader innovation-drive
   audience, independent of agriculture specifically.
4. **Close:** offer the same live demo-account flow as the agric-show pitch ("I can register you a
   demo account right now") — this works at any event, it's a strength of having a real deployment.
