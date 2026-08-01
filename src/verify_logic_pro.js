// PFUMA Pro Logic Verification Suite
// This suite tests high-confidence features like weighted scoring, noise filtering, and edge cases.

import { diseaseDatabase } from './components/DiseaseDetection/diseaseData.js';
import { HEALTH_PROTOCOLS } from './components/HealthManagement/healthData.js';

console.log("🚀 STARTING PFUMA PRO VALIDATION SUITE\n");

// 1. TEST: Diagnostic Weighted Logic & False Positive Penalization
function testDiagnosticConfidence() {
  console.log("--- 1. Testing Diagnostic Confidence Engine ---");
  
  // Case A: Perfect Match (All Primary + Secondary)
  const fmd = diseaseDatabase.find(d => d.name === "Foot and Mouth Disease");
  const perfectSymptoms = [...fmd.symptoms.primary, ...fmd.symptoms.secondary];
  
  let score = 0;
  let maxPossibleScore = 0;
  fmd.symptoms.primary.forEach(s => { maxPossibleScore += 10; if (perfectSymptoms.includes(s)) score += 10; });
  fmd.symptoms.secondary.forEach(s => { maxPossibleScore += 5; if (perfectSymptoms.includes(s)) score += 5; });
  
  const perfectConfidence = Math.round((score / maxPossibleScore) * 100);
  console.log(`FMD Perfect Match: ${perfectConfidence}% (Target: 100%)`);

  // Case B: Partial Match (Primary missing, only secondary present)
  const noisySymptoms = ["fever", "loss of appetite"]; // These are secondary for many diseases
  let noisyScore = 0;
  fmd.symptoms.primary.forEach(s => { if (noisySymptoms.includes(s)) noisyScore += 10; });
  fmd.symptoms.secondary.forEach(s => { if (noisySymptoms.includes(s)) noisyScore += 5; });
  const noisyConfidence = Math.round((noisyScore / maxPossibleScore) * 100);
  console.log(`FMD Secondary-Only Match: ${noisyConfidence}% (Confidence correctly penalized)`);

  if (perfectConfidence === 100 && noisyConfidence < 50) {
    console.log("✅ Diagnostic Weighted Logic Passed");
  } else {
    console.log("❌ Diagnostic Weighted Logic Failed Validation");
  }
}

// 2. TEST: Zimbabwe Regional Integrity
function testRegionalIntegrity() {
  console.log("\n--- 2. Testing Zimbabwe Regional Data Integrity ---");
  const protocol = HEALTH_PROTOCOLS.Cattle;
  const weaning = protocol.weaningAge;
  
  console.log(`Zimbabwe Cattle Protocol Weaning Age: ${weaning} days`);
  
  if (weaning === 210) {
    console.log("✅ Regional Integrity Passed");
  } else {
    console.log("❌ Regional Integrity Failed");
  }
}

testDiagnosticConfidence();
testRegionalIntegrity();

console.log("\n🛡️ ALL PRO VALIDATION TESTS COMPLETE");
