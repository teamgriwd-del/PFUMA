import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Activity, Thermometer, Heart, MapPin, AlertTriangle, CheckCircle,
  ShieldCheck, Zap, Signal, Gauge, Eye, RefreshCw, Info, Tag,
  Wifi, WifiOff, ChevronDown, TrendingUp, TrendingDown, Minus, Link2, Plus,
  RadioTower,
} from 'lucide-react';
import './HardwareSimulation.css';
import { API } from '../../config';

// ── Constants ──────────────────────────────────────────────────────────────
// Fallback zone shown only until the real geofence loads (or for a farmer
// who hasn't drawn one yet) — mirrors the backend's DEFAULT_GEOFENCE.
const FALLBACK_ZONE = { name: 'Demo Safe Zone', center_lat: -17.8216, center_lon: 31.0233, radius_m: 500 };
const MAX_HISTORY = 20;
const BATTERY_DRAIN_RATE = 0.02;
// Geofence circle is drawn at 80px from center in the UI (see the w-44
// boundary ring below) — everything geo-related converts lat/lon degrees
// to real-world meters, then meters to that fixed pixel radius, so the
// dot's on-screen distance from center always matches its real distance
// from the zone boundary, whatever the zone's actual radius_m is.
const METERS_PER_DEG_LAT = 110540;
const metersPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const metersOffset = (lat, lon, zone) => {
  const dx = (lon - zone.center_lon) * metersPerDegLon(zone.center_lat);
  const dy = (lat - zone.center_lat) * METERS_PER_DEG_LAT;
  return { dx, dy, distance: Math.sqrt(dx * dx + dy * dy) };
};
const ZONE_RING_PX = 80;
const MAX_OFFSET_PX = 130;
const metersToPixels = (dx, dy, zone) => {
  const scale = ZONE_RING_PX / zone.radius_m;
  let x = dx * scale;
  let y = -dy * scale; // screen y grows downward — flip so north is up
  const mag = Math.sqrt(x * x + y * y);
  if (mag > MAX_OFFSET_PX) { const f = MAX_OFFSET_PX / mag; x *= f; y *= f; }
  return { x, y };
};

const NORMAL_RANGES = {
  temperature: { min: 37.5, max: 39.5, unit: '°C', label: 'Normal 37.5 – 39.5 °C' },
  heartRate:   { min: 48,   max: 95,   unit: 'BPM', label: 'Normal 48 – 95 BPM' }
};

const PADDOCKS = [
  { name: 'North Paddock',  pct: 85, icon: '🌿', tip: 'Heavy grazing — consider rotation' },
  { name: 'Water Point',    pct: 60, icon: '💧', tip: 'Regular visits, water supply ok' },
  { name: 'Shade Area',     pct: 95, icon: '🌳', tip: 'Preferred rest zone in heat' },
  { name: 'East Fence',     pct: 20, icon: '🚧', tip: 'Low activity — check access' },
  { name: 'Gate A',         pct: 40, icon: '🔑', tip: 'Normal transit activity' }
];

const calculateMovingAverage = (buffer, newValue, limit = 3) => {
  const next = [...buffer, newValue];
  if (next.length > limit) next.shift();
  return { buffer: next, avg: next.reduce((a, b) => a + b, 0) / next.length };
};

// ── Sub-components ──────────────────────────────────────────────────────────
const StatusBadge = ({ score }) => {
  if (score > 85) return <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest"><ShieldCheck size={11} /> Healthy</span>;
  if (score > 60) return <span className="flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest"><AlertTriangle size={11} /> Caution</span>;
  return <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse"><AlertTriangle size={11} /> Critical</span>;
};

const RangeBar = ({ value, min, max, alert }) => {
  const pct = Math.max(0, Math.min(100, ((value - (min - 2)) / ((max + 2) - (min - 2))) * 100));
  const lowPct  = ((min - (min - 2)) / ((max + 2) - (min - 2))) * 100;
  const highPct = ((max - (min - 2)) / ((max + 2) - (min - 2))) * 100;
  return (
    <div className="mt-3">
      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        {/* normal zone highlight */}
        <div className="absolute h-full bg-green-100 rounded-full" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
        {/* value marker */}
        <div className={`absolute w-3 h-3 rounded-full -top-0.5 border-2 border-white shadow transition-all duration-700 ${alert ? 'bg-red-500' : 'bg-pfuma-green'}`} style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
    </div>
  );
};

