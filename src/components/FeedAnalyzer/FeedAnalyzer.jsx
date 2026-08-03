import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  RefreshCw, Wheat, Calculator, PlusCircle, Trash2, DollarSign,
  Scale, Clock, BookOpen, ShieldCheck
} from 'lucide-react';

const API = 'http://localhost:5000';

const DEMO_FEEDS = [
  { id: 1, name: 'Soya Bean Meal',     category: 'protein',   protein_percent: 45.0, energy_mj: 13.5, fibre_percent: 6.0,  calcium_percent: 0.30, phosphorus_percent: 0.65, description: 'High protein supplement — ideal for growing cattle and dairy cows.',      suitable_for: 'Cattle,Goat' },
  { id: 2, name: 'Maize Grain',        category: 'energy',    protein_percent: 8.5,  energy_mj: 14.2, fibre_percent: 2.5,  calcium_percent: 0.03, phosphorus_percent: 0.28, description: 'Primary energy source in most livestock rations in Zimbabwe.',            suitable_for: 'Cattle,Goat,Sheep,Pig' },
  { id: 3, name: 'Cotton Seed Cake',   category: 'protein',   protein_percent: 38.0, energy_mj: 12.8, fibre_percent: 12.0, calcium_percent: 0.20, phosphorus_percent: 0.90, description: 'By-product of cotton oil extraction — good rumen buffer for cattle.',     suitable_for: 'Cattle' },
  { id: 4, name: 'Sunflower Cake',     category: 'protein',   protein_percent: 32.0, energy_mj: 11.0, fibre_percent: 15.0, calcium_percent: 0.35, phosphorus_percent: 0.95, description: 'Cost-effective protein source for maintenance rations.',                   suitable_for: 'Cattle,Goat,Sheep' },
  { id: 5, name: 'Wheat Bran',         category: 'roughage',  protein_percent: 15.5, energy_mj: 11.5, fibre_percent: 10.5, calcium_percent: 0.12, phosphorus_percent: 1.10, description: 'Good source of phosphorus and digestible fibre for ruminants.',            suitable_for: 'Cattle,Goat,Sheep' },
  { id: 6, name: 'Dicalcium Phosphate',category: 'mineral',   protein_percent: 0.0,  energy_mj: 0.0,  fibre_percent: 0.0,  calcium_percent: 26.0, phosphorus_percent: 18.5, description: 'Mineral supplement to correct calcium/phosphorus deficiencies.',          suitable_for: 'Cattle,Goat,Sheep,Pig' },
  { id: 7, name: 'Lucerne Hay',        category: 'roughage',  protein_percent: 17.5, energy_mj: 9.5,  fibre_percent: 28.0, calcium_percent: 1.50, phosphorus_percent: 0.25, description: 'Excellent high-protein roughage especially for dairy and young stock.',    suitable_for: 'Cattle,Goat,Sheep' },
  { id: 8, name: 'Commercial Grower',  category: 'mixed',     protein_percent: 18.0, energy_mj: 12.5, fibre_percent: 7.0,  calcium_percent: 0.90, phosphorus_percent: 0.70, description: 'Ready-mixed ration for growing cattle 6-18 months. Balanced micro-nutrients.', suitable_for: 'Cattle' },
];

const CAT_COLOR = {
  protein:  'bg-blue-100 text-blue-700',
  energy:   'bg-orange-100 text-orange-700',
  roughage: 'bg-green-100 text-green-700',
  mineral:  'bg-purple-100 text-purple-700',
  mixed:    'bg-gray-100 text-gray-700',
};

