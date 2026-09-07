// ── PFUMA imagery ──────────────────────────────────────────────────────────
//
// Every photograph in the product resolves through this one module, so the
// whole library can be repointed at self-hosted assets later by editing
// `photo()` alone — no component needs to know where an image comes from.
//
// To move off Unsplash: drop the files into `public/photos/`, then change
// `photo()` to `return `/photos/${id}.jpg``. The IDs below are already
// descriptive enough to name the files after.
//
// Each ID here was visually confirmed to be the subject it is labelled as —
// a mislabelled photo (a pig card headed "Cattle") is worse than no photo.

const UNSPLASH = 'https://images.unsplash.com/photo-';

/**
 * Build a sized, cropped image URL.
 *
 * @param {string} id  key from PHOTOS below
 * @param {object} opts
 * @param {number} opts.w    intrinsic width to request (default 1200)
 * @param {number} opts.q    JPEG quality 1-100 (default 72 — these sit under
 *                           a heavy scrim or at card size, so the extra
 *                           bytes of q=80+ buy nothing visible)
 * @param {string} opts.crop focal hint passed through to the CDN
 */
export function photo(id, { w = 1200, q = 72, crop = 'entropy' } = {}) {
  const src = PHOTOS[id];
  if (!src) return '';
  return `${UNSPLASH}${src}?auto=format&fit=crop&crop=${crop}&w=${w}&q=${q}`;
}

// Raw CDN ids. Names describe the subject, not the usage, so one photo can
// be reused in several places without its name lying about what it shows.
const PHOTOS = {
  cattleCloseup:   '1546445317-29f4545e9d53', // cow head-on, shallow depth
  cattleGolden:    '1500595046743-cd271d694d30', // herd at golden hour, wide
  cattleField:     '1570042225831-d98fa7577f1e', // dairy cow standing in pasture
  goat:            '1524024973431-2ad916746881', // white goat, green background
  sheep:           '1484557985045-edf25e08da73', // sheep flock, one facing camera
  pig:             '1516467508483-a7212febe31a', // piglet on straw
  poultry:         '1548550023-2bdb3c5beed7',   // brown hens
  barnPasture:     '1444858291040-58f756a3bdd6', // red barn, fenced pasture
  cropRows:        '1560493676-04071c5f467b',   // ploughed rows to horizon
  harvestHandshake:'1500937386664-56d1dfef3854', // two people, wheat field
  pastureTexture:  '1592982537447-7440770cbfc9', // green field, close texture
};

// ── Species ──
// Keyed to match the species strings the backend already stores. Poultry has
// no registry support yet but the photo is here so adding the species later
// is a data change, not a design change.
export const SPECIES_PHOTO = {
  Cattle: 'cattleCloseup',
  Goat:   'goat',
  Sheep:  'sheep',
  Pig:    'pig',
  Poultry:'poultry',
};

/** Stock photo for an animal whose owner has not uploaded one. */
export const speciesPhoto = (species, opts) =>
  photo(SPECIES_PHOTO[species] || 'cattleCloseup', opts);

// ── Role hero imagery ──
// Each role's dashboard opens on a photograph chosen for what that role
// actually does, not for decoration: the vet gets an animal close enough to
// examine, the supplier gets a trade handshake, Police get the open land
// they police.
export const ROLE_HERO = {
  Farmer:       'cattleGolden',
  Veterinarian: 'cattleCloseup',
  Supplier:     'harvestHandshake',
  Buyer:        'cattleField',
  Police:       'barnPasture',
  Institution:  'cropRows',
  Admin:        'cattleGolden',
};

export const roleHero = (role, opts) =>
  photo(ROLE_HERO[role] || 'cattleGolden', opts);

// The sign-in hero. A herd in low golden light — the one image a first-time
// user sees, and the closest match to the brand's warm/earthy direction.
export const AUTH_HERO = 'cattleGolden';