const VitalCard = ({ icon: Icon, label, value, unit, range, alert, trend, description }) => (
  <div className={`bg-white p-5 rounded-2xl border-2 transition ${alert ? 'border-red-200 shadow-md shadow-red-50' : 'border-gray-100 hover:border-pfuma-green/30'}`}>
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${alert ? 'bg-red-50 text-red-500' : 'bg-green-50 text-pfuma-green'}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
        <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      {alert
        ? <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase">Out of range</span>
        : <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase">Normal</span>
      }
    </div>
    <div className="flex items-baseline gap-1.5 mt-3">
      <strong className={`text-3xl font-black ${alert ? 'text-red-500' : 'text-gray-900'}`}>{value}</strong>
      <span className="text-sm font-bold text-gray-400">{unit}</span>
      {trend === 'up'   && <TrendingUp size={14} className="text-orange-500 ml-1" />}
      {trend === 'down' && <TrendingDown size={14} className="text-blue-400 ml-1" />}
      {trend === 'flat' && <Minus size={14} className="text-gray-400 ml-1" />}
    </div>
    {range && <RangeBar value={value} min={range.min} max={range.max} alert={alert} />}
    <p className="text-[10px] text-gray-400 font-medium mt-2">{range ? range.label : description}</p>
  </div>
);

// ── Device pairing panel ──────────────────────────────────────────────────
const DEVICE_TYPES = [
  { id: 'base_station', label: 'Base Station', icon: RadioTower, hint: 'One per farm — the fixed box near your router that receives LoRa data from your collars.', placeholder: 'e.g. BS-01-HNO' },
  { id: 'collar',       label: 'Collar',       icon: Tag,        hint: 'One per animal — worn on the animal, radios to your base station.', placeholder: 'e.g. CN-014ZVI' },
];

