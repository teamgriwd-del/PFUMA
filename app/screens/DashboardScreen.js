import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ImageBackground, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Globe, Sprout, Pill, Store, Stethoscope, AlertTriangle, CheckCircle, Check,
  MessageSquare, ShieldCheck, Wifi, Package, PhoneCall, HeartPulse, ShoppingCart,
  ArrowRight, Users, Wheat, Wallet, Syringe, ListChecks, Compass, Tag, TrendingUp, Truck, Beef, Plus, BookOpen,
} from 'lucide-react-native';
import { COLORS, FONTS, API } from '../config';
import { authFetch } from '../api';
import pfumaMark from '../assets/pfuma-mark.png';
import { roleHero } from '../imagery';

// A real uploaded photo is a relative /uploads/... path; a species stock
// fallback (assigned server-side) is already a full URL.
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

// Offline/first-paint fallback only — the live per-kg rate comes from the
// backend's market_rates table, refreshed from AMA Zimbabwe's real weekly
// market bulletin (see the Admin panel's Market Rates tab).
const FALLBACK_PRICE_PER_KG = { Cattle: 1.79, Goat: 1.02, Sheep: 1.25, Pig: 1.66 };
let _marketRatesCache = null;
let _marketRatesFetching = false;
function getMarketRates() {
  if (!_marketRatesCache && !_marketRatesFetching) {
    _marketRatesFetching = true;
    fetch(`${API}/market-rates`)
      .then(r => r.json())
      .then(data => { if (data?.rates) _marketRatesCache = data.rates; })
      .catch(() => { /* offline — falls back to FALLBACK_PRICE_PER_KG */ })
      .finally(() => { _marketRatesFetching = false; });
  }
  return _marketRatesCache || FALLBACK_PRICE_PER_KG;
}

// Regional disease-alert bulletin content — not per-user/animal data, left
// as static informational content (same treatment as the web app).
const NOTIFICATIONS = [
  { id: 1, title: 'January Disease Alert', msg: 'Chegutu Area — increased tick counts detected.', type: 'Critical', time: '1h ago' },
  { id: 2, title: 'Vaccine Recall',         msg: 'Lot #992 Oxytetracycline recalled by supplier.',  type: 'Info',     time: '4h ago' },
];
const VACCINE_SCHEDULES = {
  Cattle: [
    { name: 'FMD Vaccine (Annual)',     age: 180 },
    { name: 'Anthrax Vaccine',          age: 365 },
    { name: 'Blackleg Vaccine',         age: 90  },
  ],
};

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ── Per-role gradient & accent tokens (mirrors LoginScreen hero treatment) ──
const ROLE_GRADIENT = {
  Farmer:       [COLORS.primary, COLORS.medium],
  Veterinarian: [COLORS.teal, '#5D8B86'],
  Supplier:     [COLORS.gold, '#C99A4A'],
  Buyer:     [COLORS.purple, '#987591'],
};
const ROLE_ACCENT = {
  Farmer: '#C99A4A', Veterinarian: '#B3CBC8', Supplier: '#F6E9CF', Buyer: '#E9DEE7',
};

// ── Shared UI primitives ────────────────────────────────────────────────────
const SectionLabel = ({ children, light, icon: Icon, right }) => (
  <View style={s.sectionLabelRow}>
    <View style={s.sectionLabelLeft}>
      {Icon && <Icon size={12} color={light ? 'rgba(255,255,255,0.4)' : '#968C82'} strokeWidth={2.5} />}
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
        <View style={[s.kpiIconBadge, { backgroundColor: iconBg || '#EFE8DD' }]}>
          <Icon size={13} color={iconColor || '#968C82'} />
        </View>
      )}
    </View>
    <Text style={[s.kpiValue, textColor && { color: textColor }]}>{value}</Text>
    {sub ? <Text style={s.kpiSub} numberOfLines={2}>{sub}</Text> : null}
  </View>
);

