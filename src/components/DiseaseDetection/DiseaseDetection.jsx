import React, { useState, useRef } from 'react';
import { diseaseDatabase, symptomCategories } from './diseaseData';
import { analyzePhotoPixels, classifyPhotoAnalysis } from './photoAnalysis';
import {
  Bot, MapPin, AlertTriangle, Info, ShieldCheck, Leaf,
  ChevronDown, ChevronUp, Search, Stethoscope, ClipboardList,
  CheckCircle, Camera, RotateCcw, Tag, Phone, ArrowRight
} from 'lucide-react';
import './DiseaseDetection.css';

// ── Static data ───────────────────────────────────────────────────────────
const REGIONAL_THREATS = [
  { id: 1, district: 'Chegutu',   disease: 'January Disease', level: 'High',     dist: '12 km' },
  { id: 2, district: 'Makonde',   disease: 'Anthrax',         level: 'Critical',  dist: '45 km' },
  { id: 3, district: 'Zvimba',    disease: 'Lumpy Skin',      level: 'Moderate',  dist: '28 km' },
  { id: 4, district: 'Hurungwe',  disease: 'East Coast Fever',level: 'High',     dist: '87 km' },
  { id: 5, district: 'Kariba',    disease: 'CBPP',            level: 'Moderate',  dist: '120 km' },
];

const CATEGORY_META = {
  'Physical Signs':       { icon: '👁️',  tip: 'Look at the skin, mouth, legs, eyes, and lymph nodes.' },
  'Respiratory':          { icon: '🫁',  tip: 'Listen to breathing and watch for nasal discharge or coughing.' },
  'Behavior & Vitals':    { icon: '🌡️',  tip: 'Changes in eating, movement, temperature, and alertness.' },
};

const levelColor = (level) =>
  level === 'Critical' ? 'text-red-500 bg-red-500/10 border-red-500/20'
  : level === 'High'   ? 'text-orange-400 bg-orange-400/10 border-orange-400/20'
  :                      'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';

const severityBadge = (sev) =>
  sev === 'Critical'
    ? 'bg-red-100 text-red-700 border border-red-200'
    : 'bg-orange-100 text-orange-700 border border-orange-200';

// ── Sub-components ────────────────────────────────────────────────────────

const StepBadge = ({ n, label, active, done }) => (
  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition
    ${done  ? 'bg-pfuma-green text-white'
    : active ? 'bg-gray-900 text-white'
    :          'bg-gray-100 text-gray-400'}`}>
    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black
      ${done ? 'bg-white text-pfuma-green' : active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'}`}>
      {done ? '✓' : n}
    </span>
    {label}
  </div>
);

