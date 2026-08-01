import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView, Linking
} from 'react-native';
import { API, COLORS } from '../config';

const CATEGORIES = [
  { id: 'all',       label: 'All',      emoji: '🛒' },
  { id: 'livestock', label: 'Livestock',emoji: '🐄' },
  { id: 'feed',      label: 'Feed',     emoji: '🌾' },
  { id: 'produce',   label: 'Produce',  emoji: '🥦' },
  { id: 'medicine',  label: 'Medicine', emoji: '💊' },
  { id: 'equipment', label: 'Equipment',emoji: '🔧' },
];

const CAT_COLOR = {
  livestock: '#1b5e20', feed: '#e65100', produce: '#558b2f',
  medicine:  '#1565c0', equipment: '#6a1b9a', all: '#333',
};

const DEMO = [
  { id: 1, product_name: 'Thunder — Angus Bull', category: 'livestock', price: 770,  unit: 'head', quantity: 1,    location: 'Zvimba, Mashonaland West', seller_name: 'Arnold Mapindu', phone: '+263771000001', description: 'Healthy 1y 9m Angus bull. DVS certified health passport.' },
  { id: 2, product_name: 'Soya Bean Meal',       category: 'feed',      price: 450,  unit: 'kg',   quantity: 500,  location: 'Harare',                   seller_name: 'John Moyo',      phone: '+263772000002', description: 'High quality soya meal, 45% protein content.' },
  { id: 3, product_name: 'Maize Grain',           category: 'feed',      price: 320,  unit: 'kg',   quantity: 1000, location: 'Bulawayo',                 seller_name: 'Grace Ndlovu',   phone: '+263773000003', description: 'Fresh maize grain, harvested this season.' },
  { id: 4, product_name: 'Oxytetracycline (LA)',  category: 'medicine',  price: 25,   unit: 'ml',   quantity: 200,  location: 'Harare',                   seller_name: 'AgroChem Zim',   phone: '+263774000004', description: 'Long-acting antibiotic. DVS approved batch.' },
  { id: 5, product_name: 'Solar Water Pump',      category: 'equipment', price: 1200, unit: 'unit', quantity: 3,    location: 'Gweru',                    seller_name: 'ZimAgro Ltd',    phone: '+263775000005', description: 'Solar-powered borehole pump, 3000L/hr capacity.' },
];

