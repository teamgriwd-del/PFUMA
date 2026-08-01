import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, MapPin, Phone, ShieldCheck, Package,
  Tag, Filter, X, CheckCircle, AlertTriangle, ArrowRight,
  ShoppingCart, Leaf, Pill, Wrench, Wheat, RefreshCw
} from 'lucide-react';

const API = 'http://localhost:5000';

const CATEGORIES = [
  { id: 'all',       label: 'All Listings',  icon: ShoppingCart, color: 'bg-gray-800'   },
  { id: 'livestock', label: 'Livestock',      icon: Tag,          color: 'bg-pfuma-green'},
  { id: 'feed',      label: 'Feed & Grain',   icon: Wheat,        color: 'bg-orange-500' },
  { id: 'produce',   label: 'Farm Produce',   icon: Leaf,         color: 'bg-lime-600'   },
  { id: 'medicine',  label: 'Medicine',       icon: Pill,         color: 'bg-blue-600'   },
  { id: 'equipment', label: 'Equipment',      icon: Wrench,       color: 'bg-purple-600' },
];

const CAT_COLORS = {
  livestock: 'bg-green-50 border-green-200',
  feed:      'bg-orange-50 border-orange-200',
  produce:   'bg-lime-50 border-lime-200',
  medicine:  'bg-blue-50 border-blue-200',
  equipment: 'bg-purple-50 border-purple-200',
};
const CAT_BADGE = {
  livestock: 'bg-green-100 text-green-700',
  feed:      'bg-orange-100 text-orange-700',
  produce:   'bg-lime-100 text-lime-700',
  medicine:  'bg-blue-100 text-blue-700',
  equipment: 'bg-purple-100 text-purple-700',
};

// Demo data shown when API is offline
const DEMO_LISTINGS = [
  { id: 1, product_name: 'Thunder — Angus Cattle',  category: 'livestock', price: 770,  unit: 'head', quantity: 1,   location: 'Zvimba, Mashonaland West', seller_name: 'Arnold Mapindu',  phone: '+263 77 100 0001', seller_province: 'Mashonaland West', description: 'Healthy 1y 9m Angus bull. DVS certified. Verified health passport.', status: 'available' },
  { id: 2, product_name: 'Soya Bean Meal',          category: 'feed',      price: 450,  unit: 'kg',   quantity: 500, location: 'Harare',                    seller_name: 'John Moyo',       phone: '+263 77 200 0002', seller_province: 'Harare',             description: 'High quality soya meal, 45% protein.',                       status: 'available' },
  { id: 3, product_name: 'Maize Grain',             category: 'feed',      price: 320,  unit: 'kg',   quantity: 1000,location: 'Bulawayo',                   seller_name: 'Grace Ndlovu',    phone: '+263 77 300 0003', seller_province: 'Bulawayo',           description: 'Fresh maize grain, harvested this season.',                 status: 'available' },
  { id: 4, product_name: 'Oxytetracycline (LA)',    category: 'medicine',  price: 25,   unit: 'ml',   quantity: 200, location: 'Harare',                    seller_name: 'AgroChem Zim',    phone: '+263 77 400 0004', seller_province: 'Harare',             description: 'Long-acting antibiotic. 200ml bottles. DVS approved.',      status: 'available' },
  { id: 5, product_name: 'Borehole Water Pump',     category: 'equipment', price: 1200, unit: 'unit', quantity: 3,   location: 'Gweru',                     seller_name: 'ZimAgro Ltd',     phone: '+263 77 500 0005', seller_province: 'Midlands',           description: 'Solar-powered borehole pump, 3000L/hr capacity.',           status: 'available' },
  { id: 6, product_name: 'Fresh Butternuts',        category: 'produce',   price: 80,   unit: 'kg',   quantity: 200, location: 'Marondera',                 seller_name: 'Chipo Farms',     phone: '+263 77 600 0006', seller_province: 'Mashonaland East',   description: 'Fresh butternuts, ready for market.',                       status: 'available' },
];

