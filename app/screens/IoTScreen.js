import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thermometer, Heart, Check, AlertTriangle, Radio } from 'lucide-react-native';
import { COLORS } from '../config';
import { authFetch } from '../api';

// Real device data always takes priority. This local jitter generator only
// drives the display for an animal with no paired collar (or no reading in
// the last LIVE_FRESHNESS_MS) — always visibly labelled "DEMO DATA", never
// shown as "LIVE" the way it used to be. Mirrors the web app's
// HardwareSimulation.jsx real-data-first pattern.
const LIVE_FRESHNESS_MS = 20000;
const ACTIVITY_LABELS = ['Grazing', 'Walking', 'Resting', 'Running'];

function jitter(base, range) {
  return +(base + (Math.random() - 0.5) * range * 2).toFixed(1);
}

function BatteryBar({ pct }) {
  const color = pct > 60 ? COLORS.primary : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <View style={bat.wrap}>
      <View style={bat.body}>
        <View style={[bat.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={bat.tip} />
      <Text style={[bat.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const bat = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body:  { width: 40, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#ccc', overflow: 'hidden', backgroundColor: '#f3f4f6' },
  fill:  { height: '100%', borderRadius: 2 },
  tip:   { width: 4, height: 8, backgroundColor: '#ccc', borderTopRightRadius: 2, borderBottomRightRadius: 2, marginLeft: -1 },
  label: { fontSize: 11, fontWeight: '800' },
});

function SignalDots({ level }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map(i => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4 + i * 3,
            borderRadius: 1,
            backgroundColor: i <= level ? COLORS.primary : '#e5e7eb',
          }}
        />
      ))}
    </View>
  );
}

// LoRa RSSI (dBm) → a rough 1–4 bar count for the same signal-dots UI. Real
// hardware reports actual RSSI; there's no equivalent for demo mode.
function rssiToBars(rssi) {
  if (rssi == null) return 0;
  if (rssi > -70) return 4;
  if (rssi > -85) return 3;
  if (rssi > -100) return 2;
  return 1;
}

