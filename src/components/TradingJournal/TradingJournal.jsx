import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, TrendingUp, Users, ArrowRight, Store } from 'lucide-react';

import { API } from '../../config';

// Shared by Supplier and Buyer — the shape of /trading-journal/mine differs
// slightly per role (Supplier trades by quantity, Buyer trades by value),
// so this renders whichever fields the response actually carries rather
// than assuming one shape.
const TradingJournal = ({ currentUser, setActiveTab }) => {
  const [totals, setTotals] = useState(null);
  const [counterparties, setCounterparties] = useState([]);
  const [loading, setLoading] = useState(true);
  const isSupplier = currentUser?.role === 'Supplier';

  const load = useCallback(async () => {
    if (!currentUser?.token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/trading-journal/mine`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) {
        const data = await res.json();
        setTotals(data.totals);
        setCounterparties(data.top_counterparties || []);
      }
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const counterpartyLabel = isSupplier ? 'Farmers you supply' : 'Sellers you buy from';

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6 text-left overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><BookOpen size={20} className="text-pfuma-green" /> Trading Journal</h2>
          <p className="text-[11px] text-gray-400 font-medium mt-1">Your real trade history on PFUMA — who you trade with most, and how much.</p>
        </div>
        <button onClick={() => setActiveTab('marketplace')} className="flex items-center gap-2 px-4 py-2.5 bg-pfuma-green text-white rounded-xl text-xs font-black uppercase hover:bg-green-700 transition">
          <Store size={14} /> {isSupplier ? 'List New Stock' : 'Browse Marketplace'} <ArrowRight size={13} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 font-medium italic text-center py-12">Loading your trading history…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Trades</p>
                <TrendingUp size={16} className="text-pfuma-green" />
              </div>
              <p className="text-3xl font-black text-gray-900">{totals?.total_trades ?? 0}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-1">
                {isSupplier ? 'Orders fulfilled to farmers' : 'Livestock purchases completed'}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {isSupplier ? 'Total Quantity Supplied' : 'Total Value Traded'}
                </p>
                <TrendingUp size={16} className="text-pfuma-gold" />
              </div>
              <p className="text-3xl font-black text-gray-900">
                {isSupplier ? Number(totals?.total_quantity ?? 0).toLocaleString() : `$${Number(totals?.total_value ?? 0).toLocaleString()}`}
              </p>
              <p className="text-[11px] text-gray-400 font-medium mt-1">Across every completed trade</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-pfuma-green" />
              <h3 className="text-sm font-black text-gray-800">{counterpartyLabel}</h3>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Your top trading partners, ranked by {isSupplier ? 'order count' : 'value traded'}</p>
            {counterparties.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
                <BookOpen size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-black text-gray-400">No completed trades yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {counterparties.map((cp, i) => (
                  <div key={cp.counterparty_id} className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-pfuma-green text-xs shrink-0 shadow-sm">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-800 truncate">{cp.counterparty_name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{cp.trade_count} trade{cp.trade_count !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-black text-pfuma-green shrink-0">
                      {isSupplier ? `${Number(cp.total_quantity).toLocaleString()} units` : `$${Number(cp.total_value).toLocaleString()}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TradingJournal;
