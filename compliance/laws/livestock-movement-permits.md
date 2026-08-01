# Livestock Movement Permits, Dip-Tank & Quarantine Rules

> Not legal advice. See the [disclaimer](../README.md).

## What it is

Moving livestock — for sale, slaughter, breeding, or relocation — across dip-tank areas, districts, or provincial lines in Zimbabwe is regulated under powers granted by the **Animal Health Act [Chapter 19:01]** (see [animal-health-act.md](animal-health-act.md)), operationalized by the **Department of Veterinary Services (DVS)**, and reinforced by the **Stock Theft Prevention Act [Chapter 9:18]** clearance process (see [stock-theft-act.md](stock-theft-act.md)). In practice, moving cattle any meaningful distance in Zimbabwe requires clearing **two separate gates**: a veterinary/health gate and a police/ownership gate.

## The standard clearance process

Based on sources reviewed, the typical sequence for moving cattle by road within Zimbabwe (for sale, slaughter, or crossing provincial lines) is:

1. **Ownership confirmation** — a village head or other trusted community witness confirms the animal(s) belong to the person seeking to move them (particularly relevant in communal areas where formal title may not exist).
2. **Veterinary inspection** — a DVS officer inspects the animals and certifies them as disease-free and fit for travel. This is where a **Veterinary Movement Permit** is issued.
3. **Police clearance** — police issue the final movement permit/clearance, checking identification (brand/tag) against records to guard against stock theft.

Both the Veterinary Movement Permit and Police Clearance are described in sources as the **two main requirements for moving livestock** in Zimbabwe.

## Why this exists

- **Disease control**: unrestricted movement is one of the fastest ways to spread diseases like Foot and Mouth Disease, Lumpy Skin Disease, and Anthrax across dip-tank areas, districts, and provinces. DVS inspection at the point of movement is meant to catch sick or exposed animals before they travel.
- **Theft prevention**: police clearance cross-checks brand/tag identification against ownership records so stolen animals can't simply be walked or trucked to a different market and sold as if nothing happened.

## Dip tanks and area-based control

Zimbabwe operates a network of **thousands of communal dip tanks**, administered with DVS support, primarily for tick control (see the [cattle](../species/cattle.md) doc for dipping schedules) but also serving as **local administrative units** that brand codes and area-of-origin references key off of. An animal's registered dip tank is effectively its "home base" for identification and, by extension, is relevant to movement/quarantine decisions during an outbreak — DVS can restrict movement into or out of specific dip-tank areas or districts when a disease is active there, independent of whether a general movement permit would otherwise be granted.

## Cross-border movement

Cross-border livestock movement (e.g., into/out of Zimbabwe, or informal cross-border trade with neighbouring countries) is a distinct and more heavily regulated matter, involving import/export permits, veterinary certification for international trade, and — per recent reporting reviewed — a nascent inter-governmental effort (an MoU signed in early 2024) between Zimbabwe and neighbours to jointly address cross-border cattle rustling. There has also been reported movement toward **digital/electronic movement permits** to reduce fraud and speed up cross-border transport processing. **Cross-border specifics change frequently and should always be confirmed directly with DVS and the relevant border/customs authority (ZIMRA) before a real cross-border transaction.**

## What this means for PFUMA

- Any in-app flow for **listing an animal for sale that will need to travel** (especially cross-district) should prompt the Farmer/Retailer/Supplier to confirm they have (or will obtain) both a **DVS Veterinary Movement Permit** and **Police Clearance** before the transaction is treated as complete.
- The AI assistant should be able to explain the two-gate process (vet inspection + police clearance) in plain language and should flag that **during a declared disease outbreak, movement may be restricted regardless of an otherwise-valid permit** (see [animal-health-act.md](animal-health-act.md)).
- Where the platform captures a dip-tank code as part of an animal's identification (see [livestock-identification-act.md](livestock-identification-act.md)), that same code is relevant context for movement-permit and outbreak-area questions.
- Note the caution in reporting reviewed: **police clearance is meant to be a free service**, and instances of officers demanding informal payment, or issuing clearance without checking documents/witnesses, have been documented as a corruption/enforcement problem, not a legitimate fee. The app should not imply clearance normally costs money.

## What we could not verify with confidence

- We could not find, from an accessible primary source, the exact current Statutory Instrument number(s) governing Veterinary Movement Permits specifically (as distinct from the general Animal Health Act framework), nor a confirmed, current fee schedule. **Confirm current forms, fees, and SI references directly with DVS.**
- Details of the current digital/electronic movement permit system's legal status and coverage were found only in news reporting, not primary legislation — treat as an evolving administrative process rather than a fixed legal requirement, and confirm current status with DVS/ZIMRA.

## Sources

- [Ensuring Safe Livestock Transportation in Zimbabwe — Maricho Media](https://www.marichomedia.com/ensuring-safe-livestock-transportation-in-zimbabwe/)
- [Digital permits streamline cross-border transport in Zimbabwe — CITE](https://cite.org.zw/digital-permits-streamline-cross-border-transport-in-zimbabwe/)
- [Digital permits streamline cross-border transport in Zimbabwe — Zimbabwe Situation](https://www.zimbabwesituation.com/news/digital-permits-streamline-cross-border-transport-in-zimbabwe/)
- [Cross-border cattle rustling impoverishes Zimbabwe, Botswana — Guardian Sun](https://guardiansun.co.bw/news/cross-border-cattle-rustling-impoverishes-zimbabwe-botswana/news)
- [FAO strengthening livestock dipping practices in Zimbabwe](https://www.fao.org/africa/news-stories/news-detail/fao-strengthening-livestock-dipping-practices-in-zimbabwe/en)
- [National Cattle Identification Program — ICEcash](https://www.icecash.co.zw/our-services/national-cattle-identification-program/)
- [Cops face arrest for demanding cattle clearance fees — Bulawayo24 News](https://bulawayo24.com/news/national/246551)
- [Zimbabwe: Over 3,400 People Arrested As Police Crackdown On Cattle Rustlers — allAfrica.com](https://allafrica.com/stories/202605110180.html)
