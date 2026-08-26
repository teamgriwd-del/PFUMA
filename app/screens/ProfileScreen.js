import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Users, ShoppingCart, Wheat, Stethoscope, Pill, AlertTriangle,
  Store, Sprout, LogOut, ChevronRight, Camera,
} from 'lucide-react-native';
import { COLORS, API } from '../config';
import { authFetch, assetToFormFile } from '../api';
import pfumaMark from '../assets/pfuma-mark.png';

const MenuItem = ({ icon: Icon, label, desc, color, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.menuIcon, { backgroundColor: color + '22' }]}>
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuLabel}>{label}</Text>
      {desc ? <Text style={styles.menuDesc}>{desc}</Text> : null}
    </View>
    <ChevronRight size={18} color="#ccc" />
  </TouchableOpacity>
);

const ROLE_ICON  = { Farmer: Sprout, Veterinarian: Stethoscope, Supplier: Pill, Buyer: Store };
const ROLE_COLOR = { Farmer: COLORS.primary, Veterinarian: '#1e293b', Supplier: '#ea580c', Buyer: '#6d28d9' };

export default function ProfileScreen({ navigation, currentUser, onLogout, onUserUpdate }) {
  const role      = currentUser?.role || 'Farmer';
  const headerBg  = ROLE_COLOR[role]  || COLORS.primary;
  const RoleIcon  = ROLE_ICON[role]   || Sprout;
  const [stats, setStats] = useState({ animals: 0, listings: 0, messages: 0 });
  const [avatarUploading, setAvatarUploading] = useState(false);

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo library access in Settings to change your profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setAvatarUploading(true);
    const fd = new FormData();
    fd.append('photo', assetToFormFile(asset));
    const res = await authFetch(currentUser, '/users/me/avatar', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    setAvatarUploading(false);
    if (!res.ok) { Alert.alert('Could not update photo', data.error || 'Try again.'); return; }
    onUserUpdate?.({ avatarUrl: `${API}${data.avatar_url}` });
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, `/dashboard/${currentUser.id}`);
        if (res.ok) setStats(await res.json());
      } catch { /* offline — leave zeros, no fake numbers */ }
    })();
  }, [currentUser?.id]);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.avatar} onPress={changeAvatar} activeOpacity={0.8} disabled={avatarUploading}>
          {currentUser?.avatarUrl ? (
            <Image source={{ uri: currentUser.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <RoleIcon size={36} color={headerBg} strokeWidth={2.2} />
          )}
          <View style={styles.avatarBadge}>
            {avatarUploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={13} color="#fff" strokeWidth={2.4} />}
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{currentUser?.name || 'User'}</Text>
        <Text style={styles.userRole}>{role} · {currentUser?.province || 'Zimbabwe'}</Text>
        {currentUser?.org ? <Text style={styles.userOrg}>{currentUser.org}</Text> : null}
        <View style={styles.userStats}>
          <View style={styles.userStat}><Text style={styles.userStatVal}>{stats.animals ?? 0}</Text><Text style={styles.userStatLabel}>Animals</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.userStat}><Text style={styles.userStatVal}>{stats.listings ?? 0}</Text><Text style={styles.userStatLabel}>Listed</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.userStat}><Text style={styles.userStatVal}>{stats.messages ?? 0}</Text><Text style={styles.userStatLabel}>Events</Text></View>
        </View>
      </View>

      {/* My Tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Farm</Text>
        <View style={styles.menuCard}>
          <MenuItem icon={Users}        label="Herd Registry"   desc="View and manage your animals"     color={COLORS.primary} onPress={() => navigation.navigate('Herd')} />
          <MenuItem icon={ShoppingCart} label="My Listings"     desc="Animals and products for sale"     color="#e65100"       onPress={() => navigation.navigate('Market')} />
          <MenuItem icon={Wheat}        label="Feed Analyzer"   desc="Check livestock nutrition"          color="#558b2f"       onPress={() => navigation.navigate('Feed')} />
        </View>
      </View>

      {/* Connect */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect</Text>
        <View style={styles.menuCard}>
          <MenuItem icon={Stethoscope} label="Contact a Vet"   desc="DVS Duty Officer — Dr T. Moyo"     color="#1565c0"       onPress={() => Linking.openURL('tel:+263242706331')} />
          <MenuItem icon={Pill}        label="Order Medicines" desc="AgroChem Zim · VetDirect"           color="#6a1b9a"       onPress={() => Linking.openURL('tel:+263774000004')} />
          <MenuItem icon={AlertTriangle} label="DVS Emergency" desc="+263 242 706331 · Harare HQ"        color={COLORS.danger} onPress={() => Linking.openURL('tel:+263242706331')} />
        </View>
      </View>

      {/* API status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System</Text>
        <View style={styles.menuCard}>
          <View style={styles.apiStatus}>
            <View style={styles.apiDot} />
            <View>
              <Text style={styles.apiLabel}>PFUMA API</Text>
              <Text style={styles.apiUrl}>{API}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sign out */}
      {onLogout && (
        <View style={[styles.section, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#fca5a5', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <LogOut size={20} color="#dc2626" strokeWidth={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#dc2626', flex: 1 }}>Sign Out</Text>
            <ChevronRight size={18} color="#fca5a5" />
          </TouchableOpacity>
        </View>
      )}

      {/* About */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={styles.aboutCard}>
          <View style={styles.aboutLogo}><Image source={pfumaMark} style={styles.aboutLogoImg} /></View>
          <Text style={styles.aboutName}>PFUMA</Text>
          <Text style={styles.aboutTagline}>Zimbabwe's Livestock Intelligence Platform</Text>
          <Text style={styles.aboutDesc}>Built by Arnold Mapindu &amp; Addy · 2026{'\n'}React Native (Expo) · Flask API · MySQL</Text>
          <View style={styles.stakeholderRow}>
            {['Farmer', 'Vet', 'Supplier', 'Buyer'].map(s => (
              <View key={s} style={styles.stakeholderChip}><Text style={styles.stakeholderText}>{s}</Text></View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  header:         { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, alignItems: 'center', paddingBottom: 32 },
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 6, overflow: 'hidden' },
  avatarImg:      { width: '100%', height: '100%' },
  avatarBadge:    { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  userName:       { color: '#fff', fontSize: 22, fontWeight: '900' },
  userRole:       { color: '#a5d6a7', fontSize: 13, fontWeight: '600', marginTop: 4 },
  userOrg:        { color: '#a5d6a7', fontSize: 12, fontWeight: '600', marginTop: 2 },
  userStats:      { flexDirection: 'row', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, gap: 24 },
  userStat:       { alignItems: 'center', flex: 1 },
  userStatVal:    { color: '#fff', fontSize: 22, fontWeight: '900' },
  userStatLabel:  { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  statDivider:    { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  section:        { marginHorizontal: 16, marginTop: 20 },
  sectionTitle:   { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  menuCard:       { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 2 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 14 },
  menuIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel:      { fontSize: 14, fontWeight: '800', color: COLORS.text },
  menuDesc:       { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  apiStatus:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  apiDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4caf50' },
  apiLabel:       { fontSize: 14, fontWeight: '800', color: COLORS.text },
  apiUrl:         { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  aboutCard:      { backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, alignItems: 'center' },
  aboutLogo:      { width: 52, height: 52, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 4, padding: 8 },
  aboutLogoImg:   { width: '100%', height: '100%', resizeMode: 'contain' },
  aboutName:      { color: '#fff', fontSize: 20, fontWeight: '900' },
  aboutTagline:   { color: '#a5d6a7', fontSize: 12, marginTop: 4, marginBottom: 8 },
  aboutDesc:      { color: '#a5d6a7', fontSize: 11, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  stakeholderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  stakeholderChip:{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  stakeholderText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
});