export default function IoTScreen({ currentUser }) {
  const [animals, setAnimals] = useState([]);
  const [devices, setDevices] = useState([]); // this farmer's paired collars
  const [selectedId, setSelectedId] = useState(null);
  const [readings, setReadings] = useState([]); // recent real readings for selected animal
  const [demoVitals, setDemoVitals] = useState({}); // fallback per animal when no live device
  const [tick, setTick] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const demoBase = useRef({}); // stable per-animal demo baseline, seeded once

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const loadAnimals = useCallback(async () => {
    try {
      const res = await authFetch(currentUser, '/animals');
      if (res.ok) {
        const rows = await res.json();
        setAnimals(rows);
        if (rows.length > 0) setSelectedId(prev => prev ?? rows[0].id);
      }
    } catch { /* offline — leave empty, no fake fallback */ }
  }, [currentUser?.token]);

  const loadDevices = useCallback(async () => {
    try {
      const res = await authFetch(currentUser, '/iot-devices');
      if (res.ok) setDevices(await res.json());
    } catch { /* offline */ }
  }, [currentUser?.token]);

  useEffect(() => { loadAnimals(); loadDevices(); }, [loadAnimals, loadDevices]);

  const loadReadings = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await authFetch(currentUser, `/animals/${selectedId}/iot-readings?limit=6`);
      if (res.ok) setReadings(await res.json());
      else setReadings([]);
    } catch { setReadings([]); }
  }, [selectedId, currentUser?.token]);

  useEffect(() => {
    loadReadings();
    const id = setInterval(loadReadings, 8000);
    return () => clearInterval(id);
  }, [loadReadings]);

  // Demo fallback tick — only actually used for whichever animal currently
  // has no fresh live reading (computed below).
  useEffect(() => {
    const id = setInterval(() => {
      setDemoVitals(prev => {
        const updated = { ...prev };
        animals.forEach(a => {
          if (!demoBase.current[a.id]) {
            demoBase.current[a.id] = { temp: 37.8 + Math.random() * 1.2, hr: 60 + Math.random() * 20 };
          }
          const base = demoBase.current[a.id];
          updated[a.id] = {
            temp: jitter(base.temp, 0.3),
            hr: Math.round(jitter(base.hr, 5)),
            activity: ACTIVITY_LABELS[Math.floor(Math.random() * ACTIVITY_LABELS.length)],
          };
        });
        return updated;
      });
      setTick(t => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [animals]);

  const animal = animals.find(a => a.id === selectedId);
  const device = devices.find(d => d.animal_id === selectedId);
  const latest = readings[0];
  const isLive = !!latest && (Date.now() - new Date(latest.received_at).getTime()) < LIVE_FRESHNESS_MS;

  if (!animal) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={s.header}>
          <View>
            <Text style={s.headerSub}>PFUMA</Text>
            <Text style={s.headerTitle}>IoT Monitor</Text>
          </View>
        </View>
        <View style={{ padding: 24, alignItems: 'center', marginTop: 40 }}>
          <Radio size={40} color={COLORS.muted} strokeWidth={1.5} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted, marginTop: 12, textAlign: 'center' }}>
            Register an animal in your Herd to see sensor data here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const v = isLive
    ? { temp: parseFloat(latest.temp_c), hr: latest.heart_rate, activity: latest.activity || 'Unknown' }
    : (demoVitals[selectedId] || { temp: 38.5, hr: 68, activity: 'Grazing' });

  const inZone = isLive ? !!latest.in_zone : true;
  const battery = isLive ? latest.battery_pct : null;
  const signalBars = isLive ? rssiToBars(latest.rssi) : 0;

  const tempColor = v.temp >= 39.5 ? '#ef4444' : v.temp >= 39.0 ? '#f59e0b' : COLORS.primary;
  const hrColor   = v.hr   >= 90   ? '#ef4444' : v.hr   >= 80   ? '#f59e0b' : COLORS.primary;

  const trendPoints = isLive
    ? [...readings].reverse().map(r => parseFloat(r.temp_c))
    : [v.temp, v.temp, v.temp, v.temp, v.temp, v.temp]; // flat demo placeholder, not fabricated history

  const liveAlerts = isLive
    ? readings.filter(r => r.fever_alert || r.theft_alert).map(r => ({
        id: r.id,
        type: r.fever_alert ? 'Health' : 'Security',
        msg: r.fever_alert
          ? `Fever detected — ${parseFloat(r.temp_c).toFixed(1)}°C`
          : 'Left the registered safe zone',
        time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>PFUMA</Text>
          <Text style={s.headerTitle}>IoT Monitor</Text>
          <Text style={s.headerDesc}>{isLive ? 'Live collar telemetry' : 'No live collar — showing demo data'}</Text>
        </View>
        <View style={[s.liveChip, !isLive && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          {isLive && <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />}
          <Text style={s.liveText}>{isLive ? 'LIVE' : 'DEMO'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

        {/* Animal selector */}
        <Text style={s.sectionLabel}>SELECT ANIMAL</Text>
        <View style={s.animalSelector}>
          {animals.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[s.animalTab, selectedId === a.id && s.animalTabActive]}
              onPress={() => { setSelectedId(a.id); setReadings([]); }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.animalDot, { backgroundColor: devices.some(d => d.animal_id === a.id) ? '#4ade80' : '#d1d5db' }]} />
                <Text style={[s.animalTabName, selectedId === a.id && { color: '#fff' }]}>{a.name}</Text>
              </View>
              <Text style={[s.animalTabSub, selectedId === a.id && { color: 'rgba(255,255,255,0.7)' }]}>
                {a.breed || a.species} · #{a.tag_id || 'no tag'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Collar info */}
        <View style={s.collarCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.collarName}>{animal.name}</Text>
            <Text style={s.collarSub}>
              {animal.breed} · {animal.species} · {device ? `Collar ${device.device_serial}` : 'No collar paired'}
            </Text>
          </View>
          {isLive && (
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <SignalDots level={signalBars} />
              {battery != null && <BatteryBar pct={battery} />}
            </View>
          )}
        </View>

        {/* Live Vitals */}
        <Text style={s.sectionLabel}>{isLive ? `LIVE VITALS · Updated ${Math.round((Date.now() - new Date(latest.received_at).getTime()) / 1000)}s ago` : `DEMO VITALS · Simulated, updates ${tick > 0 ? 'every 3s' : 'shortly'}`}</Text>
        <View style={s.vitalsRow}>
          <View style={[s.vitalCard, { borderTopColor: tempColor }]}>
            <Thermometer size={22} color={tempColor} style={{ marginBottom: 6 }} />
            <Text style={[s.vitalValue, { color: tempColor }]}>{v.temp}°C</Text>
            <Text style={s.vitalLabel}>Body Temp</Text>
            <Text style={[s.vitalStatus, { color: tempColor }]}>
              {v.temp >= 39.5 ? 'HIGH' : v.temp >= 39.0 ? 'ELEVATED' : 'NORMAL'}
            </Text>
            <Text style={s.vitalRef}>Normal: 38–39°C</Text>
          </View>
          <View style={[s.vitalCard, { borderTopColor: hrColor }]}>
            <Heart size={22} color={hrColor} style={{ marginBottom: 6 }} />
            <Text style={[s.vitalValue, { color: hrColor }]}>{v.hr} bpm</Text>
            <Text style={s.vitalLabel}>Heart Rate</Text>
            <Text style={[s.vitalStatus, { color: hrColor }]}>
              {v.hr >= 90 ? 'HIGH' : v.hr >= 80 ? 'ELEVATED' : 'NORMAL'}
            </Text>
            <Text style={s.vitalRef}>Normal: 48–84 bpm</Text>
          </View>
        </View>

        {/* Activity */}
        <View style={s.activityCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.actLabel}>Current Activity</Text>
            <Text style={s.actValue}>{v.activity}</Text>
          </View>
          <View style={[s.actBadge,
            { backgroundColor: v.activity === 'Running' ? '#fff5f5' : v.activity === 'Grazing' ? '#f0fdf4' : '#eff6ff' }
          ]}>
            <Text style={[s.actBadgeText,
              { color: v.activity === 'Running' ? '#ef4444' : v.activity === 'Grazing' ? '#16a34a' : '#2563eb' }
            ]}>{v.activity}</Text>
          </View>
        </View>

        {/* GPS / Zone */}
        <Text style={s.sectionLabel}>GPS & ZONE STATUS</Text>
        <View style={[s.zoneCard, inZone ? s.zoneCardSafe : s.zoneCardAlert]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.zoneStatus, { color: inZone ? '#15803d' : '#dc2626' }]}>
              {isLive ? (inZone ? 'In Safe Zone' : 'OUTSIDE SAFE ZONE') : 'No live GPS'}
            </Text>
            <Text style={s.zoneName}>{isLive ? (inZone ? 'Within registered boundary' : 'Boundary breach') : 'Pair a collar for real location data'}</Text>
            <Text style={s.zoneCoord}>
              {isLive
                ? (inZone ? 'Collar GPS within registered paddock boundary' : 'Movement detected outside designated paddock — verify location')
                : 'This animal has no paired collar reporting recently.'}
            </Text>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: isLive ? (inZone ? '#dcfce7' : '#fee2e2') : '#f3f4f6' }]}>
            {isLive
              ? (inZone ? <Check size={26} color="#15803d" strokeWidth={2.5} /> : <AlertTriangle size={24} color="#dc2626" strokeWidth={2.2} />)
              : <Radio size={22} color={COLORS.muted} strokeWidth={2} />}
          </View>
        </View>

        {/* Sensor History strip */}
        <Text style={s.sectionLabel}>{isLive ? 'SENSOR TREND — REAL READINGS' : 'SENSOR TREND (SIMULATED)'}</Text>
        <View style={s.trendCard}>
          <Text style={s.trendTitle}>Temperature — last {trendPoints.length} readings</Text>
          <View style={s.trendBars}>
            {trendPoints.map((t, i) => {
              const h = Math.max(10, ((t - 37.5) / 2) * 60);
              const c = t >= 39.5 ? '#ef4444' : t >= 39.0 ? '#f59e0b' : COLORS.primary;
              const isLast = i === trendPoints.length - 1;
              return (
                <View key={i} style={s.trendBarCol}>
                  <Text style={[s.trendBarVal, { color: c }]}>{t.toFixed(1)}</Text>
                  <View style={[s.trendBar, { height: h, backgroundColor: isLast ? c : c + '88' }]} />
                  <Text style={s.trendBarX}>{isLast ? 'Now' : ''}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Alerts */}
        <Text style={s.sectionLabel}>SENSOR ALERTS</Text>
        {liveAlerts.length === 0 ? (
          <View style={s.noAlerts}>
            <Text style={s.noAlertsText}>{isLive ? 'No active alerts — nominal' : 'No live collar — nothing to alert on'}</Text>
          </View>
        ) : (
          liveAlerts.map(al => (
            <View key={al.id} style={[s.alertCard, al.type === 'Security' ? s.alertCritical : s.alertWarning]}>
              <View style={[s.alertDot, { backgroundColor: al.type === 'Security' ? '#ef4444' : '#f59e0b' }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={s.alertAnimal}>{animal.name}</Text>
                  <Text style={s.alertTime}>{al.time}</Text>
                </View>
                <Text style={s.alertMsg}>{al.msg}</Text>
              </View>
            </View>
          ))
        )}

        {/* Fleet summary */}
        <Text style={s.sectionLabel}>FLEET SUMMARY</Text>
        <View style={s.fleetCard}>
          {[
            { label: 'Animals',        value: animals.length,                                   color: COLORS.primary },
            { label: 'Collars Paired', value: devices.length,                                    color: '#2563eb' },
            { label: 'This Animal',    value: isLive ? 'Live' : 'Demo',                           color: isLive ? '#16a34a' : '#9ca3af' },
          ].map(stat => (
            <View key={stat.label} style={s.fleetStat}>
              <Text style={[s.fleetStatValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.fleetStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:     { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:   { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:    { color: '#a5d6a7', fontSize: 11, marginTop: 2 },
  liveChip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  liveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  liveText:      { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  sectionLabel:  { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },

  animalSelector:{ flexDirection: 'row', gap: 10, marginBottom: 12 },
  animalTab:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: '#e5e7eb', elevation: 2 },
  animalTabActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  animalDot:     { width: 8, height: 8, borderRadius: 4 },
  animalTabName: { fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 2 },
  animalTabSub:  { fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  collarCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 4, elevation: 2 },
  collarName:    { fontSize: 18, fontWeight: '900', color: '#111827' },
  collarSub:     { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  vitalsRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  vitalCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderTopWidth: 4, elevation: 2, alignItems: 'center' },
  vitalValue:    { fontSize: 24, fontWeight: '900', marginBottom: 2 },
  vitalLabel:    { fontSize: 10, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  vitalStatus:   { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  vitalRef:      { fontSize: 9, color: '#d1d5db', marginTop: 4 },

  activityCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 4, elevation: 2 },
  actLabel:      { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 },
  actValue:      { fontSize: 16, fontWeight: '900', color: '#111827' },
  actBadge:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  actBadgeText:  { fontSize: 13, fontWeight: '900' },

  zoneCard:      { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4, elevation: 2 },
  zoneCardSafe:  { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0' },
  zoneCardAlert: { backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#fca5a5' },
  zoneStatus:    { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  zoneName:      { fontSize: 16, fontWeight: '900', color: '#111827', marginBottom: 4 },
  zoneCoord:     { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  zoneIcon:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  trendCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 4, elevation: 2 },
  trendTitle:    { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 14 },
  trendBars:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  trendBarCol:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBarVal:   { fontSize: 9, fontWeight: '800', marginBottom: 3 },
  trendBar:      { width: '100%', borderRadius: 4, minHeight: 10 },
  trendBarX:     { fontSize: 8, color: '#9ca3af', marginTop: 4, fontWeight: '600' },

  alertCard:     { flexDirection: 'row', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 3, gap: 12, alignItems: 'flex-start' },
  alertCritical: { backgroundColor: '#fff5f5', borderLeftColor: '#ef4444' },
  alertWarning:  { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' },
  alertDot:      { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  alertAnimal:   { fontSize: 12, fontWeight: '900', color: '#111827' },
  alertTime:     { fontSize: 10, fontWeight: '700', color: '#9ca3af' },
  alertMsg:      { fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 16 },

  noAlerts:      { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  noAlertsText:  { fontSize: 13, fontWeight: '700', color: '#16a34a' },

  fleetCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', elevation: 2 },
  fleetStat:     { alignItems: 'center' },
  fleetStatValue:{ fontSize: 22, fontWeight: '900', marginBottom: 2 },
  fleetStatLabel:{ fontSize: 9, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' },
});
