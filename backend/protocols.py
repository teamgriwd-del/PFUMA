"""Mandatory vaccination protocols — the server-side source of truth.

This mirrors HEALTH_PROTOCOLS in src/components/HealthManagement/healthData.js.
The frontend copy drives the farmer's schedule UI; this copy decides whether a
compliance case is opened, which is an enforcement decision and therefore must
not be computed on a client the farmer controls.

Keep the two in sync when a protocol changes.

Only entries with `mandatory: True` and an administrable shot open a case.
Items like 'African Swine Fever Biosecurity' (no vaccine exists) or
'PRRS Monitoring' are husbandry practices, not something a farmer can be
locked out of trade for failing to administer.
"""

# age            — days from birth when the first dose becomes due
# interval_days  — recurrence for boosters; None means a one-off dose
# enforceable    — False for protocol/monitoring entries with nothing to inject
PROTOCOLS = {
    "Cattle": [
        {"name": "Brucellosis (S19)",            "age": 120, "interval_days": None, "mandatory": True,  "enforceable": True},
        {"name": "Anthrax/Blackleg (Blanthax)",  "age": 180, "interval_days": 365,  "mandatory": True,  "enforceable": True},
        {"name": "Lumpy Skin Disease",           "age": 210, "interval_days": 365,  "mandatory": True,  "enforceable": True},
        {"name": "FMD Vaccine",                  "age": 180, "interval_days": 182,  "mandatory": True,  "enforceable": True},
        {"name": "CBPP Vaccine (T1sr)",          "age": 365, "interval_days": 365,  "mandatory": True,  "enforceable": True},
    ],
    "Goat": [
        {"name": "Pulpy Kidney (Enterotoxaemia)", "age": 60, "interval_days": 365,  "mandatory": True,  "enforceable": True},
        {"name": "Pasteurella (Pneumonia)",       "age": 45, "interval_days": 365,  "mandatory": True,  "enforceable": True},
        {"name": "Foot Rot Vaccine",              "age": 90, "interval_days": 365,  "mandatory": False, "enforceable": True},
        {"name": "Deworming (Albendazole)",       "age": 30, "interval_days": 91,   "mandatory": False, "enforceable": True},
    ],
    "Sheep": [
        {"name": "Blue Tongue",                   "age": 120, "interval_days": 365, "mandatory": True,  "enforceable": True},
        {"name": "Anthrax",                       "age": 150, "interval_days": 365, "mandatory": True,  "enforceable": True},
        {"name": "Pulpy Kidney",                  "age": 60,  "interval_days": 365, "mandatory": True,  "enforceable": True},
        {"name": "Ovine Footrot Vaccine",         "age": 90,  "interval_days": 182, "mandatory": False, "enforceable": True},
    ],
    "Pig": [
        {"name": "African Swine Fever Biosecurity", "age": 1,  "interval_days": None, "mandatory": True,  "enforceable": False},
        {"name": "Swine Fever (Classical)",         "age": 60, "interval_days": 365,  "mandatory": True,  "enforceable": True},
        {"name": "Iron Dextran Injection",          "age": 3,  "interval_days": None, "mandatory": True,  "enforceable": True},
        {"name": "PRRS Monitoring",                 "age": 90, "interval_days": 182,  "mandatory": False, "enforceable": False},
    ],
}


def enforceable_vaccines(species):
    """The protocol items a compliance case may be opened for."""
    return [v for v in PROTOCOLS.get(species, []) if v["mandatory"] and v["enforceable"]]


# ── ESCALATION LADDER ────────────────────────────────────────────
# Days spent in each stage before the case is eligible to move on. The system
# only ever advances a case as far as 'vet_followup' on its own — a notice and
# a trade lockout are both a vet's decision, never an automatic one, because
# only a person can tell "ignoring it" apart from "couldn't get it done".
GRACE_DAYS = {
    "reminder": 7,        # farmer gets a week of reminders before a vet is pulled in
    "vet_followup": 14,   # vet has two weeks to make contact before a notice is on the table
    "notice": 14,         # formal notice: two weeks to comply before a lockout can be applied
}

AUTO_ADVANCE = {"reminder": "vet_followup"}

# How a declared blocker is routed — the case goes to whoever can unblock it.
BLOCKER_ROUTING = {
    "vaccine_unavailable": "supplier",     # raise a demand signal to suppliers in the province
    "no_vet_access":       "vet_dispatch", # queue a vet visit for the ward
    "financial_hardship":  "cooperative",  # flag for a pooled/subsidised vaccination round
    "animal_condition":    "vet_review",   # pregnant/sick/too young to vaccinate — vet judges
    "other":               "vet_review",
}

# A deferral pauses the clock for this long before the case comes back up.
DEFER_DAYS = {
    "vaccine_unavailable": 30,
    "no_vet_access":       30,
    "financial_hardship":  45,
    "animal_condition":    21,
    "other":               21,
}

# Beyond this many self-declared deferrals the case stops auto-pausing and
# needs a vet to sign off — the escape hatch stays open, but not forever.
MAX_SELF_DEFERRALS = 2
