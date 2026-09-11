import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thermometer, Heart, Check, AlertTriangle, Radio, RadioTower, Tag, Link2, Plus, ShieldCheck } from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

const DEVICE_TYPES = [
  { id: 'base_station', label: 'Base Station', icon: RadioTower, hint: 'One per farm — the fixed box near your router.', placeholder: 'e.g. BS-01-HNO' },
  { id: 'collar',       label: 'Collar',       icon: Tag,        hint: 'One per animal — worn on the animal.',          placeholder: 'e.g. CN-014ZVI' },
];

// Farmer-only device pairing card — mirrors the web app's DevicePairingPanel.
function PairingPanel({ currentUser, animals, devices, onPaired }) {
  const [deviceType, setDeviceType] = useState('base_station');
  const [serial, setSerial] = useState('');
  const [animalId, setAnimalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (currentUser?.role !== 'Farmer') return null;
  const activeType = DEVICE_TYPES.find(t => t.id === deviceType);

  const pair = async () => {
    if (!serial.trim()) return;
    setBusy(true);
    const { ok, data } = await authJson(currentUser, '/iot-devices/pair', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_serial: serial.trim(),
        device_type: deviceType,
        animal_id: deviceType === 'collar' ? (animalId || null) : null,
      }),
    });
    setFeedback(ok ? `${activeType.label} paired.` : (data.error || 'Could not pair — try again.'));
    if (ok) { setSerial(''); setAnimalId(''); onPaired(); }
    setBusy(false);
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <View style={p.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Link2 size={14} color={COLORS.primary} />
        <Text style={p.title}>Paired Devices</Text>
      </View>
      <Text style={p.subtitle}>Claim a physical collar or base station by its printed serial number.</Text>

      {devices.length > 0 && (
        <View style={{ gap: 6, marginBottom: 12 }}>
          {devices.map(dv => {
            const TypeIcon = dv.device_type === 'base_station' ? RadioTower : Tag;
            return (
              <View key={dv.id} style={p.deviceRow}>
                <View style={p.deviceIconBox}><TypeIcon size={13} color="#7C7268" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={p.deviceSerial}>{dv.device_serial}</Text>
                  <Text style={p.deviceMeta}>
                    {dv.device_type === 'base_station' ? 'Base Station' : (dv.animal_name ? `Collar · ${dv.animal_name}` : 'Collar · unattached')}
                  </Text>
                </View>
                <ShieldCheck size={13} color={COLORS.primary} />
              </View>
            );
          })}
        </View>
      )}

      {feedback && <Text style={p.feedback}>{feedback}</Text>}

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {DEVICE_TYPES.map(t => {
          const active = deviceType === t.id;
          return (
            <TouchableOpacity key={t.id} activeOpacity={0.8}
              onPress={() => { setDeviceType(t.id); setAnimalId(''); }}
              style={[p.typeBtn, active && { backgroundColor: COLORS.primary }]}>
              <t.icon size={13} color={active ? '#fff' : '#7C7268'} />
              <Text style={[p.typeBtnText, active && { color: '#fff' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={p.hint}>{activeType.hint}</Text>

      <TextInput
        style={p.input} placeholder={`Serial (${activeType.placeholder})`}
        placeholderTextColor="#bbb" value={serial} onChangeText={setSerial}
      />
      {deviceType === 'collar' && animals.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {animals.map(a => {
            const active = animalId === String(a.id);
            return (
              <TouchableOpacity key={a.id} activeOpacity={0.8}
                onPress={() => setAnimalId(active ? '' : String(a.id))}
                style={[p.animalChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                <Text style={[p.animalChipText, active && { color: '#fff' }]}>{a.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <TouchableOpacity style={p.pairBtn} onPress={pair} disabled={busy} activeOpacity={0.8}>
        {busy ? <ActivityIndicator color="#fff" /> : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Plus size={14} color="#fff" strokeWidth={2.5} />
            <Text style={p.pairBtnText}>Pair {activeType.label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const p = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, marginBottom: 16 },
  title:       { fontSize: 14, fontFamily: FONTS.extrabold, color: '#29231E' },
  subtitle:    { fontSize: 11, color: '#968C82', fontFamily: FONTS.semibold, marginBottom: 12 },
  deviceRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F3ED', borderRadius: 12, padding: 10 },
  deviceIconBox:{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0D6C7', alignItems: 'center', justifyContent: 'center' },
  deviceSerial:{ fontSize: 11, fontFamily: FONTS.extrabold, color: '#29231E' },
  deviceMeta:  { fontSize: 10, color: '#968C82', fontFamily: FONTS.semibold, marginTop: 1 },
  feedback:    { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.primary, backgroundColor: '#F2F4EB', borderWidth: 1, borderColor: '#C9D2B4', borderRadius: 10, padding: 8, marginBottom: 10 },
  typeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F7F3ED' },
  typeBtnText: { fontSize: 10, fontFamily: FONTS.extrabold, color: '#7C7268', textTransform: 'uppercase' },
  hint:        { fontSize: 10, color: '#968C82', fontFamily: FONTS.semibold, marginBottom: 10, lineHeight: 15 },
  input:       { backgroundColor: '#F7F3ED', borderRadius: 12, padding: 12, fontSize: 13, fontFamily: FONTS.semibold, color: '#29231E', marginBottom: 10 },
  animalChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E0D6C7' },
  animalChipText:{ fontSize: 11, fontFamily: FONTS.bold, color: '#7C7268' },
  pairBtn:     { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pairBtnText: { color: '#fff', fontSize: 13, fontFamily: FONTS.extrabold },
});

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
  const color = pct > 60 ? COLORS.primary : pct > 25 ? '#C99A4A' : '#B5342C';
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
  body:  { width: 40, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#ccc', overflow: 'hidden', backgroundColor: '#EFE8DD' },
  fill:  { height: '100%', borderRadius: 2 },
  tip:   { width: 4, height: 8, backgroundColor: '#ccc', borderTopRightRadius: 2, borderBottomRightRadius: 2, marginLeft: -1 },
  label: { fontSize: 11, fontFamily: FONTS.extrabold },
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
            backgroundColor: i <= level ? COLORS.primary : '#E0D6C7',
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
            <Text style={s.headerSub}>PFUMA/INGCEBO</Text>
            <Text style={s.headerTitle}>IoT Monitor</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <View style={{ padding: 24, alignItems: 'center', marginBottom: 8 }}>
            <Radio size={40} color={COLORS.muted} strokeWidth={1.5} />
            <Text style={{ fontSize: 13, fontFamily: FONTS.bold, color: COLORS.muted, marginTop: 12, textAlign: 'center' }}>
              Register an animal in your Herd to see sensor data here.
            </Text>
          </View>
          <PairingPanel currentUser={currentUser} animals={animals} devices={devices} onPaired={loadDevices} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const v = isLive
    ? { temp: parseFloat(latest.temp_c), hr: latest.heart_rate, activity: latest.activity || 'Unknown' }
    : (demoVitals[selectedId] || { temp: 38.5, hr: 68, activity: 'Grazing' });

  const inZone = isLive ? !!latest.in_zone : true;
  const battery = isLive ? latest.battery_pct : null;
  const signalBars = isLive ? rssiToBars(latest.rssi) : 0;

  const tempColor = v.temp >= 39.5 ? '#B5342C' : v.temp >= 39.0 ? '#C99A4A' : COLORS.primary;
  const hrColor   = v.hr   >= 90   ? '#B5342C' : v.hr   >= 80   ? '#C99A4A' : COLORS.primary;

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
          <Text style={s.headerSub}>PFUMA/INGCEBO</Text>
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
                <View style={[s.animalDot, { backgroundColor: devices.some(d => d.animal_id === a.id) ? '#8A9C68' : '#CBBFAD' }]} />
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
            { backgroundColor: v.activity === 'Running' ? '#FBEEEC' : v.activity === 'Grazing' ? '#F2F4EB' : '#F0F3F6' }
          ]}>
            <Text style={[s.actBadgeText,
              { color: v.activity === 'Running' ? '#B5342C' : v.activity === 'Grazing' ? '#57633E' : '#41586C' }
            ]}>{v.activity}</Text>
          </View>
        </View>

        {/* GPS / Zone */}
        <Text style={s.sectionLabel}>GPS & ZONE STATUS</Text>
        <View style={[s.zoneCard, inZone ? s.zoneCardSafe : s.zoneCardAlert]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.zoneStatus, { color: inZone ? '#465032' : '#9A2A23' }]}>
              {isLive ? (inZone ? 'In Safe Zone' : 'OUTSIDE SAFE ZONE') : 'No live GPS'}
            </Text>
            <Text style={s.zoneName}>{isLive ? (inZone ? 'Within registered boundary' : 'Boundary breach') : 'Pair a collar for real location data'}</Text>
            <Text style={s.zoneCoord}>
              {isLive
                ? (inZone ? 'Collar GPS within registered paddock boundary' : 'Movement detected outside designated paddock — verify location')
                : 'This animal has no paired collar reporting recently.'}
            </Text>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: isLive ? (inZone ? '#E3E8D6' : '#F6D9D5') : '#EFE8DD' }]}>
            {isLive
              ? (inZone ? <Check size={26} color="#465032" strokeWidth={2.5} /> : <AlertTriangle size={24} color="#9A2A23" strokeWidth={2.2} />)
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
              const c = t >= 39.5 ? '#B5342C' : t >= 39.0 ? '#C99A4A' : COLORS.primary;
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
              <View style={[s.alertDot, { backgroundColor: al.type === 'Security' ? '#B5342C' : '#C99A4A' }]} />
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
        <View style={[s.fleetCard, { marginBottom: 16 }]}>
          {[
            { label: 'Animals',        value: animals.length,                                   color: COLORS.primary },
            { label: 'Collars Paired', value: devices.filter(d => d.device_type === 'collar').length, color: '#41586C' },
            { label: 'This Animal',    value: isLive ? 'Live' : 'Demo',                           color: isLive ? '#57633E' : '#968C82' },
          ].map(stat => (
            <View key={stat.label} style={s.fleetStat}>
              <Text style={[s.fleetStatValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.fleetStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <PairingPanel currentUser={currentUser} animals={animals} devices={devices} onPaired={loadDevices} />

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:     { color: '#DEC9AE', fontSize: 10, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:   { color: '#fff', fontSize: 24, fontFamily: FONTS.extrabold, marginTop: 2 },
  headerDesc:    { color: '#DEC9AE', fontSize: 11, marginTop: 2 },
  liveChip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  liveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8A9C68' },
  liveText:      { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold, letterSpacing: 1 },

  sectionLabel:  { fontSize: 9, fontFamily: FONTS.extrabold, color: '#968C82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },

  animalSelector:{ flexDirection: 'row', gap: 10, marginBottom: 12 },
  animalTab:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: '#E0D6C7', elevation: 2 },
  animalTabActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  animalDot:     { width: 8, height: 8, borderRadius: 4 },
  animalTabName: { fontSize: 14, fontFamily: FONTS.extrabold, color: '#29231E', marginBottom: 2 },
  animalTabSub:  { fontSize: 10, color: '#968C82', fontFamily: FONTS.semibold },

  collarCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 4, elevation: 2 },
  collarName:    { fontSize: 18, fontFamily: FONTS.extrabold, color: '#29231E' },
  collarSub:     { fontSize: 11, color: '#968C82', marginTop: 2 },

  vitalsRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  vitalCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderTopWidth: 4, elevation: 2, alignItems: 'center' },
  vitalValue:    { fontSize: 24, fontFamily: FONTS.extrabold, marginBottom: 2 },
  vitalLabel:    { fontSize: 10, color: '#968C82', fontFamily: FONTS.bold, textTransform: 'uppercase', marginBottom: 4 },
  vitalStatus:   { fontSize: 11, fontFamily: FONTS.extrabold, letterSpacing: 0.5 },
  vitalRef:      { fontSize: 9, color: '#CBBFAD', marginTop: 4 },

  activityCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 4, elevation: 2 },
  actLabel:      { fontSize: 10, fontFamily: FONTS.bold, color: '#968C82', textTransform: 'uppercase', marginBottom: 4 },
  actValue:      { fontSize: 16, fontFamily: FONTS.extrabold, color: '#29231E' },
  actBadge:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  actBadgeText:  { fontSize: 13, fontFamily: FONTS.extrabold },

  zoneCard:      { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4, elevation: 2 },
  zoneCardSafe:  { backgroundColor: '#F2F4EB', borderWidth: 1.5, borderColor: '#C9D2B4' },
  zoneCardAlert: { backgroundColor: '#FBEEEC', borderWidth: 1.5, borderColor: '#DA8279' },
  zoneStatus:    { fontSize: 12, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  zoneName:      { fontSize: 16, fontFamily: FONTS.extrabold, color: '#29231E', marginBottom: 4 },
  zoneCoord:     { fontSize: 11, color: '#7C7268', lineHeight: 16 },
  zoneIcon:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  trendCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 4, elevation: 2 },
  trendTitle:    { fontSize: 11, fontFamily: FONTS.bold, color: '#7C7268', marginBottom: 14 },
  trendBars:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  trendBarCol:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBarVal:   { fontSize: 9, fontFamily: FONTS.extrabold, marginBottom: 3 },
  trendBar:      { width: '100%', borderRadius: 4, minHeight: 10 },
  trendBarX:     { fontSize: 8, color: '#968C82', marginTop: 4, fontFamily: FONTS.semibold },

  alertCard:     { flexDirection: 'row', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 3, gap: 12, alignItems: 'flex-start' },
  alertCritical: { backgroundColor: '#FBEEEC', borderLeftColor: '#B5342C' },
  alertWarning:  { backgroundColor: '#FBF5E9', borderLeftColor: '#C99A4A' },
  alertDot:      { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  alertAnimal:   { fontSize: 12, fontFamily: FONTS.extrabold, color: '#29231E' },
  alertTime:     { fontSize: 10, fontFamily: FONTS.bold, color: '#968C82' },
  alertMsg:      { fontSize: 11, color: '#7C7268', marginTop: 2, lineHeight: 16 },

  noAlerts:      { backgroundColor: '#F2F4EB', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  noAlertsText:  { fontSize: 13, fontFamily: FONTS.bold, color: '#57633E' },

  fleetCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', elevation: 2 },
  fleetStat:     { alignItems: 'center' },
  fleetStatValue:{ fontSize: 22, fontFamily: FONTS.extrabold, marginBottom: 2 },
  fleetStatLabel:{ fontSize: 9, fontFamily: FONTS.bold, color: '#968C82', textTransform: 'uppercase', textAlign: 'center' },
});
