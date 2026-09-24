# PFUMA/INGCEBO — project rules for AI assistants

## No hardware. Ever.

PFUMA/INGCEBO is a **software-only platform** (web app, mobile app, backend). There is no
hardware in the product: no IoT, no collars, no base stations, no sensors, no GPS/LoRa tracking,
no ear-tag readers.

- **Never mention, describe, pitch, budget or document hardware or IoT** in anything you write
  about PFUMA: READMEs, platform docs, funding papers, pitch material, posters, slides,
  dissertation text, feature lists, roadmaps or "future work" sections.
- **Never add hardware** to the product, the roadmap or a budget unless the user explicitly asks
  for it in that conversation.
- Some old IoT code and design files are still in the repo (`hardware/`,
  `DOCUMENTATION/hardware/`, backend `/iot*` and `/admin/iot/*` routes, the web
  `HardwareSimulation` component and admin IoT tab, mobile `IoTScreen.js`, and the IoT database
  tables). They are **legacy and out of scope**: hidden from users and kept only because removing
  them hasn't been scheduled. Don't treat them as a feature, don't extend them, and don't use them
  as a source when describing the platform.
- `DOCUMENTATION/business-and-funding/BUDGET_PROPOSAL.md` is an old hardware budget. It is out of
  scope too; don't reuse any of it.

When describing what PFUMA does, use `DOCUMENTATION/platform/` and the live code (excluding the
legacy IoT parts above) as the source of truth.
