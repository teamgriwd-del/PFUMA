import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { BookOpen, TrendingUp, Users, ArrowRight, Store } from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch } from '../api';

// Shared by Supplier and Buyer, mirroring the web component — the shape of
// /trading-journal/mine differs slightly per role (Supplier trades by
// quantity, Buyer by value), rendered accordingly rather than assumed.
export default function TradingJournalScreen({ currentUser, navigation }) {
  const [totals, setTotals] = useState(null);
  const [counterparties, setCounterparties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isSupplier = currentUser?.role === 'Supplier';

  const load = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await authFetch(currentUser, '/trading-journal/mine');
      if (res.ok) {
        const data = await res.json();
        setTotals(data.totals);
        setCounterparties(data.top_counterparties || []);
      }
    } catch { /* offline */ }
    setLoading(false); setRefreshing(false);
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const counterpartyLabel = isSupplier ? 'Farmers you supply' : 'Sellers you buy from';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <BookOpen size={16} color="#DEC9AE" />
          <Text style={styles.headerEyebrow}>Trading Journal</Text>
        </View>
        <Text style={styles.headerTitle}>Your Trading History</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation?.navigate('Market')} activeOpacity={0.8}>
          <Store size={13} color={COLORS.primary} />
          <Text style={styles.actionBtnText}>{isSupplier ? 'List New Stock' : 'Browse Marketplace'}</Text>
          <ArrowRight size={12} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.statLabel}>Total Trades</Text>
                  <TrendingUp size={15} color={COLORS.primary} />
                </View>
                <Text style={styles.statValue}>{totals?.total_trades ?? 0}</Text>
                <Text style={styles.statSub}>{isSupplier ? 'Orders fulfilled' : 'Purchases completed'}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.statLabel}>{isSupplier ? 'Qty Supplied' : 'Value Traded'}</Text>
                  <TrendingUp size={15} color={COLORS.gold} />
                </View>
                <Text style={styles.statValue}>{isSupplier ? Number(totals?.total_quantity ?? 0).toLocaleString() : `$${Number(totals?.total_value ?? 0).toLocaleString()}`}</Text>
                <Text style={styles.statSub}>Across every trade</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Users size={15} color={COLORS.primary} />
                <Text style={styles.cardTitle}>{counterpartyLabel}</Text>
              </View>
              <Text style={styles.cardDesc}>Top trading partners, ranked by {isSupplier ? 'order count' : 'value traded'}</Text>
              {counterparties.length === 0 ? (
                <View style={styles.emptyInner}>
                  <BookOpen size={26} color={COLORS.border} />
                  <Text style={styles.emptyText}>No completed trades yet</Text>
                </View>
              ) : counterparties.map((cp, i) => (
                <View key={cp.counterparty_id} style={styles.cpRow}>
                  <View style={styles.cpRank}><Text style={styles.cpRankText}>#{i + 1}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cpName} numberOfLines={1}>{cp.counterparty_name}</Text>
                    <Text style={styles.cpSub}>{cp.trade_count} trade{cp.trade_count !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.cpValue}>{isSupplier ? `${Number(cp.total_quantity).toLocaleString()} units` : `$${Number(cp.total_value).toLocaleString()}`}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, paddingBottom: 20 },
  headerEyebrow: { color: '#DEC9AE', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  actionBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },

  statRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  statLabel:{ fontSize: 9, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase' },
  statValue:{ fontSize: 24, fontWeight: '900', color: COLORS.text, marginTop: 6 },
  statSub:  { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  cardDesc:  { fontSize: 12, color: COLORS.muted, marginBottom: 12 },

  emptyInner: { alignItems: 'center', paddingVertical: 24 },
  emptyText:  { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginTop: 8 },

  cpRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bg, borderRadius: 14, padding: 12, marginBottom: 8 },
  cpRank:  { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cpRankText: { fontSize: 11, fontWeight: '900', color: COLORS.primary },
  cpName:  { fontSize: 12, fontWeight: '800', color: COLORS.text },
  cpSub:   { fontSize: 10, color: COLORS.muted, marginTop: 1 },
  cpValue: { fontSize: 13, fontWeight: '900', color: COLORS.primary },
});