const PostForm = ({ currentUser, onSubmit, onCancel, animals }) => {
  const [form, setForm] = useState({ product_name: '', category: 'livestock', price: '', unit: 'head', quantity: '1', location: currentUser?.district ? `${currentUser.district}, ${currentUser.province}` : (currentUser?.province || ''), description: '', animal_id: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_name.trim() || !form.price) return;
    onSubmit({ ...form, price: parseFloat(form.price), quantity: parseFloat(form.quantity) });
  };

  const inputCls = 'w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-medium text-sm transition';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-sm font-black text-gray-900">Post a Listing</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Visible to all PFUMA users — farmers, retailers, and suppliers</p>
        </div>
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Category</label>
            <select className={inputCls + ' appearance-none'} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {form.category === 'livestock' && animals.length > 0 && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Link to Animal (optional)</label>
              <select className={inputCls + ' appearance-none'} value={form.animal_id} onChange={e => { set('animal_id', e.target.value); const a = animals.find(a => String(a.id) === e.target.value); if (a) set('product_name', `${a.name} — ${a.breed} ${a.species}`); }}>
                <option value="">Not linked</option>
                {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
              </select>
            </div>
          )}
        </div>
        {form.category === 'livestock' && form.animal_id && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-medium flex items-start gap-2">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            <span>This listing links to a registered animal, so it needs Police sale-clearance (ownership &amp; brand papers checked) before it appears on the Marketplace.</span>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Product / Item Name *</label>
          <input className={inputCls} type="text" required placeholder="e.g. Brahman Bull, Soya Meal, Borehole Pump" value={form.product_name} onChange={e => set('product_name', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Price (USD) *</label>
            <input className={inputCls} type="number" min="0" step="0.01" required placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Unit</label>
            <select className={inputCls + ' appearance-none'} value={form.unit} onChange={e => set('unit', e.target.value)}>
              {['head','kg','litre','ml','unit','bag','tonne'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Quantity</label>
            <input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Location</label>
          <input className={inputCls} type="text" placeholder="e.g. Zvimba, Mashonaland West" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
          <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Describe your item — condition, certification, delivery options..." value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <button type="submit" className="w-full py-3.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition shadow-md flex items-center justify-center gap-2">
          <CheckCircle size={15} /> Post Listing
        </button>
      </form>
    </div>
  );
};

const Marketplace = ({ currentUser, animals = [], onListAnimal }) => {
  const [listings, setListings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [apiOnline, setApiOnline]   = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [feedback, setFeedback]     = useState(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeCategory === 'all'
        ? `${API}/listings`
        : `${API}/listings?category=${activeCategory}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${currentUser?.token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setListings(data);
      setApiOnline(true);
    } catch {
      // API offline — use demo data
      const filtered = activeCategory === 'all' ? DEMO_LISTINGS : DEMO_LISTINGS.filter(l => l.category === activeCategory);
      setListings(filtered);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, currentUser?.token]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handlePost = async (formData) => {
    const needsClearance = formData.category === 'livestock' && formData.animal_id;
    let message = needsClearance
      ? 'Listing submitted for police clearance — it will appear here once approved.'
      : 'Listing posted successfully.';
    try {
      const res = await fetch(`${API}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not post — try again.'); setShowForm(false); setTimeout(() => setFeedback(null), 4000); return; }
      if (data.message) message = data.message;
    } catch { /* offline — reflect locally */ }
    // Only show it immediately if it doesn't need clearance — a real clearance-gated
    // listing only becomes visible once Police approves it via the backend.
    if (!needsClearance) {
      setListings(prev => [{ id: Date.now(), ...formData, seller_name: currentUser?.name || 'You', phone: currentUser?.phone || '', seller_province: currentUser?.province || '', status: 'available' }, ...prev]);
    }
    setShowForm(false);
    setFeedback(message);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleBid = async (listing) => {
    if (!currentUser) return;
    const amount = window.prompt(`Enter your ${currentUser.role === 'Retailer' ? 'bid' : 'enquiry offer'} amount (USD) for "${listing.product_name}":`, listing.price);
    if (!amount || isNaN(Number(amount))) return;
    try {
      const res = await fetch(`${API}/listings/${listing.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not submit — try again.'); }
      else { setFeedback(`Offer of USD ${Number(amount).toLocaleString()} sent to ${listing.seller_name}.`); }
    } catch {
      setFeedback('Offline — your offer could not be sent. Try again once the API is reachable.');
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const filtered = listings.filter(l =>
    l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.location?.toLowerCase().includes(search.toLowerCase()) ||
    l.seller_name?.toLowerCase().includes(search.toLowerCase())
  );

  const canPost = ['Farmer', 'Supplier'].includes(currentUser?.role);

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-5 text-left overflow-y-auto">

      {/* Banner */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #7c3aed 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">PFUMA Marketplace · Powered by Addy's Backend</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Agri-Commerce Hub</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Buy and sell livestock, feed, produce, medicine, and equipment — all in one place. Every listing is posted by a verified PFUMA member with their contact details.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {!apiOnline && (
              <div className="flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 px-4 py-2 rounded-xl">
                <AlertTriangle size={13} className="text-yellow-400" />
                <span className="text-xs font-black text-yellow-300">Demo mode — start Flask API to go live</span>
              </div>
            )}
            {apiOnline && (
              <div className="flex items-center gap-2 bg-green-400/20 border border-green-400/30 px-4 py-2 rounded-xl">
                <CheckCircle size={13} className="text-green-400" />
                <span className="text-xs font-black text-green-300">Live — connected to API</span>
              </div>
            )}
            {canPost && (
              <button onClick={() => setShowForm(p => !p)} className="flex items-center gap-2 bg-pfuma-green text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-600 transition shadow-lg">
                <Plus size={14} /> Post Listing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs font-black px-4 py-3 rounded-xl" role="status">
          <CheckCircle size={14} /> {feedback}
        </div>
      )}

      {/* Post form */}
      {showForm && <PostForm currentUser={currentUser} animals={animals} onSubmit={handlePost} onCancel={() => setShowForm(false)} />}

      {/* Search + category filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products, location, or seller..."
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pfuma-green/30 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={fetchListings} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-600 uppercase hover:bg-gray-50 transition shadow-sm shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide shrink-0 transition ${
              activeCategory === cat.id ? `${cat.color} text-white shadow-md` : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
            }`}
          >
            <cat.icon size={13} />
            {cat.label}
            {activeCategory === cat.id && <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">{filtered.length}</span>}
          </button>
        ))}
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-pfuma-green" />
          <span className="ml-3 text-sm font-medium text-gray-400">Loading listings...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl py-16 text-center">
          <ShoppingCart size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-black text-gray-400">No listings found</p>
          <p className="text-xs text-gray-300 font-medium mt-1">{canPost ? 'Be the first to post in this category.' : 'Check back soon.'}</p>
          {canPost && <button onClick={() => setShowForm(true)} className="mt-4 px-5 py-2.5 bg-pfuma-green text-white rounded-xl text-xs font-black uppercase hover:bg-green-700 transition">Post a Listing</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(listing => (
            <div key={listing.id} className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition flex flex-col ${CAT_COLORS[listing.category] || 'border-gray-100'}`}>
              {/* Card header */}
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${CAT_BADGE[listing.category] || 'bg-gray-100 text-gray-600'}`}>
                    {listing.category}
                  </span>
                  {listing.category === 'livestock' && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full uppercase" title="This livestock listing was reviewed and cleared by Police before going live">
                      <ShieldCheck size={9} /> Police Cleared
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-black text-gray-900 mb-1 leading-snug">{listing.product_name}</h4>
                {listing.description && (
                  <p className="text-[11px] text-gray-500 font-medium leading-snug mb-3 line-clamp-2">{listing.description}</p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                    <Package size={11} className="text-gray-400 shrink-0" />
                    <span>{listing.quantity} {listing.unit} available</span>
                  </div>
                  {listing.location && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <MapPin size={11} className="text-gray-400 shrink-0" />
                      <span>{listing.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                    <Tag size={11} className="text-gray-400 shrink-0" />
                    <span>{listing.seller_name}</span>
                    {listing.seller_province && <span className="text-gray-300">· {listing.seller_province}</span>}
                  </div>
                </div>
              </div>

              {/* Price + actions */}
              <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Price</p>
                  <p className="text-xl font-black text-gray-900">
                    USD {Number(listing.price).toLocaleString()}
                    <span className="text-xs text-gray-400 font-medium">/{listing.unit}</span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {listing.phone && (
                    <a
                      href={`tel:${listing.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition"
                    >
                      <Phone size={11} /> Call
                    </a>
                  )}
                  <button onClick={() => handleBid(listing)} className="flex items-center gap-1.5 px-4 py-2 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition shadow-sm">
                    <ArrowRight size={12} />
                    {currentUser?.role === 'Retailer' ? 'Bid' : 'Enquire'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
