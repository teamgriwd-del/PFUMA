import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../config';

const ANIMALS = [
  {
    id: 101, name: 'Bessie', species: 'Cattle', breed: 'Brahman',
    tagId: 'ZIM-882', collarId: 'COL-007',
    baseTemp: 38.5, baseHr: 68, zone: 'North Paddock', inZone: true,
    battery: 82, signal: 4,
  },
  {
    id: 102, name: 'Thunder', species: 'Cattle', breed: 'Angus',
    tagId: 'ZIM-104', collarId: 'COL-012',
    baseTemp: 38.8, baseHr: 74, zone: 'South Paddock', inZone: false,
    battery: 47, signal: 3,
  },
];

const ALERTS = [
  { id: 1, animal: 'Thunder', type: 'zone', msg: 'Left South Paddock boundary — possible breach', severity: 'critical', time: '14:22' },
  { id: 2, animal: 'Bessie',  type: 'temp', msg: 'Temperature elevated: 39.1°C — monitor closely',  severity: 'warning',  time: '12:08' },
];

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

export default function IoTScreen() {
  const [selectedId, setSelectedId] = useState(101);
  const [vitals, setVitals] = useState({
    101: { temp: 38.5, hr: 68, activity: 'Grazing'   },
    102: { temp: 38.8, hr: 74, activity: 'Walking'   },
  });
  const [tick, setTick] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the live indicator
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

  // Simulate live sensor data every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setVitals(prev => {
        const updated = { ...prev };
        ANIMALS.forEach(a => {
          updated[a.id] = {
            temp:     jitter(a.baseTemp, 0.3),
            hr:       Math.round(jitter(a.baseHr, 5)),
            activity: ACTIVITY_LABELS[Math.floor(Math.random() * ACTIVITY_LABELS.length)],
          };
        });
        return updated;
      });
      setTick(t => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const animal  = ANIMALS.find(a => a.id === selectedId);
  const v       = vitals[selectedId];
  const alerts  = ALERTS.filter(al => al.animal === animal.name);
  const allAlerts = ALERTS;

  const tempColor = v.temp >= 39.5 ? '#ef4444' : v.temp >= 39.0 ? '#f59e0b' : COLORS.primary;
  const hrColor   = v.hr   >= 90   ? '#ef4444' : v.hr   >= 80   ? '#f59e0b' : COLORS.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>PFUMA</Text>
          <Text style={s.headerTitle}>IoT Monitor</Text>
          <Text style={s.headerDesc}>Live animal sensor telemetry</Text>
        </View>
        <View style={s.liveChip}>
          <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

        {/* Animal selector */}
        <Text style={s.sectionLabel}>SELECT ANIMAL</Text>
        <View style={s.animalSelector}>
          {ANIMALS.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[s.animalTab, selectedId === a.id && s.animalTabActive]}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.animalDot, { backgroundColor: a.inZone ? '#4ade80' : '#ef4444' }]} />
                <Text style={[s.animalTabName, selectedId === a.id && { color: '#fff' }]}>{a.name}</Text>
              </View>
              <Text style={[s.animalTabSub, selectedId === a.id && { color: 'rgba(255,255,255,0.7)' }]}>
                {a.breed} · #{a.tagId}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Collar info */}
        <View style={s.collarCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.collarName}>{animal.name}</Text>
            <Text style={s.collarSub}>{animal.breed} · {animal.species} · Collar {animal.collarId}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SignalDots level={animal.signal} />
            <BatteryBar pct={animal.battery} />
          </View>
        </View>

        {/* Live Vitals */}
        <Text style={s.sectionLabel}>LIVE VITALS · Updated {tick * 3}s ago</Text>
        <View style={s.vitalsRow}>
          <View style={[s.vitalCard, { borderTopColor: tempColor }]}>
            <Text style={s.vitalIcon}>🌡</Text>
            <Text style={[s.vitalValue, { color: tempColor }]}>{v.temp}°C</Text>
            <Text style={s.vitalLabel}>Body Temp</Text>
            <Text style={[s.vitalStatus, { color: tempColor }]}>
              {v.temp >= 39.5 ? 'HIGH' : v.temp >= 39.0 ? 'ELEVATED' : 'NORMAL'}
            </Text>
            <Text style={s.vitalRef}>Normal: 38–39°C</Text>
          </View>
          <View style={[s.vitalCard, { borderTopColor: hrColor }]}>
            <Text style={s.vitalIcon}>❤</Text>
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
        <View style={[s.zoneCard, animal.inZone ? s.zoneCardSafe : s.zoneCardAlert]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.zoneStatus, { color: animal.inZone ? '#15803d' : '#dc2626' }]}>
              {animal.inZone ? 'In Safe Zone' : 'OUTSIDE SAFE ZONE'}
            </Text>
            <Text style={s.zoneName}>{animal.zone}</Text>
            <Text style={s.zoneCoord}>
              {animal.inZone
                ? 'Collar GPS within registered paddock boundary'
                : 'Movement detected outside designated paddock — verify location'}
            </Text>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: animal.inZone ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={{ fontSize: 28 }}>{animal.inZone ? '✓' : '!'}</Text>
          </View>
        </View>

        {/* Sensor History strip */}
        <Text style={s.sectionLabel}>SENSOR TREND (SIMULATED)</Text>
        <View style={s.trendCard}>
          <Text style={s.trendTitle}>Temperature — last 6 readings</Text>
          <View style={s.trendBars}>
            {[38.3, 38.6, 38.5, 38.9, 38.7, v.temp].map((t, i) => {
              const h = Math.max(10, ((t - 37.5) / 2) * 60);
              const c = t >= 39.5 ? '#ef4444' : t >= 39.0 ? '#f59e0b' : COLORS.primary;
              return (
                <View key={i} style={s.trendBarCol}>
                  <Text style={[s.trendBarVal, { color: c }]}>{t.toFixed(1)}</Text>
                  <View style={[s.trendBar, { height: h, backgroundColor: i === 5 ? c : c + '88' }]} />
                  <Text style={s.trendBarX}>{i === 5 ? 'Now' : `-${(5 - i) * 3}m`}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Alerts */}
        <Text style={s.sectionLabel}>ALL SENSOR ALERTS</Text>
        {allAlerts.length === 0 ? (
          <View style={s.noAlerts}>
            <Text style={s.noAlertsText}>No active alerts — all animals nominal</Text>
          </View>
        ) : (
          allAlerts.map(al => (
            <View key={al.id} style={[s.alertCard, al.severity === 'critical' ? s.alertCritical : s.alertWarning]}>
              <View style={[s.alertDot, { backgroundColor: al.severity === 'critical' ? '#ef4444' : '#f59e0b' }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={s.alertAnimal}>{al.animal}</Text>
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
            { label: 'Collars Online',  value: ANIMALS.length,                          color: COLORS.primary },
            { label: 'In Safe Zone',    value: ANIMALS.filter(a => a.inZone).length,    color: '#16a34a' },
            { label: 'Active Alerts',   value: allAlerts.length,                         color: '#ef4444' },
            { label: 'Avg Battery',     value: `${Math.round(ANIMALS.reduce((s, a) => s + a.battery, 0) / ANIMALS.length)}%`, color: '#2563eb' },
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
  vitalIcon:     { fontSize: 22, marginBottom: 6 },
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