const PostModal = ({ visible, onClose, onSubmit }) => {
  const [form, setForm] = useState({ product_name:'', category:'livestock', price:'', unit:'head', quantity:'1', location:'', description:'' });
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post a Listing</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Product Name *', key: 'product_name', ph: 'e.g. Brahman Bull, Soya Meal' },
              { label: 'Price (USD) *',  key: 'price',        ph: '0.00', kb: 'decimal-pad' },
              { label: 'Unit',           key: 'unit',         ph: 'head / kg / litre / unit' },
              { label: 'Quantity',       key: 'quantity',     ph: '1',    kb: 'numeric' },
              { label: 'Location',       key: 'location',     ph: 'e.g. Zvimba, Mashonaland West' },
              { label: 'Description',    key: 'description',  ph: 'Describe the item...', multi: true },
            ].map(f => (
              <View key={f.key} style={styles.formField}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput
                  style={[styles.formInput, f.multi && { height: 80, textAlignVertical: 'top' }]}
                  placeholder={f.ph} value={form[f.key]}
                  onChangeText={v => set(f.key, v)}
                  keyboardType={f.kb || 'default'}
                  multiline={!!f.multi}
                  placeholderTextColor="#bbb"
                />
              </View>
            ))}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <TouchableOpacity key={c.id} activeOpacity={0.8}
                    style={[styles.catChip, form.category === c.id && { backgroundColor: CAT_COLOR[c.id], borderColor: CAT_COLOR[c.id] }]}
                    onPress={() => set('category', c.id)}>
                    <Text style={[styles.catChipText, form.category === c.id && { color: '#fff' }]}>{c.emoji} {c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={() => { onSubmit(form); onClose(); }} activeOpacity={0.8}>
              <Text style={styles.submitText}>✓ Post Listing</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default function MarketplaceScreen() {
  const [listings,   setListings]   = useState(DEMO);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('all');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPost,   setShowPost]   = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const url = category === 'all' ? `${API}/listings` : `${API}/listings?category=${category}`;
      const res = await fetch(url);
      if (res.ok) setListings(await res.json());
    } catch { /* demo */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async (form) => {
    const payload = { ...form, user_id: 1, price: parseFloat(form.price), quantity: parseFloat(form.quantity) };
    try { await fetch(`${API}/listings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    catch { /* offline */ }
    setListings(prev => [{ id: Date.now(), ...payload, seller_name: 'You', status: 'available' }, ...prev]);
  };

  const filtered = listings.filter(l =>
    (category === 'all' || l.category === category) &&
    (l.product_name?.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()))
  );

  const renderItem = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: CAT_COLOR[item.category] || '#999', borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.catBadge}>{CATEGORIES.find(c=>c.id===item.category)?.emoji} {item.category}</Text>
          <Text style={styles.cardName}>{item.product_name}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={[styles.priceVal, { color: CAT_COLOR[item.category] }]}>
            ${Number(item.price).toLocaleString()}
          </Text>
          <Text style={styles.priceUnit}>/{item.unit}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>📦 {item.quantity} {item.unit}</Text>
        <Text style={styles.metaText}>📍 {item.location}</Text>
        <Text style={styles.metaText}>👤 {item.seller_name}</Text>
      </View>
      <View style={styles.cardActions}>
        {item.phone ? (
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.8}>
            <Text style={styles.callBtnText}>📞 Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.bidBtn, { backgroundColor: CAT_COLOR[item.category] || COLORS.primary }]} onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.8}>
          <Text style={styles.bidBtnText}>Enquire →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Agri Marketplace</Text>
          <Text style={styles.headerDesc}>Livestock · Feed · Medicine · Equipment</Text>
        </View>
        <TouchableOpacity style={styles.postBtn} onPress={() => setShowPost(true)} activeOpacity={0.8}>
          <Text style={styles.postBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search listings..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.id} activeOpacity={0.8}
            style={[styles.catTab, category === c.id && { backgroundColor: CAT_COLOR[c.id] || '#333' }]}
            onPress={() => setCategory(c.id)}>
            <Text style={[styles.catTabText, category === c.id && { color: '#fff' }]}>{c.emoji} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} /> : null}

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🛒</Text>
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptyDesc}>Be the first to post in this category.</Text>
          </View>
        }
      />

      <PostModal visible={showPost} onClose={() => setShowPost(false)} onSubmit={handlePost} />
    </View>
  );
}

const styles = StyleSheet.create({
  header:      { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:   { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:  { color: '#a5d6a7', fontSize: 11, marginTop: 2 },
  postBtn:     { backgroundColor: COLORS.yellow, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, elevation: 4 },
  postBtnText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, paddingHorizontal: 14, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  catScroll:   { flexGrow: 0 },
  catContent:  { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  catTab:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  catTabText:  { fontSize: 12, fontWeight: '700', color: COLORS.text },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 3 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  catBadge:    { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 4 },
  cardName:    { fontSize: 16, fontWeight: '900', color: COLORS.text, maxWidth: 200 },
  priceBox:    { alignItems: 'flex-end' },
  priceVal:    { fontSize: 18, fontWeight: '900' },
  priceUnit:   { fontSize: 10, color: COLORS.muted },
  cardDesc:    { fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 18 },
  cardMeta:    { gap: 4, marginBottom: 12 },
  metaText:    { fontSize: 12, color: COLORS.muted },
  cardActions: { flexDirection: 'row', gap: 10 },
  callBtn:     { flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  bidBtn:      { flex: 2, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bidBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  emptyState:  { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptyDesc:   { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:  { fontSize: 20, fontWeight: '900', color: COLORS.text },
  modalClose:  { fontSize: 20, color: COLORS.muted },
  formField:   { marginBottom: 14 },
  formLabel:   { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 6 },
  formInput:   { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text },
  catRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0' },
  catChipText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  submitBtn:   { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  submitText:  { color: '#fff', fontWeight: '900', fontSize: 15 },
});
