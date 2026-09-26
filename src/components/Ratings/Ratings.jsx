import React, { useState, useEffect, useCallback } from 'react';
import { X, Star, ShieldCheck, Handshake, Calendar, BadgeCheck, MessageSquare } from 'lucide-react';

import { API } from '../../config';

// Trust ratings between trading parties. Every rating is tied to a real
// completed deal on the platform (backend enforces it — see _rateable_deals
// in backend/app.py), and the average only shows once a user has at least
// `min_ratings_for_average` ratings, so one review can't define an account.

const CONTEXT_LABEL = { sale: 'Livestock sale', order: 'Supply order', vet_request: 'Vet visit', transfer: 'Animal transfer' };

export const Stars = ({ value, size = 12 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={size} className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
    ))}
  </span>
);

// Compact "★ 4.6 (12)" badge; shows "New" (with the count so far) until the
// user has enough ratings for an average to be published.
export const RatingBadge = ({ rating, onClick }) => {
  const count = rating?.count || 0;
  const body = rating?.average != null ? (
    <><Star size={11} className="text-amber-400 fill-amber-400" /><span className="font-bold text-gray-800">{rating.average.toFixed(1)}</span><span className="text-gray-400">({count})</span></>
  ) : (
    <span className="text-gray-400">{count ? `New · ${count} rating${count !== 1 ? 's' : ''}` : 'No ratings yet'}</span>
  );
  const cls = 'inline-flex items-center gap-1 text-xs font-medium';
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:underline`}>{body}</button>
    : <span className={cls}>{body}</span>;
};

const StarPicker = ({ value, onChange }) => (
  <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
    {[1, 2, 3, 4, 5].map(i => (
      <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i !== 1 ? 's' : ''}`}
        onClick={() => onChange(i)} className="p-0.5">
        <Star size={22} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
      </button>
    ))}
  </div>
);

