// ── PFUMA/INGCEBO imagery (native) ──────────────────────────────────────────────────
// Mirrors src/theme/imagery.js on web so both apps open on the same
// photograph per role — same Unsplash CDN ids, same crop/quality defaults.

const UNSPLASH = 'https://images.unsplash.com/photo-';

export function photo(id, { w = 1200, q = 72, crop = 'entropy' } = {}) {
  const src = PHOTOS[id];
  if (!src) return '';
  return `${UNSPLASH}${src}?auto=format&fit=crop&crop=${crop}&w=${w}&q=${q}`;
}

const PHOTOS = {
  cattleCloseup:    '1546445317-29f4545e9d53',
  cattleGolden:     '1500595046743-cd271d694d30',
  cattleField:      '1570042225831-d98fa7577f1e',
  goat:             '1524024973431-2ad916746881',
  sheep:            '1484557985045-edf25e08da73',
  pig:              '1516467508483-a7212febe31a',
  poultry:          '1548550023-2bdb3c5beed7',
  barnPasture:      '1444858291040-58f756a3bdd6',
  cropRows:         '1560493676-04071c5f467b',
  harvestHandshake: '1500937386664-56d1dfef3854',
  pastureTexture:   '1592982537447-7440770cbfc9',
};

export const SPECIES_PHOTO = {
  Cattle: 'cattleCloseup', Goat: 'goat', Sheep: 'sheep', Pig: 'pig', Poultry: 'poultry',
};

export const speciesPhoto = (species, opts) => photo(SPECIES_PHOTO[species] || 'cattleCloseup', opts);

export const ROLE_HERO = {
  Farmer: 'cattleGolden', Veterinarian: 'cattleCloseup', Supplier: 'harvestHandshake',
  Buyer: 'cattleField', Police: 'barnPasture', Institution: 'cropRows', Admin: 'cattleGolden',
};

export const roleHero = (role, opts) => photo(ROLE_HERO[role] || 'cattleGolden', opts);
