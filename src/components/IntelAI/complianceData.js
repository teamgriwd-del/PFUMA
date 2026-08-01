// Condensed, chat-ready summaries derived from the full research in /compliance.
// Not legal or veterinary advice — see /compliance/README.md for the disclaimer
// and full source citations. Keep this file's content in sync with the
// underlying /compliance/species/*.md docs if either one is updated.

export const SPECIES_COMPLIANCE = {
  Cattle: {
    legalRequirements: [
      'Brand registration (brand certificate + physical brand, usually left neck) — proof of ownership, required for police clearance before a sale.',
      'RFID ear tag under the national traceability programme, where rolled out in your area.',
      'Dip tank registration, tying the animal to a locality for tick control and disease tracing.',
      'DVS Veterinary Movement Permit before transport/sale across any distance or district line.',
      'Police clearance before/at point of sale — confirms the animal is not stolen and matches brand/tag to owner records.',
    ],
    diseases: ['Foot and Mouth Disease', 'Theileriosis (January Disease)', 'Anthrax', 'Lumpy Skin Disease', 'Blackleg (Clostridial Myositis)', 'Bovine Respiratory Disease (BRD)', 'East Coast Fever (ECF)', 'Brucellosis (Contagious Abortion)', 'Contagious Bovine Pleuropneumonia (CBPP)', 'Mange (Sarcoptic/Demodectic)'],
    diagnosisBasics: 'Call a vet immediately for: sudden death with bleeding from body openings (possible anthrax — do not open the carcass), blisters/sores on mouth/feet/teats (possible FMD), skin nodules with fever (possible LSD), swollen lymph nodes + cloudy eyes + laboured breathing (possible January Disease), or sudden severe lameness with hot, gas-crackling muscle (possible blackleg). A mild cough or occasional nasal discharge without fever can usually be monitored, but escalate if it spreads through the herd.',
    vaccinationPointers: 'Dip weekly in the rainy season, fortnightly in the dry season (DVS "5-5-4" intensified schedule during outbreaks). FMD vaccination roughly every 6 months. Blackleg and Anthrax annually, ideally before the rainy season. Confirm current serotypes/products with DVS or your vet.',
  },
  Pig: {
    legalRequirements: [
      'Proof of ownership (purchase receipts, breeding records) — pigs are "stock" under the Stock Theft Prevention Act, same exposure as cattle/sheep/goats.',
      'Disease reporting duty for suspected notifiable disease, especially African Swine Fever.',
      'DVS movement permit / veterinary clearance for transport, especially during an ASF outbreak in the area.',
      "Zimbabwe's brand/RFID identification system is built primarily around cattle — a pig-specific ID scheme was not confirmed in research, so confirm with DVS whether one applies in your district.",
    ],
    diseases: ['African Swine Fever (ASF)', 'Classical Swine Fever (CSF)'],
    diagnosisBasics: 'Call a vet immediately for: sudden, unexplained deaths clustered over days, blue-purple or purple skin discoloration on ears/snout/tail/legs/abdomen, or high fever with off-feed behaviour across multiple pigs at once. ASF and CSF look almost identical clinically — never assume which one it is; get DVS/lab testing to confirm before moving, selling, or slaughtering any pig from the premises.',
    vaccinationPointers: 'No reliable ASF vaccine exists — biosecurity is the primary defence: control who/what enters the pig area, disinfect visitor footwear/vehicles, never feed untreated food waste or swill, and control contact with wild pigs/warthogs. Routine deworming and standard piglet vaccinations should follow a vet-set schedule.',
  },
  Sheep: {
    legalRequirements: [
      'Identification/branding under the historical Brands Act framework (covers cattle, horses, sheep, and goats) — practical enforcement detail for sheep is thinner than for cattle; confirm locally.',
      'Proof of ownership — sheep are "stock" under the Stock Theft Prevention Act.',
      'Disease reporting duty for suspected notifiable disease, especially PPR and Sheep Pox.',
      'DVS movement permit / veterinary clearance for transport across district lines or during an outbreak.',
      'Police clearance for sale, where locally practised.',
    ],
    diseases: ['Peste des Petits Ruminants (PPR)', 'Sheep and Goat Pox', 'Foot and Mouth Disease'],
    diagnosisBasics: 'Call a vet immediately for: high fever with heavy eye/nose discharge and mouth sores preventing normal feeding (possible PPR), multiple skin nodules with fever spreading across several animals (possible Sheep Pox), or sudden diarrhoea combined with respiratory distress across the flock. Isolated mild lameness with no fever and no spread can usually be monitored.',
    vaccinationPointers: 'PPR vaccine around 4 months of age (immunity ~3 years) — treat as core, not optional. Sheep/Goat Pox as a core vaccine per local DVS schedule. Clostridial (CDT) vaccine typically timed around lambing, weaning, and breeding.',
  },
  Goat: {
    legalRequirements: [
      'Identification/branding under the historical Brands Act framework — practical enforcement detail for goats is thinner than for cattle; confirm locally.',
      'Proof of ownership — goats are "stock" under the Stock Theft Prevention Act.',
      'Disease reporting duty for suspected notifiable disease, especially PPR, Goat Pox, and CCPP.',
      'DVS movement permit / veterinary clearance for transport across district lines or during an outbreak.',
      'Police clearance for sale, where locally practised.',
    ],
    diseases: ['Peste des Petits Ruminants (PPR)', 'Sheep and Goat Pox', 'Contagious Caprine Pleuropneumonia (CCPP)'],
    diagnosisBasics: 'Call a vet immediately for: high fever with heavy eye/nose discharge and mouth sores (possible PPR), multiple skin nodules with fever (possible Goat Pox), or fever with rapid/laboured breathing, coughing, and frothy salivation (possible CCPP — this can kill nearly an entire herd, so treat any respiratory-distress cluster as an emergency). A single mild cough without fever or spread can usually be monitored.',
    vaccinationPointers: 'PPR vaccine around 4 months of age (immunity ~3 years). Goat/Sheep Pox as a core vaccine per local DVS schedule. CCPP vaccine where available/deployed locally — biosecurity (avoiding contact with untested animals) matters as much as vaccination given the very high mortality of an outbreak. Clostridial (CDT) vaccine around kidding, weaning, and breeding.',
  },
};

