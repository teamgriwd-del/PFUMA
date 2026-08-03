import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { API, COLORS } from '../config';
import { authFetch, authJson } from '../api';

const SPECIES = ['Cattle','Goat'];
const todayStr = () => new Date().toISOString().slice(0, 10);

// A real uploaded photo is a relative /uploads/... path from the backend;
// the species stock fallback (or a picked-but-not-yet-uploaded local file)
// is already a usable URI as-is.
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

export default function HerdScreen({ currentUser }) {
  const [animals,    setAnimals]    = useState([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [form, setForm] = useState({ name:'', species:'Cattle', breed:'', tag_id:'', birth_date: todayStr(), current_weight:'' });
  const [photo, setPhoto] = useState(null); // { uri, name, type }
  const [saving, setSaving] = useState(false);
  const [listingAnimal, setListingAnimal] = useState(null); // animal being priced for listing
  const [priceInput, setPriceInput] = useState('');

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await authFetch(currentUser, '/animals');
      if (res.ok) setAnimals(await res.json());
    } catch { /* offline — leave whatever was last loaded, no fake fallback */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [currentUser?.token]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const filename = asset.uri.split('/').pop();
    const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
    setPhoto({ uri: asset.uri, name: filename, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('species', form.species);
    fd.append('breed', form.breed || '');
    fd.append('tag_id', form.tag_id || '');
    fd.append('birth_date', form.birth_date || '');
    fd.append('birth_weight', form.current_weight || '0');
    fd.append('current_weight', form.current_weight || '0');
    if (photo) fd.append('photo', photo);

    const res = await authFetch(currentUser, '/animals', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      Alert.alert('Could not register animal', data.error || 'Try again.');
      setSaving(false);
      return;
    }
    await load();
    setSaving(false); setShowAdd(false); setPhoto(null);
    setForm({ name:'', species:'Cattle', breed:'', tag_id:'', birth_date: todayStr(), current_weight:'' });
  };

  // Turning listing ON needs a price (same rule as the web app) — opens the
  // price modal below instead of toggling immediately. Turning it OFF
  // withdraws the listing right away, no price needed.
  const toggleSale = (animal) => {
    if (!animal.for_sale) { setListingAnimal(animal); setPriceInput(''); return; }
    submitSaleToggle(animal, null);
  };

  const submitSaleToggle = async (animal, price) => {
    const { ok, data } = await authJson(currentUser, `/animals/${animal.id}/sale`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(price ? { price } : {}),
    });
    if (!ok) { Alert.alert('Could not update listing', data.error || 'Try again.'); return; }
    setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, for_sale: data.for_sale } : a));
  };

  const confirmListing = async () => {
    const price = parseFloat(priceInput);
    if (!price || price <= 0) { Alert.alert('Enter a valid price to list this animal.'); return; }
    await submitSaleToggle(listingAnimal, price);
    setListingAnimal(null);
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
              <Image source={{ uri: resolveImageUrl(a.image_url) }} style={styles.cardImage} />
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
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Animal</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Text style={{ fontSize: 22 }}>📷</Text>
                </View>
              )}
              <Text style={styles.photoPickerText}>{photo ? 'Change photo' : 'Upload a photo (optional)'}</Text>
            </TouchableOpacity>

            {[
              { label: 'Animal Name *', key: 'name',            placeholder: 'e.g. Bessie' },
              { label: 'Breed',         key: 'breed',           placeholder: 'e.g. Brahman' },
              { label: 'Ear Tag ID',    key: 'tag_id',          placeholder: 'e.g. ZIM-001' },
              { label: 'Date of Birth', key: 'birth_date',      placeholder: 'YYYY-MM-DD' },
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

      {/* Listing price modal — turning "For Sale" on requires a price */}
      <Modal visible={!!listingAnimal} animationType="fade" transparent onRequestClose={() => setListingAnimal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List {listingAnimal?.name}</Text>
              <TouchableOpacity onPress={() => setListingAnimal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Asking Price (USD) *</Text>
              <TextInput
                style={styles.formInput} placeholder="e.g. 650" keyboardType="numeric" autoFocus
                value={priceInput} onChangeText={setPriceInput} placeholderTextColor="#bbb"
              />
            </View>
            <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 14 }}>
              Submitted for police sale clearance — visible on the Marketplace once cleared.
            </Text>
            <TouchableOpacity style={styles.submitBtn} onPress={confirmListing} activeOpacity={0.8}>
              <Text style={styles.submitText}>List For Sale</Text>
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
  photoPicker:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  photoPreview:   { width: 56, height: 56, borderRadius: 14, backgroundColor: '#f5f5f5' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  photoPickerText:{ fontSize: 13, fontWeight: '800', color: COLORS.primary },
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
