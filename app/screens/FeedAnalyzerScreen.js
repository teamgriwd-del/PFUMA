import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import { API, COLORS } from '../config';

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

const SPECIES = [
  { key: 'All',    label: 'All Animals', color: '#1b5e20', bg: '#e8f5e9' },
  { key: 'Cattle', label: 'Cattle',      color: '#795548', bg: '#efebe9' },
  { key: 'Goat',   label: 'Goat',        color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'Sheep',  label: 'Sheep',       color: '#1565c0', bg: '#e3f2fd' },
  { key: 'Pig',    label: 'Pig',         color: '#c62828', bg: '#ffebee' },
];

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

export default function FeedAnalyzerScreen() {
  const [feeds,      setFeeds]      = useState(DEMO_FEEDS);
  const [search,     setSearch]     = useState('');
  const [species,    setSpecies]    = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API}/feed`);
      if (res.ok) setFeeds(await res.json());
    } catch { /* demo */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = feeds.filter(f => {
    const matchSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase());
    const matchSpecies = species === 'All' || (f.suitable_for || '').includes(species);
    return matchSearch && matchSpecies;
  });

  const activeSpecies = SPECIES.find(s => s.key === species) || SPECIES[0];

  const renderItem = ({ item }) => {
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Feed Analyzer</Text>
          <Text style={styles.headerDesc}>Zimbabwe livestock nutrition database · {feeds.length} feeds</Text>
        </View>
      </View>

      {/* Info strip */}
      <View style={styles.infoStrip}>
        <Text style={styles.infoText}>Tap any feed to see the full nutritional breakdown. Use this to plan a balanced diet for your herd.</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search feeds (e.g. Maize, Soya)..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
      </View>

      {/* Species filter — always fully visible, colour-coded per animal */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by Animal</Text>
        <View style={styles.filterGrid}>
          {SPECIES.map(s => {
            const active = species === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                activeOpacity={0.8}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? s.color : s.bg, borderColor: s.color },
                ]}
                onPress={() => setSpecies(s.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? '#fff' : s.color }]}>
                  {s.label}
                </Text>
                {active && <View style={styles.filterActiveDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} /> : null}

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <Text style={styles.resultCount}>{filtered.length} feed type{filtered.length !== 1 ? 's' : ''}{species !== 'All' ? ` for ${activeSpecies.label}` : ''}</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🌾</Text>
            <Text style={styles.emptyTitle}>No feeds match</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:     { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:   { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:    { color: '#a5d6a7', fontSize: 11, marginTop: 2 },
  infoStrip:     { backgroundColor: COLORS.light, padding: 12, margin: 16, marginBottom: 0, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  infoText:      { fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 18 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, paddingHorizontal: 14, elevation: 2 },
  searchInput:   { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  filterSection:    { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterLabel:      { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  filterGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, borderWidth: 2 },
  filterChipText:   { fontSize: 12, fontWeight: '800' },
  filterActiveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
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
  emptyState:    { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 10 },
});
