import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Globe, Sprout, Pill, Store, Stethoscope, AlertTriangle, CheckCircle, Check,
  MessageSquare, ShieldCheck, Wifi, Package, PhoneCall, HeartPulse, ShoppingCart,
  ArrowRight, Users, Wheat, Wallet, Syringe, ListChecks, Compass, Tag, TrendingUp, Truck,
} from 'lucide-react-native';
import { COLORS } from '../config';

// ── seed data (mirrors web App.jsx) ────────────────────────────────────────
const ANIMALS = [
  { id: 101, name: 'Bessie',  species: 'Cattle', breed: 'Brahman', age: '2y 4m', tagId: 'ZIM-882',
    birthDate: '2023-10-15', currentWeight: 420, forSale: false, costToDate: 120 },
  { id: 102, name: 'Thunder', species: 'Cattle', breed: 'Angus',   age: '1y 9m', tagId: 'ZIM-104',
    birthDate: '2024-05-20', currentWeight: 380, forSale: true,  costToDate: 95 },
];
const NOTIFICATIONS = [
  { id: 1, title: 'January Disease Alert', msg: 'Chegutu Area — increased tick counts detected.', type: 'Critical', time: '1h ago' },
  { id: 2, title: 'Vaccine Recall',         msg: 'Lot #992 Oxytetracycline recalled by supplier.',  type: 'Info',     time: '4h ago' },
];
const INVENTORY = [
  { id: 1, name: 'Oxytetracycline (LA)', stock: 500,  unit: 'ml', min: 100, supplier: 'AgroChem Zim' },
  { id: 2, name: 'Buparvaquone',         stock: 120,  unit: 'ml', min: 50,  supplier: 'VetDirect' },
  { id: 3, name: 'Albendazole',          stock: 1000, unit: 'ml', min: 200, supplier: 'AgroChem Zim' },
];
const ORDERS = [
  { id: 'ORD-441', farm: 'Moyo Livestock',     item: 'Oxytetracycline (LA)',   qty: '200ml',    status: 'Dispatched', urgent: false },
  { id: 'ORD-442', farm: 'ZimAgro Enterprise', item: 'FMD Vaccine',            qty: '50 doses', status: 'Pending',    urgent: true  },
  { id: 'ORD-443', farm: 'Kumar Farms',         item: 'Buparvaquone (Butalex)',qty: '100ml',    status: 'Pending',    urgent: true  },
  { id: 'ORD-444', farm: 'Central Paddock',     item: 'Albendazole Drench',    qty: '500ml',    status: 'Delivered',  urgent: false },
];
const FARMS = [
  { name: 'Kumar Farms',        animals: 24, status: 'Verified', province: 'Mashonaland West', alert: false },
  { name: 'Moyo Livestock',     animals: 18, status: 'Verified', province: 'Mashonaland West', alert: true  },
  { name: 'ZimAgro Enterprise', animals: 45, status: 'Verified', province: 'Mashonaland West', alert: false },
  { name: 'Central Paddock',    animals: 12, status: 'Pending',  province: 'Mashonaland East', alert: false },
];
const RECENT_BIDS = [
  { animal: 'Thunder', bidder: 'ZimAgro Ltd', amount: 620, time: '2h ago' },
  { animal: 'Bessie',  bidder: 'Farm Direct', amount: 850, time: '5h ago' },
];

const VACCINE_SCHEDULES = {
  Cattle: [
    { name: 'FMD Vaccine (Annual)',     age: 180 },
    { name: 'Anthrax Vaccine',          age: 365 },
    { name: 'Blackleg Vaccine',         age: 90  },
  ],
};

const NETWORK_HEALTH = [
  { day: 'Mon', sync: 94 }, { day: 'Tue', sync: 96 }, { day: 'Wed', sync: 91 },
  { day: 'Thu', sync: 97 }, { day: 'Fri', sync: 98 }, { day: 'Sat', sync: 99 }, { day: 'Sun', sync: 99 },
];
const DEMAND_DATA = [
  { week: 'W1', orders: 8 }, { week: 'W2', orders: 12 }, { week: 'W3', orders: 9 },
  { week: 'W4', orders: 18 }, { week: 'W5', orders: 14 }, { week: 'W6', orders: 22 },
];
const PRICE_DATA = [
  { month: 'Jan', price: 480 }, { month: 'Feb', price: 510 }, { month: 'Mar', price: 495 },
  { month: 'Apr', price: 540 }, { month: 'May', price: 565 }, { month: 'Jun', price: 590 },
];
const HERD_GROWTH = [
  { month: 'Jan', value: 920 }, { month: 'Feb', value: 980 }, { month: 'Mar', value: 1050 },
  { month: 'Apr', value: 1120 }, { month: 'May', value: 1180 }, { month: 'Jun', value: 1250 },
];
const NEARBY_FARMERS = [
  { id: 'f1', name: 'P. Banda',   role: 'Dairy Farmer',          province: 'Mashonaland East',   avatar: 'PB', color: '#16a34a', online: true  },
  { id: 'f2', name: 'L. Sibanda', role: 'Poultry & Goat Farmer', province: 'Matabeleland South', avatar: 'LS', color: '#65a30d', online: false },
];

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ── Per-role gradient & accent tokens (mirrors LoginScreen hero treatment) ──
const ROLE_GRADIENT = {
  Farmer:       [COLORS.primary, COLORS.medium],
  Veterinarian: ['#0f172a', '#334155'],
  Supplier:     [COLORS.gold, '#f59e0b'],
  Retailer:     [COLORS.purple, '#a78bfa'],
};
const ROLE_ACCENT = {
  Farmer: '#fbc02d', Veterinarian: '#86efac', Supplier: '#fef9c3', Retailer: '#ede9fe',
};

