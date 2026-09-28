# Demo accounts

Sign-in details for the seeded demo data: the accounts to drive a live
walkthrough from, at a stand or in a meeting. Created and re-created by
`backend/seed_demo_data.py`, and this file is generated from that same
script, so if the two ever disagree the script is right.

**Everything below is fabricated.** No person, national ID, badge, licence
number, herd or animal here is real.

## The password

Every demo account, every role: `Pfuma2026!`

The phone number is the username. Web app and Android app share the same
accounts on the same server, so either one signs in with these.

## What's seeded

- **20 farmers**, two in each of the ten provinces, each with a herd of
  cattle and goats carrying photos, weight history and a vaccination record
- **10 veterinarians**, one per province, DVS
- **10 police officers**, one per province, ZRP Stock Theft Unit
- **1 senior officer** at national tier, who sees every province and is the
  only account that can verify an outbreak report
- **1 supplier** and **1 buyer**, both trading nationwide

Plus the trade around them: livestock listings live on the marketplace and
others still waiting on police clearance, sixty past sales carrying bids and
trust ratings, cooperative dip rounds, supplier orders, and one genuinely
overdue booster per province so the compliance queue is not empty.

## Farmers, vets and police, by province

| Province | Farmer | Farmer | Vet | Police |
|---|---|---|---|---|
| **Mashonaland West** | Tendai Marufu<br>`0782100101` | Rudo Chigumba<br>`0782100102` | Dr Kudzai Mupfumira<br>`0782200101` | Insp. Never Zvavamwe<br>`0782300101` |
| **Mashonaland Central** | Farai Madziva<br>`0782100201` | Chiedza Runyowa<br>`0782100202` | Dr Blessing Chitepo<br>`0782200201` | Sgt. Tonderai Shamu<br>`0782300201` |
| **Mashonaland East** | Takudzwa Mabika<br>`0782100301` | Nyasha Kamusoko<br>`0782100302` | Dr Tinashe Goto<br>`0782200301` | Insp. Memory Chiweshe<br>`0782300301` |
| **Matabeleland North** | Sibusiso Nyoni<br>`0782100401` | Nomsa Tshuma<br>`0782100402` | Dr Bongani Mguni<br>`0782200401` | Sgt. Khumbulani Dube<br>`0782300401` |
| **Matabeleland South** | Nkosana Mathema<br>`0782100501` | Lindiwe Masuku<br>`0782100502` | Dr Zanele Khumalo<br>`0782200501` | Insp. Thandiwe Ncube<br>`0782300501` |
| **Midlands** | Simbarashe Mhaka<br>`0782100601` | Vimbai Zinyemba<br>`0782100602` | Dr Tapiwa Gumbo<br>`0782200601` | Sgt. Edmore Chirimuuta<br>`0782300601` |
| **Manicaland** | Tatenda Mavhunga<br>`0782100701` | Panashe Rusike<br>`0782100702` | Dr Chipo Mutasa<br>`0782200701` | Insp. Pardon Nyakudya<br>`0782300701` |
| **Masvingo** | Munashe Chidziva<br>`0782100801` | Anesu Nyamutswa<br>`0782100802` | Dr Simbarashe Zvobgo<br>`0782200801` | Sgt. Loveness Chivasa<br>`0782300801` |
| **Harare** | Tafadzwa Mangwiro<br>`0782100901` | Shingai Dembetembe<br>`0782100902` | Dr Rutendo Chirwa<br>`0782200901` | Insp. Tarisai Mhondiwa<br>`0782300901` |
| **Bulawayo** | Mthokozisi Hadebe<br>`0782101001` | Sindisiwe Gumede<br>`0782101002` | Dr Melusi Sithole<br>`0782201001` | Sgt. Nkosilathi Mpofu<br>`0782301001` |

## National accounts

| Role | Name | Phone |
|---|---|---|
| Senior police officer, national tier | Chief Supt. Wellington Muchemwa | `0782390001` |
| Supplier | Sibongile Ndlovu, Zimvet Agro Supplies (Pvt) Ltd | `0782400001` |
| Buyer | Tapiwa Chigumba, Highveld Meats (Pvt) Ltd | `0782500001` |

## Walkthroughs these accounts support

**A sale, end to end.** Sign in as a farmer, open the herd, pick an animal
and post it to the marketplace. It goes out as *pending clearance*, not
live. Sign in as that province's police officer, open the clearance queue
and approve it, and it appears on the marketplace. Sign in as the buyer and
bid on it.

**Why a sale can't skip the officer.** Every province already has one
listing sitting in *pending clearance*. It is not on the public marketplace,
and no amount of browsing as the buyer will turn it up.

**The vaccination ladder.** The second farmer in each province has one beast
genuinely overdue for its CBPP booster. It surfaces in that farmer's
compliance view and in the province vet's follow-up queue on its own, off
the same protocol table the real system enforces. Nothing was staged to
make it appear.

**Provincial boundaries.** A vet or a field officer sees their own province.
The senior officer sees all ten. Signing in as both, one after the other,
shows the difference on the same screen.

**Trust ratings.** Every farmer has three completed sales to the buyer,
rated on both sides, which is enough for the platform to publish an
average (it withholds one below three ratings). Sellers carry a visible
score on their marketplace cards as a result.

## Re-running it

From `backend/`, with the database environment variables set:

```
python seed_demo_data.py            # create whatever is missing
python seed_demo_data.py --reset    # wipe the demo data and rebuild it
python seed_demo_data.py --purge    # remove it and leave nothing behind
python seed_demo_data.py --summary  # report what is currently seeded
```

`--purge` only touches accounts tagged as demo data (`users.avatar_seed =
'pfuma-demo-2026'`, which no real signup ever sets) and the rows hanging off
them, so a real account can't be caught by it.

The herds come from a fixed random seed, so a `--reset` rebuilds the same
animals with the same names, breeds and weights. Only the dates move, since
those are always measured from the day it runs.

## Photos

The animal photos are freely-licensed breed pictures from Wikimedia Commons,
committed under `backend/demo_assets/animals/` and copied into the uploads
folder at seed time. The platform serves them itself, so nothing depends on
a stand's Wi-Fi reaching an image CDN. Credits are in that folder's
`ATTRIBUTION.md`, and `fetch_livestock_photos.py` beside it is what pulled
them down.