const DevicePairingPanel = ({ animals, currentUser }) => {
  const [devices, setDevices]   = useState([]);
  const [deviceType, setDeviceType] = useState('base_station');
  const [serial, setSerial]     = useState('');
  const [animalId, setAnimalId] = useState('');
  const [busy, setBusy]         = useState(false);
  const [feedback, setFeedback] = useState(null);

  const authHeaders = { Authorization: `Bearer ${currentUser?.token}` };

  const loadDevices = useCallback(async () => {
    if (!currentUser?.token) return;
    try {
      const res = await fetch(`${API}/iot-devices`, { headers: authHeaders });
      if (res.ok) setDevices(await res.json());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch { /* offline — leave list as-is */ }
  }, [currentUser?.token]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const pairDevice = async (e) => {
    e.preventDefault();
    if (!serial.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/iot-devices/pair`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_serial: serial.trim(),
          device_type: deviceType,
          animal_id: deviceType === 'collar' ? (animalId || null) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback(data.error || 'Could not pair — try again.'); }
      else { setFeedback(`${DEVICE_TYPES.find(t => t.id === deviceType).label} paired.`); setSerial(''); setAnimalId(''); loadDevices(); }
    } catch {
      setFeedback('Offline — could not reach the PFUMA API to pair this device.');
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  if (currentUser?.role !== 'Farmer') return null;

  const activeType = DEVICE_TYPES.find(t => t.id === deviceType);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={15} className="text-pfuma-green" />
        <h4 className="text-sm font-black text-gray-800">Paired Devices</h4>
      </div>
      <p className="text-[11px] text-gray-400 font-medium mb-4">Claim a physical collar or base station by the serial number printed on it — see the "Connecting Your Physical Hardware" section of the IoT guide.</p>

      {devices.length === 0 ? (
        <p className="text-xs text-gray-400 font-medium italic mb-4">No devices paired yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {devices.map(dv => {
            const TypeIcon = dv.device_type === 'base_station' ? RadioTower : Tag;
            return (
              <div key={dv.id} className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <TypeIcon size={13} className="text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-gray-800 truncate">{dv.device_serial}</p>
                  <p className="text-[10px] text-gray-400 font-medium truncate">
                    {dv.device_type === 'base_station' ? 'Base Station' : (dv.animal_name ? `Collar · attached to ${dv.animal_name}` : 'Collar · not attached to an animal yet')}
                  </p>
                </div>
                <ShieldCheck size={13} className="text-pfuma-green shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {feedback && <div className="mb-3 text-[11px] font-bold text-pfuma-green bg-green-50 border border-green-200 rounded-xl p-2.5">{feedback}</div>}

      <div className="flex gap-2 mb-3">
        {DEVICE_TYPES.map(t => (
          <button key={t.id} type="button" onClick={() => { setDeviceType(t.id); setAnimalId(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition ${
              deviceType === t.id ? 'bg-pfuma-green text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 font-medium mb-3 leading-relaxed">{activeType.hint}</p>

      <form onSubmit={pairDevice} className="space-y-2.5">
        <input
          type="text" placeholder={`Device serial (${activeType.placeholder})`}
          className="w-full p-2.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-semibold"
          value={serial} onChange={e => setSerial(e.target.value)}
        />
        {deviceType === 'collar' && (
          <select
            className="w-full p-2.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none text-xs font-semibold appearance-none"
            value={animalId} onChange={e => setAnimalId(e.target.value)}
          >
            <option value="">Attach to an animal later</option>
            {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
          </select>
        )}
        <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 bg-pfuma-green text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50">
          <Plus size={13} /> {busy ? 'Pairing…' : `Pair ${activeType.label}`}
        </button>
      </form>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const HardwareSimulation = ({ animals = [], currentUser }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState(animals[0]?.id ?? null);

  // `animals` is fetched async by the parent and can still be empty on this
  // component's first mount — pick a default once it arrives instead of
  // leaving selectedAnimalId permanently null (which starved every
  // animal-scoped fetch below, including the geofence lookup).
  useEffect(() => {
    if (!selectedAnimalId && animals.length > 0) setSelectedAnimalId(animals[0].id);
  }, [animals, selectedAnimalId]);
  const [history, setHistory] = useState([]);
  const [currentData, setCurrentData] = useState({
    temperature: 38.5, heartRate: 72, activity: 'Normal',
    lat: FALLBACK_ZONE.center_lat, lon: FALLBACK_ZONE.center_lon,
    status: 'Optimal', vitalityScore: 98,
    battery: 88, isBreach: false
  });
  const [zone, setZone] = useState(FALLBACK_ZONE);
  const [alerts, setAlerts] = useState([]);
  const [isRunning, setIsRunning] = useState(true);
  const [trackerOffset, setTrackerOffset] = useState({ x: 0, y: 0 });
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const tempBuffer = useRef([38.5]);
  const hrBuffer   = useRef([72]);
  const batteryRef = useRef(88);
  const prevTemp   = useRef(38.5);
  const prevHR     = useRef(72);

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId) ?? animals[0] ?? null;

  // ── Geofence — the real per-farmer safe zone (drawn by the farmer, or by
  // an admin for a show demo). Falls back to FALLBACK_ZONE until it loads.
  useEffect(() => {
    if (!selectedAnimalId || !currentUser?.token) { setZone(FALLBACK_ZONE); return; }
    (async () => {
      try {
        const res = await fetch(`${API}/animals/${selectedAnimalId}/geofence`, {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
        if (!res.ok) { setZone(FALLBACK_ZONE); return; }
        const z = await res.json();
        setZone({ name: z.name, center_lat: z.center_lat, center_lon: z.center_lon, radius_m: z.radius_m });
      } catch { setZone(FALLBACK_ZONE); }
    })();
  }, [selectedAnimalId, currentUser?.token]);

  // ── Real device readings — takes over from the simulator whenever the
  // selected animal has a paired collar that has reported in the last 2
  // report intervals (~20s). Otherwise this stays empty and the existing
  // Math.random() simulator below drives the display, clearly labelled as such.
  const [liveReadings, setLiveReadings] = useState([]);
  const LIVE_FRESHNESS_MS = 20000;

  const readingToPoint = useCallback((r, prev) => {
    const temp = parseFloat(r.temp_c);
    const hr = r.heart_rate;
    let vitality = 100;
    if (r.fever_alert) vitality -= 25;
    if (r.theft_alert) vitality -= 30;
    if (!r.in_zone) vitality -= 15;
    vitality = Math.max(0, Math.min(100, vitality));
    return {
      time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temperature: temp, heartRate: hr, activity: r.activity || 'Unknown',
      lat: parseFloat(r.latitude).toFixed(4), lon: parseFloat(r.longitude).toFixed(4),
      status: vitality > 85 ? 'Optimal' : vitality > 60 ? 'Caution' : 'Critical',
      vitalityScore: vitality, battery: r.battery_pct, isBreach: !r.in_zone,
      tempTrend: prev ? (temp > parseFloat(prev.temp_c) + 0.2 ? 'up' : temp < parseFloat(prev.temp_c) - 0.2 ? 'down' : 'flat') : 'flat',
      hrTrend:   prev ? (hr   > prev.heart_rate + 3 ? 'up' : hr < prev.heart_rate - 3 ? 'down' : 'flat') : 'flat',
      rssi: r.rssi, isLive: true,
    };
  }, []);

  const fetchLiveReadings = useCallback(async () => {
    if (!selectedAnimalId || !currentUser?.token) { setLiveReadings([]); return; }
    try {
      const res = await fetch(`${API}/animals/${selectedAnimalId}/iot-readings?limit=${MAX_HISTORY}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (!res.ok) { setLiveReadings([]); return; }
      const rows = await res.json();
      const fresh = rows.length > 0 && (Date.now() - new Date(rows[0].received_at).getTime()) < LIVE_FRESHNESS_MS;
      setLiveReadings(fresh ? rows : []);
    } catch { setLiveReadings([]); }
  }, [selectedAnimalId, currentUser?.token]);

  useEffect(() => {
    fetchLiveReadings();
    const id = setInterval(fetchLiveReadings, 8000);
    return () => clearInterval(id);
  }, [fetchLiveReadings]);

  const isLiveDevice = liveReadings.length > 0;

  useEffect(() => {
    if (!isLiveDevice) return;
    const chrono = [...liveReadings].reverse();
    const points = chrono.map((r, i) => readingToPoint(r, i > 0 ? chrono[i - 1] : null));
    setHistory(points.slice(-MAX_HISTORY));
    const latest = points[points.length - 1];
    setCurrentData(latest);
    const { dx, dy } = metersOffset(parseFloat(latest.lat), parseFloat(latest.lon), zone);
    setTrackerOffset(metersToPixels(dx, dy, zone));
  }, [liveReadings, isLiveDevice, readingToPoint, zone]);

  const generateTick = useCallback(() => {
    const rawTemp = 37.8 + Math.random() * 2.5;
    const rawHR   = 65  + Math.random() * 40;

    const { buffer: tBuf, avg: filteredTemp } = calculateMovingAverage(tempBuffer.current, rawTemp);
    const { buffer: hBuf, avg: rawAvgHR }     = calculateMovingAverage(hrBuffer.current, rawHR);
    const filteredHR = Math.round(rawAvgHR);
    tempBuffer.current = tBuf;
    hrBuffer.current   = hBuf;

    const jitterM  = zone.radius_m * 1.3;
    const dxM      = (Math.random() - 0.5) * 2 * jitterM;
    const dyM      = (Math.random() - 0.5) * 2 * jitterM;
    const latDrift = zone.center_lat + dyM / METERS_PER_DEG_LAT;
    const lonDrift = zone.center_lon + dxM / metersPerDegLon(zone.center_lat);
    const dist     = Math.sqrt(dxM * dxM + dyM * dyM);
    const isBreach = dist > zone.radius_m;
    const { x: offsetX, y: offsetY } = metersToPixels(dxM, dyM, zone);

    let vitality = 100;
    if (filteredTemp > 39.5) vitality -= 25;
    if (filteredHR   > 95)   vitality -= 20;
    if (isBreach)             vitality -= 30;
    vitality = Math.max(0, Math.min(100, vitality));

    batteryRef.current = Math.max(0, batteryRef.current - BATTERY_DRAIN_RATE);

    const tempTrend = filteredTemp > prevTemp.current + 0.2 ? 'up' : filteredTemp < prevTemp.current - 0.2 ? 'down' : 'flat';
    const hrTrend   = filteredHR   > prevHR.current   + 3   ? 'up' : filteredHR   < prevHR.current   - 3   ? 'down' : 'flat';
    prevTemp.current = filteredTemp;
    prevHR.current   = filteredHR;

    const tick = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newData = {
      time: tick,
      temperature: parseFloat(filteredTemp.toFixed(1)),
      heartRate: filteredHR,
      activity: filteredHR > 95 ? 'Elevated' : filteredHR < 70 ? 'Resting' : 'Normal',
      lat: latDrift.toFixed(4), lon: lonDrift.toFixed(4),
      status: vitality > 85 ? 'Optimal' : vitality > 60 ? 'Caution' : 'Critical',
      vitalityScore: vitality,
      battery: parseFloat(batteryRef.current.toFixed(1)),
      isBreach, tempTrend, hrTrend
    };

    const newAlerts = [];
    if (filteredTemp > 40.2) newAlerts.push({
      id: Date.now(), type: 'Health',
      msg: `Fever detected — ${filteredTemp.toFixed(1)}°C`,
      action: 'Check animal immediately. Provide shade and water. Call your vet if above 41°C.'
    });
    if (isBreach) newAlerts.push({
      id: Date.now() + 1, type: 'Security',
      msg: `${selectedAnimal?.name ?? 'Animal'} left the safe zone`,
      action: 'Check fencing along East boundary. GPS coordinates logged for review.'
    });

    return { newData, newAlerts, offsetX, offsetY };
  }, [selectedAnimal, zone]);

  useEffect(() => {
    if (!isRunning || isLiveDevice) return;  // real device data takes priority over the simulator
    const id = setInterval(() => {
      const { newData, newAlerts, offsetX, offsetY } = generateTick();
      setCurrentData(newData);
      setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), newData]);
      setTrackerOffset({ x: offsetX, y: offsetY });
      if (newAlerts.length > 0) setAlerts(prev => [...newAlerts, ...prev].slice(0, 8));
    }, 5000);
    return () => clearInterval(id);
  }, [isRunning, isLiveDevice, generateTick]);

  const tempAlert = currentData.temperature > NORMAL_RANGES.temperature.max || currentData.temperature < NORMAL_RANGES.temperature.min;
  const hrAlert   = currentData.heartRate   > NORMAL_RANGES.heartRate.max   || currentData.heartRate   < NORMAL_RANGES.heartRate.min;
  const batteryColor = currentData.battery > 50 ? 'bg-green-500' : currentData.battery > 20 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="p-6 bg-gray-50 h-full overflow-y-auto space-y-6 text-left">

      {/* ── PURPOSE BANNER ── */}
      <div className="bg-gray-900 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #1b5e20 0%, transparent 60%)' }} />
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-yellow-400" />
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">PFUMA Smart Ear Tag System</span>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight mb-1">Live Animal Health Monitor</h2>
          <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
            Each animal in your herd wears a solar-powered ear tag that continuously measures body temperature, heart rate, movement, and GPS location. This dashboard shows you real-time data from those tags so you can spot health problems before they become emergencies.
          </p>
        </div>
        <div className="relative z-10 flex flex-col items-start md:items-end gap-3 shrink-0">
          {/* System status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
              isLiveDevice ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : isRunning ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}>
              {isLiveDevice ? <Wifi size={12} /> : isRunning ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isLiveDevice ? 'Live · Physical Collar' : isRunning ? 'Demo Simulation' : 'Paused'}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/10 uppercase tracking-widest">
              <Signal size={12} className="text-blue-400" />
              {isLiveDevice ? `RSSI: ${currentData.rssi ?? '—'} dBm` : 'Signal: Simulated'}
            </div>
          </div>
          {/* Battery */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
              <Tag size={10} /> Tag Battery
            </div>
            <div className="w-20 h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
              <div className={`h-full rounded-full transition-all duration-1000 ${batteryColor}`} style={{ width: `${currentData.battery}%` }} />
            </div>
            <span className={`text-xs font-black ${currentData.battery < 20 ? 'text-red-400' : 'text-gray-300'}`}>{currentData.battery.toFixed(0)}%</span>
          </div>
          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(p => !p)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${isRunning ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-pfuma-green text-white hover:bg-green-600'}`}
              aria-label={isRunning ? 'Pause monitoring' : 'Resume monitoring'}
            >
              <RefreshCw size={12} className={isRunning ? 'animate-spin' : ''} />
              {isRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={() => setShowHowItWorks(p => !p)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white/5 text-gray-400 hover:bg-white/10 transition border border-white/10"
            >
              <Info size={12} /> How it works
            </button>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── collapsible */}
      {showHowItWorks && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { step: '1', title: 'Ear Tag Sensor', desc: 'A small solar-powered tag clipped to the animal\'s ear measures temperature, heart rate, and movement every 5 seconds.', icon: Tag },
            { step: '2', title: 'Mesh Network', desc: 'Tags broadcast data over a low-power wireless mesh. Even remote paddocks stay connected through relay nodes on fence posts.', icon: Signal },
            { step: '3', title: 'AI Filtering', desc: 'Raw readings are smoothed using a 3-point moving average to remove noise before being displayed here.', icon: Gauge },
            { step: '4', title: 'Alerts & Action', desc: 'When a reading leaves the normal range or the animal exits the safe zone, you get an instant alert with a recommended action.', icon: AlertTriangle },
          ].map(s => (
            <div key={s.step} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-pfuma-green rounded-full flex items-center justify-center text-white text-[10px] font-black">{s.step}</div>
                <s.icon size={14} className="text-pfuma-green" />
                <span className="text-xs font-black text-gray-700">{s.title}</span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── ANIMAL SELECTOR ── */}
      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest shrink-0">
          <Tag size={14} className="text-pfuma-green" /> Monitoring Tag For:
        </div>
        {animals.length === 0 ? (
          <span className="text-sm text-gray-400 font-medium italic">No animals registered — add animals in Herd Registry first.</span>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {animals.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAnimalId(a.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition ${
                  selectedAnimalId === a.id
                    ? 'bg-pfuma-green text-white border-pfuma-green shadow-md'
                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-pfuma-green'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                {a.name}
                <span className="opacity-60">· {a.species}</span>
              </button>
            ))}
          </div>
        )}
        {selectedAnimal && (
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge score={currentData.vitalityScore} />
          </div>
        )}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT 2/3 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Vital cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                Live Health Readings {selectedAnimal && <span className="text-pfuma-green">— {selectedAnimal.name}</span>}
              </h3>
              <span className="text-[10px] text-gray-400 font-medium">Updates every 5 sec · 3-point filtered</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <VitalCard
                icon={Thermometer}
                label="Body Temperature"
                value={currentData.temperature}
                unit="°C"
                range={NORMAL_RANGES.temperature}
                alert={tempAlert}
                trend={currentData.tempTrend}
              />
              <VitalCard
                icon={Heart}
                label="Heart Rate"
                value={currentData.heartRate}
                unit="BPM"
                range={NORMAL_RANGES.heartRate}
                alert={hrAlert}
                trend={currentData.hrTrend}
              />
              <VitalCard
                icon={Activity}
                label="Activity Level"
                value={currentData.activity}
                alert={currentData.activity === 'Elevated' && hrAlert}
                description={
                  currentData.activity === 'Resting' ? 'Animal is calm or lying down' :
                  currentData.activity === 'Elevated' ? 'High movement detected — check for stress or predators' :
                  'Normal walking and grazing behaviour'
                }
              />
            </div>
          </div>

          {/* Vitality score */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-1">
              <div>
                <h4 className="text-sm font-black text-gray-800">Overall Vitality Score</h4>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Combined health index calculated from temperature, heart rate, and location safety</p>
              </div>
              <strong className={`text-3xl font-black ${currentData.vitalityScore > 85 ? 'text-pfuma-green' : currentData.vitalityScore > 60 ? 'text-orange-500' : 'text-red-500'}`}>
                {currentData.vitalityScore}%
              </strong>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mt-3 shadow-inner" role="progressbar" aria-valuenow={currentData.vitalityScore} aria-valuemin={0} aria-valuemax={100} aria-label="Vitality score">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${currentData.vitalityScore > 85 ? 'bg-pfuma-green' : currentData.vitalityScore > 60 ? 'bg-orange-400' : 'bg-red-500'}`}
                style={{ width: `${currentData.vitalityScore}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-black text-gray-300 uppercase mt-1.5 px-0.5">
              <span>0 – Critical</span><span>60 – Caution</span><span>85 – Optimal</span>
            </div>
          </div>

          {/* Trend chart */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-sm font-black text-gray-800">Vital Trends Over Time</h4>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Rolling history of the last {MAX_HISTORY} readings — helps you spot gradual changes</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-gray-400 shrink-0">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-pfuma-green rounded inline-block" />Temp (°C)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-blue-400 rounded inline-block" />Heart Rate (BPM)</span>
              </div>
            </div>
            {history.length < 2 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-3 text-gray-300">
                <RefreshCw size={24} className="animate-spin opacity-50" />
                <span className="text-sm font-medium">Collecting first readings — updates every 5 seconds...</span>
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="gTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1b5e20" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1b5e20" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gHR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="time" fontSize={9} stroke="#ddd" tick={{ fill: '#bbb' }} tickLine={false} />
                    <YAxis fontSize={9} stroke="#ddd" tick={{ fill: '#bbb' }} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11, fontWeight: 700 }} />
                    <Area type="monotone" dataKey="temperature" stroke="#1b5e20" fill="url(#gTemp)" strokeWidth={2.5} dot={false} name="Temp (°C)" />
                    <Area type="monotone" dataKey="heartRate"   stroke="#3b82f6" fill="url(#gHR)"  strokeWidth={2}   dot={false} name="Heart Rate (BPM)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 1/3 */}
        <div className="col-span-1 space-y-5">

          <DevicePairingPanel animals={animals} currentUser={currentUser} />

          {/* Live Tracking & Geofencing */}
          <div className="bg-gray-900 rounded-2xl p-5 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                  <MapPin size={13} className="text-pfuma-green" /> Live Tracking &amp; Geofencing
                </h4>
                <div className={`w-2.5 h-2.5 rounded-full mt-1 ${currentData.isBreach ? 'bg-red-500 animate-ping' : 'bg-green-400 animate-pulse'}`} aria-label={currentData.isBreach ? 'Outside safe zone' : 'Inside safe zone'} />
              </div>
              <p className="text-[11px] text-gray-500 font-medium mb-4">
                The dashed circle is your farm's geofence boundary — <strong className="text-gray-300">{zone.name}</strong>, {zone.radius_m}m radius. The green dot is your animal's live GPS position; the faint trail behind it is where it's been. It turns red and alerts you the moment it steps outside the circle.
              </p>

              <div className="flex justify-center mb-5">
                <div className="w-44 h-44 rounded-full border-2 border-dashed border-pfuma-green/30 flex items-center justify-center relative bg-pfuma-green/5">
                  {/* inner ring */}
                  <div className="absolute inset-6 rounded-full border border-pfuma-green/10" />
                  {/* compass */}
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-500">N</span>
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-500">S</span>
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-500">W</span>
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-500">E</span>
                  {/* zone label */}
                  <span className="absolute top-6 text-[8px] font-black text-gray-600 uppercase tracking-widest max-w-[70%] text-center truncate">{zone.name}</span>
                  {/* breadcrumb trail */}
                  {history.slice(-6, -1).map((h, i) => {
                    const { dx, dy } = metersOffset(parseFloat(h.lat), parseFloat(h.lon), zone);
                    const { x, y } = metersToPixels(dx, dy, zone);
                    return (
                      <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-pfuma-green/25"
                        style={{ transform: `translate(${x}px, ${y}px)`, opacity: 0.25 + i * 0.1 }} />
                    );
                  })}
                  {/* animal dot */}
                  <div
                    className={`w-4 h-4 rounded-full shadow-lg transition-all duration-1000 flex items-center justify-center ${currentData.isBreach ? 'bg-red-500' : 'bg-pfuma-green'}`}
                    style={{ transform: `translate(${trackerOffset.x}px, ${trackerOffset.y}px)` }}
                    role="img"
                    aria-label={`${selectedAnimal?.name ?? 'Animal'}: ${currentData.isBreach ? 'outside safe zone' : 'inside safe zone'}`}
                  >
                    {selectedAnimal && <span className="text-[6px] font-black text-white">{selectedAnimal.name[0]}</span>}
                  </div>
                  <span className="absolute bottom-[-20px] text-[8px] font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Boundary: {zone.radius_m}m radius</span>
                </div>
              </div>

              {currentData.isBreach ? (
                <div className="bg-red-500/20 border border-red-500/30 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-red-400 font-black uppercase leading-none mb-0.5">Animal Outside Safe Zone</p>
                    <p className="text-[10px] text-red-300 font-medium">Check fencing near {zone.name}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <p className="text-[10px] text-green-400 font-black uppercase">{selectedAnimal?.name ?? 'Animal'} Within Safe Zone</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Latitude</span>
                  <strong className="text-white text-[11px] font-black">{currentData.lat}</strong>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Longitude</span>
                  <strong className="text-white text-[11px] font-black">{currentData.lon}</strong>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl col-span-2">
                  <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Distance From Zone Center</span>
                  <strong className={`text-[11px] font-black ${currentData.isBreach ? 'text-red-400' : 'text-white'}`}>
                    {Math.round(metersOffset(parseFloat(currentData.lat), parseFloat(currentData.lon), zone).distance)}m
                    <span className="text-gray-500 font-medium"> of {zone.radius_m}m allowed</span>
                  </strong>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pfuma-green/5 rounded-full" aria-hidden="true" />
          </div>

          {/* Paddock usage */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h4 className="text-sm font-black text-gray-800 mb-1">Today's Paddock Usage</h4>
            <p className="text-[11px] text-gray-400 font-medium mb-4">Where your herd has spent time today, based on GPS cluster data. Helps you plan rotational grazing.</p>
            <div className="space-y-3.5">
              {PADDOCKS.map(p => (
                <div key={p.name} title={p.tip}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1">{p.icon} {p.name}</span>
                    <span className={`text-[10px] font-black ${p.pct > 80 ? 'text-orange-500' : 'text-gray-500'}`}>{p.pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${p.pct > 80 ? 'bg-orange-400' : p.pct > 50 ? 'bg-pfuma-green' : 'bg-blue-300'}`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  {p.pct > 80 && <p className="text-[9px] text-orange-500 font-medium mt-0.5">{p.tip}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-black text-gray-800">Alerts & Actions</h4>
              {alerts.length > 0 && (
                <button onClick={() => setAlerts([])} className="text-[9px] font-black text-gray-300 hover:text-red-500 transition uppercase">Clear</button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 font-medium mb-3">Events triggered when a reading leaves the normal range.</p>
            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-300 py-3">
                  <CheckCircle size={16} />
                  <span className="text-xs font-medium">All readings normal — no alerts</span>
                </div>
              ) : alerts.map(a => (
                <div
                  key={a.id}
                  className={`p-3.5 rounded-xl border-l-4 ${a.type === 'Security' ? 'bg-red-50 border-red-500' : 'bg-orange-50 border-orange-400'}`}
                  role="alert"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={12} className={a.type === 'Security' ? 'text-red-500' : 'text-orange-500'} />
                    <strong className={`text-[10px] font-black uppercase tracking-wide ${a.type === 'Security' ? 'text-red-700' : 'text-orange-700'}`}>{a.type} Alert</strong>
                  </div>
                  <p className="text-[11px] font-bold text-gray-700 leading-snug mb-1">{a.msg}</p>
                  <p className="text-[10px] font-medium text-gray-500 leading-snug italic">{a.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HardwareSimulation;