// ── Shared UI primitives ────────────────────────────────────────────────────
const SectionLabel = ({ children, light, icon: Icon, right }) => (
  <View style={s.sectionLabelRow}>
    <View style={s.sectionLabelLeft}>
      {Icon && <Icon size={12} color={light ? 'rgba(255,255,255,0.4)' : '#9ca3af'} strokeWidth={2.5} />}
      <Text style={[s.sectionLabel, light && { color: 'rgba(255,255,255,0.4)' }]}>{children}</Text>
    </View>
    {right}
  </View>
);

const KpiCard = ({ label, value, sub, accent, textColor, borderColor, icon: Icon, iconColor, iconBg }) => (
  <View style={[s.kpiCard, accent && { backgroundColor: accent }, borderColor && { borderColor }]}>
    <View style={s.kpiHeaderRow}>
      <Text style={s.kpiLabel}>{label}</Text>
      {Icon && (
        <View style={[s.kpiIconBadge, { backgroundColor: iconBg || '#f3f4f6' }]}>
          <Icon size={13} color={iconColor || '#9ca3af'} />
        </View>
      )}
    </View>
    <Text style={[s.kpiValue, textColor && { color: textColor }]}>{value}</Text>
    {sub ? <Text style={s.kpiSub} numberOfLines={2}>{sub}</Text> : null}
  </View>
);

// Gradient hero banner with soft decorative glow circles
const GradientBanner = ({ colors, children }) => (
  <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
    <View style={s.bannerGlow1} />
    <View style={s.bannerGlow2} />
    {children}
  </LinearGradient>
);

const QuickBtn = ({ icon: Icon, label, desc, color, onPress }) => (
  <TouchableOpacity style={s.quickBtn} onPress={onPress} activeOpacity={0.8}>
    <View style={[s.quickIcon, { backgroundColor: color }]}>
      <Icon size={18} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.quickLabel}>{label}</Text>
      <Text style={s.quickDesc} numberOfLines={1}>{desc}</Text>
    </View>
    <Text style={s.quickArrow}>›</Text>
  </TouchableOpacity>
);

const AlertCard = ({ title, msg, type, time }) => (
  <View style={[s.alertCard, type === 'Critical' ? s.alertCritical : s.alertInfo]}>
    <View style={[s.alertDot, { backgroundColor: type === 'Critical' ? '#ef4444' : '#3b82f6' }]} />
    <View style={{ flex: 1 }}>
      <Text style={s.alertTitle}>{title}</Text>
      <Text style={s.alertMsg}>{msg}</Text>
      <Text style={s.alertTime}>{time}</Text>
    </View>
  </View>
);

