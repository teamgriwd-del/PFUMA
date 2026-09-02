import React, { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, Plus, RefreshCw, Store, ArrowRight } from 'lucide-react';

import { API } from '../../config';

const STOCK_CATEGORIES = ['medicine', 'equipment', 'feed'];
const LOW_STOCK_THRESHOLD = 10;

const STATUS_BADGE = {
  available:         { label: 'Available',  cls: 'bg-green-100 text-green-700' },
  withdrawn:         { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' },
  sold:              { label: 'Sold',       cls: 'bg-gray-200 text-gray-600' },
  pending_clearance: { label: 'Pending',    cls: 'bg-amber-100 text-amber-700' },
};

// A listing's `quantity` is the real stock level — /orders decrements it
// as farmers order, but nothing ever put it back up until this restock
// action existed. This page is what "Supply Chain" on the Supplier nav
// actually means: what's left on the shelf, and a quick way to top it up.
const RestockRow = ({ listing, onRestocked, currentUser }) => {
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lowStock = listing.status === 'available' && Number(listing.quantity) <= LOW_STOCK_THRESHOLD;
  const outOfStock = listing.status === 'withdrawn';

  const submit = async (e) => {
    e.preventDefault();
    const qty = Number(adding);
    if (!qty || qty <= 0) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/listings/${listing.id}/restock`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ add_quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not restock.'); setBusy(false); return; }
      setAdding('');
      await onRestocked();
    } catch { setError('Could not reach the PFUMA API.'); }
    setBusy(false);
  };

  return (
    <div className={`p-4 rounded-2xl border-2 ${outOfStock ? 'bg-red-50 border-red-200' : lowStock ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-black text-gray-800 truncate">{listing.product_name}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{listing.category}</p>
        </div>
        <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase shrink-0 ${STATUS_BADGE[listing.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_BADGE[listing.status]?.label || listing.status}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        {outOfStock ? (
          <span className="flex items-center gap-1 text-[11px] font-black text-red-600"><AlertTriangle size={12} /> Out of stock</span>
        ) : (
          <span className={`text-sm font-black ${lowStock ? 'text-amber-700' : 'text-gray-800'}`}>{Number(listing.quantity).toLocaleString()} {listing.unit} left</span>
        )}
        {lowStock && !outOfStock && <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase"><AlertTriangle size={10} /> Low stock</span>}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="number" min="1" placeholder="Add quantity" value={adding} onChange={e => setAdding(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 bg-gray-50 rounded-lg border-2 border-transparent focus:border-pfuma-gold outline-none font-semibold text-xs"
        />
        <button type="submit" disabled={busy || !adding} className="shrink-0 flex items-center gap-1 px-3 py-2 bg-gray-800 text-white rounded-lg font-black text-[10px] uppercase hover:bg-gray-900 transition disabled:opacity-50">
          <Plus size={12} /> {busy ? '…' : 'Restock'}
        </button>
      </form>
      {error && <p className="text-[10px] text-red-500 font-bold mt-1.5">{error}</p>}
    </div>
  );
};

const SupplierStock = ({ currentUser, setActiveTab }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?.token) return;
    try {
      const res = await fetch(`${API}/listings/mine`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) {
        const data = await res.json();
        setListings(data.filter(l => STOCK_CATEGORIES.includes(l.category) && l.status !== 'sold'));
      }
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...listings].sort((a, b) => Number(a.quantity) - Number(b.quantity));
  const outOfStockCount = listings.filter(l => l.status === 'withdrawn').length;
  const lowStockCount = listings.filter(l => l.status === 'available' && Number(l.quantity) <= LOW_STOCK_THRESHOLD).length;

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6 text-left overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Package size={20} className="text-pfuma-gold" /> Supply Chain</h2>
          <p className="text-[11px] text-gray-400 font-medium mt-1">Real stock levels for what you sell — restock here as orders come in.</p>
        </div>
        <button onClick={() => setActiveTab('marketplace')} className="flex items-center gap-2 px-4 py-2.5 bg-pfuma-gold text-white rounded-xl text-xs font-black uppercase hover:bg-amber-600 transition">
          <Store size={14} /> Post New Product <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Products</p>
          <p className="text-3xl font-black text-gray-900">{listings.length}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${lowStockCount ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Low Stock</p>
          <p className={`text-3xl font-black ${lowStockCount ? 'text-amber-700' : 'text-gray-900'}`}>{lowStockCount}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${outOfStockCount ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Out of Stock</p>
          <p className={`text-3xl font-black ${outOfStockCount ? 'text-red-700' : 'text-gray-900'}`}>{outOfStockCount}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 font-medium italic text-center py-12">Loading your stock…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-black text-gray-400">No products posted yet</p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">Post medicine, equipment or feed on the Marketplace to start selling</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(l => <RestockRow key={l.id} listing={l} currentUser={currentUser} onRestocked={load} />)}
        </div>
      )}

      <button onClick={load} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase hover:text-gray-600 transition mx-auto">
        <RefreshCw size={11} /> Refresh
      </button>
    </div>
  );
};

export default SupplierStock;
