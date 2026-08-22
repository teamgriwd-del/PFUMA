// Labels and copy for the vaccination compliance ladder.
// The stage machine itself lives in backend/protocols.py — this file only
// decides how each stage is presented, so a farmer reading a red badge knows
// what actually happens next and what they can do about it.

export const STAGES = {
  reminder: {
    label: 'Reminder',
    short: 'Overdue',
    tone: 'amber',
    farmer: 'This vaccination is past due. Log it when it is done — nothing else happens yet.',
    vet: 'Overdue and still with the farmer. A vet is pulled in automatically after 7 days.',
  },
  vet_followup: {
    label: 'Vet Follow-Up',
    short: 'With vet',
    tone: 'orange',
    farmer: 'A vet has been asked to follow this up with you. Log the vaccination, or tell us what is stopping you.',
    vet: 'Yours to chase. Contact the farmer before issuing anything formal.',
  },
  notice: {
    label: 'Formal Notice',
    short: 'Notice',
    tone: 'red',
    farmer: 'A vet has issued a formal notice. You have until the date below to vaccinate or report a blocker.',
    vet: 'Notice issued. A trade lockout only becomes available once the grace period runs out.',
  },
  penalty: {
    label: 'Trade Lockout',
    short: 'Locked',
    tone: 'red',
    farmer: 'This animal cannot be listed or cleared for sale until the vaccination is logged. Your other animals and produce are not affected.',
    vet: 'Locked out of trade. Lifts automatically the moment the vaccination is recorded.',
  },
  deferred: {
    label: 'Paused — blocker reported',
    short: 'Paused',
    tone: 'blue',
    farmer: 'The clock is paused. No penalty applies while this is being sorted out.',
    vet: 'Farmer reported something stopping them. Accept it, or reject it with a reason.',
  },
  resolved: { label: 'Resolved', short: 'Done', tone: 'green', farmer: 'Vaccination recorded. Case closed.', vet: 'Closed — the shot was logged.' },
  waived:   { label: 'Waived',   short: 'Waived', tone: 'gray', farmer: 'A vet decided this requirement does not apply.', vet: 'Waived by a vet.' },
};

export const TONE = {
  amber:  { chip: 'bg-amber-100 text-amber-700',  card: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-500',  text: 'text-amber-700' },
  orange: { chip: 'bg-orange-100 text-orange-700', card: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', text: 'text-orange-700' },
  red:    { chip: 'bg-red-100 text-red-700',      card: 'bg-red-50 border-red-200',      dot: 'bg-red-500',    text: 'text-red-600' },
  blue:   { chip: 'bg-blue-100 text-blue-700',    card: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500',   text: 'text-blue-700' },
  green:  { chip: 'bg-green-100 text-green-700',  card: 'bg-green-50 border-green-200',  dot: 'bg-green-500',  text: 'text-pfuma-green' },
  gray:   { chip: 'bg-gray-100 text-gray-600',    card: 'bg-gray-50 border-gray-200',    dot: 'bg-gray-400',   text: 'text-gray-500' },
};

// The "I can't comply" reasons. Wording matters here: a farmer who cannot get
// a vaccine has not done anything wrong, and the options have to say so, or
// nobody will use the escape hatch and the ladder will punish supply failures.
export const BLOCKERS = [
  {
    id: 'vaccine_unavailable',
    label: 'The vaccine is not available',
    hint: 'Out of stock at the supplier, agrodealer or DVS office.',
    routes: 'Sent to suppliers in your province as a demand signal.',
  },
  {
    id: 'no_vet_access',
    label: 'No vet has come to my area',
    hint: 'Nobody to administer it, or too far to travel to.',
    routes: 'Raises a vet visit request for your cooperative or ward.',
  },
  {
    id: 'financial_hardship',
    label: 'I cannot afford it right now',
    hint: 'The dose or the visit is beyond what you can pay this month.',
    routes: 'Flagged for a pooled or subsidised vaccination round.',
  },
  {
    id: 'animal_condition',
    label: 'The animal cannot be vaccinated yet',
    hint: 'Pregnant, sick, or too weak to take the dose safely.',
    routes: 'Sent to a vet to judge when it is safe.',
  },
  {
    id: 'other',
    label: 'Something else',
    hint: 'Describe it and a vet will read it.',
    routes: 'Sent to a vet for review.',
  },
];

export const BLOCKER_LABEL = Object.fromEntries(BLOCKERS.map(b => [b.id, b.label]));

export const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
};