// Full trust profile for one user: stars, platform-verified signals, and
// recent reviews. When the viewer is the rated user, each review gets a
// one-time public reply box.
export const TrustProfileModal = ({ userId, name, currentUser, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const isSelf = currentUser?.id === userId;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/${userId}/ratings`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) setData(await res.json());
      else setError('Ratings are not available for this account.');
    } catch { setError('Could not reach the PFUMA/INGCEBO API.'); }
  }, [userId, currentUser.token]);

  useEffect(() => { load(); }, [load]);

  const postReply = async (ratingId) => {
    const reply = (replyDrafts[ratingId] || '').trim();
    if (!reply) return;
    setBusyId(ratingId);
    try {
      const res = await fetch(`${API}/ratings/${ratingId}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ reply }),
      });
      if (res.ok) await load();
    } catch { /* offline */ }
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-2 z-10">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{isSelf ? 'Your trust profile' : name}</h3>
            <p className="text-xs text-gray-400 font-medium">Ratings come only from completed deals on PFUMA/INGCEBO</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 transition shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {error && <p className="text-xs text-gray-500 font-medium">{error}</p>}
          {!data && !error && <p className="text-xs text-gray-400 font-medium italic">Loading…</p>}
          {data && (
            <>
              <div className="flex items-center gap-4">
                {data.average != null ? (
                  <>
                    <p className="text-4xl font-extrabold text-gray-900 leading-none">{data.average.toFixed(1)}</p>
                    <div>
                      <Stars value={data.average} size={16} />
                      <p className="text-xs text-gray-500 font-medium mt-1">{data.count} rating{data.count !== 1 ? 's' : ''}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 font-medium">
                    {data.count ? `${data.count} rating${data.count !== 1 ? 's' : ''} so far` : 'No ratings yet'} — an average is shown after {data.min_ratings_for_average} ratings.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Signal icon={BadgeCheck} label="Identity" value={data.verified ? 'Verified' : 'Pending verification'} good={data.verified} />
                <Signal icon={Handshake} label="Completed deals" value={data.completed_trades} good={data.completed_trades > 0} />
                <Signal icon={Calendar} label="Member since" value={data.member_since ? new Date(`${data.member_since}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'} />
                {data.clearance_pass_rate != null && (
                  <Signal icon={ShieldCheck} label="Police clearance" value={`${data.clearance_pass_rate}% cleared (${data.clearances_cleared})`} good={data.clearance_pass_rate >= 80} />
                )}
              </div>

              <section>
                <h4 className="text-xs font-bold text-pfuma-green uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">Reviews</h4>
                {data.reviews.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No reviews yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.reviews.map(r => (
                      <div key={r.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Stars value={r.stars} />
                          <p className="text-[0.6875rem] text-gray-400 font-medium">{CONTEXT_LABEL[r.context_type]} · {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        {r.comment && <p className="text-xs text-gray-700 font-medium mt-1.5">{r.comment}</p>}
                        <p className="text-[0.6875rem] text-gray-400 font-medium mt-1">— {r.rater_name}, {r.rater_role}</p>
                        {r.reply && (
                          <div className="mt-2 ml-3 pl-3 border-l-2 border-gray-200">
                            <p className="text-[0.6875rem] font-bold text-gray-500 uppercase">Reply</p>
                            <p className="text-xs text-gray-600 font-medium">{r.reply}</p>
                          </div>
                        )}
                        {isSelf && !r.reply && (
                          <div className="mt-2 flex gap-2">
                            <input value={replyDrafts[r.id] || ''} onChange={e => setReplyDrafts(p => ({ ...p, [r.id]: e.target.value }))}
                              maxLength={500} placeholder="Reply publicly (once)…"
                              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-pfuma-green/30" />
                            <button onClick={() => postReply(r.id)} disabled={busyId === r.id || !(replyDrafts[r.id] || '').trim()}
                              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-40">
                              <MessageSquare size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Signal = ({ icon: Icon, label, value, good }) => (
  <div className="rounded-xl bg-gray-50 px-3 py-2">
    <p className="text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1"><Icon size={11} /> {label}</p>
    <p className={`text-xs font-bold mt-0.5 ${good ? 'text-green-700' : 'text-gray-700'}`}>{value}</p>
  </div>
);

const RATEABLE_ROLES = ['Farmer', 'Buyer', 'Supplier', 'Veterinarian'];

// Dashboard card: your own rating at a glance, plus a "rate this deal"
// prompt for every completed deal you haven't rated yet.
export const RatingsDashboardCard = ({ currentUser }) => {
  const [pending, setPending] = useState([]);
  const [mine, setMine] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const eligible = RATEABLE_ROLES.includes(currentUser?.role);

  const load = useCallback(async () => {
    if (!eligible) return;
    const headers = { Authorization: `Bearer ${currentUser.token}` };
    try {
      const [p, m] = await Promise.all([
        fetch(`${API}/ratings/pending`, { headers }),
        fetch(`${API}/users/${currentUser.id}/ratings`, { headers }),
      ]);
      if (p.ok) setPending(await p.json());
      if (m.ok) setMine(await m.json());
    } catch { /* offline — card just stays empty */ }
  }, [eligible, currentUser?.id, currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  if (!eligible) return null;

  const submit = async (deal) => {
    const key = `${deal.context_type}-${deal.context_id}`;
    const draft = drafts[key] || {};
    if (!draft.stars) return;
    setBusyKey(key); setError(null);
    try {
      const res = await fetch(`${API}/ratings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ context_type: deal.context_type, context_id: deal.context_id, stars: draft.stars, comment: draft.comment || '' }),
      });
      if (!res.ok) setError((await res.json()).error || 'Could not save your rating.');
      await load();
    } catch { setError('Could not reach the PFUMA/INGCEBO API.'); }
    setBusyKey(null);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-amber-400 fill-amber-400" />
          <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Your trust rating</p>
          {mine && <RatingBadge rating={mine} />}
        </div>
        <button onClick={() => setShowProfile(true)} className="text-xs font-bold text-pfuma-green hover:underline">View reviews</button>
      </div>

      {pending.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium">Rate your recent deals — ratings help honest traders stand out.</p>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          {pending.map(deal => {
            const key = `${deal.context_type}-${deal.context_id}`;
            const draft = drafts[key] || {};
            return (
              <div key={key} className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-gray-900">{deal.counterparty_name} <span className="text-gray-400 font-medium">· {deal.counterparty_role}</span></p>
                <p className="text-[0.6875rem] text-gray-400 font-medium">{CONTEXT_LABEL[deal.context_type]}: {deal.label}{deal.completed_at ? ` · ${new Date(deal.completed_at).toLocaleDateString()}` : ''}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StarPicker value={draft.stars || 0} onChange={s => setDrafts(p => ({ ...p, [key]: { ...draft, stars: s } }))} />
                  <input value={draft.comment || ''} onChange={e => setDrafts(p => ({ ...p, [key]: { ...draft, comment: e.target.value } }))}
                    maxLength={500} placeholder="Optional comment"
                    className="flex-1 min-w-[10rem] px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-pfuma-green/30" />
                  <button onClick={() => submit(deal)} disabled={!draft.stars || busyKey === key}
                    className="px-3 py-1.5 rounded-lg bg-pfuma-green text-white text-xs font-bold disabled:opacity-40">
                    {busyKey === key ? 'Saving…' : 'Submit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showProfile && <TrustProfileModal userId={currentUser.id} currentUser={currentUser} onClose={() => { setShowProfile(false); load(); }} />}
    </div>
  );
};
