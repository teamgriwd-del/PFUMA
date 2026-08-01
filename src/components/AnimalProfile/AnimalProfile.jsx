import React, { useState } from 'react';
import { BREED_PROFILES } from '../HealthManagement/healthData';
import {
  PlusCircle, ChevronRight, Users, ShieldCheck, X,
  TrendingUp, Tag, ArrowLeft, Calendar, Weight,
  Info, CheckCircle, Edit3, BarChart2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './AnimalProfile.css';

// ── helpers ────────────────────────────────────────────────────────────────
const speciesEmoji = { Cattle: '🐄', Goat: '🐐', Sheep: '🐑', Pig: '🐖' };

const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  const birth = new Date(dob);
  const now   = new Date();
  let years   = now.getFullYear() - birth.getFullYear();
  let months  = now.getMonth()    - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  return `${years}y ${months}m`;
};

const calculateValue = (animal, auditLog) => {
  const base        = animal.species === 'Cattle' ? 500 : 100;
  const healthBonus = auditLog.filter(l => l.animalId === animal.id).length * 10;
  return (base + (animal.currentWeight * 1.5) + healthBonus).toLocaleString();
};

const SPECIES_COLORS = { Cattle: 'bg-green-100 text-green-700', Goat: 'bg-orange-100 text-orange-700', Sheep: 'bg-blue-100 text-blue-700', Pig: 'bg-pink-100 text-pink-700' };

