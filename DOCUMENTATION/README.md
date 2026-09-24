# PFUMA/INGCEBO — Documentation

Everything in the project that isn't application code lives here, grouped by topic. The project
root now holds only the code (`src/`, `app/`, `app-webview/`, `backend/`, `hardware/`, `public/`),
its build/config files, `run_project.bat`, and the main `README.md`.

## Folder map

| Folder | What's in it |
|---|---|
| [`platform/`](platform/) | Event-neutral platform docs — the reusable core for any expo/competition (read order below). |
| [`agric-show-2026/`](agric-show-2026/) | Zimbabwe Agricultural Show 2026 material: `PITCH_GUIDE.md`, `IMPACT_AND_COMPLIANCE.md`, the ZAS2026 deck, analogy sheet, technical impact dossier. |
| [`business-and-funding/`](business-and-funding/) | `BUDGET_PROPOSAL.md`, procurement lists (xlsx/docx), commercialization and direct-cash requirements, TelOne budget request. |
| [`hardware/`](hardware/) | `IOT_HARDWARE_GUIDE.md` (build/flash/pair walkthrough), component list, breadboard assembly doc. Design files and firmware stay in the root `hardware/` folder. |
| [`posters-and-diagrams/`](posters-and-diagrams/) | Technical + public posters and CN-01/BS-01 wiring diagrams: HTML sources, PNG previews, final PDFs, and the Python scripts that generate them. |
| [`compliance-research/`](compliance-research/) | Cited Zimbabwean livestock-law research (`laws/`, `species/`, signup verification requirements). Not legal advice. |
| [`legal-and-privacy/`](legal-and-privacy/) | `PRIVACY_POLICY.md` (public) and `DATA_PROTECTION_INTERNAL.md` (internal). |
| [`setup/`](setup/) | `SETUP.md` — first-time local dev setup and the phone/Expo Wi-Fi IP gotcha. |
| [`brand/`](brand/) | PFUMA logos and marks (PNG/SVG) plus `brand.zip`. |
| [`team-tasks/`](team-tasks/) | Task-split screenshots (Arnold / Addy). |
| [`field-research/`](field-research/) | Farmer photos from field visits (not tracked in git). |

## Platform docs — read in this order

1. **[PLATFORM_OVERVIEW.md](platform/PLATFORM_OVERVIEW.md)** — what PFUMA/INGCEBO is, the problem it
   solves, current build status, and what is real vs. dormant (including the current IoT status).
2. **[FEATURES_AND_ROLES.md](platform/FEATURES_AND_ROLES.md)** — every role, every feature, and how
   they connect.
3. **[TECHNICAL_ARCHITECTURE.md](platform/TECHNICAL_ARCHITECTURE.md)** — stack, repo layout, data
   model, security model, and how/where it runs (local dev + the live GRIWD VPS deployment).
4. **[COMPLIANCE_AND_LEGAL.md](platform/COMPLIANCE_AND_LEGAL.md)** — how the product maps to
   Zimbabwean law, and how that approach generalizes to a different domain/regulator.
5. **[EVENT_ADAPTATION_GUIDE.md](platform/EVENT_ADAPTATION_GUIDE.md)** — how to take the platform to
   a *different* expo or competition: what to re-skin per event, what never changes, and a worked
   POTRAZ-style example.

**Why `platform/` exists:** PFUMA/INGCEBO was built for the Zimbabwe Agricultural Show, but the
platform itself — verified digital livestock records, role-gated marketplace clearance, AI
assistant, compliance engine — isn't agric-show-specific. It's being positioned for reuse at other
expos and innovation competitions, so `platform/` is the neutral version and `agric-show-2026/` is
the event-specific one.

## Regenerating posters and wiring diagrams

From inside `posters-and-diagrams/` (needs Playwright):

```
python make_poster.py && python render_poster.py
python make_poster_public.py && python render_poster_public.py
python make_wiring_diagrams.py && python render_wiring_diagrams.py
```

The PDFs and PNG previews are written back into the same folder.

## Source-of-truth notes

- The platform docs describe the codebase as of **2026-09-18**. Where something here conflicts with
  the code, the code wins — re-check before relying on a specific route, table, or role name.
- The `agric-show-2026/` docs were corrected on 2026-09-18 to match the current build (role is
  `Buyer`, not "Retailer"; the `Institution` role, cooperatives, and outbreak reporting are
  covered). `hardware/IOT_HARDWARE_GUIDE.md` was intentionally left untouched — the hardware track
  is dormant and it's a historical design reference, not an active pitch document.
- Hardware manufacturing PDFs inside the root `hardware/` folder (KiCad/Vero handoff exports) stay
  there — they're tied to their own project subfolders.