const ConfidenceExplainer = ({ value, matched, total }) => (
  <div className="mt-2">
    <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
      <span>{matched} of {total} known symptoms matched</span>
      <span className="font-black text-gray-700">{value}% match</span>
    </div>
    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${value >= 70 ? 'bg-pfuma-green' : value >= 40 ? 'bg-orange-400' : 'bg-yellow-400'}`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────
const DiseaseDetection = ({ animals = [], onAddAuditLog }) => {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [diagnosisResults, setDiagnosisResults]   = useState([]);
  const [hasAnalyzed, setHasAnalyzed]             = useState(false);
  const [targetAnimalId, setTargetAnimalId]       = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage]   = useState(false);
  const [visualResult, setVisualResult]           = useState(null);
  const [expandedId, setExpandedId]               = useState(null);
  const [activeTab, setActiveTab]                 = useState('action');
  const [savedFeedback, setSavedFeedback]         = useState(null);
  const [search, setSearch]                       = useState('');
  const feedbackTimer = useRef(null);

  const toggleSymptom = (s) =>
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const analyzeSymptoms = () => {
    if (!selectedSymptoms.length) return;
    const results = diseaseDatabase.map(d => {
      let score = 0, maxScore = 0, matchedCount = 0;
      const totalSymptoms = d.symptoms.primary.length + d.symptoms.secondary.length;
      d.symptoms.primary.forEach(s => { maxScore += 10; if (selectedSymptoms.includes(s)) { score += 10; matchedCount++; } });
      d.symptoms.secondary.forEach(s => { maxScore += 5;  if (selectedSymptoms.includes(s)) { score += 5;  matchedCount++; } });
      const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      return { ...d, confidence, matchedCount, totalSymptoms };
    })
    .filter(r => r.confidence > 20)
    .sort((a, b) => b.confidence - a.confidence);

    setDiagnosisResults(results);
    setHasAnalyzed(true);
    setExpandedId(results[0]?.id ?? null);
    setActiveTab('action');
  };

  const saveToHistory = (diseaseName) => {
    const id = parseInt(targetAnimalId, 10);
    const animal = animals.find(a => a.id === id);
    if (!animal || !onAddAuditLog) return;
    onAddAuditLog({ id: Date.now(), animalId: animal.id, animal: animal.name, action: `Diagnostic: ${diseaseName}`, date: new Date().toLocaleString() });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setSavedFeedback(`Saved to ${animal.name}'s health record.`);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(null), 3000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingImage(true);
    setVisualResult(null);
    try {
      const pixels = await analyzePhotoPixels(file);
      const result = classifyPhotoAnalysis(pixels);
      setVisualResult(result);
      if (result.suggested.length) {
        setSelectedSymptoms(prev => [...new Set([...prev, ...result.suggested])]);
      }
    } catch {
      setVisualResult({ headline: 'Could not analyze photo', detail: 'That image could not be read — try a different photo.', suggested: [] });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const resetAll = () => {
    setSelectedSymptoms([]); setDiagnosisResults([]); setHasAnalyzed(false);
    setVisualResult(null);   setExpandedId(null);     setSavedFeedback(null);
    setSearch('');
  };

  // step state
  const step1done = !!targetAnimalId;
  const step2done = selectedSymptoms.length > 0;
  const step3done = hasAnalyzed;

  // filtered symptom categories
  const filteredCategories = symptomCategories.map(cat => ({
    ...cat,
    symptoms: cat.symptoms.filter(s => !search || s.toLowerCase().includes(search.toLowerCase()))
  })).filter(cat => cat.symptoms.length > 0);

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6 text-left">

      {/* ── PURPOSE BANNER ── */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">AI Disease Checker · 10-Disease Knowledge Base</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Symptom-to-Diagnosis in 3 Steps</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Select every symptom you can see on the animal. The AI scores them against 10 known livestock diseases and tells you the most likely match — with a step-by-step action plan and prevention guide.
            </p>
          </div>
          {/* Step indicators */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <StepBadge n="1" label="Pick Animal"    active={!step1done} done={step1done} />
            <ArrowRight size={14} className="text-gray-600 self-center hidden md:block" />
            <StepBadge n="2" label="Tick Symptoms"  active={step1done && !step2done} done={step2done} />
            <ArrowRight size={14} className="text-gray-600 self-center hidden md:block" />
            <StepBadge n="3" label="Read Results"   active={step2done && !step3done} done={step3done} />
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─ LEFT 2/3 ─ */}
        <div className="lg:col-span-2 space-y-5">

          {/* STEP 1 — Animal */}
          <div className={`bg-white border-2 rounded-2xl p-5 transition ${step1done ? 'border-pfuma-green' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${step1done ? 'bg-pfuma-green text-white' : 'bg-gray-100 text-gray-500'}`}>{step1done ? '✓' : '1'}</div>
              <h3 className="text-sm font-black text-gray-800">Which animal are you examining?</h3>
              <span className="text-[10px] text-gray-400 font-medium ml-1">(optional — lets you save the result to its record)</span>
            </div>
            {animals.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium mt-3 italic">No animals registered yet. Go to Herd Registry to add animals.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => setTargetAnimalId('')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase border-2 transition ${!targetAnimalId ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'}`}
                >
                  General Check
                </button>
                {animals.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setTargetAnimalId(String(a.id))}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase border-2 transition ${String(targetAnimalId) === String(a.id) ? 'bg-pfuma-green text-white border-pfuma-green shadow-md' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-pfuma-green'}`}
                  >
                    <Tag size={11} />{a.name}<span className="opacity-60">· {a.species}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2 — Photo upload */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-black">📷</div>
              <h3 className="text-sm font-black text-gray-800">Photo Check <span className="text-gray-400 font-medium text-xs">(Optional shortcut)</span></h3>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Upload a clear photo of the animal's skin, mouth, or legs. We'll scan it for visible discoloration and texture patterns and suggest symptoms to check — this is a coarse visual heuristic, not a diagnosis, so always verify against what you see in person.</p>

            {isAnalyzingImage ? (
              <div className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                  <div className="w-6 h-6 border-3 border-pfuma-green border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-black text-pfuma-green">Scanning photo...</p>
                  <p className="text-[11px] text-gray-400 font-medium">Reading pixel colour and texture patterns</p>
                </div>
              </div>
            ) : visualResult ? (
              <div className="flex items-start gap-4 bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 border border-green-100">
                  <CheckCircle size={22} className="text-pfuma-green" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black bg-pfuma-green text-white px-2 py-0.5 rounded-full uppercase">Photo Scan · Heuristic</span>
                  </div>
                  <p className="text-sm font-black text-gray-800">{visualResult.headline}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">
                    {visualResult.detail}{' '}
                    {visualResult.suggested?.length
                      ? `Suggested symptom${visualResult.suggested.length > 1 ? 's' : ''} ticked below: ${visualResult.suggested.join(', ')}.`
                      : 'No symptoms were auto-ticked — check the list below manually based on what you observe.'}
                  </p>
                  <button onClick={() => setVisualResult(null)} className="mt-2 text-[10px] font-black text-gray-400 hover:text-red-500 uppercase underline">Remove photo</button>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-4 cursor-pointer group border-2 border-dashed border-gray-200 hover:border-pfuma-green rounded-2xl p-4 transition" aria-label="Upload animal photo">
                <input type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-green-50 group-hover:text-pfuma-green transition">
                  <Camera size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-600 group-hover:text-pfuma-green transition">Click to upload a photo</p>
                  <p className="text-[11px] text-gray-400 font-medium">Best results: skin, mouth, hooves, or swollen areas · JPG, PNG</p>
                </div>
              </label>
            )}
          </div>

          {/* STEP 2 continued — Symptom Checker */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${step2done ? 'bg-pfuma-green text-white' : 'bg-gray-100 text-gray-500'}`}>{step2done ? '✓' : '2'}</div>
                  <h3 className="text-sm font-black text-gray-800">Tick every symptom you can see</h3>
                </div>
                <p className="text-[11px] text-gray-400 font-medium ml-8">Check all symptoms that apply — more symptoms = more accurate result. Ticked symptoms turn green.</p>
              </div>
              {selectedSymptoms.length > 0 && (
                <div className="flex items-center gap-2 bg-pfuma-green/10 border border-pfuma-green/20 px-3 py-1.5 rounded-full">
                  <CheckCircle size={12} className="text-pfuma-green" />
                  <span className="text-xs font-black text-pfuma-green">{selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} selected</span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search symptoms..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-pfuma-green/30"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Categories */}
            <div className="space-y-6">
              {filteredCategories.map(cat => {
                const meta = CATEGORY_META[cat.name] || {};
                const catSelected = cat.symptoms.filter(s => selectedSymptoms.includes(s)).length;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-50">
                      <span className="text-base">{meta.icon}</span>
                      <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest">{cat.name}</h4>
                      {catSelected > 0 && (
                        <span className="ml-auto text-[10px] font-black text-pfuma-green bg-green-50 px-2 py-0.5 rounded-full">{catSelected} selected</span>
                      )}
                    </div>
                    {meta.tip && <p className="text-[10px] text-gray-400 font-medium mb-3">{meta.tip}</p>}
                    <div className="flex flex-wrap gap-2" role="group" aria-label={cat.name}>
                      {cat.symptoms.map(symptom => {
                        const ticked = selectedSymptoms.includes(symptom);
                        return (
                          <label
                            key={symptom}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition border-2 select-none
                              ${ticked
                                ? 'bg-pfuma-green text-white border-pfuma-green shadow-sm'
                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-pfuma-green/40 hover:bg-green-50/50'
                              }`}
                          >
                            <input type="checkbox" className="sr-only" checked={ticked} onChange={() => toggleSymptom(symptom)} aria-label={symptom} />
                            {ticked && <CheckCircle size={11} className="shrink-0" />}
                            {symptom}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filteredCategories.length === 0 && (
                <p className="text-sm text-gray-400 font-medium text-center py-4 italic">No symptoms match "{search}"</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-50">
              <button
                onClick={analyzeSymptoms}
                disabled={!selectedSymptoms.length}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-green-900/20 hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Stethoscope size={16} />
                {hasAnalyzed ? 'Re-run Analysis' : 'Run Diagnosis'}
              </button>
              {(selectedSymptoms.length > 0 || hasAnalyzed) && (
                <button onClick={resetAll} className="flex items-center gap-1.5 px-5 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition">
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* STEP 3 — Results (shown below on mobile / same flow) */}
          {hasAnalyzed && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-pfuma-green text-white flex items-center justify-center text-[10px] font-black">3</div>
                <h3 className="text-sm font-black text-gray-800">Diagnosis Results</h3>
                <span className="text-[11px] text-gray-400 font-medium">— {diagnosisResults.length} possible match{diagnosisResults.length !== 1 ? 'es' : ''} found</span>
              </div>

              {savedFeedback && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs font-black px-4 py-3 rounded-xl" role="status">
                  <ShieldCheck size={14} />{savedFeedback}
                </div>
              )}

              {diagnosisResults.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                  <Info size={28} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-black text-gray-400">No disease matched above 20% confidence.</p>
                  <p className="text-xs text-gray-300 font-medium mt-1">Try selecting more symptoms, or consult a vet directly.</p>
                </div>
              ) : diagnosisResults.map((res, i) => (
                <div
                  key={res.id}
                  className={`bg-white rounded-2xl border-2 transition ${i === 0 ? 'border-pfuma-green shadow-lg shadow-green-900/5' : 'border-gray-100'}`}
                >
                  {/* Result header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {i === 0 && <span className="text-[9px] font-black bg-pfuma-green text-white px-2 py-0.5 rounded-full uppercase">Top Match</span>}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${severityBadge(res.severity)}`}>{res.severity}</span>
                        {res.quarantineRequired && (
                          <span className="text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <AlertTriangle size={9} /> Quarantine
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0">#{i + 1} result</span>
                    </div>

                    <h4 className="text-lg font-black text-gray-900 mb-1">{res.name}</h4>
                    <p className="text-[11px] text-gray-500 font-medium mb-3">
                      Affects: {res.affectedSpecies.join(', ')}
                    </p>

                    <ConfidenceExplainer value={res.confidence} matched={res.matchedCount} total={res.totalSymptoms} />

                    {/* Expand toggle for non-top results */}
                    {i > 0 && (
                      <button
                        className="mt-3 flex items-center gap-1 text-[11px] font-black text-gray-400 hover:text-pfuma-green transition uppercase tracking-wide"
                        onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                        aria-expanded={expandedId === res.id}
                      >
                        {expandedId === res.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {expandedId === res.id ? 'Hide details' : 'Show first steps'}
                      </button>
                    )}
                  </div>

                  {/* Detail panel — always open for top match, toggled for others */}
                  {(i === 0 || expandedId === res.id) && (
                    <div className="border-t border-gray-100 p-5 space-y-4">
                      {/* Save to animal */}
                      {animals.length > 0 && i === 0 && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 gap-3">
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 font-bold">
                            <ClipboardList size={13} className="text-pfuma-green" />
                            Save this result to an animal's health record:
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-pfuma-green/30"
                              value={targetAnimalId}
                              onChange={e => setTargetAnimalId(e.target.value)}
                              aria-label="Select animal"
                            >
                              <option value="">Pick animal...</option>
                              {animals.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            {targetAnimalId && (
                              <button
                                onClick={() => saveToHistory(res.name)}
                                className="px-3 py-1.5 bg-pfuma-green text-white text-xs font-black rounded-lg hover:bg-green-700 transition uppercase"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action / Prevention tabs */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab('action')}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition ${activeTab === 'action' ? 'bg-pfuma-green text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          🚨 Action Plan
                        </button>
                        <button
                          onClick={() => setActiveTab('prevention')}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition ${activeTab === 'prevention' ? 'bg-pfuma-green text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          <Leaf size={11} className="inline mr-1" />Prevention Tips
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(activeTab === 'action' ? res.actionPlan : res.preventionTips).map((step, s) => (
                          <div key={s} className="flex items-start gap-2.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5
                              ${activeTab === 'action' ? 'bg-pfuma-green text-white' : 'bg-green-100 text-green-700'}`}>
                              {s + 1}
                            </div>
                            <p className="text-xs text-gray-600 font-medium leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>

                      {res.severity === 'Critical' && (
                        <div className="flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-3">
                          <Phone size={16} className="shrink-0" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide">Call your vet immediately</p>
                            <p className="text-[10px] font-medium opacity-80">This is a critical disease. Do not wait — contact DVS: +263 242 706331</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─ RIGHT 1/3 ─ */}
        <div className="col-span-1 space-y-5">

          {/* Regional Radar */}
          <div className="bg-gray-900 rounded-2xl p-5 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="text-sm font-black text-white mb-1">Diseases Near Your Farm</h4>
              <p className="text-[11px] text-gray-500 font-medium mb-4 leading-snug">
                These outbreaks are currently active in Mashonaland West. If your animal's symptoms match any of these, act urgently.
              </p>
              <div className="space-y-2.5">
                {REGIONAL_THREATS.map(t => (
                  <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border ${levelColor(t.level)} bg-opacity-10 transition`}>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={13} className={t.level === 'Critical' ? 'text-red-500' : t.level === 'High' ? 'text-orange-400' : 'text-yellow-400'} />
                      <div>
                        <p className="text-[11px] text-white font-black leading-none">{t.disease}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{t.district}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[9px] font-black uppercase block ${t.level === 'Critical' ? 'text-red-500' : t.level === 'High' ? 'text-orange-400' : 'text-yellow-400'}`}>{t.level}</span>
                      <span className="text-[9px] text-gray-600 font-bold">{t.dist}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 font-medium mt-4 leading-snug italic">
                Data from DVS surveillance nodes across Mashonaland West, updated daily.
              </p>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-green-500/10 rounded-full animate-ping opacity-10 pointer-events-none" aria-hidden="true" />
          </div>

          {/* How confidence works */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h4 className="text-sm font-black text-gray-800 mb-1 flex items-center gap-2"><Info size={14} className="text-pfuma-green" /> How the match % works</h4>
            <div className="space-y-3 mt-3">
              {[
                { range: '70 – 100%', label: 'Strong match', desc: 'Most known symptoms present. High probability — act now.', color: 'bg-pfuma-green' },
                { range: '40 – 69%', label: 'Possible match', desc: 'Some symptoms present. Monitor closely and consult a vet.', color: 'bg-orange-400' },
                { range: '20 – 39%', label: 'Weak match', desc: 'Few symptoms match. Keep watching — add more symptoms if they appear.', color: 'bg-yellow-400' },
              ].map(r => (
                <div key={r.range} className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${r.color} mt-1.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-black text-gray-700">{r.range} — {r.label}</p>
                    <p className="text-[10px] text-gray-400 font-medium leading-snug">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Empty / waiting state (only when not yet analyzed) */}
          {!hasAnalyzed && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
              <Stethoscope size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Results will appear here</p>
              <p className="text-[11px] text-gray-300 font-medium">Tick symptoms on the left, then press "Run Diagnosis"</p>
            </div>
          )}

          {/* Quick tip */}
          <div className="bg-pfuma-green/5 border border-pfuma-green/20 rounded-2xl p-4">
            <p className="text-[11px] font-black text-pfuma-green uppercase tracking-wide mb-1">💡 Pro Tip</p>
            <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
              The more symptoms you select, the more accurate the result. Always cross-check with the Regional Radar — if the top match is also active near your farm, treat it as urgent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseDetection;
