import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Search, ShieldAlert, Landmark, CheckCircle } from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function InstitutionScreen({ currentUser }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [flagBusy, setFlagBusy] = useState(false);
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLedger = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true);
    try {
      const res = await authFetch(currentUser, '/institution/certificates/mine');
      if (res.ok) setLedger(await res.json());
    } catch { /* offline */ }
    setLedgerLoading(false); setRefreshing(false);
  }, [currentUser?.token]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const lookup = async () => {
    if (!code.trim()) return;
    setLookupBusy(true); setLookupError(''); setResult(null);
    const { ok, data } = await authJson(currentUser, `/institution/certificates/${encodeURIComponent(code.trim())}`);
    setLookupBusy(false);
    if (!ok) { setLookupError(data.error || 'Could not find this certificate.'); return; }
    setResult(data);
    await loadLedger();
  };

  const flagCollateral = async () => {
    if (!result) return;
    setFlagBusy(true);
    const { ok } = await authJson(currentUser, `/institution/certificates/${encodeURIComponent(code.trim())}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    if (ok) { setResult(r => ({ ...r, flagged_by_me: true, already_pledged: true })); await loadLedger(); }
    setFlagBusy(false);
  };

  const flaggedCount = ledger.filter(l => l.flagged_as_collateral).length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.slate }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(currentUser?.org || currentUser?.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>{currentUser?.institutionType || 'Institution'}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{currentUser?.org || currentUser?.name || 'Institution'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.metricCard}>
            <Search size={14} color={COLORS.teal} />
            <Text style={styles.metricValue}>{ledger.length}</Text>
            <Text style={styles.metricLabel}>Checked</Text>
          </View>
          <View style={styles.metricCard}>
            <ShieldAlert size={14} color="#D5A85C" />
            <Text style={styles.metricValue}>{flaggedCount}</Text>
            <Text style={styles.metricLabel}>Flagged</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLedger(true)} tintColor="#fff" />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Look Up a Certificate</Text>
          <Text style={styles.cardDesc}>Enter the code from the certificate a farmer shared with you.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={styles.codeInput} placeholder="e.g. 51a18e001813" value={code} onChangeText={setCode}
              autoCapitalize="none" placeholderTextColor="rgba(247,243,237,0.3)"
            />
            <TouchableOpacity style={styles.verifyBtn} onPress={lookup} disabled={lookupBusy || !code.trim()} activeOpacity={0.8}>
              {lookupBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>
          </View>
          {lookupError ? <Text style={styles.errorText}>{lookupError}</Text> : null}

          {result && (
            <View style={styles.resultBox}>
              {result.already_pledged && (
                <View style={styles.pledgedWarn}>
                  <ShieldAlert size={13} color="#C75B50" />
                  <Text style={styles.pledgedWarnText}>Already flagged as held collateral{result.flagged_by_me ? ' by you' : ' by another institution'} — verify with the farmer.</Text>
                </View>
              )}
              {[
                ['Animal', result.name],
                ['Species / Breed', `${result.species}${result.breed ? ' — ' + result.breed : ''}`],
                ['Owner', result.owner_name],
                ['Certified Value', `USD ${Number(result.estimated_value).toLocaleString()}`],
              ].map(([label, value]) => (
                <View key={label} style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{label}</Text>
                  <Text style={styles.resultValue}>{value}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.flagBtn, result.flagged_by_me && { opacity: 0.6 }]}
                onPress={flagCollateral} disabled={flagBusy || result.flagged_by_me} activeOpacity={0.8}
              >
                {flagBusy ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    {result.flagged_by_me ? <CheckCircle size={13} color="#fff" /> : null}
                    <Text style={styles.flagBtnText}>{result.flagged_by_me ? 'Flagged as Held Collateral' : 'Flag as Held Collateral'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.ledgerHeading}>My Lookups</Text>
        {ledgerLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />
        ) : ledger.length === 0 ? (
          <View style={styles.emptyCard}>
            <Landmark size={22} color={COLORS.mutedDark} />
            <Text style={styles.emptyText}>No certificates checked yet</Text>
          </View>
        ) : ledger.map(l => (
          <View key={l.id} style={styles.ledgerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ledgerName}>{l.animal_name || l.name}</Text>
              <Text style={styles.ledgerSub}>{l.owner_name} · USD {Number(l.estimated_value || 0).toLocaleString()}</Text>
            </View>
            {l.flagged_as_collateral ? (
              <View style={styles.flaggedBadge}><Text style={styles.flaggedBadgeText}>Flagged</Text></View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.teal, padding: 24, paddingTop: 56, paddingBottom: 20 },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: '#fff', fontSize: 14, fontWeight: '900' },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 16, fontWeight: '900' },
  metricCard:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12 },
  metricValue:   { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 6 },
  metricLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },

  card:      { backgroundColor: COLORS.cardDark, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  cardTitle: { fontSize: 14, fontWeight: '900', color: COLORS.textDark, marginBottom: 4 },
  cardDesc:  { fontSize: 12, color: COLORS.mutedDark, marginBottom: 12, lineHeight: 17 },

  codeInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 1.5 },
  verifyBtn: { backgroundColor: COLORS.teal, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  errorText: { fontSize: 11, fontWeight: '800', color: '#C75B50', marginTop: 8 },

  resultBox:   { marginTop: 14, backgroundColor: 'rgba(63,112,107,0.12)', borderWidth: 1, borderColor: 'rgba(63,112,107,0.35)', borderRadius: 16, padding: 14 },
  pledgedWarn: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(154,42,35,0.2)', borderRadius: 12, padding: 10, marginBottom: 10 },
  pledgedWarnText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#DA8279' },
  resultRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  resultLabel: { fontSize: 11, fontWeight: '700', color: COLORS.mutedDark },
  resultValue: { fontSize: 12, fontWeight: '800', color: '#fff' },
  flagBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#554D45', borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  flagBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  ledgerHeading: { fontSize: 11, fontWeight: '800', color: COLORS.mutedDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  emptyCard: { alignItems: 'center', paddingVertical: 30, backgroundColor: COLORS.cardDark, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderDark },
  emptyText: { fontSize: 12, fontWeight: '700', color: COLORS.mutedDark, marginTop: 8 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardDark, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderDark },
  ledgerName:{ fontSize: 12, fontWeight: '800', color: '#fff' },
  ledgerSub: { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  flaggedBadge: { backgroundColor: 'rgba(213,168,92,0.18)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  flaggedBadgeText: { fontSize: 9, fontWeight: '900', color: '#D5A85C', textTransform: 'uppercase' },
});
