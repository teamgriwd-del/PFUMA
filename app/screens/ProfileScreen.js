import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { COLORS, API } from '../config';

const MenuItem = ({ emoji, label, desc, color, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.menuIcon, { backgroundColor: color + '22' }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuLabel}>{label}</Text>
      {desc ? <Text style={styles.menuDesc}>{desc}</Text> : null}
    </View>
    <Text style={{ color: '#ccc', fontSize: 18 }}>›</Text>
  </TouchableOpacity>
);

const ROLE_EMOJI  = { Farmer: '🌾', Veterinarian: '🩺', Supplier: '💊', Retailer: '🏪' };
const ROLE_COLOR  = { Farmer: COLORS.primary, Veterinarian: '#1e293b', Supplier: '#ea580c', Retailer: '#6d28d9' };

export default function ProfileScreen({ navigation, currentUser, onLogout }) {
  const role      = currentUser?.role || 'Farmer';
  const headerBg  = ROLE_COLOR[role]  || COLORS.primary;
  const emoji     = ROLE_EMOJI[role]  || '🌾';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{emoji}</Text>
        </View>
        <Text style={styles.userName}>{currentUser?.name || 'User'}</Text>
        <Text style={styles.userRole}>{role} · {currentUser?.province || 'Zimbabwe'}</Text>
        {currentUser?.org ? <Text style={styles.userOrg}>{currentUser.org}</Text> : null}
        <View style={styles.userStats}>
          <View style={styles.userStat}><Text style={styles.userStatVal}>2</Text><Text style={styles.userStatLabel}>Animals</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.userStat}><Text style={styles.userStatVal}>1</Text><Text style={styles.userStatLabel}>Listed</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.userStat}><Text style={styles.userStatVal}>2</Text><Text style={styles.userStatLabel}>Events</Text></View>
        </View>
      </View>

      {/* My Tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Farm</Text>
        <View style={styles.menuCard}>
          <MenuItem emoji="🐄" label="Herd Registry"   desc="View and manage your animals"     color={COLORS.primary} onPress={() => navigation.navigate('Herd')} />
          <MenuItem emoji="🛒" label="My Listings"     desc="Animals and products for sale"     color="#e65100"       onPress={() => navigation.navigate('Market')} />
          <MenuItem emoji="🌾" label="Feed Analyzer"   desc="Check livestock nutrition"          color="#558b2f"       onPress={() => navigation.navigate('Feed')} />
        </View>
      </View>

      {/* Connect */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect</Text>
        <View style={styles.menuCard}>
          <MenuItem emoji="🩺" label="Contact a Vet"   desc="DVS Duty Officer — Dr T. Moyo"     color="#1565c0"       onPress={() => Linking.openURL('tel:+263242706331')} />
          <MenuItem emoji="💊" label="Order Medicines" desc="AgroChem Zim · VetDirect"           color="#6a1b9a"       onPress={() => Linking.openURL('tel:+263774000004')} />
          <MenuItem emoji="🚨" label="DVS Emergency"   desc="+263 242 706331 · Harare HQ"        color={COLORS.danger} onPress={() => Linking.openURL('tel:+263242706331')} />
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
            <Text style={{ fontSize: 22 }}>🚪</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#dc2626', flex: 1 }}>Sign Out</Text>
            <Text style={{ color: '#fca5a5', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* About */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={styles.aboutCard}>
          <View style={styles.aboutLogo}><Text style={styles.aboutLogoText}>R</Text></View>
          <Text style={styles.aboutName}>PFUMA</Text>
          <Text style={styles.aboutTagline}>Zimbabwe's Livestock Intelligence Platform</Text>
          <Text style={styles.aboutDesc}>Built by Arnold Mapindu &amp; Addy · 2026{'\n'}React Native (Expo) · Flask API · MySQL</Text>
          <View style={styles.stakeholderRow}>
            {['🌾 Farmer','🩺 Vet','💊 Supplier','🏪 Retailer'].map(s => (
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
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 6 },
  avatarText:     { fontSize: 40 },
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
  aboutLogo:      { width: 52, height: 52, backgroundColor: COLORS.yellow, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 4 },
  aboutLogoText:  { color: COLORS.primary, fontSize: 30, fontWeight: '900' },
  aboutName:      { color: '#fff', fontSize: 20, fontWeight: '900' },
  aboutTagline:   { color: '#a5d6a7', fontSize: 12, marginTop: 4, marginBottom: 8 },
  aboutDesc:      { color: '#a5d6a7', fontSize: 11, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  stakeholderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  stakeholderChip:{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  stakeholderText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
});
