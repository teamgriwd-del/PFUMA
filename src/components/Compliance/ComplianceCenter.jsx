import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, Syringe, Clock, Lock, Unlock, HandHelping,
  AlertTriangle, CheckCircle, PauseCircle, FileWarning, ChevronDown, Loader2,
} from 'lucide-react';

import { API } from '../../config';
import { STAGES, TONE, BLOCKERS, BLOCKER_LABEL, daysUntil } from './complianceData';

// ── SHARED BITS ────────────────────────────────────────────────────────────

const StageChip = ({ stage }) => {
  const meta = STAGES[stage] || STAGES.reminder;
  const tone = TONE[meta.tone];
  return (
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${tone.chip}`}>
      {meta.short}
    </span>
  );
};

const CaseHeader = ({ c }) => (
  <div className="flex items-start gap-3 min-w-0">
    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
      <Syringe size={18} className={TONE[(STAGES[c.stage] || STAGES.reminder).tone].text} />
    </div>
    <div className="min-w-0">
      <p className="font-black text-gray-800 text-sm leading-tight">{c.vaccine_name}</p>
      <p className="text-[11px] text-gray-500 font-bold mt-0.5">
        {c.animal_name}{c.tag_id ? ` · ${c.tag_id}` : ''} · due {new Date(c.due_date).toLocaleDateString()}
      </p>
    </div>
  </div>
);

// A case's full paper trail. A lockout that can't be explained afterwards
// can't be disputed either, so this is always available, to both sides.
const ActionTrail = ({ actions = [] }) => {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-gray-200/70">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600"
      >
        <ChevronDown size={12} className={`transition ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'Show'} full record ({actions.length})
      </button>
      {open && (
        <ol className="mt-3 space-y-2.5">
          {actions.map(a => (
            <li key={a.id} className="flex gap-2.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-700 capitalize">{a.action.replace(/_/g, ' ')}</p>
                {a.notes && <p className="text-gray-500 font-medium leading-snug">{a.notes}</p>}
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">
                  {a.actor_name || 'PFUMA (automatic)'} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// ── FARMER: "I CAN'T COMPLY" ───────────────────────────────────────────────

const BlockerForm = ({ caseId, currentUser, onDone, onCancel }) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) { setError('Pick what is stopping you.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/compliance/cases/${caseId}/defer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ reason, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not send this — try again.'); setBusy(false); return; }
      onDone(data);
    } catch {
      setError('Could not reach the PFUMA API. Try again when you have signal.');
      setBusy(false);
    }
  };

  const picked = BLOCKERS.find(b => b.id === reason);

  return (
    <form onSubmit={submit} className="mt-3 p-4 bg-white rounded-2xl border border-gray-200">
      <p className="text-xs font-black text-gray-800 mb-1">What is stopping you?</p>
      <p className="text-[11px] text-gray-500 font-medium mb-3 leading-snug">
        This is not a penalty and it does not count against you. It pauses the clock and sends
        the problem to whoever can fix it.
      </p>
      <div className="space-y-2">
        {BLOCKERS.map(b => (
          <label
            key={b.id}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
              reason === b.id ? 'border-pfuma-green bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <input
              type="radio" name={`blocker-${caseId}`} value={b.id}
              checked={reason === b.id} onChange={() => setReason(b.id)}
              className="mt-0.5 accent-pfuma-green"
            />
            <span className="min-w-0">
              <span className="block text-xs font-black text-gray-800">{b.label}</span>
              <span className="block text-[11px] text-gray-500 font-medium leading-snug">{b.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {picked && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-2.5">
          <HandHelping size={13} className="mt-0.5 shrink-0" />
          {picked.routes}
        </p>
      )}

      <textarea
        value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder="Anything else the vet should know (optional)"
        className="mt-3 w-full text-xs font-medium border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-pfuma-green"
      />

      {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}

      <div className="flex gap-2 mt-3">
        <button
          type="submit" disabled={busy}
          className="flex-1 bg-pfuma-green text-white text-xs font-black uppercase tracking-wider py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          Send this to my vet
        </button>
        <button type="button" onClick={onCancel} className="px-4 text-xs font-black uppercase tracking-wider text-gray-400">
          Cancel
        </button>
      </div>
    </form>
  );
};

const FarmerCase = ({ c, currentUser, onChanged }) => {
  const [showBlocker, setShowBlocker] = useState(false);
  const [flash, setFlash] = useState('');
  const meta = STAGES[c.stage] || STAGES.reminder;
  const tone = TONE[meta.tone];
  const graceLeft = daysUntil(c.stage_due);
  const pauseLeft = daysUntil(c.deferred_until);

  return (
    <div className={`p-4 rounded-2xl border ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <CaseHeader c={c} />
        <StageChip stage={c.stage} />
      </div>

      <p className={`text-[11px] font-bold mt-3 leading-snug ${tone.text}`}>{meta.farmer}</p>

      {c.stage === 'notice' && graceLeft !== null && graceLeft >= 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-red-600">
          <Clock size={12} /> {graceLeft} day{graceLeft === 1 ? '' : 's'} left to act
        </p>
      )}
      {c.stage === 'deferred' && pauseLeft !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-blue-700">
          <PauseCircle size={12} /> Paused for {Math.max(pauseLeft, 0)} more day{pauseLeft === 1 ? '' : 's'}
          {c.blocker_reason ? ` · ${BLOCKER_LABEL[c.blocker_reason]}` : ''}
        </p>
      )}
      {c.stage === 'penalty' && (
        <div className="mt-3 p-3 bg-white rounded-xl border border-red-200">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-red-600 mb-1">
            <Lock size={12} /> {c.animal_name} cannot be sold right now
          </p>
          <p className="text-[11px] text-gray-600 font-medium leading-snug">
            {c.conditional_clearance
              ? 'Your vet has granted a conditional clearance — you may sell provided the animal is vaccinated at the point of sale.'
              : 'Log the vaccination and the lockout lifts immediately. If you cannot get the vaccine, tell us below — the lockout is not meant for that.'}
          </p>
        </div>
      )}

      {flash && <p className="mt-3 text-[11px] font-bold text-pfuma-green bg-green-50 border border-green-200 rounded-xl p-2.5">{flash}</p>}

      {!showBlocker && !['resolved', 'waived'].includes(c.stage) && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setShowBlocker(true)}
            className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-gray-600 hover:border-pfuma-green hover:text-pfuma-green transition"
          >
            I can't vaccinate — here's why
          </button>
          <span className="px-3 py-2 text-[11px] font-bold text-gray-400 self-center">
            or log it under Lifecycle → Health Schedule
          </span>
        </div>
      )}

      {showBlocker && (
        <BlockerForm
          caseId={c.id} currentUser={currentUser}
          onCancel={() => setShowBlocker(false)}
          onDone={(data) => { setShowBlocker(false); setFlash(data.message); onChanged(); }}
        />
      )}

      <ActionTrail actions={c.actions} />
    </div>
  );
};

// ── VET: FOLLOW-UP QUEUE ───────────────────────────────────────────────────

const VetCase = ({ c, currentUser, onChanged }) => {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const meta = STAGES[c.stage] || STAGES.reminder;
  const tone = TONE[meta.tone];
  const graceLeft = daysUntil(c.stage_due);

  const act = async (action, extra = {}) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/compliance/cases/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ action, notes, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not update this case.'); setBusy(false); return; }
      setNotes(''); setBusy(false); onChanged();
    } catch { setError('Could not reach the PFUMA API.'); setBusy(false); }
  };

  // A lockout is only offered once a notice has actually expired — the button
  // is absent, not just disabled, before that, so it never reads as the
  // default next step.
  const lockoutReady = c.stage === 'notice' && (graceLeft === null || graceLeft < 0);

  return (
    <div className={`p-4 rounded-2xl border ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <CaseHeader c={c} />
        <StageChip stage={c.stage} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500">
        <span>{c.owner_name}</span>
        {c.owner_phone && <span>{c.owner_phone}</span>}
        <span>{[c.district, c.province].filter(Boolean).join(', ')}</span>
        {c.vet_name && <span className="text-pfuma-green">Handled by {c.vet_name}</span>}
      </div>

      <p className={`text-[11px] font-bold mt-2 leading-snug ${tone.text}`}>{meta.vet}</p>

      {c.blocker_reason && (
        <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 mb-1">
            <HandHelping size={12} /> Farmer reported: {BLOCKER_LABEL[c.blocker_reason]}
          </p>
          {c.blocker_notes && <p className="text-[11px] text-gray-600 font-medium leading-snug">"{c.blocker_notes}"</p>}
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">
            Routed to {String(c.routed_to || '').replace(/_/g, ' ')} · {c.defer_count} report{c.defer_count === 1 ? '' : 's'} on this case
          </p>
        </div>
      )}

      {c.stage === 'notice' && graceLeft !== null && graceLeft >= 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-gray-500">
          <Clock size={12} /> Grace period ends in {graceLeft} day{graceLeft === 1 ? '' : 's'} — no lockout before then
        </p>
      )}

      {!['resolved', 'waived'].includes(c.stage) && (
        <>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="What you found on follow-up — recorded on the case and visible to the farmer"
            className="mt-3 w-full text-xs font-medium border border-gray-200 rounded-xl p-3 bg-white focus:outline-none focus:border-pfuma-green"
          />
          {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 mt-2">
            {!c.vet_id && (
              <button onClick={() => act('claim')} disabled={busy}
                className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-gray-600 hover:border-pfuma-green disabled:opacity-50">
                Take this on
              </button>
            )}
            {c.blocker_reason && (
              <>
                <button onClick={() => act('accept_deferral')} disabled={busy}
                  className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-50">
                  Accept blocker — pause
                </button>
                <button onClick={() => act('reject_deferral')} disabled={busy}
                  className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-gray-600 disabled:opacity-50">
                  Reject blocker
                </button>
              </>
            )}
            {['reminder', 'vet_followup', 'deferred'].includes(c.stage) && (
              <button onClick={() => act('issue_notice')} disabled={busy}
                className="px-3 py-2 bg-red-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5">
                <FileWarning size={12} /> Issue formal notice
              </button>
            )}
            {lockoutReady && (
              <button onClick={() => act('apply_lockout', { blocker_reviewed: !c.blocker_reason })} disabled={busy}
                className="px-3 py-2 bg-gray-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5">
                <Lock size={12} /> Apply trade lockout
              </button>
            )}
            {c.stage === 'penalty' && !c.conditional_clearance && (
              <button onClick={() => act('conditional_clearance')} disabled={busy}
                className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-gray-600 disabled:opacity-50 flex items-center gap-1.5">
                <Unlock size={12} /> Allow sale with vaccination at point of sale
              </button>
            )}
            <button onClick={() => act('waive')} disabled={busy}
              className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-600 disabled:opacity-50">
              Doesn't apply — waive
            </button>
          </div>
        </>
      )}

      <ActionTrail actions={c.actions} />
    </div>
  );
};

// ── CENTER ─────────────────────────────────────────────────────────────────

const ComplianceCenter = ({ currentUser }) => {
  const isVet = currentUser?.role === 'Veterinarian';
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    if (!currentUser?.token) return;
    setLoading(true);
    try {
      const qs = filter === 'all' ? '?include_resolved=true' : '';
      const res = await fetch(`${API}/compliance/cases${qs}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) { setCases(await res.json()); setOffline(false); }
      else setOffline(true);
    } catch { setOffline(true); }
    setLoading(false);
  }, [currentUser?.token, filter]);

  useEffect(() => { load(); }, [load]);

  const byStage = (s) => cases.filter(c => c.stage === s);
  const locked = cases.filter(c => c.trade_locked && !c.conditional_clearance);
  const needsVet = cases.filter(c => ['vet_followup', 'notice'].includes(c.stage) || c.blocker_reason);

  const Stat = ({ icon: Icon, label, value, tone }) => (
    <div className={`p-4 rounded-2xl border ${TONE[tone].card}`}>
      <Icon size={16} className={TONE[tone].text} />
      <p className={`text-2xl font-black mt-2 leading-none ${TONE[tone].text}`}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">{label}</p>
    </div>
  );

  return (
    <div className="p-6 bg-pfuma-cream min-h-full text-left">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Vaccination Compliance</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">
              {isVet ? 'Follow-Up Queue' : 'Your Vaccination Follow-Ups'}
            </h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              {isVet
                ? 'Animals whose mandatory vaccinations are overdue in your province. The system flags and reminds; issuing a notice or a trade lockout is your decision, never an automatic one.'
                : 'A missed mandatory vaccination opens a case here. Log the shot and it closes itself. If something is stopping you — no vaccine in stock, no vet nearby, no money this month — say so and the clock pauses with no penalty.'}
            </p>
          </div>
        </div>

        {!isVet && (
          <div className="p-4 bg-white rounded-2xl border border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">How this works</p>
            <ol className="space-y-1.5 text-[11px] font-medium text-gray-600">
              <li><b className="text-gray-800">1. Reminder</b> — you have a week to log it yourself. Nothing else happens.</li>
              <li><b className="text-gray-800">2. Vet follow-up</b> — a vet in your province is asked to reach you.</li>
              <li><b className="text-gray-800">3. Formal notice</b> — a vet issues it after speaking to you, with 14 days to act.</li>
              <li><b className="text-gray-800">4. Trade lockout</b> — that <i>one animal</i> can't be sold until the shot is logged. No fine, ever. Your other stock, feed and produce keep trading.</li>
            </ol>
            <p className="mt-2.5 text-[11px] font-bold text-pfuma-green leading-snug">
              At any stage, "I can't vaccinate" pauses everything. Reporting a real blocker is not an offence — it's how the vaccine gets to you.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={AlertTriangle} label="Open cases" value={cases.filter(c => !['resolved', 'waived'].includes(c.stage)).length} tone="amber" />
          <Stat icon={ShieldAlert}   label={isVet ? 'Need your action' : 'With a vet'} value={needsVet.length} tone="orange" />
          <Stat icon={PauseCircle}   label="Paused (blocker)" value={byStage('deferred').length} tone="blue" />
          <Stat icon={Lock}          label="Trade locked" value={locked.length} tone="red" />
        </div>

        <div className="flex gap-2">
          {[{ id: 'open', label: 'Open' }, { id: 'all', label: 'Including closed' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                filter === f.id ? 'bg-pfuma-green text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-bold">Checking vaccination records…</span>
          </div>
        ) : offline ? (
          <div className="p-6 bg-white rounded-2xl border border-gray-100 text-center">
            <AlertTriangle size={24} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs font-black text-gray-500">Could not reach the PFUMA API.</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">Compliance cases are held on the server — reconnect to see them.</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-10 bg-white rounded-2xl border border-gray-100 text-center">
            <ShieldCheck size={28} className="mx-auto text-green-500 mb-2" />
            <p className="text-sm font-black text-gray-700">
              {isVet ? 'No overdue vaccinations in your province.' : 'Every mandatory vaccination is up to date.'}
            </p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              {isVet ? 'Cases appear here as soon as a herd falls behind.' : 'Nothing to follow up. Keep logging each shot as you give it.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => isVet
              ? <VetCase    key={c.id} c={c} currentUser={currentUser} onChanged={load} />
              : <FarmerCase key={c.id} c={c} currentUser={currentUser} onChanged={load} />)}
          </div>
        )}

        {!isVet && cases.some(c => c.stage === 'resolved') && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-pfuma-green">
            <CheckCircle size={12} /> Closed cases stay on the animal's lifecycle record as proof of vaccination.
          </p>
        )}
      </div>
    </div>
  );
};

export default ComplianceCenter;
