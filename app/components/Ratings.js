import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Star, X, BadgeCheck, Handshake, Calendar, ShieldCheck } from 'lucide-react-native';

import { COLORS, FONTS } from '../config';
import { authFetch, authJson } from '../api';

// Mobile mirror of src/components/Ratings/Ratings.jsx. Every rating is tied
// to a real completed deal (enforced by the backend's _rateable_deals), and
// an average only shows once a user has enough ratings to mean something.

const CONTEXT_LABEL = { sale: 'Livestock sale', order: 'Supply order', vet_request: 'Vet visit', transfer: 'Animal transfer' };
const RATEABLE_ROLES = ['Farmer', 'Buyer', 'Supplier', 'Veterinarian'];
const AMBER = '#E0A526';

export const Stars = ({ value, size = 12 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={size} color={i <= Math.round(value) ? AMBER : COLORS.border} fill={i <= Math.round(value) ? AMBER : COLORS.border} />
    ))}
  </View>
);

export const RatingBadge = ({ rating, onPress }) => {
  const count = rating?.count || 0;
  const body = rating?.average != null ? (
    <View style={s.badgeRow}>
      <Star size={11} color={AMBER} fill={AMBER} />
      <Text style={s.badgeAvg}>{rating.average.toFixed(1)}</Text>
      <Text style={s.badgeMuted}>({count})</Text>
    </View>
  ) : (
    <Text style={s.badgeMuted}>{count ? `New · ${count} rating${count !== 1 ? 's' : ''}` : 'No ratings yet'}</Text>
  );
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{body}</TouchableOpacity> : body;
};

const StarPicker = ({ value, onChange }) => (
  <View style={{ flexDirection: 'row', gap: 4 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <TouchableOpacity key={i} onPress={() => onChange(i)} accessibilityLabel={`${i} star${i !== 1 ? 's' : ''}`} hitSlop={6}>
        <Star size={26} color={i <= value ? AMBER : COLORS.muted} fill={i <= value ? AMBER : 'transparent'} />
      </TouchableOpacity>
    ))}
  </View>
);

const Signal = ({ icon: Icon, label, value, good }) => (
  <View style={s.signal}>
    <View style={s.badgeRow}><Icon size={11} color={COLORS.muted} /><Text style={s.signalLabel}>{label}</Text></View>
    <Text style={[s.signalValue, good && { color: '#3F7A3A' }]}>{value}</Text>
  </View>
);

