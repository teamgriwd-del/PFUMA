import React, { useState, useMemo, useEffect, useCallback } from 'react';
import pfumaMark          from './assets/pfuma-mark.png';
import DiseaseDetection  from './components/DiseaseDetection/DiseaseDetection';
import AnimalProfile     from './components/AnimalProfile/AnimalProfile';
import HealthManagement  from './components/HealthManagement/HealthManagement';
import VetCommunication  from './components/VetCommunication/VetCommunication';
import Marketplace       from './components/Marketplace/Marketplace';
import FeedAnalyzer      from './components/FeedAnalyzer/FeedAnalyzer';
import Cooperative       from './components/Cooperative/Cooperative';
import AdminDashboard    from './components/Admin/AdminDashboard';
import Jinda      from './components/IntelAI/PfumaIntelAI';
import AuthPortal        from './components/IntelAI/AuthPortal';
import ErrorBoundary     from './components/ErrorBoundary';
import { HEALTH_PROTOCOLS } from './components/HealthManagement/healthData';
import {
  LayoutDashboard, Users, HeartPulse, Stethoscope, MessageSquare,
  Bell, LogOut, ShieldCheck, TrendingUp, Package, ShoppingCart, Activity,
  Truck, BarChart3, Globe, AlertTriangle, CheckCircle, ChevronRight,
  Zap, Clock, ArrowRight, Tag, Pill, MapPin, FileText,
  RefreshCw, DollarSign, Target, Box, PhoneCall, Star, Wheat, Store,
  Sprout, Check, Syringe, Shield, UserPlus, X, Menu, Eye, EyeOff, Handshake,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
import './App.css';

import { API } from './config';


// ── shared helpers ─────────────────────────────────────────────────────────
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ── Stakeholder Map — shown on all dashboards ──────────────────────────────
const StakeholderMap = () => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
    <div className="flex items-center gap-2 mb-1">
      <Globe size={15} className="text-pfuma-green" />
      <h3 className="text-sm font-black text-gray-800">How PFUMA Connects Everyone</h3>
    </div>
    <p className="text-[11px] text-gray-400 font-medium mb-5">
      PFUMA is a four-stakeholder ecosystem. Every role plays a specific part — here's how they all connect.
    </p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {[
        { icon: Sprout,      role: 'Farmer',      color: 'bg-green-50 border-green-200',   text: 'text-green-800',  desc: 'Registers animals, tracks health, orders medicines, and lists livestock for sale.' },
        { icon: Pill,        role: 'Supplier',     color: 'bg-orange-50 border-orange-200', text: 'text-orange-800', desc: 'Distributes vaccines, medicines, and feed to farmers. Receives orders through PFUMA.' },
        { icon: Store,       role: 'Retailer',     color: 'bg-purple-50 border-purple-200', text: 'text-purple-800', desc: 'Browses certified livestock listed by farmers, places bids, and receives DVS trade certificates.' },
        { icon: Stethoscope, role: 'Veterinarian', color: 'bg-blue-50 border-blue-200',     text: 'text-blue-800',   desc: 'Certifies animal health, issues movement permits, and manages regional disease outbreaks.' },
      ].map(r => (
        <div key={r.role} className={`${r.color} border rounded-xl p-3`}>
          <r.icon size={20} className={`${r.text} mb-1.5`} />
          <p className={`text-xs font-black ${r.text} uppercase mb-1`}>{r.role}</p>
          <p className="text-[10px] text-gray-500 font-medium leading-snug">{r.desc}</p>
        </div>
      ))}
    </div>
    {/* Flow arrows */}
    <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">How it flows</p>
      {[
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Pill,        to: 'Supplier', desc: 'orders medicines & vaccines' },
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Stethoscope, to: 'Vet',      desc: 'requests health checks & movement certificates' },
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Store,       to: 'Retailer', desc: 'lists animals for sale on the marketplace' },
        { fromIcon: Store,       from: 'Retailer', toIcon: Sprout,      to: 'Farmer',   desc: 'places a bid / makes an offer to buy' },
        { fromIcon: Stethoscope, from: 'Vet',      toIcon: Store,       to: 'Retailer', desc: 'issues official DVS movement certificate for the sale' },
      ].map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 flex-wrap">
          <f.fromIcon size={12} className="text-gray-700 shrink-0" />
          <span className="font-black text-gray-800 shrink-0">{f.from}</span>
          <ArrowRight size={11} className="text-gray-400 shrink-0" />
          <f.toIcon size={12} className="text-gray-700 shrink-0" />
          <span className="font-black text-gray-800 shrink-0">{f.to}</span>
          <span className="text-gray-400 shrink-0">—</span>
          <span>{f.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

const KpiCard = ({ label, value, sub, accent = 'bg-white border-gray-100', textColor = 'text-gray-900', icon: Icon, iconColor = 'text-gray-400', onClick }) => (
  <div
    onClick={onClick}
    className={`${accent} border rounded-2xl p-5 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`}
  >
    <div className="flex justify-between items-start">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      {Icon && <Icon size={16} className={iconColor} />}
    </div>
    <p className={`text-3xl font-black leading-none ${textColor}`}>{value}</p>
    {sub && <p className="text-[11px] text-gray-400 font-medium leading-snug">{sub}</p>}
  </div>
);

const QuickAction = ({ icon: Icon, label, desc, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 w-full p-4 bg-white rounded-2xl border-2 border-gray-100 hover:border-pfuma-green hover:shadow-md transition group text-left"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-black text-gray-800">{label}</p>
      <p className="text-[10px] text-gray-400 font-medium truncate">{desc}</p>
    </div>
    <ArrowRight size={14} className="text-gray-300 group-hover:text-pfuma-green transition shrink-0" />
  </button>
);

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 mt-1">{children}</p>
);

// ── FARMER DASHBOARD ───────────────────────────────────────────────────────
const FarmerDashboard = ({ animals, auditLog, inventory, notifications, nearbyFarmers, currentUser, setActiveTab, onListAnimal }) => {
  const [outbreaks, setOutbreaks] = useState([]);

  useEffect(() => {
    if (!currentUser?.token) return;
    (async () => {
      try {
        const res = await fetch(`${API}/outbreaks`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
        if (res.ok) setOutbreaks(await res.json());
      } catch { /* offline — leave empty, no fake fallback */ }
    })();
  }, [currentUser?.token]);

  const totalValue  = animals.reduce((acc, a) => acc + 500 + a.currentWeight * 1.5, 0);
  const forSale     = animals.filter(a => a.forSale).length;
  const lowStock    = inventory.filter(i => i.stock <= i.min);
  // Real outbreak reports in the farmer's own province (filed by a Vet/Police
  // officer) — replaces the old static/fake "critical alert" content.
  const critAlerts  = outbreaks.map(o => ({
    id: `outbreak-${o.id}`, title: `${o.disease_name} Outbreak`,
    msg: `${o.district ? `${o.district}, ` : ''}${o.province}. ${o.details || ''}`.trim(),
    type: 'Critical', time: new Date(o.created_at).toLocaleDateString(),
  }));

  // Compute overdue vaccines across all animals — a milestone only counts as
  // overdue if the farmer hasn't actually logged it in health_events (or
  // logged it with a next_due_date that's now in the past). Age-past-due
  // alone isn't enough: that would flag every already-vaccinated animal
  // forever, since it never checked what was actually administered.
  const overdueVaccines = useMemo(() => {
    const rows = [];
    animals.forEach(a => {
      if (!a.birthDate) return;
      const birth = new Date(a.birthDate);
      const animalLog = auditLog.filter(e => e.animalId === a.id);
      (HEALTH_PROTOCOLS[a.species]?.vaccines || []).forEach(v => {
        const due = new Date(birth);
        due.setDate(birth.getDate() + v.age);
        if (new Date() <= due) return;

        const logged = animalLog
          .filter(e => e.eventType?.toLowerCase().startsWith(v.name.toLowerCase()))
          .sort((x, y) => new Date(y.eventDate) - new Date(x.eventDate))[0];
        if (!logged) { rows.push({ animal: a.name, vaccine: v.name }); return; }
        if (logged.nextDueDate && new Date(logged.nextDueDate) < new Date()) {
          rows.push({ animal: a.name, vaccine: v.name });
        }
        // Logged with no next_due_date, or next_due_date still in the future — current.
      });
    });
    return rows.slice(0, 4);
  }, [animals, auditLog]);

  const priorityRows = [
    ...overdueVaccines.map(v => ({
      icon: Syringe, iconBg: 'bg-red-50', iconColor: 'text-red-600',
      tagBg: 'bg-red-50', tagColor: 'text-red-600', tag: 'Overdue',
      title: v.vaccine, sub: `${v.animal} — vaccine due`, onClick: () => setActiveTab('health'),
    })),
    ...lowStock.map(item => ({
      icon: Package, iconBg: 'bg-orange-50', iconColor: 'text-orange-600',
      tagBg: 'bg-orange-50', tagColor: 'text-orange-600', tag: 'Low Stock',
      title: item.name, sub: `${item.stock}${item.unit} remaining`,
    })),
    ...critAlerts.map(n => ({
      icon: AlertTriangle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
      tagBg: 'bg-amber-50', tagColor: 'text-amber-600', tag: 'Alert',
      title: n.title, sub: n.msg, onClick: () => setActiveTab('disease'),
    })),
  ];

  const recentLogs = auditLog.slice(0, 4);

  return (
    <div className="p-6 bg-pfuma-cream space-y-6 text-left overflow-y-auto h-full">

      {/* Greeting banner */}
      <div className="bg-pfuma-green rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-green-200 text-xs font-black uppercase tracking-[3px] mb-1">{greet()}, Farmer</p>
            <h2 className="text-2xl font-black text-white leading-tight">Here's your farm today</h2>
            <p className="text-green-200/80 text-sm font-medium mt-1">
              {animals.length} animal{animals.length !== 1 ? 's' : ''} registered · {critAlerts.length} critical alert{critAlerts.length !== 1 ? 's' : ''} · {overdueVaccines.length} overdue vaccine{overdueVaccines.length !== 1 ? 's' : ''}
            </p>
          </div>
          {critAlerts.length > 0 && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-2xl px-5 py-3 flex items-center gap-2 shrink-0">
              <AlertTriangle size={16} className="text-red-300 animate-pulse" />
              <span className="text-sm font-black text-red-200">{critAlerts.length} Critical Alert{critAlerts.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Your Role on PFUMA */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1.5">Your Role on PFUMA</p>
        <h3 className="text-sm font-black text-gray-900 mb-2">You are the heart of the herd</h3>
        <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-4">
          Register your animals, track their health, and reorder medicine before stocks run low. When ready, list animals on the Marketplace — a DVS vet certifies them so retailers across Zimbabwe can bid with confidence.
        </p>
        <div className="flex items-center gap-2 flex-wrap bg-green-50 rounded-xl px-3 py-2.5 text-[11px] font-bold text-pfuma-green">
          <Sprout size={15} />
          <span>You raise & register</span>
          <ArrowRight size={12} className="text-pfuma-green/50" />
          <Stethoscope size={15} />
          <span>Vet certifies health</span>
          <ArrowRight size={12} className="text-pfuma-green/50" />
          <Store size={15} />
          <span>Retailer buys</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Animals"    value={animals.length}            sub="In your herd registry"                icon={Tag}         iconColor="text-pfuma-green"  onClick={() => setActiveTab('profile')} />
        <KpiCard label="Herd Value"       value={`$${totalValue.toLocaleString()}`} sub="Estimated market value"       icon={DollarSign}  iconColor="text-pfuma-gold"   accent="bg-pfuma-gold/5 border-pfuma-gold/20" />
        <KpiCard label="Overdue Vaccines" value={overdueVaccines.length}    sub={overdueVaccines.length ? 'Need immediate attention' : 'All vaccinations current'} icon={ShieldCheck} iconColor={overdueVaccines.length ? 'text-red-500' : 'text-green-500'} accent={overdueVaccines.length ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'} textColor={overdueVaccines.length ? 'text-red-600' : 'text-gray-900'} onClick={() => setActiveTab('health')} />
        <KpiCard label="Listed for Sale"  value={forSale}                   sub={forSale ? 'Visible on marketplace' : 'None listed yet'} icon={ShoppingCart} iconColor="text-purple-500" onClick={() => setActiveTab('profile')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Priority Actions + Quick Nav */}
        <div className="col-span-1 space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-yellow-500" />
                <h3 className="text-sm font-black text-gray-800">Priority Actions</h3>
              </div>
              {priorityRows.length > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full">{priorityRows.length}</span>
              )}
            </div>
            {priorityRows.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle size={28} className="text-pfuma-green mb-2" />
                <p className="text-xs font-black text-gray-500">All good — no urgent actions</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Your farm is running smoothly</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 mt-3">
                {priorityRows.map((p, i) => {
                  const Row = p.onClick ? 'button' : 'div';
                  return (
                    <Row key={i} onClick={p.onClick} className={`w-full flex items-center gap-3 py-2.5 text-left ${p.onClick ? 'hover:bg-gray-50 -mx-1 px-1 rounded-lg transition cursor-pointer' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg}`}>
                        <p.icon size={16} className={p.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-gray-800 truncate">{p.title}</p>
                        <p className="text-[10px] text-gray-400 font-medium truncate">{p.sub}</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide shrink-0 ${p.tagBg} ${p.tagColor}`}>{p.tag}</span>
                    </Row>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick navigation */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-3">Quick Navigation</h3>
            <div className="space-y-2">
              <QuickAction icon={Users}       label="Herd Registry"  desc="View & manage your animals"    color="bg-pfuma-green"  onClick={() => setActiveTab('profile')} />
              <QuickAction icon={HeartPulse}  label="Lifecycle"      desc="Vaccines & health protocols"   color="bg-blue-500"    onClick={() => setActiveTab('health')} />
              <QuickAction icon={Stethoscope} label="Diagnostics"    desc="AI disease checker"            color="bg-purple-500"  onClick={() => setActiveTab('disease')} />
              <QuickAction icon={MessageSquare} label="Messenger"     desc="Chat with vets, suppliers & farmers" color="bg-teal-500" onClick={() => setActiveTab('vet')} />
            </div>
          </div>
        </div>

        {/* Middle: Sell Your Animals */}
        <div className="col-span-1 space-y-5">
          {/* Sell animals panel */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={15} className="text-purple-600" />
              <h3 className="text-sm font-black text-gray-800">Sell Your Animals</h3>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-4 leading-snug">
              Toggle any animal below to list it on the PFUMA Marketplace. Retailers and livestock buyers will immediately see it and can place a bid. You control the listing — remove it any time.
            </p>

            {animals.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                <span className="text-4xl">🐄</span>
                <p className="text-xs text-gray-400 font-medium mt-2">No animals registered yet</p>
                <button onClick={() => setActiveTab('profile')} className="mt-3 px-4 py-2 bg-pfuma-green text-white rounded-xl text-xs font-black uppercase hover:bg-green-700 transition">Register an Animal</button>
              </div>
            ) : (
              <div className="space-y-3">
                {animals.map(a => (
                  <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${a.forSale ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                      <img src={a.imageUrl} className="w-full h-full object-cover" alt={a.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-800">{a.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{a.species} · {a.currentWeight}kg</p>
                      {a.forSale && (
                        <p className="text-[9px] font-black text-yellow-700 mt-0.5 flex items-center gap-1"><Check size={10} /> Visible to retailers now</p>
                      )}
                    </div>
                    <button
                      onClick={() => onListAnimal(a.id)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition ${
                        a.forSale
                          ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                          : 'bg-pfuma-green text-white hover:bg-green-700'
                      }`}
                    >
                      {a.forSale ? 'Unlist' : 'List for Sale'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* What happens next */}
            {animals.some(a => a.forSale) && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-[10px] font-black text-purple-700 uppercase mb-1">What happens next</p>
                <div className="space-y-1">
                  {['Retailers browse your listing on the Marketplace', 'A retailer places a bid — you receive it via PFUMA Messenger', 'Vet issues a DVS movement certificate for the sale'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-purple-600 font-medium">
                      <span className="w-4 h-4 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">{i + 1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Medicine cabinet */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-black text-gray-800">Medicine Cabinet</h3>
              <button onClick={() => setActiveTab('health')} className="text-[10px] font-black text-pfuma-green hover:underline uppercase">Manage →</button>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Your current medicine stock. Medicines are supplied by registered PFUMA Suppliers — contact them via PFUMA Messenger.</p>
            <div className="space-y-3">
              {inventory.map(item => {
                const isLow = item.stock <= item.min;
                const pct   = Math.min(100, (item.stock / 1000) * 100);
                return (
                  <div key={item.id} className={`p-3 rounded-xl ${isLow ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-[11px] font-black text-gray-700 truncate">{item.name}</p>
                      {isLow && <span className="text-[9px] font-black text-red-600 animate-pulse">Low — reorder</span>}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium mb-1">
                      <span>{item.stock} {item.unit}</span>
                      <span className="text-gray-300">from {item.supplier}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isLow ? 'bg-red-500' : pct > 50 ? 'bg-pfuma-green' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setActiveTab('vet')} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[10px] font-black text-orange-700 uppercase hover:bg-orange-100 transition">
              <MessageSquare size={12} /> Order from a Supplier
            </button>
          </div>
        </div>

        {/* Right: Recent activity + alerts */}
        <div className="col-span-1 space-y-5">
          {/* Alerts */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4">Disease Alerts Near You</h3>
            <div className="space-y-3">
              {critAlerts.length === 0 ? (
                <p className="text-[11px] text-gray-400 font-medium italic text-center py-3">No active outbreaks reported in {currentUser?.province || 'your province'}.</p>
              ) : critAlerts.map(n => (
                <div key={n.id} className="p-3.5 rounded-xl border-l-4 bg-red-50 border-red-500">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-red-500" />
                    <div>
                      <p className="text-[11px] font-black text-gray-800">{n.title}</p>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">{n.msg}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setActiveTab('disease')} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 rounded-xl text-[11px] font-black text-gray-500 uppercase hover:bg-gray-100 hover:text-pfuma-green transition">
                <Stethoscope size={12} /> Run Diagnostics
              </button>
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4">Recent Health Events</h3>
            {recentLogs.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium text-center py-4 italic">No events recorded yet</p>
            ) : (
              <div className="space-y-2.5">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-pfuma-green mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-800 truncate">{log.action}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{log.animal} · {log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weight trend for first animal */}
          {animals[0]?.weightHistory?.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-1">{animals[0].name}'s Weight Trend</h3>
              <p className="text-[10px] text-gray-400 font-medium mb-4">Growth in kg from birth</p>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={animals[0].weightHistory} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="wt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1b5e20" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1b5e20" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                    <YAxis fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={v => [`${v}kg`, 'Weight']} />
                    <Area type="monotone" dataKey="weight" stroke="#1b5e20" fill="url(#wt)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Farmers Near You */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users size={15} className="text-pfuma-green" />
              <h3 className="text-sm font-black text-gray-800">Farmers Near You</h3>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Connect with other PFUMA farmers to swap tips, feed, or breeding stock.</p>
            {nearbyFarmers.length === 0 ? (
              <p className="text-xs text-gray-400 italic font-medium text-center py-4">No other registered farmers nearby yet</p>
            ) : (
              <div className="space-y-2">
                {nearbyFarmers.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                    <div className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 bg-pfuma-green">
                      {(f.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-800 truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium truncate">{f.org || 'Farmer'} · {f.province}</p>
                    </div>
                    <button onClick={() => setActiveTab('vet')} className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center text-pfuma-green hover:bg-green-50 transition shrink-0" aria-label={`Message ${f.name}`}>
                      <MessageSquare size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stakeholder map — full width at bottom */}
      <StakeholderMap />
    </div>
  );
};

// ── VETERINARIAN DASHBOARD ─────────────────────────────────────────────────
const VeterinarianDashboard = ({ animals, notifications, setActiveTab, currentUser }) => {
  const [farms, setFarms] = useState([]);
  const [reportingHealth, setReportingHealth] = useState([]);
  const [certQueue, setCertQueue] = useState(0);
  const [outbreaks, setOutbreaks] = useState([]);
  const [vetRequests, setVetRequests] = useState([]);
  const [claimBusyId, setClaimBusyId] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({ disease_name: '', district: '', details: '', affected_farms: '', animals_at_risk: '' });
  const [reportBusy, setReportBusy] = useState(false);

  const loadVetData = useCallback(async () => {
    if (!currentUser?.token) return;
    const headers = { Authorization: `Bearer ${currentUser.token}` };
    try {
      const res = await fetch(`${API}/vet/farm-registry`, { headers });
      if (res.ok) setFarms(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    try {
      const res = await fetch(`${API}/vet/reporting-health`, { headers });
      if (res.ok) setReportingHealth(await res.json());
    } catch { /* offline */ }
    try {
      const res = await fetch(`${API}/vet/cert-queue`, { headers });
      if (res.ok) setCertQueue((await res.json()).pending);
    } catch { /* offline */ }
    try {
      const res = await fetch(`${API}/outbreaks`, { headers });
      if (res.ok) setOutbreaks(await res.json());
    } catch { /* offline */ }
    try {
      const res = await fetch(`${API}/vet-requests?status=open`, { headers });
      if (res.ok) setVetRequests(await res.json());
    } catch { /* offline */ }
  }, [currentUser?.token]);

  useEffect(() => { loadVetData(); }, [loadVetData]);

  const claimVetRequest = async (reqId) => {
    setClaimBusyId(reqId);
    try {
      const res = await fetch(`${API}/vet-requests/${reqId}/claim`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) await loadVetData();
    } catch { /* offline */ }
    setClaimBusyId(null);
  };

  const submitOutbreak = async (e) => {
    e.preventDefault();
    if (!reportForm.disease_name.trim()) return;
    setReportBusy(true);
    try {
      const res = await fetch(`${API}/outbreaks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify(reportForm),
      });
      if (res.ok) {
        setShowReportForm(false);
        setReportForm({ disease_name: '', district: '', details: '', affected_farms: '', animals_at_risk: '' });
        await loadVetData();
      }
    } catch { /* offline */ }
    setReportBusy(false);
  };

  const activeOutbreak = outbreaks[0];

  return (
    <div className="p-6 bg-pfuma-slate space-y-6 text-left overflow-y-auto h-full">

      {/* Greeting */}
      <div className="bg-pfuma-green/20 border border-pfuma-green/30 rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-green-400 text-xs font-black uppercase tracking-[3px] mb-1">Authority Dashboard · {currentUser?.province || 'Mashonaland West'}</p>
            <h2 className="text-2xl font-black text-white leading-tight">{greet()}, Dr. {currentUser?.name?.split(' ').pop() || 'Officer'}</h2>
            <p className="text-gray-400 text-sm font-medium mt-1">Provincial veterinary oversight — outbreaks, certifications, and farmer case management</p>
          </div>
          {activeOutbreak && (
            <div className="flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-2xl shrink-0 animate-pulse">
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">{activeOutbreak.disease_name} Outbreak Active</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Outbreaks',  value: outbreaks.length, sub: activeOutbreak ? `${activeOutbreak.disease_name} — ${activeOutbreak.district || activeOutbreak.province}` : 'None reported',
            icon: AlertTriangle, iconColor: outbreaks.length ? 'text-red-500' : 'text-gray-500', accent: outbreaks.length ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10', textColor: outbreaks.length ? 'text-red-400' : 'text-white' },
          { label: 'Cert. Queue',       value: certQueue, sub: 'Unread trade certification requests', icon: FileText,      iconColor: 'text-yellow-400', accent: 'bg-white/5 border-white/10',       textColor: 'text-white'   },
          { label: 'Farms Under Watch', value: farms.length, sub: `${currentUser?.province || 'Your province'} registry`,        icon: MapPin,        iconColor: 'text-blue-400',   accent: 'bg-white/5 border-white/10',       textColor: 'text-white'   },
          { label: 'Reporting Rate',    value: reportingHealth.length ? `${reportingHealth[reportingHealth.length - 1].sync}%` : '—', sub: 'Farms with a health event logged today',    icon: RefreshCw,     iconColor: 'text-green-400',  accent: 'bg-white/5 border-white/10',       textColor: 'text-white'   },
        ].map(k => (
          <div key={k.label} className={`${k.accent} border rounded-2xl p-5`}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p>
              <k.icon size={16} className={k.iconColor} />
            </div>
            <p className={`text-3xl font-black ${k.textColor}`}>{k.value}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Outbreak alert */}
        <div className="col-span-1 space-y-5">
          <div className={`${activeOutbreak ? 'bg-red-600/10 border-red-500/30' : 'bg-white/5 border-white/10'} border rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className={activeOutbreak ? 'text-red-400 animate-pulse' : 'text-gray-500'} />
                <h3 className={`text-sm font-black ${activeOutbreak ? 'text-red-300' : 'text-white'}`}>Active Outbreak</h3>
              </div>
              <button onClick={() => setShowReportForm(p => !p)} className="text-[10px] font-black text-pfuma-green hover:underline uppercase">Report →</button>
            </div>
            {activeOutbreak ? (
              <>
                <h4 className="text-lg font-black text-white mb-1">{activeOutbreak.disease_name}</h4>
                <p className="text-[11px] text-gray-400 font-medium mb-4">
                  Confirmed in {activeOutbreak.district ? `${activeOutbreak.district}, ` : ''}{activeOutbreak.province}. {activeOutbreak.details}
                </p>
                <div className="space-y-2 text-[11px]">
                  {[
                    { k: 'Status',          v: activeOutbreak.status.toUpperCase() },
                    { k: 'Affected farms',  v: activeOutbreak.affected_farms || '—' },
                    { k: 'Animals at risk', v: activeOutbreak.animals_at_risk || '—' },
                    { k: 'Reported by',     v: activeOutbreak.reported_by_name },
                  ].map(r => (
                    <div key={r.k} className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-gray-500 font-bold">{r.k}</span>
                      <span className="text-gray-300 font-black">{r.v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab('vet')} className="mt-4 w-full py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition flex items-center justify-center gap-2">
                  <PhoneCall size={13} /> Issue Emergency Advisory
                </button>
              </>
            ) : (
              <p className="text-[11px] text-gray-500 font-medium">No active outbreaks reported in {currentUser?.province || 'your province'}.</p>
            )}
            {showReportForm && (
              <form onSubmit={submitOutbreak} className="mt-4 space-y-2 border-t border-white/10 pt-4">
                <input required placeholder="Disease name *" value={reportForm.disease_name} onChange={e => setReportForm(p => ({ ...p, disease_name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
                <input placeholder="District" value={reportForm.district} onChange={e => setReportForm(p => ({ ...p, district: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
                <input placeholder="Affected farms (number)" type="number" value={reportForm.affected_farms} onChange={e => setReportForm(p => ({ ...p, affected_farms: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
                <input placeholder="Animals at risk, e.g. ~200 cattle" value={reportForm.animals_at_risk} onChange={e => setReportForm(p => ({ ...p, animals_at_risk: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
                <textarea placeholder="Restriction / notes" rows={2} value={reportForm.details} onChange={e => setReportForm(p => ({ ...p, details: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 resize-none" />
                <button type="submit" disabled={reportBusy} className="w-full py-2.5 bg-red-600 text-white rounded-lg text-[11px] font-black uppercase hover:bg-red-700 transition disabled:opacity-50">
                  {reportBusy ? 'Reporting…' : 'File Outbreak Report'}
                </button>
              </form>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-black text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { icon: MessageSquare, label: 'Open Vet Messenger', desc: 'Chat with farmers', tab: 'vet',     color: 'bg-pfuma-green'  },
                { icon: Stethoscope,  label: 'Run Diagnostics',    desc: 'AI disease checker', tab: 'disease', color: 'bg-pfuma-gold'   },
                { icon: ShieldCheck,  label: 'Issue Certificate',  desc: 'Sign off a case',    tab: 'vet',     color: 'bg-pfuma-sprout' },
              ].map(a => (
                <button key={a.label} onClick={() => setActiveTab(a.tab)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-pfuma-green hover:bg-white/5 transition text-left">
                  <div className={`w-8 h-8 ${a.color} rounded-lg flex items-center justify-center shrink-0`}><a.icon size={14} className="text-white" /></div>
                  <div><p className="text-[11px] font-black text-white">{a.label}</p><p className="text-[10px] text-gray-500 font-medium">{a.desc}</p></div>
                  <ArrowRight size={12} className="text-gray-600 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Farm registry */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-sm font-black text-white">Farmer Registry — {currentUser?.province || 'Mashonaland West'}</h3>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Farms under your provincial oversight. Click a farm to open a consultation.</p>
              </div>
            </div>
            <div className="space-y-3">
              {farms.length === 0 ? (
                <p className="text-[11px] text-gray-500 font-medium italic text-center py-6">No registered farmers in {currentUser?.province || 'your province'} yet.</p>
              ) : farms.map(farm => (
                <button key={farm.id} onClick={() => setActiveTab('vet')} className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-transparent hover:border-pfuma-green transition text-left">
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center font-black text-pfuma-green text-sm shrink-0">{(farm.full_name || '?')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white mb-0.5">{farm.full_name}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{farm.org_name} · {farm.animal_count} animal{farm.animal_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${farm.verification_status === 'verified' ? 'bg-pfuma-green/20 text-green-400' : 'bg-orange-400/20 text-orange-400'}`}>{farm.verification_status}</span>
                    <MessageSquare size={14} className="text-gray-500 hover:text-pfuma-green transition" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Group vet requests from communal farmer cooperatives */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Handshake size={15} className="text-pfuma-sprout" />
              <h3 className="text-sm font-black text-white">Group Vet Requests — {currentUser?.province || 'Your Province'}</h3>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mb-4">Open requests from farmer cooperatives — one trip can serve a whole dip-tank group at once.</p>
            {vetRequests.length === 0 ? (
              <p className="text-[11px] text-gray-500 font-medium italic text-center py-4">No open group requests right now.</p>
            ) : (
              <div className="space-y-3">
                {vetRequests.map(r => (
                  <div key={r.id} className="p-3.5 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-xs font-black text-white leading-snug">{r.reason}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-1">
                      {r.cooperative_name} · {r.district ? `${r.district}, ` : ''}{r.province}{r.dip_tank_location ? ` · ${r.dip_tank_location}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">Requested by {r.requested_by_name}{r.preferred_date ? ` · wants ${new Date(r.preferred_date).toDateString()}` : ''}</p>
                    <button
                      onClick={() => claimVetRequest(r.id)}
                      disabled={claimBusyId === r.id}
                      className="mt-2 px-3 py-1.5 bg-pfuma-green text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {claimBusyId === r.id ? 'Claiming…' : 'Claim'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provincial network health */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw size={15} className="text-pfuma-sprout" />
              <h3 className="text-sm font-black text-white">Provincial Reporting Health</h3>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mb-4">Share of {currentUser?.province || 'your province'}'s farmers who logged a health event — last 7 days</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportingHealth} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="netHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" fontSize={9} tick={{ fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} fontSize={9} tick={{ fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', fontSize: 11, background: '#1e293b', color: '#fff' }} formatter={v => [`${v}%`, 'Reporting rate']} />
                  <Area type="monotone" dataKey="sync" stroke="#22c55e" fill="url(#netHealth)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SUPPLIER DASHBOARD ─────────────────────────────────────────────────────
const SupplierDashboard = ({ inventory, setActiveTab, currentUser }) => {
  const [orders, setOrders] = useState([]);
  const [demand, setDemand] = useState([]);
  const [fulfillmentRate, setFulfillmentRate] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);

  const loadSupplierData = useCallback(async () => {
    if (!currentUser?.token) return;
    const headers = { Authorization: `Bearer ${currentUser.token}` };
    try {
      const res = await fetch(`${API}/orders/mine`, { headers });
      if (res.ok) setOrders(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    try {
      const res = await fetch(`${API}/supplier/demand`, { headers });
      if (res.ok) setDemand(await res.json());
    } catch { /* offline */ }
    try {
      const res = await fetch(`${API}/supplier/fulfillment-rate`, { headers });
      if (res.ok) setFulfillmentRate((await res.json()).rate);
    } catch { /* offline */ }
  }, [currentUser?.token]);

  useEffect(() => { loadSupplierData(); }, [loadSupplierData]);

  const advanceOrder = async (order, action) => {
    setBusyOrderId(order.id);
    try {
      const res = await fetch(`${API}/orders/${order.id}/${action}`, { method: 'PATCH', headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (res.ok) await loadSupplierData();
    } catch { /* offline */ }
    setBusyOrderId(null);
  };

  const pending    = orders.filter(o => o.status === 'pending').length;
  const dispatched = orders.filter(o => o.status === 'dispatched').length;
  const delivered  = orders.filter(o => o.status === 'delivered').length;

  return (
    <div className="p-6 bg-pfuma-cream space-y-6 text-left overflow-y-auto h-full">

      {/* Role explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pfuma-gold rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative z-10">
            <p className="text-amber-100 text-xs font-black uppercase tracking-[3px] mb-1">{greet()}, Supplier</p>
            <h2 className="text-xl font-black text-white leading-tight">Supply Distribution Hub</h2>
            <p className="text-amber-100/80 text-sm font-medium mt-1">
              {pending} pending · {dispatched} in transit · {delivered} delivered
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-pfuma-gold uppercase tracking-widest mb-2">Your Role on PFUMA</p>
          <p className="text-sm font-black text-gray-800 mb-2">You are a veterinary medicine &amp; vaccine distributor</p>
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-3">
            Farmers across Zimbabwe register on PFUMA to manage their herd health. When they run low on vaccines or medicines, they contact you through the platform. You fulfill the order and dispatch to the farm.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 flex-wrap">
            <Sprout size={16} className="text-pfuma-gold shrink-0" /><span>Farmer runs low on stock</span>
            <ArrowRight size={12} className="text-pfuma-gold shrink-0" />
            <Pill size={16} className="text-pfuma-gold shrink-0" /><span>You fulfill &amp; dispatch</span>
            <ArrowRight size={12} className="text-pfuma-gold shrink-0" />
            <span className="text-lg">🐄</span><span>Animals stay healthy</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Orders',   value: pending,     sub: 'Need dispatch today',              icon: Clock,       iconColor: 'text-pfuma-gold', accent: pending ? 'bg-pfuma-gold/10 border-pfuma-gold/30' : 'bg-white border-gray-100', textColor: pending ? 'text-amber-700' : 'text-gray-900' },
          { label: 'In Transit',       value: dispatched,  sub: 'On the way to farmers',            icon: Truck,       iconColor: 'text-blue-500',   accent: 'bg-white border-gray-100', textColor: 'text-gray-900' },
          { label: 'Delivered',        value: delivered,   sub: 'Completed this week',              icon: CheckCircle, iconColor: 'text-green-500',  accent: 'bg-white border-gray-100', textColor: 'text-gray-900' },
          { label: 'Fulfillment Rate', value: fulfillmentRate === null ? '—' : `${fulfillmentRate}%`, sub: fulfillmentRate === null ? 'No resolved orders yet' : 'Delivered vs. dispatched+delivered+cancelled', icon: Target,      iconColor: 'text-purple-500', accent: 'bg-white border-gray-100', textColor: 'text-gray-900' },
        ].map(k => (
          <div key={k.label} className={`${k.accent} border rounded-2xl p-5`}>
            <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p><k.icon size={16} className={k.iconColor} /></div>
            <p className={`text-3xl font-black ${k.textColor}`}>{k.value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Orders list */}
        <div className="col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-sm font-black text-gray-800">Active Orders</h3>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Incoming requests from farms across Zimbabwe</p>
              </div>
            </div>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                  <Package size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-black text-gray-400">No orders yet</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Farmers can order from your medicine/equipment listings</p>
                </div>
              ) : orders.map(o => (
                <div key={o.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${o.status === 'pending' ? 'bg-pfuma-gold/10 border-pfuma-gold/30' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Package size={18} className="text-pfuma-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-800 mb-0.5">{o.farmer_name}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{o.product_name} · {Number(o.quantity)} · Order #{o.id}</p>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase shrink-0 ${
                    o.status === 'pending'    ? 'bg-pfuma-gold/15 text-amber-700' :
                    o.status === 'dispatched' ? 'bg-blue-100 text-blue-700' :
                    o.status === 'delivered'  ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>{o.status}</span>
                  {o.status === 'pending' && (
                    <button onClick={() => advanceOrder(o, 'dispatch')} disabled={busyOrderId === o.id} className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 transition disabled:opacity-50">Dispatch</button>
                  )}
                  {o.status === 'dispatched' && (
                    <button onClick={() => advanceOrder(o, 'deliver')} disabled={busyOrderId === o.id} className="shrink-0 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-50">Mark Delivered</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: demand chart + stock */}
        <div className="col-span-1 space-y-5">
          {/* Demand chart */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-1">Order Demand (6 Weeks)</h3>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Your real order volume, by week</p>
            {demand.length === 0 ? (
              <div className="h-36 flex items-center justify-center">
                <p className="text-[11px] text-gray-400 font-medium italic">No orders yet to chart</p>
              </div>
            ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={demand} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ca8a04" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <YAxis fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={v => [v, 'Orders']} />
                  <Area type="monotone" dataKey="orders" stroke="#ca8a04" fill="url(#dg)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>

          {/* Contact a farmer */}
          <button onClick={() => setActiveTab('vet')} className="w-full flex items-center gap-3 p-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-pfuma-gold transition text-left group">
            <div className="w-10 h-10 bg-pfuma-gold rounded-xl flex items-center justify-center shrink-0"><MessageSquare size={16} className="text-white" /></div>
            <div><p className="text-xs font-black text-gray-800">Message a Farmer</p><p className="text-[10px] text-gray-400 font-medium">Coordinate delivery or substitutions</p></div>
            <ArrowRight size={13} className="text-gray-300 group-hover:text-pfuma-gold transition ml-auto" />
          </button>
        </div>
      </div>

      <StakeholderMap />
    </div>
  );
};

// ── RETAILER DASHBOARD ─────────────────────────────────────────────────────
const RetailerDashboard = ({ setActiveTab, currentUser }) => {
  const [listings,   setListings]   = useState([]);
  const [priceTrend, setPriceTrend] = useState([]);
  const [myBids,     setMyBids]     = useState([]);

  useEffect(() => {
    if (!currentUser?.token) return;
    const headers = { Authorization: `Bearer ${currentUser.token}` };
    (async () => {
      try {
        const res = await fetch(`${API}/listings?category=livestock`, { headers });
        if (res.ok) setListings(await res.json());
      } catch { /* offline — leave empty, no fake fallback */ }
      try {
        const res = await fetch(`${API}/listings/price-trend`, { headers });
        if (res.ok) setPriceTrend(await res.json());
      } catch { /* offline */ }
      try {
        const res = await fetch(`${API}/bids/mine`, { headers });
        if (res.ok) setMyBids(await res.json());
      } catch { /* offline */ }
    })();
  }, [currentUser?.token]);

  const CATEGORY_DATA = useMemo(() => {
    const counts = {};
    listings.forEach(l => { counts[l.category] = (counts[l.category] || 0) + 1; });
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }, [listings]);

  return (
    <div className="p-6 bg-pfuma-cream space-y-6 text-left overflow-y-auto h-full">

      {/* Role explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pfuma-plum rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)' }} aria-hidden="true" />
          <div className="relative z-10">
            <p className="text-purple-300 text-xs font-black uppercase tracking-[3px] mb-1">{greet()}, Retailer</p>
            <h2 className="text-xl font-black text-white leading-tight">Livestock Marketplace</h2>
            <p className="text-purple-200/80 text-sm font-medium mt-1">
              {listings.length} active listing{listings.length !== 1 ? 's' : ''} · Market sentiment: Bullish
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-pfuma-plum uppercase tracking-widest mb-2">Your Role on PFUMA</p>
          <p className="text-sm font-black text-gray-800 mb-2">You are a livestock buyer &amp; trader</p>
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-3">
            Farmers list their animals for sale on PFUMA. You browse verified listings — each animal comes with a certified Health Passport. You place a bid, the farmer accepts, and a DVS Vet issues an official movement certificate so you can legally transport the animal.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 flex-wrap">
            <Sprout size={16} className="text-pfuma-plum shrink-0" /><span>Farmer lists</span>
            <ArrowRight size={12} className="text-pfuma-plum shrink-0" />
            <Store size={16} className="text-pfuma-plum shrink-0" /><span>You bid</span>
            <ArrowRight size={12} className="text-pfuma-plum shrink-0" />
            <Stethoscope size={16} className="text-pfuma-plum shrink-0" /><span>Vet certifies</span>
            <ArrowRight size={12} className="text-pfuma-plum shrink-0" />
            <CheckCircle size={16} className="text-pfuma-plum shrink-0" /><span>Sale complete</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Listings',    value: listings.length,                           sub: 'Verified with health passports',   icon: Tag,        iconColor: 'text-pfuma-plum' },
          { label: 'Avg. Asking Price',  value: listings.length ? `$${Math.round(listings.reduce((a, l) => a + Number(l.price), 0) / listings.length).toLocaleString()}` : '$—', sub: 'Real seller-set prices',          icon: DollarSign, iconColor: 'text-green-500'  },
          { label: 'Total Listing Value',value: `$${listings.reduce((a, l) => a + Number(l.price), 0).toLocaleString()}`, sub: 'Combined asking price on market', icon: TrendingUp, iconColor: 'text-blue-500'   },
          { label: 'Sales, Last 6mo',    value: priceTrend.reduce((a, m) => a + Number(m.sales), 0), sub: 'Livestock listings marked sold',   icon: Activity,   iconColor: 'text-pfuma-gold', textColor: 'text-pfuma-plum', accent: 'bg-pfuma-plum/10 border-pfuma-plum/30' },
        ].map(k => (
          <div key={k.label} className={`${k.accent || 'bg-white border-gray-100'} border rounded-2xl p-5`}>
            <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p><k.icon size={16} className={k.iconColor} /></div>
            <p className={`text-2xl font-black leading-none ${k.textColor || 'text-gray-900'}`}>{k.value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Listings */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-sm font-black text-gray-800">Verified Marketplace Listings</h3>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">All animals have a certified PFUMA Health Passport — safe to bid</p>
              </div>
              <button onClick={() => setActiveTab('profile')} className="text-[10px] font-black text-pfuma-plum hover:underline uppercase">View All →</button>
            </div>
            {listings.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                <ShoppingCart size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-black text-gray-400">No listings yet</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">Farmers can list animals from their Herd Registry</p>
              </div>
            ) : (
              <div className="space-y-4">
                {listings.map(l => (
                  <button key={l.id} onClick={() => setActiveTab('marketplace')} className="w-full flex items-center gap-5 p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-pfuma-plum hover:shadow-md transition group text-left">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-200 shrink-0 relative">
                      <img src={l.photo_url ? `${API}${l.photo_url}` : IMAGE_BY_SPECIES.Cattle} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-700" alt={l.product_name} />
                      <div className="absolute top-2 left-2 bg-pfuma-gold text-[8px] font-black text-white px-1.5 py-0.5 rounded-full uppercase">Certified</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-gray-900">{l.product_name}</h4>
                        <span className="text-[9px] font-black bg-pfuma-plum/15 text-pfuma-plum px-2 py-0.5 rounded-full uppercase">For Sale</span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium mb-2">{l.seller_name} · {l.location || l.seller_province}</p>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={12} className="text-pfuma-plum" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Verified Health Passport</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Asking Price</p>
                      <p className="text-xl font-black text-pfuma-plum">${Number(l.price).toLocaleString()}</p>
                      <span className="inline-block mt-2 px-4 py-1.5 bg-pfuma-plum text-white text-[10px] font-black rounded-lg uppercase group-hover:bg-violet-700 transition">Bid on Marketplace →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Price trend chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-1">Livestock Price Trend (USD / head)</h3>
              <p className="text-[11px] text-gray-400 font-medium mb-4">Average price of livestock sales actually completed on PFUMA, last 6 months</p>
              {priceTrend.length === 0 ? (
                <div className="h-36 flex items-center justify-center">
                  <p className="text-[11px] text-gray-400 font-medium italic">No completed sales yet — chart fills in as bids are accepted</p>
                </div>
              ) : (
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceTrend} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                      <YAxis fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={v => [`$${Math.round(v)}`, 'Avg price/head']} />
                      <Area type="monotone" dataKey="avg_price" stroke="#7c3aed" fill="url(#pg)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Listings by category */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800 mb-1">Listings by Category</h3>
              <p className="text-[11px] text-gray-400 font-medium mb-4">Marketplace supply breakdown</p>
              {CATEGORY_DATA.length === 0 ? (
                <div className="h-36 flex items-center justify-center">
                  <p className="text-[11px] text-gray-400 font-medium italic">No active listings to chart yet</p>
                </div>
              ) : (
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CATEGORY_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="category" fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} fontSize={9} tick={{ fill: '#bbb' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={v => [v, 'Listings']} />
                      <Bar dataKey="count" fill="#ca8a04" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: recent bids + tips */}
        <div className="col-span-1 space-y-5">
          {/* Recent bids */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4">Recent Bids</h3>
            {myBids.length === 0 ? (
              <p className="text-xs text-gray-400 italic font-medium text-center py-4">No bids placed yet</p>
            ) : (
              <div className="space-y-3">
                {myBids.map(b => (
                  <div key={b.id} className="p-3.5 bg-pfuma-plum/10 border border-pfuma-plum/20 rounded-xl">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-black text-gray-800">{b.product_name}</p>
                      <p className="text-sm font-black text-pfuma-plum">${Number(b.amount).toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                      {b.status === 'accepted' ? 'Accepted ✓' : b.status === 'declined' ? 'Declined' : 'Pending'} · {new Date(b.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-3">How to Buy</h3>
            <div className="space-y-3">
              {[
                { n: '1', t: 'Browse Listings', d: 'All animals carry a certified PFUMA Health Passport' },
                { n: '2', t: 'Check the Passport', d: 'View vaccination history and breed details before bidding' },
                { n: '3', t: 'Place a Bid', d: 'Your offer goes directly to the farmer via the platform' },
                { n: '4', t: 'Receive Certificate', d: 'DVS movement permit issued on confirmed sale' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-pfuma-plum rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 mt-0.5">{s.n}</div>
                  <div>
                    <p className="text-[11px] font-black text-gray-800">{s.t}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact seller */}
          <button onClick={() => setActiveTab('vet')} className="w-full flex items-center gap-3 p-4 bg-pfuma-plum rounded-2xl text-left hover:bg-violet-700 transition group">
            <MessageSquare size={16} className="text-white shrink-0" />
            <div><p className="text-xs font-black text-white">Contact a Seller</p><p className="text-[10px] text-purple-200 font-medium">Message the farmer directly</p></div>
            <ArrowRight size={13} className="text-purple-300 ml-auto" />
          </button>
        </div>
      </div>

      <StakeholderMap />
    </div>
  );
};

// ── POLICE DASHBOARD ───────────────────────────────────────────────────────
const DEMO_PENDING_VERIFICATIONS = [
  { id: 201, full_name: 'Tendai Chiweshe', role: 'Farmer',   org_name: 'Chiweshe Homestead',  province: 'Mashonaland Central', created_at: '2026-07-14' },
  { id: 202, full_name: 'Blessing Moyo',   role: 'Retailer', org_name: 'Moyo Livestock Traders', province: 'Midlands',         created_at: '2026-07-15' },
];
const DEMO_PENDING_CLEARANCES = [
  { id: 301, animal_name: 'Zodwa', species: 'Cattle', seller_name: 'Tendai Chiweshe', product_name: 'Zodwa — Mashona Cow', created_at: '2026-07-15' },
];

// Zimbabwe-specific format validation for officer provisioning — mirrors
// backend/app.py and src/components/IntelAI/AuthPortal.jsx so the form
// catches typos before the API round-trip.
const ZW_MOBILE_PREFIXES = ['071', '073', '077', '078'];
const isValidZwPhone = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  let n = digits;
  if (n.startsWith('263')) n = '0' + n.slice(3);
  else if (!n.startsWith('0') && n.length === 9) n = '0' + n;
  return n.length === 10 && ZW_MOBILE_PREFIXES.some(p => n.startsWith(p));
};
const ZW_ID_RE = /^\d{2}[\s-]?\d{4,7}[\s-]?[A-Za-z][\s-]?\d{2}$/;
const isValidZwNationalId = (raw) => ZW_ID_RE.test((raw || '').trim());

const EMPTY_OFFICER_FORM = { full_name: '', phone: '', national_id_number: '', badge_number: '', station: '', jurisdiction_province: '', email: '', password: '' };

const PoliceDashboard = ({ currentUser, setActiveTab, notifications }) => {
  const [verifications, setVerifications] = useState([]);
  const [clearances,    setClearances]    = useState([]);
  const [apiOnline,     setApiOnline]     = useState(false);
  const [busyId,        setBusyId]        = useState(null);
  const [feedback,      setFeedback]      = useState(null);

  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [officerForm,    setOfficerForm]    = useState(EMPTY_OFFICER_FORM);
  const [officerBusy,    setOfficerBusy]    = useState(false);
  const [officerError,   setOfficerError]   = useState('');
  const [showOfficerPassword, setShowOfficerPassword] = useState(false);
  const setOfficerField = (k, v) => setOfficerForm(p => ({ ...p, [k]: v }));

  const authHeaders = { Authorization: `Bearer ${currentUser?.token}` };

  const provisionOfficer = async (e) => {
    e.preventDefault();
    setOfficerError('');
    if (!officerForm.full_name.trim()) return setOfficerError('Full name is required.');
    if (!isValidZwPhone(officerForm.phone)) return setOfficerError('Enter a valid Zimbabwean mobile number (Econet 077/078, NetOne 071, or Telecel 073).');
    if (!isValidZwNationalId(officerForm.national_id_number)) return setOfficerError('National ID number doesn\'t match the Zimbabwe format, e.g. 63-1234567A00.');
    if (!officerForm.badge_number.trim()) return setOfficerError('Badge number is required.');
    if (officerForm.password.length < 8) return setOfficerError('Set a temporary password of at least 8 characters — share it with the officer so they can log in and should change it after.');

    setOfficerBusy(true);
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...officerForm, role: 'Police' }),
      });
      const data = await res.json();
      if (!res.ok) { setOfficerError(data.error || 'Could not provision this officer.'); return; }
      setFeedback(`${officerForm.full_name} provisioned and verified — give them their phone number and the temporary password you just set so they can log in.`);
      setOfficerForm(EMPTY_OFFICER_FORM);
      setShowAddOfficer(false);
      setTimeout(() => setFeedback(null), 6000);
    } catch {
      setOfficerError('Could not reach the PFUMA API. Is the Flask backend running?');
    } finally {
      setOfficerBusy(false);
    }
  };

  const loadQueues = useCallback(async () => {
    try {
      const [vRes, cRes] = await Promise.all([
        fetch(`${API}/verifications?status=pending`, { headers: authHeaders }),
        fetch(`${API}/clearances?status=pending`, { headers: authHeaders }),
      ]);
      if (!vRes.ok || !cRes.ok) throw new Error();
      setVerifications(await vRes.json());
      setClearances(await cRes.json());
      setApiOnline(true);
    } catch {
      setVerifications(DEMO_PENDING_VERIFICATIONS);
      setClearances(DEMO_PENDING_CLEARANCES);
      setApiOnline(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.token]);

  useEffect(() => { loadQueues(); }, [loadQueues]);

  const resolveVerification = async (userId, verification_status) => {
    setBusyId(userId);
    try {
      await fetch(`${API}/verifications/${userId}`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status }),
      });
    } catch { /* offline — reflect locally only */ }
    setVerifications(prev => prev.filter(v => v.id !== userId));
    setFeedback(verification_status === 'verified' ? 'Applicant verified.' : 'Applicant rejected.');
    setBusyId(null);
    setTimeout(() => setFeedback(null), 2500);
  };

  const resolveClearance = async (clearanceId, status) => {
    const permit = status === 'cleared' ? window.prompt('Enter DVS/ZRP movement permit number to issue with this clearance:') : null;
    if (status === 'cleared' && !permit) return;
    setBusyId(clearanceId);
    try {
      await fetch(`${API}/clearances/${clearanceId}`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, movement_permit_number: permit }),
      });
    } catch { /* offline — reflect locally only */ }
    setClearances(prev => prev.filter(c => c.id !== clearanceId));
    setFeedback(status === 'cleared' ? 'Sale cleared for listing.' : 'Sale clearance rejected.');
    setBusyId(null);
    setTimeout(() => setFeedback(null), 2500);
  };

  const theftAlerts = (notifications || []).filter(n => /theft|breach|security/i.test(`${n.title} ${n.msg}`));

  return (
    <div className="p-6 bg-gray-950 space-y-6 text-left overflow-y-auto h-full">

      {/* Greeting */}
      <div className="bg-red-900/30 border border-red-700/40 rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-red-300 text-xs font-black uppercase tracking-[3px] mb-1">Stock Theft &amp; Verification Unit · {currentUser?.jurisdictionProvince || currentUser?.province || 'Mashonaland West'}</p>
            <h2 className="text-2xl font-black text-white leading-tight">{greet()}, {currentUser?.name || 'Officer'}</h2>
            <p className="text-gray-400 text-sm font-medium mt-1">Review signup verifications and livestock sale-clearance requests before they go live on PFUMA.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!apiOnline && (
              <div className="flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 px-4 py-2.5 rounded-2xl">
                <AlertTriangle size={13} className="text-yellow-400" />
                <span className="text-xs font-black text-yellow-300">Demo mode — start Flask API to go live</span>
              </div>
            )}
            <button
              onClick={() => { setShowAddOfficer(s => !s); setOfficerError(''); }}
              className="flex items-center gap-2 bg-white text-red-900 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide hover:bg-red-50 transition"
            >
              <UserPlus size={14} /> {showAddOfficer ? 'Cancel' : 'Add Officer'}
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 text-green-300 text-xs font-black px-4 py-3 rounded-xl" role="status">
          <CheckCircle size={14} /> {feedback}
        </div>
      )}

      {/* Provision a new Police officer — Police accounts are not self-service
          signup; an existing verified officer creates and verifies the next
          one here, same as real ZRP unit onboarding. */}
      {showAddOfficer && (
        <form onSubmit={provisionOfficer} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-black text-white mb-1">Provision New Officer</h3>
              <p className="text-[11px] text-gray-500 font-medium">Police accounts aren't self-service signup — an existing verified officer creates and verifies the next one. The account is created already-verified.</p>
            </div>
            <button type="button" onClick={() => setShowAddOfficer(false)} className="text-gray-500 hover:text-white transition p-1">
              <X size={16} />
            </button>
          </div>

          {officerError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-[11px] font-bold px-3 py-2 rounded-lg">
              <AlertTriangle size={12} className="shrink-0" /> {officerError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Full Name *
              <input required value={officerForm.full_name} onChange={e => setOfficerField('full_name', e.target.value)}
                placeholder="e.g. Officer Tapiwa Gumbo"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Phone Number *
              <input required value={officerForm.phone} onChange={e => setOfficerField('phone', e.target.value)}
                placeholder="+263 77 123 4567"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              National ID Number *
              <input required value={officerForm.national_id_number} onChange={e => setOfficerField('national_id_number', e.target.value)}
                placeholder="e.g. 63-1234567A00"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Badge Number *
              <input required value={officerForm.badge_number} onChange={e => setOfficerField('badge_number', e.target.value)}
                placeholder="e.g. ZRP-STU-0231"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Station
              <input value={officerForm.station} onChange={e => setOfficerField('station', e.target.value)}
                placeholder="e.g. Chegutu Police Station"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Jurisdiction Province
              <input value={officerForm.jurisdiction_province} onChange={e => setOfficerField('jurisdiction_province', e.target.value)}
                placeholder="e.g. Mashonaland West"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Email
              <input type="email" value={officerForm.email} onChange={e => setOfficerField('email', e.target.value)}
                placeholder="officer@zrp.gov.zw"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
            </label>
            <label className="text-[11px] text-gray-400 font-bold space-y-1 block">
              Temporary Password *
              <div className="relative mt-1">
                <input required type={showOfficerPassword ? 'text' : 'password'} value={officerForm.password} onChange={e => setOfficerField('password', e.target.value)}
                  placeholder="At least 8 characters — share it with them"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 pr-9 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
                <button type="button" tabIndex={-1} onClick={() => setShowOfficerPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={showOfficerPassword ? 'Hide password' : 'Show password'}>
                  {showOfficerPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
          </div>

          <button type="submit" disabled={officerBusy}
            className="w-full py-2.5 bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-red-600 transition disabled:opacity-40">
            {officerBusy ? 'Provisioning…' : 'Provision & Verify Officer'}
          </button>
        </form>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Signups</p><ShieldCheck size={16} className="text-yellow-400" /></div>
          <p className="text-3xl font-black text-white">{verifications.length}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Farmer / Retailer / Supplier applications awaiting review</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Clearances</p><Tag size={16} className="text-orange-400" /></div>
          <p className="text-3xl font-black text-white">{clearances.length}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Livestock listings awaiting sale clearance</p>
        </div>
        <div className={`${theftAlerts.length ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'} border rounded-2xl p-5`}>
          <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Theft Alerts</p><AlertTriangle size={16} className={theftAlerts.length ? 'text-red-400' : 'text-gray-500'} /></div>
          <p className={`text-3xl font-black ${theftAlerts.length ? 'text-red-400' : 'text-white'}`}>{theftAlerts.length}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Reported theft, breach &amp; security incidents</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Verification queue */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-black text-white mb-1">Signup Verification Queue</h3>
          <p className="text-[11px] text-gray-500 font-medium mb-4">Confirm ID and credential documents before an applicant gets full access. Vet applicants are peer-reviewed by an existing verified vet, not shown here.</p>
          {verifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle size={26} className="text-green-500 mb-2" />
              <p className="text-xs font-black text-gray-400">Queue is clear</p>
            </div>
          ) : (
            <div className="space-y-3">
              {verifications.map(v => (
                <div key={v.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-black text-white">{v.full_name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{v.role} · {v.org_name} · {v.province}</p>
                    </div>
                    <span className="text-[9px] font-black text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full uppercase shrink-0">Pending</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button disabled={busyId === v.id} onClick={() => resolveVerification(v.id, 'verified')} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-40">Verify</button>
                    <button disabled={busyId === v.id} onClick={() => resolveVerification(v.id, 'rejected')} className="flex-1 py-2 bg-white/10 text-gray-300 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 transition disabled:opacity-40">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clearance queue */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-black text-white mb-1">Sale Clearance Queue</h3>
          <p className="text-[11px] text-gray-500 font-medium mb-4">Verify ownership/brand papers match the animal before a livestock listing is allowed on the Marketplace.</p>
          {clearances.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle size={26} className="text-green-500 mb-2" />
              <p className="text-xs font-black text-gray-400">Queue is clear</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clearances.map(c => (
                <div key={c.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-black text-white">{c.product_name || c.animal_name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">Seller: {c.seller_name} · {c.species || 'Livestock'}</p>
                    </div>
                    <span className="text-[9px] font-black text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full uppercase shrink-0">Pending</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button disabled={busyId === c.id} onClick={() => resolveClearance(c.id, 'cleared')} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition disabled:opacity-40">Clear Sale</button>
                    <button disabled={busyId === c.id} onClick={() => resolveClearance(c.id, 'rejected')} className="flex-1 py-2 bg-white/10 text-gray-300 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 transition disabled:opacity-40">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-black text-white mb-3">Quick Navigation</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={Store}          label="Marketplace"    desc="Monitor livestock trade activity" color="bg-red-700" onClick={() => setActiveTab('marketplace')} />
          <QuickAction icon={MessageSquare}  label="Messenger"      desc="Coordinate with farmers &amp; vets" color="bg-red-700" onClick={() => setActiveTab('vet')} />
        </div>
      </div>

      <StakeholderMap />
    </div>
  );
};

// ── NAV config ─────────────────────────────────────────────────────────────
const NAV_SECTIONS = {
  Farmer: [
    {
      section: 'Overview',
      items: [
        { tab: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard',     desc: 'Your farm at a glance' },
      ]
    },
    {
      section: 'Herd Management',
      items: [
        { tab: 'profile',     icon: Users,           label: 'Herd Registry', desc: 'Animal records & passports' },
        { tab: 'health',      icon: HeartPulse,      label: 'Lifecycle',     desc: 'Vaccines & health protocols' },
        { tab: 'disease',     icon: Stethoscope,     label: 'Diagnostics',   desc: 'AI disease checker' },
        { tab: 'feed',        icon: Wheat,           label: 'Feed Analyzer', desc: 'Livestock nutrition database' },
      ]
    },
    {
      section: 'Trade & Market',
      items: [
        { tab: 'marketplace', icon: Store,           label: 'Marketplace',   desc: 'Buy & sell livestock, feed, produce' },
        { tab: 'vet',         icon: MessageSquare,   label: 'Messenger',     desc: 'Vets, suppliers, farmers & retailers' },
      ]
    },
    {
      section: 'Community',
      items: [
        { tab: 'cooperative', icon: Handshake,       label: 'Cooperative',   desc: 'Shared dip tank & group vet requests' },
      ]
    },
  ],
  Veterinarian: [
    {
      section: 'Overview',
      items: [
        { tab: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard',     desc: 'Provincial health overview' },
      ]
    },
    {
      section: 'Clinical Tools',
      items: [
        { tab: 'profile',     icon: Users,           label: 'Herd Registry', desc: 'Animal identity & records' },
        { tab: 'health',      icon: HeartPulse,      label: 'Lifecycle',     desc: 'Vaccination & protocols' },
        { tab: 'disease',     icon: Stethoscope,     label: 'Diagnostics',   desc: 'Disease identification AI' },
        { tab: 'feed',        icon: Wheat,           label: 'Feed Analyzer', desc: 'Nutritional advice for farmers' },
      ]
    },
    {
      section: 'Authority',
      items: [
        { tab: 'vet',         icon: MessageSquare,   label: 'Messenger',     desc: 'Vets, suppliers, farmers & retailers' },
        { tab: 'marketplace', icon: Store,           label: 'Marketplace',   desc: 'Monitor trade & listings' },
      ]
    },
  ],
  Supplier: [
    {
      section: 'Overview',
      items: [
        { tab: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard',     desc: 'Orders & fulfillment summary' },
      ]
    },
    {
      section: 'Operations',
      items: [
        { tab: 'marketplace', icon: Store,           label: 'Marketplace',   desc: 'List medicines, feed & equipment' },
        { tab: 'feed',        icon: Wheat,           label: 'Feed Database', desc: 'Nutritional specs for your products' },
        { tab: 'health',      icon: Package,         label: 'Supply Chain',  desc: 'Inventory & order management' },
        { tab: 'vet',         icon: MessageSquare,   label: 'Messenger',     desc: 'Vets, suppliers, farmers & retailers' },
      ]
    },
  ],
  Retailer: [
    {
      section: 'Overview',
      items: [
        { tab: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard',     desc: 'Market overview & your bids' },
      ]
    },
    {
      section: 'Buy & Trade',
      items: [
        { tab: 'marketplace', icon: Store,           label: 'Marketplace',   desc: 'Browse all livestock & produce' },
        { tab: 'profile',     icon: ShoppingCart,    label: 'Verified Stock', desc: 'Animals with health passports' },
        { tab: 'feed',        icon: Wheat,           label: 'Feed Analyzer', desc: 'Check nutrition before purchasing' },
      ]
    },
    {
      section: 'Connect',
      items: [
        { tab: 'vet',         icon: MessageSquare,   label: 'Messenger',       desc: 'Vets, suppliers, farmers & retailers' },
      ]
    },
  ],
  Police: [
    {
      section: 'Overview',
      items: [
        { tab: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard',     desc: 'Verification & clearance queues' },
      ]
    },
    {
      section: 'Oversight',
      items: [
        { tab: 'marketplace', icon: Store,           label: 'Marketplace',   desc: 'Monitor livestock trade activity' },
        { tab: 'vet',         icon: MessageSquare,   label: 'Messenger',     desc: 'Vets, suppliers, farmers & retailers' },
      ]
    },
  ],
};

const ROLE_ACCENT = {
  Farmer:      'bg-pfuma-green',
  Veterinarian:'bg-pfuma-slate',
  Supplier:    'bg-pfuma-gold',
  Retailer:    'bg-pfuma-plum',
  Police:      'bg-red-800',
};
const ROLE_ACTIVE_BG = {
  Farmer:      'bg-white/10',
  Veterinarian:'bg-white/10',
  Supplier:    'bg-white/15',
  Retailer:    'bg-white/10',
  Police:      'bg-white/10',
};

const TOKEN_STORAGE_KEY = 'pfuma_token';

const IMAGE_BY_SPECIES = {
  Cattle: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&q=80&w=800',
  Goat:   'https://images.unsplash.com/photo-1524024973431-2ad916746881?auto=format&fit=crop&q=80&w=800',
  Sheep:  'https://images.unsplash.com/photo-1484557985045-edf25e08da73?auto=format&fit=crop&q=80&w=800',
  Pig:    'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800',
};

// A real uploaded photo is stored as a relative /uploads/... path (needs the
// API origin prefixed); the species stock fallback is already a full URL.
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

// Maps a scoped /animals row from the backend into the shape the rest of the
// app's components already expect (camelCase, weightHistory, etc).
const animalFromApi = (a) => ({
  id: a.id, name: a.name, species: a.species, breed: a.breed,
  birthDate: a.birth_date, tagId: a.tag_id, brandId: a.brand_id,
  sireId: a.sire_id, damId: a.dam_id, birthWeight: a.birth_weight, currentWeight: a.current_weight,
  imageUrl: resolveImageUrl(a.image_url) || IMAGE_BY_SPECIES[a.species] || IMAGE_BY_SPECIES.Cattle,
  weightHistory: (a.weight_history || []).map(w => ({ month: w.month_label, weight: w.weight_kg })),
  forSale: !!a.for_sale, costToDate: a.cost_to_date || 0,
});

// Maps a /health-events row into the shape the audit-log UI expects.
const auditLogFromApi = (e) => ({
  id: e.id, animalId: e.animal_id, animal: e.animal_name || '',
  eventType: e.event_type,
  action: e.notes ? `${e.event_type} — ${e.notes}` : e.event_type,
  date: new Date(e.event_date).toLocaleString(),
  eventDate: e.event_date,       // raw, parseable — used for recurrence math
  nextDueDate: e.next_due_date,  // farmer/vet-set or auto-computed next occurrence, or null
});

// ── APP ────────────────────────────────────────────────────────────────────
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [animals,     setAnimals]     = useState([]);
  const [activeTab,   setActiveTab]   = useState('dashboard');
  const [completedTasks, setCompletedTasks] = useState([]);
  const [auditLog,    setAuditLog]    = useState([]);
  const [inventory,   setInventory]   = useState([]);
  const [nearbyFarmers, setNearbyFarmers] = useState([]);
  const [notifications] = useState([
    { id: 1, title: 'January Disease Alert', msg: 'Chegutu Area — increased tick counts detected.', type: 'Critical', time: '1h ago' },
    { id: 2, title: 'Vaccine Recall',         msg: 'Lot #992 Oxytetracycline recalled by supplier.',  type: 'Info',     time: '4h ago' },
  ]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const authFetch = useCallback((path, opts = {}) => fetch(`${API}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${currentUser?.token}` },
  }), [currentUser?.token]);

  const loadUserData = useCallback(async (user) => {
    const headers = { Authorization: `Bearer ${user.token}` };
    try {
      const res = await fetch(`${API}/animals`, { headers });
      if (res.ok) setAnimals((await res.json()).map(animalFromApi));
    } catch { /* offline — keep whatever is already loaded */ }
    try {
      const res = await fetch(`${API}/health-events`, { headers });
      if (res.ok) setAuditLog((await res.json()).map(auditLogFromApi));
    } catch { /* offline */ }
    if (user.role === 'Farmer') {
      try {
        const res = await fetch(`${API}/inventory/${user.id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setInventory(data.map(i => ({ id: i.id, name: i.medicine_name, stock: Number(i.stock), unit: i.unit, min: Number(i.min_stock), supplier: i.supplier, price: Number(i.price_usd) })));
        }
      } catch { /* offline */ }
      try {
        const res = await fetch(`${API}/users?role=Farmer`, { headers });
        if (res.ok) {
          const users = await res.json();
          setNearbyFarmers(users.filter(u => u.id !== user.id).slice(0, 5).map(u => ({ id: u.id, name: u.full_name, org: u.org_name, province: u.province })));
        }
      } catch { /* offline */ }
    }
  }, []);

  // Restore session from a stored token on first load.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) { setSessionChecked(true); return; }
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const apiUser = await res.json();
          const user = {
            id: apiUser.id, token, name: apiUser.full_name, phone: apiUser.phone, email: apiUser.email,
            org: apiUser.org_name, province: apiUser.province, district: apiUser.district, address: apiUser.address,
            role: apiUser.role, farmSize: apiUser.farm_size_ha,
            species: (apiUser.species_farmed || '').split(',').filter(Boolean),
            licenseNumber: apiUser.license_number, speciality: apiUser.speciality, businessReg: apiUser.business_reg,
            supplyCategories: (apiUser.supply_categories || '').split(',').filter(Boolean),
            tradingAreas: apiUser.trading_areas, badgeNumber: apiUser.badge_number, station: apiUser.station,
            jurisdictionProvince: apiUser.jurisdiction_province, verificationStatus: apiUser.verification_status,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiUser.full_name || 'PFUMA'}`,
          };
          setCurrentUser(user);
          loadUserData(user);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch { /* API offline — fall through to login screen */ }
      setSessionChecked(true);
    })();
  }, [loadUserData]);

  const handleLoginSuccess = (user) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, user.token);
    setCurrentUser(user);
    loadUserData(user);
  };

  const handleSignOut = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setCurrentUser(null);
    setAnimals([]);
    setInventory([]);
  };

  // Returns { ok, error } so the registration form can show a real error and
  // stay open on failure, instead of silently fabricating a local animal.
  const addAnimal = async (newAnimal, photoFile) => {
    try {
      let res;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(newAnimal).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
        fd.append('photo', photoFile);
        res = await authFetch('/animals', { method: 'POST', body: fd });
      } else {
        res = await authFetch('/animals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAnimal),
        });
      }
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Could not register animal.' };
      await loadUserData(currentUser); // refetch so the real (server-resolved) photo/id are shown
      setActiveTab('profile');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the PFUMA API. Is the Flask backend running?' };
    }
  };

  const addAuditLog = async (entry) => {
    if (!entry.animalId || !entry.eventType) {
      setAuditLog(prev => [entry, ...prev]);
      return { ok: true };
    }
    try {
      const res = await authFetch('/health-events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animal_id: entry.animalId, event_type: entry.eventType, notes: entry.notes || '',
          event_date: entry.eventDate || undefined, next_due_date: entry.nextDueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Could not save this to your records — try again.' };
      setAuditLog(prev => [data.event ? auditLogFromApi(data.event) : entry, ...prev]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Offline — this could not be saved. It will not appear after a refresh.' };
    }
  };

  const deductInventoryItem = async (itemId, dose) => {
    try {
      const res = await authFetch(`/inventory/${itemId}/deduct`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Could not update stock — try again.' };
      setInventory(prev => prev.map(i => i.id === itemId ? { ...i, stock: Number(data.new_stock) } : i));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Offline — stock was not updated.' };
    }
  };

  const handleListAnimal = async (id) => {
    setAnimals(prev => prev.map(a => a.id === id ? { ...a, forSale: !a.forSale } : a));
    try { await authFetch(`/animals/${id}/sale`, { method: 'PATCH' }); } catch { /* offline — local toggle already applied */ }
  };

  if (!sessionChecked) return null;
  if (!currentUser) return <AuthPortal onLogin={handleLoginSuccess} />;
  // Admin doesn't fit the client-facing Farmer/Vet/Supplier/Retailer/Police
  // shell at all — a separate full-page dashboard, bypassing the normal
  // sidebar/nav entirely.
  if (currentUser.role === 'Admin') return <AdminDashboard currentUser={currentUser} onLogout={handleSignOut} />;

  const role        = currentUser.role;
  const navSections = NAV_SECTIONS[role] || NAV_SECTIONS.Farmer;
  const sidebarBg   = ROLE_ACCENT[role]  || 'bg-pfuma-green';
  const activeBg    = ROLE_ACTIVE_BG[role] || 'bg-white/10';

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">

      {/* Backdrop — closes the mobile nav drawer when tapped outside it */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ── Fixed off-canvas drawer below the lg breakpoint,
          normal static column at lg and above. */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 flex flex-col shrink-0 ${sidebarBg} text-white
        transform transition-transform duration-300 ease-in-out
        ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:z-20
      `}>

        {/* Logo */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <img src={pfumaMark} alt="PFUMA" className="w-10 h-10 rounded-xl shadow-lg shrink-0 object-cover" />
          <div className="flex-1">
            <span className="text-base font-extrabold tracking-tight block leading-none">PFUMA</span>
          </div>
          <button
            onClick={() => setIsMobileNavOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 overflow-y-auto pb-4 space-y-5 mt-2">
          {navSections.map(sec => (
            <div key={sec.section}>
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[2px] px-2 mb-1.5">{sec.section}</p>
              <div className="space-y-0.5">
                {sec.items.map(item => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => { setActiveTab(item.tab); setIsMobileNavOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${isActive ? `${activeBg} text-white` : 'text-white/40 hover:bg-white/5 hover:text-white/80'}`}
                    >
                      <item.icon size={16} className={isActive ? 'text-yellow-400' : ''} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black leading-none ${isActive ? 'text-white' : ''}`}>{item.label}</p>
                        <p className={`text-[10px] font-medium leading-none mt-0.5 ${isActive ? 'text-white/60' : 'text-white/25'}`}>{item.desc}</p>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-4 pb-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shrink-0">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white leading-none truncate">{currentUser.name}</p>
              <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest leading-none mt-0.5">{role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-red-600/20 transition text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white relative w-full min-w-0">

        {/* Mobile top bar — hamburger + logo, only shown below lg since the
            sidebar is off-canvas there and this is the only way back to it. */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-900 transition"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <img src={pfumaMark} alt="PFUMA" className="w-7 h-7 rounded-lg shadow shrink-0 object-cover" />
          <span className="text-sm font-extrabold text-gray-900 tracking-tight">PFUMA</span>
        </div>

        {/* Notification bell */}
        <div className="absolute top-4 right-5 z-30">
          <div className="relative">
            <button
              className={`p-2.5 rounded-xl transition-all ${isNotifOpen ? `${sidebarBg} text-white shadow-lg` : 'bg-white text-gray-400 shadow-sm hover:text-gray-700 border border-gray-100'}`}
              onClick={() => setIsNotifOpen(p => !p)}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {notifications.length > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />}
            </button>
            {isNotifOpen && (
              <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 text-left z-40 animate-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Notifications</p>
                <div className="space-y-3">
                  {notifications.map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'Critical' ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-xs font-black text-gray-800">{n.title}</p>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">{n.msg}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className={`flex-1 ${activeTab === 'vet' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'dashboard' && (
            <ErrorBoundary>
              {role === 'Farmer'       && <FarmerDashboard      animals={animals} auditLog={auditLog} inventory={inventory} notifications={notifications} nearbyFarmers={nearbyFarmers} currentUser={currentUser} setActiveTab={setActiveTab} onListAnimal={handleListAnimal} />}
              {role === 'Veterinarian' && <VeterinarianDashboard animals={animals} notifications={notifications} setActiveTab={setActiveTab} currentUser={currentUser} />}
              {role === 'Supplier'     && <SupplierDashboard     inventory={inventory} setActiveTab={setActiveTab} currentUser={currentUser} />}
              {role === 'Retailer'     && <RetailerDashboard     setActiveTab={setActiveTab} currentUser={currentUser} />}
              {role === 'Police'       && <PoliceDashboard       notifications={notifications} setActiveTab={setActiveTab} currentUser={currentUser} />}
            </ErrorBoundary>
          )}
          {activeTab === 'profile'     && <ErrorBoundary><AnimalProfile animals={animals} onAddAnimal={addAnimal} auditLog={auditLog} currentUser={currentUser} onListAnimal={handleListAnimal} /></ErrorBoundary>}
          {activeTab === 'health'      && <ErrorBoundary><HealthManagement animals={animals} completedTasks={completedTasks} setCompletedTasks={setCompletedTasks} auditLog={auditLog} onAddAuditLog={addAuditLog} inventory={inventory} onDeductInventory={deductInventoryItem} /></ErrorBoundary>}
          {activeTab === 'disease'     && <ErrorBoundary><DiseaseDetection animals={animals} onAddAuditLog={addAuditLog} /></ErrorBoundary>}
          {activeTab === 'vet'         && <ErrorBoundary><VetCommunication animals={animals} currentUser={currentUser} /></ErrorBoundary>}
          {activeTab === 'marketplace' && <ErrorBoundary><Marketplace currentUser={currentUser} animals={animals} onListAnimal={handleListAnimal} /></ErrorBoundary>}
          {activeTab === 'feed'        && <ErrorBoundary><FeedAnalyzer currentUser={currentUser} animals={animals} onUpdateAnimal={(id, patch) => setAnimals(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))} /></ErrorBoundary>}
          {activeTab === 'cooperative' && <ErrorBoundary><Cooperative currentUser={currentUser} /></ErrorBoundary>}
        </div>

        <Jinda setActiveTab={setActiveTab} animals={animals} currentUser={currentUser} />
      </main>
    </div>
  );
}

export default App;
