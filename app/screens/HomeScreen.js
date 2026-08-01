import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native';
import { API, COLORS } from '../config';

const DEMO_STATS   = { animals: 2, listings: 1, messages: 2, total_value: 1400 };
const DEMO_ALERTS  = [
  { id: 1, title: 'January Disease Alert', msg: 'Chegutu — tick counts rising. Check your herd.', type: 'Critical' },
  { id: 2, title: 'Vaccine Recall',         msg: 'Lot #992 Oxytetracycline recalled by supplier.',  type: 'Info' },
];
const DEMO_EVENTS  = [
  { id: 1, animal_name: 'Bessie',  event_type: 'FMD Vaccine (Annual)',  event_date: '2026-02-15' },
];

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const StatCard = ({ emoji, label, value, color, bg }) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickBtn = ({ emoji, label, color, onPress }) => (
  <TouchableOpacity style={[styles.quickBtn, { borderColor: color }]} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.quickIcon, { backgroundColor: color }]}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </View>
    <Text style={[styles.quickLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const [stats,    setStats]    = useState(DEMO_STATS);
  const [alerts,   setAlerts]   = useState(DEMO_ALERTS);
  const [events,   setEvents]   = useState(DEMO_EVENTS);
  const [loading,  setLoading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API}/dashboard/1`),
        fetch(`${API}/animals?owner_id=1`),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (aRes.ok) {
        const animals = await aRes.json();
        // flatten all health events from all animals
        const evts = animals.flatMap(a =>
          (a.health_events || []).map(e => ({ ...e, animal_name: a.name }))
        ).slice(0, 5);
        if (evts.length) setEvents(evts);
      }
    } catch { /* stay on demo data */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>{greet()}, Farmer 🌾</Text>
          <Text style={styles.appName}>PFUMA</Text>
          <Text style={styles.tagline}>Zimbabwe's Livestock Intelligence Platform</Text>
        </View>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>P</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : null}

      {/* ── Stats ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Farm Today</Text>
        <View style={styles.statsRow}>
          <StatCard emoji="🐄" label="Animals"   value={stats.animals}   color={COLORS.primary} bg={COLORS.light} />
          <StatCard emoji="🏷" label="Listed"     value={stats.listings}  color="#e65100"       bg="#fff3e0" />
          <StatCard emoji="💬" label="Messages"   value={stats.messages}  color="#1565c0"       bg="#e3f2fd" />
          <StatCard emoji="💵" label="Est. Value" value={`$${Number(stats.total_value || 0).toLocaleString()}`} color="#4a148c" bg="#f3e5f5" />
        </View>
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <QuickBtn emoji="🐄" label="Register Animal"  color={COLORS.primary} onPress={() => navigation.navigate('Herd')} />
          <QuickBtn emoji="🛒" label="List for Sale"    color="#e65100"        onPress={() => navigation.navigate('Market')} />
          <QuickBtn emoji="🌾" label="Check Feed"       color="#558b2f"        onPress={() => navigation.navigate('Feed')} />
          <QuickBtn emoji="💬" label="Contact Vet"      color="#1565c0"        onPress={() => navigation.navigate('Profile')} />
        </View>
      </View>

      {/* ── Disease Alerts ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠ Disease Alerts Near You</Text>
        {alerts.map(a => (
          <View key={a.id} style={[styles.alertCard, { borderLeftColor: a.type === 'Critical' ? COLORS.danger : '#1565c0' }]}>
            <View style={[styles.alertDot, { backgroundColor: a.type === 'Critical' ? COLORS.danger : '#1565c0' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMsg}>{a.msg}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Recent Health Events ── */}
      <View style={[styles.section, { marginBottom: 30 }]}>
        <Text style={styles.sectionTitle}>Recent Health Events</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No health events recorded yet.</Text>
        ) : events.map((e, i) => (
          <View key={i} style={styles.eventCard}>
            <View style={styles.eventDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventAction}>{e.event_type}</Text>
              <Text style={styles.eventMeta}>{e.animal_name} · {String(e.event_date).slice(0, 10)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greet:         { color: '#a5d6a7', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  appName:       { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  tagline:       { color: '#a5d6a7', fontSize: 11, fontWeight: '600', marginTop: 2 },
  logoBox:       { width: 44, height: 44, backgroundColor: COLORS.yellow, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  logoText:      { color: COLORS.primary, fontSize: 26, fontWeight: '900' },
  section:       { marginHorizontal: 16, marginTop: 20 },
  sectionTitle:  { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow:      { flexDirection: 'row', gap: 8 },
  statCard:      { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', elevation: 2 },
  statEmoji:     { fontSize: 20, marginBottom: 4 },
  statValue:     { fontSize: 18, fontWeight: '900' },
  statLabel:     { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', marginTop: 2 },
  quickRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn:      { width: '47%', borderRadius: 16, borderWidth: 1.5, padding: 14, alignItems: 'center', backgroundColor: '#fff', elevation: 2 },
  quickIcon:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel:    { fontSize: 11, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  alertCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 10, elevation: 1 },
  alertDot:      { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  alertTitle:    { fontSize: 13, fontWeight: '800', color: COLORS.text },
  alertMsg:      { fontSize: 12, color: COLORS.muted, marginTop: 2, lineHeight: 17 },
  eventCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  eventDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, flexShrink: 0 },
  eventAction:   { fontSize: 13, fontWeight: '700', color: COLORS.text },
  eventMeta:     { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  emptyText:     { color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
});
