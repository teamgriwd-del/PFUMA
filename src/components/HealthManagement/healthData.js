export const HEALTH_PROTOCOLS = {
  Cattle: {
    gestation: 283,
    weaningAge: 210,
    alertThresholds: {
      tempHigh: 39.5,
      tempLow: 37.5,
      heartRateHigh: 100,
      heartRateLow: 48
    },
    vaccines: [
      { name: "Brucellosis (S19)", age: 120, mandatory: true, type: "Once", notes: "Heifers only, 3-8 months" },
      { name: "Anthrax/Blackleg (Blanthax)", age: 180, mandatory: true, type: "Annual", notes: "Pre-rainy season" },
      { name: "Lumpy Skin Disease", age: 210, mandatory: true, type: "Annual", notes: "Before wet season" },
      { name: "FMD Vaccine", age: 180, mandatory: true, type: "Bi-Annual", notes: "April & October" },
      { name: "CBPP Vaccine (T1sr)", age: 365, mandatory: true, type: "Annual", notes: "Endemic zones only" }
    ]
  },
  Goat: {
    gestation: 150,
    weaningAge: 90,
    alertThresholds: {
      tempHigh: 40.5,
      tempLow: 38.5,
      heartRateHigh: 110,
      heartRateLow: 70
    },
    vaccines: [
      { name: "Pulpy Kidney (Enterotoxaemia)", age: 60, mandatory: true, type: "Annual", notes: "Kid at 2 months" },
      { name: "Pasteurella (Pneumonia)", age: 45, mandatory: true, type: "Annual", notes: "Pre-cold season" },
      { name: "Foot Rot Vaccine", age: 90, mandatory: false, type: "Annual", notes: "Wet-area flocks" },
      { name: "Deworming (Albendazole)", age: 30, mandatory: false, type: "Quarterly", notes: "Every 3 months" }
    ]
  },
  Sheep: {
    gestation: 152,
    weaningAge: 100,
    alertThresholds: {
      tempHigh: 40.0,
      tempLow: 38.5,
      heartRateHigh: 115,
      heartRateLow: 60
    },
    vaccines: [
      { name: "Blue Tongue", age: 120, mandatory: true, type: "Annual", notes: "Insect vector season" },
      { name: "Anthrax", age: 150, mandatory: true, type: "Annual", notes: "Pre-rainy season" },
      { name: "Pulpy Kidney", age: 60, mandatory: true, type: "Annual", notes: "Lambs at 2 months" },
      { name: "Ovine Footrot Vaccine", age: 90, mandatory: false, type: "Bi-Annual", notes: "Wet grazing areas" }
    ]
  },
  Pig: {
    gestation: 114,
    weaningAge: 28,
    alertThresholds: {
      tempHigh: 40.0,
      tempLow: 38.0,
      heartRateHigh: 130,
      heartRateLow: 55
    },
    vaccines: [
      { name: "African Swine Fever Biosecurity", age: 1, mandatory: true, type: "Protocol", notes: "No vaccine — strict biosecurity only" },
      { name: "Swine Fever (Classical)", age: 60, mandatory: true, type: "Annual", notes: "Lapinized virus vaccine" },
      { name: "Iron Dextran Injection", age: 3, mandatory: true, type: "Once", notes: "Piglets at 3 days old" },
      { name: "PRRS Monitoring", age: 90, mandatory: false, type: "Bi-Annual", notes: "Breeding herds" }
    ]
  }
};

export const BREED_PROFILES = {
  Cattle: [
    { breed: "Brahman", origin: "India/USA", mature_weight_kg: 500, heat_tolerance: "Excellent", notes: "Best tick resistance in Zimbabwe" },
    { breed: "Hereford", origin: "England", mature_weight_kg: 650, heat_tolerance: "Moderate", notes: "Excellent marbling, British beef breed" },
    { breed: "Mashona", origin: "Zimbabwe", mature_weight_kg: 400, heat_tolerance: "Excellent", notes: "Indigenous breed — high disease resistance" },
    { breed: "Nguni", origin: "Southern Africa", mature_weight_kg: 380, heat_tolerance: "Excellent", notes: "Hardy, tick-resistant, suits communal farming" },
    { breed: "Simmental", origin: "Switzerland", mature_weight_kg: 700, heat_tolerance: "Poor", notes: "Dual-purpose (milk+beef), needs good management" },
    { breed: "Charolais", origin: "France", mature_weight_kg: 750, heat_tolerance: "Poor", notes: "Fast growth, lean beef — high-input required" },
    { breed: "Tuli", origin: "Zimbabwe", mature_weight_kg: 420, heat_tolerance: "Excellent", notes: "Sanga type, excellent forager, drought-tolerant" }
  ],
  Goat: [
    { breed: "Boer", origin: "South Africa", mature_weight_kg: 110, notes: "Primary meat breed, fast growth rate" },
    { breed: "Matebele", origin: "Zimbabwe", mature_weight_kg: 45, notes: "Indigenous, highly adapted to communal conditions" },
    { breed: "Saanen", origin: "Switzerland", mature_weight_kg: 65, notes: "Top dairy goat breed — needs supplement feeding" },
    { breed: "Kalahari Red", origin: "South Africa", mature_weight_kg: 90, notes: "Heat-tolerant meat breed" }
  ],
  Sheep: [
    { breed: "Dorper", origin: "South Africa", mature_weight_kg: 90, notes: "Excellent meat, hair sheep — no shearing required" },
    { breed: "Merino", origin: "Spain", mature_weight_kg: 70, notes: "Premium fine wool — high care requirements" },
    { breed: "Sabi", origin: "Zimbabwe", mature_weight_kg: 45, notes: "Indigenous, adapted to hot dry conditions" }
  ],
  Pig: [
    { breed: "Large White", origin: "England", mature_weight_kg: 320, notes: "Commercial breed — fast growth, large litters" },
    { breed: "Landrace", origin: "Denmark", mature_weight_kg: 280, notes: "Long body, excellent bacon production" },
    { breed: "Duroc", origin: "USA", mature_weight_kg: 300, notes: "Hardy, good feed conversion, reddish coat" }
  ]
};
