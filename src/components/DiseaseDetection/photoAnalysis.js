// Real, client-side pixel analysis for the "Photo Check" shortcut.
//
// This is NOT species/disease-specific AI recognition — there is no public
// training data for Zimbabwean livestock disease imagery to build a real
// classifier from. What this genuinely does: downscale the uploaded photo,
// read its actual pixel data via Canvas, and compute honest heuristics —
// discoloration ratio, a blue-purple hue bias (cyanosis/bruising signal),
// and surface-texture roughness (edge density) — then map those to a small
// set of symptoms that are plausibly visible in a coat/skin photo. It will
// never claim to identify a specific disease; that's still the job of the
// weighted symptom-matching engine in DiseaseDetection.jsx.

const SIZE = 96; // downscaled analysis resolution — plenty for coarse heuristics, fast on any device

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function analyzePhotoPixels(file) {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const n = SIZE * SIZE;

  // Find the dominant coat/background colour via a coarse histogram (16
  // levels per channel = 4096 bins). A simple global mean/stddev breaks on
  // bimodal images — a cluster of lesion-coloured pixels pulls the mean
  // toward itself and widens the stddev enough that it stops looking like
  // an "outlier" in z-score terms. Histogram-mode is robust to that: the
  // majority colour (healthy coat/background) wins the bin count regardless
  // of how far a secondary cluster's colour sits from it.
  const BINS = 16;
  const binCounts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] >> 4) * BINS * BINS + (data[i + 1] >> 4) * BINS + (data[i + 2] >> 4);
    binCounts.set(key, (binCounts.get(key) || 0) + 1);
  }
  let dominantKey = 0, dominantCount = -1;
  for (const [key, count] of binCounts) {
    if (count > dominantCount) { dominantCount = count; dominantKey = key; }
  }
  const domR = ((dominantKey / (BINS * BINS)) | 0) * 16 + 8;
  const domG = (((dominantKey / BINS) | 0) % BINS) * 16 + 8;
  const domB = (dominantKey % BINS) * 16 + 8;

  let spotPixels = 0;
  let purplePixels = 0;
  const COLOR_DIST_THRESHOLD = 55; // Euclidean RGB distance from dominant colour
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - domR) ** 2 + (g - domG) ** 2 + (b - domB) ** 2);
    if (dist > COLOR_DIST_THRESHOLD) spotPixels++;
    // blue-purple bias: blue and red both notably above green, on a darker pixel —
    // a rough stand-in for cyanosis/bruise-type discoloration
    if (b > g + 15 && r > g + 5 && (r + g + b) / 3 < 140) purplePixels++;
  }

  // Surface texture via grayscale gradient magnitude (Sobel-lite)
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let edgeSum = 0, edgeCount = 0;
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      const idx = y * SIZE + x;
      edgeSum += Math.abs(gray[idx] - gray[idx + 1]) + Math.abs(gray[idx] - gray[idx + SIZE]);
      edgeCount++;
    }
  }
  const textureScore = edgeSum / edgeCount;

  return {
    spotRatio: spotPixels / n,
    purpleRatio: purplePixels / n,
    textureScore,
  };
}

export function classifyPhotoAnalysis(a) {
  const spotPct = Math.round(a.spotRatio * 100);
  const purplePct = Math.round(a.purpleRatio * 100);
  const textureLevel = a.textureScore > 8 ? 'high' : a.textureScore > 4 ? 'moderate' : 'low';

  const hasPurple = purplePct >= 4;
  const hasSpotting = spotPct >= 8;
  const roughTexture = textureLevel === 'high';

  let headline, detail;
  const suggested = [];

  if (hasPurple) {
    suggested.push('purple skin discoloration');
    headline = 'Possible skin discoloration detected';
    detail = `${purplePct}% of the visible area shows a blue-purple tint — could indicate cyanosis or bruise-type discoloration.`;
  } else if (hasSpotting && roughTexture) {
    suggested.push('skin nodules', 'skin crusting');
    headline = 'Possible skin nodules or crusting detected';
    detail = `${spotPct}% of the visible area shows irregular discoloration combined with a rough surface texture — consistent with nodules, crusting, or lesions.`;
  } else if (hasSpotting) {
    suggested.push('skin nodules');
    headline = 'Some visible discoloration detected';
    detail = `${spotPct}% of the visible area shows patchy discoloration, but the surface looks fairly smooth — this could just be normal coat markings. Compare against the animal in person.`;
  } else if (roughTexture) {
    suggested.push('thickened skin');
    headline = 'Rough surface texture detected';
    detail = 'The coat surface shows more texture variation than a typical smooth, healthy coat. Could indicate thickened or crusting skin — verify by touch.';
  } else {
    headline = 'No strong visual abnormality detected';
    detail = 'Coat colour and texture look fairly uniform in this photo.';
  }

  return { headline, detail, suggested, spotPct, purplePct, textureLevel };
}
