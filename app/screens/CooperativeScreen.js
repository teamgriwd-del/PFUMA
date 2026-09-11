import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import {
  Handshake, Users, Calendar, Stethoscope, Plus, Search,
  MapPin, LogOut, Crown, X, CheckCircle,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

const STATUS_COLOR = {
  open:      { bg: COLORS.border, text: COLORS.muted },
  claimed:   { bg: COLORS.tealBg, text: COLORS.teal },
  completed: { bg: COLORS.sproutBg, text: '#57633E' },
};

const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Browse / create — shown when the farmer isn't in a cooperative yet ─────
function CreateOrJoin({ currentUser, onChanged }) {
  const [mode, setMode] = useState('browse'); // 'browse' | 'create'
  const [browseList, setBrowseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', dip_tank_location: '', district: currentUser?.district || '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(currentUser, `/cooperatives?province=${encodeURIComponent(currentUser?.province || '')}`);
      if (res.ok) setBrowseList(await res.json());
    } catch { /* offline — leave empty, no fake fallback */ }
    setLoading(false);
  }, [currentUser?.province, currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  const join = async (coopId) => {
    setBusy(true);
    const { ok, data } = await authJson(currentUser, `/cooperatives/${coopId}/join`, { method: 'POST' });
    setBusy(false);
    if (!ok) { Alert.alert('Could not join', data.error || 'Try again.'); return; }
    onChanged();
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    const { ok, data } = await authJson(currentUser, '/cooperatives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setBusy(false);
    if (!ok) { Alert.alert('Could not create', data.error || 'Try again.'); return; }
    onChanged();
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Handshake size={16} color={COLORS.gold} />
          <Text style={styles.headerEyebrow}>Cooperative</Text>
        </View>
        <Text style={styles.headerTitle}>Your Dip Tank or Grazing Group</Text>
        <Text style={styles.headerDesc}>Coordinate a shared dip day and request a vet visit for the whole group at once — join the one you already share with your neighbors, or start a new one.</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, mode === 'browse' && styles.tabBtnActive]} onPress={() => setMode('browse')} activeOpacity={0.8}>
          <Search size={13} color={mode === 'browse' ? '#fff' : COLORS.muted} />
          <Text style={[styles.tabBtnText, mode === 'browse' && styles.tabBtnTextActive]}>Find Mine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, mode === 'create' && styles.tabBtnActive]} onPress={() => setMode('create')} activeOpacity={0.8}>
          <Plus size={13} color={mode === 'create' ? '#fff' : COLORS.muted} />
          <Text style={[styles.tabBtnText, mode === 'create' && styles.tabBtnTextActive]}>Start New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {mode === 'browse' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cooperatives in {currentUser?.province || 'your province'}</Text>
            <Text style={styles.cardDesc}>If your dip tank association is already here, join it — don't start a duplicate.</Text>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : browseList.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={26} color={COLORS.muted} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>None found yet</Text>
                <Text style={styles.emptyDesc}>Be the first to start one for your area.</Text>
              </View>
            ) : browseList.map(c => (
              <View key={c.id} style={styles.coopRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.coopName}>{c.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={11} color={COLORS.muted} />
                    <Text style={styles.coopSub}>{c.district ? `${c.district}, ` : ''}{c.province} · {c.member_count} member{c.member_count !== 1 ? 's' : ''}</Text>
                  </View>
                  {c.dip_tank_location ? <Text style={styles.coopSub}>{c.dip_tank_location}</Text> : null}
                </View>
                <TouchableOpacity style={styles.joinBtn} onPress={() => join(c.id)} disabled={busy} activeOpacity={0.8}>
                  <Text style={styles.joinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Start a new cooperative</Text>
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Chegutu Dip Tank Association" value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholderTextColor="#bbb" />
            <Text style={styles.formLabel}>Dip Tank / Grazing Location</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Chegutu Dip Tank #3" value={form.dip_tank_location}
              onChangeText={v => setForm(p => ({ ...p, dip_tank_location: v }))} placeholderTextColor="#bbb" />
            <Text style={styles.formLabel}>District</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Zvimba" value={form.district}
              onChangeText={v => setForm(p => ({ ...p, district: v }))} placeholderTextColor="#bbb" />
            <Text style={styles.formLabel}>Description</Text>
            <TextInput style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]} placeholder="Optional — who's this for?" value={form.description}
              onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholderTextColor="#bbb" multiline />
            <Text style={styles.provinceNote}>Province is set from your profile: {currentUser?.province || 'not set'}.</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={create} disabled={busy} activeOpacity={0.8}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Cooperative</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── The farmer's own cooperative — members, dip schedule, vet requests ────
function CooperativeHome({ currentUser, coop, onChanged }) {
  const [dipSchedule, setDipSchedule] = useState([]);
  const [vetRequests, setVetRequests] = useState([]);
  const [showDipForm, setShowDipForm] = useState(false);
  const [showReqForm, setShowReqForm] = useState(false);
  const [dipForm, setDipForm] = useState({ scheduled_date: '', notes: '' });
  const [reqForm, setReqForm] = useState({ reason: '', preferred_date: '' });
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = coop.members.find(m => m.id === currentUser.id)?.role === 'admin';

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await authFetch(currentUser, `/cooperatives/${coop.id}/dip-schedule`);
      if (res.ok) setDipSchedule(await res.json());
    } catch { /* offline */ }
    try {
      const res = await authFetch(currentUser, `/cooperatives/${coop.id}/vet-requests`);
      if (res.ok) setVetRequests(await res.json());
    } catch { /* offline */ }
    setRefreshing(false);
  }, [coop.id, currentUser.token]);

  useEffect(() => { load(); }, [load]);

  const submitDip = async () => {
    if (!dipForm.scheduled_date) { Alert.alert('Pick a date first.'); return; }
    setBusy(true);
    const { ok, data } = await authJson(currentUser, `/cooperatives/${coop.id}/dip-schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dipForm),
    });
    setBusy(false);
    if (!ok) { Alert.alert('Could not schedule', data.error || 'Try again.'); return; }
    setDipForm({ scheduled_date: '', notes: '' }); setShowDipForm(false);
    await load();
  };

  const submitRequest = async () => {
    if (!reqForm.reason.trim()) return;
    setBusy(true);
    const { ok, data } = await authJson(currentUser, `/cooperatives/${coop.id}/vet-requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqForm),
    });
    setBusy(false);
    if (!ok) { Alert.alert('Could not post request', data.error || 'Try again.'); return; }
    setReqForm({ reason: '', preferred_date: '' }); setShowReqForm(false);
    await load();
  };

  const leave = () => {
    Alert.alert('Leave cooperative?', `You'll need to be re-added or join another group.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await authFetch(currentUser, `/cooperatives/${coop.id}/leave`, { method: 'POST' }); onChanged(); }
        catch { Alert.alert('Could not reach the PFUMA/INGCEBO API.'); setBusy(false); }
      } },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
    >
      <View style={styles.heroCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Handshake size={16} color={COLORS.gold} />
          <Text style={styles.headerEyebrow}>Cooperative</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{coop.name}</Text>
            <Text style={styles.heroSub}>
              {coop.district ? `${coop.district}, ` : ''}{coop.province}{coop.dip_tank_location ? ` · ${coop.dip_tank_location}` : ''} · {coop.members.length} member{coop.members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.leaveBtn} onPress={leave} disabled={busy} activeOpacity={0.8}>
            <LogOut size={12} color="#fff" />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Members */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Users size={15} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Members</Text>
        </View>
        <Text style={styles.cardDesc}>Everyone sharing this dip tank / grazing group.</Text>
        {coop.members.map(m => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{initials(m.full_name)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.memberName} numberOfLines={1}>{m.full_name}</Text>
                {m.role === 'admin' && <Crown size={11} color={COLORS.gold} />}
              </View>
              <Text style={styles.memberSub}>{m.animal_count} animal{m.animal_count !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Dip schedule */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} color={COLORS.teal} />
            <Text style={styles.cardTitle}>Dip Schedule</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={() => setShowDipForm(p => !p)}><Text style={styles.addLink}>+ Add</Text></TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardDesc}>
          {isAdmin ? 'One shared dip date visible to every member — you set it since you admin this group.' : 'The next agreed dip day for the whole group, set by your group admin.'}
        </Text>
        {showDipForm && (
          <View style={styles.inlineForm}>
            <TextInput style={styles.formInput} placeholder="YYYY-MM-DD" value={dipForm.scheduled_date}
              onChangeText={v => setDipForm(p => ({ ...p, scheduled_date: v }))} placeholderTextColor="#bbb" />
            <TextInput style={styles.formInput} placeholder="Notes (optional)" value={dipForm.notes}
              onChangeText={v => setDipForm(p => ({ ...p, notes: v }))} placeholderTextColor="#bbb" />
            <TouchableOpacity style={styles.smallSubmitBtn} onPress={submitDip} disabled={busy} activeOpacity={0.8}>
              <Text style={styles.smallSubmitText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
        {dipSchedule.length === 0 ? (
          <Text style={styles.emptyInline}>No dip day scheduled yet.</Text>
        ) : dipSchedule.map(d => (
          <View key={d.id} style={styles.dipRow}>
            <Text style={styles.dipDate}>{new Date(d.scheduled_date).toDateString()}</Text>
            {d.notes ? <Text style={styles.dipNotes}>{d.notes}</Text> : null}
            <Text style={styles.dipBy}>Set by {d.created_by_name}</Text>
          </View>
        ))}
      </View>

      {/* Vet requests */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={15} color={COLORS.gold} />
            <Text style={styles.cardTitle}>Vet Requests</Text>
          </View>
          <TouchableOpacity onPress={() => setShowReqForm(p => !p)}><Text style={styles.addLink}>+ Request</Text></TouchableOpacity>
        </View>
        <Text style={styles.cardDesc}>Post once for the whole group — any verified vet in {coop.province} can claim it.</Text>
        {showReqForm && (
          <View style={styles.inlineForm}>
            <TextInput style={styles.formInput} placeholder="What's needed? e.g. Group health check on dip day" value={reqForm.reason}
              onChangeText={v => setReqForm(p => ({ ...p, reason: v }))} placeholderTextColor="#bbb" />
            <TextInput style={styles.formInput} placeholder="Preferred date (YYYY-MM-DD, optional)" value={reqForm.preferred_date}
              onChangeText={v => setReqForm(p => ({ ...p, preferred_date: v }))} placeholderTextColor="#bbb" />
            <TouchableOpacity style={styles.smallSubmitBtn} onPress={submitRequest} disabled={busy} activeOpacity={0.8}>
              <Text style={styles.smallSubmitText}>Post</Text>
            </TouchableOpacity>
          </View>
        )}
        {vetRequests.length === 0 ? (
          <Text style={styles.emptyInline}>No vet requests yet.</Text>
        ) : vetRequests.map(r => {
          const sc = STATUS_COLOR[r.status] || STATUS_COLOR.open;
          return (
            <View key={r.id} style={styles.reqRow}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={styles.reqReason}>{r.reason}</Text>
                <View style={[styles.reqBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.reqBadgeText, { color: sc.text }]}>{r.status}</Text>
                </View>
              </View>
              <Text style={styles.reqSub}>By {r.requested_by_name}{r.preferred_date ? ` · wants ${new Date(r.preferred_date).toDateString()}` : ''}</Text>
              {r.vet_name ? <Text style={styles.reqSub}>Vet: {r.vet_name}</Text> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function CooperativeScreen({ currentUser }) {
  const [coop, setCoop] = useState(undefined); // undefined = loading, null = none

  const load = useCallback(async () => {
    if (!currentUser?.token) return;
    try {
      const res = await authFetch(currentUser, '/cooperatives/mine');
      if (res.ok) setCoop(await res.json());
      else setCoop(null);
    } catch { setCoop(null); }
  }, [currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  if (coop === undefined) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return coop
    ? <CooperativeHome currentUser={currentUser} coop={coop} onChanged={load} />
    : <CreateOrJoin currentUser={currentUser} onChanged={load} />;
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, paddingBottom: 24 },
  headerEyebrow: { color: '#F6E9CF', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontFamily: FONTS.extrabold, marginBottom: 6 },
  headerDesc:    { color: 'rgba(247,243,237,0.75)', fontSize: 12, lineHeight: 18 },

  tabRow:        { flexDirection: 'row', gap: 4, backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 16, padding: 4, elevation: 2 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabBtnActive:  { backgroundColor: COLORS.primary },
  tabBtnText:    { fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase', color: COLORS.muted },
  tabBtnTextActive: { color: '#fff' },

  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
  cardTitle:     { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.text, marginBottom: 4 },
  cardDesc:      { fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 17 },

  emptyState:    { alignItems: 'center', paddingVertical: 30 },
  emptyTitle:    { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.text, marginTop: 8 },
  emptyDesc:     { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  emptyInline:   { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 14 },

  coopRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: COLORS.bg, borderRadius: 16, marginBottom: 10 },
  coopName:      { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.text },
  coopSub:       { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  joinBtn:       { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  joinBtnText:   { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  formLabel:     { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  formInput:     { backgroundColor: COLORS.bg, borderRadius: 12, padding: 13, fontSize: 14, color: COLORS.text, marginBottom: 4 },
  provinceNote:  { fontSize: 11, color: COLORS.muted, marginTop: 8, marginBottom: 14 },
  submitBtn:     { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitText:    { color: '#fff', fontFamily: FONTS.extrabold, fontSize: 14 },

  heroCard:      { backgroundColor: COLORS.slate, borderRadius: 20, padding: 20, marginBottom: 14 },
  heroTitle:     { color: '#fff', fontSize: 20, fontFamily: FONTS.extrabold, marginBottom: 4 },
  heroSub:       { color: 'rgba(247,243,237,0.6)', fontSize: 12, fontFamily: FONTS.semibold },
  leaveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  leaveBtnText:  { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  memberRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: COLORS.bg, borderRadius: 12, marginBottom: 8 },
  memberAvatar:  { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold },
  memberName:    { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  memberSub:     { fontSize: 11, color: COLORS.muted },

  addLink:       { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.primary, textTransform: 'uppercase' },
  inlineForm:    { backgroundColor: COLORS.bg, borderRadius: 14, padding: 10, marginBottom: 12 },
  smallSubmitBtn:{ backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  smallSubmitText: { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  dipRow:        { backgroundColor: COLORS.tealBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(63,112,107,0.18)' },
  dipDate:       { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  dipNotes:      { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  dipBy:         { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.muted, textTransform: 'uppercase', marginTop: 4 },

  reqRow:        { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 8 },
  reqReason:     { flex: 1, fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text, lineHeight: 16 },
  reqBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  reqBadgeText:  { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },
  reqSub:        { fontSize: 11, color: COLORS.muted, marginTop: 3 },
});