// Simple View-based bar chart (no recharts/svg on mobile)
const MiniBarChart = ({ data, labelKey, valueKey, color, light }) => {
  const maxVal = Math.max(...data.map(d => d[valueKey]));
  return (
    <View style={s.miniChart}>
      {data.map((d, i) => (
        <View key={i} style={s.miniChartCol}>
          <View style={[s.miniChartTrack, light && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <View style={[s.miniChartBar, { height: `${Math.max(6, (d[valueKey] / maxVal) * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={[s.miniChartLabel, light && { color: '#64748b' }]}>{d[labelKey]}</Text>
        </View>
      ))}
    </View>
  );
};

// ── Stakeholder map (shared) ───────────────────────────────────────────────
const StakeholderMap = () => (
  <View style={s.smCard}>
    <View style={s.smTitleRow}>
      <Globe size={15} color={COLORS.primary} />
      <Text style={s.smTitle}>How PFUMA Connects Everyone</Text>
    </View>
    <Text style={s.smDesc}>
      PFUMA is a four-stakeholder ecosystem. Every role plays a specific part — here's how they all connect.
    </Text>
    {[
      { icon: Sprout,      role: 'Farmer',       color: COLORS.light,  text: COLORS.primary, desc: 'Registers animals, tracks health, orders medicines, lists livestock for sale.' },
      { icon: Pill,        role: 'Supplier',      color: COLORS.goldBg, text: '#92400e',      desc: 'Distributes vaccines, medicines, and feed to farmers.' },
      { icon: Store,       role: 'Retailer',      color: COLORS.purpleBg, text: COLORS.purple, desc: 'Browses certified livestock, places bids, receives DVS certificates.' },
      { icon: Stethoscope, role: 'Veterinarian',  color: '#e3f2fd', text: '#0d47a1', desc: 'Certifies animal health, issues movement permits, manages outbreaks.' },
    ].map(r => (
      <View key={r.role} style={[s.smRow, { backgroundColor: r.color }]}>
        <View style={s.smRowIcon}>
          <r.icon size={18} color={r.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.smRoleName, { color: r.text }]}>{r.role}</Text>
          <Text style={s.smRoleDesc}>{r.desc}</Text>
        </View>
      </View>
    ))}
    <View style={s.smFlow}>
      <Text style={s.smFlowTitle}>HOW IT FLOWS</Text>
      {[
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Pill,        to: 'Supplier', desc: 'orders medicines & vaccines' },
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Stethoscope, to: 'Vet',      desc: 'requests health checks & movement certs' },
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Store,       to: 'Retailer', desc: 'lists animals for sale' },
        { fromIcon: Store,       from: 'Retailer', toIcon: Sprout,      to: 'Farmer',   desc: 'places a bid / makes an offer' },
        { fromIcon: Stethoscope, from: 'Vet',      toIcon: Store,       to: 'Retailer', desc: 'issues DVS movement certificate' },
      ].map((f, i) => (
        <View key={i} style={s.smFlowRow}>
          <f.fromIcon size={12} color="#374151" />
          <Text style={s.smFlowName}>{f.from}</Text>
          <ArrowRight size={11} color="#9ca3af" />
          <f.toIcon size={12} color="#374151" />
          <Text style={s.smFlowName}>{f.to}</Text>
          <Text style={s.smFlowDesc}>— {f.desc}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ── FARMER DASHBOARD ────────────────────────────────────────────────────────
function FarmerDashboard({ currentUser, animals, navigation }) {
  const [localAnimals, setLocalAnimals] = useState(animals);
  const forSale    = localAnimals.filter(a => a.forSale).length;
  const critAlerts = NOTIFICATIONS.filter(n => n.type === 'Critical');
  const lowStock   = INVENTORY.filter(i => i.stock <= i.min);
  const totalValue = localAnimals.reduce((acc, a) => acc + 500 + a.currentWeight * 1.5, 0);

  const overdueVaccines = useMemo(() => {
    const rows = [];
    localAnimals.forEach(a => {
      if (!a.birthDate) return;
      const birth = new Date(a.birthDate);
      (VACCINE_SCHEDULES[a.species] || []).forEach(v => {
        const due = new Date(birth);
        due.setDate(birth.getDate() + v.age);
        if (new Date() > due) rows.push({ animal: a.name, vaccine: v.name });
      });
    });
    return rows.slice(0, 4);
  }, [localAnimals]);

  const priorityRows = [
    ...overdueVaccines.map(v => ({
      icon: Syringe, bg: '#fee2e2', color: '#dc2626', tag: 'Overdue',
      title: v.vaccine, sub: `${v.animal} — vaccine due`,
    })),
    ...lowStock.map(item => ({
      icon: Package, bg: '#ffedd5', color: '#ea580c', tag: 'Low Stock',
      title: item.name, sub: `${item.stock}${item.unit} remaining`,
    })),
    ...critAlerts.map(n => ({
      icon: AlertTriangle, bg: '#fef3c7', color: '#b45309', tag: 'Alert',
      title: n.title, sub: n.msg,
    })),
  ];

  const toggleSale = (id) =>
    setLocalAnimals(prev => prev.map(a => a.id === id ? { ...a, forSale: !a.forSale } : a));

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Greeting banner */}
      <GradientBanner colors={ROLE_GRADIENT.Farmer}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Sprout size={22} color="#fff" />
          </View>
          {critAlerts.length > 0 && (
            <View style={[s.bannerAlert, s.bannerAlertRow]}>
              <AlertTriangle size={14} color="#fff" />
              <Text style={s.bannerAlertText}>{critAlerts.length} Critical Alert{critAlerts.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Text style={s.bannerEyebrow}>{greet()}, Farmer</Text>
        <Text style={s.bannerTitle}>Here's your farm today</Text>
        <Text style={s.bannerSub}>
          {localAnimals.length} animal{localAnimals.length !== 1 ? 's' : ''} · {critAlerts.length} critical alert{critAlerts.length !== 1 ? 's' : ''} · {overdueVaccines.length} overdue vaccine{overdueVaccines.length !== 1 ? 's' : ''}
        </Text>
      </GradientBanner>

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA</Text>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#1a1a1a', marginBottom: 6 }}>You are the heart of the herd</Text>
        <Text style={{ fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 10 }}>
          Register your animals, track their health, and reorder medicine before stocks run low. When ready, list animals on the Marketplace — a DVS vet certifies them so retailers across Zimbabwe can bid with confidence.
        </Text>
        <View style={s.flowRow}>
          <Sprout size={16} color={COLORS.primary} />
          <Text style={s.flowText}>You raise & register</Text>
          <ArrowRight size={12} color={COLORS.primary} />
          <Stethoscope size={16} color={COLORS.primary} />
          <Text style={s.flowText}>Vet certifies health</Text>
          <ArrowRight size={12} color={COLORS.primary} />
          <Store size={16} color={COLORS.primary} />
          <Text style={s.flowText}>Retailer buys</Text>
        </View>
      </View>

      {/* KPI row */}
      <View style={s.kpiRow}>
        <KpiCard label="Total Animals" value={localAnimals.length} sub="In your herd registry"
          icon={Users} iconColor={COLORS.primary} iconBg={COLORS.light} />
        <KpiCard label="Herd Value" value={`$${totalValue.toLocaleString()}`} sub="Estimated market value"
          icon={Wallet} iconColor="#b45309" iconBg={COLORS.goldBg} />
      </View>
      <View style={s.kpiRow}>
        <KpiCard
          label="Overdue Vaccines" value={overdueVaccines.length}
          sub={overdueVaccines.length ? 'Need immediate attention' : 'All vaccinations current'}
          accent={overdueVaccines.length ? '#fff5f5' : undefined}
          textColor={overdueVaccines.length ? COLORS.danger : undefined}
          borderColor={overdueVaccines.length ? '#fca5a5' : undefined}
          icon={Syringe}
          iconColor={overdueVaccines.length ? COLORS.danger : COLORS.primary}
          iconBg={overdueVaccines.length ? '#fee2e2' : COLORS.light}
        />
        <KpiCard label="Listed for Sale" value={forSale} sub={forSale ? 'Visible on marketplace' : 'None listed yet'}
          icon={ShoppingCart} iconColor="#0d9488" iconBg="#ccfbf1" />
      </View>

      {/* Priority Actions */}
      <SectionLabel
        icon={ListChecks}
        right={priorityRows.length > 0 ? (
          <View style={s.priorityCountBadge}>
            <Text style={s.priorityCountText}>{priorityRows.length}</Text>
          </View>
        ) : null}
      >PRIORITY ACTIONS</SectionLabel>
      <View style={s.panel}>
        {priorityRows.length === 0 ? (
          <View style={s.emptyInner}>
            <CheckCircle size={28} color={COLORS.primary} />
            <Text style={s.emptyInnerText}>All good — no urgent actions</Text>
          </View>
        ) : priorityRows.map((p, i) => (
          <View key={i} style={[s.priorityRow, i === priorityRows.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[s.priorityIconBadge, { backgroundColor: p.bg }]}>
              <p.icon size={16} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.priorityTitle}>{p.title}</Text>
              <Text style={s.prioritySub} numberOfLines={1}>{p.sub}</Text>
            </View>
            <View style={[s.priorityTag, { backgroundColor: p.bg }]}>
              <Text style={[s.priorityTagText, { color: p.color }]}>{p.tag}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick Navigation */}
      <SectionLabel icon={Compass}>QUICK NAVIGATION</SectionLabel>
      <View style={s.panel}>
        <QuickBtn icon={Users}         label="Herd Registry"  desc="View & manage your animals"  color={COLORS.primary} onPress={() => navigation.navigate('Herd')} />
        <QuickBtn icon={HeartPulse}    label="Lifecycle"       desc="Vaccines & health protocols"  color="#2563eb"        onPress={() => navigation.navigate('Herd')} />
        <QuickBtn icon={ShoppingCart}  label="Marketplace"     desc="Browse & list livestock"       color="#0d9488"        onPress={() => navigation.navigate('Market')} />
        <QuickBtn icon={Wheat}         label="Feed Analyzer"   desc="Livestock nutrition database"  color="#ea580c"        onPress={() => navigation.navigate('Feed')} />
        <QuickBtn icon={MessageSquare} label="Messenger"       desc="Chat with vets, suppliers & farmers" color="#14b8a6"   onPress={() => navigation.navigate('Vet')} />
      </View>

      {/* Sell Your Animals */}
      <SectionLabel icon={Tag}>SELL YOUR ANIMALS</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>
          Toggle any animal to list it on the PFUMA Marketplace. Retailers and livestock buyers will immediately see it.
        </Text>
        {localAnimals.length === 0 ? (
          <View style={s.emptyInner}>
            <Text style={{ fontSize: 36 }}>🐄</Text>
            <Text style={s.emptyInnerText}>No animals registered yet</Text>
          </View>
        ) : localAnimals.map(a => (
          <View key={a.id} style={[s.animalRow, a.forSale && s.animalRowActive]}>
            <View style={{ flex: 1 }}>
              <Text style={s.animalName}>{a.name}</Text>
              <Text style={s.animalSub}>{a.species} · {a.currentWeight}kg</Text>
              {a.forSale && (
                <View style={s.animalListedRow}>
                  <Check size={11} color="#92400e" />
                  <Text style={s.animalListed}>Visible to retailers now</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[s.listBtn, a.forSale && s.listBtnActive]}
              onPress={() => toggleSale(a.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.listBtnText, a.forSale && s.listBtnTextActive]}>
                {a.forSale ? 'Unlist' : 'List for Sale'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Herd Value Trend */}
      <SectionLabel icon={TrendingUp}>HERD VALUE TREND (6 MONTHS)</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Estimated total herd value over the last 6 months</Text>
        <MiniBarChart data={HERD_GROWTH} labelKey="month" valueKey="value" color={COLORS.primary} />
      </View>

      {/* Medicine Cabinet */}
      <SectionLabel icon={Pill}>MEDICINE CABINET</SectionLabel>
      <View style={s.panel}>
        {INVENTORY.map(item => {
          const isLow = item.stock <= item.min;
          const pct   = Math.min(100, (item.stock / 1000) * 100);
          return (
            <View key={item.id} style={[s.medicineRow, isLow && { backgroundColor: '#fff5f5', borderColor: '#fca5a5' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={s.medicineName}>{item.name}</Text>
                {isLow && <Text style={s.medicineLow}>Low — reorder</Text>}
              </View>
              <Text style={s.medicineDetail}>{item.stock} {item.unit} · from {item.supplier}</Text>
              <View style={s.progressBar}>
                <View style={[s.progressFill, {
                  width: `${pct}%`,
                  backgroundColor: isLow ? COLORS.danger : pct > 50 ? COLORS.primary : '#f97316',
                }]} />
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: COLORS.goldBg, borderWidth: 1, borderColor: '#fde68a', marginTop: -4 }]} onPress={() => navigation.navigate('Vet')} activeOpacity={0.8}>
        <MessageSquare size={14} color="#b45309" />
        <Text style={[s.primaryBtnText, { color: '#b45309' }]}>Order from a Supplier</Text>
      </TouchableOpacity>

      {/* Disease Alerts */}
      <SectionLabel icon={AlertTriangle}>DISEASE ALERTS NEAR YOU</SectionLabel>
      <View style={s.panel}>
        {NOTIFICATIONS.map(n => <AlertCard key={n.id} {...n} />)}
      </View>

      {/* Farmers Near You */}
      <SectionLabel icon={Users}>FARMERS NEAR YOU</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Connect with other PFUMA farmers to swap tips, feed, or breeding stock.</Text>
        {NEARBY_FARMERS.map(f => (
          <View key={f.id} style={s.peerRow}>
            <View style={[s.peerAvatar, { backgroundColor: f.color }]}>
              <Text style={s.peerAvatarText}>{f.avatar}</Text>
              <View style={[s.peerDot, { backgroundColor: f.online ? '#4caf50' : '#aaa' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.peerName}>{f.name}</Text>
              <Text style={s.peerSub}>{f.role} · {f.province}</Text>
            </View>
            <TouchableOpacity style={s.peerMsgBtn} onPress={() => navigation.navigate('Vet', { filter: 'Farmer' })} activeOpacity={0.8}>
              <MessageSquare size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <StakeholderMap />
    </ScrollView>
  );
}

// ── VETERINARIAN DASHBOARD ──────────────────────────────────────────────────
function VeterinarianDashboard({ currentUser, navigation }) {
  const province = currentUser?.province || 'Mashonaland West';
  const lastName  = currentUser?.name?.split(' ').pop() || 'Officer';

  return (
    <ScrollView style={[s.bg, { backgroundColor: COLORS.slate }]} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Greeting banner */}
      <GradientBanner colors={ROLE_GRADIENT.Veterinarian}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Stethoscope size={22} color="#fff" />
          </View>
          <View style={[s.bannerAlert, s.bannerAlertRow, { backgroundColor: 'rgba(220,38,38,0.4)' }]}>
            <Globe size={14} color="#fff" />
            <Text style={s.bannerAlertText}>FMD QUARANTINE ACTIVE</Text>
          </View>
        </View>
        <Text style={[s.bannerEyebrow, { color: '#86efac' }]}>Authority Dashboard · {province}</Text>
        <Text style={s.bannerTitle}>{greet()}, Dr. {lastName}</Text>
        <Text style={[s.bannerSub, { color: '#cbd5e1' }]}>Provincial veterinary oversight — outbreaks, certifications, and farmer case management</Text>
      </GradientBanner>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <KpiCard label="Active Outbreaks"  value="1"   sub="FMD — Chegutu District"       accent="#1a0a0a" textColor="#f87171" borderColor="#7f1d1d"
          icon={AlertTriangle} iconColor="#f87171" iconBg="rgba(248,113,113,0.12)" />
        <KpiCard label="Cert. Queue"       value="12"  sub="Awaiting your sign-off"        accent="#1e293b" textColor="#f8fafc" borderColor="#334155"
          icon={ShieldCheck} iconColor="#4ade80" iconBg="rgba(74,222,128,0.12)" />
      </View>
      <View style={s.kpiRow}>
        <KpiCard label="Farms Under Watch" value="4"   sub="Mashonaland West registry"     accent="#1e293b" textColor="#f8fafc" borderColor="#334155"
          icon={Users} iconColor="#7dd3fc" iconBg="rgba(125,211,252,0.12)" />
        <KpiCard label="Node Sync"         value="99%" sub="PFUMA mesh network online"   accent="#1e293b" textColor="#4ade80" borderColor="#334155"
          icon={Wifi} iconColor="#4ade80" iconBg="rgba(74,222,128,0.12)" />
      </View>

      {/* Active Outbreak */}
      <SectionLabel light icon={AlertTriangle}>ACTIVE OUTBREAK</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#1a0a0a', borderColor: '#7f1d1d', borderWidth: 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <AlertTriangle size={14} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '700' }}>CRITICAL — Active</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Foot & Mouth Disease</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
          Confirmed in Chegutu District, Mashonaland West. Movement ban in effect.
        </Text>
        {[
          ['Status',          'CRITICAL — Active'],
          ['Affected farms',  '3 confirmed'],
          ['Animals at risk', '~200 cattle'],
          ['Restriction',     'No livestock movement'],
        ].map(([k, v]) => (
          <View key={k} style={s.infoRow}>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>{k}</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '800' }}>{v}</Text>
          </View>
        ))}
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#dc2626', marginTop: 14 }]} activeOpacity={0.8}>
          <PhoneCall size={14} color="#fff" />
          <Text style={s.primaryBtnText}>Issue Emergency Advisory</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <SectionLabel light icon={Compass}>QUICK ACTIONS</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }]}>
        {[
          { icon: MessageSquare, label: 'Vet Messenger',      desc: 'Chat with farmers',      color: COLORS.primary, tab: 'Vet'  },
          { icon: Users,         label: 'Animal Registry',    desc: 'View herd records',      color: COLORS.gold,    tab: 'Herd' },
          { icon: ShieldCheck,   label: 'Issue Certificate',  desc: 'Sign off a case',        color: COLORS.sprout,  tab: 'Vet'  },
        ].map(a => (
          <QuickBtn key={a.label} icon={a.icon} label={a.label} desc={a.desc} color={a.color} onPress={() => navigation.navigate(a.tab)} />
        ))}
      </View>

      {/* Farm Registry */}
      <SectionLabel light icon={Users}>FARMER REGISTRY — {province.toUpperCase()}</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }]}>
        <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 12, lineHeight: 16 }}>
          Farms under your provincial oversight. Tap to open a consultation.
        </Text>
        {FARMS.map((farm, i) => (
          <View key={i} style={s.farmRow}>
            <View style={s.farmAvatar}>
              <Text style={s.farmAvatarText}>{farm.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.farmName, { color: '#f8fafc' }]}>{farm.name}</Text>
                {farm.alert && <Text style={s.farmAlertBadge}>Alert</Text>}
              </View>
              <Text style={[s.farmSub, { color: '#64748b' }]}>{farm.province} · {farm.animals} animals</Text>
            </View>
            <Text style={[s.statusBadge, farm.status === 'Verified' ? s.statusVerified : s.statusPending]}>
              {farm.status}
            </Text>
          </View>
        ))}
      </View>

      {/* Provincial Network Health */}
      <SectionLabel light icon={Wifi}>PROVINCIAL NETWORK HEALTH</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }]}>
        <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 4, lineHeight: 16 }}>
          PFUMA mesh node sync rate — last 7 days
        </Text>
        <MiniBarChart data={NETWORK_HEALTH} labelKey="day" valueKey="sync" color={COLORS.sprout} light />
      </View>
    </ScrollView>
  );
}

// ── SUPPLIER DASHBOARD ──────────────────────────────────────────────────────
function SupplierDashboard({ currentUser, navigation }) {
  const pending    = ORDERS.filter(o => o.status === 'Pending').length;
  const dispatched = ORDERS.filter(o => o.status === 'Dispatched').length;
  const delivered  = ORDERS.filter(o => o.status === 'Delivered').length;

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Banner */}
      <GradientBanner colors={ROLE_GRADIENT.Supplier}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Pill size={22} color="#fff" />
          </View>
          {pending > 0 && (
            <View style={[s.bannerAlert, s.bannerAlertRow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Package size={14} color="#fff" />
              <Text style={s.bannerAlertText}>{pending} Pending Order{pending !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Text style={s.bannerEyebrow}>{greet()}, Supplier</Text>
        <Text style={s.bannerTitle}>Supply Distribution Hub</Text>
        <Text style={[s.bannerSub, { color: '#fef3c7' }]}>
          {pending} pending · {dispatched} in transit · {delivered} delivered
        </Text>
      </GradientBanner>

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA</Text>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#1a1a1a', marginBottom: 6 }}>You are a veterinary medicine & vaccine distributor</Text>
        <Text style={{ fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 10 }}>
          Farmers across Zimbabwe register on PFUMA to manage herd health. When they run low on vaccines or medicines, they contact you through the platform. You fulfill the order and dispatch to the farm.
        </Text>
        <View style={s.flowRow}>
          <Sprout size={16} color={COLORS.gold} />
          <Text style={s.flowText}>Farmer runs low on stock</Text>
          <ArrowRight size={12} color={COLORS.gold} />
          <Pill size={16} color={COLORS.gold} />
          <Text style={s.flowText}>You fulfill & dispatch</Text>
          <ArrowRight size={12} color={COLORS.gold} />
          <Text style={{ fontSize: 16 }}>🐄</Text>
          <Text style={s.flowText}>Animals stay healthy</Text>
        </View>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <KpiCard label="Pending Orders" value={pending}    sub="Need dispatch today"       accent={pending ? COLORS.goldBg : undefined} textColor={pending ? '#b45309' : undefined} borderColor={pending ? '#fde68a' : undefined}
          icon={Package} iconColor="#b45309" iconBg={COLORS.goldBg} />
        <KpiCard label="In Transit"     value={dispatched} sub="On the way to farmers"
          icon={Truck} iconColor="#2563eb" iconBg="#eff6ff" />
      </View>
      <View style={s.kpiRow}>
        <KpiCard label="Delivered"       value={delivered} sub="Completed this week"
          icon={CheckCircle} iconColor="#16a34a" iconBg="#f0fdf4" />
        <KpiCard label="Fulfillment Rate" value="92%"     sub="Monthly on-time delivery"
          icon={TrendingUp} iconColor={COLORS.gold} iconBg={COLORS.goldBg} />
      </View>

      {/* Active Orders */}
      <SectionLabel icon={Package}>ACTIVE ORDERS</SectionLabel>
      <View style={s.panel}>
        {ORDERS.map(o => (
          <View key={o.id} style={[s.orderRow, o.urgent && o.status === 'Pending' && { backgroundColor: COLORS.goldBg, borderColor: '#fde68a' }]}>
            <View style={s.orderIconWrap}>
              <Package size={20} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={s.orderFarm}>{o.farm}</Text>
                {o.urgent && o.status === 'Pending' && <Text style={s.urgentBadge}>Urgent</Text>}
              </View>
              <Text style={s.orderDetail}>{o.item} · {o.qty} · {o.id}</Text>
            </View>
            <Text style={[s.orderStatus,
              o.status === 'Pending'    ? { color: '#b45309', backgroundColor: COLORS.goldBg } :
              o.status === 'Dispatched' ? { color: '#1d4ed8', backgroundColor: '#eff6ff' } :
              { color: '#15803d', backgroundColor: '#f0fdf4' },
            ]}>{o.status}</Text>
          </View>
        ))}
      </View>

      {/* Order Demand Trend */}
      <SectionLabel icon={TrendingUp}>ORDER DEMAND (6 WEEKS)</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Weekly order volume across your farmer network</Text>
        <MiniBarChart data={DEMAND_DATA} labelKey="week" valueKey="orders" color={COLORS.gold} />
      </View>

      {/* Message a farmer */}
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: COLORS.gold, marginTop: 4 }]} onPress={() => navigation.navigate('Vet')} activeOpacity={0.8}>
        <MessageSquare size={14} color="#fff" />
        <Text style={s.primaryBtnText}>Message a Farmer</Text>
      </TouchableOpacity>

      <StakeholderMap />
    </ScrollView>
  );
}

// ── RETAILER DASHBOARD ──────────────────────────────────────────────────────
function RetailerDashboard({ currentUser, navigation }) {
  const listings    = ANIMALS.filter(a => a.forSale);
  const totalValue  = listings.reduce((a, l) => a + 500 + l.currentWeight * 1.5, 0);
  const avgPrice    = listings.length ? Math.round(totalValue / listings.length) : 0;

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Banner */}
      <GradientBanner colors={ROLE_GRADIENT.Retailer}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Store size={22} color="#fff" />
          </View>
          <View style={[s.bannerAlert, s.bannerAlertRow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <TrendingUp size={14} color="#fff" />
            <Text style={s.bannerAlertText}>Bullish</Text>
          </View>
        </View>
        <Text style={s.bannerEyebrow}>{greet()}, Retailer</Text>
        <Text style={s.bannerTitle}>Livestock Marketplace</Text>
        <Text style={[s.bannerSub, { color: '#ede9fe' }]}>
          {listings.length} active listing{listings.length !== 1 ? 's' : ''} · Market sentiment: Bullish
        </Text>
      </GradientBanner>

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.purple, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA</Text>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#1a1a1a', marginBottom: 6 }}>You are a livestock buyer & trader</Text>
        <Text style={{ fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 10 }}>
          Farmers list their animals for sale on PFUMA. Each animal comes with a certified Health Passport. You place a bid, the farmer accepts, and a DVS Vet issues an official movement certificate so you can legally transport the animal.
        </Text>
        <View style={s.flowRow}>
          <Sprout size={16} color={COLORS.purple} />
          <Text style={s.flowText}>Farmer lists</Text>
          <ArrowRight size={12} color={COLORS.purple} />
          <Store size={16} color={COLORS.purple} />
          <Text style={s.flowText}>You bid</Text>
          <ArrowRight size={12} color={COLORS.purple} />
          <Stethoscope size={16} color={COLORS.purple} />
          <Text style={s.flowText}>Vet certifies</Text>
          <ArrowRight size={12} color={COLORS.purple} />
          <CheckCircle size={16} color={COLORS.purple} />
          <Text style={s.flowText}>Sale complete</Text>
        </View>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <KpiCard label="Active Listings"     value={listings.length}             sub="Verified with health passports"
          icon={ShieldCheck} iconColor={COLORS.purple} iconBg={COLORS.purpleBg} />
        <KpiCard label="Avg. Price / Unit"   value={listings.length ? `$${avgPrice.toLocaleString()}` : '$—'} sub="Estimated market value"
          icon={Wallet} iconColor={COLORS.purple} iconBg={COLORS.purpleBg} />
      </View>
      <View style={s.kpiRow}>
        <KpiCard label="Total Listing Value" value={`$${totalValue.toLocaleString()}`}  sub="Combined herd value on market"
          icon={Tag} iconColor={COLORS.purple} iconBg={COLORS.purpleBg} />
        <KpiCard label="Market Sentiment"    value="BULLISH"                            sub="Prices trending upward +10%"  accent="#f5f3ff" textColor={COLORS.purple} borderColor="#c4b5fd"
          icon={TrendingUp} iconColor={COLORS.purple} iconBg="#ede9fe" />
      </View>

      {/* Listings */}
      <SectionLabel icon={ShoppingCart}>VERIFIED MARKETPLACE LISTINGS</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>All animals have a certified PFUMA Health Passport — safe to bid</Text>
        {listings.length === 0 ? (
          <View style={s.emptyInner}>
            <ShoppingCart size={36} color={COLORS.purple} />
            <Text style={s.emptyInnerText}>No listings yet</Text>
            <Text style={[s.emptyInnerText, { fontSize: 11, marginTop: 4 }]}>Farmers can list animals from their Herd Registry</Text>
          </View>
        ) : listings.map(a => (
          <View key={a.id} style={s.listingRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#1a1a1a' }}>{a.name}</Text>
                <Text style={s.certBadge}>Certified</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{a.breed} · {a.species} · {a.age} · {a.currentWeight}kg</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} color="#555" />
                <Text style={{ fontSize: 11, color: '#555', fontWeight: '700' }}>Verified Health Passport · Tag #{a.tagId}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: '#888', fontWeight: '700', textTransform: 'uppercase' }}>Est. Value</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.purple }}>${(500 + a.currentWeight * 1.5).toLocaleString()}</Text>
              <TouchableOpacity style={s.bidBtn} activeOpacity={0.8}>
                <Text style={s.bidBtnText}>Bid</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Cattle Price Trend */}
      <SectionLabel icon={TrendingUp}>CATTLE PRICE TREND</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Average per-head price over the last 6 months</Text>
        <MiniBarChart data={PRICE_DATA} labelKey="month" valueKey="price" color={COLORS.purple} />
      </View>

      {/* Recent Bids */}
      <SectionLabel icon={Wallet}>RECENT BIDS</SectionLabel>
      <View style={s.panel}>
        {RECENT_BIDS.map((b, i) => (
          <View key={i} style={s.bidRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#1a1a1a' }}>{b.animal}</Text>
              <Text style={{ fontSize: 11, color: '#666' }}>{b.bidder}</Text>
              <Text style={{ fontSize: 10, color: '#aaa', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 }}>{b.time}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.purple }}>${b.amount}</Text>
          </View>
        ))}
      </View>

      {/* How to Buy */}
      <SectionLabel icon={ListChecks}>HOW TO BUY</SectionLabel>
      <View style={s.panel}>
        {[
          { n: '1', t: 'Browse Listings',   d: 'All animals carry a certified PFUMA Health Passport' },
          { n: '2', t: 'Check the Passport',d: 'View vaccination history and breed details before bidding' },
          { n: '3', t: 'Place a Bid',        d: 'Your offer goes directly to the farmer via the platform' },
          { n: '4', t: 'Receive Certificate',d: 'DVS movement permit issued on confirmed sale' },
        ].map(step => (
          <View key={step.n} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{step.n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1a1a1a' }}>{step.t}</Text>
              <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{step.d}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Contact seller */}
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: COLORS.purple }]} onPress={() => navigation.navigate('Vet')} activeOpacity={0.8}>
        <MessageSquare size={14} color="#fff" />
        <Text style={s.primaryBtnText}>Contact a Seller</Text>
      </TouchableOpacity>

      <StakeholderMap />
    </ScrollView>
  );
}

// ── ROOT ────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ currentUser, onLogout, navigation }) {
  const role = currentUser?.role || 'Farmer';
  const gradient = ROLE_GRADIENT[role] || ROLE_GRADIENT.Farmer;
  const accent   = ROLE_ACCENT[role]   || ROLE_ACCENT.Farmer;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: role === 'Veterinarian' ? COLORS.slate : COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={gradient[0]} />

      {/* Top bar */}
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.topBar}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoText}>P</Text></View>
          <View>
            <Text style={s.logoName}>PFUMA</Text>
            <Text style={s.logoTagline}>Zimbabwe's Livestock Platform</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.userName} numberOfLines={1}>{currentUser?.name || 'User'}</Text>
          <Text style={[s.userRole, { color: accent }]}>{role}</Text>
        </View>
      </LinearGradient>

      {/* Role dashboard */}
      {role === 'Farmer'       && <FarmerDashboard       currentUser={currentUser} animals={ANIMALS} navigation={navigation} />}
      {role === 'Veterinarian' && <VeterinarianDashboard  currentUser={currentUser} navigation={navigation} />}
      {role === 'Supplier'     && <SupplierDashboard      currentUser={currentUser} navigation={navigation} />}
      {role === 'Retailer'     && <RetailerDashboard      currentUser={currentUser} navigation={navigation} />}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bg:              { flex: 1, backgroundColor: COLORS.bg },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  logoRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:         { width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText:        { color: '#fff', fontSize: 18, fontWeight: '900' },
  logoName:        { color: '#fff', fontSize: 14, fontWeight: '900' },
  logoTagline:     { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '600' },
  userName:        { color: '#fff', fontSize: 13, fontWeight: '800', maxWidth: 120 },
  userRole:        { color: '#fbc02d', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  banner:          { borderRadius: 24, padding: 20, marginBottom: 16, overflow: 'hidden' },
  bannerGlow1:     { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40 },
  bannerGlow2:     { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: -20 },
  bannerTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  bannerIconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bannerEyebrow:   { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  bannerTitle:     { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  bannerSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  bannerAlert:     { backgroundColor: 'rgba(220,38,38,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  bannerAlertRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerAlertText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  kpiRow:          { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', elevation: 2 },
  kpiHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  kpiLabel:        { flex: 1, fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiIconBadge:    { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  kpiValue:        { fontSize: 26, fontWeight: '900', color: '#111827', marginBottom: 4 },
  kpiSub:          { fontSize: 10, fontWeight: '500', color: '#9ca3af', lineHeight: 14 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 },
  sectionLabelLeft:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel:    { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  panel:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  panelDesc:       { fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 18 },

  emptyInner:      { alignItems: 'center', paddingVertical: 24 },
  emptyInnerText:  { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginTop: 8, textAlign: 'center' },

  priorityRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  priorityIconBadge:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priorityTitle:      { fontSize: 12, fontWeight: '800', color: '#1f2937' },
  prioritySub:        { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  priorityTag:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityTagText:    { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  priorityCountBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  priorityCountText:  { fontSize: 10, fontWeight: '900', color: '#fff' },

  quickBtn:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  quickIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  quickLabel:      { fontSize: 13, fontWeight: '800', color: '#111827' },
  quickDesc:       { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  quickArrow:      { fontSize: 20, color: '#d1d5db', marginLeft: 8 },

  alertCard:       { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 3, gap: 10 },
  alertCritical:   { backgroundColor: '#fff5f5', borderLeftColor: '#ef4444' },
  alertInfo:       { backgroundColor: '#eff6ff', borderLeftColor: '#3b82f6' },
  alertDot:        { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  alertTitle:      { fontSize: 12, fontWeight: '800', color: '#111827' },
  alertMsg:        { fontSize: 11, color: '#6b7280', marginTop: 2 },
  alertTime:       { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 },

  animalRow:       { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb' },
  animalRowActive: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  animalName:      { fontSize: 14, fontWeight: '900', color: '#111827' },
  animalSub:       { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  animalListedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  animalListed:    { fontSize: 10, fontWeight: '800', color: '#92400e' },
  listBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary },
  listBtnActive:   { backgroundColor: '#fbc02d', borderColor: '#fbc02d' },
  listBtnText:     { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  listBtnTextActive: { color: '#1a1a1a' },

  medicineRow:     { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  medicineName:    { fontSize: 12, fontWeight: '800', color: '#374151' },
  medicineLow:     { fontSize: 10, fontWeight: '800', color: COLORS.danger },
  medicineDetail:  { fontSize: 10, color: '#9ca3af', marginBottom: 8 },
  progressBar:     { height: 5, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 99 },

  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },

  farmRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 12 },
  farmAvatar:      { width: 40, height: 40, backgroundColor: '#334155', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  farmAvatarText:  { color: '#86efac', fontSize: 16, fontWeight: '900' },
  farmName:        { fontSize: 13, fontWeight: '900' },
  farmSub:         { fontSize: 10, marginTop: 2 },
  farmAlertBadge:  { backgroundColor: 'rgba(220,38,38,0.2)', color: '#f87171', fontSize: 9, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, textTransform: 'uppercase' },
  statusBadge:     { fontSize: 9, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },
  statusVerified:  { backgroundColor: 'rgba(134,239,172,0.15)', color: '#4ade80' },
  statusPending:   { backgroundColor: 'rgba(251,146,60,0.15)',  color: '#fb923c' },

  orderRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 10, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb' },
  orderIconWrap:   { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderFarm:       { fontSize: 13, fontWeight: '800', color: '#111827' },
  orderDetail:     { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  urgentBadge:     { fontSize: 9, fontWeight: '800', color: '#b45309', backgroundColor: COLORS.goldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },
  orderStatus:     { fontSize: 10, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },

  listingRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 12, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', gap: 10 },
  certBadge:       { fontSize: 9, fontWeight: '800', backgroundColor: COLORS.gold, color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, overflow: 'hidden' },
  bidBtn:          { marginTop: 8, backgroundColor: COLORS.purple, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bidBtnText:      { color: '#fff', fontSize: 11, fontWeight: '800' },

  bidRow:          { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f5f3ff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ddd6fe' },

  stepNum:         { width: 22, height: 22, backgroundColor: COLORS.purple, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  stepNumText:     { color: '#fff', fontSize: 10, fontWeight: '900' },

  primaryBtn:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, elevation: 4, marginBottom: 16 },
  primaryBtnText:  { color: '#fff', fontWeight: '900', fontSize: 15 },

  miniChart:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, marginTop: 6, gap: 6 },
  miniChartCol:    { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  miniChartTrack:  { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  miniChartBar:    { width: '100%', borderRadius: 6 },
  miniChartLabel:  { fontSize: 8, fontWeight: '800', color: '#9ca3af', marginTop: 4, textTransform: 'uppercase' },

  // Stakeholder map
  smCard:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8, elevation: 2, marginBottom: 8 },
  smTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  smTitle:         { fontSize: 13, fontWeight: '900', color: '#111827' },
  smDesc:          { fontSize: 11, color: '#9ca3af', marginBottom: 14, lineHeight: 16 },
  smRow:           { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, marginBottom: 8 },
  smRowIcon:       { width: 22, marginRight: 10, alignItems: 'center' },
  smRoleName:      { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  smRoleDesc:      { fontSize: 10, color: '#6b7280', lineHeight: 14 },
  smFlow:          { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginTop: 4 },
  smFlowTitle:     { fontSize: 9, fontWeight: '900', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 },
  smFlowRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  smFlowName:      { fontSize: 11, fontWeight: '900', color: '#374151' },
  smFlowDesc:      { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // Inline flow rows (Supplier/Retailer "how it works")
  flowRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  flowText:        { fontSize: 12, color: '#888', fontWeight: '500' },

  // Farmers Near You (peer community row)
  peerRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  peerAvatar:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  peerAvatarText:  { color: '#fff', fontSize: 13, fontWeight: '900' },
  peerDot:         { position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  peerName:        { fontSize: 13, fontWeight: '800', color: '#111827' },
  peerSub:         { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  peerMsgBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.light, alignItems: 'center', justifyContent: 'center' },
});
