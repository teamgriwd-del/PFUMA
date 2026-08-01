import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Image, Modal
} from 'react-native';
import { API, COLORS } from '../config';

const DEMO_ANIMALS = [
  { id: 101, name: 'Bessie',  species: 'Cattle', breed: 'Brahman', current_weight: 420, tag_id: 'ZIM-882', for_sale: false, image_url: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400' },
  { id: 102, name: 'Thunder', species: 'Cattle', breed: 'Angus',   current_weight: 380, tag_id: 'ZIM-104', for_sale: true,  image_url: 'https://images.unsplash.com/photo-1596733430284-f7437764b1a9?w=400' },
];

const SPECIES = ['Cattle','Goat','Sheep','Pig'];

export default function HerdScreen() {
  const [animals,    setAnimals]    = useState(DEMO_ANIMALS);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [form, setForm] = useState({ name:'', species:'Cattle', breed:'', tag_id:'', current_weight:'' });
  const [saving, setSaving] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API}/animals?owner_id=1`);
      if (res.ok) setAnimals(await res.json());
    } catch { /* use demo */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, owner_id: 1, birth_weight: form.current_weight };
    try {
      const res = await fetch(`${API}/animals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { await load(); }
      else { setAnimals(prev => [{ ...form, id: Date.now(), for_sale: false }, ...prev]); }
    } catch { setAnimals(prev => [{ ...form, id: Date.now(), for_sale: false }, ...prev]); }
    finally { setSaving(false); setShowAdd(false); setForm({ name:'', species:'Cattle', breed:'', tag_id:'', current_weight:'' }); }
  };

  const toggleSale = async (animal) => {
    try { await fetch(`${API}/animals/${animal.id}/sale`, { method: 'PATCH' }); }
    catch { /* offline */ }
    setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, for_sale: !a.for_sale } : a));
  };

  const filtered = animals.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.breed?.toLowerCase().includes(search.toLowerCase()) ||
    a.species?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Herd Registry</Text>
          <Text style={styles.headerDesc}>{animals.length} animal{animals.length !== 1 ? 's' : ''} registered</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search animals..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🐄</Text>
            <Text style={styles.emptyTitle}>No animals yet</Text>
            <Text style={styles.emptyDesc}>Tap "+ Add" to register your first animal.</Text>
          </View>
        ) : filtered.map(a => (
          <View key={a.id} style={styles.card}>
            {a.image_url ? (
              <Image source={{ uri: a.image_url }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: COLORS.light, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 36 }}>🐄</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <View style={styles.tagBadge}><Text style={styles.tagText}>#{a.tag_id || 'NO TAG'}</Text></View>
                <Text style={styles.speciesBadge}>{a.species}</Text>
              </View>
              <Text style={styles.cardName}>{a.name}</Text>
              <Text style={styles.cardSub}>{a.breed} · {a.current_weight}kg</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.saleBtn, a.for_sale && styles.saleBtnActive]}
                  onPress={() => toggleSale(a)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saleBtnText, a.for_sale && styles.saleBtnTextActive]}>
                    {a.for_sale ? 'Listed for Sale' : 'List for Sale'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.passportBtn}>
                  <Text style={styles.passportText}>Passport</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Animal Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Animal</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            {[
              { label: 'Animal Name *', key: 'name',            placeholder: 'e.g. Bessie' },
              { label: 'Breed',         key: 'breed',           placeholder: 'e.g. Brahman' },
              { label: 'Ear Tag ID',    key: 'tag_id',          placeholder: 'e.g. ZIM-001' },
              { label: 'Weight (kg)',   key: 'current_weight',  placeholder: 'e.g. 35', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.key} style={styles.formField}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType={f.keyboard || 'default'}
                  placeholderTextColor="#bbb"
                />
              </View>
            ))}

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Species</Text>
              <View style={styles.speciesRow}>
                {SPECIES.map(s => (
                  <TouchableOpacity
                    key={s} activeOpacity={0.8}
                    style={[styles.speciesChip, form.species === s && styles.speciesChipActive]}
                    onPress={() => setForm(p => ({ ...p, species: s }))}
                  >
                    <Text style={[styles.speciesChipText, form.species === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>✓ Register Animal</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:         { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:      { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:    { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:     { color: '#a5d6a7', fontSize: 12, fontWeight: '600', marginTop: 2 },
  addBtn:         { backgroundColor: COLORS.yellow, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, elevation: 4 },
  addBtnText:     { color: COLORS.primary, fontWeight: '900', fontSize: 14 },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, borderRadius: 14, paddingHorizontal: 14, elevation: 2 },
  searchIcon:     { fontSize: 16, marginRight: 8 },
  searchInput:    { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  card:           { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, overflow: 'hidden', elevation: 3 },
  cardImage:      { width: '100%', height: 160 },
  cardBody:       { padding: 16 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tagBadge:       { backgroundColor: COLORS.light, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:        { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  speciesBadge:   { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardName:       { fontSize: 20, fontWeight: '900', color: COLORS.text },
  cardSub:        { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 12 },
  cardActions:    { flexDirection: 'row', gap: 10 },
  saleBtn:        { flex: 1, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  saleBtnActive:  { backgroundColor: '#fbc02d', borderColor: '#fbc02d' },
  saleBtnText:    { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  saleBtnTextActive: { color: COLORS.primary },
  passportBtn:    { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center' },
  passportText:   { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  emptyState:     { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:     { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptyDesc:      { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 20, fontWeight: '900', color: COLORS.text },
  modalClose:     { fontSize: 20, color: COLORS.muted },
  formField:      { marginBottom: 14 },
  formLabel:      { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formInput:      { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text },
  speciesRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  speciesChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#f9f9f9' },
  speciesChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  speciesChipText:{ fontSize: 12, fontWeight: '700', color: COLORS.muted },
  submitBtn:      { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10, elevation: 4 },
  submitText:     { color: '#fff', fontWeight: '900', fontSize: 15 },
});
