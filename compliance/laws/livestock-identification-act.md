# Livestock Identification: Branding, Tagging & Registration

> Not legal advice. See the [disclaimer](../README.md).

## What it is

Livestock identification in Zimbabwe rests on two overlapping legal/regulatory layers:

1. **The Brands Act of 1900** (as amended over the years) — the historical legal framework requiring livestock owners to register a unique **brand mark** for cattle, and also covering horses, sheep, and goats. It makes altering or removing another owner's brand a punishable offence.
2. **Animal Health (Livestock Identification) (Cattle) Regulations**, made under the Animal Health Act [Chapter 19:01] — these require cattle to be identified, historically by **branding on the left neck** plus **ear tagging**.

Layered on top of this is a modernization effort: a **National Cattle Identification Program** using electronic **RFID ear tags**, run with Ministry of Agriculture oversight (the Ministry of Lands, Agriculture, Fisheries, Water and Rural Development), with digital payment/administration support from private partners. Once fully rolled out, cattle without an RFID tag are liable to be **impounded by the ZRP Anti-Stock Theft Unit**. As of our research, rollout is progressive rather than uniformly complete nationwide — **farmers should confirm current tagging requirements in their specific district with DVS or their local dip tank/extension officer.**

## What a brand/tag encodes

A registered cattle brand is a coded mark that identifies:
- The **owner**
- The **village of origin**
- The **dip tank** the animal is registered to
- The **district**

This lets DVS and police trace an animal back to its owner and area during both disease outbreaks (contact tracing) and theft investigations.

## Registration process (brand certificate)

Based on available sources, the general process is:
1. The farmer takes their **national identification document** and **stock card** to the nearest **civil registry office**.
2. The office issues a **brand certificate**, typically within about a week.
3. The farmer then has the brand mark physically made (traditionally by a local iron worker/welder) and applies it to their cattle.

A small per-animal registration fee has historically applied (this has been waived at times, e.g. during 2022) — **current fees should be confirmed with the Registrar-General's office or DVS, as they change.**

## Why this matters for ownership and sales

- **Unbranded/unregistered cattle are effectively unclaimable if lost or stolen.** Zimbabwean reporting has documented cases where dozens of unbranded, stolen cattle could not be returned to their rightful owners and were instead auctioned by the state, because there was no way to prove ownership.
- **Police cannot lawfully clear the transfer/sale of unbranded animals** in the standard clearance process (see [stock-theft-act.md](stock-theft-act.md) and [livestock-movement-permits.md](livestock-movement-permits.md)), which in practice blocks a legitimate sale.
- The **Stock Theft Act** imposes criminal penalties (a fine up to level 7 and/or imprisonment up to four years, per sources reviewed) for failing to provide required identification/traceability documentation for an animal — underscoring that identification isn't just paperwork, it's what stands between an owner and a theft accusation.

## What this means for PFUMA

- A **Farmer** listing cattle (and, where applicable, sheep/goats) for sale should be prompted for **brand/tag details** (brand mark code, dip tank, district) as part of the listing, and the platform should treat "no brand/tag on record" as a red flag requiring extra scrutiny before a sale is facilitated.
- The AI assistant should tell farmers that branding/tagging is not optional decoration — it is what makes an animal legally provable as theirs, and a precondition for police clearance and lawful transport.
- Sheep and goats are also covered by the Brands Act in principle, but our sources focused mainly on cattle; **owners of sheep/goats should confirm current identification requirements with DVS**, as enforcement and RFID rollout emphasis has focused on cattle first.

## What we could not verify with confidence

- We could not locate the exact current chapter/section citation for the Brands Act of 1900 as currently numbered in Zimbabwe's statute book, nor a precise, current fee schedule for brand certificates. These should be confirmed with the Registrar-General's office or DVS.
- The exact legal instrument and rollout status of the RFID National Cattle Identification Program (i.e., whether it is already a hard legal mandate everywhere, or still a phased government/private initiative) was not confirmed from a primary legal text — treat the "RFID may become mandatory / unregistered cattle may be impounded" statement as programme messaging rather than confirmed statute.

## Sources

- [The issue with cattle branding in Zimbabwe — AgriOrbit](https://agriorbit.com/the-issue-with-cattle-branding-in-zimbabwe/)
- [National Cattle Identification Program — ICEcash](https://www.icecash.co.zw/our-services/national-cattle-identification-program/)
- [Zimbabwe - Register a Cattle Brand Certificate (Animal Brand Certificate) — WikiProcedure](https://www.wikiprocedure.com/index.php/Zimbabwe_-_Register_a_Cattle_Brand_Certificate(Animal_Brand_Certificate))
- [RG: Livestock registration key to order in communities — New Zimbabwe](https://www.newzimbabwe.com/rg-livestock-registration-key-to-order-in-communities/)
- [Livestock Identification Trust](http://www.livestockzimbabwe.com/lit.html)
- [Zimbabwe — Statutory law — Animal production — SWM Programme legal hub](https://www.swm-programme.info/fr/legal-hub/zimbabwe/animal-production)
- [Stock Theft Prevention Act (Chapter 9:18) — law.co.zw](https://www.law.co.zw/download/1686/)
