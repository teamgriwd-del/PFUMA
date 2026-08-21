import React, { useState, useEffect, useMemo } from 'react';
import {
  Syringe, Stethoscope, Wheat, Weight, Tag, Baby, Store, ShieldAlert,
  Droplets, Pill, HeartPulse, Radio, Loader2, AlertTriangle, Calendar,
} from 'lucide-react';

import { API } from '../../config';

// One animal's whole life in date order — born, registered, every shot,
// every illness, every ration, every weighing, every step through the market.
// The backend assembles it from the eight tables it actually lives in; this
// just has to make it readable at a glance.

const KINDS = {
  birth:        { label: 'Born',         icon: Baby,         color: 'text-pink-600',   bg: 'bg-pink-50',   ring: 'border-pink-200' },
  registration: { label: 'Registered',   icon: Tag,          color: 'text-pfuma-green', bg: 'bg-green-50',  ring: 'border-green-200' },
  vaccine:      { label: 'Vaccination',  icon: Syringe,      color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'border-blue-200' },
  treatment:    { label: 'Treatment',    icon: Pill,         color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'border-indigo-200' },
  dipping:      { label: 'Dipping',      icon: Droplets,     color: 'text-cyan-600',   bg: 'bg-cyan-50',   ring: 'border-cyan-200' },
  illness:      { label: 'Illness',      icon: Stethoscope,  color: 'text-red-600',    bg: 'bg-red-50',    ring: 'border-red-200' },
  feed:         { label: 'Nutrition',    icon: Wheat,        color: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'border-amber-200' },
  weight:       { label: 'Weight',       icon: Weight,       color: 'text-gray-600',   bg: 'bg-gray-100',  ring: 'border-gray-200' },
  breeding:     { label: 'Breeding',     icon: HeartPulse,   color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', ring: 'border-fuchsia-200' },
  vet:          { label: 'Vet',          icon: Stethoscope,  color: 'text-teal-600',   bg: 'bg-teal-50',   ring: 'border-teal-200' },
  compliance:   { label: 'Compliance',   icon: ShieldAlert,  color: 'text-orange-600', bg: 'bg-orange-50', ring: 'border-orange-200' },
  trade:        { label: 'Market',       icon: Store,        color: 'text-purple-600', bg: 'bg-purple-50', ring: 'border-purple-200' },
  alert:        { label: 'Alert',        icon: Radio,        color: 'text-red-600',    bg: 'bg-red-50',    ring: 'border-red-200' },
  other:        { label: 'Record',       icon: Calendar,     color: 'text-gray-500',   bg: 'bg-gray-100',  ring: 'border-gray-200' },
};

// Filter buttons, in the order a farmer thinks about them.
const FILTERS = [
  { id: 'all',        label: 'Everything', kinds: null },
  { id: 'health',     label: 'Vaccines & treatment', kinds: ['vaccine', 'treatment', 'dipping'] },
  { id: 'illness',    label: 'Illness',    kinds: ['illness', 'vet', 'alert'] },
  { id: 'feed',       label: 'Feeding',    kinds: ['feed'] },
  { id: 'growth',     label: 'Growth',     kinds: ['weight', 'birth', 'breeding'] },
  { id: 'compliance', label: 'Compliance', kinds: ['compliance'] },
  { id: 'trade',      label: 'Ownership & trade', kinds: ['trade', 'registration'] },
];

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// Age of the animal on the day the event happened — the thing that turns a
// list of dates into a life story ("vaccinated at 6 months").
const ageAt = (iso, birthDate) => {
  if (!birthDate) return null;
  const d = new Date(iso), b = new Date(birthDate);
  if (Number.isNaN(d.getTime()) || Number.isNaN(b.getTime()) || d < b) return null;
  const days = Math.floor((d - b) / 86400000);
  if (days < 31) return `${days}d old`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months}mo old`;
  return `${Math.floor(months / 12)}y ${months % 12}mo old`;
};

const LifecycleTimeline = ({ animalId, currentUser }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    let cancelled = false;
    if (!animalId || !currentUser?.token) return undefined;
    setLoading(true); setError('');
    (async () => {
      try {
        const res = await fetch(`${API}/animals/${animalId}/timeline`, {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(body.error || 'Could not load this animal\'s record.');
        else setData(body);
      } catch {
        if (!cancelled) setError('Could not reach the PFUMA API — the lifecycle record is held on the server.');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [animalId, currentUser?.token]);

  const events = data?.events || [];
  const birthDate = data?.animal?.birth_date;

  const counts = useMemo(() => {
    const c = {};
    events.forEach(e => { c[e.kind] = (c[e.kind] || 0) + 1; });
    return c;
  }, [events]);

  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter);
    if (!f?.kinds) return events;
    return events.filter(e => f.kinds.includes(e.kind));
  }, [events, filter]);

  // Group by year so a long-lived animal stays readable.
  const grouped = useMemo(() => {
    const out = [];
    shown.forEach(e => {
      const year = new Date(e.at).getFullYear();
      const last = out[out.length - 1];
      if (last && last.year === year) last.items.push(e);
      else out.push({ year, items: [e] });
    });
    return out;
  }, [shown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs font-bold">Assembling this animal's record…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={28} className="mx-auto text-gray-200 mb-2" />
        <p className="text-xs font-black text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Registered', value: data?.animal?.registered_at ? fmtDate(data.animal.registered_at) : '—', icon: Tag },
          { label: 'Vaccinations', value: counts.vaccine || 0, icon: Syringe },
          { label: 'Illnesses recorded', value: (counts.illness || 0) + (counts.vet || 0), icon: Stethoscope },
          { label: 'Feed plans', value: counts.feed || 0, icon: Wheat },
        ].map(s => (
          <div key={s.label} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <s.icon size={14} className="text-gray-400" />
            <p className="text-sm font-black text-gray-800 mt-1.5 leading-none">{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {FILTERS.map(f => {
          const n = f.kinds ? f.kinds.reduce((sum, k) => sum + (counts[k] || 0), 0) : events.length;
          return (
            <button
              key={f.id} onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                filter === f.id ? 'bg-pfuma-green text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-xs font-black text-gray-400">Nothing recorded under this filter yet.</p>
          <p className="text-[11px] text-gray-300 font-medium mt-1">
            Vaccinations, diagnoses, feed rations and weighings all land here as you record them.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.year}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3">{group.year}</p>
              <ol className="relative border-l-2 border-gray-100 ml-4 space-y-4">
                {group.items.map((e, i) => {
                  const k = KINDS[e.kind] || KINDS.other;
                  const Icon = k.icon;
                  const age = ageAt(e.at, birthDate);
                  return (
                    <li key={`${e.at}-${i}`} className="relative pl-6">
                      <span className={`absolute -left-[15px] top-0 w-7 h-7 rounded-full border-2 ${k.ring} ${k.bg} flex items-center justify-center`}>
                        <Icon size={13} className={k.color} />
                      </span>
                      <div className="pb-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <p className="font-black text-gray-800 text-sm leading-snug">{e.title}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${k.bg} ${k.color}`}>
                            {k.label}
                          </span>
                        </div>
                        {e.detail && <p className="text-[11px] text-gray-600 font-medium leading-snug mt-0.5">{e.detail}</p>}
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                          {fmtDate(e.at)}
                          {age ? ` · ${age}` : ''}
                          {e.actor ? ` · ${e.actor}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LifecycleTimeline;
