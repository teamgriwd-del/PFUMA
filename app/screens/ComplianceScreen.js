import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  ShieldAlert, ShieldCheck, Syringe, Clock, Lock, HandHelping,
  AlertTriangle, CheckCircle, PauseCircle, ChevronDown,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

// Mirrors src/components/Compliance/complianceData.js — same stage machine,
// same wording, so a farmer sees the same thing on either platform.
const STAGES = {
  reminder:     { short: 'Overdue', tone: 'amber',  farmer: 'This vaccination is past due. Log it when it is done — nothing else happens yet.' },
  vet_followup: { short: 'With vet', tone: 'orange', farmer: 'A vet has been asked to follow this up with you. Log the vaccination, or tell us what is stopping you.' },
  notice:       { short: 'Notice',  tone: 'red',    farmer: 'A vet has issued a formal notice. You have until the date below to vaccinate or report a blocker.' },
  penalty:      { short: 'Locked',  tone: 'red',    farmer: 'This animal cannot be listed or cleared for sale until the vaccination is logged. Your other animals and produce are not affected.' },
  deferred:     { short: 'Paused',  tone: 'blue',   farmer: 'The clock is paused. No penalty applies while this is being sorted out.' },
  resolved:     { short: 'Done',    tone: 'green',  farmer: 'Vaccination recorded. Case closed.' },
  waived:       { short: 'Waived',  tone: 'gray',   farmer: 'A vet decided this requirement does not apply.' },
};
const TONE = {
  amber:  { bg: '#F6E9CF', border: '#EDD5A6', text: '#8C632A' },
  orange: { bg: '#F7E1CE', border: '#EDBF9C', text: '#71360B' },
  red:    { bg: '#F6D9D5', border: '#EAB0A9', text: '#9A2A23' },
  blue:   { bg: COLORS.tealBg, border: 'rgba(63,112,107,0.3)', text: COLORS.teal },
  green:  { bg: COLORS.sproutBg, border: '#C9D2B4', text: '#465032' },
  gray:   { bg: COLORS.border, border: COLORS.border, text: COLORS.muted },
};
const BLOCKERS = [
  { id: 'vaccine_unavailable', label: 'The vaccine is not available', hint: 'Out of stock at the supplier, agrodealer or DVS office.', routes: 'Sent to suppliers in your province as a demand signal.' },
  { id: 'no_vet_access',       label: 'No vet has come to my area', hint: 'Nobody to administer it, or too far to travel to.', routes: 'Raises a vet visit request for your cooperative or ward.' },
  { id: 'financial_hardship',  label: 'I cannot afford it right now', hint: 'The dose or the visit is beyond what you can pay this month.', routes: 'Flagged for a pooled or subsidised vaccination round.' },
  { id: 'animal_condition',    label: 'The animal cannot be vaccinated yet', hint: 'Pregnant, sick, or too weak to take the dose safely.', routes: 'Sent to a vet to judge when it is safe.' },
  { id: 'other',                label: 'Something else', hint: 'Describe it and a vet will read it.', routes: 'Sent to a vet for review.' },
];
const BLOCKER_LABEL = Object.fromEntries(BLOCKERS.map(b => [b.id, b.label]));

const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
};

