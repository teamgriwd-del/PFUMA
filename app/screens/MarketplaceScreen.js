import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView, Linking, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  LayoutGrid, Beef, Wheat, Carrot, Pill, Wrench, X, Camera, Search,
  Package, MapPin, User, PhoneCall, ShoppingCart, Check,
} from 'lucide-react-native';
import { API, COLORS } from '../config';
import { authFetch, authJson } from '../api';

const CATEGORIES = [
  { id: 'all',       label: 'All',       icon: LayoutGrid },
  { id: 'livestock', label: 'Livestock', icon: Beef },
  { id: 'feed',      label: 'Feed',      icon: Wheat },
  { id: 'produce',   label: 'Produce',   icon: Carrot },
  { id: 'medicine',  label: 'Medicine',  icon: Pill },
  { id: 'equipment', label: 'Equipment', icon: Wrench },
];

const CAT_COLOR = {
  livestock: '#1b5e20', feed: '#e65100', produce: '#558b2f',
  medicine:  '#1565c0', equipment: '#6a1b9a', all: '#333',
};

const PostModal = ({ visible, onClose, onSubmit, error, animals = [] }) => {
  const [form, setForm] = useState({ product_name:'', category:'livestock', price:'', unit:'head', quantity:'1', location:'', description:'',
    animal_id:'', leader_clearance:'', leader_type:'Sabuku', leader_name:'', leader_village:'',
    leader_cleared_on:'', leader_reference:'', leader_na_reason:'' });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const filename = asset.uri.split('/').pop();
    const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
    setPhoto({ uri: asset.uri, name: filename, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  };

  const needsClearance = form.category === 'livestock' && !!form.animal_id;

  const submit = async () => {
    if (!form.product_name.trim() || !form.price) return;
    // The Sabuku/Mambo step comes before the police one, so a listing tied to a
    // registered animal cannot be submitted until it is answered either way.
    if (needsClearance && !form.leader_clearance) return;
    setSubmitting(true);
    const ok = await onSubmit(form, photo);
    setSubmitting(false);
    if (ok) { setForm({ product_name:'', category:'livestock', price:'', unit:'head', quantity:'1', location:'', description:'',
    animal_id:'', leader_clearance:'', leader_type:'Sabuku', leader_name:'', leader_village:'',
    leader_cleared_on:'', leader_reference:'', leader_na_reason:'' }); setPhoto(null); onClose(); }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post a Listing</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={COLORS.muted} /></TouchableOpacity>
          </View>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Camera size={18} color={COLORS.muted} />
                </View>
              )}
              <Text style={styles.photoPickerText}>{photo ? 'Change photo' : 'Upload a photo (optional)'}</Text>
            </TouchableOpacity>
            {[
              { label: 'Product Name *', key: 'product_name', ph: 'e.g. Brahman Bull, Soya Meal' },
              { label: 'Price (USD) *',  key: 'price',        ph: '0.00', kb: 'decimal-pad' },
              { label: 'Unit',           key: 'unit',         ph: 'head / kg / litre / unit' },
              { label: 'Quantity',       key: 'quantity',     ph: '1',    kb: 'numeric' },
              { label: 'Location',       key: 'location',     ph: 'e.g. Zvimba, Mashonaland West' },
              { label: 'Description',    key: 'description',  ph: 'Describe the item...', multi: true },
            ].map(f => (
              <View key={f.key} style={styles.formField}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput
                  style={[styles.formInput, f.multi && { height: 80, textAlignVertical: 'top' }]}
                  placeholder={f.ph} value={form[f.key]}
                  onChangeText={v => set(f.key, v)}
                  keyboardType={f.kb || 'default'}
                  multiline={!!f.multi}
                  placeholderTextColor="#bbb"
                />
              </View>
            ))}
            {form.category === 'livestock' && animals.length > 0 && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Which animal?</Text>
                <View style={styles.catRow}>
                  {animals.map(a => {
                    const active = String(form.animal_id) === String(a.id);
                    return (
                      <TouchableOpacity key={a.id} activeOpacity={0.8}
                        style={[styles.catChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                        onPress={() => {
                          const next = active ? '' : String(a.id);
                          set('animal_id', next);
                          if (next && !form.product_name.trim()) {
                            set('product_name', [a.name, a.breed, a.species].filter(Boolean).join(' '));
                          }
                        }}>
                        <Text style={[styles.catChipText, active && { color: '#fff' }]}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.helpText}>Linking a registered animal is what puts the sale through clearance. Leave it unselected only for stock that is not on your PFUMA register.</Text>
              </View>
            )}

            {needsClearance && (
              <View style={styles.clearBox}>
                <Text style={styles.clearTitle}>Traditional authority clearance *</Text>
                <Text style={styles.helpText}>In communal areas your Sabuku or Mambo clears the sale before the police do. If you farm on a title deed or lease with no traditional authority, say so instead.</Text>
                <View style={styles.catRow}>
                  {[['attested', 'Cleared by Sabuku / Mambo'], ['not_applicable', 'Does not apply to my farm']].map(opt => {
                    const active = form.leader_clearance === opt[0];
                    return (
                      <TouchableOpacity key={opt[0]} activeOpacity={0.8}
                        style={[styles.catChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                        onPress={() => set('leader_clearance', opt[0])}>
                        <Text style={[styles.catChipText, active && { color: '#fff' }]}>{opt[1]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.leader_clearance === 'attested' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Who cleared it *</Text>
                      <View style={styles.catRow}>
                        {['Sabuku', 'Mambo'].map(t => {
                          const active = form.leader_type === t;
                          return (
                            <TouchableOpacity key={t} activeOpacity={0.8}
                              style={[styles.catChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                              onPress={() => set('leader_type', t)}>
                              <Text style={[styles.catChipText, active && { color: '#fff' }]}>{t === 'Sabuku' ? 'Sabuku (village head)' : 'Mambo (chief)'}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    {[
                      { label: 'Their name *',      key: 'leader_name',       ph: 'e.g. Sabuku Nyathi' },
                      { label: 'Village / Ward',    key: 'leader_village',    ph: 'e.g. Nkayi Ward 7' },
                      { label: 'Date cleared',      key: 'leader_cleared_on', ph: 'YYYY-MM-DD' },
                      { label: 'Written reference', key: 'leader_reference',  ph: 'Optional' },
                    ].map(f => (
                      <View key={f.key} style={styles.formField}>
                        <Text style={styles.formLabel}>{f.label}</Text>
                        <TextInput style={styles.formInput} placeholder={f.ph} value={form[f.key]}
                          onChangeText={v => set(f.key, v)} placeholderTextColor="#bbb" />
                      </View>
                    ))}
                  </>
                )}

                {form.leader_clearance === 'not_applicable' && (
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Why it does not apply *</Text>
                    <TextInput style={styles.formInput} placeholder="e.g. A2 commercial farm on title deed"
                      value={form.leader_na_reason} onChangeText={v => set('leader_na_reason', v)} placeholderTextColor="#bbb" />
                    <Text style={styles.helpText}>The officer reviewing your listing will see this.</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.filter(c => c.id !== 'all').map(c => {
                  const active = form.category === c.id;
                  return (
                    <TouchableOpacity key={c.id} activeOpacity={0.8}
                      style={[styles.catChip, active && { backgroundColor: CAT_COLOR[c.id], borderColor: CAT_COLOR[c.id] }]}
                      onPress={() => set('category', c.id)}>
                      <c.icon size={13} color={active ? '#fff' : COLORS.muted} strokeWidth={2.2} />
                      <Text style={[styles.catChipText, active && { color: '#fff' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting} activeOpacity={0.8}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Check size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.submitText}>Post Listing</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Bids panel — only rendered for the listing's own owner. Lets them see
// pending bids and accept one, mirroring the web Marketplace.jsx flow.
const BidsPanel = ({ currentUser, listing, onAccepted }) => {
  const [open, setOpen] = useState(false);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await authFetch(currentUser, `/listings/${listing.id}/bids`);
      if (res.ok) setBids(await res.json());
    } catch { /* leave whatever was last loaded */ }
    setLoading(false);
  };

  const accept = async (bid) => {
    const { ok, data } = await authJson(currentUser, `/listings/${listing.id}/bids/${bid.id}/accept`, { method: 'PATCH' });
    if (!ok) { Alert.alert('Could not accept bid', data.error || 'Try again.'); return; }
    setOpen(false);
    onAccepted();
  };

  return (
    <View>
      <TouchableOpacity style={styles.bidsToggleBtn} onPress={toggle} activeOpacity={0.8}>
        <Text style={styles.bidsToggleText}>{open ? 'Hide Bids' : 'View Bids'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.bidsPanel}>
          {loading ? <ActivityIndicator color={COLORS.primary} /> : bids.length === 0 ? (
            <Text style={styles.bidsEmpty}>No bids yet on this listing.</Text>
          ) : bids.map(b => (
            <View key={b.id} style={styles.bidRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bidderName}>{b.bidder_name} · ${Number(b.amount).toLocaleString()}</Text>
                <Text style={styles.bidStatus}>{b.status}</Text>
              </View>
              {b.status === 'pending' && listing.status !== 'sold' && (
                <TouchableOpacity style={styles.acceptBtn} onPress={() => accept(b)} activeOpacity={0.8}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// A real uploaded photo is a relative /uploads/... path; anything else is
// already a usable URL.
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

export default function MarketplaceScreen({ currentUser }) {
  const [listings,   setListings]   = useState([]);
  const [myAnimals,  setMyAnimals]  = useState([]);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('all');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPost,   setShowPost]   = useState(false);
  const [postError,  setPostError]  = useState(null);
  const [bidTarget,  setBidTarget]  = useState(null); // listing being bid on
  const [bidAmount,  setBidAmount]  = useState('');
  const [orderTarget, setOrderTarget] = useState(null); // medicine/equipment listing being ordered
  const [orderQty,    setOrderQty]    = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const url = category === 'all' ? '/listings' : `/listings?category=${category}`;
      const res = await authFetch(currentUser, url);
      if (res.ok) setListings(await res.json());
    } catch { /* offline — leave whatever was last loaded, no fake fallback */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [category, currentUser?.token]);

  useEffect(() => { load(); }, [load]);

  // The seller's own register, so a listing can be tied to a real animal —
  // which is what triggers the clearance chain.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await authJson(currentUser, '/animals');
      if (!cancelled && ok && Array.isArray(data)) setMyAnimals(data);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.token]);

  const handlePost = async (form, photo) => {
    setPostError(null);
    let res, data;
    if (photo) {
      const fd = new FormData();
      // Append every populated field rather than a hand-listed subset — the old
      // list silently dropped animal_id, so a photo listing never reached
      // clearance at all.
      Object.keys(form).forEach(k => {
        const v = form[k];
        if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
      });
      fd.append('photo', photo);
      res = await authFetch(currentUser, '/listings', { method: 'POST', body: fd });
      data = await res.json().catch(() => ({}));
    } else {
      const payload = { ...form, price: parseFloat(form.price), quantity: parseFloat(form.quantity) };
      const result = await authJson(currentUser, '/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      res = { ok: result.ok }; data = result.data;
    }
    if (res.ok) {
      await load();
      return true;
    }
    setPostError(data.error || 'Could not post this listing — try again.');
    return false;
  };

  const openBidModal = (listing) => { setBidTarget(listing); setBidAmount(String(listing.price)); };

  const openOrderModal = (listing) => { setOrderTarget(listing); setOrderQty('1'); };

  const submitOrder = async () => {
    const qty = Number(orderQty);
    if (!orderQty || isNaN(qty) || qty <= 0) { Alert.alert('Enter a valid quantity.'); return; }
    const { ok, data } = await authJson(currentUser, '/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: orderTarget.id, quantity: qty }),
    });
    setOrderTarget(null);
    Alert.alert(ok ? 'Order placed' : 'Could not place order', ok ? `Order sent to ${orderTarget.seller_name} — they'll dispatch it soon.` : (data.error || 'Try again.'));
  };

  const submitBid = async () => {
    const amount = Number(bidAmount);
    if (!bidAmount || isNaN(amount) || amount <= 0) { Alert.alert('Enter a valid offer amount.'); return; }
    const { ok, data } = await authJson(currentUser, `/listings/${bidTarget.id}/bid`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }),
    });
    setBidTarget(null);
    Alert.alert(ok ? 'Bid sent' : 'Could not send bid', ok ? `USD ${amount.toLocaleString()} sent to ${bidTarget.seller_name}.` : (data.error || 'Try again.'));
  };

  const filtered = listings.filter(l =>
    (category === 'all' || l.category === category) &&
    (l.product_name?.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()))
  );

  const renderItem = ({ item }) => {
    const CatIcon = CATEGORIES.find(c => c.id === item.category)?.icon || LayoutGrid;
    return (
    <View style={[styles.card, { borderLeftColor: CAT_COLOR[item.category] || '#999', borderLeftWidth: 4 }]}>
      {item.photo_url ? <Image source={{ uri: resolveImageUrl(item.photo_url) }} style={styles.cardImage} /> : null}
      <View style={styles.cardHeader}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <CatIcon size={11} color={COLORS.muted} strokeWidth={2.2} />
            <Text style={styles.catBadge}>{item.category}</Text>
          </View>
          <Text style={styles.cardName}>{item.product_name}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={[styles.priceVal, { color: CAT_COLOR[item.category] }]}>
            ${Number(item.price).toLocaleString()}
          </Text>
          <Text style={styles.priceUnit}>/{item.unit}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.cardMeta}>
        <View style={styles.metaRow}><Package size={12} color={COLORS.muted} /><Text style={styles.metaText}>{item.quantity} {item.unit}</Text></View>
        <View style={styles.metaRow}><MapPin size={12} color={COLORS.muted} /><Text style={styles.metaText}>{item.location}</Text></View>
        <View style={styles.metaRow}><User size={12} color={COLORS.muted} /><Text style={styles.metaText}>{item.seller_name}</Text></View>
      </View>
      <View style={styles.cardActions}>
        {item.phone ? (
          <TouchableOpacity style={[styles.callBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} onPress={() => Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.8}>
            <PhoneCall size={13} color={COLORS.text} />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.bidBtn, { backgroundColor: CAT_COLOR[item.category] || COLORS.primary }]} onPress={() => item.category !== 'livestock' && currentUser?.role === 'Farmer' ? openOrderModal(item) : openBidModal(item)} activeOpacity={0.8}>
          <Text style={styles.bidBtnText}>{item.category !== 'livestock' && currentUser?.role === 'Farmer' ? 'Order →' : currentUser?.role === 'Retailer' ? 'Bid →' : 'Enquire →'}</Text>
        </TouchableOpacity>
      </View>
      {item.user_id === currentUser?.id && (
        <BidsPanel currentUser={currentUser} listing={item} onAccepted={load} />
      )}
    </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Agri Marketplace</Text>
          <Text style={styles.headerDesc}>Livestock · Feed · Medicine · Equipment</Text>
        </View>
        <TouchableOpacity style={styles.postBtn} onPress={() => setShowPost(true)} activeOpacity={0.8}>
          <Text style={styles.postBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search listings..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map(c => {
          const active = category === c.id;
          return (
            <TouchableOpacity key={c.id} activeOpacity={0.8}
              style={[styles.catTab, active && { backgroundColor: CAT_COLOR[c.id] || '#333' }]}
              onPress={() => setCategory(c.id)}>
              <c.icon size={13} color={active ? '#fff' : COLORS.text} strokeWidth={2.2} />
              <Text style={[styles.catTabText, active && { color: '#fff' }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} /> : null}

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ShoppingCart size={44} color={COLORS.muted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptyDesc}>Be the first to post in this category.</Text>
          </View>
        }
      />

      <PostModal visible={showPost} onClose={() => { setShowPost(false); setPostError(null); }} onSubmit={handlePost} error={postError} animals={myAnimals} />

      {/* Bid amount modal */}
      <Modal visible={!!bidTarget} animationType="fade" transparent onRequestClose={() => setBidTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{currentUser?.role === 'Retailer' ? 'Place a Bid' : 'Enquire'}</Text>
              <TouchableOpacity onPress={() => setBidTarget(null)}><X size={20} color={COLORS.muted} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
              For "{bidTarget?.product_name}" — listed at ${Number(bidTarget?.price || 0).toLocaleString()}
            </Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Offer Amount (USD) *</Text>
              <TextInput
                style={styles.formInput} keyboardType="decimal-pad" autoFocus
                value={bidAmount} onChangeText={setBidAmount} placeholderTextColor="#bbb"
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={submitBid} activeOpacity={0.8}>
              <Text style={styles.submitText}>Send Offer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Order quantity modal */}
      <Modal visible={!!orderTarget} animationType="fade" transparent onRequestClose={() => setOrderTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Place Order</Text>
              <TouchableOpacity onPress={() => setOrderTarget(null)}><X size={20} color={COLORS.muted} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
              For "{orderTarget?.product_name}" — ${Number(orderTarget?.price || 0).toLocaleString()}/{orderTarget?.unit} from {orderTarget?.seller_name}
            </Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Quantity ({orderTarget?.unit}) *</Text>
              <TextInput
                style={styles.formInput} keyboardType="decimal-pad" autoFocus
                value={orderQty} onChangeText={setOrderQty} placeholderTextColor="#bbb"
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={submitOrder} activeOpacity={0.8}>
              <Text style={styles.submitText}>Place Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:      { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:   { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:  { color: '#a5d6a7', fontSize: 11, marginTop: 2 },
  postBtn:     { backgroundColor: COLORS.yellow, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, elevation: 4 },
  postBtnText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, paddingHorizontal: 14, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  catScroll:   { flexGrow: 0 },
  catContent:  { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  catTab:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  catTabText:  { fontSize: 12, fontWeight: '700', color: COLORS.text },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 3, overflow: 'hidden' },
  cardImage:   { width: '100%', height: 140, borderRadius: 12, marginBottom: 10 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  catBadge:    { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  cardName:    { fontSize: 16, fontWeight: '900', color: COLORS.text, maxWidth: 200 },
  priceBox:    { alignItems: 'flex-end' },
  priceVal:    { fontSize: 18, fontWeight: '900' },
  priceUnit:   { fontSize: 10, color: COLORS.muted },
  cardDesc:    { fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 18 },
  cardMeta:    { gap: 5, marginBottom: 12 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:    { fontSize: 12, color: COLORS.muted },
  cardActions: { flexDirection: 'row', gap: 10 },
  callBtn:     { flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  bidBtn:      { flex: 2, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bidBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  bidsToggleBtn:  { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1f2937' },
  bidsToggleText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bidsPanel:      { marginTop: 8, gap: 8 },
  bidsEmpty:      { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', paddingVertical: 8 },
  bidRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 10, padding: 10 },
  bidderName:     { fontSize: 12, fontWeight: '800', color: COLORS.text },
  bidStatus:      { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },
  acceptBtn:      { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptBtnText:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyState:  { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptyDesc:   { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:  { fontSize: 20, fontWeight: '900', color: COLORS.text },
  errorBanner: { backgroundColor: '#ffebee', color: COLORS.danger, fontSize: 12, fontWeight: '700', padding: 12, borderRadius: 10, marginBottom: 14 },
  photoPicker: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  photoPreview:{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#f5f5f5' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  photoPickerText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  formField:   { marginBottom: 14 },
  formLabel:   { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 6 },
  formInput:   { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text },
  catRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0' },
  catChipText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  submitBtn:   { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  submitText:  { color: '#fff', fontWeight: '900', fontSize: 15 },
  helpText:    { fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 6 },
  clearBox:    { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, marginBottom: 16, gap: 4 },
  clearTitle:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase' },
});
