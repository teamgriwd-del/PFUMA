import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import {
  Stethoscope, Search, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronUp,
  Leaf, ClipboardList, Phone, RotateCcw,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';
import { diseaseDatabase, symptomCategories } from '../data/diseaseData';

const SEVERITY_COLOR = {
  Critical: { bg: '#F6D9D5', text: '#9A2A23' },
  Warning:  { bg: '#F6E9CF', text: '#8C632A' },
  Notice:   { bg: COLORS.tealBg, text: COLORS.teal },
};

function ConfidenceExplainer({ value, matched, total }) {
  const color = value >= 70 ? '#57633E' : value >= 40 ? '#A65312' : '#AE7F35';
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={styles.confBarTrack}>
        <View style={[styles.confBarFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.confText}>{value}% confidence · {matched} of {total} known symptoms matched</Text>
    </View>
  );
}

export default function DiseaseDetectionScreen({ currentUser, navigation }) {
  const [animals, setAnimals] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [diagnosisResults, setDiagnosisResults] = useState([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [targetAnimalId, setTargetAnimalId] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('action');
  const [savedFeedback, setSavedFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const feedbackTimer = useRef(null);

  useEffect(() => {
    if (!currentUser?.token) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/animals');
        if (res.ok) setAnimals(await res.json());
      } catch { /* offline */ }
    })();
  }, [currentUser?.token]);

  const toggleSymptom = (s) => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const analyzeSymptoms = () => {
    if (!selectedSymptoms.length) return;
    const results = diseaseDatabase.map(d => {
      let score = 0, maxScore = 0, matchedCount = 0;
      const totalSymptoms = d.symptoms.primary.length + d.symptoms.secondary.length;
      d.symptoms.primary.forEach(s => { maxScore += 10; if (selectedSymptoms.includes(s)) { score += 10; matchedCount++; } });
      d.symptoms.secondary.forEach(s => { maxScore += 5; if (selectedSymptoms.includes(s)) { score += 5; matchedCount++; } });
      const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      return { ...d, confidence, matchedCount, totalSymptoms };
    }).filter(r => r.confidence > 20).sort((a, b) => b.confidence - a.confidence);

    setDiagnosisResults(results);
    setHasAnalyzed(true);
    setExpandedId(results[0]?.id ?? null);
    setActiveTab('action');
  };

  const saveToHistory = async (diseaseName) => {
    const id = parseInt(targetAnimalId, 10);
    const animal = animals.find(a => a.id === id);
    if (!animal) return;
    setSaving(true);
    const { ok, data } = await authJson(currentUser, '/health-events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animal_id: animal.id, event_type: `Diagnostic: ${diseaseName}`,
        notes: `Symptoms: ${selectedSymptoms.join(', ') || 'none selected'}`,
      }),
    });
    setSaving(false);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setSavedFeedback(ok ? `Saved to ${animal.name}'s health record.` : (data.error || 'Could not save — try again.'));
    feedbackTimer.current = setTimeout(() => setSavedFeedback(null), 3000);
  };

  const resetAll = () => {
    setSelectedSymptoms([]); setDiagnosisResults([]); setHasAnalyzed(false);
    setExpandedId(null); setSavedFeedback(null); setSearch('');
  };

  const filteredCategories = symptomCategories.map(cat => ({
    ...cat,
    symptoms: cat.symptoms.filter(s => !search || s.toLowerCase().includes(search.toLowerCase())),
  })).filter(cat => cat.symptoms.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Stethoscope size={16} color="#EDD5A6" />
          <Text style={styles.headerEyebrow}>AI Disease Checker</Text>
        </View>
        <Text style={styles.headerTitle}>Symptom Diagnostics</Text>
        <Text style={styles.headerDesc}>Tick every symptom you can see. The checker scores them against 10 known livestock diseases and names the most likely match, with an action plan.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={styles.cardTitle}>Tick every symptom you can see</Text>
            <Text style={styles.selectedCount}>{selectedSymptoms.length} selected</Text>
          </View>
          <Text style={styles.cardDesc}>Check all symptoms that apply — more symptoms means a more accurate result.</Text>

          <View style={styles.searchBox}>
            <Search size={14} color={COLORS.muted} />
            <TextInput style={styles.searchInput} placeholder="Search symptoms..." value={search} onChangeText={setSearch} placeholderTextColor="#bbb" />
          </View>

          {filteredCategories.length === 0 ? (
            <Text style={styles.emptyInline}>No symptoms match "{search}"</Text>
          ) : filteredCategories.map(cat => (
            <View key={cat.name} style={{ marginTop: 12 }}>
              <Text style={styles.catName}>{cat.name}</Text>
              <View style={styles.chipWrap}>
                {cat.symptoms.map(symptom => {
                  const ticked = selectedSymptoms.includes(symptom);
                  return (
                    <TouchableOpacity key={symptom} style={[styles.chip, ticked && styles.chipActive]} onPress={() => toggleSymptom(symptom)} activeOpacity={0.8}>
                      <Text style={[styles.chipText, ticked && styles.chipTextActive]}>{symptom}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TouchableOpacity
              style={[styles.runBtn, !selectedSymptoms.length && { opacity: 0.4 }]}
              onPress={analyzeSymptoms} disabled={!selectedSymptoms.length} activeOpacity={0.8}
            >
              <Stethoscope size={15} color="#fff" />
              <Text style={styles.runBtnText}>{hasAnalyzed ? 'Re-run Analysis' : 'Run Diagnosis'}</Text>
            </TouchableOpacity>
            {(selectedSymptoms.length > 0 || hasAnalyzed) && (
              <TouchableOpacity style={styles.resetBtn} onPress={resetAll} activeOpacity={0.8}>
                <RotateCcw size={14} color={COLORS.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {hasAnalyzed && (
          <View>
            <Text style={styles.resultsHeading}>Diagnosis Results — {diagnosisResults.length} possible match{diagnosisResults.length !== 1 ? 'es' : ''}</Text>

            {savedFeedback ? <Text style={styles.savedFeedback}>{savedFeedback}</Text> : null}

            {diagnosisResults.length === 0 ? (
              <View style={styles.emptyCard}>
                <Info size={26} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No disease matched above 20% confidence.</Text>
                <Text style={styles.emptyDesc}>Try selecting more symptoms, or consult a vet directly.</Text>
              </View>
            ) : diagnosisResults.map((res, i) => {
              const sv = SEVERITY_COLOR[res.severity] || SEVERITY_COLOR.Notice;
              const open = i === 0 || expandedId === res.id;
              return (
                <View key={res.id} style={[styles.resultCard, i === 0 && styles.resultCardTop]}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {i === 0 && <View style={styles.topBadge}><Text style={styles.topBadgeText}>Top Match</Text></View>}
                    <View style={[styles.sevBadge, { backgroundColor: sv.bg }]}><Text style={[styles.sevBadgeText, { color: sv.text }]}>{res.severity}</Text></View>
                    {res.quarantineRequired && (
                      <View style={styles.quarantineBadge}>
                        <AlertTriangle size={9} color="#71360B" />
                        <Text style={styles.quarantineBadgeText}>Quarantine</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.resultName}>{res.name}</Text>
                  <Text style={styles.resultAffects}>Affects: {res.affectedSpecies.join(', ')}</Text>
                  <ConfidenceExplainer value={res.confidence} matched={res.matchedCount} total={res.totalSymptoms} />

                  {i > 0 && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }} onPress={() => setExpandedId(expandedId === res.id ? null : res.id)} activeOpacity={0.8}>
                      {expandedId === res.id ? <ChevronUp size={13} color={COLORS.muted} /> : <ChevronDown size={13} color={COLORS.muted} />}
                      <Text style={styles.expandToggle}>{expandedId === res.id ? 'Hide details' : 'Show first steps'}</Text>
                    </TouchableOpacity>
                  )}

                  {open && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                      {animals.length > 0 && i === 0 && (
                        <View style={styles.saveRow}>
                          <ClipboardList size={13} color={COLORS.primary} />
                          <Text style={styles.saveLabel}>Save to:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                            {animals.map(a => (
                              <TouchableOpacity key={a.id} style={[styles.animalPick, targetAnimalId === String(a.id) && styles.animalPickActive]} onPress={() => setTargetAnimalId(String(a.id))} activeOpacity={0.8}>
                                <Text style={[styles.animalPickText, targetAnimalId === String(a.id) && { color: '#fff' }]}>{a.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          {targetAnimalId ? (
                            <TouchableOpacity style={styles.saveBtn} onPress={() => saveToHistory(res.name)} disabled={saving} activeOpacity={0.8}>
                              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'action' && styles.tabBtnActive]} onPress={() => setActiveTab('action')} activeOpacity={0.8}>
                          <Text style={[styles.tabBtnText, activeTab === 'action' && styles.tabBtnTextActive]}>Action Plan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'prevention' && styles.tabBtnActive]} onPress={() => setActiveTab('prevention')} activeOpacity={0.8}>
                          <Leaf size={11} color={activeTab === 'prevention' ? '#fff' : COLORS.muted} />
                          <Text style={[styles.tabBtnText, activeTab === 'prevention' && styles.tabBtnTextActive]}>Prevention</Text>
                        </TouchableOpacity>
                      </View>

                      {(activeTab === 'action' ? res.actionPlan : res.preventionTips).map((step, s) => (
                        <View key={s} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                          <View style={[styles.stepNum, activeTab === 'prevention' && { backgroundColor: COLORS.sproutBg }]}>
                            <Text style={[styles.stepNumText, activeTab === 'prevention' && { color: '#465032' }]}>{s + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}

                      {res.severity === 'Critical' && (
                        <TouchableOpacity style={styles.vetBtn} activeOpacity={0.8} onPress={() => navigation?.navigate('Vet')}>
                          <Phone size={16} color="#fff" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.vetBtnTitle}>Contact a vet now</Text>
                            <Text style={styles.vetBtnSub}>Go to Messenger — this is a critical-severity match</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { backgroundColor: COLORS.slate, padding: 24, paddingTop: 56, paddingBottom: 24 },
  headerEyebrow: { color: '#EDD5A6', fontSize: 10, fontFamily: FONTS.extrabold, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle:   { color: '#fff', fontSize: 20, fontFamily: FONTS.extrabold, marginBottom: 6 },
  headerDesc:    { color: 'rgba(247,243,237,0.65)', fontSize: 12, lineHeight: 18 },

  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
  cardTitle: { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.text },
  cardDesc:  { fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 17 },
  selectedCount: { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.primary },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: COLORS.text },

  emptyInline: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  catName:     { fontSize: 10, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.muted },
  chipTextActive: { color: '#fff' },

  runBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14 },
  runBtnText: { color: '#fff', fontSize: 12, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },
  resetBtn:   { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, borderRadius: 16 },

  resultsHeading: { fontSize: 12, fontFamily: FONTS.extrabold, color: COLORS.text, marginBottom: 10, marginTop: 4 },
  savedFeedback:  { fontSize: 11, fontFamily: FONTS.extrabold, color: '#465032', backgroundColor: COLORS.sproutBg, borderWidth: 1, borderColor: '#C9D2B4', borderRadius: 12, padding: 10, marginBottom: 10 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyTitle:{ fontSize: 13, fontFamily: FONTS.extrabold, color: COLORS.muted, marginTop: 10, textAlign: 'center' },
  emptyDesc: { fontSize: 11, color: COLORS.muted, marginTop: 4, textAlign: 'center' },

  resultCard:    { backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, borderColor: COLORS.border, padding: 16, marginBottom: 12 },
  resultCardTop: { borderColor: COLORS.primary },
  topBadge:      { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  topBadgeText:  { color: '#fff', fontSize: 9, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },
  sevBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sevBadgeText:  { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: 'uppercase' },
  quarantineBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F7E1CE', borderWidth: 1, borderColor: '#EDBF9C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  quarantineBadgeText: { fontSize: 9, fontFamily: FONTS.extrabold, color: '#71360B', textTransform: 'uppercase' },

  resultName:    { fontSize: 17, fontFamily: FONTS.extrabold, color: COLORS.text, marginBottom: 2 },
  resultAffects: { fontSize: 11, color: COLORS.muted, marginBottom: 8 },
  confBarTrack:  { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden' },
  confBarFill:   { height: '100%', borderRadius: 3 },
  confText:      { fontSize: 10, color: COLORS.muted, fontFamily: FONTS.bold, marginTop: 4 },
  expandToggle:  { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.muted, textTransform: 'uppercase' },

  saveRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, marginBottom: 12 },
  saveLabel:   { fontSize: 11, fontFamily: FONTS.extrabold, color: COLORS.muted },
  animalPick:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#fff', marginRight: 6, borderWidth: 1, borderColor: COLORS.border },
  animalPickActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  animalPickText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.text },
  saveBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontSize: 11, fontFamily: FONTS.extrabold },

  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.bg },
  tabBtnActive:  { backgroundColor: COLORS.primary },
  tabBtnText:    { fontSize: 11, fontFamily: FONTS.extrabold, textTransform: 'uppercase', color: COLORS.muted },
  tabBtnTextActive: { color: '#fff' },

  stepNum:     { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 10, fontFamily: FONTS.extrabold },
  stepText:    { flex: 1, fontSize: 12, color: COLORS.muted, lineHeight: 18 },

  vetBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#9A2A23', borderRadius: 16, padding: 14, marginTop: 8 },
  vetBtnTitle: { color: '#fff', fontSize: 12, fontFamily: FONTS.extrabold },
  vetBtnSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 1 },
});
