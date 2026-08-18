import React, { useState, useEffect, useCallback } from 'react';
import {
  Handshake, Users, Calendar, Stethoscope, Plus, CheckCircle,
  MapPin, ArrowRight, AlertTriangle, Search, LogOut, Crown,
} from 'lucide-react';

import { API } from '../../config';

const STATUS_BADGE = {
  open:      'bg-gray-100 text-gray-600',
  claimed:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const CreateOrJoin = ({ currentUser, onChanged }) => {
  const [mode, setMode] = useState('browse'); // 'browse' | 'create'
  const [browseList, setBrowseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', dip_tank_location: '',
    district: currentUser?.district || '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/cooperatives?province=${encodeURIComponent(currentUser?.province || '')}`, {
        headers: { Authorization: `Bearer ${currentUser?.token}` },
      });
      if (res.ok) setBrowseList(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser?.province, currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const join = async (coopId) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/cooperatives/${coopId}/join`, {
        method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not join — try again.'); setBusy(false); return; }
      onChanged();
    } catch { setError('Could not reach the PFUMA API.'); setBusy(false); }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/cooperatives`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not create — try again.'); setBusy(false); return; }
      onChanged();
    } catch { setError('Could not reach the PFUMA API.'); setBusy(false); }
  };

  return (
    <div className="p-6 bg-pfuma-cream min-h-full text-left">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Handshake size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Cooperative</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Your Dip Tank or Grazing Group</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Coordinate a shared dip day and request a vet visit for the whole group at once, instead of everyone guessing or messaging separately. Join the one you already share with your neighbors, or start a new one.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-bold">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
          <button onClick={() => setMode('browse')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition ${mode === 'browse' ? 'bg-pfuma-green text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            <Search size={13} className="inline mr-1.5 -mt-0.5" /> Find Mine
          </button>
          <button onClick={() => setMode('create')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition ${mode === 'create' ? 'bg-pfuma-green text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            <Plus size={13} className="inline mr-1.5 -mt-0.5" /> Start New
          </button>
        </div>

        {mode === 'browse' ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-1">Cooperatives in {currentUser?.province || 'your province'}</h3>
            <p className="text-[11px] text-gray-400 font-medium mb-4">If your dip tank association is already here, join it — don't start a duplicate.</p>
            {loading ? (
              <p className="text-xs text-gray-400 font-medium italic text-center py-6">Loading…</p>
            ) : browseList.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
                <Users size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-black text-gray-400">None found yet</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">Be the first to start one for your area.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {browseList.map(c => (
                  <div key={c.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900">{c.name}</p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1"><MapPin size={11} /> {c.district ? `${c.district}, ` : ''}{c.province} · {c.member_count} member{c.member_count !== 1 ? 's' : ''}</p>
                      {c.dip_tank_location && <p className="text-[10px] text-gray-400 font-medium mt-0.5">{c.dip_tank_location}</p>}
                    </div>
                    <button onClick={() => join(c.id)} disabled={busy} className="shrink-0 px-4 py-2 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-50">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={create} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-gray-800 mb-1">Start a new cooperative</h3>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Name *</label>
              <input required placeholder="e.g. Chegutu Dip Tank Association" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-semibold text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Dip Tank / Grazing Location</label>
              <input placeholder="e.g. Chegutu Dip Tank #3" value={form.dip_tank_location} onChange={e => setForm(p => ({ ...p, dip_tank_location: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-semibold text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">District</label>
              <input placeholder="e.g. Zvimba" value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-semibold text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
              <textarea rows={2} placeholder="Optional — who's this for?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-semibold text-sm resize-none" />
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Province is set from your profile: {currentUser?.province || 'not set'}.</p>
            <button type="submit" disabled={busy} className="w-full py-3.5 bg-pfuma-green text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-green-700 transition disabled:opacity-50">
              {busy ? 'Creating…' : 'Create Cooperative'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const CooperativeHome = ({ currentUser, coop, onChanged }) => {
  const [dipSchedule, setDipSchedule] = useState([]);
  const [vetRequests, setVetRequests] = useState([]);
  const [showDipForm, setShowDipForm] = useState(false);
  const [showReqForm, setShowReqForm] = useState(false);
  const [dipForm, setDipForm] = useState({ scheduled_date: '', notes: '' });
  const [reqForm, setReqForm] = useState({ reason: '', preferred_date: '' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isAdmin = coop.members.find(m => m.id === currentUser.id)?.role === 'admin';

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${currentUser.token}` };
    try {
      const res = await fetch(`${API}/cooperatives/${coop.id}/dip-schedule`, { headers });
      if (res.ok) setDipSchedule(await res.json());
    } catch { /* offline */ }
    try {
      const res = await fetch(`${API}/cooperatives/${coop.id}/vet-requests`, { headers });
      if (res.ok) setVetRequests(await res.json());
    } catch { /* offline */ }
  }, [coop.id, currentUser.token]);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(null), 4000); };

  const submitDip = async (e) => {
    e.preventDefault();
    if (!dipForm.scheduled_date) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/cooperatives/${coop.id}/dip-schedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify(dipForm),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Could not schedule.'); setBusy(false); return; }
      setDipForm({ scheduled_date: '', notes: '' }); setShowDipForm(false);
      await load();
      notify('✓ Dip day scheduled for the group.');
    } catch { notify('Could not reach the PFUMA API.'); }
    setBusy(false);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!reqForm.reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/cooperatives/${coop.id}/vet-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify(reqForm),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Could not post request.'); setBusy(false); return; }
      setReqForm({ reason: '', preferred_date: '' }); setShowReqForm(false);
      await load();
      notify('✓ Vet request posted — any verified vet in the province can pick it up.');
    } catch { notify('Could not reach the PFUMA API.'); }
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/cooperatives/${coop.id}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
      onChanged();
    } catch { notify('Could not reach the PFUMA API.'); setBusy(false); }
  };

  return (
    <div className="p-6 bg-pfuma-cream min-h-full space-y-6 text-left overflow-y-auto h-full">
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Handshake size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Cooperative</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">{coop.name}</h2>
            <p className="text-gray-400 text-sm font-medium mb-2">
              {coop.district ? `${coop.district}, ` : ''}{coop.province}{coop.dip_tank_location ? ` · ${coop.dip_tank_location}` : ''} · {coop.members.length} member{coop.members.length !== 1 ? 's' : ''}
            </p>
            <p className="text-gray-500 text-xs font-medium leading-relaxed max-w-lg">
              This is your shared group for the tasks that only make sense done together: agree one dip day below so the whole group shows up on the same day instead of coordinating by word of mouth, and post a vet request that any verified vet in {coop.province} can pick up for a single group visit — cheaper and faster than everyone booking their own.
            </p>
          </div>
          <button onClick={leave} disabled={busy} className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase transition disabled:opacity-50">
            <LogOut size={12} /> Leave
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs font-black px-4 py-3 rounded-xl" role="status">
          <CheckCircle size={14} /> {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-1 flex items-center gap-2"><Users size={15} className="text-pfuma-green" /> Members</h3>
          <p className="text-[10px] text-gray-400 font-medium mb-3">Everyone sharing this dip tank / grazing group, and how many animals each of them has registered.</p>
          <div className="space-y-2.5">
            {coop.members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-pfuma-green flex items-center justify-center text-white font-black text-[10px] shrink-0">
                  {(m.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-gray-800 truncate flex items-center gap-1">
                    {m.full_name} {m.role === 'admin' && <Crown size={11} className="text-pfuma-gold" />}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">{m.animal_count} animal{m.animal_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dip schedule */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><Calendar size={15} className="text-blue-500" /> Dip Schedule</h3>
            {isAdmin && <button onClick={() => setShowDipForm(p => !p)} className="text-[10px] font-black text-pfuma-green hover:underline uppercase">+ Add</button>}
          </div>
          <p className="text-[10px] text-gray-400 font-medium mb-3">
            {isAdmin ? 'One shared dip date visible to every member — you set it since you admin this group.' : 'The next agreed dip day for the whole group, set by your group admin.'}
          </p>
          {showDipForm && (
            <form onSubmit={submitDip} className="mb-4 space-y-2 bg-gray-50 rounded-xl p-3">
              <input required type="date" min={new Date().toISOString().slice(0, 10)} value={dipForm.scheduled_date} onChange={e => setDipForm(p => ({ ...p, scheduled_date: e.target.value }))}
                className="w-full p-2.5 bg-white rounded-lg border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-bold" />
              <input placeholder="Notes (optional)" value={dipForm.notes} onChange={e => setDipForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full p-2.5 bg-white rounded-lg border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-bold" />
              <button type="submit" disabled={busy} className="w-full py-2 bg-pfuma-green text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-50">Save</button>
            </form>
          )}
          {dipSchedule.length === 0 ? (
            <p className="text-[11px] text-gray-400 font-medium italic text-center py-4">No dip day scheduled yet.</p>
          ) : (
            <div className="space-y-2.5">
              {dipSchedule.map(d => (
                <div key={d.id} className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-black text-gray-800">{new Date(d.scheduled_date).toDateString()}</p>
                  {d.notes && <p className="text-[10px] text-gray-500 font-medium mt-0.5">{d.notes}</p>}
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Set by {d.created_by_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vet requests */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><Stethoscope size={15} className="text-pfuma-gold" /> Vet Requests</h3>
            <button onClick={() => setShowReqForm(p => !p)} className="text-[10px] font-black text-pfuma-green hover:underline uppercase">+ Request</button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mb-3">Post once for the whole group — any verified vet in {coop.province} can claim it and see it as "open" until they do.</p>
          {showReqForm && (
            <form onSubmit={submitRequest} className="mb-4 space-y-2 bg-gray-50 rounded-xl p-3">
              <input required placeholder="What's needed? e.g. Group health check on dip day" value={reqForm.reason} onChange={e => setReqForm(p => ({ ...p, reason: e.target.value }))}
                className="w-full p-2.5 bg-white rounded-lg border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-bold" />
              <input type="date" min={new Date().toISOString().slice(0, 10)} value={reqForm.preferred_date} onChange={e => setReqForm(p => ({ ...p, preferred_date: e.target.value }))}
                className="w-full p-2.5 bg-white rounded-lg border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-bold" />
              <button type="submit" disabled={busy} className="w-full py-2 bg-pfuma-green text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-50">Post</button>
            </form>
          )}
          {vetRequests.length === 0 ? (
            <p className="text-[11px] text-gray-400 font-medium italic text-center py-4">No vet requests yet.</p>
          ) : (
            <div className="space-y-2.5">
              {vetRequests.map(r => (
                <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-black text-gray-800 leading-snug">{r.reason}</p>
                    <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">By {r.requested_by_name}{r.preferred_date ? ` · wants ${new Date(r.preferred_date).toDateString()}` : ''}</p>
                  {r.vet_name && <p className="text-[10px] text-gray-400 font-medium">Vet: {r.vet_name}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Cooperative = ({ currentUser }) => {
  const [coop, setCoop] = useState(undefined); // undefined = loading, null = none

  const load = useCallback(async () => {
    if (!currentUser?.token) return;
    try {
      const res = await fetch(`${API}/cooperatives/mine`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) setCoop(await res.json());
      else setCoop(null);
    } catch { setCoop(null); }
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  if (coop === undefined) {
    return <div className="p-10 text-center text-sm text-gray-400 font-medium">Loading…</div>;
  }

  return coop
    ? <CooperativeHome currentUser={currentUser} coop={coop} onChanged={load} />
    : <CreateOrJoin currentUser={currentUser} onChanged={load} />;
};

export default Cooperative;
