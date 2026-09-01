import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, Users, TrendingUp, Activity, LogOut, Search,
  CheckCircle, XCircle, ShoppingCart, AlertTriangle, Handshake, Package,
  Ban, RotateCcw, Satellite, Navigation, Crosshair, Thermometer, Heart,
  BatteryMedium, Play, Pause, RadioTower, Target, Save, Trash2,
  Upload, Database, FileSpreadsheet, UserPlus, Eye, X, FileText, Mail, Phone, MapPin,
  CreditCard, Calendar, Shield,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { API } from '../../config';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <Icon size={16} className={color} />
    </div>
    <p className="text-2xl font-black text-gray-900">{value}</p>
  </div>
);

// Every field admin_list_users' SELECT u.* already sends down (minus the
// password hash), just not previously rendered anywhere — the compact row
// only ever showed name/role/phone/org/province. This is the full record.
const DetailRow = ({ icon: Icon, label, value }) => value ? (
  <div className="flex items-start gap-2.5 py-2 min-w-0">
    {Icon && <Icon size={13} className="text-gray-400 shrink-0 mt-0.5" />}
    <div className="min-w-0">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-bold text-gray-800 break-words">{value}</p>
    </div>
  </div>
) : null;

const UserDetailModal = ({ user, currentUser, onClose }) => {
  const [docBusy, setDocBusy] = useState(null);

  const viewDocument = async (doctype) => {
    setDocBusy(doctype);
    try {
      const res = await fetch(`${API}/documents/${user.id}/${doctype}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (!res.ok) { window.alert('No document on file, or not authorized to view it.'); setDocBusy(null); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { window.alert('Could not reach the PFUMA API.'); }
    setDocBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-black text-xs shrink-0 overflow-hidden">
              {user.avatar_url ? <img src={`${API}${user.avatar_url}`} className="w-full h-full object-cover" alt="" /> : (user.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-gray-900 truncate">{user.full_name}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{user.role} · Account #{user.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 transition shrink-0"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 min-w-0">
          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Identity</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={Phone} label="Phone" value={user.phone} />
              <DetailRow icon={Mail} label="Email" value={user.email} />
              <DetailRow icon={CreditCard} label="National ID" value={user.national_id_number} />
              <DetailRow icon={Calendar} label="Registered" value={user.created_at ? new Date(user.created_at).toLocaleString() : null} />
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Location & Organisation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={MapPin} label="Org / Farm / Business Name" value={user.org_name} />
              <DetailRow icon={MapPin} label="Province" value={user.province} />
              <DetailRow icon={MapPin} label="District" value={user.district} />
              <DetailRow icon={MapPin} label="Address" value={user.address} />
            </div>
          </section>

          {(user.farm_size_ha || user.species_farmed) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Farmer Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Farm Size" value={user.farm_size_ha ? `${user.farm_size_ha} ha` : null} />
                <DetailRow label="Species Farmed" value={user.species_farmed} />
              </div>
            </section>
          )}

          {(user.license_number || user.speciality) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Veterinary Credentials</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Licence Number" value={user.license_number} />
                <DetailRow label="Speciality" value={user.speciality} />
              </div>
            </section>
          )}

          {(user.business_reg || user.supply_categories || user.trading_areas) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Business Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Business Registration" value={user.business_reg} />
                <DetailRow label="Supply Categories" value={user.supply_categories} />
                <DetailRow label="Trading Areas" value={user.trading_areas} />
              </div>
            </section>
          )}

          {(user.badge_number || user.station) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Police Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Badge Number" value={user.badge_number} />
                <DetailRow label="Station" value={user.station} />
                <DetailRow label="Jurisdiction Province" value={user.jurisdiction_province} />
                <DetailRow label="Nominated By" value={user.requested_by_name ? `${user.requested_by_name}${user.requested_by_badge ? ` (${user.requested_by_badge})` : ''}` : null} />
              </div>
            </section>
          )}

          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Verification & Account Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={Shield} label="Verification Status" value={user.verification_status} />
              <DetailRow icon={Shield} label="Account Status" value={user.account_status} />
              <DetailRow label="Verification Notes" value={user.verification_notes} />
              <DetailRow label="Suspension Reason" value={user.suspension_reason} />
            </div>
            <div className="flex gap-2 mt-2">
              {user.id_document_path && (
                <button onClick={() => viewDocument('id')} disabled={docBusy === 'id'} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-600 transition disabled:opacity-50">
                  <FileText size={12} /> {docBusy === 'id' ? 'Opening…' : 'View ID Document'}
                </button>
              )}
              {user.credential_document_path && (
                <button onClick={() => viewDocument('credential')} disabled={docBusy === 'credential'} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-600 transition disabled:opacity-50">
                  <FileText size={12} /> {docBusy === 'credential' ? 'Opening…' : 'View Credential Document'}
                </button>
              )}
            </div>
          </section>

          {user.next_of_kin_name && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Next of Kin</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Name" value={user.next_of_kin_name} />
                <DetailRow label="Phone" value={user.next_of_kin_phone} />
                <DetailRow label="Relationship" value={user.next_of_kin_relationship} />
                <DetailRow label="National ID" value={user.next_of_kin_national_id} />
                <DetailRow icon={Shield} label="Verification Status" value={user.next_of_kin_verification_status} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const UsersTab = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [verFilter, setVerFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (roleFilter) params.set('role', roleFilter);
    if (verFilter) params.set('verification_status', verFilter);
    try {
      const res = await fetch(`${API}/admin/users?${params}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) setUsers(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser.token, search, roleFilter, verFilter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, verification_status) => {
    setBusyId(id);
    try {
      await fetch(`${API}/verifications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ verification_status }),
      });
      await load();
    } catch { /* offline */ }
    setBusyId(null);
  };

  const setAccountStatus = async (id, status) => {
    let reason;
    if (status === 'suspended') {
      reason = window.prompt('Reason for suspension (shown to the user, optional):') || '';
    }
    setBusyId(id);
    try {
      await fetch(`${API}/admin/users/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ status, reason }),
      });
      await load();
    } catch { /* offline */ }
    setBusyId(null);
  };

  const verifyNextOfKin = async (id) => {
    setBusyId(id);
    try {
      await fetch(`${API}/admin/users/${id}/next-of-kin-verify`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      await load();
    } catch { /* offline */ }
    setBusyId(null);
  };

  const deleteUser = async (u) => {
    // Permanent and cascading (their animals, listings, health records —
    // everything) — suspend is the reversible option for a scammer/abuse
    // case where the record still has value. This is only for junk/
    // duplicate/test signups, so make sure that's actually what's happening.
    const confirmed = window.confirm(
      `Permanently delete ${u.full_name}'s ${u.role} account?\n\nThis cannot be undone — it also deletes everything tied to it: animals, marketplace listings, health records, messages, and more.\n\nOnly do this for a junk, duplicate, or test signup. For a scammer or abusive user, Suspend instead so the record is preserved.`
    );
    if (!confirmed) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`${API}/admin/users/${u.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) await load();
      else { const data = await res.json().catch(() => ({})); window.alert(data.error || 'Could not delete this account.'); }
    } catch { /* offline */ }
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, org…"
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pfuma-green/30" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2.5 bg-white rounded-xl border border-gray-200 text-xs font-bold">
          <option value="">All roles</option>
          {['Farmer', 'Veterinarian', 'Supplier', 'Buyer', 'Police'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={verFilter} onChange={e => setVerFilter(e.target.value)} className="px-3 py-2.5 bg-white rounded-xl border border-gray-200 text-xs font-bold">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-10">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-10">No users match.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white font-black text-[10px] shrink-0">
                  {(u.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-900">{u.full_name} <span className="text-gray-400 font-medium">· {u.role}</span></p>
                  <p className="text-[10px] text-gray-500 font-medium">{u.phone} · {u.org_name || '—'} · {u.province || '—'}{u.district ? `, ${u.district}` : ''}</p>
                  {u.role === 'Police' && u.requested_by_name && (
                    <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                      Nominated by Officer {u.requested_by_name}{u.requested_by_badge ? ` (${u.requested_by_badge})` : ''} — verify this is a real, legitimate request before approving.
                    </p>
                  )}
                </div>
                <button onClick={() => setViewingUser(u)} className="shrink-0 p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition" aria-label={`View ${u.full_name}'s full details`} title="View full details">
                  <Eye size={14} />
                </button>
                <span className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${
                  u.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                  u.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>{u.verification_status}</span>
                {u.account_status === 'suspended' && (
                  <span className="shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full uppercase bg-red-600 text-white" title={u.suspension_reason || ''}>
                    Suspended
                  </span>
                )}
                {u.verification_status === 'pending' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => resolve(u.id, 'verified')} disabled={busyId === u.id} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition disabled:opacity-50" aria-label={`Verify ${u.full_name}`}>
                      <CheckCircle size={14} />
                    </button>
                    <button onClick={() => resolve(u.id, 'rejected')} disabled={busyId === u.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50" aria-label={`Reject ${u.full_name}`}>
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
                {u.next_of_kin_name && u.next_of_kin_verification_status === 'pending' && (
                  <button onClick={() => verifyNextOfKin(u.id)} disabled={busyId === u.id} className="shrink-0 p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition disabled:opacity-50" aria-label={`Verify ${u.full_name}'s next of kin`} title={`Verify next of kin: ${u.next_of_kin_name}`}>
                    <UserPlus size={14} />
                  </button>
                )}
                {u.role !== 'Admin' && u.id !== currentUser.id && (
                  <div className="flex gap-1.5 shrink-0">
                    {u.account_status === 'suspended' ? (
                      <button onClick={() => setAccountStatus(u.id, 'active')} disabled={busyId === u.id} className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition disabled:opacity-50" aria-label={`Reactivate ${u.full_name}`} title="Reactivate">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setAccountStatus(u.id, 'suspended')} disabled={busyId === u.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50" aria-label={`Suspend ${u.full_name}`} title="Suspend (scammer/abuse)">
                        <Ban size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteUser(u)} disabled={busyId === u.id} className="p-1.5 bg-gray-50 hover:bg-red-100 text-gray-500 hover:text-red-700 rounded-lg transition disabled:opacity-50" aria-label={`Delete ${u.full_name}`} title="Delete permanently (junk/duplicate/test accounts only)">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingUser && <UserDetailModal user={viewingUser} currentUser={currentUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
};

const TrendsTab = ({ currentUser }) => {
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/admin/trends`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
        if (res.ok) setTrends(await res.json());
      } catch { /* offline — leave null, no fake fallback */ }
    })();
  }, [currentUser.token]);

  if (!trends) return <p className="text-xs text-gray-400 font-medium italic text-center py-10">Loading…</p>;

  const totalUsers = trends.users_by_role.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={totalUsers} icon={Users} color="text-pfuma-green" />
        <StatCard label="Total Animals" value={trends.total_animals} icon={ShieldCheck} color="text-blue-500" />
        <StatCard label="Cooperatives" value={trends.total_cooperatives} icon={Handshake} color="text-pfuma-gold" />
        <StatCard label="Active Outbreaks" value={trends.outbreaks_by_status.find(o => o.status === 'active')?.total || 0} icon={AlertTriangle} color="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-1">Signups (8 Weeks)</h3>
          <p className="text-[11px] text-gray-400 font-medium mb-4">New accounts per week, platform-wide</p>
          {trends.signups_per_week.length === 0 ? (
            <p className="text-xs text-gray-400 font-medium italic text-center py-10">No signups in this window yet.</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.signups_per_week} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="week" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} />
                  <Area type="monotone" dataKey="signups" stroke="#1b5e20" fill="#1b5e2022" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-1">Users by Role</h3>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Platform composition</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.users_by_role} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="role" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} />
                <Bar dataKey="total" fill="#ca8a04" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-1">Animals Registered (8 Weeks)</h3>
          {trends.animals_per_week.length === 0 ? (
            <p className="text-xs text-gray-400 font-medium italic text-center py-10">No new animals in this window yet.</p>
          ) : (
            <div className="h-40 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.animals_per_week} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="week" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} />
                  <Area type="monotone" dataKey="animals" stroke="#1565c0" fill="#1565c022" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-3">Listings by Category</h3>
          {trends.listings_by_category.length === 0 ? (
            <p className="text-xs text-gray-400 font-medium italic text-center py-10">No listings yet.</p>
          ) : (
            <div className="space-y-2">
              {trends.listings_by_category.map(l => (
                <div key={l.category} className="flex items-center justify-between text-xs font-bold text-gray-600">
                  <span className="capitalize">{l.category}</span><span className="text-gray-900">{l.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ListingsTab = ({ currentUser }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    try {
      const res = await fetch(`${API}/listings?${params}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) setListings(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser.token, search]);

  useEffect(() => { load(); }, [load]);

  const takeDown = async (id) => {
    if (!window.confirm('Remove this listing from the marketplace? It will no longer be visible to buyers.')) return;
    setBusyId(id);
    try {
      await fetch(`${API}/admin/listings/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      await load();
    } catch { /* offline */ }
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search live listings by product name…"
          className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pfuma-green/30" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-10">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-10">No live listings match.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {listings.map(l => (
              <div key={l.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-900">{l.product_name} <span className="text-gray-400 font-medium capitalize">· {l.category}</span></p>
                  <p className="text-[10px] text-gray-500 font-medium">${l.price} · {l.seller_name} · {l.phone} · {l.seller_province || '—'}</p>
                </div>
                <button onClick={() => takeDown(l.id)} disabled={busyId === l.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50 shrink-0" aria-label={`Remove ${l.product_name}`} title="Take down (scam/abuse)">
                  <Ban size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ACTIVITY_ICON = { signup: Users, listing: ShoppingCart, outbreak: AlertTriangle, cooperative: Handshake };

const ActivityTab = ({ currentUser }) => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/admin/activity`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
        if (res.ok) setFeed(await res.json());
      } catch { /* offline — leave empty, no fake fallback */ }
      setLoading(false);
    })();
  }, [currentUser.token]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-black text-gray-800 mb-1">Recent Activity — Platform-Wide</h3>
      <p className="text-[11px] text-gray-400 font-medium mb-4">Everything happening across every account, most recent first.</p>
      {loading ? (
        <p className="text-xs text-gray-400 font-medium italic text-center py-10">Loading…</p>
      ) : feed.length === 0 ? (
        <p className="text-xs text-gray-400 font-medium italic text-center py-10">Nothing yet.</p>
      ) : (
        <div className="space-y-2.5">
          {feed.map((item, i) => {
            const Icon = ACTIVITY_ICON[item.type] || Activity;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800">{item.text}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{new Date(item.at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── IoT Demo Control ─────────────────────────────────────────────
// Show-floor backup plan: the real CN-01/BS-01 hardware isn't ready, so an
// admin drives an animal's position and vitals by hand from here. Every
// push writes a normal iot_readings row against a dedicated "SIM-<id>"
// virtual collar (see backend /admin/iot/simulate) — so the ordinary
// Farmer/Vet/Police IoT tab shows it exactly like a real live collar,
// including geofence breach detection, with zero special-casing there.
const COMPASS = [
  { dir: 'NW', row: 1, col: 1 }, { dir: 'N', row: 1, col: 2 }, { dir: 'NE', row: 1, col: 3 },
  { dir: 'W',  row: 2, col: 1 },                               { dir: 'E',  row: 2, col: 3 },
  { dir: 'SW', row: 3, col: 1 }, { dir: 'S', row: 3, col: 2 }, { dir: 'SE', row: 3, col: 3 },
];

const IoTControlTab = ({ currentUser }) => {
  const authHeaders = { Authorization: `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' };

  const [farmers, setFarmers] = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [animalId, setAnimalId] = useState('');
  const [geofence, setGeofence] = useState(null);
  const [lastPush, setLastPush] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [autoWalk, setAutoWalk] = useState(false);
  const [stepM, setStepM] = useState(20);

  const [vitals, setVitals] = useState({ temp_c: 38.5, heart_rate: 72, battery_pct: 88 });
  const [zoneForm, setZoneForm] = useState({ name: 'Show Floor Demo Zone', radius_m: 60 });

  const autoWalkRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/admin/iot/targets`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setFarmers(data);
          if (data.length > 0) {
            setOwnerId(String(data[0].owner_id));
            if (data[0].animals.length > 0) setAnimalId(String(data[0].animals[0].id));
          }
        }
      } catch { /* offline */ }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  const loadGeofence = useCallback(async (oid) => {
    if (!oid) return;
    try {
      const res = await fetch(`${API}/admin/iot/geofence/${oid}`, { headers: authHeaders });
      if (res.ok) setGeofence(await res.json());
    } catch { /* offline */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.token]);

  useEffect(() => { if (ownerId) loadGeofence(ownerId); }, [ownerId, loadGeofence]);

  const currentFarmer = farmers.find(f => String(f.owner_id) === String(ownerId));

  const push = useCallback(async (payload) => {
    if (!animalId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/iot/simulate`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ animal_id: Number(animalId), step_m: stepM, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastPush(data);
        setVitals({ temp_c: data.temp_c, heart_rate: data.heart_rate, battery_pct: data.battery_pct });
        setFeedback(null);
      } else {
        setFeedback(data.error || 'Push failed');
      }
    } catch {
      setFeedback('Offline — could not reach the PFUMA API');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId, stepM, currentUser.token]);

  useEffect(() => {
    if (autoWalk) {
      autoWalkRef.current = setInterval(() => push({ direction: 'random' }), 3000);
    } else if (autoWalkRef.current) {
      clearInterval(autoWalkRef.current);
    }
    return () => { if (autoWalkRef.current) clearInterval(autoWalkRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWalk, push]);

  const saveGeofence = async () => {
    if (!ownerId) return;
    const center = lastPush ? { center_lat: lastPush.latitude, center_lon: lastPush.longitude }
      : geofence ? { center_lat: geofence.center_lat, center_lon: geofence.center_lon }
      : {};
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/iot/geofence`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ owner_id: Number(ownerId), name: zoneForm.name, radius_m: Number(zoneForm.radius_m), ...center }),
      });
      const data = await res.json();
      if (res.ok) { setFeedback('Geofence saved ✅'); loadGeofence(ownerId); }
      else setFeedback(data.error || 'Could not save geofence');
    } catch {
      setFeedback('Offline — could not reach the PFUMA API');
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-2xl p-5 flex items-start gap-3">
        <Satellite size={18} className="text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-black text-white">IoT Demo Control</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5 leading-relaxed">
            Drive an animal's collar position and vitals by hand. Every push shows up live on that farmer's own IoT tab — same as a real collar would — for exhibit demos while the physical hardware isn't wired up yet.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Target selector */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 lg:col-span-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Farmer</label>
            <select value={ownerId} onChange={e => { setOwnerId(e.target.value); const f = farmers.find(x => String(x.owner_id) === e.target.value); setAnimalId(f?.animals[0] ? String(f.animals[0].id) : ''); }}
              className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold">
              {farmers.length === 0 && <option value="">No farmers with animals yet</option>}
              {farmers.map(f => <option key={f.owner_id} value={f.owner_id}>{f.owner_name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Animal</label>
            <select value={animalId} onChange={e => setAnimalId(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold">
              {(currentFarmer?.animals || []).map(a => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
            </select>
          </div>
          {feedback && <span className="text-[11px] font-bold text-pfuma-green">{feedback}</span>}
        </div>

        {/* Movement */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Navigation size={15} className="text-pfuma-green" />
            <h4 className="text-sm font-black text-gray-800">Move Collar</h4>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Nudge the animal's GPS position — watch it move live on the farmer's dashboard.</p>

          <div className="grid grid-cols-3 gap-2 w-40 mx-auto mb-4">
            {COMPASS.map(({ dir, row, col }) => (
              <button key={dir} disabled={busy} onClick={() => push({ direction: dir })}
                style={{ gridRow: row, gridColumn: col }}
                className="aspect-square flex items-center justify-center bg-gray-50 hover:bg-pfuma-green hover:text-white text-gray-500 rounded-xl text-[10px] font-black uppercase transition disabled:opacity-50">
                {dir}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Step (m)</label>
            <input type="number" min="5" max="200" value={stepM} onChange={e => setStepM(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold" />
          </div>

          <div className="flex gap-2">
            <button disabled={busy} onClick={() => push({ direction: 'reset' })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase transition">
              <Crosshair size={12} /> Center
            </button>
            <button disabled={busy} onClick={() => setAutoWalk(p => !p)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase transition ${autoWalk ? 'bg-pfuma-green text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
              {autoWalk ? <Pause size={12} /> : <Play size={12} />} {autoWalk ? 'Stop Walk' : 'Auto-Walk'}
            </button>
          </div>

          {lastPush && (
            <div className={`mt-3 p-2.5 rounded-xl text-[10px] font-bold ${lastPush.in_zone ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {lastPush.in_zone ? 'Inside geofence' : 'OUTSIDE geofence'} · {lastPush.distance_from_center_m}m from center
            </div>
          )}
        </div>

        {/* Vitals */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Heart size={15} className="text-pfuma-green" />
            <h4 className="text-sm font-black text-gray-800">Vitals</h4>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Push a health reading — trigger a fever or theft alert on demand.</p>

          <div className="space-y-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Thermometer size={13} className="text-gray-400 shrink-0" />
              <input type="number" step="0.1" value={vitals.temp_c} onChange={e => setVitals(v => ({ ...v, temp_c: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold" />
              <span className="text-[10px] text-gray-400 font-bold shrink-0">°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart size={13} className="text-gray-400 shrink-0" />
              <input type="number" value={vitals.heart_rate} onChange={e => setVitals(v => ({ ...v, heart_rate: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold" />
              <span className="text-[10px] text-gray-400 font-bold shrink-0">BPM</span>
            </div>
            <div className="flex items-center gap-2">
              <BatteryMedium size={13} className="text-gray-400 shrink-0" />
              <input type="number" min="0" max="100" value={vitals.battery_pct} onChange={e => setVitals(v => ({ ...v, battery_pct: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold" />
              <span className="text-[10px] text-gray-400 font-bold shrink-0">%</span>
            </div>
          </div>

          <button disabled={busy} onClick={() => push({ temp_c: Number(vitals.temp_c), heart_rate: Number(vitals.heart_rate), battery_pct: Number(vitals.battery_pct) })}
            className="w-full py-2 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase mb-2 hover:bg-green-700 transition disabled:opacity-50">
            Push Vitals
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => push({ temp_c: 38.5, heart_rate: 72, fever: false, theft: false })}
              className="py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase transition">Normal</button>
            <button disabled={busy} onClick={() => push({ temp_c: 41.0, fever: true })}
              className="py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-[10px] font-black uppercase transition">Fever</button>
            <button disabled={busy} onClick={() => push({ battery_pct: 8 })}
              className="py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase transition">Low Battery</button>
            <button disabled={busy} onClick={() => push({ theft: true, direction: 'random', step_m: 300 })}
              className="py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase transition">Theft / Breach</button>
          </div>
        </div>

        {/* Geofence */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <RadioTower size={15} className="text-pfuma-green" />
            <h4 className="text-sm font-black text-white">Geofence</h4>
          </div>
          <p className="text-[11px] text-gray-500 font-medium mb-4">The safe-zone boundary shown on this farmer's IoT tab.</p>

          {geofence && (
            <div className="bg-white/5 rounded-xl p-3 mb-4 space-y-1">
              <p className="text-[11px] font-black text-white">{geofence.name}{geofence.is_default && <span className="text-gray-500 font-medium"> (default)</span>}</p>
              <p className="text-[10px] text-gray-400 font-medium">{geofence.center_lat.toFixed(5)}, {geofence.center_lon.toFixed(5)} · {geofence.radius_m}m radius</p>
            </div>
          )}

          <div className="space-y-2.5 mb-3">
            <input value={zoneForm.name} onChange={e => setZoneForm(z => ({ ...z, name: e.target.value }))} placeholder="Zone name"
              className="w-full px-2.5 py-1.5 bg-white/5 text-white placeholder-gray-500 rounded-lg border border-white/10 text-xs font-bold outline-none" />
            <div className="flex items-center gap-2">
              <Target size={13} className="text-gray-400 shrink-0" />
              <input type="number" min="10" value={zoneForm.radius_m} onChange={e => setZoneForm(z => ({ ...z, radius_m: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white/5 text-white rounded-lg border border-white/10 text-xs font-bold outline-none" />
              <span className="text-[10px] text-gray-400 font-bold shrink-0">m radius</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium mb-3 leading-relaxed">
            Centers on the animal's last pushed position{!lastPush && ' (or the current zone center if it hasn\'t moved yet)'}. Move the collar to where you want the center first, then save.
          </p>
          <button disabled={busy || !ownerId} onClick={saveGeofence}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-600 transition disabled:opacity-50">
            <Save size={12} /> Save New Geofence
          </button>
        </div>
      </div>
    </div>
  );
};

// ── DATA IMPORT & FUSION ─────────────────────────────────────────────
// Lets an Admin (not a developer) bulk-fuse an external registry export —
// a DVS/CVSZ vet list, a ZRP roster — into existing accounts, matched by
// national_id_number. Every write goes through POST /admin/import, which
// is audit-logged server-side; this tab is a thin UI over that one endpoint.
const DataImportTab = ({ currentUser }) => {
  const [sourceLabel, setSourceLabel] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API}/admin/import-logs`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) setLogs(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    setLogsLoading(false);
  }, [currentUser.token]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const runImport = async (commit) => {
    if (!file || !sourceLabel.trim()) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('csv_file', file);
      fd.append('source_label', sourceLabel);
      fd.append('commit', commit ? 'true' : 'false');
      const res = await fetch(`${API}/admin/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Import failed.'); setBusy(false); return; }
      setPreview(data);
      if (commit) await loadLogs();
    } catch { setError('Could not reach the PFUMA API.'); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-gray-800">Import & Fuse External Data</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
            Upload a CSV (e.g. a DVS vet registry export, a ZRP roster) to verify and update matching accounts.
            Rows are matched to existing users by their <code className="bg-gray-100 px-1 rounded">national_id_number</code> column —
            every CSV must include one. Optional columns: <code className="bg-gray-100 px-1 rounded">license_number</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">badge_number</code>, <code className="bg-gray-100 px-1 rounded">station</code>.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} placeholder="Source name, e.g. DVS Vet Registry"
            className="px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pfuma-green/30" />
          <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm font-medium cursor-pointer">
            <Upload size={15} className="text-gray-400 shrink-0" />
            <span className="truncate">{file ? file.name : 'Choose a .csv file…'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setError(''); }} />
          </label>
        </div>
        {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => runImport(false)} disabled={busy || !file || !sourceLabel.trim()}
            className="px-5 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 transition disabled:opacity-50">
            {busy ? 'Working…' : 'Preview (Dry Run)'}
          </button>
          <button onClick={() => runImport(true)} disabled={busy || !preview || preview.committed}
            className="px-5 py-2.5 bg-pfuma-green text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50">
            {busy ? 'Working…' : 'Confirm & Import'}
          </button>
        </div>

        {preview && (
          <div className={`rounded-xl border p-4 ${preview.committed ? 'bg-pfuma-green/5 border-pfuma-green/20' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-xs font-black text-gray-800">
              {preview.committed ? 'Imported ✅' : 'Preview — nothing written yet'}
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">
              {preview.row_count} row{preview.row_count !== 1 ? 's' : ''} · {preview.matched_count} matched to existing accounts · {preview.unmatched_count} unmatched
            </p>
            {preview.preview?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {preview.preview.map(m => (
                  <p key={m.id} className="text-[11px] text-gray-600 font-medium">— {m.full_name} ({m.role})</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><Database size={14} className="text-gray-400" /> Import History</h3>
        </div>
        {logsLoading ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-8">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium italic text-center py-8">No imports yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-4">
                <FileSpreadsheet size={16} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-800">{l.source_label} <span className="text-gray-400 font-medium">— {l.filename}</span></p>
                  <p className="text-[10px] text-gray-500 font-medium">{l.matched_count}/{l.row_count} matched · by {l.admin_name} · {new Date(l.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'listings', label: 'Listings', icon: Package },
  { id: 'iot', label: 'IoT Control', icon: Satellite },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'import', label: 'Data Import', icon: Database },
];

const AdminDashboard = ({ currentUser, onLogout }) => {
  const [tab, setTab] = useState('users');

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pfuma-green rounded-xl flex items-center justify-center"><ShieldCheck size={18} className="text-white" /></div>
          <div>
            <p className="text-white font-black text-sm leading-none">PFUMA Admin</p>
            <p className="text-gray-400 text-[10px] font-medium mt-0.5">Platform oversight</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase transition">
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      <div className="bg-white border-b border-gray-100 px-6 flex gap-1 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wide border-b-2 transition ${tab === t.id ? 'border-pfuma-green text-pfuma-green' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'users' && <UsersTab currentUser={currentUser} />}
        {tab === 'listings' && <ListingsTab currentUser={currentUser} />}
        {tab === 'iot' && <IoTControlTab currentUser={currentUser} />}
        {tab === 'trends' && <TrendsTab currentUser={currentUser} />}
        {tab === 'activity' && <ActivityTab currentUser={currentUser} />}
        {tab === 'import' && <DataImportTab currentUser={currentUser} />}
      </div>
    </div>
  );
};

export default AdminDashboard;