function BlockerForm({ caseId, currentUser, onCancel, onDone }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason) { setError('Pick what is stopping you.'); return; }
    setBusy(true); setError('');
    const { ok, data } = await authJson(currentUser, `/compliance/cases/${caseId}/defer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, notes }),
    });
    setBusy(false);
    if (!ok) { setError(data.error || 'Could not send this — try again.'); return; }
    onDone(data.message);
  };

  const picked = BLOCKERS.find(b => b.id === reason);

  return (
    <View style={styles.blockerForm}>
      <Text style={styles.blockerTitle}>What is stopping you?</Text>
      <Text style={styles.blockerHint}>This is not a penalty and it does not count against you. It pauses the clock and sends the problem to whoever can fix it.</Text>
      {BLOCKERS.map(b => (
        <TouchableOpacity key={b.id} style={[styles.blockerOption, reason === b.id && styles.blockerOptionActive]} onPress={() => setReason(b.id)} activeOpacity={0.8}>
          <View style={[styles.radio, reason === b.id && styles.radioActive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.blockerLabel}>{b.label}</Text>
            <Text style={styles.blockerSub}>{b.hint}</Text>
          </View>
        </TouchableOpacity>
      ))}
      {picked && (
        <View style={styles.routeNote}>
          <HandHelping size={13} color={COLORS.teal} />
          <Text style={styles.routeNoteText}>{picked.routes}</Text>
        </View>
      )}
      <TextInput
        style={styles.notesInput} placeholder="Anything else the vet should know (optional)"
        value={notes} onChangeText={setNotes} multiline placeholderTextColor="#bbb"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity style={styles.sendBtn} onPress={submit} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Send this to my vet</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActionTrail({ actions = [] }) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  return (
    <View style={styles.trail}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <ChevronDown size={12} color={COLORS.muted} style={open ? { transform: [{ rotate: '180deg' }] } : null} />
        <Text style={styles.trailToggle}>{open ? 'Hide' : 'Show'} full record ({actions.length})</Text>
      </TouchableOpacity>
      {open && actions.map(a => (
        <View key={a.id} style={styles.trailRow}>
          <View style={styles.trailDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trailAction}>{a.action.replace(/_/g, ' ')}</Text>
            {a.notes ? <Text style={styles.trailNotes}>{a.notes}</Text> : null}
            <Text style={styles.trailBy}>{a.actor_name || 'PFUMA (automatic)'} · {new Date(a.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function FarmerCase({ c, currentUser, onChanged }) {
  const [showBlocker, setShowBlocker] = useState(false);
  const [flash, setFlash] = useState('');
  const meta = STAGES[c.stage] || STAGES.reminder;
  const tone = TONE[meta.tone];
  const graceLeft = daysUntil(c.stage_due);
  const pauseLeft = daysUntil(c.deferred_until);

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

      <Text style={[styles.caseMsg, { color: tone.text }]}>{meta.farmer}</Text>

      {c.stage === 'notice' && graceLeft !== null && graceLeft >= 0 && (
        <View style={styles.rowGap}><Clock size={12} color="#9A2A23" /><Text style={styles.urgentText}>{graceLeft} day{graceLeft === 1 ? '' : 's'} left to act</Text></View>
      )}
      {c.stage === 'deferred' && pauseLeft !== null && (
        <View style={styles.rowGap}>
          <PauseCircle size={12} color={COLORS.teal} />
          <Text style={styles.pausedText}>Paused for {Math.max(pauseLeft, 0)} more day{pauseLeft === 1 ? '' : 's'}{c.blocker_reason ? ` · ${BLOCKER_LABEL[c.blocker_reason]}` : ''}</Text>
        </View>
      )}
      {c.stage === 'penalty' && (
        <View style={styles.penaltyBox}>
          <View style={styles.rowGap}><Lock size={12} color="#9A2A23" /><Text style={styles.penaltyTitle}>{c.animal_name} cannot be sold right now</Text></View>
          <Text style={styles.penaltyDesc}>
            {c.conditional_clearance
              ? 'Your vet has granted a conditional clearance — you may sell provided the animal is vaccinated at the point of sale.'
              : 'Log the vaccination and the lockout lifts immediately. If you cannot get the vaccine, tell us below — the lockout is not meant for that.'}
          </Text>
        </View>
      )}

      {flash ? <Text style={styles.flashText}>{flash}</Text> : null}

      {!showBlocker && !['resolved', 'waived'].includes(c.stage) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <TouchableOpacity style={styles.blockerBtn} onPress={() => setShowBlocker(true)} activeOpacity={0.8}>
            <Text style={styles.blockerBtnText}>I can't vaccinate — here's why</Text>
          </TouchableOpacity>
          <Text style={styles.orText}>or log it under Lifecycle</Text>
        </View>
      )}

      {showBlocker && (
        <BlockerForm
          caseId={c.id} currentUser={currentUser}
          onCancel={() => setShowBlocker(false)}
          onDone={(msg) => { setShowBlocker(false); setFlash(msg); onChanged(); }}
        />
      )}

      <ActionTrail actions={c.actions} />
    </View>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const t = TONE[tone];
  return (
    <View style={[styles.stat, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Icon size={15} color={t.text} />
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ComplianceScreen({ currentUser }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async (refresh = false) => {
    if (!currentUser?.token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const qs = filter === 'all' ? '?include_resolved=true' : '';
      const res = await authFetch(currentUser, `/compliance/cases${qs}`);
      if (res.ok) { setCases(await res.json()); setOffline(false); } else setOffline(true);
    } catch { setOffline(true); }
    setLoading(false); setRefreshing(false);
  }, [currentUser?.token, filter]);

  useEffect(() => { load(); }, [load]);

  const needsVet = cases.filter(c => ['vet_followup', 'notice'].includes(c.stage) || c.blocker_reason);
  const locked = cases.filter(c => c.trade_locked && !c.conditional_clearance);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ShieldAlert size={16} color="#EDD5A6" />
          <Text style={styles.headerEyebrow}>Vaccination compliance</Text>
        </View>
        <Text style={styles.headerTitle}>Your Vaccination Follow-Ups</Text>
        <Text style={styles.headerDesc}>A missed mandatory vaccination opens a case here. Log the shot and it closes itself. If something is stopping you, say so and the clock pauses with no penalty.</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How this works</Text>
          {[
            ['1. Reminder', 'you have a week to log it yourself. Nothing else happens.'],
            ['2. Vet follow-up', 'a vet in your province is asked to reach you.'],
            ['3. Formal notice', 'a vet issues it after speaking to you, with 14 days to act.'],
            ['4. Trade lockout', "that one animal can't be sold until the shot is logged. No fine, ever."],
          ].map(([t, d]) => (
            <Text key={t} style={styles.howLine}><Text style={styles.howBold}>{t}</Text> — {d}</Text>
          ))}
          <Text style={styles.howFooter}>At any stage, "I can't vaccinate" pauses everything. Reporting a real blocker is not an offence.</Text>
        </View>

        <View style={styles.statRow}>
          <Stat icon={AlertTriangle} label="Open cases" value={cases.filter(c => !['resolved', 'waived'].includes(c.stage)).length} tone="amber" />
          <Stat icon={ShieldAlert}   label="With a vet"  value={needsVet.length} tone="orange" />
        </View>
        <View style={styles.statRow}>
          <Stat icon={PauseCircle} label="Paused" value={cases.filter(c => c.stage === 'deferred').length} tone="blue" />
          <Stat icon={Lock}        label="Trade locked" value={locked.length} tone="red" />
        </View>

        <View style={styles.filterRow}>
          {[{ id: 'open', label: 'Open' }, { id: 'all', label: 'Including closed' }].map(f => (
            <TouchableOpacity key={f.id} style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]} onPress={() => setFilter(f.id)} activeOpacity={0.8}>
              <Text style={[styles.filterBtnText, filter === f.id && styles.filterBtnTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
        ) : offline ? (
          <View style={styles.emptyCard}>
            <AlertTriangle size={22} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Could not reach the PFUMA API.</Text>
            <Text style={styles.emptyDesc}>Compliance cases are held on the server — reconnect to see them.</Text>
          </View>
        ) : cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShieldCheck size={26} color="#57633E" />
            <Text style={styles.emptyTitle}>Every mandatory vaccination is up to date.</Text>
            <Text style={styles.emptyDesc}>Nothing to follow up. Keep logging each shot as you give it.</Text>
          </View>
        ) : (
          cases.map(c => <FarmerCase key={c.id} c={c} currentUser={currentUser} onChanged={load} />)
        )}

        {cases.some(c => c.stage === 'resolved') && (
          <View style={styles.rowGap}>
            <CheckCircle size={12} color={COLORS.primary} />
            <Text style={styles.resolvedNote}>Closed cases stay on the animal's lifecycle record as proof of vaccination.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.slate, padding: 24, paddingTop: 56, paddingBottom: 24 },
  headerEyebrow: { color: '#EDD5A6', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  headerDesc:    { color: 'rgba(247,243,237,0.65)', fontSize: 12, lineHeight: 18 },

  howCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, elevation: 2 },
  howTitle: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  howLine:  { fontSize: 12, color: COLORS.muted, marginBottom: 4, lineHeight: 17 },
  howBold:  { fontWeight: '800', color: COLORS.text },
  howFooter:{ fontSize: 11, fontWeight: '700', color: COLORS.primary, marginTop: 6, lineHeight: 16 },

  statRow:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat:     { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1 },
  statValue:{ fontSize: 22, fontWeight: '900', marginTop: 6 },
  statLabel:{ fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },

  filterRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText:  { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: COLORS.muted },
  filterBtnTextActive: { color: '#fff' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center' },
  emptyTitle:{ fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 10, textAlign: 'center' },
  emptyDesc: { fontSize: 12, color: COLORS.muted, marginTop: 4, textAlign: 'center' },

  caseCard:   { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1 },
  caseIcon:   { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  caseVaccine:{ fontSize: 13, fontWeight: '800', color: COLORS.text },
  caseSub:    { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  stageChip:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  stageChipText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  caseMsg:    { fontSize: 12, fontWeight: '700', marginTop: 10, lineHeight: 17 },

  rowGap:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  urgentText:   { fontSize: 11, fontWeight: '800', color: '#9A2A23' },
  pausedText:   { fontSize: 11, fontWeight: '800', color: COLORS.teal, flex: 1 },
  resolvedNote: { fontSize: 11, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },

  penaltyBox:   { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#EAB0A9' },
  penaltyTitle: { fontSize: 11, fontWeight: '800', color: '#9A2A23' },
  penaltyDesc:  { fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 16 },

  flashText: { fontSize: 11, fontWeight: '800', color: '#465032', backgroundColor: COLORS.sproutBg, borderWidth: 1, borderColor: '#C9D2B4', borderRadius: 12, padding: 10, marginTop: 10 },

  blockerBtn:     { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(122,63,11,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  blockerBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  orText:         { fontSize: 11, fontWeight: '700', color: COLORS.muted },

  blockerForm:    { marginTop: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  blockerTitle:   { fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  blockerHint:    { fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 16 },
  blockerOption:  { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, marginBottom: 8 },
  blockerOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.light },
  radio:          { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.border, marginTop: 2 },
  radioActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  blockerLabel:   { fontSize: 11, fontWeight: '800', color: COLORS.text },
  blockerSub:     { fontSize: 10, color: COLORS.muted, marginTop: 1, lineHeight: 14 },
  routeNote:      { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: COLORS.tealBg, borderWidth: 1, borderColor: 'rgba(63,112,107,0.25)', borderRadius: 12, padding: 10, marginTop: 4 },
  routeNoteText:  { fontSize: 11, fontWeight: '700', color: COLORS.teal, flex: 1 },
  notesInput:     { marginTop: 10, backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, fontSize: 12, color: COLORS.text, minHeight: 50, textAlignVertical: 'top' },
  errorText:      { fontSize: 11, fontWeight: '800', color: '#9A2A23', marginTop: 8 },
  sendBtn:        { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sendBtnText:    { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  cancelBtn:      { paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText:  { color: COLORS.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  trail:        { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  trailToggle:  { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  trailRow:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  trailDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border, marginTop: 5 },
  trailAction:  { fontSize: 11, fontWeight: '800', color: COLORS.text, textTransform: 'capitalize' },
  trailNotes:   { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  trailBy:      { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },
});