// What each role must provide/comply with at signup — condensed from
// /compliance/signup-verification-requirements.md.
export const SIGNUP_REQUIREMENTS = {
  Farmer: [
    'National ID or valid passport.',
    'Proof of land/farm access — title deed, 99-year lease, offer letter, A1/A2 permit, or a communal land allocation letter. Any legitimate Zimbabwean land-tenure document is accepted, not only freehold title.',
    'Livestock brand/tag registration details where applicable (brand certificate number, dip tank, district) — needed later to get police clearance for any sale.',
  ],
  Veterinarian: [
    'National ID.',
    'Council of Veterinary Surgeons of Zimbabwe (CVSZ) registration/practising number — legally required to practise veterinary medicine in Zimbabwe.',
    'Veterinary qualification (degree/diploma) as supporting evidence.',
  ],
  Supplier: [
    'National ID of the responsible individual.',
    'Business registration — ZIMRA BP number and/or company/PBC registration.',
    'If dealing in veterinary medicines/vaccines/acaricides: a Medicines Control Authority of Zimbabwe (MCAZ) Veterinary Medicines General Dealers Permit (VMGD). Not required for a feed/equipment-only supplier.',
  ],
  Retailer: [
    'National ID of the responsible individual.',
    'Business registration — BP number, company registration, or Private Business Corporation (PBC) for small operators.',
    'Acknowledgement of Consumer Protection Act obligations (disclosure, pricing, no blanket "no refund" policies) before listing.',
  ],
  Police: [
    'National ID.',
    'Service/force number and badge number.',
    'Station attachment (which police station/district).',
    'Not self-service — Police accounts are manually vetted/provisioned by an existing verified officer, given the damage a fraudulent "Police" account could do (fake clearances enabling stock theft).',
  ],
};
