export const DOSAGE_RATES = {
  "Oxytetracycline (LA)": {
    rate: 1, unit: "ml", per: 10, target: "kg",
    frequency: "Every 48h", maxDose: 20,
    category: "Antibiotic",
    note: "Long-acting. For BRD, wound infections, tick-borne fevers. Withdraw 28 days before slaughter."
  },
  "Buparvaquone (Butalex)": {
    rate: 1, unit: "ml", per: 20, target: "kg",
    frequency: "Single IM dose", maxDose: 10,
    category: "Anti-protozoal",
    note: "Specific for Theileriosis (January Disease) & ECF. Administer early for best outcome."
  },
  "Albendazole (Oral Drench)": {
    rate: 0.5, unit: "ml", per: 10, target: "kg",
    frequency: "Single dose, repeat in 4 weeks", maxDose: 15,
    category: "Anthelmintic",
    note: "Broad-spectrum dewormer for roundworms, tapeworms, and liver fluke. Do not use in early pregnancy."
  },
  "Vitamin B-Complex": {
    rate: 5, unit: "ml", per: 100, target: "kg",
    frequency: "Daily for 3-5 days", maxDose: 30,
    category: "Supportive",
    note: "Supportive care during recovery. Boosts appetite and neurological function."
  },
  "Ivermectin 1% Injectable": {
    rate: 1, unit: "ml", per: 50, target: "kg",
    frequency: "Single SC dose, repeat in 14 days", maxDose: 10,
    category: "Antiparasitic",
    note: "For mange, lice, and internal parasites. Inject subcutaneously behind the shoulder."
  },
  "Penicillin G Procaine": {
    rate: 1, unit: "ml", per: 20, target: "kg",
    frequency: "Every 24h for 3-5 days", maxDose: 25,
    category: "Antibiotic",
    note: "First-line for Blackleg, wounds, and soft tissue infections. IM injection only."
  },
  "Dexamethasone": {
    rate: 0.05, unit: "ml", per: 1, target: "kg",
    frequency: "Single dose, vet-supervised only", maxDose: 20,
    category: "Anti-inflammatory",
    note: "For anaphylaxis, severe inflammation, and ketosis. Do not use in late pregnancy."
  },
  "Calcium Borogluconate 40%": {
    rate: 1, unit: "ml", per: 10, target: "kg",
    frequency: "Single slow IV infusion", maxDose: 50,
    category: "Mineral Supplement",
    note: "For milk fever (hypocalcaemia) in freshly calved cows. Administer slowly — monitor heart rate."
  },
  "Flunixin Meglumine (Finadyne)": {
    rate: 0.5, unit: "ml", per: 45, target: "kg",
    frequency: "Every 12-24h for up to 3 days", maxDose: 10,
    category: "NSAID / Pain Relief",
    note: "Anti-inflammatory and pain relief. For post-calving pain, FMD soreness, and fever management."
  },
  "Parvaquone (Clexon)": {
    rate: 1, unit: "ml", per: 20, target: "kg",
    frequency: "Single IM dose", maxDose: 12,
    category: "Anti-protozoal",
    note: "Alternative to Buparvaquone for East Coast Fever. Use within first 3 days of fever onset."
  },
  "Sulfadimidine 33%": {
    rate: 1, unit: "ml", per: 15, target: "kg",
    frequency: "Every 24h for 3-5 days", maxDose: 30,
    category: "Sulfonamide Antibiotic",
    note: "For coccidiosis, respiratory, and urinary tract infections. Ensure high water intake during treatment."
  },
  "Oxytocin": {
    rate: 0.05, unit: "ml", per: 1, target: "kg",
    frequency: "Single dose — vet supervision mandatory", maxDose: 5,
    category: "Hormone",
    note: "For retained placenta and uterine inertia post-calving. Must only be used by or under a licensed vet."
  }
};
