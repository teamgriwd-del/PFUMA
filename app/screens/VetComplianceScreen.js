import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  ShieldAlert, ShieldCheck, Syringe, Clock, Lock, HandHelping, FileWarning,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

// Mirrors src/components/Compliance/complianceData.js
const STAGES = {
  reminder:     { short: 'Overdue', tone: 'amber',  vet: 'Overdue and still with the farmer. A vet is pulled in automatically after 7 days.' },
  vet_followup: { short: 'With vet', tone: 'orange', vet: 'Yours to chase. Contact the farmer before issuing anything formal.' },
  notice:       { short: 'Notice',  tone: 'red',    vet: 'Notice issued. A trade lockout only becomes available once the grace period runs out.' },
  penalty:      { short: 'Locked',  tone: 'red',    vet: 'Locked out of trade. Lifts automatically the moment the vaccination is recorded.' },
  deferred:     { short: 'Paused',  tone: 'blue',   vet: 'Farmer reported something stopping them. Accept it, or reject it with a reason.' },
  resolved:     { short: 'Done',    tone: 'green',  vet: 'Closed — the shot was logged.' },
  waived:       { short: 'Waived',  tone: 'gray',   vet: 'Waived by a vet.' },
};
const TONE = {
  amber:  { bg: '#F6E9CF', border: '#EDD5A6', text: '#8C632A' },
  orange: { bg: '#F7E1CE', border: '#EDBF9C', text: '#71360B' },
  red:    { bg: '#F6D9D5', border: '#EAB0A9', text: '#9A2A23' },
  blue:   { bg: COLORS.tealBg, border: 'rgba(63,112,107,0.3)', text: COLORS.teal },
  green:  { bg: COLORS.sproutBg, border: '#C9D2B4', text: '#465032' },
  gray:   { bg: COLORS.border, border: COLORS.border, text: COLORS.muted },
};
const BLOCKER_LABEL = {
  vaccine_unavailable: 'The vaccine is not available', no_vet_access: 'No vet has come to the area',
  financial_hardship: 'Cannot afford it right now', animal_condition: 'Animal cannot be vaccinated yet', other: 'Something else',
};

const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
};

