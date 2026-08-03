import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native';
import {
  Calculator, BookOpen, Scale, Clock, ShieldCheck,
  PlusCircle, Trash2, DollarSign, CheckCircle, AlertTriangle
} from 'lucide-react-native';
import { API, COLORS } from '../config';
import { authFetch, authJson } from '../api';

const DEMO_FEEDS = [
  { id:1, name:'Soya Bean Meal',    category:'protein',  protein_percent:45.0, energy_mj:13.5, fibre_percent:6.0,  calcium_percent:0.30, phosphorus_percent:0.65, description:'High protein supplement — ideal for growing cattle and dairy cows.',      suitable_for:'Cattle,Goat' },
  { id:2, name:'Maize Grain',       category:'energy',   protein_percent:8.5,  energy_mj:14.2, fibre_percent:2.5,  calcium_percent:0.03, phosphorus_percent:0.28, description:'Primary energy source in most livestock rations in Zimbabwe.',            suitable_for:'Cattle,Goat,Sheep,Pig' },
  { id:3, name:'Cotton Seed Cake',  category:'protein',  protein_percent:38.0, energy_mj:12.8, fibre_percent:12.0, calcium_percent:0.20, phosphorus_percent:0.90, description:'By-product of cotton oil extraction — good rumen buffer for cattle.',     suitable_for:'Cattle' },
  { id:4, name:'Sunflower Cake',    category:'protein',  protein_percent:32.0, energy_mj:11.0, fibre_percent:15.0, calcium_percent:0.35, phosphorus_percent:0.95, description:'Cost-effective protein source for maintenance rations.',                   suitable_for:'Cattle,Goat,Sheep' },
  { id:5, name:'Wheat Bran',        category:'roughage', protein_percent:15.5, energy_mj:11.5, fibre_percent:10.5, calcium_percent:0.12, phosphorus_percent:1.10, description:'Good phosphorus and digestible fibre for ruminants.',                       suitable_for:'Cattle,Goat,Sheep' },
  { id:6, name:'Dicalcium Phosphate',category:'mineral', protein_percent:0.0,  energy_mj:0.0,  fibre_percent:0.0,  calcium_percent:26.0, phosphorus_percent:18.5, description:'Mineral supplement to correct calcium/phosphorus deficiencies.',           suitable_for:'Cattle,Goat,Sheep,Pig' },
  { id:7, name:'Lucerne Hay',       category:'roughage', protein_percent:17.5, energy_mj:9.5,  fibre_percent:28.0, calcium_percent:1.50, phosphorus_percent:0.25, description:'High-protein roughage for dairy and young stock.',                          suitable_for:'Cattle,Goat,Sheep' },
  { id:8, name:'Commercial Grower', category:'mixed',    protein_percent:18.0, energy_mj:12.5, fibre_percent:7.0,  calcium_percent:0.90, phosphorus_percent:0.70, description:'Ready-mixed ration for growing cattle 6-18 months.',                        suitable_for:'Cattle' },
];

const CAT_COLOR = { protein:'#1565c0', energy:'#e65100', roughage:'#2e7d32', mineral:'#6a1b9a', mixed:'#555' };
const CAT_BG    = { protein:'#e3f2fd', energy:'#fff3e0', roughage:'#e8f5e9', mineral:'#f3e5f5', mixed:'#f5f5f5' };
const RATION_SPECIES = ['Cattle', 'Goat'];

const STATUS_STYLE = {
  deficient: { label: 'Deficient', color: '#c62828', bg: '#ffebee' },
  balanced:  { label: 'Balanced',  color: '#2e7d32', bg: '#e8f5e9' },
  excess:    { label: 'Excess',    color: '#e65100', bg: '#fff3e0' },
};

const statusOf = (total, target) => {
  if (!target) return 'balanced';
  const ratio = total / target;
  if (ratio < 0.9) return 'deficient';
  if (ratio > 1.15) return 'excess';
  return 'balanced';
};

