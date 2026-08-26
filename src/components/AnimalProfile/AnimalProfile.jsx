import React, { useState, useRef } from 'react';
import { BREED_PROFILES } from '../HealthManagement/healthData';
import {
  PlusCircle, ChevronRight, Users, ShieldCheck, X,
  TrendingUp, Tag, ArrowLeft, Calendar, Weight,
  Info, CheckCircle, Edit3, BarChart2, Camera, AlertTriangle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LifecycleTimeline from './LifecycleTimeline';
import Lightbox from '../Lightbox';
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

// Module-scope (not defined inside RegistrationForm) so its identity is
// stable across re-renders — a component defined inside another component's
// body gets recreated on every keystroke, which makes React unmount and
// remount the <input> it wraps, dropping focus after every character typed.
const Field = ({ id, label, required, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

// ── HEALTH PASSPORT MODAL ──────────────────────────────────────────────────
// Print/Export PDF/download are all the same real capability: the browser's
// native print dialog, which can also target "Save as PDF" — no heavy
// client-side PDF library needed. Printing directly from this modal (via
// @media print visibility tricks) rendered a blank page in practice —
// `position: fixed` + `backdrop-blur` on the overlay doesn't reliably
// translate to the print layout across browsers/WebViews. Instead this
// clones the passport markup into a separate, isolated print window (same
// compiled stylesheet, none of the modal's fixed/blur baggage) and prints
// that — the standard robust pattern for printing one part of a page.
const HealthPassport = ({ animal, auditLog, onClose }) => {
  const printRef = useRef(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow || !printRef.current) {
      window.alert('Your browser blocked the print window — allow pop-ups for this site and try again.');
      return;
    }
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML).join('\n');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>${animal.name} — Health Passport</title>
      ${styleTags}
      <style>
        body{margin:0;background:#fff;}
        /* The on-screen modal caps itself to the viewport (max-h-[90vh]) and
           scrolls internally (overflow-y-auto) — cloned as-is into this
           print window, that clips Identity Details and the Health Event
           Log to whatever fit in the visible area instead of flowing them
           onto the page (only the photo, which sits above the fold, made
           it through). Overriding by id — not the Tailwind classes
           themselves, which are fragile to target from injected CSS —
           forces the full content to lay out and print/paginate normally.
        */
        #pfuma-passport-root { max-height: none !important; overflow: visible !important; }
        #pfuma-passport-body { overflow: visible !important; flex: none !important; }
      </style>
    </head><body>${printRef.current.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md">
    <div ref={printRef} id="pfuma-passport-root" className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="bg-pfuma-green px-10 py-8 text-white flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck size={28} className="text-yellow-400" />
            <h2 className="text-2xl font-black tracking-tight uppercase">Health Passport</h2>
          </div>
          <p className="text-sm opacity-60 font-medium uppercase tracking-[3px]">Verified Digital Pedigree & Medical Record</p>
        </div>
        <button onClick={onClose} className="relative z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition print:hidden" aria-label="Close passport">
          <X size={20} />
        </button>
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full" aria-hidden="true" />
      </div>

      {/* Body */}
      <div id="pfuma-passport-body" className="flex-1 overflow-y-auto p-5 md:p-10 bg-[#fdfcf9] text-left">
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
      <div className="px-10 py-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <ShieldCheck size={14} className="text-pfuma-green" /> PFUMA Verified · {new Date().getFullYear()}
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="px-6 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition">Print</button>
          <button onClick={handlePrint} title="Choose &quot;Save as PDF&quot; as the destination in the print dialog to download it" className="px-6 py-2.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-green-700 transition">Export PDF</button>
        </div>
      </div>
    </div>
  </div>
  );
};

// ── REGISTRATION FORM ──────────────────────────────────────────────────────
const RegistrationForm = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: '', species: 'Cattle', breed: '', birthDate: '',
    tagId: '', brandId: '', sireId: '', damId: '', birthWeight: ''
  });
  const [photoFiles, setPhotoFiles]     = useState([]); // first is the cover photo
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotoFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
    e.target.value = ''; // lets picking the same file again re-add it after a removal
  };
  const removePhoto = (i) => setPhotoFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const bw = parseFloat(form.birthWeight);
    if (!form.name.trim() || !form.birthDate || isNaN(bw) || bw <= 0) return;
    const age = calculateAge(form.birthDate);
    setSubmitting(true);
    setError('');
    const result = await onSubmit({ ...form, age, birthWeight: bw, currentWeight: bw }, photoFiles.map(p => p.file));
    setSubmitting(false);
    if (!result?.ok) setError(result?.error || 'Could not register animal — try again.');
  };

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
                    {['Cattle','Goat'].map(s => <option key={s}>{s}</option>)}
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

            {/* Photos */}
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b">
                Photos <span className="text-gray-400 font-medium normal-case tracking-normal">(optional — add as many as you like; a stock photo is used if you skip this)</span>
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                {photoFiles.map((p, i) => (
                  <div key={p.preview} className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 group">
                    <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-black text-center py-0.5">COVER</span>}
                    <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <label htmlFor="f-photo" className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center shrink-0 cursor-pointer hover:border-pfuma-green transition">
                  <Camera size={20} className="text-gray-300" />
                  <span className="text-[9px] font-black text-pfuma-green mt-1">Add</span>
                </label>
                <input id="f-photo" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
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

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-bold">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="w-full py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              <CheckCircle size={16} /> {submitting ? 'Registering…' : 'Register Animal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const AnimalProfile = ({ animals, onAddAnimal, onAddAnimalPhotos, auditLog, onListAnimal, currentUser }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [isRegistering,    setIsRegistering]    = useState(false);
  const [isPassportOpen,   setIsPassportOpen]   = useState(false);
  const [activeTab,        setActiveTab]        = useState('lifecycle');
  const [uploadingPhotos,  setUploadingPhotos]  = useState(false);
  const [lightboxIndex,    setLightboxIndex]    = useState(null); // null = closed

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !onAddAnimalPhotos || !selectedAnimalId) return;
    setUploadingPhotos(true);
    const result = await onAddAnimalPhotos(selectedAnimalId, files);
    setUploadingPhotos(false);
    if (result && !result.ok) alert(result.error || 'Could not add photos — try again.');
    else if (result?.error) alert(result.error); // partial failure — some uploaded, some didn't
  };

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);

  const handleRegister = async (data, photoFiles) => {
    const result = await onAddAnimal(data, photoFiles);
    if (result?.ok) setIsRegistering(false);
    return result;
  };

  // Registration form
  if (isRegistering) return <RegistrationForm onSubmit={handleRegister} onCancel={() => setIsRegistering(false)} />;

  // Detail view
  if (selectedAnimal) {
    const animalLogs = auditLog.filter(l => l.animalId === selectedAnimal.id);
    return (
      <div className="p-6 bg-gray-50 min-h-full space-y-5 text-left">
        {/* Back */}
        <button onClick={() => { setSelectedAnimalId(null); setActiveTab('lifecycle'); setLightboxIndex(null); }} className="flex items-center gap-1.5 text-pfuma-green font-black text-xs uppercase tracking-widest hover:underline">
          <ArrowLeft size={14} /> Back to Herd
        </button>

        {/* Hero card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row" style={{ minHeight: 280 }}>
          <div className="w-full md:w-2/5 relative cursor-zoom-in bg-gray-900" style={{ minHeight: 220 }} onClick={() => setLightboxIndex(0)}>
            {/* object-contain, not object-cover — a cover crop was cutting
                animals out of frame on anything but a square photo; farmers
                want the whole animal visible without having to click through
                to the lightbox to see it. */}
            <img src={selectedAnimal.imageUrl} className="w-full h-full object-contain absolute inset-0" alt={selectedAnimal.name} />
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
              {selectedAnimal.marketplaceStatus === 'sold' ? (
                <div className="p-4 rounded-2xl border-2 text-left bg-red-50 border-red-300">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Market</p>
                  <p className="text-sm font-black text-red-600">🔴 SOLD</p>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">Cannot be listed again</p>
                </div>
              ) : selectedAnimal.marketplaceStatus === 'pending_clearance' ? (
                <div className="p-4 rounded-2xl border-2 text-left bg-amber-50 border-amber-300">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Market</p>
                  <p className="text-sm font-black text-amber-600">⏳ Awaiting Clearance</p>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">Not visible until Police clear it</p>
                </div>
              ) : selectedAnimal.marketplaceStatus === 'available' ? (
                <div className="p-4 rounded-2xl border-2 text-left bg-green-50 border-green-300">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Market</p>
                  <p className="text-sm font-black text-pfuma-green">✅ Live on Marketplace</p>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">Cleared by Police</p>
                </div>
              ) : (
                <button
                  onClick={() => onListAnimal && onListAnimal(selectedAnimal.id)}
                  className="p-4 rounded-2xl border-2 text-left transition hover:scale-105 bg-gray-50 border-gray-100 hover:border-pfuma-green"
                >
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Market</p>
                  <p className="text-sm font-black text-pfuma-green">Not Listed</p>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">Tap to list on Marketplace</p>
                </button>
              )}
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

        {/* Photo gallery — every picture of this animal, shown together on
            listings/marketplace once it's for sale */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
            Photos {selectedAnimal.photos?.length > 1 ? `(${selectedAnimal.photos.length})` : ''}
          </h4>
          <div className="flex flex-wrap gap-3">
            {(selectedAnimal.photos || []).map((url, i) => (
              <button key={url + i} type="button" onClick={() => setLightboxIndex(i)}
                className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 cursor-zoom-in">
                <img src={url} alt={`${selectedAnimal.name} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
            <label htmlFor="add-more-photos" className={`w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center shrink-0 transition ${uploadingPhotos ? 'opacity-50' : 'cursor-pointer hover:border-pfuma-green'}`}>
              <Camera size={18} className="text-gray-300" />
              <span className="text-[9px] font-black text-pfuma-green mt-1">{uploadingPhotos ? 'Adding…' : 'Add'}</span>
            </label>
            <input id="add-more-photos" type="file" accept="image/*" multiple className="hidden" disabled={uploadingPhotos} onChange={handleAddPhotos} />
          </div>
        </div>

        {lightboxIndex !== null && (
          <Lightbox
            photos={selectedAnimal.photos || []} index={lightboxIndex}
            onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)}
            alt={selectedAnimal.name}
          />
        )}

        {/* Tabs */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[
              { id: 'lifecycle', label: '🗓 Lifecycle',        desc: 'Everything recorded for this animal, in date order' },
              { id: 'history',   label: '📋 Health Events',    desc: 'All recorded treatments, vaccines, and diagnostics' },
              { id: 'growth',    label: '📈 Weight Growth',    desc: 'Weight trend since birth' },
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
            {activeTab === 'lifecycle' ? (
              <LifecycleTimeline animalId={selectedAnimal.id} currentUser={currentUser} />
            ) : activeTab === 'history' ? (
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
  const forSaleCount = animals.filter(a => a.marketplaceStatus === 'pending_clearance' || a.marketplaceStatus === 'available').length;
  const soldCount    = animals.filter(a => a.marketplaceStatus === 'sold').length;
  const speciesCounts = ['Cattle', 'Goat', 'Sheep', 'Pig'].map(s => ({ s, n: animals.filter(a => a.species === s).length })).filter(x => x.n > 0);
  // Sold animals are kept for record-keeping but split into their own
  // section, well away from the active herd — they can't be listed again
  // and shouldn't be mistaken for stock still available to sell.
  const activeAnimals = animals.filter(a => a.marketplaceStatus !== 'sold');
  const soldAnimals   = animals.filter(a => a.marketplaceStatus === 'sold');

  const renderAnimalCard = (a, { sold = false } = {}) => {
    const logs = auditLog.filter(l => l.animalId === a.id).length;
    return (
      <button
        key={a.id}
        onClick={() => setSelectedAnimalId(a.id)}
        className={`w-full group p-4 rounded-2xl shadow-sm flex items-center gap-4 text-left transition ${
          sold
            ? 'bg-gray-50 border-2 border-red-100 hover:border-red-300 opacity-80 hover:opacity-100'
            : 'bg-white border-2 border-transparent hover:border-pfuma-green/30 hover:shadow-lg'
        }`}
      >
        <div className={`w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shrink-0 ${sold ? 'grayscale' : ''}`}>
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
            {a.marketplaceStatus === 'sold' && <span className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full uppercase">🔴 Sold</span>}
            {a.marketplaceStatus === 'pending_clearance' && <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">⏳ Awaiting Clearance</span>}
            {a.marketplaceStatus === 'available' && <span className="text-[9px] font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full uppercase">🏷 On Marketplace</span>}
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
  };

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
                  <p className="text-[10px] font-bold text-yellow-400/70 uppercase">On Marketplace</p>
                </div>
              )}
              {soldCount > 0 && (
                <div className="bg-red-400/20 border border-red-400/30 rounded-2xl px-5 py-3 text-center">
                  <p className="text-2xl font-black text-red-400">{soldCount}</p>
                  <p className="text-[10px] font-bold text-red-400/70 uppercase">Sold</p>
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
              {animals.length === 0 ? 'No animals registered yet' : `${activeAnimals.length} active animal${activeAnimals.length !== 1 ? 's' : ''}`}
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
            <>
              {activeAnimals.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center text-center">
                  <p className="text-xs font-black text-gray-500">Every registered animal has been sold</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Register a new animal to keep growing your herd.</p>
                </div>
              ) : (
                activeAnimals.map(a => renderAnimalCard(a))
              )}

              {soldAnimals.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3 mt-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <h3 className="text-sm font-black text-gray-700">Sold — {soldAnimals.length} animal{soldAnimals.length !== 1 ? 's' : ''}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">Kept for record-keeping · cannot be listed again</span>
                  </div>
                  <div className="space-y-4">
                    {soldAnimals.map(a => renderAnimalCard(a, { sold: true }))}
                  </div>
                </div>
              )}
            </>
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
                  Open an animal's profile and tap "Not Listed" under Market to start a listing. It stays hidden until Police clear the sale, then it appears on the Marketplace.
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