function VetCase({ c, currentUser, onChanged }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = STAGES[c.stage] || STAGES.reminder;
  const tone = TONE[meta.tone];
  const graceLeft = daysUntil(c.stage_due);
  const lockoutReady = c.stage === 'notice' && (graceLeft === null || graceLeft < 0);

  const act = async (action, extra = {}) => {
    setBusy(true);
    const { ok, data } = await authJson(currentUser, `/compliance/cases/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, notes, ...extra }),
    });
    setBusy(false);
    if (!ok) { onChanged(null, data.error || 'Could not update this case.'); return; }
    setNotes('');
    onChanged(true);
  };

  return (
    <View style={[styles.caseCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
          <View style={styles.caseIcon}><Syringe size={17} color={tone.text} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.caseVaccine}>{c.vaccine_name}</Text>
            <Text style={styles.caseSub}>{c.animal_name}{c.tag_id ? ` · ${c.tag_id}` : ''} · due {new Date(c.due_date).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={[styles.stageChip, { backgroundColor: tone.border }]}><Text style={[styles.stageChipText, { color: tone.text }]}>{meta.short}</Text></View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{c.owner_name}</Text>
        {c.owner_phone ? <Text style={styles.metaText}>{c.owner_phone}</Text> : null}
        <Text style={styles.metaText}>{[c.district, c.province].filter(Boolean).join(', ')}</Text>
        {c.vet_name ? <Text style={[styles.metaText, { color: COLORS.primary }]}>Handled by {c.vet_name}</Text> : null}
      </View>

      <Text style={[styles.caseMsg, { color: tone.text }]}>{meta.vet}</Text>

      {c.blocker_reason && (
        <View style={styles.blockerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HandHelping size={12} color={COLORS.teal} />
            <Text style={styles.blockerTitle}>Farmer reported: {BLOCKER_LABEL[c.blocker_reason] || c.blocker_reason}</Text>
          </View>
          {c.blocker_notes ? <Text style={styles.blockerNotes}>"{c.blocker_notes}"</Text> : null}
          <Text style={styles.blockerMeta}>Routed to {String(c.routed_to || '').replace(/_/g, ' ')} · {c.defer_count} report{c.defer_count === 1 ? '' : 's'}</Text>
        </View>
      )}

      {c.stage === 'notice' && graceLeft !== null && graceLeft >= 0 && (
        <View style={styles.rowGap}><Clock size={12} color={COLORS.muted} /><Text style={styles.graceText}>Grace period ends in {graceLeft} day{graceLeft === 1 ? '' : 's'} — no lockout before then</Text></View>
      )}

      {!['resolved', 'waived'].includes(c.stage) && (
        <>
          <TextInput
            style={styles.notesInput} placeholder="What you found on follow-up — visible to the farmer"
            value={notes} onChangeText={setNotes} multiline placeholderTextColor="#bbb"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {!c.vet_id && (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => act('claim')} disabled={busy} activeOpacity={0.8}>
                <Text style={styles.actionBtnOutlineText}>Take this on</Text>
              </TouchableOpacity>
            )}
            {c.blocker_reason && (
              <>
                <TouchableOpacity style={styles.actionBtnBlue} onPress={() => act('accept_deferral')} disabled={busy} activeOpacity={0.8}>
                  <Text style={styles.actionBtnBlueText}>Accept blocker — pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnOutline} onPress={() => act('reject_deferral')} disabled={busy} activeOpacity={0.8}>
                  <Text style={styles.actionBtnOutlineText}>Reject blocker</Text>
                </TouchableOpacity>
              </>
            )}
            {['reminder', 'vet_followup', 'deferred'].includes(c.stage) && (
              <TouchableOpacity style={styles.actionBtnRed} onPress={() => act('issue_notice')} disabled={busy} activeOpacity={0.8}>
                <FileWarning size={12} color="#fff" />
                <Text style={styles.actionBtnRedText}>Issue formal notice</Text>
              </TouchableOpacity>
            )}
            {lockoutReady && (
              <TouchableOpacity style={styles.actionBtnDark} onPress={() => act('apply_lockout', { blocker_reviewed: !c.blocker_reason })} disabled={busy} activeOpacity={0.8}>
                <Lock size={12} color="#fff" />
                <Text style={styles.actionBtnRedText}>Apply trade lockout</Text>
              </TouchableOpacity>
            )}
            {c.stage === 'penalty' && !c.conditional_clearance && (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => act('conditional_clearance')} disabled={busy} activeOpacity={0.8}>
                <Text style={styles.actionBtnOutlineText}>Allow sale w/ vaccination at sale</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => act('waive')} disabled={busy} activeOpacity={0.8}>
              <Text style={styles.waiveText}>Doesn't apply — waive</Text>
            </TouchableOpacity>
          </View>
          {busy ? <ActivityIndicator size="small" color={tone.text} style={{ marginTop: 8 }} /> : null}
        </>
      )}
    </View>
  );
}

export default function VetComplianceScreen({ currentUser }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState(null);

  const load = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const qs = filter === 'all' ? '?include_resolved=true' : '';
      const res = await authFetch(currentUser, `/compliance/cases${qs}`);
      if (res.ok) setCases(await res.json());
    } catch { /* offline */ }
    setLoading(false); setRefreshing(false);
  }, [currentUser?.token, filter]);

  useEffect(() => { load(); }, [load]);

  const onChanged = (ok, err) => { if (err) setError(err); load(); };

  const needsAction = cases.filter(c => ['vet_followup', 'notice'].includes(c.stage) || c.blocker_reason);
  const locked = cases.filter(c => c.trade_locked && !c.conditional_clearance);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ShieldAlert size={16} color="#EDD5A6" />
          <Text style={styles.headerEyebrow}>Vaccination compliance</Text>
        </View>
        <Text style={styles.headerTitle}>Follow-Up Queue</Text>
        <Text style={styles.headerDesc}>Animals whose mandatory vaccinations are overdue in your province. Issuing a notice or lockout is your decision, never automatic.</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{cases.filter(c => !['resolved', 'waived'].includes(c.stage)).length}</Text><Text style={styles.statLabel}>Open</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{needsAction.length}</Text><Text style={styles.statLabel}>Need action</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{locked.length}</Text><Text style={styles.statLabel}>Locked</Text></View>
        </View>

        <View style={styles.filterRow}>
          {[{ id: 'open', label: 'Open' }, { id: 'all', label: 'Including closed' }].map(f => (
            <TouchableOpacity key={f.id} style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]} onPress={() => setFilter(f.id)} activeOpacity={0.8}>
              <Text style={[styles.filterBtnText, filter === f.id && styles.filterBtnTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
        ) : cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShieldCheck size={26} color="#57633E" />
            <Text style={styles.emptyText}>No overdue vaccinations in your province.</Text>
          </View>
        ) : (
          cases.map(c => <VetCase key={c.id} c={c} currentUser={currentUser} onChanged={onChanged} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.teal, padding: 24, paddingTop: 56, paddingBottom: 20 },
  headerEyebrow: { color: '#DAE7E5', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  headerDesc:    { color: 'rgba(247,243,237,0.7)', fontSize: 12, lineHeight: 18 },

  statRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  statValue:{ fontSize: 20, fontWeight: '900', color: COLORS.text },
  statLabel:{ fontSize: 9, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  filterBtnText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: COLORS.muted },
  filterBtnTextActive: { color: '#fff' },

  errorBanner: { fontSize: 11, fontWeight: '800', color: '#9A2A23', backgroundColor: '#F6D9D5', padding: 10, borderRadius: 12, marginBottom: 10 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 10, textAlign: 'center' },

  caseCard:   { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1 },
  caseIcon:   { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  caseVaccine:{ fontSize: 13, fontWeight: '800', color: COLORS.text },
  caseSub:    { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  stageChip:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  stageChipText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  metaText: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  caseMsg:  { fontSize: 12, fontWeight: '700', marginTop: 6, lineHeight: 17 },

  blockerBox:   { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(63,112,107,0.25)' },
  blockerTitle: { fontSize: 11, fontWeight: '800', color: COLORS.teal },
  blockerNotes: { fontSize: 11, color: COLORS.muted, marginTop: 3, fontStyle: 'italic' },
  blockerMeta:  { fontSize: 9, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 4 },

  rowGap:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  graceText: { fontSize: 11, fontWeight: '700', color: COLORS.muted },

  notesInput: { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 12, color: COLORS.text, minHeight: 50, textAlignVertical: 'top' },

  actionBtnOutline: { backgroundColor: '#fff', borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  actionBtnOutlineText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: COLORS.muted },
  actionBtnBlue: { backgroundColor: COLORS.teal, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  actionBtnBlueText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#fff' },
  actionBtnRed: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#9A2A23', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  actionBtnRedText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#fff' },
  actionBtnDark: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#29231E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  waiveText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: COLORS.muted, paddingVertical: 9 },
});
