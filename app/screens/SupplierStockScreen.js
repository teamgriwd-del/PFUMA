import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Package, AlertTriangle, Plus, Store, ArrowRight } from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

const STOCK_CATEGORIES = ['medicine', 'equipment', 'feed'];
const LOW_STOCK_THRESHOLD = 10;

const STATUS_LABEL = {
  available: 'Available', withdrawn: 'Out of Stock', sold: 'Sold', pending_clearance: 'Pending',
};
const STATUS_COLOR = {
  available: { bg: COLORS.sproutBg, text: '#465032' },
  withdrawn: { bg: '#F6D9D5', text: '#9A2A23' },
  sold:      { bg: COLORS.border, text: COLORS.muted },
  pending_clearance: { bg: '#F6E9CF', text: '#8C632A' },
};

function RestockRow({ listing, currentUser, onRestocked }) {
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lowStock = listing.status === 'available' && Number(listing.quantity) <= LOW_STOCK_THRESHOLD;
  const outOfStock = listing.status === 'withdrawn';
  const sc = STATUS_COLOR[listing.status] || STATUS_COLOR.sold;

  const submit = async () => {
    const qty = Number(adding);
    if (!qty || qty <= 0) return;
    setBusy(true); setError('');
    const { ok, data } = await authJson(currentUser, `/listings/${listing.id}/restock`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add_quantity: qty }),
    });
    setBusy(false);
    if (!ok) { setError(data.error || 'Could not restock.'); return; }
    setAdding('');
    await onRestocked();
  };

  return (
    <View style={[styles.stockCard, outOfStock && styles.stockCardDanger, lowStock && !outOfStock && styles.stockCardWarn]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.stockName} numberOfLines={1}>{listing.product_name}</Text>
          <Text style={styles.stockCategory}>{listing.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}><Text style={[styles.statusBadgeText, { color: sc.text }]}>{STATUS_LABEL[listing.status] || listing.status}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {outOfStock ? (
          <View style={styles.rowGap}><AlertTriangle size={12} color="#9A2A23" /><Text style={styles.outOfStockText}>Out of stock</Text></View>
        ) : (
          <Text style={[styles.qtyText, lowStock && { color: '#8C632A' }]}>{Number(listing.quantity).toLocaleString()} {listing.unit} left</Text>
        )}
        {lowStock && !outOfStock && <View style={styles.rowGap}><AlertTriangle size={10} color="#8C632A" /><Text style={styles.lowStockText}>Low stock</Text></View>}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={styles.restockInput} placeholder="Add quantity" keyboardType="numeric" value={adding} onChangeText={setAdding} placeholderTextColor="#bbb" />
        <TouchableOpacity style={styles.restockBtn} onPress={submit} disabled={busy || !adding} activeOpacity={0.8}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Plus size={12} color="#fff" />
              <Text style={styles.restockBtnText}>Restock</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function SupplierStockScreen({ currentUser, navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await authFetch(currentUser, '/listings/mine');
      if (res.ok) {
        const data = await res.json();
        setListings(data.filter(l => STOCK_CATEGORIES.includes(l.category) && l.status !== 'sold'));
      }
    } catch { /* offline */ }
    setLoading(false); setRefreshing(false);
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...listings].sort((a, b) => Number(a.quantity) - Number(b.quantity));
  const outOfStockCount = listings.filter(l => l.status === 'withdrawn').length;
  const lowStockCount = listings.filter(l => l.status === 'available' && Number(l.quantity) <= LOW_STOCK_THRESHOLD).length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Package size={16} color="#F6E9CF" />
          <Text style={styles.headerEyebrow}>Supply Chain</Text>
        </View>
        <Text style={styles.headerTitle}>Your Stock Levels</Text>
        <TouchableOpacity style={styles.postBtn} onPress={() => navigation?.navigate('Market')} activeOpacity={0.8}>
          <Store size={13} color={COLORS.gold} />
          <Text style={styles.postBtnText}>Post New Product</Text>
          <ArrowRight size={12} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.gold} />}
      >
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{listings.length}</Text><Text style={styles.statLabel}>Active</Text></View>
          <View style={[styles.stat, lowStockCount > 0 && styles.statWarn]}><Text style={[styles.statValue, lowStockCount > 0 && { color: '#8C632A' }]}>{lowStockCount}</Text><Text style={styles.statLabel}>Low Stock</Text></View>
          <View style={[styles.stat, outOfStockCount > 0 && styles.statDanger]}><Text style={[styles.statValue, outOfStockCount > 0 && { color: '#9A2A23' }]}>{outOfStockCount}</Text><Text style={styles.statLabel}>Out</Text></View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} />
        ) : sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Package size={30} color={COLORS.border} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No products posted yet</Text>
            <Text style={styles.emptyDesc}>Post medicine, equipment or feed on the Marketplace to start selling</Text>
          </View>
        ) : sorted.map(l => <RestockRow key={l.id} listing={l} currentUser={currentUser} onRestocked={load} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.gold, padding: 24, paddingTop: 56, paddingBottom: 20 },
  headerEyebrow: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  postBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  postBtnText:   { fontSize: 11, fontWeight: '800', color: COLORS.gold, textTransform: 'uppercase' },

  statRow:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  statWarn: { backgroundColor: '#F6E9CF' },
  statDanger: { backgroundColor: '#F6D9D5' },
  statValue:{ fontSize: 22, fontWeight: '900', color: COLORS.text },
  statLabel:{ fontSize: 9, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyTitle:{ fontSize: 13, fontWeight: '800', color: COLORS.muted, marginTop: 10, textAlign: 'center' },
  emptyDesc: { fontSize: 11, color: COLORS.muted, marginTop: 4, textAlign: 'center' },

  stockCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: COLORS.border },
  stockCardWarn:   { backgroundColor: '#F6E9CF', borderColor: '#EDD5A6' },
  stockCardDanger: { backgroundColor: '#F6D9D5', borderColor: '#EAB0A9' },
  stockName:  { fontSize: 13, fontWeight: '800', color: COLORS.text },
  stockCategory: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

  rowGap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  outOfStockText: { fontSize: 11, fontWeight: '800', color: '#9A2A23' },
  lowStockText:   { fontSize: 10, fontWeight: '800', color: '#8C632A', textTransform: 'uppercase' },

  restockInput: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, fontSize: 12, color: COLORS.text },
  restockBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#3B342D', borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  restockBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  errorText: { fontSize: 10, fontWeight: '700', color: '#9A2A23', marginTop: 6 },
});