// ── HEALTH PASSPORT MODAL ──────────────────────────────────────────────────
const HealthPassport = ({ animal, auditLog, onClose }) => (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md">
    <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="bg-pfuma-green px-10 py-8 text-white flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck size={28} className="text-yellow-400" />
            <h2 className="text-2xl font-black tracking-tight uppercase">Health Passport</h2>
          </div>
          <p className="text-sm opacity-60 font-medium uppercase tracking-[3px]">Verified Digital Pedigree & Medical Record</p>
        </div>
        <button onClick={onClose} className="relative z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition" aria-label="Close passport">
          <X size={20} />
        </button>
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full" aria-hidden="true" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 md:p-10 bg-[#fdfcf9] text-left">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
          <div className="lg:col-span-1 space-y-5">
            <div className="w-full aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-gray-100">
              <img src={animal.imageUrl} className="w-full h-full object-cover" alt={animal.name} />
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Estimated Market Value</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-pfuma-green">USD</span>
                <strong className="text-3xl font-black text-gray-800">${calculateValue(animal, auditLog)}</strong>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-1">Based on weight, species, and health records</p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <section>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[4px] mb-5 border-b pb-2">Identity Details</h3>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { label: 'Name',       value: animal.name },
                  { label: 'Ear Tag',    value: animal.tagId   ? `#${animal.tagId}` : '—' },
                  { label: 'Owner Brand', value: animal.brandId || '—' },
                  { label: 'Breed',      value: animal.breed   || '—' },
                  { label: 'Species',    value: `${speciesEmoji[animal.species] || ''} ${animal.species}` },
                  { label: 'Age',        value: animal.age },
                  { label: 'Weight',     value: `${animal.currentWeight} kg` },
                  { label: 'Sire ID',    value: animal.sireId  || '—' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[10px] font-black text-pfuma-green uppercase mb-0.5">{f.label}</p>
                    <p className="text-lg font-black text-gray-800">{f.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[4px] mb-5 border-b pb-2">Health Event Log</h3>
              {auditLog.filter(l => l.animalId === animal.id).length === 0 ? (
                <p className="italic text-gray-400 text-sm font-medium">No certified events recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.filter(l => l.animalId === animal.id).map(log => (
                    <div key={log.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-pfuma-green shrink-0" />
                        <p className="text-sm font-black text-gray-800">{log.action}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0 ml-4">{log.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 py-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <ShieldCheck size={14} className="text-pfuma-green" /> PFUMA Verified · {new Date().getFullYear()}
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition">Print</button>
          <button className="px-6 py-2.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-green-700 transition">Export PDF</button>
        </div>
      </div>
    </div>
  </div>
);

// ── REGISTRATION FORM ──────────────────────────────────────────────────────
const RegistrationForm = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: '', species: 'Cattle', breed: '', birthDate: '',
    tagId: '', brandId: '', sireId: '', damId: '', birthWeight: ''
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const bw = parseFloat(form.birthWeight);
    if (!form.name.trim() || !form.birthDate || isNaN(bw) || bw <= 0) return;
    const age = calculateAge(form.birthDate);
    onSubmit({ ...form, id: Date.now(), age, birthWeight: bw, currentWeight: bw });
  };

  const Field = ({ id, label, required, children }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
  const inputCls = "w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-bold text-sm transition";

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gray-900 rounded-3xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative z-10 flex items-center gap-4">
            <button onClick={onCancel} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition" aria-label="Go back">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div>
              <h3 className="text-xl font-black text-white">Register New Animal</h3>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">Fields marked <span className="text-red-400">*</span> are required. The rest can be filled in later.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity */}
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b">Animal Identity</h4>
              <div className="grid grid-cols-2 gap-4">
                <Field id="f-name" label="Animal Name" required>
                  <input id="f-name" type="text" placeholder="e.g. Bessie" required className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
                </Field>
                <Field id="f-species" label="Species">
                  <select id="f-species" className={inputCls + ' appearance-none'} value={form.species} onChange={e => set('species', e.target.value)}>
                    {['Cattle','Goat','Sheep','Pig'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field id="f-breed" label="Breed">
                  <select id="f-breed" className={inputCls + ' appearance-none'} value={form.breed} onChange={e => set('breed', e.target.value)}>
                    <option value="">Select breed...</option>
                    {(BREED_PROFILES[form.species] || []).map(b => <option key={b.breed} value={b.breed}>{b.breed}</option>)}
                  </select>
                </Field>
                <Field id="f-tag" label="Ear Tag ID">
                  <input id="f-tag" type="text" placeholder="TAG-XXX" className={inputCls} value={form.tagId} onChange={e => set('tagId', e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Birth info */}
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b">Birth & Weight</h4>
              <div className="grid grid-cols-2 gap-4">
                <Field id="f-dob" label="Date of Birth" required>
                  <input id="f-dob" type="date" required max={new Date().toISOString().split('T')[0]} className={inputCls} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
                </Field>
                <Field id="f-bw" label="Birth Weight (kg)" required>
                  <input id="f-bw" type="number" min="0.1" step="0.1" required placeholder="e.g. 35" className={inputCls} value={form.birthWeight} onChange={e => set('birthWeight', e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Ownership */}
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b">Ownership & Pedigree <span className="text-gray-400 font-medium normal-case tracking-normal">(optional)</span></h4>
              <div className="grid grid-cols-2 gap-4">
                <Field id="f-brand" label="Owner Brand ID">
                  <input id="f-brand" type="text" placeholder="AR-MP" className={inputCls} value={form.brandId} onChange={e => set('brandId', e.target.value)} />
                </Field>
                <Field id="f-sire" label="Sire ID (Father)">
                  <input id="f-sire" type="text" placeholder="S-XXX" className={inputCls} value={form.sireId} onChange={e => set('sireId', e.target.value)} />
                </Field>
              </div>
            </div>

            <button type="submit" className="w-full py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Register Animal
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const AnimalProfile = ({ animals, onAddAnimal, auditLog, onListAnimal }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [isRegistering,    setIsRegistering]    = useState(false);
  const [isPassportOpen,   setIsPassportOpen]   = useState(false);
  const [activeTab,        setActiveTab]        = useState('history');

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);

  const handleRegister = (data) => {
    onAddAnimal(data);
    setIsRegistering(false);
  };

  // Registration form
  if (isRegistering) return <RegistrationForm onSubmit={handleRegister} onCancel={() => setIsRegistering(false)} />;

  // Detail view
  if (selectedAnimal) {
    const animalLogs = auditLog.filter(l => l.animalId === selectedAnimal.id);
    return (
      <div className="p-6 bg-gray-50 min-h-full space-y-5 text-left">
        {/* Back */}
        <button onClick={() => { setSelectedAnimalId(null); setActiveTab('history'); }} className="flex items-center gap-1.5 text-pfuma-green font-black text-xs uppercase tracking-widest hover:underline">
          <ArrowLeft size={14} /> Back to Herd
        </button>

        {/* Hero card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row" style={{ minHeight: 280 }}>
          <div className="w-full md:w-2/5 relative" style={{ minHeight: 220 }}>
            <img src={selectedAnimal.imageUrl} className="w-full h-full object-cover absolute inset-0" alt={selectedAnimal.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-8">
              <h1 className="text-4xl font-black text-white leading-none mb-2">{selectedAnimal.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${SPECIES_COLORS[selectedAnimal.species] || 'bg-gray-100 text-gray-700'}`}>{speciesEmoji[selectedAnimal.species]} {selectedAnimal.species}</span>
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{selectedAnimal.breed}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Ear Tag</p>
                <h2 className="text-2xl font-black text-gray-900">#{selectedAnimal.tagId || '—'}</h2>
              </div>
              <button
                onClick={() => setIsPassportOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-yellow-300 transition"
              >
                <ShieldCheck size={14} /> Open Passport
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Age</p>
                <p className="text-lg font-black text-gray-900">{selectedAnimal.age}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Weight</p>
                <p className="text-lg font-black text-gray-900">{selectedAnimal.currentWeight} kg</p>
              </div>
              <button
                onClick={() => onListAnimal && onListAnimal(selectedAnimal.id)}
                className={`p-4 rounded-2xl border-2 text-left transition hover:scale-105 ${selectedAnimal.forSale ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-100 hover:border-pfuma-green'}`}
              >
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Market</p>
                <p className={`text-sm font-black ${selectedAnimal.forSale ? 'text-yellow-600' : 'text-pfuma-green'}`}>
                  {selectedAnimal.forSale ? '🏷 For Sale' : 'Not Listed'}
                </p>
                <p className="text-[9px] text-gray-400 font-medium mt-0.5">{selectedAnimal.forSale ? 'Tap to delist' : 'Tap to list'}</p>
              </button>
            </div>

            {/* Valuation */}
            <div className="bg-pfuma-green/5 border border-pfuma-green/20 rounded-2xl px-4 py-3 flex items-center justify-between mt-auto">
              <div>
                <p className="text-[10px] font-black text-pfuma-green uppercase">Estimated Value</p>
                <p className="text-[11px] text-gray-500 font-medium">Weight + species + {animalLogs.length} health record{animalLogs.length !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-2xl font-black text-gray-900">USD ${calculateValue(selectedAnimal, auditLog)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[
              { id: 'history',  label: '📋 Health Events',    desc: 'All recorded treatments, vaccines, and diagnostics' },
              { id: 'growth',   label: '📈 Weight Growth',     desc: 'Weight trend since birth' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 px-6 py-4 text-left transition ${activeTab === t.id ? 'border-b-2 border-pfuma-green bg-green-50/50' : 'hover:bg-gray-50'}`}
              >
                <p className={`text-xs font-black uppercase tracking-wide ${activeTab === t.id ? 'text-pfuma-green' : 'text-gray-500'}`}>{t.label}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'history' ? (
              animalLogs.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm font-black text-gray-400">No health events recorded yet</p>
                  <p className="text-[11px] text-gray-300 font-medium mt-1">Events appear here when you administer medicine, complete vaccinations, or run a diagnosis.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {animalLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-pfuma-green/20 transition">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-pfuma-green shadow-sm shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-gray-800 text-sm">{log.action}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{log.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-pfuma-green" />
                  <h4 className="text-sm font-black text-gray-800">Weight Over Time (kg)</h4>
                  <span className="text-[11px] text-gray-400 font-medium">— shows growth from birth to current weight</span>
                </div>
                {(!selectedAnimal.weightHistory || selectedAnimal.weightHistory.length < 2) ? (
                  <div className="h-52 flex items-center justify-center text-gray-300 text-sm font-medium italic">Not enough weight data yet.</div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedAnimal.weightHistory} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                        <defs>
                          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#1b5e20" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#1b5e20" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" fontSize={11} fontWeight="bold" stroke="#ddd" tickLine={false} />
                        <YAxis fontSize={11} fontWeight="bold" stroke="#ddd" tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12, fontWeight: 700 }} formatter={v => [`${v} kg`, 'Weight']} />
                        <Area type="monotone" dataKey="weight" stroke="#1b5e20" fill="url(#wGrad)" strokeWidth={3} dot={{ fill: '#1b5e20', r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isPassportOpen && <HealthPassport animal={selectedAnimal} auditLog={auditLog} onClose={() => setIsPassportOpen(false)} />}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  const totalValue   = animals.reduce((acc, a) => acc + (500 + a.currentWeight * 1.5), 0);
  const forSaleCount = animals.filter(a => a.forSale).length;
  const speciesCounts = ['Cattle', 'Goat', 'Sheep', 'Pig'].map(s => ({ s, n: animals.filter(a => a.species === s).length })).filter(x => x.n > 0);

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6 text-left">

      {/* ── PURPOSE BANNER ── */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Herd Registry · Identity Management</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Your Herd — {animals.length} Animal{animals.length !== 1 ? 's' : ''}</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Each animal has a digital identity record — ear tag, breed, birth date, weight history, and a certified Health Passport you can print for trade and movement permits. Click any animal to view its full profile.
            </p>
          </div>
          {/* Herd stats */}
          {animals.length > 0 && (
            <div className="flex gap-3 shrink-0 flex-wrap">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-center">
                <p className="text-2xl font-black text-white">{animals.length}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Animals</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-center">
                <p className="text-2xl font-black text-yellow-400">${(totalValue / 1000).toFixed(1)}k</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Est. Value</p>
              </div>
              {forSaleCount > 0 && (
                <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-2xl px-5 py-3 text-center">
                  <p className="text-2xl font-black text-yellow-400">{forSaleCount}</p>
                  <p className="text-[10px] font-bold text-yellow-400/70 uppercase">For Sale</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Animal list */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-gray-700">
              {animals.length === 0 ? 'No animals registered yet' : `${animals.length} registered animal${animals.length !== 1 ? 's' : ''}`}
            </h3>
            <button
              onClick={() => setIsRegistering(true)}
              className="flex items-center gap-2 bg-pfuma-green text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 shadow-lg transition"
            >
              <PlusCircle size={16} /> Add Animal
            </button>
          </div>

          {animals.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center text-center">
              <span className="text-6xl mb-4">🐄</span>
              <p className="text-sm font-black text-gray-500 mb-1">Your herd is empty</p>
              <p className="text-xs text-gray-400 font-medium mb-6">Register your first animal to start tracking its health, weight, and vaccinations.</p>
              <button
                onClick={() => setIsRegistering(true)}
                className="flex items-center gap-2 bg-pfuma-green text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 shadow-lg transition"
              >
                <PlusCircle size={16} /> Register First Animal
              </button>
            </div>
          ) : (
            animals.map(a => {
              const logs = auditLog.filter(l => l.animalId === a.id).length;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnimalId(a.id)}
                  className="w-full group bg-white p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-pfuma-green/30 hover:shadow-lg flex items-center gap-4 text-left transition"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
                    <img
                      src={a.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${a.name}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                      alt={a.name}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-pfuma-green bg-green-50 px-2 py-0.5 rounded uppercase">{a.tagId || 'No Tag'}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${SPECIES_COLORS[a.species] || 'bg-gray-100 text-gray-600'}`}>{speciesEmoji[a.species]} {a.species}</span>
                      {a.forSale && <span className="text-[9px] font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full uppercase">🏷 For Sale</span>}
                    </div>
                    <h4 className="text-lg font-black text-gray-900 truncate">{a.name}</h4>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400 font-medium">{a.breed || 'Unknown breed'}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400 font-medium">{a.age}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400 font-medium">{a.currentWeight} kg</span>
                      {logs > 0 && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-[11px] text-pfuma-green font-black">{logs} health record{logs !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Est. Value</p>
                    <p className="text-sm font-black text-gray-800">${calculateValue(a, auditLog)}</p>
                    <ChevronRight size={18} className="text-gray-200 group-hover:text-pfuma-green transition ml-auto mt-1" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right sidebar */}
        {animals.length > 0 && (
          <div className="w-72 shrink-0 space-y-5 hidden xl:block">
            {/* Herd breakdown */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-pfuma-green" />
                <h4 className="text-sm font-black text-gray-800">Herd Breakdown</h4>
              </div>
              <p className="text-[11px] text-gray-400 font-medium mb-4">Species distribution across your registered animals.</p>
              <div className="space-y-3.5">
                {speciesCounts.map(({ s, n }) => {
                  const pct = animals.length > 0 ? (n / animals.length) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-600">{speciesEmoji[s]} {s}</span>
                        <span className="text-xs font-black text-gray-800">{n}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="bg-pfuma-green h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick tip */}
            <div className="bg-pfuma-green/5 border border-pfuma-green/20 rounded-2xl p-4">
              <p className="text-[11px] font-black text-pfuma-green uppercase tracking-wide mb-1">💡 Health Passport</p>
              <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                Open any animal's profile and tap "Open Passport" to generate a certified health document required for livestock movement permits and sales in Zimbabwe.
              </p>
            </div>

            {/* Listing tip */}
            {forSaleCount === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <p className="text-[11px] font-black text-yellow-700 uppercase tracking-wide mb-1">🏷 Marketplace</p>
                <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                  Open an animal's profile and tap "Market Status" to list it for sale. Listed animals appear in the Retailer Marketplace.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalProfile;