// value = numeric, display = formatted string shown to user
const NutrientBar = ({ label, value, display, max, color }) => (
  <View style={{ marginBottom: 8 }}>
    <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: 4 }}>
      <Text style={styles.nutriLabel}>{label}</Text>
      <Text style={[styles.nutriVal, { color }]}>{display}</Text>
    </View>
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${Math.min(100, (parseFloat(value) / max) * 100)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

// ── RATION BUILDER ────────────────────────────────────────────
// Computes what THIS animal (real species/weight/age) needs today and
// prices the ration against live PFUMA Marketplace listings — the part
// that goes beyond "here's what's in maize".
function RationBuilder({ currentUser, feeds }) {
  const [animals, setAnimals]         = useState([]);
  const [animalId, setAnimalId]       = useState(null);
  const [requirement, setRequirement] = useState(null);
  const [reqLoading, setReqLoading]   = useState(false);
  const [rows, setRows]               = useState([]);
  const [saving, setSaving]           = useState(false);
  const [savedPlan, setSavedPlan]     = useState(null);
  const [error, setError]             = useState('');
  const [history, setHistory]         = useState([]);

  useEffect(() => {
    (async () => {
      const res = await authFetch(currentUser, '/animals');
      if (res.ok) setAnimals(await res.json());
    })();
  }, [currentUser?.token]);

  const eligibleAnimals = useMemo(
    () => animals.filter(a => RATION_SPECIES.includes(a.species)),
    [animals]
  );
  const selectedAnimal = eligibleAnimals.find(a => String(a.id) === String(animalId));

  const selectAnimal = async (id) => {
    setAnimalId(id);
    setRows([]);
    setSavedPlan(null);
    setError('');
    setReqLoading(true);
    try {
      const { ok, data } = await authJson(currentUser, `/feed/requirements?animal_id=${id}`);
      if (!ok) throw new Error(data.error || 'Could not compute requirement');
      setRequirement(data);
    } catch (e) {
      setRequirement(null);
      setError(e.message);
    } finally {
      setReqLoading(false);
    }
    try {
      const { ok, data } = await authJson(currentUser, `/feed/plans?animal_id=${id}`);
      if (ok) setHistory(data);
    } catch { /* history is a nice-to-have */ }
  };

  const addFeed = (feed) => {
    if (rows.some(r => r.feedId === feed.id)) return;
    setRows(prev => [...prev, { feedId: feed.id, qtyKg: '1' }]);
  };
  const updateQty = (feedId, qtyKg) => setRows(prev => prev.map(r => r.feedId === feedId ? { ...r, qtyKg } : r));
  const removeRow = (feedId) => setRows(prev => prev.filter(r => r.feedId !== feedId));

  const preview = useMemo(() => {
    let protein = 0, energy = 0, cost = 0, anyUnpriced = false;
    const lines = rows.map(r => {
      const feed = feeds.find(f => f.id === r.feedId);
      const qty = parseFloat(r.qtyKg) || 0;
      if (!feed || qty <= 0) return null;
      const p = qty * 1000 * (parseFloat(feed.protein_percent) / 100);
      const e = qty * parseFloat(feed.energy_mj);
      const unitPrice = feed.market_price ? parseFloat(feed.market_price.price) : null;
      const lineCost = unitPrice != null ? unitPrice * qty : 0;
      if (unitPrice == null) anyUnpriced = true;
      protein += p; energy += e; cost += lineCost;
      return { feed, qty, protein: p, energy: e, unitPrice, lineCost };
    }).filter(Boolean);
    return { lines, protein, energy, cost, anyUnpriced };
  }, [rows, feeds]);

  const proteinStatus = requirement ? statusOf(preview.protein, requirement.target_protein_g) : null;
  const energyStatus  = requirement ? statusOf(preview.energy, requirement.target_energy_mj) : null;

  const savePlan = async () => {
    if (!animalId || preview.lines.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const { ok, data } = await authJson(currentUser, '/feed/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animal_id: animalId,
          items: preview.lines.map(l => ({ feed_type_id: l.feed.id, qty_kg: l.qty })),
        }),
      });
      if (!ok) throw new Error(data.error || 'Could not save ration plan');
      setSavedPlan(data);
      setHistory(prev => [data, ...prev]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={styles.pitchBox}>
        <Calculator size={16} color={COLORS.primary} />
        <Text style={styles.pitchText}>
          You already know Maize is energy and Soya is protein. What this calculates is exactly how many grams of protein <Text style={{ fontWeight: '900' }}>this animal</Text>, at <Text style={{ fontWeight: '900' }}>this weight and age</Text>, needs today — and what that ration costs at real PFUMA supplier prices.
        </Text>
      </View>

      <Text style={styles.filterLabel}>Build a ration for</Text>
      {eligibleAnimals.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>Register a Cattle or Goat in the Herd tab first — the Ration Builder needs a real animal's weight.</Text>
        </View>
      ) : (
        <View style={styles.filterGrid}>
          {eligibleAnimals.map(a => {
            const active = String(animalId) === String(a.id);
            return (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.8}
                style={[styles.filterChip, { backgroundColor: active ? COLORS.primary : COLORS.light, borderColor: COLORS.primary }]}
                onPress={() => selectAnimal(a.id)}
              >
                <Text style={[styles.filterChipText, { color: active ? '#fff' : COLORS.primary }]}>
                  {a.name} · {a.current_weight || '?'}kg
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {reqLoading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />}

      {requirement && (
        <>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Scale size={14} color="#9ca3af" />
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statVal}>{requirement.weight_kg} kg</Text>
            </View>
            <View style={styles.statBox}>
              <Clock size={14} color="#9ca3af" />
              <Text style={styles.statLabel}>Life Stage</Text>
              <Text style={[styles.statVal, { textTransform: 'capitalize' }]}>{requirement.life_stage}</Text>
            </View>
            <View style={styles.statBox}>
              <ShieldCheck size={14} color="#9ca3af" />
              <Text style={styles.statLabel}>Daily Target</Text>
              <Text style={styles.statVal}>{requirement.target_protein_g}g CP</Text>
            </View>
          </View>

          <Text style={styles.filterLabel}>Add Feed</Text>
          <View style={styles.filterGrid}>
            {feeds.map(f => (
              <TouchableOpacity key={f.id} activeOpacity={0.8} style={styles.addFeedChip} onPress={() => addFeed(f)}>
                <PlusCircle size={12} color={COLORS.primary} />
                <Text style={styles.addFeedChipText}>{f.name}</Text>
                {f.market_price && <Text style={styles.addFeedChipPrice}>${Number(f.market_price.price).toFixed(2)}/{f.market_price.unit}</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {rows.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.filterLabel}>Today's Ration</Text>
              {rows.map(r => {
                const feed = feeds.find(f => f.id === r.feedId);
                if (!feed) return null;
                return (
                  <View key={r.feedId} style={styles.rationRow}>
                    <Text style={styles.rationRowName} numberOfLines={1}>{feed.name}</Text>
                    <TextInput
                      style={styles.rationQtyInput}
                      keyboardType="decimal-pad"
                      value={r.qtyKg}
                      onChangeText={v => updateQty(r.feedId, v)}
                      placeholder="kg/day"
                    />
                    {!feed.market_price && <AlertTriangle size={13} color="#f59e0b" style={{ marginHorizontal: 4 }} />}
                    <TouchableOpacity onPress={() => removeRow(r.feedId)}>
                      <Trash2 size={16} color="#d32f2f" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {preview.lines.length > 0 && (
                <>
                  <View style={styles.verdictRow}>
                    {[
                      { label: 'Protein', total: preview.protein, target: requirement.target_protein_g, unit: 'g', status: proteinStatus },
                      { label: 'Energy',  total: preview.energy,  target: requirement.target_energy_mj,  unit: 'MJ', status: energyStatus },
                    ].map(n => {
                      const s = STATUS_STYLE[n.status];
                      return (
                        <View key={n.label} style={[styles.verdictBox, { backgroundColor: s.bg }]}>
                          <Text style={[styles.verdictLabel, { color: s.color }]}>{n.label} — {s.label}</Text>
                          <Text style={styles.verdictVal}>{n.total.toFixed(1)}{n.unit} <Text style={{ color: '#9ca3af', fontWeight: '600' }}>/ {n.target}{n.unit}</Text></Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.costBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={15} color="#a5d6a7" />
                      <Text style={styles.costLabel}>Estimated Daily Cost</Text>
                    </View>
                    <Text style={styles.costVal}>USD {preview.cost.toFixed(2)}</Text>
                  </View>
                  {preview.anyUnpriced && (
                    <Text style={styles.warnText}>⚠ One or more feeds have no live PFUMA supplier listing — cost shown is partial.</Text>
                  )}

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={styles.saveBtn} onPress={savePlan} disabled={saving} activeOpacity={0.85}>
                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Ration Plan'}</Text>
                  </TouchableOpacity>

                  {savedPlan && (
                    <View style={styles.savedBox}>
                      <CheckCircle size={14} color="#2e7d32" />
                      <Text style={styles.savedText}>Saved — added USD {savedPlan.total_cost_usd.toFixed(2)} to {selectedAnimal?.name}'s cost-to-date.</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </>
      )}

      {history.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.filterLabel}>Past Ration Plans</Text>
          {history.map(p => {
            const s = STATUS_STYLE[p.protein_status];
            return (
              <View key={p.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{new Date(p.created_at).toLocaleDateString()} · {p.items.length} feeds</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={[styles.historyStatus, { color: s.color }]}>{s.label}</Text>
                  <Text style={styles.historyCost}>USD {Number(p.total_cost_usd).toFixed(2)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function FeedAnalyzerScreen({ currentUser }) {
  const [feeds,      setFeeds]      = useState(DEMO_FEEDS);
  const [expandedId, setExpandedId] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState('ration');

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API}/feed/prices`);
      if (res.ok) setFeeds(await res.json());
    } catch { /* demo */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const renderReferenceItem = ({ item }) => {
    const isOpen = expandedId === item.id;
    const speciesList = (item.suitable_for || '').split(',').filter(Boolean);
    const color = CAT_COLOR[item.category] || '#555';
    const bg    = CAT_BG[item.category]   || '#f5f5f5';
    return (
      <TouchableOpacity style={styles.card} onPress={() => setExpandedId(isOpen ? null : item.id)} activeOpacity={0.9}>
        <View style={styles.cardTop}>
          <View style={[styles.catIcon, { backgroundColor: bg }]}>
            <Text style={{ fontSize: 22 }}>{item.category === 'protein' ? '🥩' : item.category === 'energy' ? '⚡' : item.category === 'roughage' ? '🌿' : item.category === 'mineral' ? '🦴' : '🌾'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={[styles.catBadge, { backgroundColor: bg }]}>
                <Text style={[styles.catBadgeText, { color }]}>{item.category}</Text>
              </View>
              {item.market_price && (
                <View style={[styles.catBadge, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={[styles.catBadgeText, { color: '#2e7d32' }]}>${Number(item.market_price.price).toFixed(2)}/{item.market_price.unit} live</Text>
                </View>
              )}
            </View>
            <View style={styles.inlineStats}>
              <Text style={styles.inlineStat}>Protein <Text style={{ color: '#1565c0', fontWeight:'800' }}>{item.protein_percent}%</Text></Text>
              <Text style={styles.inlineStat}>Energy <Text style={{ color:'#e65100', fontWeight:'800' }}>{item.energy_mj}MJ</Text></Text>
              <Text style={styles.inlineStat}>Fibre <Text style={{ color:'#2e7d32', fontWeight:'800' }}>{item.fibre_percent}%</Text></Text>
            </View>
          </View>
          <Text style={{ fontSize: 16, color: COLORS.muted }}>{isOpen ? '▲' : '▼'}</Text>
        </View>

        {isOpen && (
          <View style={styles.expanded}>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            <Text style={styles.nutriTitle}>Nutritional Breakdown</Text>
            <NutrientBar label="Protein"    value={item.protein_percent}    display={`${item.protein_percent}%`}       max={50}  color="#1565c0" />
            <NutrientBar label="Energy"     value={item.energy_mj}          display={`${item.energy_mj} MJ/kg`}       max={16}  color="#e65100" />
            <NutrientBar label="Fibre"      value={item.fibre_percent}      display={`${item.fibre_percent}%`}        max={35}  color="#2e7d32" />
            <NutrientBar label="Calcium"    value={item.calcium_percent}    display={`${item.calcium_percent}%`}      max={30}  color="#6a1b9a" />
            <NutrientBar label="Phosphorus" value={item.phosphorus_percent} display={`${item.phosphorus_percent}%`}  max={20}  color="#c62828" />
            {speciesList.length > 0 && (
              <View style={styles.speciesRow}>
                <Text style={styles.speciesTitle}>Suitable for: </Text>
                {speciesList.map(s => (
                  <View key={s} style={styles.speciesChip}><Text style={styles.speciesChipText}>{s}</Text></View>
                ))}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Feed Analyzer</Text>
          <Text style={styles.headerDesc}>Not just what's in the bag — what your animal needs today</Text>
        </View>
      </View>

      <View style={styles.tabBar2}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ration' && styles.tabBtnActive]}
          onPress={() => setTab('ration')}
          activeOpacity={0.85}
        >
          <Calculator size={14} color={tab === 'ration' ? '#fff' : COLORS.muted} />
          <Text style={[styles.tabBtnText, tab === 'ration' && styles.tabBtnTextActive]}>Ration Builder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'reference' && styles.tabBtnActive]}
          onPress={() => setTab('reference')}
          activeOpacity={0.85}
        >
          <BookOpen size={14} color={tab === 'reference' ? '#fff' : COLORS.muted} />
          <Text style={[styles.tabBtnText, tab === 'reference' && styles.tabBtnTextActive]}>Reference</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} /> : null}

      {tab === 'ration' ? (
        currentUser?.token ? (
          <FlatList
            data={[{ key: 'ration-builder' }]}
            keyExtractor={i => i.key}
            renderItem={() => <RationBuilder currentUser={currentUser} feeds={feeds} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
          />
        ) : (
          <Text style={styles.emptyBoxText}>Log in to build a ration.</Text>
        )
      ) : (
        <FlatList
          data={feeds}
          keyExtractor={i => String(i.id)}
          renderItem={renderReferenceItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
          ListHeaderComponent={<Text style={styles.resultCount}>{feeds.length} feed types</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:     { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:   { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:    { color: '#a5d6a7', fontSize: 11, marginTop: 2, maxWidth: 220 },

  tabBar2:       { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4 },
  tabBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', elevation: 1 },
  tabBtnActive:  { backgroundColor: COLORS.primary },
  tabBtnText:    { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase' },
  tabBtnTextActive: { color: '#fff' },

  pitchBox:      { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, elevation: 1 },
  pitchText:     { flex: 1, fontSize: 12, color: COLORS.muted, lineHeight: 18, fontWeight: '600' },

  filterLabel:      { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  filterGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 2 },
  filterChipText:   { fontSize: 12, fontWeight: '800' },

  emptyBox:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed', padding: 16 },
  emptyBoxText:  { fontSize: 12, color: COLORS.muted, fontWeight: '600', textAlign: 'center' },

  statRow:       { flexDirection: 'row', gap: 8, marginVertical: 12 },
  statBox:       { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
  statLabel:     { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 },
  statVal:       { fontSize: 13, fontWeight: '900', color: COLORS.text, marginTop: 2 },

  addFeedChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, elevation: 1 },
  addFeedChipText:  { fontSize: 11, fontWeight: '700', color: COLORS.text },
  addFeedChipPrice: { fontSize: 10, fontWeight: '800', color: '#2e7d32' },

  rationRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 8, elevation: 1 },
  rationRowName:    { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  rationQtyInput:   { width: 64, backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, fontWeight: '700', marginRight: 8, textAlign: 'center' },

  verdictRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  verdictBox:    { flex: 1, borderRadius: 12, padding: 10 },
  verdictLabel:  { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  verdictVal:    { fontSize: 13, fontWeight: '900', color: COLORS.text },

  costBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1b1b1b', borderRadius: 12, padding: 14, marginTop: 12 },
  costLabel:     { fontSize: 11, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  costVal:       { fontSize: 16, fontWeight: '900', color: '#fff' },
  warnText:      { fontSize: 10, color: '#e65100', fontWeight: '700', marginTop: 8 },
  errorText:     { fontSize: 11, color: '#c62828', fontWeight: '700', backgroundColor: '#ffebee', borderRadius: 10, padding: 10, marginTop: 10 },

  saveBtn:       { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  saveBtnText:   { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  savedBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f5e9', borderRadius: 12, padding: 10, marginTop: 10 },
  savedText:     { flex: 1, fontSize: 11, fontWeight: '700', color: '#2e7d32' },

  historyRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, elevation: 1 },
  historyDate:   { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  historyStatus: { fontSize: 11, fontWeight: '800' },
  historyCost:   { fontSize: 11, fontWeight: '900', color: COLORS.text },

  resultCount:   { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  card:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardTop:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon:       { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  cardName:      { fontSize: 15, fontWeight: '900', color: COLORS.text, flex: 1 },
  catBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText:  { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  inlineStats:   { flexDirection: 'row', gap: 10 },
  inlineStat:    { fontSize: 11, color: COLORS.muted },
  expanded:      { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  desc:          { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginBottom: 12, backgroundColor: '#fffde7', padding: 10, borderRadius: 10 },
  nutriTitle:    { fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', marginBottom: 10 },
  nutriLabel:    { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  nutriVal:      { fontSize: 12, fontWeight: '900' },
  barBg:         { height: 6, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill:       { height: '100%', borderRadius: 4 },
  speciesRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  speciesTitle:  { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  speciesChip:   { backgroundColor: COLORS.light, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  speciesChipText:{ fontSize: 11, fontWeight: '700', color: COLORS.primary },
});
