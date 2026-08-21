import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, MapPin, Phone, ShieldCheck, Package,
  Tag, Filter, X, CheckCircle, AlertTriangle, ArrowRight,
  ShoppingCart, Leaf, Pill, Wrench, Wheat, RefreshCw, Camera
} from 'lucide-react';

import { API } from '../../config';

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

// Only relevant in "My Listings" — the public feed only ever shows
// 'available', so a seller otherwise has no way to see where a listing
// that hasn't gone live yet (or already sold) actually stands.
const STATUS_BADGE = {
  pending_clearance: { label: 'Pending Clearance', cls: 'bg-yellow-100 text-yellow-700' },
  available:         { label: 'Live',              cls: 'bg-green-100 text-green-700'  },
  sold:              { label: 'Sold',               cls: 'bg-gray-200 text-gray-600'    },
  withdrawn:         { label: 'Withdrawn',          cls: 'bg-red-100 text-red-600'      },
};

const PostForm = ({ currentUser, onSubmit, onCancel, animals }) => {
  const [form, setForm] = useState({ product_name: '', category: 'livestock', price: '', unit: 'head', quantity: '1', location: currentUser?.district ? `${currentUser.district}, ${currentUser.province}` : (currentUser?.province || ''), description: '', animal_id: '',
    leader_clearance: '', leader_type: 'Sabuku', leader_name: '', leader_village: '',
    leader_cleared_on: '', leader_reference: '', leader_na_reason: '' });
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.product_name.trim() || !form.price) return;
    if (form.category === 'livestock' && !form.animal_id) {
      setFormError('Select which registered animal this listing is for — livestock listings must be linked to a real animal so Police can clear the sale.');
      return;
    }
    // The Sabuku/Mambo step comes before the police one, so the listing cannot
    // be submitted until that question is answered either way.
    if (form.category === 'livestock' && form.animal_id && !form.leader_clearance) {
      setFormError('Say whether a Sabuku or Mambo cleared this sale, or why no traditional authority applies to your farm.');
      return;
    }
    setSubmitting(true);
    await onSubmit({ ...form, price: parseFloat(form.price), quantity: parseFloat(form.quantity) }, photoFile);
    setSubmitting(false);
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
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-semibold flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Category</label>
            <select className={inputCls + ' appearance-none'} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {form.category === 'livestock' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Which Animal? *</label>
              {animals.length > 0 ? (
                <select className={inputCls + ' appearance-none'} value={form.animal_id} onChange={e => { set('animal_id', e.target.value); const a = animals.find(a => String(a.id) === e.target.value); if (a) set('product_name', `${a.name} — ${a.breed} ${a.species}`); }}>
                  <option value="">Select an animal…</option>
                  {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
                </select>
              ) : (
                <p className="text-[11px] text-gray-500 font-medium p-3 bg-gray-50 rounded-xl">Register an animal in your Herd first — livestock listings must be linked to one.</p>
              )}
            </div>
          )}
        </div>
        {form.category === 'livestock' && form.animal_id && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-medium flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>This listing links to a registered animal. It needs clearance from your Sabuku or Mambo first, then Police sale-clearance, before it appears on the Marketplace.</span>
            </div>

            <div className="border border-gray-200 rounded-xl p-3.5 space-y-3">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Traditional Authority Clearance *</label>
                <p className="text-[11px] text-gray-500 mb-2">In communal areas the village head (Sabuku) or chief (Mambo) clears a sale before the police do. If you farm on a title deed or lease with no traditional authority, say so instead.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['attested', 'Cleared by Sabuku / Mambo'], ['not_applicable', 'Does not apply to my farm']].map(([val, lab]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => set('leader_clearance', val)}
                      className={`text-[11px] font-bold rounded-lg px-3 py-2 border transition ${
                        form.leader_clearance === val
                          ? 'bg-pfuma-green text-white border-pfuma-green'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-pfuma-green'}`}
                    >{lab}</button>
                  ))}
                </div>
              </div>

              {form.leader_clearance === 'attested' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Who cleared it *</label>
                      <select className={inputCls + ' appearance-none'} value={form.leader_type} onChange={e => set('leader_type', e.target.value)}>
                        <option value="Sabuku">Sabuku (village head)</option>
                        <option value="Mambo">Mambo (chief)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Their name *</label>
                      <input className={inputCls} type="text" required placeholder="e.g. Sabuku Nyathi" value={form.leader_name} onChange={e => set('leader_name', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Village / Ward</label>
                      <input className={inputCls} type="text" placeholder="e.g. Nkayi Ward 7" value={form.leader_village} onChange={e => set('leader_village', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Date cleared</label>
                      <input className={inputCls} type="date" value={form.leader_cleared_on} onChange={e => set('leader_cleared_on', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Reference on the written clearance</label>
                    <input className={inputCls} type="text" placeholder="Optional — if the letter carries a number" value={form.leader_reference} onChange={e => set('leader_reference', e.target.value)} />
                  </div>
                </div>
              )}

              {form.leader_clearance === 'not_applicable' && (
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Why it does not apply *</label>
                  <input className={inputCls} type="text" required placeholder="e.g. A2 commercial farm on title deed" value={form.leader_na_reason} onChange={e => set('leader_na_reason', e.target.value)} />
                  <p className="text-[10px] text-gray-400 mt-1.5">The officer reviewing your listing will see this.</p>
                </div>
              )}
            </div>
          </>
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
        <div>
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Photo (optional)</label>
          <label htmlFor="listing-photo" className="flex items-center gap-4 cursor-pointer">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                : <Camera size={18} className="text-gray-300" />}
            </div>
            <span className="text-xs font-black text-pfuma-green hover:underline">{photoPreview ? 'Change photo' : 'Upload a photo'}</span>
            <input id="listing-photo" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>
        <button type="submit" disabled={submitting} className="w-full py-3.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
          <CheckCircle size={15} /> {submitting ? 'Posting…' : 'Post Listing'}
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
  const [openBidsId, setOpenBidsId] = useState(null);
  const [bidsByListing, setBidsByListing] = useState({});
  // 'market' = the public feed everyone sees (only 'available' listings);
  // 'mine' = every listing this seller has ever posted, at any status, so
  // they can find and manage their own without hunting through everyone
  // else's.
  const [viewMode, setViewMode]     = useState('market');

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const url = viewMode === 'mine'
        ? `${API}/listings/mine`
        : activeCategory === 'all'
          ? `${API}/listings`
          : `${API}/listings?category=${activeCategory}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${currentUser?.token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setListings(data);
      setApiOnline(true);
    } catch {
      // API offline — show a real empty/error state, no fabricated listings
      setListings([]);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, viewMode, currentUser?.token]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handlePost = async (formData, photoFile) => {
    const needsClearance = formData.category === 'livestock' && formData.animal_id;
    try {
      let res;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(formData).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
        fd.append('photo', photoFile);
        res = await fetch(`${API}/listings`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser?.token}` }, body: fd });
      } else {
        res = await fetch(`${API}/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
          body: JSON.stringify(formData),
        });
      }
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not post — try again.'); setShowForm(false); setTimeout(() => setFeedback(null), 4000); return; }
      setFeedback(data.message || (needsClearance
        ? 'Listing submitted for police clearance — it will appear here once approved.'
        : 'Listing posted successfully.'));
      await fetchListings();
    } catch {
      setFeedback('Could not reach the PFUMA API — the listing was not posted.');
    }
    setShowForm(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOrder = async (listing) => {
    if (!currentUser) return;
    const qty = window.prompt(`How many ${listing.unit} of "${listing.product_name}" do you need?`, '1');
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ listing_id: listing.id, quantity: Number(qty) }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not place order — try again.'); }
      else { setFeedback(`Order placed with ${listing.seller_name} — they'll dispatch it soon.`); }
    } catch {
      setFeedback('Offline — your order could not be sent. Try again once the API is reachable.');
    }
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

  const toggleBids = async (listing) => {
    if (openBidsId === listing.id) { setOpenBidsId(null); return; }
    setOpenBidsId(listing.id);
    try {
      const res = await fetch(`${API}/listings/${listing.id}/bids`, { headers: { Authorization: `Bearer ${currentUser?.token}` } });
      if (res.ok) {
        const data = await res.json();
        setBidsByListing(prev => ({ ...prev, [listing.id]: data }));
      }
    } catch { /* leave whatever was last loaded */ }
  };

  const acceptBid = async (listing, bid) => {
    try {
      const res = await fetch(`${API}/listings/${listing.id}/bids/${bid.id}/accept`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${currentUser?.token}` },
      });
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not accept this bid.'); setTimeout(() => setFeedback(null), 4000); return; }
      setFeedback(`Accepted USD ${Number(bid.amount).toLocaleString()} — listing marked sold.`);
      setTimeout(() => setFeedback(null), 4000);
      setOpenBidsId(null);
      await fetchListings();
    } catch {
      setFeedback('Could not reach the PFUMA API — bid not accepted.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const filtered = listings.filter(l =>
    (viewMode !== 'mine' || activeCategory === 'all' || l.category === activeCategory) &&
    (l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
     l.location?.toLowerCase().includes(search.toLowerCase()) ||
     l.seller_name?.toLowerCase().includes(search.toLowerCase()))
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

      {/* Market vs. mine — a seller's own listings (any status) are easy to
          lose track of in the shared public feed, so this pulls them out
          into their own view instead of the seller having to search/scan
          through everyone else's. */}
      {canPost && (
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm w-fit">
          <button
            onClick={() => setViewMode('market')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition ${viewMode === 'market' ? 'bg-pfuma-green text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <ShoppingCart size={13} /> All Listings
          </button>
          <button
            onClick={() => setViewMode('mine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition ${viewMode === 'mine' ? 'bg-pfuma-green text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Tag size={13} /> My Listings
          </button>
        </div>
      )}
      {viewMode === 'mine' && (
        <p className="text-[11px] text-gray-400 font-medium -mt-3">
          Everything you've posted, at every stage — pending clearance, live, sold, or withdrawn. Only you see this view.
        </p>
      )}

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
            <div key={listing.id} className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden ${CAT_COLORS[listing.category] || 'border-gray-100'}`}>
              {listing.photo_url && (
                <div className="w-full h-36 bg-gray-100">
                  <img src={`${API}${listing.photo_url}`} alt={listing.product_name} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Card header */}
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${CAT_BADGE[listing.category] || 'bg-gray-100 text-gray-600'}`}>
                    {listing.category}
                  </span>
                  {viewMode === 'mine' && STATUS_BADGE[listing.status] ? (
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${STATUS_BADGE[listing.status].cls}`}>
                      {STATUS_BADGE[listing.status].label}
                    </span>
                  ) : listing.category === 'livestock' && listing.status !== 'pending_clearance' && (
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
                  {listing.user_id === currentUser?.id ? (
                    <button onClick={() => toggleBids(listing)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-xl text-[10px] font-black uppercase hover:bg-gray-900 transition shadow-sm">
                      <Tag size={12} /> {openBidsId === listing.id ? 'Hide Bids' : 'View Bids'}
                    </button>
                  ) : listing.category !== 'livestock' && currentUser?.role === 'Farmer' ? (
                    <button onClick={() => handleOrder(listing)} className="flex items-center gap-1.5 px-4 py-2 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition shadow-sm">
                      <ArrowRight size={12} /> Order
                    </button>
                  ) : (
                    <button onClick={() => handleBid(listing)} className="flex items-center gap-1.5 px-4 py-2 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition shadow-sm">
                      <ArrowRight size={12} />
                      {currentUser?.role === 'Retailer' ? 'Bid' : 'Enquire'}
                    </button>
                  )}
                </div>
              </div>

              {/* Bids — only the listing owner sees/accepts these */}
              {listing.user_id === currentUser?.id && openBidsId === listing.id && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-2">
                  {(bidsByListing[listing.id] || []).length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic font-medium py-2">No bids yet on this listing.</p>
                  ) : (
                    bidsByListing[listing.id].map(bid => (
                      <div key={bid.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-800 truncate">{bid.bidder_name} · USD {Number(bid.amount).toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{bid.status}</p>
                        </div>
                        {bid.status === 'pending' && listing.status !== 'sold' && (
                          <button onClick={() => acceptBid(listing, bid)} className="shrink-0 px-3 py-1.5 bg-pfuma-green text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition">
                            Accept
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
