import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Users, TrendingUp, Activity, LogOut, Search,
  CheckCircle, XCircle, ShoppingCart, AlertTriangle, Handshake, Package,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const API = 'http://localhost:5000';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <Icon size={16} className={color} />
    </div>
    <p className="text-2xl font-black text-gray-900">{value}</p>
  </div>
);

const UsersTab = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [verFilter, setVerFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

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
          {['Farmer', 'Veterinarian', 'Supplier', 'Retailer', 'Police'].map(r => <option key={r} value={r}>{r}</option>)}
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
                </div>
                <span className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${
                  u.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                  u.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>{u.verification_status}</span>
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
              </div>
            ))}
          </div>
        )}
      </div>
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

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'activity', label: 'Activity', icon: Activity },
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
        {tab === 'trends' && <TrendsTab currentUser={currentUser} />}
        {tab === 'activity' && <ActivityTab currentUser={currentUser} />}
      </div>
    </div>
  );
};

export default AdminDashboard;
