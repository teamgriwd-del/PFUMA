import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  RefreshCw, Wheat, FlaskConical, Info
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

const SPECIES = ['All Species', 'Cattle', 'Goat', 'Sheep', 'Pig'];

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

const FeedAnalyzer = () => {
  const [feeds, setFeeds]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [apiOnline, setApiOnline]   = useState(false);
  const [search, setSearch]         = useState('');
  const [species, setSpecies]       = useState('All Species');
  const [expandedId, setExpandedId] = useState(null);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const url = search ? `${API}/feed/search?q=${encodeURIComponent(search)}` : `${API}/feed`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setFeeds(await res.json());
      setApiOnline(true);
    } catch {
      setFeeds(DEMO_FEEDS);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchFeeds, 300);
    return () => clearTimeout(timer);
  }, [fetchFeeds]);

  const filtered = feeds.filter(f =>
    species === 'All Species' || (f.suitable_for || '').includes(species)
  );

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-5 text-left overflow-y-auto">

      {/* Banner */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #f97316 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Wheat size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Feed Analyzer · Powered by Addy's Backend</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Livestock Nutrition Database</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Browse Zimbabwe's common livestock feeds with full nutritional breakdowns — protein, energy, fibre, calcium, and phosphorus. Know what you're feeding your animals.
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

      {/* How to use */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-3">
        <Info size={16} className="text-pfuma-green mt-0.5 shrink-0" />
        <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
          <span className="font-black text-gray-800">How to use:</span> Search for a feed type or filter by the species you farm. Click any card to see the full nutritional breakdown — use this to build a balanced diet for your livestock and avoid deficiencies.
        </p>
      </div>

      {/* Search + species filter */}
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
              {s === 'All Species' ? '🐾 All' : s === 'Cattle' ? '🐄' : s === 'Goat' ? '🐐' : s === 'Sheep' ? '🐑' : '🐖'} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
          {filtered.length} feed type{filtered.length !== 1 ? 's' : ''} {species !== 'All Species' ? `suitable for ${species}` : ''}
        </p>
      )}

      {/* Feed cards */}
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
                    {/* Description */}
                    {feed.description && (
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed bg-orange-50 border border-orange-100 rounded-xl p-3">
                        {feed.description}
                      </p>
                    )}

                    {/* Nutritional bars */}
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

                    {/* Suitable species */}
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

export default FeedAnalyzer;
