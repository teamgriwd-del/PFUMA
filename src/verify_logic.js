// PFUMA Logic Verification Suite
// To run: node src/verify_logic.js

import { diseaseDatabase } from './components/DiseaseDetection/diseaseData.js';
import { HEALTH_PROTOCOLS } from './components/HealthManagement/healthData.js';

function testDiagnostics() {
  console.log("--- Testing Diagnostic Engine ---");
  const symptoms = ["blisters", "lameness"]; // Primary symptoms for FMD
  const fmd = diseaseDatabase.find(d => d.name === "Foot and Mouth Disease");
  
  let score = 0;
  let maxPossibleScore = 0;

  fmd.symptoms.primary.forEach(s => {
    maxPossibleScore += 10;
    if (symptoms.includes(s)) score += 10;
  });

  fmd.symptoms.secondary.forEach(s => {
    maxPossibleScore += 5;
    if (symptoms.includes(s)) score += 5;
  });

  const confidence = Math.round((score / maxPossibleScore) * 100);
  console.log(`FMD Confidence Match: ${confidence}%`);
  
  if (confidence === 57) { // 20 matched out of 35 total (20+15)
     console.log("✅ Diagnostic Weighted Logic Passed");
  } else {
     console.log("❌ Diagnostic Weighted Logic Failed");
  }
}

function testGestation() {
  console.log("\n--- Testing Gestation Calculation ---");
  const cattlePeriod = HEALTH_PROTOCOLS.Cattle.gestation;
  console.log(`Cattle Gestation Period: ${cattlePeriod} days`);
  
  if (cattlePeriod === 283) {
    console.log("✅ Gestation Protocol Passed");
  } else {
    console.log("❌ Gestation Protocol Failed");
  }
}

testDiagnostics();
testGestation();