export const TrustProfileModal = ({ visible, userId, name, currentUser, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const isSelf = currentUser?.id === userId;

  const load = useCallback(async () => {
    if (!userId) return;
    setData(null); setError(null);
    try {
      const res = await authFetch(currentUser, `/users/${userId}/ratings`);
      if (res.ok) setData(await res.json());
      else setError('Ratings are not available for this account.');
    } catch { setError('Could not reach the PFUMA/INGCEBO server.'); }
  }, [userId, currentUser]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const postReply = async (ratingId) => {
    const reply = (replyDrafts[ratingId] || '').trim();
    if (!reply) return;
    const { ok, data: d } = await authJson(currentUser, `/ratings/${ratingId}/reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply }),
    });
    if (!ok) { Alert.alert('Could not post reply', d.error || 'Try again.'); return; }
    load();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle} numberOfLines={1}>{isSelf ? 'Your trust profile' : name}</Text>
              <Text style={s.muted}>Ratings come only from completed deals</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={COLORS.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {error && <Text style={s.muted}>{error}</Text>}
            {!data && !error && <ActivityIndicator color={COLORS.primary} />}
            {data && (
              <>
                {data.average != null ? (
                  <View style={[s.badgeRow, { gap: 12 }]}>
                    <Text style={s.bigAvg}>{data.average.toFixed(1)}</Text>
                    <View><Stars value={data.average} size={16} /><Text style={s.muted}>{data.count} rating{data.count !== 1 ? 's' : ''}</Text></View>
                  </View>
                ) : (
                  <Text style={s.muted}>
                    {data.count ? `${data.count} rating${data.count !== 1 ? 's' : ''} so far` : 'No ratings yet'} — an average is shown after {data.min_ratings_for_average} ratings.
                  </Text>
                )}
                <View style={s.signalGrid}>
                  <Signal icon={BadgeCheck} label="Identity" value={data.verified ? 'Verified' : 'Pending'} good={data.verified} />
                  <Signal icon={Handshake} label="Completed deals" value={String(data.completed_trades)} good={data.completed_trades > 0} />
                  <Signal icon={Calendar} label="Member since" value={data.member_since || '—'} />
                  {data.clearance_pass_rate != null && (
                    <Signal icon={ShieldCheck} label="Police clearance" value={`${data.clearance_pass_rate}% cleared`} good={data.clearance_pass_rate >= 80} />
                  )}
                </View>
                <Text style={s.sectionLabel}>REVIEWS</Text>
                {data.reviews.length === 0 ? <Text style={s.muted}>No reviews yet.</Text> : data.reviews.map(r => (
                  <View key={r.id} style={s.review}>
                    <View style={[s.badgeRow, { justifyContent: 'space-between' }]}>
                      <Stars value={r.stars} />
                      <Text style={s.small}>{CONTEXT_LABEL[r.context_type]} · {new Date(r.created_at).toLocaleDateString()}</Text>
                    </View>
                    {r.comment ? <Text style={s.body}>{r.comment}</Text> : null}
                    <Text style={s.small}>— {r.rater_name}, {r.rater_role}</Text>
                    {r.reply ? (
                      <View style={s.reply}><Text style={s.small}>REPLY</Text><Text style={s.body}>{r.reply}</Text></View>
                    ) : isSelf ? (
                      <View style={[s.badgeRow, { marginTop: 8 }]}>
                        <TextInput value={replyDrafts[r.id] || ''} onChangeText={t => setReplyDrafts(p => ({ ...p, [r.id]: t }))}
                          maxLength={500} placeholder="Reply publicly (once)…" placeholderTextColor={COLORS.muted} style={[s.input, { flex: 1 }]} />
                        <TouchableOpacity style={s.smallBtn} onPress={() => postReply(r.id)}><Text style={s.smallBtnText}>Reply</Text></TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Dashboard card: own rating at a glance + "rate this deal" for every
// completed deal not yet rated.
export const RatingsDashboardCard = ({ currentUser }) => {
  const [pending, setPending] = useState([]);
  const [mine, setMine] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const eligible = RATEABLE_ROLES.includes(currentUser?.role);

  const load = useCallback(async () => {
    if (!eligible) return;
    try {
      const [p, m] = await Promise.all([
        authFetch(currentUser, '/ratings/pending'),
        authFetch(currentUser, `/users/${currentUser.id}/ratings`),
      ]);
      if (p.ok) setPending(await p.json());
      if (m.ok) setMine(await m.json());
    } catch { /* offline — card stays empty */ }
  }, [eligible, currentUser]);

  useEffect(() => { load(); }, [load]);

  if (!eligible) return null;

  const submit = async (deal) => {
    const key = `${deal.context_type}-${deal.context_id}`;
    const draft = drafts[key] || {};
    if (!draft.stars) return;
    setBusyKey(key);
    const { ok, data } = await authJson(currentUser, '/ratings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_type: deal.context_type, context_id: deal.context_id, stars: draft.stars, comment: draft.comment || '' }),
    });
    setBusyKey(null);
    if (!ok) Alert.alert('Could not save rating', data.error || 'Try again.');
    load();
  };

  return (
    <View style={s.card}>
      <View style={[s.badgeRow, { justifyContent: 'space-between' }]}>
        <View style={s.badgeRow}>
          <Star size={15} color={AMBER} fill={AMBER} />
          <Text style={s.cardTitle}>YOUR TRUST RATING</Text>
          {mine && <RatingBadge rating={mine} />}
        </View>
        <TouchableOpacity onPress={() => setShowProfile(true)}><Text style={s.link}>Reviews</Text></TouchableOpacity>
      </View>

      {pending.length > 0 && (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={s.muted}>Rate your recent deals — ratings help honest traders stand out.</Text>
          {pending.map(deal => {
            const key = `${deal.context_type}-${deal.context_id}`;
            const draft = drafts[key] || {};
            return (
              <View key={key} style={s.review}>
                <Text style={s.bodyBold}>{deal.counterparty_name} <Text style={s.small}>· {deal.counterparty_role}</Text></Text>
                <Text style={s.small}>{CONTEXT_LABEL[deal.context_type]}: {deal.label}</Text>
                <View style={{ marginTop: 8 }}>
                  <StarPicker value={draft.stars || 0} onChange={st => setDrafts(p => ({ ...p, [key]: { ...draft, stars: st } }))} />
                </View>
                <TextInput value={draft.comment || ''} onChangeText={t => setDrafts(p => ({ ...p, [key]: { ...draft, comment: t } }))}
                  maxLength={500} placeholder="Optional comment" placeholderTextColor={COLORS.muted} style={[s.input, { marginTop: 8 }]} />
                <TouchableOpacity style={[s.submitBtn, !draft.stars && { opacity: 0.4 }]} disabled={!draft.stars || busyKey === key} onPress={() => submit(deal)}>
                  <Text style={s.submitText}>{busyKey === key ? 'Saving…' : 'Submit rating'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TrustProfileModal visible={showProfile} userId={currentUser.id} currentUser={currentUser}
        onClose={() => { setShowProfile(false); load(); }} />
    </View>
  );
};

const s = StyleSheet.create({
  badgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeAvg:    { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.text },
  badgeMuted:  { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.muted },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  sheetTitle:  { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.text },
  bigAvg:      { fontFamily: FONTS.extrabold, fontSize: 36, color: COLORS.text },
  muted:       { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.muted },
  small:       { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.muted },
  body:        { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.text, marginTop: 4 },
  bodyBold:    { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.text },
  sectionLabel:{ fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary, letterSpacing: 0.8 },
  signalGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signal:      { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, width: '48%' },
  signalLabel: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.muted, textTransform: 'uppercase' },
  signalValue: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.text, marginTop: 2 },
  review:      { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  reply:       { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: COLORS.border },
  input:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.text },
  smallBtn:    { backgroundColor: COLORS.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  smallBtnText:{ fontFamily: FONTS.bold, fontSize: 12, color: '#fff' },
  card:        { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 14 },
  cardTitle:   { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.text, letterSpacing: 0.8, marginRight: 4 },
  link:        { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.primary },
  submitBtn:   { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  submitText:  { fontFamily: FONTS.bold, fontSize: 13, color: '#fff' },
});