const STATUS_STYLE = {
  deficient: { label: 'Deficient', color: 'text-red-600',    bg: 'bg-red-50 border-red-200',    icon: AlertTriangle },
  balanced:  { label: 'Balanced',  color: 'text-green-600',  bg: 'bg-green-50 border-green-200', icon: CheckCircle },
  excess:    { label: 'Excess',    color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
};

const SPECIES = ['All Species', 'Cattle', 'Goat'];
const RATION_SPECIES = ['Cattle', 'Goat'];

const authHeaders = (currentUser) => ({ Authorization: `Bearer ${currentUser?.token}` });

const NutrientBar = ({ label, value, max, unit, color }) => {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-gray-600">{label}</span>
        <span className={`text-[11px] font-black ${color}`}>{value} {unit}</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── RATION BUILDER ────────────────────────────────────────────
// The differentiator: computes what a farmer's REAL registered animal
// needs (species + live weight + age → daily protein/energy target using
// standard maintenance formulas) and prices a chosen ration against live
// PFUMA Marketplace listings — not a static "here's what's in maize" table.
const RationBuilder = ({ currentUser, animals, feeds, onUpdateAnimal }) => {
  const eligibleAnimals = useMemo(
    () => (animals || []).filter(a => RATION_SPECIES.includes(a.species)),
    [animals]
  );

  const [animalId, setAnimalId] = useState('');
  const [requirement, setRequirement] = useState(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [rows, setRows] = useState([{ feedTypeId: '', qtyKg: '' }]);
  const [saving, setSaving] = useState(false);
  const [savedPlan, setSavedPlan] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const selectedAnimal = eligibleAnimals.find(a => String(a.id) === String(animalId));

  const fetchRequirement = useCallback(async (id) => {
    if (!id || !currentUser?.token) return;
    setReqLoading(true);
    setSavedPlan(null);
    setError('');
    try {
      const res = await fetch(`${API}/feed/requirements?animal_id=${id}`, { headers: authHeaders(currentUser) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not compute requirement');
      setRequirement(data);
    } catch (e) {
      setRequirement(null);
      setError(e.message);
    } finally {
      setReqLoading(false);
    }
  }, [currentUser]);

  const fetchHistory = useCallback(async (id) => {
    if (!id || !currentUser?.token) return;
    try {
      const res = await fetch(`${API}/feed/plans?animal_id=${id}`, { headers: authHeaders(currentUser) });
      if (res.ok) setHistory(await res.json());
    } catch { /* history is a nice-to-have, fail silently */ }
  }, [currentUser]);

  useEffect(() => {
    if (animalId) {
      fetchRequirement(animalId);
      fetchHistory(animalId);
      setRows([{ feedTypeId: '', qtyKg: '' }]);
    } else {
      setRequirement(null);
      setHistory([]);
    }
  }, [animalId, fetchRequirement, fetchHistory]);

  const updateRow = (idx, patch) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, { feedTypeId: '', qtyKg: '' }]);
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  // Live client-side preview so the farmer sees the effect of each change
  // instantly — the server recomputes authoritatively on save.
  const preview = useMemo(() => {
    let protein = 0, energy = 0, cost = 0, anyUnpriced = false;
    const lines = rows.map(r => {
      const feed = feeds.find(f => String(f.id) === String(r.feedTypeId));
      const qty = parseFloat(r.qtyKg) || 0;
      if (!feed || qty <= 0) return null;
      const p = qty * 1000 * (parseFloat(feed.protein_percent) / 100);
      const e = qty * parseFloat(feed.energy_mj);
      const unitPrice = feed.market_price ? parseFloat(feed.market_price.price) : null;
      const lineCost = unitPrice != null ? unitPrice * qty : 0;
      if (unitPrice == null) anyUnpriced = true;
      protein += p; energy += e; cost += lineCost;
      return { feed, qty, protein: p, energy: e, unitPrice, lineCost };
    }).filter(Boolean);
    return { lines, protein, energy, cost, anyUnpriced };
  }, [rows, feeds]);

  const statusOf = (total, target) => {
    if (!target) return 'balanced';
    const ratio = total / target;
    if (ratio < 0.9) return 'deficient';
    if (ratio > 1.15) return 'excess';
    return 'balanced';
  };

  const proteinStatus = requirement ? statusOf(preview.protein, requirement.target_protein_g) : null;
  const energyStatus = requirement ? statusOf(preview.energy, requirement.target_energy_mj) : null;

  const savePlan = async () => {
    if (!animalId || preview.lines.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/feed/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(currentUser) },
        body: JSON.stringify({
          animal_id: animalId,
          items: preview.lines.map(l => ({ feed_type_id: l.feed.id, qty_kg: l.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save ration plan');
      setSavedPlan(data);
      setHistory(prev => [data, ...prev]);
      if (selectedAnimal && onUpdateAnimal) {
        onUpdateAnimal(selectedAnimal.id, { costToDate: (selectedAnimal.costToDate || 0) + data.total_cost_usd });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Pitch line */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-3">
        <Calculator size={16} className="text-pfuma-green mt-0.5 shrink-0" />
        <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
          <span className="font-black text-gray-800">This is the difference:</span> you already know Maize is energy and Soya is protein. What you don't know off the top of your head is exactly how many grams of protein <em>this specific animal</em>, at <em>this weight and age</em>, needs today — and what that ration actually costs at real PFUMA supplier prices. That's what this calculates.
        </p>
      </div>

      {/* Animal picker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Build a ration for</label>
          {eligibleAnimals.length === 0 ? (
            <p className="text-xs text-gray-400 font-medium bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4">
              Register a Cattle or Goat in Herd Management first — the Ration Builder needs a real animal's weight to compute requirements.
            </p>
          ) : (
            <select
              value={animalId}
              onChange={e => setAnimalId(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-pfuma-green/30"
            >
              <option value="">Select an animal...</option>
              {eligibleAnimals.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.species} · {a.currentWeight || '?'} kg</option>
              ))}
            </select>
          )}
        </div>

        {reqLoading && (
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <RefreshCw size={13} className="animate-spin" /> Computing daily requirement...
          </div>
        )}

        {requirement && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Scale size={14} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[9px] font-black text-gray-400 uppercase">Weight</p>
              <p className="text-sm font-black text-gray-900">{requirement.weight_kg} kg</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Clock size={14} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[9px] font-black text-gray-400 uppercase">Life Stage</p>
              <p className="text-sm font-black text-gray-900 capitalize">{requirement.life_stage}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <ShieldCheck size={14} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[9px] font-black text-gray-400 uppercase">Daily Target</p>
              <p className="text-sm font-black text-gray-900">{requirement.target_protein_g}g CP</p>
            </div>
          </div>
        )}
      </div>

      {/* Ration rows */}
      {requirement && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Today's Ration</label>

          <div className="space-y-2.5">
            {rows.map((row, idx) => {
              const feed = feeds.find(f => String(f.id) === String(row.feedTypeId));
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.feedTypeId}
                    onChange={e => updateRow(idx, { feedTypeId: e.target.value })}
                    className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:ring-2 focus:ring-pfuma-green/30"
                  >
                    <option value="">Choose feed...</option>
                    {feeds.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.market_price ? ` · $${Number(f.market_price.price).toFixed(2)}/${f.market_price.unit}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" step="0.1" placeholder="kg/day"
                    value={row.qtyKg}
                    onChange={e => updateRow(idx, { qtyKg: e.target.value })}
                    className="w-24 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:ring-2 focus:ring-pfuma-green/30"
                  />
                  {feed && !feed.market_price && (
                    <span title="No live PFUMA supplier price for this feed yet"><AlertTriangle size={14} className="text-amber-400 shrink-0" /></span>
                  )}
                  <button onClick={() => removeRow(idx)} disabled={rows.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-30 shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-black text-pfuma-green hover:underline">
            <PlusCircle size={14} /> Add another feed
          </button>

          {/* Live verdict */}
          {preview.lines.length > 0 && (
            <div className="pt-4 border-t border-gray-50 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Protein', total: preview.protein, target: requirement.target_protein_g, unit: 'g', status: proteinStatus },
                  { label: 'Energy',  total: preview.energy,  target: requirement.target_energy_mj,  unit: 'MJ', status: energyStatus },
                ].map(n => {
                  const s = STATUS_STYLE[n.status];
                  const Icon = s.icon;
                  return (
                    <div key={n.label} className={`rounded-xl border p-3 ${s.bg}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} className={s.color} />
                        <span className={`text-[10px] font-black uppercase ${s.color}`}>{n.label} — {s.label}</span>
                      </div>
                      <p className="text-sm font-black text-gray-800">
                        {n.total.toFixed(1)}{n.unit} <span className="text-gray-400 font-medium">/ {n.target}{n.unit} needed</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between bg-gray-900 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-green-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wide">Estimated Daily Cost</span>
                </div>
                <span className="text-lg font-black text-white">USD {preview.cost.toFixed(2)}</span>
              </div>
              {preview.anyUnpriced && (
                <p className="text-[10px] text-amber-600 font-bold">⚠ One or more feeds have no live PFUMA supplier listing — cost shown is partial. List that feed on the Marketplace to get real pricing here.</p>
              )}

              {error && <p className="text-[11px] text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

              <button
                onClick={savePlan}
                disabled={saving}
                className="w-full py-3 bg-pfuma-green text-white rounded-xl text-xs font-black uppercase tracking-wide hover:brightness-105 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Save Ration Plan'}
              </button>

              {savedPlan && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                  <CheckCircle size={14} className="text-green-600 shrink-0" />
                  <p className="text-[11px] font-bold text-green-700">Saved — added USD {savedPlan.total_cost_usd.toFixed(2)} to {selectedAnimal?.name}'s cost-to-date.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Past Ration Plans for {selectedAnimal?.name}</p>
          <div className="space-y-2">
            {history.map(p => {
              const s = STATUS_STYLE[p.protein_status];
              return (
                <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-xl p-3">
                  <span className="font-medium text-gray-500">{new Date(p.created_at).toLocaleDateString()} · {p.items.length} feed{p.items.length !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-black ${s.color}`}>{s.label}</span>
                    <span className="font-black text-gray-800">USD {Number(p.total_cost_usd).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── REFERENCE BROWSER (original static lookup, kept as a secondary tab) ──
const ReferenceBrowser = ({ feeds, loading, apiOnline }) => {
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('All Species');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = feeds.filter(f =>
    (species === 'All Species' || (f.suitable_for || '').includes(species)) &&
    (!search || f.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search feeds (e.g. Maize, Soya, Lucerne)..."
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pfuma-green/30 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {SPECIES.map(s => (
            <button key={s} onClick={() => setSpecies(s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition border ${species === s ? 'bg-pfuma-green text-white border-pfuma-green shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-pfuma-green'}`}>
              {s === 'All Species' ? '🐾 All' : s === 'Cattle' ? '🐄' : '🐐'} {s}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
          {filtered.length} feed type{filtered.length !== 1 ? 's' : ''} {species !== 'All Species' ? `suitable for ${species}` : ''}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-pfuma-green" />
          <span className="ml-3 text-sm font-medium text-gray-400">Loading feed database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(feed => {
            const isOpen = expandedId === feed.id;
            const species_list = (feed.suitable_for || '').split(',').filter(Boolean);
            return (
              <div key={feed.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                <button
                  className="w-full flex items-center gap-4 p-5 text-left"
                  onClick={() => setExpandedId(isOpen ? null : feed.id)}
                >
                  <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                    <Wheat size={20} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-black text-gray-900">{feed.name}</h4>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${CAT_COLOR[feed.category] || CAT_COLOR.mixed}`}>
                        {feed.category}
                      </span>
                      {feed.market_price && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-green-100 text-green-700">
                          ${Number(feed.market_price.price).toFixed(2)}/{feed.market_price.unit} live
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-gray-500 font-medium">Protein: <span className="font-black text-blue-600">{feed.protein_percent}%</span></span>
                      <span className="text-gray-300">·</span>
                      <span className="text-[11px] text-gray-500 font-medium">Energy: <span className="font-black text-orange-600">{feed.energy_mj} MJ/kg</span></span>
                      {species_list.length > 0 && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400 font-medium">{species_list.slice(0,3).join(', ')}{species_list.length > 3 ? '...' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-gray-400">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-4">
                    {feed.description && (
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed bg-orange-50 border border-orange-100 rounded-xl p-3">
                        {feed.description}
                      </p>
                    )}
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Nutritional Breakdown</p>
                      <div className="space-y-2.5">
                        <NutrientBar label="🥩 Protein"    value={feed.protein_percent}    max={50}  unit="%"    color="text-blue-600" />
                        <NutrientBar label="⚡ Energy"     value={feed.energy_mj}           max={16}  unit="MJ/kg" color="text-orange-500" />
                        <NutrientBar label="🌿 Fibre"      value={feed.fibre_percent}       max={35}  unit="%"    color="text-green-600" />
                        <NutrientBar label="🦴 Calcium"    value={feed.calcium_percent}     max={30}  unit="%"    color="text-purple-600" />
                        <NutrientBar label="💊 Phosphorus" value={feed.phosphorus_percent}  max={20}  unit="%"    color="text-pink-600" />
                      </div>
                    </div>
                    {species_list.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Suitable For</p>
                        <div className="flex gap-2 flex-wrap">
                          {species_list.map(s => (
                            <span key={s} className="text-[10px] font-black bg-pfuma-green/10 text-pfuma-green px-3 py-1 rounded-full uppercase">
                              {s === 'Cattle' ? '🐄' : s === 'Goat' ? '🐐' : s === 'Sheep' ? '🐑' : '🐖'} {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-2 bg-white border-2 border-dashed border-gray-200 rounded-2xl py-12 text-center">
              <Wheat size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-black text-gray-400">No feeds match your search</p>
              <p className="text-xs text-gray-300 font-medium mt-1">Try a different name or species filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FeedAnalyzer = ({ currentUser, animals = [], onUpdateAnimal }) => {
  const [feeds, setFeeds]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [tab, setTab]             = useState('ration');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/feed/prices`);
        if (!res.ok) throw new Error();
        setFeeds(await res.json());
        setApiOnline(true);
      } catch {
        setFeeds(DEMO_FEEDS);
        setApiOnline(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-5 text-left overflow-y-auto">

      {/* Banner */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #f97316 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Wheat size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Feed Analyzer</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Ration Builder & Nutrition Database</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Not just what's in the bag — what your animal actually needs today, and what it costs from real PFUMA suppliers.
            </p>
          </div>
          <div className="shrink-0">
            {!apiOnline ? (
              <div className="flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 px-4 py-2 rounded-xl">
                <AlertTriangle size={13} className="text-yellow-400" />
                <span className="text-xs font-black text-yellow-300">Demo — start Flask API for live data</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-green-400/20 border border-green-400/30 px-4 py-2 rounded-xl">
                <CheckCircle size={13} className="text-green-400" />
                <span className="text-xs font-black text-green-300">Live data — {feeds.length} feed types</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button
          onClick={() => setTab('ration')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition ${tab === 'ration' ? 'bg-pfuma-green text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Calculator size={14} /> Ration Builder
        </button>
        <button
          onClick={() => setTab('reference')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition ${tab === 'reference' ? 'bg-pfuma-green text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen size={14} /> Nutrition Reference
        </button>
      </div>

      {tab === 'ration' ? (
        currentUser?.token ? (
          <RationBuilder currentUser={currentUser} animals={animals} feeds={feeds} onUpdateAnimal={onUpdateAnimal} />
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
            <p className="text-sm font-bold text-gray-400">Log in to build a ration for your animals.</p>
          </div>
        )
      ) : (
        <ReferenceBrowser feeds={feeds} loading={loading} apiOnline={apiOnline} />
      )}
    </div>
  );
};

export default FeedAnalyzer;