// Full-bleed role photograph under a warm scrim — same treatment (and same
// photo library) as the web app's DashboardHero, so the two are in sync.
// `colors` still tints the scrim per role instead of a flat gradient fill.
const GradientBanner = ({ role, colors, children }) => (
  <ImageBackground
    source={{ uri: roleHero(role, { w: 900, q: 70 }) }}
    style={s.banner}
    imageStyle={s.bannerImage}
  >
    <LinearGradient
      colors={[colors[0] + 'E6', colors[0] + 'B3', colors[1] + '73']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      style={s.bannerScrim}
    >
      {children}
    </LinearGradient>
  </ImageBackground>
);

// 2x3 (or n-up) colored action grid — the mobile-first "quick actions" tile
// pattern shared with the web app's mobile dashboard, replacing the plain
// vertical QuickBtn list for the primary navigation surface.
const ActionGrid = ({ actions }) => (
  <View style={s.actionGrid}>
    {actions.map(a => (
      <TouchableOpacity key={a.label} style={s.actionTile} onPress={a.onPress} activeOpacity={0.8}>
        {a.badge ? (
          <View style={s.actionTileBadge}><Text style={s.actionTileBadgeText}>{a.badge}</Text></View>
        ) : null}
        <View style={[s.actionTileIcon, { backgroundColor: a.color }]}>
          <a.icon size={24} color="#fff" />
        </View>
        <Text style={s.actionTileLabel} numberOfLines={1}>{a.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// Green (role-accented) pill quick-actions bar — the "Quick Action Bar" from
// the reference design, sitting just below the header on every dashboard.
const PillBar = ({ color, actions }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.pillBar, { backgroundColor: color }]} contentContainerStyle={{ flexDirection: 'row' }}>
    {actions.map(a => (
      <TouchableOpacity key={a.label} style={s.pillBtn} onPress={a.onPress} activeOpacity={0.8}>
        <a.icon size={13} color="#fff" />
        <Text style={s.pillBtnText}>{a.label}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const AlertCard = ({ title, msg, type, time }) => (
  <View style={[s.alertCard, type === 'Critical' ? s.alertCritical : s.alertInfo]}>
    <View style={[s.alertDot, { backgroundColor: type === 'Critical' ? '#B5342C' : '#4F6A82' }]} />
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
          <Text style={[s.miniChartLabel, light && { color: '#7C7268' }]}>{d[labelKey]}</Text>
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
      <Text style={s.smTitle}>How PFUMA/INGCEBO Connects Everyone</Text>
    </View>
    <Text style={s.smDesc}>
      PFUMA/INGCEBO is a four-stakeholder ecosystem. Every role plays a specific part — here's how they all connect.
    </Text>
    {[
      { icon: Sprout,      role: 'Farmer',       color: COLORS.light,  text: COLORS.primary, desc: 'Registers animals, tracks health, orders medicines, lists livestock for sale.' },
      { icon: Pill,        role: 'Supplier',      color: COLORS.goldBg, text: '#6A4A20',      desc: 'Distributes vaccines, medicines, and feed to farmers.' },
      { icon: Store,       role: 'Buyer',      color: COLORS.purpleBg, text: COLORS.purple, desc: 'Browses certified livestock, places bids, receives DVS certificates.' },
      { icon: Stethoscope, role: 'Veterinarian',  color: '#DFE6EC', text: '#1C252E', desc: 'Certifies animal health, issues movement permits, manages outbreaks.' },
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
        { fromIcon: Sprout,      from: 'Farmer',   toIcon: Store,       to: 'Buyer', desc: 'lists animals for sale' },
        { fromIcon: Store,       from: 'Buyer', toIcon: Sprout,      to: 'Farmer',   desc: 'places a bid / makes an offer' },
        { fromIcon: Stethoscope, from: 'Vet',      toIcon: Store,       to: 'Buyer', desc: 'issues DVS movement certificate' },
      ].map((f, i) => (
        <View key={i} style={s.smFlowRow}>
          <f.fromIcon size={12} color="#554D45" />
          <Text style={s.smFlowName}>{f.from}</Text>
          <ArrowRight size={11} color="#968C82" />
          <f.toIcon size={12} color="#554D45" />
          <Text style={s.smFlowName}>{f.to}</Text>
          <Text style={s.smFlowDesc}>— {f.desc}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ── FARMER DASHBOARD ────────────────────────────────────────────────────────
function FarmerDashboard({ currentUser, navigation }) {
  const [localAnimals, setLocalAnimals] = useState([]);
  const [inventory, setInventory]       = useState([]);
  const [nearbyFarmers, setNearbyFarmers] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/animals');
        if (res.ok) setLocalAnimals((await res.json()).map(a => ({
          id: a.id, name: a.name, species: a.species, breed: a.breed, age: a.age,
          tagId: a.tag_id, birthDate: a.birth_date, currentWeight: a.current_weight,
          forSale: !!a.for_sale, imageUrl: resolveImageUrl(a.image_url),
        })));
      } catch { /* offline — leave empty, no fake fallback */ }
      try {
        const res = await authFetch(currentUser, `/inventory/${currentUser.id}`);
        if (res.ok) setInventory((await res.json()).map(i => ({ id: i.id, name: i.medicine_name, stock: Number(i.stock), unit: i.unit, min: Number(i.min_stock), supplier: i.supplier })));
      } catch { /* offline */ }
      try {
        const res = await authFetch(currentUser, '/users?role=Farmer');
        if (res.ok) {
          const users = await res.json();
          setNearbyFarmers(users.filter(u => u.id !== currentUser.id).slice(0, 5).map(u => ({ id: u.id, name: u.full_name, org: u.org_name, province: u.province })));
        }
      } catch { /* offline */ }
    })();
  }, [currentUser?.id]);

  const forSale    = localAnimals.filter(a => a.forSale).length;
  const critAlerts = NOTIFICATIONS.filter(n => n.type === 'Critical');
  const lowStock   = inventory.filter(i => i.stock <= i.min);
  // Rough per-kg live-weight benchmarks for the Zimbabwean market (wholesale
  // range midpoints from Selina Wamucii's Zimbabwe livestock price data,
  // checked September 2026) — replaces a flat +$500 that used to apply to
  // every animal regardless of species. Still a rough estimate.
  const marketRates = getMarketRates();
  const totalValue = localAnimals.reduce((acc, a) => acc + a.currentWeight * (marketRates[a.species] ?? marketRates.Cattle ?? FALLBACK_PRICE_PER_KG.Cattle), 0);

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
      icon: Syringe, bg: '#F6D9D5', color: '#9A2A23', tag: 'Overdue',
      title: v.vaccine, sub: `${v.animal} — vaccine due`,
    })),
    ...lowStock.map(item => ({
      icon: Package, bg: '#F7E1CE', color: '#8E450E', tag: 'Low Stock',
      title: item.name, sub: `${item.stock}${item.unit} remaining`,
    })),
    ...critAlerts.map(n => ({
      icon: AlertTriangle, bg: '#F6E9CF', color: '#8C632A', tag: 'Alert',
      title: n.title, sub: n.msg,
    })),
  ];

  // Listing ON requires a price, set via the same flow as the Herd screen —
  // this widget only handles the real, no-price-needed "unlist" action;
  // turning a listing on routes to Herd where that price modal already lives.
  const toggleSale = async (animal) => {
    if (!animal.forSale) { navigation.navigate('Herd'); return; }
    const res = await authFetch(currentUser, `/animals/${animal.id}/sale`, { method: 'PATCH' });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setLocalAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, forSale: !!data.for_sale } : a));
  };

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Greeting banner */}
      <GradientBanner role="Farmer" colors={ROLE_GRADIENT.Farmer}>
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

      {/* Quick actions pill bar */}
      <PillBar color={COLORS.primary} actions={[
        { icon: Plus,           label: 'Register',  onPress: () => navigation.navigate('Herd') },
        { icon: ShoppingCart,   label: 'Sell',       onPress: () => navigation.navigate('Market') },
        { icon: Stethoscope,    label: 'Diagnose',   onPress: () => navigation.navigate('Disease') },
        { icon: MessageSquare,  label: 'Messenger',  onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.sprout, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA/INGCEBO</Text>
        <Text style={{ fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.textDark, marginBottom: 6 }}>You are the heart of the herd</Text>
        <Text style={{ fontSize: 12, color: COLORS.mutedDark, lineHeight: 18, marginBottom: 10 }}>
          Register your animals, track their health, and reorder medicine before stocks run low. When ready, list animals on the Marketplace — a DVS vet certifies them so buyers across Zimbabwe can bid with confidence.
        </Text>
        <View style={s.flowRow}>
          <Sprout size={16} color={COLORS.sprout} />
          <Text style={s.flowText}>You raise & register</Text>
          <ArrowRight size={12} color={COLORS.sprout} />
          <Stethoscope size={16} color={COLORS.sprout} />
          <Text style={s.flowText}>Vet certifies health</Text>
          <ArrowRight size={12} color={COLORS.sprout} />
          <Store size={16} color={COLORS.sprout} />
          <Text style={s.flowText}>Buyer buys</Text>
        </View>
      </View>

      {/* KPI row */}
      <View style={s.kpiRow}>
        <KpiCard label="Total Animals" value={localAnimals.length} sub="In your herd registry"
          icon={Users} iconColor={COLORS.primary} iconBg={COLORS.light} />
        <KpiCard label="Herd Value" value={`$${totalValue.toLocaleString()}`} sub="Estimated market value"
          icon={Wallet} iconColor="#8C632A" iconBg={COLORS.goldBg} />
      </View>
      <View style={s.kpiRow}>
        <KpiCard
          label="Overdue Vaccines" value={overdueVaccines.length}
          sub={overdueVaccines.length ? 'Need immediate attention' : 'All vaccinations current'}
          accent={overdueVaccines.length ? 'rgba(198,40,40,0.12)' : undefined}
          textColor={overdueVaccines.length ? '#C75B50' : undefined}
          borderColor={overdueVaccines.length ? 'rgba(198,40,40,0.4)' : undefined}
          icon={Syringe}
          iconColor={overdueVaccines.length ? '#C75B50' : COLORS.sprout}
          iconBg={overdueVaccines.length ? 'rgba(198,40,40,0.15)' : 'rgba(34,197,94,0.15)'}
        />
        <KpiCard label="Listed for Sale" value={forSale} sub={forSale ? 'Visible on marketplace' : 'None listed yet'}
          icon={ShoppingCart} iconColor="#345C58" iconBg="#DAE7E5" />
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

      {/* Quick Actions grid */}
      <SectionLabel icon={Compass}>QUICK ACTIONS</SectionLabel>
      <ActionGrid actions={[
        { icon: Users,         label: 'Herd Registry', color: COLORS.primary, onPress: () => navigation.navigate('Herd') },
        { icon: ShieldCheck,   label: 'Follow-Ups',    color: '#9A2A23', badge: overdueVaccines.length || null, onPress: () => navigation.navigate('Compliance') },
        { icon: Package,       label: 'Medicine',      color: '#8E450E', badge: lowStock.length || null, onPress: () => navigation.navigate('Vet') },
        { icon: ShoppingCart,  label: 'Sell',          color: COLORS.purple, badge: forSale || null, onPress: () => navigation.navigate('Market') },
        { icon: HeartPulse,    label: 'Lifecycle',     color: '#41586C', onPress: () => navigation.navigate('Health') },
        { icon: MessageSquare, label: 'Messenger',     color: '#9B5A4B', onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Sell Your Animals */}
      <SectionLabel icon={Tag}>SELL YOUR ANIMALS</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>
          Toggle any animal to list it on the PFUMA/INGCEBO Marketplace. Buyers and livestock buyers will immediately see it.
        </Text>
        {localAnimals.length === 0 ? (
          <View style={s.emptyInner}>
            <Beef size={32} color={COLORS.mutedDark} strokeWidth={1.5} />
            <Text style={s.emptyInnerText}>No animals registered yet</Text>
          </View>
        ) : localAnimals.map(a => (
          <View key={a.id} style={[s.animalRow, a.forSale && s.animalRowActive]}>
            <View style={{ flex: 1 }}>
              <Text style={s.animalName}>{a.name}</Text>
              <Text style={s.animalSub}>{a.species} · {a.currentWeight}kg</Text>
              {a.forSale && (
                <View style={s.animalListedRow}>
                  <Check size={11} color="#6A4A20" />
                  <Text style={s.animalListed}>Visible to buyers now</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[s.listBtn, a.forSale && s.listBtnActive]}
              onPress={() => toggleSale(a)}
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
      {/* Medicine Cabinet */}
      <SectionLabel icon={Pill}>MEDICINE CABINET</SectionLabel>
      <View style={s.panel}>
        {inventory.map(item => {
          const isLow = item.stock <= item.min;
          const pct   = Math.min(100, (item.stock / 1000) * 100);
          return (
            <View key={item.id} style={[s.medicineRow, isLow && { backgroundColor: 'rgba(198,40,40,0.12)', borderColor: 'rgba(198,40,40,0.4)' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={s.medicineName}>{item.name}</Text>
                {isLow && <Text style={s.medicineLow}>Low — reorder</Text>}
              </View>
              <Text style={s.medicineDetail}>{item.stock} {item.unit} · from {item.supplier}</Text>
              <View style={s.progressBar}>
                <View style={[s.progressFill, {
                  width: `${pct}%`,
                  backgroundColor: isLow ? COLORS.danger : pct > 50 ? COLORS.primary : '#A65312',
                }]} />
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: COLORS.goldBg, borderWidth: 1, borderColor: '#EDD5A6', marginTop: -4 }]} onPress={() => navigation.navigate('Vet')} activeOpacity={0.8}>
        <MessageSquare size={14} color="#8C632A" />
        <Text style={[s.primaryBtnText, { color: '#8C632A' }]}>Order from a Supplier</Text>
      </TouchableOpacity>

      {/* Disease Alerts */}
      <SectionLabel icon={AlertTriangle}>DISEASE ALERTS NEAR YOU</SectionLabel>
      <View style={s.panel}>
        {NOTIFICATIONS.map(n => <AlertCard key={n.id} {...n} />)}
      </View>

      {/* Farmers Near You */}
      <SectionLabel icon={Users}>FARMERS NEAR YOU</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Connect with other PFUMA/INGCEBO farmers to swap tips, feed, or breeding stock.</Text>
        {nearbyFarmers.length === 0 ? (
          <View style={s.emptyInner}>
            <Text style={s.emptyInnerText}>No other registered farmers nearby yet</Text>
          </View>
        ) : nearbyFarmers.map(f => (
          <View key={f.id} style={s.peerRow}>
            <View style={[s.peerAvatar, { backgroundColor: COLORS.primary }]}>
              <Text style={s.peerAvatarText}>{(f.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.peerName}>{f.name}</Text>
              <Text style={s.peerSub}>{f.org || 'Farmer'} · {f.province}</Text>
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
  const [farms, setFarms] = useState([]);
  const [reportingHealth, setReportingHealth] = useState([]);
  const [certQueue, setCertQueue] = useState(0);
  const [outbreaks, setOutbreaks] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/vet/farm-registry');
        if (res.ok) setFarms(await res.json());
      } catch { /* offline — leave empty, no fake fallback */ }
      try {
        const res = await authFetch(currentUser, '/vet/reporting-health');
        if (res.ok) setReportingHealth(await res.json());
      } catch { /* offline */ }
      try {
        const res = await authFetch(currentUser, '/vet/cert-queue');
        if (res.ok) setCertQueue((await res.json()).pending);
      } catch { /* offline */ }
      try {
        const res = await authFetch(currentUser, '/outbreaks');
        if (res.ok) setOutbreaks(await res.json());
      } catch { /* offline */ }
    })();
  }, [currentUser?.id]);

  const activeOutbreak = outbreaks[0];

  return (
    <ScrollView style={[s.bg, { backgroundColor: COLORS.slate }]} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Greeting banner */}
      <GradientBanner role="Veterinarian" colors={ROLE_GRADIENT.Veterinarian}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Stethoscope size={22} color="#fff" />
          </View>
          {activeOutbreak && (
            <View style={[s.bannerAlert, s.bannerAlertRow, { backgroundColor: 'rgba(220,38,38,0.4)' }]}>
              <Globe size={14} color="#fff" />
              <Text style={s.bannerAlertText}>{activeOutbreak.disease_name.toUpperCase()} OUTBREAK ACTIVE</Text>
            </View>
          )}
        </View>
        <Text style={[s.bannerEyebrow, { color: '#A8B78C' }]}>Authority Dashboard · {province}</Text>
        <Text style={s.bannerTitle}>{greet()}, Dr. {lastName}</Text>
        <Text style={[s.bannerSub, { color: '#CBBFAD' }]}>Provincial veterinary oversight — outbreaks, certifications, and farmer case management</Text>
      </GradientBanner>

      {/* Quick actions pill bar */}
      <PillBar color={COLORS.primary} actions={[
        { icon: MessageSquare, label: 'Messenger', onPress: () => navigation.navigate('Vet') },
        { icon: Stethoscope,   label: 'Diagnose',  onPress: () => navigation.navigate('Herd') },
        { icon: ShieldCheck,   label: 'Certify',   onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* KPIs */}
      <View style={s.kpiRow}>
        <KpiCard label="Active Outbreaks"  value={String(outbreaks.length)} sub={activeOutbreak ? `${activeOutbreak.disease_name} — ${activeOutbreak.district || activeOutbreak.province}` : 'None reported'}
          accent={outbreaks.length ? '#260907' : '#3B342D'} textColor={outbreaks.length ? '#C75B50' : '#F7F3ED'} borderColor={outbreaks.length ? '#40100E' : '#554D45'}
          icon={AlertTriangle} iconColor="#C75B50" iconBg="rgba(248,113,113,0.12)" />
        <KpiCard label="Cert. Queue"       value={String(certQueue)}  sub="Unread trade certification requests"        accent="#3B342D" textColor="#F7F3ED" borderColor="#554D45"
          icon={ShieldCheck} iconColor="#8A9C68" iconBg="rgba(74,222,128,0.12)" />
      </View>
      <View style={s.kpiRow}>
        <KpiCard label="Farms Under Watch" value={String(farms.length)}   sub={`${province} registry`}     accent="#3B342D" textColor="#F7F3ED" borderColor="#554D45"
          icon={Users} iconColor="#98AEC0" iconBg="rgba(125,211,252,0.12)" />
        <KpiCard label="Reporting Rate"    value={reportingHealth.length ? `${reportingHealth[reportingHealth.length - 1].sync}%` : '—'} sub="Farms with a health event today"   accent="#3B342D" textColor="#8A9C68" borderColor="#554D45"
          icon={Wifi} iconColor="#8A9C68" iconBg="rgba(74,222,128,0.12)" />
      </View>

      {/* Active Outbreak */}
      <SectionLabel light icon={AlertTriangle}>ACTIVE OUTBREAK</SectionLabel>
      <View style={[s.panel, activeOutbreak ? { backgroundColor: '#260907', borderColor: '#40100E', borderWidth: 1 } : { backgroundColor: '#3B342D', borderColor: '#554D45', borderWidth: 1 }]}>
        {activeOutbreak ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertTriangle size={14} color="#C75B50" />
              <Text style={{ color: '#C75B50', fontSize: 13, fontFamily: FONTS.bold }}>{activeOutbreak.status.toUpperCase()}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontFamily: FONTS.extrabold, marginBottom: 4 }}>{activeOutbreak.disease_name}</Text>
            <Text style={{ color: '#968C82', fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
              Confirmed in {activeOutbreak.district ? `${activeOutbreak.district}, ` : ''}{activeOutbreak.province}. {activeOutbreak.details}
            </Text>
            {[
              ['Status',          activeOutbreak.status.toUpperCase()],
              ['Affected farms',  activeOutbreak.affected_farms || '—'],
              ['Animals at risk', activeOutbreak.animals_at_risk || '—'],
              ['Reported by',     activeOutbreak.reported_by_name],
            ].map(([k, v]) => (
              <View key={k} style={s.infoRow}>
                <Text style={{ color: '#7C7268', fontSize: 12, fontFamily: FONTS.semibold }}>{k}</Text>
                <Text style={{ color: '#E0D6C7', fontSize: 12, fontFamily: FONTS.extrabold }}>{v}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ color: '#7C7268', fontSize: 12, lineHeight: 18 }}>No active outbreaks reported in {province}.</Text>
        )}
      </View>

      {/* Quick Actions */}
      <SectionLabel light icon={Compass}>QUICK ACTIONS</SectionLabel>
      <ActionGrid actions={[
        { icon: MessageSquare, label: 'Messenger',      color: COLORS.primary, onPress: () => navigation.navigate('Vet') },
        { icon: Users,         label: 'Herd Registry',  color: COLORS.gold,    onPress: () => navigation.navigate('Herd') },
        { icon: ShieldCheck,   label: 'Certify',        color: COLORS.sprout,  onPress: () => navigation.navigate('Vet') },
        { icon: Stethoscope,   label: 'Diagnostics',    color: '#674A61',      onPress: () => navigation.navigate('Herd') },
      ]} />

      {/* Farm Registry */}
      <SectionLabel light icon={Users}>FARMER REGISTRY — {province.toUpperCase()}</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#3B342D', borderColor: '#554D45', borderWidth: 1 }]}>
        <Text style={{ color: '#7C7268', fontSize: 11, marginBottom: 12, lineHeight: 16 }}>
          Farms under your provincial oversight. Tap to open a consultation.
        </Text>
        {farms.length === 0 ? (
          <Text style={{ color: '#7C7268', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>No registered farmers in {province} yet.</Text>
        ) : farms.map(farm => (
          <View key={farm.id} style={s.farmRow}>
            <View style={s.farmAvatar}>
              <Text style={s.farmAvatarText}>{(farm.full_name || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.farmName, { color: '#F7F3ED' }]}>{farm.full_name}</Text>
              <Text style={[s.farmSub, { color: '#7C7268' }]}>{farm.org_name} · {farm.animal_count} animal{farm.animal_count !== 1 ? 's' : ''}</Text>
            </View>
            <Text style={[s.statusBadge, farm.verification_status === 'verified' ? s.statusVerified : s.statusPending]}>
              {farm.verification_status}
            </Text>
          </View>
        ))}
      </View>

      {/* Provincial Reporting Health */}
      <SectionLabel light icon={Wifi}>PROVINCIAL REPORTING HEALTH</SectionLabel>
      <View style={[s.panel, { backgroundColor: '#3B342D', borderColor: '#554D45', borderWidth: 1 }]}>
        <Text style={{ color: '#7C7268', fontSize: 11, marginBottom: 4, lineHeight: 16 }}>
          Share of {province}'s farmers who logged a health event — last 7 days
        </Text>
        <MiniBarChart data={reportingHealth} labelKey="day" valueKey="sync" color={COLORS.sprout} light />
      </View>
    </ScrollView>
  );
}

// ── SUPPLIER DASHBOARD ──────────────────────────────────────────────────────
function SupplierDashboard({ currentUser, navigation }) {
  const [orders, setOrders] = useState([]);
  const [demand, setDemand] = useState([]);
  const [fulfillmentRate, setFulfillmentRate] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);

  const loadSupplierData = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await authFetch(currentUser, '/orders/mine');
      if (res.ok) setOrders(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    try {
      const res = await authFetch(currentUser, '/supplier/demand');
      if (res.ok) setDemand(await res.json());
    } catch { /* offline */ }
    try {
      const res = await authFetch(currentUser, '/supplier/fulfillment-rate');
      if (res.ok) setFulfillmentRate((await res.json()).rate);
    } catch { /* offline */ }
  }, [currentUser?.id]);

  useEffect(() => { loadSupplierData(); }, [loadSupplierData]);

  const advanceOrder = async (order, action) => {
    setBusyOrderId(order.id);
    try {
      const res = await authFetch(currentUser, `/orders/${order.id}/${action}`, { method: 'PATCH' });
      if (res.ok) await loadSupplierData();
    } catch { /* offline */ }
    setBusyOrderId(null);
  };

  const pending    = orders.filter(o => o.status === 'pending').length;
  const dispatched = orders.filter(o => o.status === 'dispatched').length;
  const delivered  = orders.filter(o => o.status === 'delivered').length;

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Banner */}
      <GradientBanner role="Supplier" colors={ROLE_GRADIENT.Supplier}>
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
        <Text style={[s.bannerSub, { color: '#F6E9CF' }]}>
          {pending} pending · {dispatched} in transit · {delivered} delivered
        </Text>
      </GradientBanner>

      {/* Quick actions pill bar */}
      <PillBar color={COLORS.gold} actions={[
        { icon: Plus,           label: 'Add Stock',   onPress: () => navigation.navigate('Market') },
        { icon: Store,          label: 'Marketplace', onPress: () => navigation.navigate('Market') },
        { icon: Wheat,          label: 'Feed',        onPress: () => navigation.navigate('Feed') },
        { icon: MessageSquare,  label: 'Messenger',   onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Quick Actions grid */}
      <SectionLabel icon={Compass}>QUICK ACTIONS</SectionLabel>
      <ActionGrid actions={[
        { icon: Store,         label: 'Marketplace',   color: COLORS.gold, onPress: () => navigation.navigate('Market') },
        { icon: Package,       label: 'My Stock',      color: '#8E450E', badge: pending || null, onPress: () => navigation.navigate('Stock') },
        { icon: Wheat,         label: 'Feed Database', color: '#57633E', onPress: () => navigation.navigate('Feed') },
        { icon: BookOpen,      label: 'Trade Journal', color: '#674A61', onPress: () => navigation.navigate('TradingJournal') },
        { icon: MessageSquare, label: 'Messenger',     color: '#9B5A4B', onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA/INGCEBO</Text>
        <Text style={{ fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.textDark, marginBottom: 6 }}>You are a veterinary medicine & vaccine distributor</Text>
        <Text style={{ fontSize: 12, color: COLORS.mutedDark, lineHeight: 18, marginBottom: 10 }}>
          Farmers across Zimbabwe register on PFUMA/INGCEBO to manage herd health. When they run low on vaccines or medicines, they contact you through the platform. You fulfill the order and dispatch to the farm.
        </Text>
        <View style={s.flowRow}>
          <Sprout size={16} color={COLORS.gold} />
          <Text style={s.flowText}>Farmer runs low on stock</Text>
          <ArrowRight size={12} color={COLORS.gold} />
          <Pill size={16} color={COLORS.gold} />
          <Text style={s.flowText}>You fulfill & dispatch</Text>
          <ArrowRight size={12} color={COLORS.gold} />
          <Beef size={16} color={COLORS.gold} />
          <Text style={s.flowText}>Animals stay healthy</Text>
        </View>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <KpiCard label="Pending Orders" value={pending}    sub="Need dispatch today"       accent={pending ? COLORS.goldBg : undefined} textColor={pending ? '#8C632A' : undefined} borderColor={pending ? '#EDD5A6' : undefined}
          icon={Package} iconColor="#8C632A" iconBg={COLORS.goldBg} />
        <KpiCard label="In Transit"     value={dispatched} sub="On the way to farmers"
          icon={Truck} iconColor="#41586C" iconBg="#F0F3F6" />
      </View>
      <View style={s.kpiRow}>
        <KpiCard label="Delivered"       value={delivered} sub="Completed this week"
          icon={CheckCircle} iconColor="#57633E" iconBg="#F2F4EB" />
        <KpiCard label="Fulfillment Rate" value={fulfillmentRate === null ? '—' : `${fulfillmentRate}%`}     sub={fulfillmentRate === null ? 'No resolved orders yet' : 'Delivered vs. resolved orders'}
          icon={TrendingUp} iconColor={COLORS.gold} iconBg={COLORS.goldBg} />
      </View>

      {/* Active Orders */}
      <SectionLabel icon={Package}>ACTIVE ORDERS</SectionLabel>
      <View style={s.panel}>
        {orders.length === 0 ? (
          <Text style={{ color: COLORS.mutedDark, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 }}>
            No orders yet — farmers can order from your medicine/equipment listings.
          </Text>
        ) : orders.map(o => (
          <View key={o.id} style={[s.orderRow, o.status === 'pending' && { backgroundColor: 'rgba(202,138,4,0.12)', borderColor: 'rgba(202,138,4,0.4)' }]}>
            <View style={s.orderIconWrap}>
              <Package size={20} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.orderFarm}>{o.farmer_name}</Text>
              <Text style={s.orderDetail}>{o.product_name} · {Number(o.quantity)} · #{o.id}</Text>
            </View>
            <Text style={[s.orderStatus,
              o.status === 'pending'    ? { color: '#8C632A', backgroundColor: COLORS.goldBg } :
              o.status === 'dispatched' ? { color: '#354657', backgroundColor: '#F0F3F6' } :
              { color: '#465032', backgroundColor: '#F2F4EB' },
            ]}>{o.status}</Text>
            {o.status === 'pending' && (
              <TouchableOpacity onPress={() => advanceOrder(o, 'dispatch')} disabled={busyOrderId === o.id} style={s.orderActionBtn} activeOpacity={0.8}>
                <Text style={s.orderActionBtnText}>Dispatch</Text>
              </TouchableOpacity>
            )}
            {o.status === 'dispatched' && (
              <TouchableOpacity onPress={() => advanceOrder(o, 'deliver')} disabled={busyOrderId === o.id} style={[s.orderActionBtn, { backgroundColor: '#57633E' }]} activeOpacity={0.8}>
                <Text style={s.orderActionBtnText}>Deliver</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Order Demand Trend */}
      <SectionLabel icon={TrendingUp}>ORDER DEMAND (6 WEEKS)</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Your real weekly order volume</Text>
        {demand.length === 0 ? (
          <Text style={{ color: COLORS.mutedDark, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 }}>No orders yet to chart</Text>
        ) : (
          <MiniBarChart data={demand} labelKey="week" valueKey="orders" color={COLORS.gold} />
        )}
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

// ── BUYER DASHBOARD ──────────────────────────────────────────────────────
function BuyerDashboard({ currentUser, navigation }) {
  const [listings, setListings]     = useState([]);
  const [priceTrend, setPriceTrend] = useState([]);
  const [myBids, setMyBids]         = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/listings?category=livestock');
        if (res.ok) setListings(await res.json());
      } catch { /* offline — leave empty, no fake fallback */ }
      try {
        const res = await authFetch(currentUser, '/listings/price-trend');
        if (res.ok) setPriceTrend(await res.json());
      } catch { /* offline */ }
      try {
        const res = await authFetch(currentUser, '/bids/mine');
        if (res.ok) setMyBids(await res.json());
      } catch { /* offline */ }
    })();
  }, [currentUser?.id]);

  const totalValue  = listings.reduce((a, l) => a + Number(l.price), 0);
  const avgPrice    = listings.length ? Math.round(totalValue / listings.length) : 0;

  return (
    <ScrollView style={s.bg} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Banner */}
      <GradientBanner role="Buyer" colors={ROLE_GRADIENT.Buyer}>
        <View style={s.bannerTopRow}>
          <View style={s.bannerIconBadge}>
            <Store size={22} color="#fff" />
          </View>
          <View style={[s.bannerAlert, s.bannerAlertRow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <TrendingUp size={14} color="#fff" />
            <Text style={s.bannerAlertText}>Bullish</Text>
          </View>
        </View>
        <Text style={s.bannerEyebrow}>{greet()}, Buyer</Text>
        <Text style={s.bannerTitle}>Livestock Marketplace</Text>
        <Text style={[s.bannerSub, { color: '#E9DEE7' }]}>
          {listings.length} active listing{listings.length !== 1 ? 's' : ''} · Market sentiment: Bullish
        </Text>
      </GradientBanner>

      {/* Quick actions pill bar */}
      <PillBar color={COLORS.purple} actions={[
        { icon: Store,          label: 'Marketplace', onPress: () => navigation.navigate('Market') },
        { icon: Wheat,          label: 'Feed',        onPress: () => navigation.navigate('Feed') },
        { icon: MessageSquare,  label: 'Messenger',   onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Quick Actions grid */}
      <SectionLabel icon={Compass}>QUICK ACTIONS</SectionLabel>
      <ActionGrid actions={[
        { icon: Store,         label: 'Marketplace',    color: COLORS.purple, onPress: () => navigation.navigate('Market') },
        { icon: ShoppingCart,  label: 'Verified Stock', color: '#57633E', onPress: () => navigation.navigate('Market') },
        { icon: Wheat,         label: 'Feed Analyzer',  color: '#8E450E', onPress: () => navigation.navigate('Feed') },
        { icon: BookOpen,      label: 'Trade Journal',  color: '#523B4D', onPress: () => navigation.navigate('TradingJournal') },
        { icon: MessageSquare, label: 'Messenger',      color: '#9B5A4B', onPress: () => navigation.navigate('Vet') },
      ]} />

      {/* Role explanation */}
      <View style={s.panel}>
        <Text style={{ fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.purple, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your Role on PFUMA/INGCEBO</Text>
        <Text style={{ fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.textDark, marginBottom: 6 }}>You are a livestock buyer & trader</Text>
        <Text style={{ fontSize: 12, color: COLORS.mutedDark, lineHeight: 18, marginBottom: 10 }}>
          Farmers list their animals for sale on PFUMA/INGCEBO. Each animal comes with a certified Health Passport. You place a bid, the farmer accepts, and a DVS Vet issues an official movement certificate so you can legally transport the animal.
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
        <KpiCard label="Total Listing Value" value={`$${totalValue.toLocaleString()}`}  sub="Combined asking price on market"
          icon={Tag} iconColor={COLORS.purple} iconBg={COLORS.purpleBg} />
        <KpiCard label="Sales, Last 6mo"     value={priceTrend.reduce((a, m) => a + Number(m.sales), 0)} sub="Livestock listings marked sold"  accent="#F5F0F4" textColor={COLORS.purple} borderColor="#B596B0"
          icon={TrendingUp} iconColor={COLORS.purple} iconBg="#E9DEE7" />
      </View>

      {/* Listings */}
      <SectionLabel icon={ShoppingCart}>VERIFIED MARKETPLACE LISTINGS</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>All animals have a certified PFUMA/INGCEBO Health Passport — safe to bid</Text>
        {listings.length === 0 ? (
          <View style={s.emptyInner}>
            <ShoppingCart size={36} color={COLORS.purple} />
            <Text style={s.emptyInnerText}>No listings yet</Text>
            <Text style={[s.emptyInnerText, { fontSize: 11, marginTop: 4 }]}>Farmers can list animals from their Herd Registry</Text>
          </View>
        ) : listings.map(l => (
          <View key={l.id} style={s.listingRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.textDark }}>{l.product_name}</Text>
                <Text style={s.certBadge}>Certified</Text>
              </View>
              <Text style={{ fontSize: 12, color: COLORS.mutedDark, marginBottom: 4 }}>{l.seller_name} · {l.location || l.seller_province}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} color={COLORS.mutedDark} />
                <Text style={{ fontSize: 11, color: COLORS.mutedDark, fontFamily: FONTS.bold }}>Verified Health Passport</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: COLORS.mutedDark, fontFamily: FONTS.bold, textTransform: 'uppercase' }}>Asking Price</Text>
              <Text style={{ fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.purple }}>${Number(l.price).toLocaleString()}</Text>
              <TouchableOpacity style={s.bidBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Market')}>
                <Text style={s.bidBtnText}>Bid on Market</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Livestock Price Trend */}
      <SectionLabel icon={TrendingUp}>LIVESTOCK PRICE TREND</SectionLabel>
      <View style={s.panel}>
        <Text style={s.panelDesc}>Average price of livestock sales actually completed on PFUMA/INGCEBO, last 6 months</Text>
        {priceTrend.length === 0 ? (
          <View style={s.emptyInner}>
            <Text style={s.emptyInnerText}>No completed sales yet</Text>
          </View>
        ) : (
          <MiniBarChart data={priceTrend} labelKey="month" valueKey="avg_price" color={COLORS.purple} />
        )}
      </View>

      {/* Recent Bids */}
      <SectionLabel icon={Wallet}>RECENT BIDS</SectionLabel>
      <View style={s.panel}>
        {myBids.length === 0 ? (
          <View style={s.emptyInner}>
            <Text style={s.emptyInnerText}>No bids placed yet</Text>
          </View>
        ) : myBids.map(b => (
          <View key={b.id} style={s.bidRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.textDark }}>{b.product_name}</Text>
              <Text style={{ fontSize: 10, color: COLORS.mutedDark2, fontFamily: FONTS.bold, textTransform: 'uppercase', marginTop: 2 }}>
                {b.status === 'accepted' ? 'Accepted ✓' : b.status === 'declined' ? 'Declined' : 'Pending'} · {new Date(b.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.purple }}>${Number(b.amount).toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {/* How to Buy */}
      <SectionLabel icon={ListChecks}>HOW TO BUY</SectionLabel>
      <View style={s.panel}>
        {[
          { n: '1', t: 'Browse Listings',   d: 'All animals carry a certified PFUMA/INGCEBO Health Passport' },
          { n: '2', t: 'Check the Passport',d: 'View vaccination history and breed details before bidding' },
          { n: '3', t: 'Place a Bid',        d: 'Your offer goes directly to the farmer via the platform' },
          { n: '4', t: 'Receive Certificate',d: 'DVS movement permit issued on confirmed sale' },
        ].map(step => (
          <View key={step.n} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{step.n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.textDark }}>{step.t}</Text>
              <Text style={{ fontSize: 11, color: COLORS.mutedDark, marginTop: 2 }}>{step.d}</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDark }}>
      <StatusBar barStyle="light-content" backgroundColor={gradient[0]} />

      {/* Top bar */}
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.topBar}>
        <View style={s.logoRow}>
          <Image source={pfumaMark} style={s.logoBox} />
          <View>
            <Text style={s.logoName}>PFUMA/INGCEBO</Text>
            <Text style={s.logoTagline}>Zimbabwe's Livestock Platform</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.userName} numberOfLines={1}>{currentUser?.name || 'User'}</Text>
          <Text style={[s.userRole, { color: accent }]}>{role}</Text>
        </View>
      </LinearGradient>

      {/* Role dashboard */}
      {role === 'Farmer'       && <FarmerDashboard       currentUser={currentUser} navigation={navigation} />}
      {role === 'Veterinarian' && <VeterinarianDashboard  currentUser={currentUser} navigation={navigation} />}
      {role === 'Supplier'     && <SupplierDashboard      currentUser={currentUser} navigation={navigation} />}
      {role === 'Buyer'     && <BuyerDashboard      currentUser={currentUser} navigation={navigation} />}
      {/* Police and Institution now get real screens (PoliceScreen,
          InstitutionScreen) registered directly in App.js's ROLE_TABS —
          this placeholder is Admin-only now. Admin stays web-only
          deliberately: data-dense moderation tables/charts, not a phone
          task (see App.js's ROLE_TABS.Admin comment). */}
      {role === 'Admin' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.bgDark }}>
          <ShieldCheck size={40} color={COLORS.mutedDark} />
          <Text style={{ fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.textDark, marginTop: 14, textAlign: 'center' }}>
            Admin tools are web-only
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.mutedDark, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
            Platform moderation (users, listings, trends) lives in the PFUMA/INGCEBO web app, not this mobile app.
          </Text>
          <TouchableOpacity onPress={onLogout} activeOpacity={0.8}
            style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: COLORS.cardDark }}>
            <Text style={{ fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.sprout }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bg:              { flex: 1, backgroundColor: COLORS.bgDark },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  logoRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:         { width: 38, height: 38, borderRadius: 12 },
  logoName:        { color: '#fff', fontSize: 14, fontFamily: FONTS.extrabold },
  logoTagline:     { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontFamily: FONTS.semibold },
  userName:        { color: '#fff', fontSize: 13, fontFamily: FONTS.extrabold, maxWidth: 120 },
  userRole:        { color: '#C99A4A', fontSize: 9, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 1 },

  banner:          { borderRadius: 24, marginBottom: 16, overflow: 'hidden' },
  bannerImage:     { borderRadius: 24 },
  bannerScrim:     { padding: 20, minHeight: 190, justifyContent: 'flex-end' },
  bannerTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  bannerIconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bannerEyebrow:   { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  bannerTitle:     { color: '#fff', fontSize: 22, fontFamily: FONTS.extrabold, marginBottom: 4 },
  bannerSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: FONTS.semibold },
  bannerAlert:     { backgroundColor: 'rgba(220,38,38,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  bannerAlertRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerAlertText: { color: '#fff', fontSize: 12, fontFamily: FONTS.extrabold },

  kpiRow:          { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard:         { flex: 1, backgroundColor: COLORS.cardDark, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.borderDark },
  kpiHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  kpiLabel:        { flex: 1, fontSize: 9, fontFamily: FONTS.extrabold, color: COLORS.mutedDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiIconBadge:    { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  kpiValue:        { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.textDark, marginBottom: 4 },
  kpiSub:          { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.mutedDark, lineHeight: 14 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 },
  sectionLabelLeft:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel:    { fontSize: 9, fontFamily: FONTS.extrabold, color: COLORS.mutedDark, textTransform: 'uppercase', letterSpacing: 1 },
  panel:           { backgroundColor: COLORS.cardDark, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  panelDesc:       { fontSize: 12, color: COLORS.mutedDark, marginBottom: 12, lineHeight: 18 },

  emptyInner:      { alignItems: 'center', paddingVertical: 24 },
  emptyInnerText:  { fontSize: 13, fontFamily: FONTS.bold, color: '#968C82', marginTop: 8, textAlign: 'center' },

  priorityRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDark, gap: 12 },
  priorityIconBadge:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priorityTitle:      { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  prioritySub:        { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  priorityTag:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityTagText:    { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 0.3 },
  priorityCountBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#B5342C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  priorityCountText:  { fontSize: 10, fontFamily: FONTS.extrabold, color: '#fff' },

  alertCard:       { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 3, gap: 10 },
  alertCritical:   { backgroundColor: 'rgba(239,68,68,0.1)', borderLeftColor: '#B5342C' },
  alertInfo:       { backgroundColor: 'rgba(59,130,246,0.1)', borderLeftColor: '#4F6A82' },
  alertDot:        { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  alertTitle:      { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  alertMsg:        { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  alertTime:       { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.mutedDark2, textTransform: 'uppercase', marginTop: 4 },

  animalRow:       { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: COLORS.cardDark2, borderWidth: 1.5, borderColor: COLORS.borderDark },
  animalRowActive: { backgroundColor: 'rgba(251,192,45,0.1)', borderColor: 'rgba(251,192,45,0.4)' },
  animalName:      { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  animalSub:       { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  animalListedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  animalListed:    { fontSize: 10, fontFamily: FONTS.extrabold, color: '#C99A4A' },
  listBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary },
  listBtnActive:   { backgroundColor: '#C99A4A', borderColor: '#C99A4A' },
  listBtnText:     { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.sprout },
  listBtnTextActive: { color: '#29231E' },

  medicineRow:     { backgroundColor: COLORS.cardDark2, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderDark },
  medicineName:    { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  medicineLow:     { fontSize: 10, fontFamily: FONTS.extrabold, color: '#C75B50' },
  medicineDetail:  { fontSize: 10, color: COLORS.mutedDark, marginBottom: 8 },
  progressBar:     { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 99 },

  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },

  farmRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3B342D', gap: 12 },
  farmAvatar:      { width: 40, height: 40, backgroundColor: '#554D45', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  farmAvatarText:  { color: '#A8B78C', fontSize: 16, fontFamily: FONTS.extrabold },
  farmName:        { fontSize: 13, fontFamily: FONTS.extrabold },
  farmSub:         { fontSize: 10, marginTop: 2 },
  farmAlertBadge:  { backgroundColor: 'rgba(220,38,38,0.2)', color: '#C75B50', fontSize: 9, fontFamily: FONTS.extrabold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, textTransform: 'uppercase' },
  statusBadge:     { fontSize: 9, fontFamily: FONTS.extrabold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },
  statusVerified:  { backgroundColor: 'rgba(134,239,172,0.15)', color: '#8A9C68' },
  statusPending:   { backgroundColor: 'rgba(251,146,60,0.15)',  color: '#C87B3F' },

  orderRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 10, backgroundColor: COLORS.cardDark2, borderWidth: 1.5, borderColor: COLORS.borderDark },
  orderIconWrap:   { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderFarm:       { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  orderDetail:     { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  urgentBadge:     { fontSize: 9, fontFamily: FONTS.extrabold, color: '#8C632A', backgroundColor: COLORS.goldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },
  orderStatus:     { fontSize: 10, fontFamily: FONTS.extrabold, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, textTransform: 'uppercase', overflow: 'hidden' },
  orderActionBtn:     { marginLeft: 8, backgroundColor: '#41586C', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  orderActionBtnText: { color: '#fff', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  listingRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 12, backgroundColor: COLORS.cardDark2, borderWidth: 1.5, borderColor: COLORS.borderDark, gap: 10 },
  certBadge:       { fontSize: 9, fontFamily: FONTS.extrabold, backgroundColor: COLORS.gold, color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, overflow: 'hidden' },
  bidBtn:          { marginTop: 8, backgroundColor: COLORS.purple, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bidBtnText:      { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold },

  bidRow:          { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },

  stepNum:         { width: 22, height: 22, backgroundColor: COLORS.purple, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  stepNumText:     { color: '#fff', fontSize: 10, fontFamily: FONTS.extrabold },

  primaryBtn:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, elevation: 4, marginBottom: 16 },
  primaryBtnText:  { color: '#fff', fontFamily: FONTS.extrabold, fontSize: 15 },

  miniChart:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, marginTop: 6, gap: 6 },
  miniChartCol:    { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  miniChartTrack:  { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  miniChartBar:    { width: '100%', borderRadius: 6 },
  miniChartLabel:  { fontSize: 8, fontFamily: FONTS.extrabold, color: COLORS.mutedDark, marginTop: 4, textTransform: 'uppercase' },

  // Stakeholder map
  smCard:          { backgroundColor: COLORS.cardDark, borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: COLORS.borderDark, marginBottom: 8 },
  smTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  smTitle:         { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  smDesc:          { fontSize: 11, color: COLORS.mutedDark, marginBottom: 14, lineHeight: 16 },
  smRow:           { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, marginBottom: 8 },
  smRowIcon:       { width: 22, marginRight: 10, alignItems: 'center' },
  smRoleName:      { fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  smRoleDesc:      { fontSize: 10, color: 'rgba(0,0,0,0.55)', lineHeight: 14 },
  smFlow:          { backgroundColor: COLORS.cardDark2, borderRadius: 12, padding: 12, marginTop: 4 },
  smFlowTitle:     { fontSize: 9, fontFamily: FONTS.extrabold, color: COLORS.mutedDark, letterSpacing: 1, marginBottom: 8 },
  smFlowRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  smFlowName:      { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  smFlowDesc:      { fontSize: 11, color: COLORS.mutedDark, fontFamily: FONTS.semibold },

  // Inline flow rows (Supplier/Buyer "how it works")
  flowRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  flowText:        { fontSize: 12, color: COLORS.mutedDark, fontFamily: FONTS.semibold },

  // Farmers Near You (peer community row)
  peerRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDark, gap: 12 },
  peerAvatar:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  peerAvatarText:  { color: '#fff', fontSize: 13, fontFamily: FONTS.extrabold },
  peerDot:         { position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: COLORS.cardDark },
  peerName:        { fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.textDark },
  peerSub:         { fontSize: 11, color: COLORS.mutedDark, marginTop: 1 },
  peerMsgBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

  // Mobile-first dark header (avatar + greeting), quick-actions pill bar,
  // and 2x3 colored action grid — matches the web app's mobile dashboard.
  darkHeaderRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  darkAvatar:      { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  darkAvatarText:  { color: '#fff', fontSize: 14, fontFamily: FONTS.extrabold },
  darkGreetLabel:  { color: COLORS.mutedDark, fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 1.5 },
  darkGreetName:   { color: COLORS.textDark, fontSize: 16, fontFamily: FONTS.extrabold, marginTop: 2 },

  pillBar:         { flexDirection: 'row', borderRadius: 16, padding: 6, marginBottom: 16 },
  pillBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  pillBtnText:     { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: FONTS.extrabold },

  tipCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardDark, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  tipIconBadge:    { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipTitle:        { color: COLORS.textDark, fontSize: 12, fontFamily: FONTS.extrabold },
  tipSub:          { color: COLORS.mutedDark, fontSize: 10, fontFamily: FONTS.semibold, marginTop: 1 },

  actionGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  actionTile:      { width: '47%', backgroundColor: COLORS.cardDark, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDark, paddingVertical: 20, alignItems: 'center', gap: 10 },
  actionTileIcon:  { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionTileLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontFamily: FONTS.extrabold, textAlign: 'center' },
  actionTileBadge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#B5342C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionTileBadgeText: { color: '#fff', fontSize: 8, fontFamily: FONTS.extrabold },
});
