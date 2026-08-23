import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, Alert, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Search, Beef, X, Camera, Check, ShieldCheck, Tag, Printer, Download } from 'lucide-react-native';
import { API, COLORS } from '../config';
import { authFetch, authJson, assetToFormFile } from '../api';
import PhotoLightbox from '../components/PhotoLightbox';

const SPECIES = ['Cattle','Goat'];
const todayStr = () => new Date().toISOString().slice(0, 10);

// A real uploaded photo is a relative /uploads/... path from the backend;
// the species stock fallback (or a picked-but-not-yet-uploaded local file)
// is already a usable URI as-is.
const resolveImageUrl = (url) => (url && url.startsWith('/uploads/')) ? `${API}${url}` : url;

const calculateAge = (dob) => {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '—';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  return `${years}y ${months}m`;
};

// Mirrors the web app's src/components/AnimalProfile/AnimalProfile.jsx
// calculateValue() so the same animal shows the same estimated value on
// both platforms.
const calculateValue = (animal, healthEvents) => {
  const base = animal.species === 'Cattle' ? 500 : 100;
  return Math.round(base + (animal.current_weight || 0) * 1.5 + healthEvents.length * 10).toLocaleString();
};

// Print/export render an actual PDF (via expo-print's HTML-to-PDF engine),
// not a screenshot of the on-screen modal — same reasoning as the web
// app's passport fix: build the full document as real HTML so nothing
// gets clipped to whatever fit on screen.
const passportHtml = (animal, healthEvents) => {
  const rows = [
    ['Name', animal.name],
    ['Ear Tag', animal.tag_id ? `#${animal.tag_id}` : '—'],
    ['Owner Brand', animal.brand_id || '—'],
    ['Breed', animal.breed || '—'],
    ['Species', animal.species],
    ['Age', calculateAge(animal.birth_date)],
    ['Weight', `${animal.current_weight || 0} kg`],
    ['Sire ID', animal.sire_id || '—'],
  ];
  const logHtml = healthEvents.length === 0
    ? '<p class="empty">No certified events recorded yet.</p>'
    : healthEvents.map(ev => `
        <div class="log-row">
          <span class="log-text">${ev.event_type}${ev.notes ? ' — ' + ev.notes : ''}</span>
          <span class="log-date">${new Date(ev.event_date).toLocaleDateString()}</span>
        </div>`).join('');
  const imgSrc = resolveImageUrl(animal.image_url) || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Roboto, Arial, sans-serif; margin: 0; background: #fdfcf9; color: #1a1a1a; }
      .header { background: #1b5e20; color: #fff; padding: 24px 28px; }
      .header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: 1px; }
      .header p { margin: 0; font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 2px; }
      .body { padding: 20px 28px 32px; }
      img.photo { width: 100%; max-height: 320px; object-fit: cover; border-radius: 16px; margin-bottom: 16px; }
      .value-card { background: #fff; border-radius: 14px; padding: 16px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .value-label { font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .value { font-size: 22px; font-weight: 900; }
      .section-title { font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin: 0 0 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 28px; }
      .field-label { font-size: 10px; font-weight: 800; color: #1b5e20; text-transform: uppercase; margin-bottom: 2px; }
      .field-value { font-size: 16px; font-weight: 900; }
      .empty { font-size: 13px; color: #999; font-style: italic; }
      .log-row { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
      .log-text { font-size: 13px; font-weight: 700; }
      .log-date { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; margin-left: 10px; white-space: nowrap; }
      .footer { text-align: center; font-size: 10px; font-weight: 800; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; }
    </style>
  </head><body>
    <div class="header">
      <h1>Health Passport</h1>
      <p>Verified Digital Pedigree &amp; Medical Record</p>
    </div>
    <div class="body">
      ${imgSrc ? `<img class="photo" src="${imgSrc}" />` : ''}
      <div class="value-card">
        <div class="value-label">Estimated Market Value</div>
        <div class="value">USD $${calculateValue(animal, healthEvents)}</div>
      </div>
      <h2 class="section-title">Identity Details</h2>
      <div class="grid">
        ${rows.map(([label, value]) => `<div><div class="field-label">${label}</div><div class="field-value">${value}</div></div>`).join('')}
      </div>
      <h2 class="section-title">Health Event Log</h2>
      ${logHtml}
      <p class="footer">PFUMA Verified · ${new Date().getFullYear()}</p>
    </div>
  </body></html>`;
};

export default function HerdScreen({ currentUser }) {
  const [animals,    setAnimals]    = useState([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [form, setForm] = useState({ name:'', species:'Cattle', breed:'', tag_id:'', birth_date: todayStr(), current_weight:'' });
  const [photos, setPhotos] = useState([]); // [{ uri, name, type }] — first is the cover photo
  const [saving, setSaving] = useState(false);
  const [listingAnimal, setListingAnimal] = useState(null); // animal being priced for listing
  const [priceInput, setPriceInput] = useState('');
  const [passportAnimal, setPassportAnimal] = useState(null); // animal whose Health Passport is open
  const [healthEvents, setHealthEvents] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [passportExporting, setPassportExporting] = useState(false);
  const [passportUploading, setPassportUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed

  const openPassport = async (animal) => {
    setPassportAnimal(animal);
    setHealthEvents([]);
    setHealthLoading(true);
    try {
      const res = await authFetch(currentUser, `/animals/${animal.id}/health`);
      if (res.ok) setHealthEvents(await res.json());
    } catch { /* offline — passport still shows identity details, just no history */ }
    setHealthLoading(false);
  };

  const printPassport = async () => {
    if (!passportAnimal) return;
    try {
      await Print.printAsync({ html: passportHtml(passportAnimal, healthEvents) });
    } catch (err) {
      if (err?.message && !/cancel/i.test(err.message)) {
        Alert.alert('Could not print', 'Try again, or use Download PDF instead.');
      }
    }
  };

  // One photo per request, uploaded one after another — not all of them
  // bundled into a single multipart body. React Native's FormData has been
  // unreliable about carrying more than one file under the same field name
  // in one request (later parts silently dropped on some RN/Android
  // combinations); a request per file sidesteps that entirely and means a
  // failure on photo 3 doesn't undo 1 and 2, and reports exactly which one
  // failed instead of one opaque "could not add photos" for the whole batch.
  const uploadOnePhoto = async (animalId, asset) => {
    const fd = new FormData();
    fd.append('photos', assetToFormFile(asset));
    const res = await authFetch(currentUser, `/animals/${animalId}/photos`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'upload failed');
    return data.photos?.[0]?.image_url;
  };

  const addPassportPhotos = async () => {
    if (!passportAnimal) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    setPassportUploading(true);
    const newUrls = [];
    let failed = 0;
    let lastError = '';
    for (const asset of result.assets) {
      try {
        const url = await uploadOnePhoto(passportAnimal.id, asset);
        if (url) {
          newUrls.push(url);
          // Reflect each photo as soon as it lands, not only after the
          // whole batch finishes — so if a later one fails, the earlier
          // successful ones are still visibly saved, not lost from view.
          setPassportAnimal(prev => ({ ...prev, photos: [...(prev.photos || (prev.image_url ? [prev.image_url] : [])), url] }));
          setAnimals(prev => prev.map(a => a.id === passportAnimal.id
            ? { ...a, photos: [...(a.photos || (a.image_url ? [a.image_url] : [])), url] }
            : a));
        }
      } catch (err) {
        failed += 1;
        lastError = err?.message || '';
      }
    }
    setPassportUploading(false);
    if (failed > 0) {
      Alert.alert('Some photos didn\'t upload', `${newUrls.length} added, ${failed} failed${lastError ? `: ${lastError}` : ''} — try adding the missing one(s) again.`);
    }
  };

  const downloadPassport = async () => {
    if (!passportAnimal) return;
    setPassportExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: passportHtml(passportAnimal, healthEvents) });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${passportAnimal.name} — Health Passport` });
      } else {
        Alert.alert('PDF saved', uri);
      }
    } catch {
      Alert.alert('Could not export PDF', 'Try again.');
    }
    setPassportExporting(false);
  };

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await authFetch(currentUser, '/animals');
      if (res.ok) setAnimals(await res.json());
    } catch { /* offline — leave whatever was last loaded, no fake fallback */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [currentUser?.token]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.map(asset => assetToFormFile(asset));
    setPhotos(prev => [...prev, ...picked]);
  };

  const removePhoto = (index) => setPhotos(prev => prev.filter((_, i) => i !== index));

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('species', form.species);
    fd.append('breed', form.breed || '');
    fd.append('tag_id', form.tag_id || '');
    fd.append('birth_date', form.birth_date || '');
    fd.append('birth_weight', form.current_weight || '0');
    fd.append('current_weight', form.current_weight || '0');
    if (photos[0]) fd.append('photo', photos[0]);

    const res = await authFetch(currentUser, '/animals', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      Alert.alert('Could not register animal', data.error || 'Try again.');
      setSaving(false);
      return;
    }
    // Extra photos beyond the cover go one request at a time (see
    // uploadOnePhoto) rather than bundled into the registration request —
    // more reliable, and a failure here doesn't undo the registration.
    let extraFailed = 0;
    for (const p of photos.slice(1)) {
      try { await uploadOnePhoto(data.id, p); } catch { extraFailed += 1; }
    }
    await load();
    setSaving(false); setShowAdd(false); setPhotos([]);
    if (extraFailed > 0) {
      Alert.alert('Animal registered', `${photos.length - 1 - extraFailed} of ${photos.length - 1} extra photo(s) uploaded — add the rest from its Health Passport.`);
    }
    setForm({ name:'', species:'Cattle', breed:'', tag_id:'', birth_date: todayStr(), current_weight:'' });
  };

  // Turning listing ON needs a price (same rule as the web app) — opens the
  // price modal below instead of toggling immediately. Turning it OFF
  // withdraws the listing right away, no price needed.
  const toggleSale = (animal) => {
    if (!animal.for_sale) { setListingAnimal(animal); setPriceInput(''); return; }
    submitSaleToggle(animal, null);
  };

  const submitSaleToggle = async (animal, price) => {
    const { ok, data } = await authJson(currentUser, `/animals/${animal.id}/sale`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(price ? { price } : {}),
    });
    if (!ok) { Alert.alert('Could not update listing', data.error || 'Try again.'); return; }
    setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, for_sale: data.for_sale } : a));
  };

  const confirmListing = async () => {
    const price = parseFloat(priceInput);
    if (!price || price <= 0) { Alert.alert('Enter a valid price to list this animal.'); return; }
    await submitSaleToggle(listingAnimal, price);
    setListingAnimal(null);
  };

  const filtered = animals.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.breed?.toLowerCase().includes(search.toLowerCase()) ||
    a.species?.toLowerCase().includes(search.toLowerCase())
  );

  const passportPhotos = passportAnimal
    ? (passportAnimal.photos?.length > 0 ? passportAnimal.photos : (passportAnimal.image_url ? [passportAnimal.image_url] : [])).map(resolveImageUrl)
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>PFUMA</Text>
          <Text style={styles.headerTitle}>Herd Registry</Text>
          <Text style={styles.headerDesc}>{animals.length} animal{animals.length !== 1 ? 's' : ''} registered</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search animals..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Beef size={44} color={COLORS.muted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No animals yet</Text>
            <Text style={styles.emptyDesc}>Tap "+ Add" to register your first animal.</Text>
          </View>
        ) : filtered.map(a => (
          <View key={a.id} style={styles.card}>
            {a.image_url ? (
              <Image source={{ uri: resolveImageUrl(a.image_url) }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: COLORS.light, alignItems: 'center', justifyContent: 'center' }]}>
                <Beef size={32} color={COLORS.primary} strokeWidth={1.5} />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <View style={styles.tagBadge}><Text style={styles.tagText}>#{a.tag_id || 'NO TAG'}</Text></View>
                <Text style={styles.speciesBadge}>{a.species}</Text>
              </View>
              <Text style={styles.cardName}>{a.name}</Text>
              <Text style={styles.cardSub}>{a.breed} · {a.current_weight}kg</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.saleBtn, a.for_sale && styles.saleBtnActive]}
                  onPress={() => toggleSale(a)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saleBtnText, a.for_sale && styles.saleBtnTextActive]}>
                    {a.for_sale ? 'Listed for Sale' : 'List for Sale'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.passportBtn} onPress={() => openPassport(a)} activeOpacity={0.8}>
                  <Text style={styles.passportText}>Passport</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Animal Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Animal</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><X size={20} color={COLORS.muted} /></TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Photos {photos.length > 0 ? `(${photos.length}, first is the cover photo)` : '(optional — add as many as you like)'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {photos.map((p, i) => (
                <View key={p.uri} style={styles.photoThumbWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  {i === 0 && <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>COVER</Text></View>}
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(i)} activeOpacity={0.8}>
                    <X size={11} color="#fff" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={[styles.photoThumb, styles.photoPlaceholder, { marginRight: 0 }]} onPress={pickPhoto} activeOpacity={0.8}>
                <Camera size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </ScrollView>

            {[
              { label: 'Animal Name *', key: 'name',            placeholder: 'e.g. Bessie' },
              { label: 'Breed',         key: 'breed',           placeholder: 'e.g. Brahman' },
              { label: 'Ear Tag ID',    key: 'tag_id',          placeholder: 'e.g. ZIM-001' },
              { label: 'Date of Birth', key: 'birth_date',      placeholder: 'YYYY-MM-DD' },
              { label: 'Weight (kg)',   key: 'current_weight',  placeholder: 'e.g. 35', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.key} style={styles.formField}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType={f.keyboard || 'default'}
                  placeholderTextColor="#bbb"
                />
              </View>
            ))}

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Species</Text>
              <View style={styles.speciesRow}>
                {SPECIES.map(s => (
                  <TouchableOpacity
                    key={s} activeOpacity={0.8}
                    style={[styles.speciesChip, form.species === s && styles.speciesChipActive]}
                    onPress={() => setForm(p => ({ ...p, species: s }))}
                  >
                    <Text style={[styles.speciesChipText, form.species === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Check size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.submitText}>Register Animal</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Listing price modal — turning "For Sale" on requires a price */}
      <Modal visible={!!listingAnimal} animationType="fade" transparent onRequestClose={() => setListingAnimal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List {listingAnimal?.name}</Text>
              <TouchableOpacity onPress={() => setListingAnimal(null)}><X size={20} color={COLORS.muted} /></TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Asking Price (USD) *</Text>
              <TextInput
                style={styles.formInput} placeholder="e.g. 650" keyboardType="numeric" autoFocus
                value={priceInput} onChangeText={setPriceInput} placeholderTextColor="#bbb"
              />
            </View>
            <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 14 }}>
              Submitted for police sale clearance — visible on the Marketplace once cleared.
            </Text>
            <TouchableOpacity style={styles.submitBtn} onPress={confirmListing} activeOpacity={0.8}>
              <Text style={styles.submitText}>List For Sale</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Health Passport — full animal identity + health history, mirrors
          the web app's Health Passport modal. */}
      <Modal visible={!!passportAnimal} animationType="slide" onRequestClose={() => { setPassportAnimal(null); setLightboxIndex(null); }}>
        {passportAnimal && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fdfcf9' }}>
            <View style={styles.passportHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={22} color={COLORS.yellow} />
                <View>
                  <Text style={styles.passportHeaderTitle}>Health Passport</Text>
                  <Text style={styles.passportHeaderSub}>Verified Digital Pedigree &amp; Medical Record</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={styles.passportCloseBtn} onPress={printPassport} activeOpacity={0.8} disabled={passportExporting}>
                  <Printer size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.passportCloseBtn} onPress={downloadPassport} activeOpacity={0.8} disabled={passportExporting}>
                  {passportExporting ? <ActivityIndicator size="small" color="#fff" /> : <Download size={16} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.passportCloseBtn} onPress={() => { setPassportAnimal(null); setLightboxIndex(null); }} activeOpacity={0.8}>
                  <X size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {passportAnimal.image_url ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxIndex(0)}>
                  <Image source={{ uri: resolveImageUrl(passportAnimal.image_url) }} style={styles.passportImage} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.passportImage, { backgroundColor: COLORS.light, alignItems: 'center', justifyContent: 'center' }]}>
                  <Beef size={48} color={COLORS.primary} strokeWidth={1.5} />
                </View>
              )}

              <Text style={styles.passportSectionTitle}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {passportPhotos.map((url, i) => (
                  <TouchableOpacity key={url + i} onPress={() => setLightboxIndex(i)} activeOpacity={0.85}>
                    <Image source={{ uri: url }} style={styles.galleryThumb} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.galleryThumb, styles.galleryAddThumb]} onPress={addPassportPhotos} activeOpacity={0.8} disabled={passportUploading}>
                  {passportUploading ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
                    <>
                      <Camera size={18} color={COLORS.primary} />
                      <Text style={styles.galleryAddText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.passportValueCard}>
                <Text style={styles.passportSectionLabel}>Estimated Market Value</Text>
                <Text style={styles.passportValue}>USD ${calculateValue(passportAnimal, healthEvents)}</Text>
                <Text style={styles.passportValueSub}>Based on weight, species, and health records</Text>
              </View>

              <Text style={styles.passportSectionTitle}>Identity Details</Text>
              <View style={styles.passportGrid}>
                {[
                  { label: 'Name', value: passportAnimal.name },
                  { label: 'Ear Tag', value: passportAnimal.tag_id ? `#${passportAnimal.tag_id}` : '—' },
                  { label: 'Owner Brand', value: passportAnimal.brand_id || '—' },
                  { label: 'Breed', value: passportAnimal.breed || '—' },
                  { label: 'Species', value: passportAnimal.species },
                  { label: 'Age', value: calculateAge(passportAnimal.birth_date) },
                  { label: 'Weight', value: `${passportAnimal.current_weight || 0} kg` },
                  { label: 'Sire ID', value: passportAnimal.sire_id || '—' },
                ].map(f => (
                  <View key={f.label} style={styles.passportGridItem}>
                    <Text style={styles.passportFieldLabel}>{f.label}</Text>
                    <Text style={styles.passportFieldValue}>{f.value}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.passportSectionTitle}>Health Event Log</Text>
              {healthLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
              ) : healthEvents.length === 0 ? (
                <Text style={styles.passportEmptyLog}>No certified events recorded yet.</Text>
              ) : (
                healthEvents.map(ev => (
                  <View key={ev.id} style={styles.passportLogRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={styles.passportLogDot} />
                      <Text style={styles.passportLogText} numberOfLines={2}>{ev.event_type}{ev.notes ? ` — ${ev.notes}` : ''}</Text>
                    </View>
                    <Text style={styles.passportLogDate}>{new Date(ev.event_date).toLocaleDateString()}</Text>
                  </View>
                ))
              )}

              <View style={styles.passportFooter}>
                <Tag size={12} color={COLORS.primary} />
                <Text style={styles.passportFooterText}>PFUMA Verified · {new Date().getFullYear()}</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      <PhotoLightbox
        visible={lightboxIndex !== null}
        photos={passportPhotos}
        startIndex={lightboxIndex || 0}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header:         { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:      { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:    { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:     { color: '#a5d6a7', fontSize: 12, fontWeight: '600', marginTop: 2 },
  addBtn:         { backgroundColor: COLORS.yellow, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, elevation: 4 },
  addBtnText:     { color: COLORS.primary, fontWeight: '900', fontSize: 14 },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, borderRadius: 14, paddingHorizontal: 14, elevation: 2 },
  searchIcon:     { fontSize: 16, marginRight: 8 },
  searchInput:    { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  card:           { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, overflow: 'hidden', elevation: 3 },
  cardImage:      { width: '100%', height: 160 },
  cardBody:       { padding: 16 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tagBadge:       { backgroundColor: COLORS.light, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:        { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  speciesBadge:   { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardName:       { fontSize: 20, fontWeight: '900', color: COLORS.text },
  cardSub:        { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 12 },
  cardActions:    { flexDirection: 'row', gap: 10 },
  saleBtn:        { flex: 1, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  saleBtnActive:  { backgroundColor: '#fbc02d', borderColor: '#fbc02d' },
  saleBtnText:    { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  saleBtnTextActive: { color: COLORS.primary },
  passportBtn:    { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center' },
  passportText:   { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  emptyState:     { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:     { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptyDesc:      { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 20, fontWeight: '900', color: COLORS.text },
  modalClose:     { fontSize: 20, color: COLORS.muted },
  photoPicker:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  photoPreview:   { width: 56, height: 56, borderRadius: 14, backgroundColor: '#f5f5f5' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  photoPickerText:{ fontSize: 13, fontWeight: '800', color: COLORS.primary },
  photoThumbWrap: { marginRight: 10 },
  photoThumb:     { width: 72, height: 72, borderRadius: 14, backgroundColor: '#f5f5f5', marginRight: 10 },
  coverBadge:     { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(27,94,32,0.85)', borderRadius: 6, paddingVertical: 2, alignItems: 'center' },
  coverBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  photoRemoveBtn: { position: 'absolute', top: -4, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.danger || '#d32f2f', alignItems: 'center', justifyContent: 'center' },
  formField:      { marginBottom: 14 },
  formLabel:      { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formInput:      { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text },
  speciesRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  speciesChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#f9f9f9' },
  speciesChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  speciesChipText:{ fontSize: 12, fontWeight: '700', color: COLORS.muted },
  submitBtn:      { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10, elevation: 4 },
  submitText:     { color: '#fff', fontWeight: '900', fontSize: 15 },

  passportHeader:      { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  passportHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  passportHeaderSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  passportCloseBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  passportImage:       { width: '100%', height: 220, borderRadius: 20, marginBottom: 14 },
  galleryThumb:        { width: 84, height: 84, borderRadius: 14, backgroundColor: COLORS.light, marginRight: 10 },
  galleryAddThumb:      { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed', marginRight: 0 },
  galleryAddText:       { fontSize: 10, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  passportValueCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
  passportSectionLabel:{ fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  passportValue:       { fontSize: 24, fontWeight: '900', color: COLORS.text },
  passportValueSub:    { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  passportSectionTitle:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5e5', paddingBottom: 8 },
  passportGrid:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  passportGridItem:    { width: '50%', marginBottom: 16 },
  passportFieldLabel:  { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', marginBottom: 2 },
  passportFieldValue:  { fontSize: 16, fontWeight: '900', color: COLORS.text },
  passportEmptyLog:    { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },
  passportLogRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  passportLogDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primary },
  passportLogText:      { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  passportLogDate:      { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginLeft: 10 },
  passportFooter:       { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 20 },
  passportFooterText:   { fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
