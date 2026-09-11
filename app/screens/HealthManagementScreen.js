import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import {
  HeartPulse, Baby, BookOpen, FlaskConical, Calendar, CheckCircle,
  Info, Package, Tag,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';
import { HEALTH_PROTOCOLS, BREED_PROFILES } from '../data/healthData';

const MATING_EVENT = 'Mating / Insemination';

const STATUS_COLOR = {
  Completed: { bg: COLORS.sproutBg, border: '#C9D2B4', text: '#465032', dot: COLORS.primary },
  Overdue:   { bg: '#F6D9D5', border: '#EAB0A9', text: '#9A2A23', dot: '#B5342C' },
  'Due Soon':{ bg: '#F7E1CE', border: '#EDBF9C', text: '#71360B', dot: '#A65312' },
  Upcoming:  { bg: COLORS.bg, border: COLORS.border, text: COLORS.muted, dot: COLORS.border },
};

// Maps a /health-events row into the same shape App.jsx's auditLogFromApi
// gives the web app, so the schedule math below matches exactly.
const auditLogFromApi = (e) => ({
  id: e.id, animalId: e.animal_id, eventType: e.event_type,
  eventDate: e.event_date, nextDueDate: e.next_due_date,
  date: new Date(e.event_date).toLocaleString(),
});

export default function HealthManagementScreen({ currentUser }) {
  const [animals, setAnimals] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [gestationStart, setGestationStart] = useState('');
  const [matingSaving, setMatingSaving] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState('lifecycle');
  const [feedback, setFeedback] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ eventType: '', eventDate: '', nextDueDate: '', notes: '' });
  const [recommendations, setRecommendations] = useState([]);
  const [administeringId, setAdministeringId] = useState(null);
  const feedbackTimer = useRef(null);

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  const loadInventory = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await authFetch(currentUser, `/inventory/${currentUser.id}`);
      if (res.ok) setInventory((await res.json()).map(i => ({ id: i.id, name: i.medicine_name, stock: Number(i.stock), unit: i.unit, min: Number(i.min_stock) })));
    } catch { /* offline */ }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.token) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/animals');
        if (res.ok) setAnimals(await res.json());
      } catch { /* offline */ }
      try {
        const res = await authFetch(currentUser, '/health-events');
        if (res.ok) setAuditLog((await res.json()).map(auditLogFromApi));
      } catch { /* offline */ }
    })();
    loadInventory();
  }, [currentUser?.token, loadInventory]);

  useEffect(() => {
    if (!selectedAnimalId && animals.length) setSelectedAnimalId(String(animals[0].id));
  }, [animals]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAnimal = useMemo(() => animals.find(a => a.id === parseInt(selectedAnimalId, 10)), [animals, selectedAnimalId]);

  useEffect(() => {
    if (!selectedAnimal) { setGestationStart(''); return; }
    const lastMating = auditLog.find(e => e.animalId === selectedAnimal.id && e.eventType === MATING_EVENT);
    setGestationStart(lastMating?.eventDate ? new Date(lastMating.eventDate).toISOString().slice(0, 10) : '');
  }, [selectedAnimal?.id, auditLog]);

  const showFeedback = (msg) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(msg);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  };

  const addAuditLog = async (entry) => {
    const { ok, data } = await authJson(currentUser, '/health-events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animal_id: entry.animalId, event_type: entry.eventType, notes: entry.notes || '',
        event_date: entry.eventDate || undefined, next_due_date: entry.nextDueDate || null,
      }),
    });
    if (!ok) return { ok: false, error: data.error || 'Could not save this to your records — try again.' };
    setAuditLog(prev => [data.event ? auditLogFromApi(data.event) : entry, ...prev]);
    return { ok: true };
  };

  const calculateGestation = (startDate, species) => {
    if (!startDate || !species) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    const period = HEALTH_PROTOCOLS[species]?.gestation || 283;
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + period);
    const diffDays = Math.ceil((dueDate - new Date()) / 86400000);
    return { date: dueDate.toDateString(), daysRemaining: diffDays, isUrgent: diffDays <= 14 && diffDays > 0, isOverdue: diffDays < 0, period };
  };

  const getLifecycleStats = (animal) => {
    if (!animal?.birth_date && !animal?.birthDate) return null;
    const birth = new Date(animal.birth_date || animal.birthDate);
    if (isNaN(birth.getTime())) return null;
    const weaningDays = HEALTH_PROTOCOLS[animal.species]?.weaningAge || 210;
    const weaningDate = new Date(birth);
    weaningDate.setDate(birth.getDate() + weaningDays);
    const now = new Date();
    const ageInDays = Math.floor((now - birth) / 86400000);
    const ageYears = Math.floor(ageInDays / 365);
    const ageMonths = Math.floor((ageInDays % 365) / 30);
    return {
      weaningDate: weaningDate.toDateString(), isWeaned: now > weaningDate,
      daysUntilWeaning: Math.ceil((weaningDate - now) / 86400000),
      ageDisplay: ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageInDays}d`,
    };
  };

  const getDynamicSchedule = (animal) => {
    const birthRaw = animal?.birth_date || animal?.birthDate;
    if (!birthRaw) return [];
    const birth = new Date(birthRaw);
    if (isNaN(birth.getTime())) return [];
    const now = new Date();
    const protocol = HEALTH_PROTOCOLS[animal.species];
    const items = [...(protocol?.vaccines || []), ...(protocol?.dips || [])];
    return items.map(v => {
      const lastEvent = auditLog.find(e => e.animalId === animal.id && e.eventType === v.name);
      let dueDate, isCompleted;
      if (!lastEvent) {
        dueDate = new Date(birth); dueDate.setDate(birth.getDate() + v.age); isCompleted = false;
      } else if (v.intervalDays) {
        dueDate = lastEvent.nextDueDate ? new Date(lastEvent.nextDueDate) : new Date(new Date(lastEvent.eventDate).getTime() + v.intervalDays * 86400000);
        isCompleted = dueDate > now;
      } else {
        dueDate = new Date(birth); dueDate.setDate(birth.getDate() + v.age); isCompleted = true;
      }
      const daysUntil = Math.ceil((dueDate - now) / 86400000);
      const status = isCompleted ? 'Completed' : now > dueDate ? 'Overdue' : daysUntil <= 14 ? 'Due Soon' : 'Upcoming';
      return { ...v, dueDate: dueDate.toDateString(), daysUntil, status, lastDone: lastEvent?.date || null };
    });
  };

  const handleCompleteTask = async (task) => {
    if (!selectedAnimal || task.status === 'Completed') return;
    const nextDueDate = task.intervalDays ? new Date(Date.now() + task.intervalDays * 86400000).toISOString().slice(0, 10) : null;
    const result = await addAuditLog({ animalId: selectedAnimal.id, eventType: task.name, nextDueDate, date: new Date().toLocaleString() });
    if (!result.ok) { showFeedback(result.error); return; }
    showFeedback(nextDueDate ? `${task.name} logged — next due ${new Date(nextDueDate).toDateString()}.` : `${task.name} marked done.`);
  };

  const handleLogCustomEvent = async () => {
    if (!selectedAnimal || !logForm.eventType.trim()) return;
    const result = await addAuditLog({
      animalId: selectedAnimal.id, eventType: logForm.eventType.trim(),
      eventDate: logForm.eventDate || undefined, nextDueDate: logForm.nextDueDate || null,
      notes: logForm.notes || '', date: new Date().toLocaleString(),
    });
    if (!result.ok) { showFeedback(result.error); return; }
    setLogForm({ eventType: '', eventDate: '', nextDueDate: '', notes: '' });
    setShowLogForm(false);
    showFeedback(`Logged "${logForm.eventType.trim()}".`);
  };

  const handleSetMatingDate = async (dateStr) => {
    setGestationStart(dateStr);
    if (!selectedAnimal || !dateStr) return;
    const period = HEALTH_PROTOCOLS[selectedAnimal.species]?.gestation || 283;
    const expectedBirth = new Date(dateStr);
    expectedBirth.setDate(expectedBirth.getDate() + period);
    setMatingSaving(true);
    const result = await addAuditLog({
      animalId: selectedAnimal.id, eventType: MATING_EVENT, eventDate: dateStr,
      nextDueDate: expectedBirth.toISOString().slice(0, 10), date: new Date().toLocaleString(),
    });
    setMatingSaving(false);
    if (!result.ok) { showFeedback(result.error); return; }
    showFeedback(`Mating date saved — expected birth ${expectedBirth.toDateString()}.`);
  };

  const loadRecommendations = useCallback(async () => {
    if (!selectedAnimal) { setRecommendations([]); return; }
    try {
      const res = await authFetch(currentUser, `/medication-recommendations?animal_id=${selectedAnimal.id}`);
      if (res.ok) setRecommendations(await res.json());
    } catch { /* offline */ }
  }, [selectedAnimal?.id, currentUser?.token]);

  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);

  const administerRecommendation = async (rec) => {
    setAdministeringId(rec.id);
    const { ok, data } = await authJson(currentUser, `/medication-recommendations/${rec.id}/administer`, { method: 'PATCH' });
    setAdministeringId(null);
    if (!ok) { showFeedback(data.error || 'Could not administer — try again.'); return; }
    showFeedback(data.message || `${rec.medicine_name} administered.`);
    await loadRecommendations();
    await loadInventory();
  };

  if (!animals.length) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <HeartPulse size={32} color={COLORS.muted} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No animals registered yet</Text>
        <Text style={styles.emptyDesc}>Register an animal in Herd Registry to track its vaccinations and lifecycle.</Text>
      </View>
    );
  }

  const schedule = selectedAnimal ? getDynamicSchedule(selectedAnimal) : [];
  const stats = selectedAnimal ? getLifecycleStats(selectedAnimal) : null;
  const gestation = activeInfoTab === 'pregnancy' ? calculateGestation(gestationStart, selectedAnimal?.species) : null;
  const breedInfo = (BREED_PROFILES[selectedAnimal?.species] || []).find(b => b.breed === selectedAnimal?.breed);
  const overdueCount = schedule.filter(s => s.status === 'Overdue').length;
  const dueSoonCount = schedule.filter(s => s.status === 'Due Soon').length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <HeartPulse size={16} color="#DEC9AE" />
          <Text style={styles.headerEyebrow}>Lifecycle</Text>
        </View>
        <Text style={styles.headerTitle}>Vaccinations, Pregnancy &amp; Medication</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalPicker} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {animals.map(a => (
          <TouchableOpacity key={a.id} style={[styles.animalChip, String(a.id) === selectedAnimalId && styles.animalChipActive]} onPress={() => setSelectedAnimalId(String(a.id))} activeOpacity={0.8}>
            <Text style={[styles.animalChipText, String(a.id) === selectedAnimalId && { color: '#fff' }]}>{a.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {feedback ? <Text style={styles.feedbackBanner}>{feedback}</Text> : null}

      {selectedAnimal && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* Info tabs */}
          <View style={styles.tabRow}>
            {[{ id: 'lifecycle', label: 'Age & Weaning' }, { id: 'pregnancy', label: 'Pregnancy' }, { id: 'breed', label: 'Breed' }].map(t => (
              <TouchableOpacity key={t.id} style={[styles.infoTabBtn, activeInfoTab === t.id && styles.infoTabBtnActive]} onPress={() => setActiveInfoTab(t.id)} activeOpacity={0.8}>
                <Text style={[styles.infoTabText, activeInfoTab === t.id && styles.infoTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            {activeInfoTab === 'lifecycle' && (
              stats ? (
                <>
                  <InfoRow label="Current Age" value={stats.ageDisplay} />
                  <InfoRow label="Weaning Status" value={stats.isWeaned ? 'Weaned' : 'Not yet weaned'} sub={stats.isWeaned ? stats.weaningDate : `${stats.daysUntilWeaning} days remaining`} />
                  <InfoRow label="Weaning Age" value={`${HEALTH_PROTOCOLS[selectedAnimal.species]?.weaningAge} days`} />
                  <InfoRow label="Gestation Period" value={`${HEALTH_PROTOCOLS[selectedAnimal.species]?.gestation} days`} />
                </>
              ) : <Text style={styles.emptyInline}>No birth date on record — set one in Herd Registry.</Text>
            )}

            {activeInfoTab === 'pregnancy' && (
              <>
                <Text style={styles.formLabel}>Mating / Insemination Date</Text>
                <TextInput style={styles.formInput} placeholder="YYYY-MM-DD" value={gestationStart} onChangeText={handleSetMatingDate} placeholderTextColor="#bbb" />
                {matingSaving ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} /> : null}
                {gestation && (
                  <View style={[styles.gestationBox, gestation.isOverdue && { backgroundColor: '#F6D9D5', borderColor: '#EAB0A9' }, gestation.isUrgent && { backgroundColor: '#F7E1CE', borderColor: '#EDBF9C' }]}>
                    <Baby size={16} color={gestation.isOverdue ? '#9A2A23' : gestation.isUrgent ? '#71360B' : COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gestationDate}>Expected: {gestation.date}</Text>
                      <Text style={styles.gestationSub}>
                        {gestation.isOverdue ? 'Overdue' : `${gestation.daysRemaining} days remaining`} · {gestation.period}-day gestation
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {activeInfoTab === 'breed' && (
              <>
                <Text style={styles.formLabel}>Registered Breed</Text>
                <Text style={styles.breedName}>{selectedAnimal.breed || 'Not recorded'}</Text>
                {breedInfo ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={styles.breedStat}><Text style={styles.breedStatLabel}>Origin</Text><Text style={styles.breedStatValue}>{breedInfo.origin}</Text></View>
                      <View style={styles.breedStat}><Text style={styles.breedStatLabel}>Mature Weight</Text><Text style={styles.breedStatValue}>{breedInfo.mature_weight_kg} kg</Text></View>
                    </View>
                    {breedInfo.heat_tolerance ? (
                      <View style={[styles.breedStat, { marginTop: 10 }]}>
                        <Text style={styles.breedStatLabel}>Heat Tolerance</Text>
                        <Text style={styles.breedStatValue}>{breedInfo.heat_tolerance}</Text>
                      </View>
                    ) : null}
                    <View style={styles.breedNote}>
                      <Info size={13} color={COLORS.primary} />
                      <Text style={styles.breedNoteText}>{breedInfo.notes}</Text>
                    </View>
                  </>
                ) : <Text style={styles.emptyInline}>No breed profile found. Update the animal's breed in Herd Registry.</Text>}
              </>
            )}
          </View>

          {/* Vet recommendations */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FlaskConical size={15} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Vet Recommendations</Text>
            </View>
            <Text style={styles.cardDesc}>Prescribed by a vet, not picked by you — administer from your Medicine Cabinet below.</Text>
            {recommendations.length === 0 ? (
              <Text style={styles.emptyInline}>No recommendations yet.</Text>
            ) : recommendations.map(rec => {
              const cabinetItem = inventory.find(i => i.name === rec.medicine_name);
              const canAdminister = rec.status === 'pending' && cabinetItem && cabinetItem.stock >= rec.dose_ml;
              return (
                <View key={rec.id} style={styles.recRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recName}>{rec.medicine_name} · {rec.dose_ml}ml</Text>
                    <Text style={styles.recSub}>Dr. {rec.vet_name}{rec.frequency ? ` · ${rec.frequency}` : ''}</Text>
                    {rec.status !== 'pending' ? <Text style={styles.recStatus}>{rec.status}</Text> : !cabinetItem ? (
                      <Text style={styles.recWarn}>Not in your Medicine Cabinet — order it from a Supplier.</Text>
                    ) : !canAdminister ? <Text style={styles.recWarn}>Not enough stock in your cabinet.</Text> : null}
                  </View>
                  {rec.status === 'pending' && (
                    <TouchableOpacity style={[styles.administerBtn, !canAdminister && { opacity: 0.4 }]} onPress={() => administerRecommendation(rec)} disabled={!canAdminister || administeringId === rec.id} activeOpacity={0.8}>
                      {administeringId === rec.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.administerBtnText}>Administer</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Vaccination & dipping schedule */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={15} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Vaccination &amp; Dipping Schedule</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLogForm(p => !p)}><Text style={styles.addLink}>+ Log Other</Text></TouchableOpacity>
            </View>
            <Text style={styles.cardDesc}>{overdueCount} overdue · {dueSoonCount} due soon</Text>

            {showLogForm && (
              <View style={styles.inlineForm}>
                <TextInput style={styles.formInput} placeholder="Event (e.g. Deworming)" value={logForm.eventType} onChangeText={v => setLogForm(p => ({ ...p, eventType: v }))} placeholderTextColor="#bbb" />
                <TextInput style={styles.formInput} placeholder="Date (YYYY-MM-DD, optional — defaults to today)" value={logForm.eventDate} onChangeText={v => setLogForm(p => ({ ...p, eventDate: v }))} placeholderTextColor="#bbb" />
                <TextInput style={styles.formInput} placeholder="Next due (YYYY-MM-DD, optional)" value={logForm.nextDueDate} onChangeText={v => setLogForm(p => ({ ...p, nextDueDate: v }))} placeholderTextColor="#bbb" />
                <TextInput style={styles.formInput} placeholder="Notes (optional)" value={logForm.notes} onChangeText={v => setLogForm(p => ({ ...p, notes: v }))} placeholderTextColor="#bbb" />
                <TouchableOpacity style={styles.smallSubmitBtn} onPress={handleLogCustomEvent} activeOpacity={0.8}>
                  <Text style={styles.smallSubmitText}>Log Event</Text>
                </TouchableOpacity>
              </View>
            )}

            {schedule.length === 0 ? (
              <Text style={styles.emptyInline}>No birth date on record — no schedule to generate.</Text>
            ) : schedule.map(task => {
              const sc = STATUS_COLOR[task.status];
              return (
                <View key={task.name} style={[styles.taskRow, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                  <View style={[styles.taskDot, { backgroundColor: sc.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskName}>{task.name}</Text>
                    <Text style={[styles.taskSub, { color: sc.text }]}>{task.status} · due {task.dueDate}</Text>
                    {task.notes ? <Text style={styles.taskNotes}>{task.notes}</Text> : null}
                  </View>
                  {task.status !== 'Completed' && (
                    <TouchableOpacity style={styles.doneBtn} onPress={() => handleCompleteTask(task)} activeOpacity={0.8}>
                      <CheckCircle size={12} color="#fff" />
                      <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Medicine cabinet */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Package size={15} color={COLORS.gold} />
              <Text style={styles.cardTitle}>Medicine Cabinet</Text>
            </View>
            <Text style={styles.cardDesc}>Your stock — order more from a Supplier in the Marketplace before it runs low.</Text>
            {inventory.length === 0 ? (
              <Text style={styles.emptyInline}>Nothing in your cabinet yet.</Text>
            ) : inventory.map(item => {
              const isLow = item.stock <= item.min;
              return (
                <View key={item.id} style={[styles.medRow, isLow && { backgroundColor: '#F6D9D5', borderColor: '#EAB0A9' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.medName}>{item.name}</Text>
                    <Text style={styles.medStock}>{item.stock.toFixed(0)} {item.unit}</Text>
                  </View>
                  <Text style={styles.medMin}>Min: {item.min} {item.unit}{isLow ? ' · Low — reorder' : ''}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const InfoRow = ({ label, value, sub }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={styles.infoRowValue}>{value}</Text>
      {sub ? <Text style={styles.infoRowSub}>{sub}</Text> : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, paddingBottom: 20 },
  headerEyebrow: { color: '#DEC9AE', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 19, fontFamily: FONTS.extrabold },

  animalPicker:  { backgroundColor: COLORS.primary, paddingBottom: 16 },
  animalChip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)' },
  animalChipActive: { backgroundColor: '#fff' },
  animalChipText:{ fontSize: 12, fontFamily: FONTS.extrabold, color: '#fff' },

  feedbackBanner: { fontSize: 11, fontFamily: FONTS.extrabold, color: '#465032', backgroundColor: COLORS.sproutBg, borderWidth: 1, borderColor: '#C9D2B4', margin: 16, marginBottom: 0, padding: 10, borderRadius: 12 },

  emptyTitle: { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.text, marginTop: 12, textAlign: 'center' },
  emptyDesc:  { fontSize: 12, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  emptyInline:{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic', paddingVertical: 10 },

  tabRow:        { flexDirection: 'row', gap: 4, backgroundColor: '#fff', borderRadius: 14, padding: 4, marginBottom: 14, elevation: 2 },
  infoTabBtn:    { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  infoTabBtnActive: { backgroundColor: COLORS.primary },
  infoTabText:   { fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', color: COLORS.muted },
  infoTabTextActive: { color: '#fff' },

  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
  cardTitle: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.text },
  cardDesc:  { fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 16 },

  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  infoRowLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted },
  infoRowValue: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  infoRowSub:   { fontSize: 10, color: COLORS.muted, marginTop: 1 },

  formLabel: { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formInput: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, fontSize: 13, color: COLORS.text, marginBottom: 8 },

  gestationBox: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: COLORS.light, borderRadius: 14, padding: 12, marginTop: 4 },
  gestationDate:{ fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  gestationSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  breedName:   { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.text, marginBottom: 4 },
  breedStat:   { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10 },
  breedStatLabel: { fontSize: 9, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase' },
  breedStatValue: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text, marginTop: 2 },
  breedNote:   { flexDirection: 'row', gap: 8, backgroundColor: COLORS.light, borderRadius: 12, padding: 10, marginTop: 10 },
  breedNoteText: { flex: 1, fontSize: 11, color: '#465032', lineHeight: 16 },

  recRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bg, borderRadius: 14, padding: 12, marginBottom: 8 },
  recName:    { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  recSub:     { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  recStatus:  { fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase', marginTop: 3 },
  recWarn:    { fontSize: 10, fontFamily: FONTS.bold, color: '#9A2A23', marginTop: 3 },
  administerBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  administerBtnText: { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold },

  addLink: { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.primary, textTransform: 'uppercase' },
  inlineForm: { backgroundColor: COLORS.bg, borderRadius: 14, padding: 10, marginBottom: 12 },
  smallSubmitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  smallSubmitText: { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  taskRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1 },
  taskDot:  { width: 9, height: 9, borderRadius: 5 },
  taskName: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  taskSub:  { fontSize: 10, fontFamily: FONTS.bold, textTransform: 'uppercase', marginTop: 2 },
  taskNotes:{ fontSize: 10, color: COLORS.muted, marginTop: 2 },
  doneBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  doneBtnText: { color: '#fff', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },

  medRow:  { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  medName: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  medStock:{ fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text },
  medMin:  { fontSize: 10, color: COLORS.muted, marginTop: 3 },
});
