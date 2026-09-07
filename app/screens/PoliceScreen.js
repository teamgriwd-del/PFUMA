import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ShieldCheck, CheckCircle, Eye, Tag, Repeat, Camera, X,
} from 'lucide-react-native';
import { COLORS, FONTS, API } from '../config';
import { authFetch, authJson, assetToFormFile } from '../api';

const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

function VerificationCard({ v, busy, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{v.full_name}</Text>
          <Text style={styles.cardSub}>{v.role} · {v.org_name || 'No org'} · {v.province}</Text>
        </View>
        <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pending</Text></View>
      </View>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }} onPress={() => setExpanded(p => !p)} activeOpacity={0.8}>
        <Eye size={12} color={COLORS.muted} />
        <Text style={styles.detailToggle}>{expanded ? 'Hide' : 'View'} full details</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.detailBox}>
          <Text style={styles.detailRow}>Phone: {v.phone || '—'}</Text>
          <Text style={styles.detailRow}>National ID: {v.national_id_number || '—'}</Text>
          <Text style={styles.detailRow}>District: {v.district || '—'}</Text>
          {v.license_number ? <Text style={styles.detailRow}>License: {v.license_number}</Text> : null}
          {v.business_reg ? <Text style={styles.detailRow}>Business Reg: {v.business_reg}</Text> : null}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={styles.verifyBtn} onPress={() => onResolve(v.id, 'verified')} disabled={busy === v.id} activeOpacity={0.8}>
          {busy === v.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.verifyBtnText}>Verify</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => onResolve(v.id, 'rejected')} disabled={busy === v.id} activeOpacity={0.8}>
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ClearanceCard({ c, currentUser, busy, onResolve }) {
  const [registerNo, setRegisterNo] = useState('');
  const [permitNumber, setPermitNumber] = useState(c.movement_permit_number || '');
  const [certified, setCertified] = useState(false);
  const [signatureAsset, setSignatureAsset] = useState(null);
  const [picking, setPicking] = useState(false);

  const pickSignature = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access to attach your signature.'); return; }
    setPicking(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    setPicking(false);
    if (result.canceled || !result.assets?.[0]) return;
    setSignatureAsset(result.assets[0]);
  };

  const canClear = c.leader_clearance && certified && signatureAsset;

  const submitClear = () => {
    if (!canClear) return;
    onResolve(c, 'cleared', { registerNo, permitNumber, certified, signatureAsset });
  };

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {c.animal_image_url ? (
          <Image source={{ uri: resolveImageUrl(c.animal_image_url) }} style={styles.clearanceImg} />
        ) : (
          <View style={[styles.clearanceImg, { backgroundColor: COLORS.light, alignItems: 'center', justifyContent: 'center' }]}>
            <Tag size={18} color={COLORS.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{c.product_name || c.animal_name}</Text>
          <Text style={styles.cardSub}>Seller: {c.seller_name} · {c.species || 'Livestock'}</Text>
        </View>
        <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pending</Text></View>
      </View>

      {c.leader_clearance === 'attested' ? (
        <View style={styles.leaderBoxOk}>
          <Text style={styles.leaderTitleOk}>Cleared by {c.leader_type || 'traditional authority'}</Text>
          <Text style={styles.leaderDetail}>{c.leader_name}{c.leader_village ? ` · ${c.leader_village}` : ''}</Text>
        </View>
      ) : c.leader_clearance === 'not_applicable' ? (
        <View style={styles.leaderBoxNeutral}>
          <Text style={styles.leaderTitleNeutral}>No traditional authority</Text>
          <Text style={styles.leaderDetail}>{c.leader_na_reason}</Text>
        </View>
      ) : (
        <View style={styles.leaderBoxWarn}>
          <Text style={styles.leaderTitleWarn}>No Sabuku/Mambo clearance on record — ask the seller to record it first.</Text>
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.formCardLabel}>Form 392 — Part A/B/C</Text>
        <Text style={styles.formCardText}>Seller Nat. ID: {c.seller_national_id || '—'} · Register: {c.livestock_register_no || '—'}</Text>
        <Text style={styles.formCardText}>Buyer: {c.buyer_name || 'not yet arranged'}{c.buyer_destination ? ` → ${c.buyer_destination}` : ''}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
        {[['Seller', c.seller_signature_path], ['Vet Officer', c.vet_officer_signature_path], ['Buyer', c.buyer_signature_path]].map(([label, path]) => (
          <View key={label} style={[styles.signBadge, path ? styles.signBadgeOk : styles.signBadgeOff]}>
            <Text style={[styles.signBadgeText, { color: path ? '#465032' : COLORS.muted }]}>{label} {path ? 'signed' : 'not signed'}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <TextInput style={styles.formInput} placeholder="Clearance Register No." value={registerNo} onChangeText={setRegisterNo} placeholderTextColor="#bbb" />
        <TextInput style={styles.formInput} placeholder="Vet/DVS Permit No. (if any)" value={permitNumber} onChangeText={setPermitNumber} placeholderTextColor="#bbb" />
        <TouchableOpacity style={styles.certifyRow} onPress={() => setCertified(p => !p)} activeOpacity={0.8}>
          <View style={[styles.checkbox, certified && styles.checkboxChecked]}>{certified ? <CheckCircle size={13} color="#fff" /> : null}</View>
          <Text style={styles.certifyText}>I certify that at the time of clearance the livestock had not been reported stolen.</Text>
        </TouchableOpacity>

        <Text style={styles.formCardLabel}>Your Signature</Text>
        {signatureAsset ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={{ uri: signatureAsset.uri }} style={styles.signaturePreview} />
            <TouchableOpacity onPress={() => setSignatureAsset(null)}><Text style={styles.removeSignature}>Remove</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.signatureBtn} onPress={pickSignature} disabled={picking} activeOpacity={0.8}>
            {picking ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
              <>
                <Camera size={15} color={COLORS.primary} />
                <Text style={styles.signatureBtnText}>Attach signature photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[styles.verifyBtn, !canClear && { opacity: 0.4 }]} onPress={submitClear} disabled={!canClear || busy === c.id} activeOpacity={0.8}>
          {busy === c.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.verifyBtnText}>Clear Sale</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => onResolve(c, 'rejected', {})} disabled={busy === c.id} activeOpacity={0.8}>
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PoliceScreen({ currentUser }) {
  const [verifications, setVerifications] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('verify');

  const load = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [vRes, cRes, tRes] = await Promise.all([
        authFetch(currentUser, '/verifications?status=pending'),
        authFetch(currentUser, '/clearances?status=pending'),
        authFetch(currentUser, '/transfers'),
      ]);
      if (vRes.ok) setVerifications(await vRes.json());
      if (cRes.ok) setClearances(await cRes.json());
      if (tRes.ok) setTransfers(await tRes.json());
    } catch { /* offline */ }
    setLoading(false); setRefreshing(false);
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const resolveVerification = async (userId, status) => {
    setBusyId(userId);
    await authJson(currentUser, `/verifications/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verification_status: status }),
    });
    setVerifications(prev => prev.filter(v => v.id !== userId));
    setBusyId(null);
  };

  const resolveClearance = async (c, status, draft) => {
    setBusyId(c.id);
    const fd = new FormData();
    fd.append('status', status);
    if (status === 'cleared') {
      if (draft.registerNo) fd.append('clearance_register_no', draft.registerNo);
      if (draft.permitNumber) fd.append('movement_permit_number', draft.permitNumber);
      fd.append('not_stolen_certified', draft.certified ? 'true' : 'false');
      if (draft.signatureAsset) fd.append('signature', assetToFormFile(draft.signatureAsset));
    }
    try {
      const res = await authFetch(currentUser, `/clearances/${c.id}`, { method: 'PATCH', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert('Could not resolve', data.error || 'Try again.'); setBusyId(null); return; }
      setClearances(prev => prev.filter(x => x.id !== c.id));
    } catch { Alert.alert('Could not reach the PFUMA API.'); }
    setBusyId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.slate }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.officerAvatar}><Text style={styles.officerAvatarText}>{initials(currentUser?.name)}</Text></View>
          <View>
            <Text style={styles.headerEyebrow}>ZRP Officer</Text>
            <Text style={styles.headerTitle}>{currentUser?.name || 'Officer'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          { id: 'verify', label: 'Verifications', count: verifications.length },
          { id: 'clear', label: 'Clearances', count: clearances.length },
          { id: 'transfer', label: 'Transfers', count: transfers.length },
        ].map(t => (
          <TouchableOpacity key={t.id} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]} onPress={() => setTab(t.id)} activeOpacity={0.8}>
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>{t.label}{t.count ? ` (${t.count})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
        >
          {tab === 'verify' && (
            verifications.length === 0 ? (
              <View style={styles.emptyCard}><CheckCircle size={24} color="#57633E" /><Text style={styles.emptyText}>Queue is clear</Text></View>
            ) : verifications.map(v => <VerificationCard key={v.id} v={v} busy={busyId} onResolve={resolveVerification} />)
          )}
          {tab === 'clear' && (
            clearances.length === 0 ? (
              <View style={styles.emptyCard}><CheckCircle size={24} color="#57633E" /><Text style={styles.emptyText}>Queue is clear</Text></View>
            ) : clearances.map(c => <ClearanceCard key={c.id} c={c} currentUser={currentUser} busy={busyId} onResolve={resolveClearance} />)
          )}
          {tab === 'transfer' && (
            transfers.length === 0 ? (
              <View style={styles.emptyCard}><Repeat size={24} color={COLORS.mutedDark} /><Text style={styles.emptyText}>No off-platform transfers yet</Text></View>
            ) : transfers.map(t => (
              <View key={t.id} style={styles.card}>
                <Text style={styles.cardName}>{t.animal_name} · {t.species}</Text>
                <Text style={styles.cardSub}>{t.seller_name} → {t.buyer_name || 'unclaimed'}</Text>
                <Text style={styles.transferStatus}>{t.status} · code {t.transfer_code}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.danger, padding: 24, paddingTop: 56, paddingBottom: 20 },
  officerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  officerAvatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 17, fontWeight: '900' },

  tabRow:  { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: COLORS.danger },
  tabBtn:  { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  tabBtnActive: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  tabBtnTextActive: { color: COLORS.danger },

  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: COLORS.cardDark, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDark },
  emptyText: { fontSize: 13, fontWeight: '700', color: COLORS.mutedDark, marginTop: 10 },

  card:     { backgroundColor: COLORS.cardDark, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderDark },
  cardName: { fontSize: 13, fontWeight: '800', color: COLORS.textDark },
  cardSub:  { fontSize: 11, color: COLORS.mutedDark, marginTop: 2 },
  clearanceImg: { width: 44, height: 44, borderRadius: 12 },

  pendingBadge: { backgroundColor: 'rgba(213,168,92,0.18)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pendingBadgeText: { fontSize: 9, fontWeight: '900', color: '#D5A85C', textTransform: 'uppercase' },

  detailToggle: { fontSize: 11, fontWeight: '700', color: COLORS.mutedDark },
  detailBox:    { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, marginBottom: 10 },
  detailRow:    { fontSize: 11, color: 'rgba(247,243,237,0.75)', marginBottom: 2 },

  verifyBtn: { flex: 1, backgroundColor: '#57633E', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  rejectBtnText: { color: 'rgba(247,243,237,0.75)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  leaderBoxOk:      { backgroundColor: 'rgba(87,99,62,0.15)', borderWidth: 1, borderColor: 'rgba(87,99,62,0.35)', borderRadius: 12, padding: 10, marginBottom: 8 },
  leaderTitleOk:    { fontSize: 11, fontWeight: '800', color: '#A8B78C', textTransform: 'uppercase' },
  leaderBoxNeutral: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, marginBottom: 8 },
  leaderTitleNeutral: { fontSize: 11, fontWeight: '800', color: COLORS.mutedDark, textTransform: 'uppercase' },
  leaderBoxWarn:    { backgroundColor: 'rgba(154,42,35,0.15)', borderWidth: 1, borderColor: 'rgba(154,42,35,0.35)', borderRadius: 12, padding: 10, marginBottom: 8 },
  leaderTitleWarn:  { fontSize: 11, fontWeight: '700', color: '#C75B50' },
  leaderDetail:     { fontSize: 11, color: 'rgba(247,243,237,0.7)', marginTop: 2 },

  formCard:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, marginBottom: 4 },
  formCardLabel: { fontSize: 9, fontWeight: '800', color: COLORS.mutedDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  formCardText:  { fontSize: 11, color: 'rgba(247,243,237,0.75)', marginBottom: 2 },

  signBadge:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  signBadgeOk:   { backgroundColor: 'rgba(87,99,62,0.15)' },
  signBadgeOff:  { backgroundColor: 'rgba(255,255,255,0.05)' },
  signBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  formInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 11, fontSize: 12, color: '#fff' },
  certifyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  checkbox:   { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#57633E', borderColor: '#57633E' },
  certifyText: { flex: 1, fontSize: 11, color: 'rgba(247,243,237,0.75)', lineHeight: 16 },

  signatureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12 },
  signatureBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },
  signaturePreview: { width: 60, height: 40, borderRadius: 8, backgroundColor: '#fff' },
  removeSignature:  { fontSize: 11, fontWeight: '800', color: '#C75B50', textTransform: 'uppercase' },

  transferStatus: { fontSize: 10, fontWeight: '700', color: COLORS.mutedDark, textTransform: 'uppercase', marginTop: 4 },
});
